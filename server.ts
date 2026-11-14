import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_CATEGORIES = [
  'Loans & EMI',
  'Food & Dining',
  'Petrol & Fuel',
  'Utilities & Bills',
  'Investments',
  'Shopping & Lifestyle',
  'Housing & Rent',
  'Other',
];

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/parse-statement', async (req, res) => {
    try {
      const { fileName, mimeType, base64Data, textContent, customRules } =
        req.body as {
          fileName?: string;
          mimeType?: string;
          base64Data?: string;
          textContent?: string;
          customRules?: Array<{ keyword: string; category: string }>;
        };

      if (!base64Data && !textContent) {
        res.status(400).json({
          error: 'No statement file content provided. Upload a .csv, .txt, or .pdf statement.',
        });
        return;
      }

      const ai = getGeminiClient();

      const rulesPrompt =
        customRules && customRules.length > 0
          ? `\nApply these user-saved merchant keyword rules with highest priority:\n${customRules
              .map((r) => `- If narration contains "${r.keyword}" -> "${r.category}"`)
              .join('\n')}\n`
          : '';

      const systemPrompt = `You are an expert bank statement parser and transaction classifier.
Extract ALL financial transactions from the provided bank statement (${fileName || 'statement'}).
Ignore opening/closing balance summary rows, header lines, and footer disclaimers.

Classification rules for DEBIT transactions (pick exactly one category from this list):
- "Loans & EMI": Home loan, car loan, personal loan, EMI, NACH loan debit, mortgage, HDFC Ltd, Bajaj Finserv EMI.
- "Food & Dining": Swiggy, Zomato, UberEats, DoorDash, restaurants, cafes, bakeries, Starbucks, groceries, BigBasket, Blinkit, Zepto, Whole Foods, Trader Joe's.
- "Petrol & Fuel": HPCL, BPCL, IOCL, IndianOil, Shell, Exxon, Chevron, petrol pump, fuel station, EV charging.
- "Utilities & Bills": Electricity (BESCOM, Tata Power, PG&E), water, gas, Airtel, Jio, AT&T, broadband, mobile recharge, DTH, insurance premiums.
- "Investments": Zerodha, Groww, Coin, Kuvera, Vanguard, Fidelity, Mutual Fund, SIP, PPF, NPS, stocks, brokerage transfer.
- "Shopping & Lifestyle": Amazon, Flipkart, Myntra, Nike, Apple, Nordstrom, Target, entertainment, Netflix, gym, travel, flights, hotels.
- "Housing & Rent": House rent, society maintenance, NoBroker, landlord transfer, property tax.
- "Other": Salary credits, ATM cash withdrawal, generic person-to-person transfers, or unclear items.
${rulesPrompt}
For each transaction:
1. Format "date" strictly as YYYY-MM-DD.
2. Clean "narration" to remain concise and readable while keeping merchant/UPI details.
3. "amount" must be a positive number (no currency symbols or commas).
4. "type" must be "DEBIT" or "CREDIT".
5. "merchantKeyword" should be a short uppercase keyword identifying the merchant (e.g. "SWIGGY", "HPCL", "ZERODHA", "BESCOM").`;

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (base64Data && mimeType) {
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }

      if (textContent) {
        parts.push({
          text: `${systemPrompt}\n\nStatement content:\n${textContent.slice(0, 220000)}`,
        });
      } else {
        parts.push({
          text: systemPrompt,
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bankName: {
                type: Type.STRING,
                description: 'Detected bank or financial institution name if visible',
              },
              statementPeriod: {
                type: Type.STRING,
                description: 'Detected statement date range if visible',
              },
              detectedMonthlyCredits: {
                type: Type.NUMBER,
                description: 'Total salary or credit inflows detected in this statement',
              },
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: {
                      type: Type.STRING,
                      description: 'Transaction date in YYYY-MM-DD format',
                    },
                    narration: {
                      type: Type.STRING,
                      description: 'Transaction description / merchant narration',
                    },
                    amount: {
                      type: Type.NUMBER,
                      description: 'Positive numeric transaction amount',
                    },
                    type: {
                      type: Type.STRING,
                      description: 'DEBIT or CREDIT',
                    },
                    category: {
                      type: Type.STRING,
                      description: `One of: ${ALLOWED_CATEGORIES.join(', ')}`,
                    },
                    merchantKeyword: {
                      type: Type.STRING,
                      description: 'Short uppercase merchant keyword for rule learning',
                    },
                  },
                  required: ['date', 'narration', 'amount', 'type', 'category'],
                },
              },
            },
            required: ['transactions'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        bankName?: string;
        statementPeriod?: string;
        detectedMonthlyCredits?: number;
        transactions?: Array<{
          date: string;
          narration: string;
          amount: number;
          type: string;
          category: string;
          merchantKeyword?: string;
        }>;
      };

      const sanitizedTransactions = (parsed.transactions || [])
        .filter((t) => Number.isFinite(Number(t.amount)) && Number(t.amount) > 0)
        .map((t, idx) => {
          const normalizedType =
            String(t.type).toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT';
          const normalizedCategory = ALLOWED_CATEGORIES.includes(t.category)
            ? t.category
            : 'Other';
          return {
            id: `tx-${Date.now()}-${idx}`,
            date: t.date || new Date().toISOString().slice(0, 10),
            narration: String(t.narration || 'Bank Transaction').trim(),
            amount: Math.abs(Number(t.amount)),
            type: normalizedType,
            category: normalizedCategory,
            merchantKeyword: t.merchantKeyword
              ? String(t.merchantKeyword).toUpperCase().trim()
              : undefined,
          };
        });

      res.json({
        bankName: parsed.bankName || null,
        statementPeriod: parsed.statementPeriod || null,
        detectedMonthlyCredits: parsed.detectedMonthlyCredits || null,
        transactions: sanitizedTransactions,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to parse bank statement';
      console.error('Error in /api/parse-statement:', err);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WealthPulse server listening on http://localhost:${PORT}`);
  });
}

startServer();
