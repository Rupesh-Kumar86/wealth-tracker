import { DEFAULT_IDEAL_TARGETS, getDemoState } from '../data/demoData';
import {
  AllocationAdvisorResult,
  AppState,
  CurrencyCode,
  EXPENSE_CATEGORIES,
  InvestmentKind,
  InvestmentProfile,
  LoanComparisonResult,
  LoanProfile,
  PrepaymentEntry,
  Transaction,
  WealthProjectionResult,
} from '../types/finance';

export interface WealthPulseBackupPayload {
  format: 'wealthpulse-backup';
  version: 2;
  exportedAt: string;
  data: AppState;
  summary: {
    loans: {
      totalRemainingPrincipal: number;
      totalFixedMonthlyEmi: number;
      allLoansPayoffDate: string;
      totalInterestSaved: number;
    };
    wealth: {
      horizonYears: number;
      combinedFinalCorpus: number;
      crossoverCalendarYear: number | null;
    };
    allocationBuckets: AllocationAdvisorResult['buckets'];
  };
}

export function buildBackupPayload(
  state: AppState,
  combinedLoanComparison: LoanComparisonResult,
  combinedWealthProjection: WealthProjectionResult,
  advisor: AllocationAdvisorResult
): WealthPulseBackupPayload {
  return {
    format: 'wealthpulse-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state,
    summary: {
      loans: {
        totalRemainingPrincipal: combinedLoanComparison.currentRemainingPrincipal,
        totalFixedMonthlyEmi: combinedLoanComparison.effectiveActualEmi,
        allLoansPayoffDate: combinedLoanComparison.actualPayoffDate,
        totalInterestSaved: combinedLoanComparison.interestSaved,
      },
      wealth: {
        horizonYears: state.horizonYears,
        combinedFinalCorpus: combinedWealthProjection.finalCorpus,
        crossoverCalendarYear: combinedWealthProjection.crossoverCalendarYear,
      },
      allocationBuckets: advisor.buckets,
    },
  };
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizePrepayment(raw: unknown, idx: number): PrepaymentEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  return {
    id: typeof p.id === 'string' && p.id ? p.id : `prep-${Date.now()}-${idx}`,
    date: typeof p.date === 'string' && p.date ? p.date : '2027-01-01',
    amount: Math.max(0, toNumber(p.amount, 0)),
    frequency: p.frequency === 'ANNUAL' ? 'ANNUAL' : 'ONE_TIME',
    label: typeof p.label === 'string' ? p.label : undefined,
  };
}

function sanitizeLoan(raw: unknown, idx: number): LoanProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;
  const principal = Math.max(0, toNumber(l.principal, 0));
  const originalPrincipalRaw =
    l.originalPrincipal !== undefined ? toNumber(l.originalPrincipal, principal) : undefined;
  const prepayments = Array.isArray(l.prepayments)
    ? l.prepayments
        .map((item, i) => sanitizePrepayment(item, i))
        .filter((x): x is PrepaymentEntry => x !== null)
    : [];

  return {
    id: typeof l.id === 'string' && l.id ? l.id : `loan-${Date.now()}-${idx}`,
    name: typeof l.name === 'string' && l.name.trim() ? l.name : `Loan ${idx + 1}`,
    originalPrincipal:
      originalPrincipalRaw !== undefined ? Math.max(0, originalPrincipalRaw) : undefined,
    principal,
    annualInterestRate: Math.max(0, toNumber(l.annualInterestRate, 8.5)),
    originalTenureMonths: Math.max(1, Math.round(toNumber(l.originalTenureMonths, 240))),
    startDate:
      typeof l.startDate === 'string' && l.startDate
        ? l.startDate
        : `${new Date().getFullYear()}-01-01`,
    actualMonthlyEmi: Math.max(0, toNumber(l.actualMonthlyEmi, 0)),
    prepayments,
  };
}

function sanitizeInvestment(raw: unknown, idx: number): InvestmentProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const inv = raw as Record<string, unknown>;
  const kind: InvestmentKind =
    inv.kind === 'LUMPSUM_INTEREST' ? 'LUMPSUM_INTEREST' : 'SIP_COMPOUND';

  return {
    id: typeof inv.id === 'string' && inv.id ? inv.id : `inv-${Date.now()}-${idx}`,
    name:
      typeof inv.name === 'string' && inv.name.trim()
        ? inv.name
        : kind === 'LUMPSUM_INTEREST'
        ? `Savings ${idx + 1}`
        : `Investment ${idx + 1}`,
    kind,
    currentCorpus: Math.max(0, toNumber(inv.currentCorpus, 0)),
    monthlySip: kind === 'LUMPSUM_INTEREST' ? 0 : Math.max(0, toNumber(inv.monthlySip, 0)),
    annualStepUpPercent:
      kind === 'LUMPSUM_INTEREST'
        ? 0
        : Math.max(0, toNumber(inv.annualStepUpPercent, 0)),
    expectedCagrPercent: Math.max(
      0,
      toNumber(inv.expectedCagrPercent, kind === 'LUMPSUM_INTEREST' ? 7 : 12)
    ),
  };
}

function sanitizeTransaction(raw: unknown, idx: number): Transaction | null {
  if (!raw || typeof raw !== 'object') return null;
  const tx = raw as Record<string, unknown>;
  const cat =
    typeof tx.category === 'string' &&
    (EXPENSE_CATEGORIES as string[]).includes(tx.category)
      ? (tx.category as Transaction['category'])
      : 'Other';

  return {
    id: typeof tx.id === 'string' && tx.id ? tx.id : `tx-${Date.now()}-${idx}`,
    date: typeof tx.date === 'string' ? tx.date : new Date().toISOString().slice(0, 10),
    narration: typeof tx.narration === 'string' ? tx.narration : 'Transaction',
    amount: Math.max(0, toNumber(tx.amount, 0)),
    type: tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    category: cat,
    merchantKeyword:
      typeof tx.merchantKeyword === 'string' ? tx.merchantKeyword : undefined,
    isManuallyEdited: Boolean(tx.isManuallyEdited),
  };
}

/**
 * Parse and validate an imported JSON backup (v2 backup, raw AppState, legacy v1 state, or exported report).
 */
export function parseImportedState(rawJson: unknown): AppState {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Invalid JSON file: expected a WealthPulse backup object.');
  }

  const root = rawJson as Record<string, unknown>;
  const candidate =
    root.format === 'wealthpulse-backup' && root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const currency: CurrencyCode = candidate.currency === 'USD' ? 'USD' : 'INR';
  const fallbackDemo = getDemoState(currency);

  const rawLoans = Array.isArray(candidate.loans)
    ? candidate.loans
    : candidate.loan
    ? [candidate.loan]
    : candidate.loansSummary &&
      typeof candidate.loansSummary === 'object' &&
      Array.isArray((candidate.loansSummary as Record<string, unknown>).loans)
    ? ((candidate.loansSummary as Record<string, unknown>).loans as unknown[])
    : null;

  const rawInvestments = Array.isArray(candidate.investments)
    ? candidate.investments
    : candidate.investment
    ? [candidate.investment]
    : candidate.wealthProjection &&
      typeof candidate.wealthProjection === 'object' &&
      Array.isArray((candidate.wealthProjection as Record<string, unknown>).accounts)
    ? ((candidate.wealthProjection as Record<string, unknown>).accounts as unknown[])
    : null;

  const hasRecognizedFields =
    typeof candidate.monthlySalary === 'number' ||
    rawLoans !== null ||
    rawInvestments !== null ||
    Array.isArray(candidate.transactions);

  if (!hasRecognizedFields) {
    throw new Error(
      'This JSON file does not match a WealthPulse backup or report format.'
    );
  }

  const loans = rawLoans
    ? rawLoans
        .map((item, idx) => sanitizeLoan(item, idx))
        .filter((x): x is LoanProfile => x !== null)
    : fallbackDemo.loans;

  const investments = rawInvestments
    ? rawInvestments
        .map((item, idx) => sanitizeInvestment(item, idx))
        .filter((x): x is InvestmentProfile => x !== null)
    : fallbackDemo.investments;

  const transactions = Array.isArray(candidate.transactions)
    ? candidate.transactions
        .map((item, idx) => sanitizeTransaction(item, idx))
        .filter((x): x is Transaction => x !== null)
    : [];

  const customRules = Array.isArray(candidate.customRules)
    ? candidate.customRules
        .filter(
          (r): r is Record<string, unknown> =>
            Boolean(r && typeof r === 'object' && typeof (r as Record<string, unknown>).keyword === 'string')
        )
        .map((r, idx) => ({
          id: typeof r.id === 'string' && r.id ? r.id : `rule-${Date.now()}-${idx}`,
          keyword: String(r.keyword).toUpperCase(),
          category:
            typeof r.category === 'string' &&
            (EXPENSE_CATEGORIES as string[]).includes(r.category)
              ? (r.category as Transaction['category'])
              : 'Other',
          createdAt:
            typeof r.createdAt === 'string'
              ? r.createdAt
              : new Date().toISOString().slice(0, 10),
        }))
    : [];

  const rawTargets =
    candidate.idealTargets && typeof candidate.idealTargets === 'object'
      ? (candidate.idealTargets as Record<string, unknown>)
      : {};

  const horizonCandidate =
    candidate.horizonYears ??
    (candidate.wealthProjection && typeof candidate.wealthProjection === 'object'
      ? (candidate.wealthProjection as Record<string, unknown>).horizonYears
      : undefined);

  return {
    currency,
    monthlySalary: Math.max(0, toNumber(candidate.monthlySalary, fallbackDemo.monthlySalary)),
    loans,
    investments,
    horizonYears: Math.min(40, Math.max(1, Math.round(toNumber(horizonCandidate, 15)))),
    transactions,
    customRules,
    idealTargets: {
      investments: Math.min(
        100,
        Math.max(0, toNumber(rawTargets.investments, DEFAULT_IDEAL_TARGETS.investments))
      ),
      loans: Math.min(
        100,
        Math.max(0, toNumber(rawTargets.loans, DEFAULT_IDEAL_TARGETS.loans))
      ),
      essentials: Math.min(
        100,
        Math.max(0, toNumber(rawTargets.essentials, DEFAULT_IDEAL_TARGETS.essentials))
      ),
      lifestyle: Math.min(
        100,
        Math.max(0, toNumber(rawTargets.lifestyle, DEFAULT_IDEAL_TARGETS.lifestyle))
      ),
    },
  };
}
