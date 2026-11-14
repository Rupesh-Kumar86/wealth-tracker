export type CurrencyCode = 'INR' | 'USD';

export type ExpenseCategory =
  | 'Loans & EMI'
  | 'Food & Dining'
  | 'Petrol & Fuel'
  | 'Utilities & Bills'
  | 'Investments'
  | 'Shopping & Lifestyle'
  | 'Housing & Rent'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Loans & EMI',
  'Food & Dining',
  'Petrol & Fuel',
  'Utilities & Bills',
  'Investments',
  'Shopping & Lifestyle',
  'Housing & Rent',
  'Other',
];

export type PrepaymentFrequency = 'ONE_TIME' | 'ANNUAL';

export interface PrepaymentEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  frequency: PrepaymentFrequency;
  label?: string;
}

export interface LoanProfile {
  id: string;
  name: string;
  originalPrincipal?: number; // Original loan amount taken at startDate
  principal: number; // Current base amount left today
  annualInterestRate: number;
  originalTenureMonths: number;
  startDate: string; // YYYY-MM-DD (when loan was taken)
  actualMonthlyEmi: number; // Fixed monthly EMI paid going forward
  prepayments: PrepaymentEntry[];
}

export type InvestmentKind = 'SIP_COMPOUND' | 'LUMPSUM_INTEREST';

export interface InvestmentProfile {
  id: string;
  name: string;
  kind: InvestmentKind;
  currentCorpus: number;
  monthlySip: number;
  annualStepUpPercent: number;
  expectedCagrPercent: number;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  narration: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category: ExpenseCategory;
  merchantKeyword?: string;
  isManuallyEdited?: boolean;
}

export interface CategoryRule {
  id: string;
  keyword: string;
  category: ExpenseCategory;
  createdAt: string;
}

export interface IdealTargets {
  investments: number; // default 30%
  loans: number; // default 30%
  essentials: number; // default 25% (Food, Fuel, Utilities, Rent)
  lifestyle: number; // default 15% (Shopping & Lifestyle, Other)
}

export interface LoanSchedulePoint {
  monthIndex: number;
  date: string; // YYYY-MM
  yearLabel: string;
  openingBalance: number;
  emiPaid: number;
  baselineRemaining: number;
  actualRemaining: number;
  closingBalance: number;
  baselineInterestCum: number;
  actualInterestCum: number;
  principalPaid: number;
  interestPaid: number;
  prepaymentApplied: number;
  isFuture?: boolean;
}

export interface LoanComparisonResult {
  standardEmi: number;
  effectiveActualEmi: number;
  firstMonthInterest: number;
  isEmiInsufficient: boolean;
  finalMonthEmi: number;
  baselineMonths: number;
  actualMonths: number;
  futureMonthsRemaining: number;
  monthsSaved: number;
  baselineTotalInterest: number;
  actualTotalInterest: number;
  futureInterestPayable: number;
  interestSaved: number;
  totalPrepaid: number;
  baselinePayoffDate: string; // YYYY-MM
  actualPayoffDate: string; // YYYY-MM
  todayDateYm: string; // YYYY-MM
  currentRemainingPrincipal: number;
  currentBaselineRemainingPrincipal: number;
  aheadOfBaselineAmount: number;
  elapsedMonths: number;
  monthlySchedule: LoanSchedulePoint[];
  yearlySchedule: LoanSchedulePoint[];
}

export interface WealthYearPoint {
  year: number;
  calendarYear: number;
  label: string;
  investedPrincipal: number;
  wealthGained: number;
  totalCorpus: number;
  annualSipRate: number;
  remainingLoanPrincipal: number;
  netWorthProjection: number;
}

export interface WealthProjectionResult {
  horizonYears: number;
  finalCorpus: number;
  totalInvested: number;
  totalWealthGained: number;
  crossoverYear: number | null; // Year index (0 = already net-debt-free, 1..40 = future year)
  crossoverCalendarYear: number | null;
  alreadyNetDebtFree: boolean;
  yearlyBreakdown: WealthYearPoint[];
}

export type WeightageBucketKey = 'investments' | 'loans' | 'essentials' | 'lifestyle';

export interface BucketAllocation {
  key: WeightageBucketKey;
  label: string;
  description: string;
  actualMonthlyAmount: number;
  actualPercent: number;
  targetPercent: number;
  variancePercent: number; // positive = over target (for expenses) or under target (for investments)
  status: 'on-track' | 'watch' | 'over-limit';
}

export interface CategoryBreakdownItem {
  category: ExpenseCategory;
  monthlyAmount: number;
  totalAmount: number;
  percentOfSalary: number;
  percentOfSpend: number;
  transactionCount: number;
}

export interface OptimizationInsight {
  id: string;
  title: string;
  summary: string;
  monthlySurplusAmount: number;
  loanMonthsSavedIfRedirected: number;
  loanInterestSavedIfRedirected: number;
  extraCorpus10YrIfRedirected: number;
  severity: 'info' | 'warning' | 'positive';
}

export interface AllocationAdvisorResult {
  statementMonthCount: number;
  activeMonthLabel: string;
  monthlyTotalSpend: number;
  monthlySavingsAmount: number;
  monthlySavingsRatePercent: number;
  buckets: BucketAllocation[];
  categories: CategoryBreakdownItem[];
  insights: OptimizationInsight[];
}

export interface AppState {
  currency: CurrencyCode;
  monthlySalary: number;
  loans: LoanProfile[];
  investments: InvestmentProfile[];
  horizonYears: number;
  transactions: Transaction[];
  customRules: CategoryRule[];
  idealTargets: IdealTargets;
}
