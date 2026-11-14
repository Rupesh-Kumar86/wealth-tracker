import React, { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AllocationAdvisorResult,
  CategoryRule,
  CurrencyCode,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  IdealTargets,
  Transaction,
} from '../types/finance';
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
} from '../utils/format';
import { extractMerchantKeyword } from '../utils/finance';
import { DEFAULT_IDEAL_TARGETS } from '../data/demoData';

interface StatementAnalyzerViewProps {
  currency: CurrencyCode;
  monthlySalary: number;
  transactions: Transaction[];
  customRules: CategoryRule[];
  idealTargets: IdealTargets;
  advisor: AllocationAdvisorResult;
  onUpdateTransactions: (txs: Transaction[]) => void;
  onUpdateRules: (rules: CategoryRule[]) => void;
  onUpdateTargets: (targets: IdealTargets) => void;
  onUpdateSalary: (salary: number) => void;
}

interface PendingRulePrompt {
  transactionId: string;
  keyword: string;
  targetCategory: ExpenseCategory;
  matchCount: number;
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Loans & EMI': '#F59E0B',
  'Food & Dining': '#38BDF8',
  'Petrol & Fuel': '#FB7185',
  'Utilities & Bills': '#A78BFA',
  Investments: '#10B981',
  'Shopping & Lifestyle': '#F472B6',
  'Housing & Rent': '#6366F1',
  Other: '#94A3B8',
};

export const StatementAnalyzerView: React.FC<StatementAnalyzerViewProps> = ({
  currency,
  monthlySalary,
  transactions,
  customRules,
  idealTargets,
  advisor,
  onUpdateTransactions,
  onUpdateRules,
  onUpdateTargets,
  onUpdateSalary,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [pendingRule, setPendingRule] = useState<PendingRulePrompt | null>(null);

  const countKeywordMatches = (keyword: string) => {
    const upper = keyword.trim().toUpperCase();
    if (!upper) return 0;
    return transactions.filter(
      (t) => t.type === 'DEBIT' && t.narration.toUpperCase().includes(upper)
    ).length;
  };

  const processStatementPayload = async (payload: {
    fileName: string;
    mimeType: string;
    base64Data?: string;
    textContent?: string;
  }) => {
    setIsParsing(true);
    setUploadError(null);
    setUploadNotice(null);

    try {
      const response = await fetch('/api/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          customRules: customRules.map((r) => ({
            keyword: r.keyword,
            category: r.category,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse bank statement');
      }

      const extracted: Transaction[] = (data.transactions || []).map(
        (t: Transaction) => {
          const upper = t.narration.toUpperCase();
          const matchedRule = customRules.find((r) =>
            upper.includes(r.keyword.toUpperCase())
          );
          return matchedRule
            ? {
                ...t,
                category: matchedRule.category,
                merchantKeyword: matchedRule.keyword.toUpperCase(),
              }
            : {
                ...t,
                merchantKeyword:
                  t.merchantKeyword || extractMerchantKeyword(t.narration),
              };
        }
      );

      if (extracted.length === 0) {
        throw new Error(
          'Gemini did not find any valid transaction rows in that file. Check that the statement has dates, descriptions, and amounts.'
        );
      }

      const nextList =
        uploadMode === 'append' ? [...extracted, ...transactions] : extracted;
      onUpdateTransactions(nextList);

      const periodInfo = data.statementPeriod ? ` (${data.statementPeriod})` : '';
      const bankInfo = data.bankName ? `${data.bankName} · ` : '';
      setUploadNotice(
        `Extracted ${extracted.length} transactions from ${bankInfo}${payload.fileName}${periodInfo}.`
      );
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to parse bank statement'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    const isTextLike =
      name.endsWith('.csv') ||
      name.endsWith('.txt') ||
      file.type.startsWith('text/') ||
      file.type === 'application/vnd.ms-excel';

    if (!isPdf && !isTextLike) {
      setUploadError('Unsupported file format. Upload a .pdf, .csv, or .txt bank statement.');
      return;
    }

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = String(reader.result || '');
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        await processStatementPayload({
          fileName: file.name,
          mimeType: 'application/pdf',
          base64Data,
        });
      };
      reader.readAsDataURL(file);
    } else {
      const textContent = await file.text();
      await processStatementPayload({
        fileName: file.name,
        mimeType: 'text/csv',
        textContent,
      });
    }
  };

  const handleCategoryChange = (tx: Transaction, newCategory: ExpenseCategory) => {
    const updated = transactions.map((item) =>
      item.id === tx.id
        ? { ...item, category: newCategory, isManuallyEdited: true }
        : item
    );
    onUpdateTransactions(updated);

    const suggestedKeyword =
      tx.merchantKeyword || extractMerchantKeyword(tx.narration);
    const matchCount = updated.filter(
      (t) =>
        t.type === 'DEBIT' &&
        t.narration.toUpperCase().includes(suggestedKeyword.toUpperCase())
    ).length;

    setPendingRule({
      transactionId: tx.id,
      keyword: suggestedKeyword,
      targetCategory: newCategory,
      matchCount,
    });
  };

  const handleConfirmRulePrompt = () => {
    if (!pendingRule) return;
    const keywordUpper = pendingRule.keyword.trim().toUpperCase();
    if (!keywordUpper) {
      setPendingRule(null);
      return;
    }

    // 1. Bulk update all matching rows
    const bulkUpdated = transactions.map((t) => {
      if (
        t.type === 'DEBIT' &&
        t.narration.toUpperCase().includes(keywordUpper)
      ) {
        return {
          ...t,
          category: pendingRule.targetCategory,
          merchantKeyword: keywordUpper,
          isManuallyEdited: true,
        };
      }
      return t;
    });
    onUpdateTransactions(bulkUpdated);

    // 2. Save or replace rule in localStorage-backed customRules
    const filtered = customRules.filter(
      (r) => r.keyword.toUpperCase() !== keywordUpper
    );
    const newRule: CategoryRule = {
      id: `rule-${Date.now()}`,
      keyword: keywordUpper,
      category: pendingRule.targetCategory,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onUpdateRules([newRule, ...filtered]);
    setPendingRule(null);
  };

  const handleDeleteRule = (id: string) => {
    onUpdateRules(customRules.filter((r) => r.id !== id));
  };

  const handleExportTransactionsCsv = () => {
    const headers = ['Date', 'Narration', 'Type', 'Amount', 'Category', 'Keyword'];
    const rows = transactions.map((t) => [
      t.date,
      `"${t.narration.replace(/"/g, '""')}"`,
      t.type,
      t.amount,
      `"${t.category}"`,
      t.merchantKeyword || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wealthpulse-categorized-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTargetChange = (key: keyof IdealTargets, val: number) => {
    onUpdateTargets({
      ...idealTargets,
      [key]: Math.min(100, Math.max(0, val)),
    });
  };

  const targetSum =
    idealTargets.investments +
    idealTargets.loans +
    idealTargets.essentials +
    idealTargets.lifestyle;

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (
        q &&
        !t.narration.toLowerCase().includes(q) &&
        !t.category.toLowerCase().includes(q) &&
        !t.date.includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, searchQuery, typeFilter, categoryFilter]);

  const nonZeroCategories = advisor.categories.filter((c) => c.monthlyAmount > 0);

  return (
    <div className="space-y-6">
      {/* Top Upload & Extraction Dropzone */}
      <section className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#f8fafc]">
              Bank Statement Extractor
            </h2>
            <p className="text-xs text-[#94a3b8] mt-1">
              Drop a .pdf, .csv, or .txt bank statement to extract and auto-classify transactions with Gemini 2.5 Flash
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#131315] border border-[#2e2f36] rounded-lg">
              <button
                type="button"
                onClick={() => setUploadMode('replace')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  uploadMode === 'replace'
                    ? 'bg-[#2a2a2b] text-[#f8fafc]'
                    : 'text-[#94a3b8]'
                }`}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('append')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  uploadMode === 'append'
                    ? 'bg-[#2a2a2b] text-[#f8fafc]'
                    : 'text-[#94a3b8]'
                }`}
              >
                Append
              </button>
            </div>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileSelected(file);
          }}
          onClick={() => !isParsing && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isParsing) {
              fileInputRef.current?.click();
            }
          }}
          className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-indigo-400 bg-indigo-500/10'
              : 'border-[#39393b] bg-[#131315]/70 hover:border-[#565e74]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
              e.target.value = '';
            }}
          />

          {isParsing ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              <p className="text-sm font-medium text-[#f8fafc]">
                Extracting and classifying transactions...
              </p>
              <p className="text-xs text-[#94a3b8]">
                Applying your {customRules.length} learned merchant rules
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-indigo-400" />
              <p className="text-sm font-medium text-[#f8fafc]">
                Drop bank statement here, or click to browse
              </p>
              <p className="text-xs text-[#94a3b8]">
                Supports .pdf (up to 15MB), .csv, and .txt · Parsed locally into browser storage
              </p>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="mt-4 flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadNotice && (
          <div className="mt-4 flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{uploadNotice}</span>
          </div>
        )}
      </section>

      {/* Category Breakdown + Ideal Wealth Weightage Editor */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Category Spend Distribution */}
        <div className="lg:col-span-6 bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#f8fafc]">
                  Category Spend Distribution
                </h3>
                <p className="text-xs text-[#94a3b8] mt-0.5 tabular-nums">
                  {advisor.activeMonthLabel} · Monthly debit total:{' '}
                  {formatCurrency(advisor.monthlyTotalSpend, currency)}
                </p>
              </div>
            </div>

            {nonZeroCategories.length === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-center border border-dashed border-[#2e2f36] rounded-xl p-6">
                <FileSpreadsheet className="w-7 h-7 text-[#64748b] mb-2" />
                <p className="text-sm font-medium text-[#e4e2e4]">No debit transactions yet</p>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Upload a bank statement above or load demo data to view category allocations.
                </p>
              </div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nonZeroCategories}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke="#2a2a2b" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(v) => formatCompactCurrency(Number(v), currency)}
                      axisLine={{ stroke: '#2e2f36' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={130}
                      stroke="#64748b"
                      tick={{ fill: '#e4e2e4', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload;
                        return (
                          <div className="bg-[#0e0e10]/95 backdrop-blur-md border border-[#39393b] rounded-xl p-3 shadow-xl text-xs space-y-1">
                            <div className="font-semibold text-[#f8fafc]">{item.category}</div>
                            <div className="font-mono tabular-nums text-emerald-400">
                              {formatCurrency(item.monthlyAmount, currency)} / mo
                            </div>
                            <div className="text-[#94a3b8] tabular-nums">
                              {formatPercent(item.percentOfSalary, 1)} of salary ·{' '}
                              {item.transactionCount} txns
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="monthlyAmount" radius={[0, 6, 6, 0]} barSize={18}>
                      {nonZeroCategories.map((entry) => (
                        <Cell
                          key={entry.category}
                          fill={CATEGORY_COLORS[entry.category] || '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#2a2a2b] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {nonZeroCategories.slice(0, 4).map((cat) => (
              <div key={cat.category}>
                <span className="text-[#94a3b8] block truncate">{cat.category}</span>
                <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                  {formatPercent(cat.percentOfSalary, 1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Customizable Ideal Wealth Weightage Benchmarks */}
        <div className="lg:col-span-6 bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#f8fafc]">
                  Ideal Wealth Weightage Targets
                </h3>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Compare spending as % of monthly salary ({formatCurrency(monthlySalary, currency)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateTargets({ ...DEFAULT_IDEAL_TARGETS })}
                className="px-2.5 py-1 text-xs font-medium text-[#c6c6cd] hover:text-white bg-[#2a2a2b] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap"
              >
                Reset 30/30/25/15
              </button>
            </div>

            {/* Quick Salary check */}
            <div className="mb-4 flex items-center justify-between gap-3 bg-[#131315] border border-[#2a2a2b] rounded-xl px-3 py-2">
              <span className="text-xs text-[#94a3b8]">Monthly Salary Denominator</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-[#94a3b8]">
                  {currency === 'INR' ? '₹' : '$'}
                </span>
                <input
                  type="number"
                  min={0}
                  value={monthlySalary}
                  onChange={(e) =>
                    onUpdateSalary(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-28 bg-transparent text-right text-sm font-mono tabular-nums font-semibold text-[#f8fafc] focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1"
                />
              </div>
            </div>

            <div className="space-y-4">
              {advisor.buckets.map((bucket) => (
                <div key={bucket.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#e4e2e4]">{bucket.label}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span
                        className={
                          bucket.status === 'on-track'
                            ? 'text-emerald-400'
                            : bucket.status === 'watch'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        Actual {formatPercent(bucket.actualPercent, 1)}
                      </span>
                      <span className="text-[#64748b]">·</span>
                      <label className="text-[#94a3b8] inline-flex items-center gap-1">
                        Target
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={idealTargets[bucket.key]}
                          onChange={(e) =>
                            handleTargetChange(bucket.key, Number(e.target.value) || 0)
                          }
                          className="w-12 bg-[#131315] border border-[#353436] rounded px-1.5 py-0.5 text-right text-xs text-[#f8fafc] focus:outline-none focus:border-indigo-500"
                        />
                        %
                      </label>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={70}
                    step={1}
                    value={idealTargets[bucket.key]}
                    onChange={(e) =>
                      handleTargetChange(bucket.key, Number(e.target.value))
                    }
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2a2a2b] flex items-center justify-between text-xs">
            <span className="text-[#94a3b8]">Target Weightage Sum</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                targetSum === 100 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {targetSum}% {targetSum !== 100 ? '(Recommended: 100%)' : '· Balanced'}
            </span>
          </div>
        </div>
      </section>

      {/* Interactive Transaction Ledger & Rule Learning */}
      <section className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[#f8fafc]">
              Transaction Ledger &amp; Interactive Rule Learning
            </h3>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Override any category inline to recalculate charts and save merchant rules automatically
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportTransactionsCsv}
              disabled={transactions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2a2a2b] hover:bg-[#353436] disabled:opacity-40 text-[#e4e2e4] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Rule Learning Confirmation Banner */}
        {pendingRule && (
          <div className="bg-indigo-600/15 border border-indigo-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="text-[#f8fafc] font-medium">
                  Apply <span className="text-emerald-300 font-semibold">{pendingRule.targetCategory}</span>{' '}
                  to all transactions matching keyword?
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[#c6c6cd]">
                  <span>Merchant keyword:</span>
                  <input
                    type="text"
                    value={pendingRule.keyword}
                    onChange={(e) => {
                      const kw = e.target.value;
                      setPendingRule({
                        ...pendingRule,
                        keyword: kw,
                        matchCount: countKeywordMatches(kw),
                      });
                    }}
                    className="bg-[#131315] border border-indigo-400/50 rounded px-2 py-0.5 font-mono text-xs text-[#f8fafc] uppercase w-36 focus:outline-none"
                  />
                  <span className="tabular-nums text-[#94a3b8]">
                    ({pendingRule.matchCount} matching debit{pendingRule.matchCount === 1 ? '' : 's'})
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleConfirmRulePrompt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                Apply to All &amp; Save Rule
              </button>
              <button
                type="button"
                onClick={() => setPendingRule(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#c6c6cd] hover:text-white bg-[#2a2a2b] rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Just This One
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchant, UPI ID, or date..."
              className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#f8fafc] placeholder:text-[#64748b] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#131315] border border-[#2e2f36] rounded-lg">
            {(['ALL', 'DEBIT', 'CREDIT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  typeFilter === t
                    ? 'bg-[#2a2a2b] text-[#f8fafc]'
                    : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'DEBIT' ? 'Debits' : 'Credits'}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#131315] border border-[#353436] rounded-lg px-3 py-1.5 text-xs text-[#e4e2e4] focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-[#2a2a2b] rounded-xl">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#94a3b8]">
              {transactions.length === 0
                ? 'No transactions loaded yet. Upload a statement or load demo data.'
                : 'No transactions match your current search/filter.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#131315] text-[11px] font-semibold text-[#94a3b8] border-b border-[#2e2f36]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Narration / Merchant</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2b] text-xs">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-[#2a2a2b]/35 transition-colors"
                  >
                    <td className="py-2 px-3 font-mono tabular-nums text-[#94a3b8] whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2 px-3 text-[#e4e2e4] max-w-[340px] truncate" title={tx.narration}>
                      {tx.narration}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-[#94a3b8]'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-[#f8fafc]'
                      }`}
                    >
                      {tx.type === 'CREDIT' ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <select
                        aria-label={`Category for ${tx.narration}`}
                        value={tx.category}
                        onChange={(e) =>
                          handleCategoryChange(tx, e.target.value as ExpenseCategory)
                        }
                        className="bg-[#131315] border border-[#353436] hover:border-[#565e74] focus:border-indigo-500 rounded-md px-2 py-1 text-xs text-[#e4e2e4] focus:outline-none"
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Saved Merchant Rules Section */}
        <div className="pt-3 border-t border-[#2a2a2b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#e4e2e4]">
              Saved Merchant Auto-Categorization Rules ({customRules.length})
            </span>
            <span className="text-[11px] text-[#94a3b8]">
              Applied automatically on future statement uploads
            </span>
          </div>
          {customRules.length === 0 ? (
            <p className="text-xs text-[#64748b]">
              Change any transaction category above and confirm the keyword prompt to save a rule.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {customRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-2 bg-[#131315] border border-[#2a2a2b] rounded-lg px-3 py-1.5 text-xs"
                >
                  <div className="min-w-0 truncate">
                    <span className="font-mono font-semibold text-indigo-300">
                      {rule.keyword}
                    </span>
                    <span className="text-[#64748b] mx-1.5">→</span>
                    <span className="text-[#e4e2e4]">{rule.category}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    aria-label={`Delete rule ${rule.keyword}`}
                    className="p-1 text-[#64748b] hover:text-rose-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
