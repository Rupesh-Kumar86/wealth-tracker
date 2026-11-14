import {
  AllocationAdvisorResult,
  BucketAllocation,
  CategoryBreakdownItem,
  CategoryRule,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  IdealTargets,
  InvestmentProfile,
  LoanComparisonResult,
  LoanProfile,
  LoanSchedulePoint,
  OptimizationInsight,
  Transaction,
  WealthProjectionResult,
  WealthYearPoint,
} from '../types/finance';
import { addMonthsToYm, parseYearMonth } from './format';

/**
 * Standard reducing-balance EMI formula:
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function calculateStandardEmi(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = annualInterestRate / 12 / 100;
  if (r <= 0) return principal / tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (principal * r * factor) / (factor - 1);
}

/**
 * Compute months elapsed between loan startDate and reference date (today).
 */
export function getElapsedMonthsFromStart(
  startDateIso: string,
  refDate: Date = new Date()
): number {
  const { year: startY, month: startM } = parseYearMonth(startDateIso);
  const diff = (refDate.getFullYear() - startY) * 12 + (refDate.getMonth() + 1 - startM);
  return Math.max(0, diff);
}

/**
 * Loan Amortization Engine:
 * Computes both Baseline (standard EMI over original tenure) and Actual/Accelerated
 * (higher EMI + one-time or recurring annual prepayments) month-by-month.
 */
export function calculateLoanComparison(loan: LoanProfile): LoanComparisonResult {
  const principal = Math.max(0, loan.principal);
  const rate = Math.max(0, loan.annualInterestRate);
  const tenure = Math.max(1, Math.round(loan.originalTenureMonths));
  const r = rate / 12 / 100;

  const standardEmi = calculateStandardEmi(principal, rate, tenure);
  // If user enters a lower actual EMI, clamp at least to standardEmi so amortization always converges
  // unless standardEmi is 0
  const effectiveActualEmi =
    principal > 0 ? Math.max(standardEmi, loan.actualMonthlyEmi || standardEmi) : 0;

  const startYm = parseYearMonth(loan.startDate);

  // Pre-index prepayments for O(1) / fast monthly lookup
  const parsedPrepayments = (loan.prepayments || [])
    .filter((p) => p.amount > 0 && p.date)
    .map((p) => {
      const ym = parseYearMonth(p.date);
      return {
        ...p,
        year: ym.year,
        month: ym.month,
      };
    });

  let baselineBal = principal;
  let actualBal = principal;
  let baselineInterestCum = 0;
  let actualInterestCum = 0;
  let totalPrepaid = 0;
  let baselineMonths = 0;
  let actualMonths = 0;

  const monthlySchedule: LoanSchedulePoint[] = [];

  // Initial Year 0 snapshot (Month 0)
  const initialDateYm = addMonthsToYm(loan.startDate, 0);
  monthlySchedule.push({
    monthIndex: 0,
    date: initialDateYm,
    yearLabel: initialDateYm.slice(0, 4),
    baselineRemaining: Math.round(principal),
    actualRemaining: Math.round(principal),
    baselineInterestCum: 0,
    actualInterestCum: 0,
    principalPaid: 0,
    interestPaid: 0,
    prepaymentApplied: 0,
  });

  if (principal > 0) {
    for (let m = 1; m <= tenure; m++) {
      const currentDateYm = addMonthsToYm(loan.startDate, m - 1);
      const curYm = parseYearMonth(currentDateYm);

      // 1. Baseline step
      if (baselineBal > 0.01) {
        const baseInt = baselineBal * r;
        const basePay = Math.min(baselineBal + baseInt, standardEmi);
        const basePrin = Math.max(0, basePay - baseInt);
        baselineBal = Math.max(0, baselineBal - basePrin);
        baselineInterestCum += baseInt;
        baselineMonths = m;
      } else {
        baselineBal = 0;
      }

      // 2. Actual / Accelerated step
      let principalPaidThisMonth = 0;
      let interestPaidThisMonth = 0;
      let prepaymentThisMonth = 0;

      if (actualBal > 0.01) {
        const actInt = actualBal * r;
        const actPay = Math.min(actualBal + actInt, effectiveActualEmi);
        const actPrinFromEmi = Math.max(0, actPay - actInt);

        actualBal = Math.max(0, actualBal - actPrinFromEmi);
        actualInterestCum += actInt;
        interestPaidThisMonth = actInt;
        principalPaidThisMonth = actPrinFromEmi;

        // Check prepayments matching this month
        for (const prep of parsedPrepayments) {
          if (actualBal <= 0.01) break;

          let matches = false;
          if (prep.frequency === 'ANNUAL') {
            const monthsDiff =
              (curYm.year - prep.year) * 12 + (curYm.month - prep.month);
            if (monthsDiff >= 0 && monthsDiff % 12 === 0) {
              matches = true;
            }
          } else {
            // ONE_TIME: apply on exact month, or if date <= startDate, apply on Month 1
            if (prep.year === curYm.year && prep.month === curYm.month) {
              matches = true;
            } else if (
              m === 1 &&
              (prep.year < startYm.year ||
                (prep.year === startYm.year && prep.month < startYm.month))
            ) {
              matches = true;
            }
          }

          if (matches) {
            const applied = Math.min(actualBal, prep.amount);
            actualBal = Math.max(0, actualBal - applied);
            prepaymentThisMonth += applied;
            totalPrepaid += applied;
            principalPaidThisMonth += applied;
          }
        }

        if (actualBal <= 0.01) {
          actualBal = 0;
        }
        actualMonths = m;
      } else {
        actualBal = 0;
      }

      monthlySchedule.push({
        monthIndex: m,
        date: currentDateYm,
        yearLabel: currentDateYm.slice(0, 4),
        baselineRemaining: Math.round(baselineBal),
        actualRemaining: Math.round(actualBal),
        baselineInterestCum: Math.round(baselineInterestCum),
        actualInterestCum: Math.round(actualInterestCum),
        principalPaid: Math.round(principalPaidThisMonth),
        interestPaid: Math.round(interestPaidThisMonth),
        prepaymentApplied: Math.round(prepaymentThisMonth),
      });

      // Stop if both schedules are completely paid off
      if (baselineBal <= 0 && actualBal <= 0 && m > 1) {
        break;
      }
    }
  }

  // Build yearly curve (Month 0, Month 12, Month 24, ... plus final payoff point)
  const yearlySchedule: LoanSchedulePoint[] = [];
  for (let i = 0; i < monthlySchedule.length; i++) {
    const pt = monthlySchedule[i];
    const isYearBoundary = pt.monthIndex % 12 === 0;
    const isLast = i === monthlySchedule.length - 1;
    if (isYearBoundary || isLast) {
      yearlySchedule.push(pt);
    }
  }

  const elapsed = Math.min(
    monthlySchedule.length - 1,
    getElapsedMonthsFromStart(loan.startDate)
  );
  const currentPoint = monthlySchedule[elapsed] || monthlySchedule[0];

  const monthsSaved = Math.max(0, baselineMonths - actualMonths);
  const interestSaved = Math.max(0, baselineInterestCum - actualInterestCum);

  return {
    standardEmi: Math.round(standardEmi),
    effectiveActualEmi: Math.round(effectiveActualEmi),
    baselineMonths,
    actualMonths,
    monthsSaved,
    baselineTotalInterest: Math.round(baselineInterestCum),
    actualTotalInterest: Math.round(actualInterestCum),
    interestSaved: Math.round(interestSaved),
    totalPrepaid: Math.round(totalPrepaid),
    baselinePayoffDate: addMonthsToYm(
      loan.startDate,
      Math.max(0, baselineMonths - 1)
    ),
    actualPayoffDate: addMonthsToYm(
      loan.startDate,
      Math.max(0, actualMonths - 1)
    ),
    currentRemainingPrincipal: currentPoint.actualRemaining,
    currentBaselineRemainingPrincipal: currentPoint.baselineRemaining,
    elapsedMonths: elapsed,
    monthlySchedule,
    yearlySchedule,
  };
}

/**
 * Investment Compounding Engine:
 * Monthly compounding with optional annual SIP step-up, plus Net-Debt-Free Crossover detection.
 */
export function calculateWealthProjection(
  investment: InvestmentProfile,
  horizonYears: number,
  loanComparison: LoanComparisonResult
): WealthProjectionResult {
  const years = Math.min(40, Math.max(1, Math.round(horizonYears)));
  const currentYear = new Date().getFullYear();
  const cagr = Math.max(0, investment.expectedCagrPercent);
  const stepUp = Math.max(0, investment.annualStepUpPercent);
  const baseSip = Math.max(0, investment.monthlySip);

  // Effective monthly rate yielding exact annual CAGR
  const monthlyRate = Math.pow(1 + cagr / 100, 1 / 12) - 1;

  // Scan up to 40 years so we always detect Crossover Year even when viewing 5Y/10Y
  const scanMaxYears = Math.max(years, 40);
  const yearlyBreakdown: WealthYearPoint[] = [];

  let corpus = Math.max(0, investment.currentCorpus);
  let invested = Math.max(0, investment.currentCorpus);
  const startingLoan = loanComparison.currentRemainingPrincipal;

  let crossoverYear: number | null = null;
  const alreadyNetDebtFree = corpus >= startingLoan;
  if (alreadyNetDebtFree) {
    crossoverYear = 0;
  }

  // Year 0 baseline
  yearlyBreakdown.push({
    year: 0,
    calendarYear: currentYear,
    label: 'Now',
    investedPrincipal: Math.round(invested),
    wealthGained: 0,
    totalCorpus: Math.round(corpus),
    annualSipRate: Math.round(baseSip),
    remainingLoanPrincipal: Math.round(startingLoan),
    netWorthProjection: Math.round(corpus - startingLoan),
  });

  for (let y = 1; y <= scanMaxYears; y++) {
    const annualSip = baseSip * Math.pow(1 + stepUp / 100, y - 1);
    for (let m = 0; m < 12; m++) {
      corpus = (corpus + annualSip) * (1 + monthlyRate);
      invested += annualSip;
    }

    const futureMonthIdx = loanComparison.elapsedMonths + y * 12;
    const loanPoint = loanComparison.monthlySchedule[futureMonthIdx];
    const remainingLoan = loanPoint ? loanPoint.actualRemaining : 0;

    if (crossoverYear === null && corpus >= remainingLoan) {
      crossoverYear = y;
    }

    if (y <= years) {
      yearlyBreakdown.push({
        year: y,
        calendarYear: currentYear + y,
        label: `Yr ${y}`,
        investedPrincipal: Math.round(invested),
        wealthGained: Math.max(0, Math.round(corpus - invested)),
        totalCorpus: Math.round(corpus),
        annualSipRate: Math.round(annualSip),
        remainingLoanPrincipal: Math.round(remainingLoan),
        netWorthProjection: Math.round(corpus - remainingLoan),
      });
    }
  }

  const finalPoint = yearlyBreakdown[yearlyBreakdown.length - 1];

  return {
    horizonYears: years,
    finalCorpus: finalPoint.totalCorpus,
    totalInvested: finalPoint.investedPrincipal,
    totalWealthGained: finalPoint.wealthGained,
    crossoverYear,
    crossoverCalendarYear:
      crossoverYear !== null ? currentYear + crossoverYear : null,
    alreadyNetDebtFree,
    yearlyBreakdown,
  };
}

/**
 * Extract a clean uppercase merchant keyword from raw bank statement narration
 * for rule-learning suggestions (e.g. "UPI/SWIGGY/40291823" -> "SWIGGY").
 */
export function extractMerchantKeyword(narration: string): string {
  const cleaned = narration
    .toUpperCase()
    .replace(/[^A-Z0-9\s/.-]/g, ' ')
    .trim();

  const stopWords = new Set([
    'UPI',
    'IMPS',
    'NEFT',
    'RTGS',
    'POS',
    'ATM',
    'NACH',
    'ACH',
    'ECS',
    'DEBIT',
    'CREDIT',
    'TRANSFER',
    'PAYMENT',
    'PAY',
    'TO',
    'FROM',
    'BY',
    'FOR',
    'THE',
    'AND',
    'PVT',
    'LTD',
    'INDIA',
    'COM',
    'IN',
    'OKICICI',
    'OKAXIS',
    'OKHDFCBANK',
    'YBL',
    'IBL',
    'PAYTM',
    'DR',
    'CR',
    'TXN',
    'REF',
    'BILL',
    'ONLINE',
  ]);

  const tokens = cleaned
    .split(/[\s/._-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !stopWords.has(t));

  if (tokens.length > 0) {
    return tokens[0];
  }

  const fallback = cleaned.split(/\s+/).find((t) => t.length >= 3);
  return fallback || cleaned.slice(0, 12) || 'MERCHANT';
}

/**
 * Apply saved keyword rules to transactions (preserving manually edited overrides unless overwritten).
 */
export function applyRulesToTransactions(
  transactions: Transaction[],
  rules: CategoryRule[]
): Transaction[] {
  if (!rules.length) return transactions;
  return transactions.map((tx) => {
    if (tx.type !== 'DEBIT') return tx;
    const upper = tx.narration.toUpperCase();
    const matched = rules.find((rule) =>
      upper.includes(rule.keyword.toUpperCase())
    );
    if (matched) {
      return {
        ...tx,
        category: matched.category,
        merchantKeyword: matched.keyword.toUpperCase(),
      };
    }
    return tx;
  });
}

const ESSENTIALS_SET = new Set<ExpenseCategory>([
  'Food & Dining',
  'Petrol & Fuel',
  'Utilities & Bills',
  'Housing & Rent',
]);

const LIFESTYLE_SET = new Set<ExpenseCategory>([
  'Shopping & Lifestyle',
  'Other',
]);

/**
 * Compute Ideal Wealth Weightage comparison and actionable optimization insights.
 */
export function computeAllocationAndAdvisor(
  transactions: Transaction[],
  monthlySalary: number,
  idealTargets: IdealTargets,
  loan: LoanProfile,
  investment: InvestmentProfile,
  loanComparison: LoanComparisonResult
): AllocationAdvisorResult {
  const debits = transactions.filter((t) => t.type === 'DEBIT');

  // Determine how many distinct YYYY-MM months are present in debits so multi-month statements normalize to monthly average
  const monthKeys = new Set(
    debits.map((t) => (t.date ? t.date.slice(0, 7) : '')).filter(Boolean)
  );
  const monthCount = Math.max(1, monthKeys.size);
  const sortedMonths = Array.from(monthKeys).sort();
  const activeMonthLabel =
    sortedMonths.length === 0
      ? 'No statement period'
      : sortedMonths.length === 1
      ? sortedMonths[0]
      : `${sortedMonths[0]} – ${sortedMonths[sortedMonths.length - 1]} (${monthCount} mo avg)`;

  const totalsByCategory = new Map<ExpenseCategory, { total: number; count: number }>();
  for (const cat of EXPENSE_CATEGORIES) {
    totalsByCategory.set(cat, { total: 0, count: 0 });
  }

  for (const tx of debits) {
    const cat = EXPENSE_CATEGORIES.includes(tx.category) ? tx.category : 'Other';
    const entry = totalsByCategory.get(cat)!;
    entry.total += Math.max(0, tx.amount);
    entry.count += 1;
  }

  const monthlyTotalSpend =
    Array.from(totalsByCategory.values()).reduce((sum, item) => sum + item.total, 0) /
    monthCount;

  const salaryDenom = Math.max(1, monthlySalary);

  const categories: CategoryBreakdownItem[] = EXPENSE_CATEGORIES.map((cat) => {
    const entry = totalsByCategory.get(cat)!;
    const monthlyAmount = entry.total / monthCount;
    return {
      category: cat,
      monthlyAmount,
      totalAmount: entry.total,
      percentOfSalary: (monthlyAmount / salaryDenom) * 100,
      percentOfSpend:
        monthlyTotalSpend > 0 ? (monthlyAmount / monthlyTotalSpend) * 100 : 0,
      transactionCount: entry.count,
    };
  }).sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  // Sum into the 4 Ideal Wealth Weightage buckets
  // If user has no parsed investment debits in statement, fall back or reflect statement vs configured SIP?
  // Wait: prompt asks to compare actual expense breakdown (as % of monthly salary) against Ideal Wealth Weightage.
  const catMap = new Map(categories.map((c) => [c.category, c.monthlyAmount]));

  const invMonthly = catMap.get('Investments') || 0;
  const loanMonthly = catMap.get('Loans & EMI') || 0;
  const essentialsMonthly = Array.from(ESSENTIALS_SET).reduce(
    (sum, cat) => sum + (catMap.get(cat) || 0),
    0
  );
  const lifestyleMonthly = Array.from(LIFESTYLE_SET).reduce(
    (sum, cat) => sum + (catMap.get(cat) || 0),
    0
  );

  // If no transactions exist at all, we also compute from configured SIP & EMI? No, let transactions drive expenses cleanly,
  // and if transactions are empty, buckets show 0% cleanly (empty state).
  const invPct = monthlySalary > 0 ? (invMonthly / monthlySalary) * 100 : 0;
  const loanPct = monthlySalary > 0 ? (loanMonthly / monthlySalary) * 100 : 0;
  const essPct = monthlySalary > 0 ? (essentialsMonthly / monthlySalary) * 100 : 0;
  const lifePct = monthlySalary > 0 ? (lifestyleMonthly / monthlySalary) * 100 : 0;

  const buckets: BucketAllocation[] = [
    {
      key: 'investments',
      label: 'Investments & SIPs',
      description: 'Target >= benchmark for compounding',
      actualMonthlyAmount: invMonthly,
      actualPercent: invPct,
      targetPercent: idealTargets.investments,
      variancePercent: idealTargets.investments - invPct, // positive means shortfall
      status:
        debits.length === 0
          ? 'watch'
          : invPct >= idealTargets.investments
          ? 'on-track'
          : invPct >= idealTargets.investments * 0.75
          ? 'watch'
          : 'over-limit',
    },
    {
      key: 'loans',
      label: 'Loans & EMIs',
      description: 'Debt service ratio <= target',
      actualMonthlyAmount: loanMonthly,
      actualPercent: loanPct,
      targetPercent: idealTargets.loans,
      variancePercent: loanPct - idealTargets.loans,
      status:
        loanPct <= idealTargets.loans
          ? 'on-track'
          : loanPct <= idealTargets.loans + 5
          ? 'watch'
          : 'over-limit',
    },
    {
      key: 'essentials',
      label: 'Essentials',
      description: 'Food, Fuel, Utilities & Housing',
      actualMonthlyAmount: essentialsMonthly,
      actualPercent: essPct,
      targetPercent: idealTargets.essentials,
      variancePercent: essPct - idealTargets.essentials,
      status:
        essPct <= idealTargets.essentials
          ? 'on-track'
          : essPct <= idealTargets.essentials + 5
          ? 'watch'
          : 'over-limit',
    },
    {
      key: 'lifestyle',
      label: 'Lifestyle & Other',
      description: 'Shopping, Dining discretionary & transfers',
      actualMonthlyAmount: lifestyleMonthly,
      actualPercent: lifePct,
      targetPercent: idealTargets.lifestyle,
      variancePercent: lifePct - idealTargets.lifestyle,
      status:
        lifePct <= idealTargets.lifestyle
          ? 'on-track'
          : lifePct <= idealTargets.lifestyle + 4
          ? 'watch'
          : 'over-limit',
    },
  ];

  // Unallocated / retained cash + Investments counted toward monthly wealth-building rate
  const nonInvestmentSpend = monthlyTotalSpend - invMonthly;
  const monthlySavingsAmount = Math.max(0, monthlySalary - nonInvestmentSpend);
  const monthlySavingsRatePercent =
    monthlySalary > 0 ? (monthlySavingsAmount / monthlySalary) * 100 : 0;

  // Dynamic Optimization Insights using real loan & compounding simulations
  const insights: OptimizationInsight[] = [];

  if (debits.length > 0 && monthlySalary > 0) {
    const foodAndLifestyleMonthly =
      (catMap.get('Food & Dining') || 0) + (catMap.get('Shopping & Lifestyle') || 0);
    const discretionaryTarget =
      ((idealTargets.lifestyle + idealTargets.essentials * 0.35) / 100) * monthlySalary;
    const lifestyleExcess = Math.max(
      0,
      lifestyleMonthly - (idealTargets.lifestyle / 100) * monthlySalary
    );
    const diningPlusShoppingExcess = Math.max(
      0,
      foodAndLifestyleMonthly - discretionaryTarget
    );

    const candidateSurplus = Math.round(
      Math.max(lifestyleExcess, diningPlusShoppingExcess)
    );

    if (candidateSurplus > 0) {
      const sim = simulateRedirectSurplus(
        candidateSurplus,
        loan,
        loanComparison,
        investment
      );
      insights.push({
        id: 'discretionary-surplus',
        title: 'Discretionary Spend Exceeds Target',
        summary: `Food & Dining + Shopping exceeds your benchmark by ${Math.round(
          candidateSurplus
        ).toLocaleString()}/mo.`,
        monthlySurplusAmount: candidateSurplus,
        loanMonthsSavedIfRedirected: sim.monthsSaved,
        loanInterestSavedIfRedirected: sim.interestSaved,
        extraCorpus10YrIfRedirected: sim.extraCorpus10Yr,
        severity: 'warning',
      });
    }

    // Investment shortfall insight
    const invTargetAmount = (idealTargets.investments / 100) * monthlySalary;
    const invShortfall = Math.round(Math.max(0, invTargetAmount - invMonthly));
    if (invShortfall > 0) {
      const sim = simulateRedirectSurplus(
        invShortfall,
        loan,
        loanComparison,
        investment
      );
      insights.push({
        id: 'investment-shortfall',
        title: 'Investment Allocation Below Benchmark',
        summary: `Investments are ${(idealTargets.investments - invPct).toFixed(
          1
        )}% below your ${idealTargets.investments}% wealth target.`,
        monthlySurplusAmount: invShortfall,
        loanMonthsSavedIfRedirected: sim.monthsSaved,
        loanInterestSavedIfRedirected: sim.interestSaved,
        extraCorpus10YrIfRedirected: sim.extraCorpus10Yr,
        severity: 'info',
      });
    }

    // Essentials check
    const essExcess = Math.round(
      Math.max(0, essentialsMonthly - (idealTargets.essentials / 100) * monthlySalary)
    );
    if (essExcess > 0) {
      const sim = simulateRedirectSurplus(
        essExcess,
        loan,
        loanComparison,
        investment
      );
      insights.push({
        id: 'essentials-heavy',
        title: 'Fixed Essentials Above Benchmark',
        summary: `Housing, Utilities, Fuel & Food are ${(
          essPct - idealTargets.essentials
        ).toFixed(1)}% above your ${idealTargets.essentials}% ceiling.`,
        monthlySurplusAmount: essExcess,
        loanMonthsSavedIfRedirected: sim.monthsSaved,
        loanInterestSavedIfRedirected: sim.interestSaved,
        extraCorpus10YrIfRedirected: sim.extraCorpus10Yr,
        severity: 'warning',
      });
    }

    // If completely aligned!
    if (insights.length === 0) {
      const bonusStepUp = Math.round(monthlySalary * 0.05);
      const sim = simulateRedirectSurplus(
        bonusStepUp,
        loan,
        loanComparison,
        investment
      );
      insights.push({
        id: 'aligned-bonus',
        title: 'Allocation Aligned With Ideal Weightage',
        summary: `All spending buckets are within target bounds. Routing an extra 5% of salary amplifies velocity.`,
        monthlySurplusAmount: bonusStepUp,
        loanMonthsSavedIfRedirected: sim.monthsSaved,
        loanInterestSavedIfRedirected: sim.interestSaved,
        extraCorpus10YrIfRedirected: sim.extraCorpus10Yr,
        severity: 'positive',
      });
    }
  }

  return {
    statementMonthCount: monthCount,
    activeMonthLabel,
    monthlyTotalSpend,
    monthlySavingsAmount,
    monthlySavingsRatePercent,
    buckets,
    categories,
    insights,
  };
}

function simulateRedirectSurplus(
  monthlyAmount: number,
  loan: LoanProfile,
  baseLoanComparison: LoanComparisonResult,
  investment: InvestmentProfile
): {
  monthsSaved: number;
  interestSaved: number;
  extraCorpus10Yr: number;
} {
  // 1. Loan impact if redirected to EMI
  let monthsSaved = 0;
  let interestSaved = 0;
  if (loan.principal > 0 && monthlyAmount > 0) {
    const boostedLoan = calculateLoanComparison({
      ...loan,
      actualMonthlyEmi: baseLoanComparison.effectiveActualEmi + monthlyAmount,
    });
    monthsSaved = Math.max(
      0,
      baseLoanComparison.actualMonths - boostedLoan.actualMonths
    );
    interestSaved = Math.max(
      0,
      baseLoanComparison.actualTotalInterest - boostedLoan.actualTotalInterest
    );
  }

  // 2. 10-year corpus impact if redirected to SIP at expectedCagrPercent
  const monthlyRate =
    Math.pow(1 + Math.max(0, investment.expectedCagrPercent) / 100, 1 / 12) - 1;
  let extraCorpus10Yr = 0;
  for (let m = 0; m < 120; m++) {
    extraCorpus10Yr = (extraCorpus10Yr + monthlyAmount) * (1 + monthlyRate);
  }

  return {
    monthsSaved,
    interestSaved: Math.round(interestSaved),
    extraCorpus10Yr: Math.round(extraCorpus10Yr),
  };
}
