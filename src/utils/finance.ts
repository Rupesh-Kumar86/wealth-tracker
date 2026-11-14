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
 * Curve 1 (Baseline): Standard reducing-balance schedule from Original Amount Taken on Start Date over Original Tenure.
 * Curve 2 (Actual & Projected): Connects Original Amount Taken -> Current Base Amount Left Today (elapsed months),
 * then projects forward month-by-month using the user's Fixed Monthly EMI + future prepayments until balance hits 0.
 */
export function calculateLoanComparison(loan: LoanProfile): LoanComparisonResult {
  const currentLeft = Math.max(0, loan.principal);
  const originalTaken = Math.max(
    0,
    loan.originalPrincipal !== undefined && loan.originalPrincipal > 0
      ? loan.originalPrincipal
      : currentLeft
  );

  const rate = Math.max(0, loan.annualInterestRate);
  const tenure = Math.max(1, Math.round(loan.originalTenureMonths));
  const r = rate / 12 / 100;

  // Baseline Standard EMI based on Original Amount Taken over Original Tenure
  const standardEmi = calculateStandardEmi(originalTaken, rate, tenure);
  const firstMonthInterest = currentLeft * r;

  // Fixed monthly EMI going forward from today
  const requestedEmi =
    loan.actualMonthlyEmi > 0
      ? loan.actualMonthlyEmi
      : calculateStandardEmi(currentLeft, rate, tenure);
  const isEmiInsufficient =
    currentLeft > 0 && requestedEmi > 0 && requestedEmi <= firstMonthInterest;
  const effectiveActualEmi = currentLeft > 0 ? requestedEmi : 0;

  const now = new Date();
  const todayDateYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
  const elapsedMonths = getElapsedMonthsFromStart(loan.startDate, now);

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

  let baselineBal = originalTaken;
  let actualBal = originalTaken;
  let baselineInterestCum = 0;
  let actualInterestCum = 0;
  let futureInterestPayable = 0;
  let totalPrepaid = 0;
  let baselineMonths = 0;
  let actualMonths = elapsedMonths;
  let futureMonthsRemaining = 0;
  let finalMonthEmi = effectiveActualEmi;

  const monthlySchedule: LoanSchedulePoint[] = [];

  const initialDateYm = addMonthsToYm(loan.startDate, 0);
  monthlySchedule.push({
    monthIndex: 0,
    date: initialDateYm,
    yearLabel: initialDateYm.slice(0, 4),
    openingBalance: Math.round(originalTaken),
    emiPaid: 0,
    baselineRemaining: Math.round(originalTaken),
    actualRemaining: Math.round(originalTaken),
    closingBalance: Math.round(originalTaken),
    baselineInterestCum: 0,
    actualInterestCum: 0,
    principalPaid: 0,
    interestPaid: 0,
    prepaymentApplied: 0,
    isFuture: elapsedMonths === 0,
  });

  // Cap total simulation comfortably beyond tenure
  const maxSimMonths = Math.max(tenure, elapsedMonths + 600);
  let baselineAtToday = originalTaken;

  if (originalTaken > 0 || currentLeft > 0) {
    for (let m = 1; m <= maxSimMonths; m++) {
      const currentDateYm = addMonthsToYm(loan.startDate, m);
      const curYm = parseYearMonth(currentDateYm);

      // 1. Baseline step (from Start Date over Original Tenure)
      if (baselineBal > 0.01 && m <= tenure) {
        const baseInt = baselineBal * r;
        const basePay = Math.min(baselineBal + baseInt, standardEmi);
        const basePrin = Math.max(0, basePay - baseInt);
        baselineBal = Math.max(0, baselineBal - basePrin);
        baselineInterestCum += baseInt;
        baselineMonths = m;
      } else {
        baselineBal = 0;
      }

      if (m === elapsedMonths) {
        baselineAtToday = baselineBal;
      }

      // 2. Actual / Projected step
      const isHistorical = m <= elapsedMonths;
      let openingBalance = actualBal;
      let emiPaidThisMonth = 0;
      let principalPaidThisMonth = 0;
      let interestPaidThisMonth = 0;
      let prepaymentThisMonth = 0;

      if (isHistorical) {
        // Historical trajectory from originalTaken (m=0) to currentLeft (m=elapsedMonths)
        const prevRatio = elapsedMonths > 0 ? (m - 1) / elapsedMonths : 1;
        const curRatio = elapsedMonths > 0 ? m / elapsedMonths : 1;
        openingBalance =
          originalTaken - (originalTaken - currentLeft) * prevRatio;
        const targetClosing =
          m === elapsedMonths
            ? currentLeft
            : originalTaken - (originalTaken - currentLeft) * curRatio;

        const histInt = ((openingBalance + targetClosing) / 2) * r;
        const histPrin = Math.max(0, openingBalance - targetClosing);
        actualBal = Math.max(0, targetClosing);
        actualInterestCum += histInt;
        interestPaidThisMonth = histInt;
        principalPaidThisMonth = histPrin;
        emiPaidThisMonth = histInt + histPrin;
      } else if (!isEmiInsufficient && actualBal > 0.01) {
        // Future projected trajectory from Today's Current Base Left using Fixed Monthly EMI
        const actInt = actualBal * r;
        const actPay = Math.min(actualBal + actInt, effectiveActualEmi);
        const actPrinFromEmi = Math.max(0, actPay - actInt);

        actualBal = Math.max(0, actualBal - actPrinFromEmi);
        actualInterestCum += actInt;
        futureInterestPayable += actInt;
        emiPaidThisMonth = actPay;
        interestPaidThisMonth = actInt;
        principalPaidThisMonth = actPrinFromEmi;

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
            if (prep.year === curYm.year && prep.month === curYm.month) {
              matches = true;
            } else if (
              m === elapsedMonths + 1 &&
              (prep.year < curYm.year ||
                (prep.year === curYm.year && prep.month <= curYm.month))
            ) {
              // If user entered a one-time prepayment dated today/this month, apply on Month 1 from today
              const startYm = parseYearMonth(loan.startDate);
              if (
                prep.year > startYm.year ||
                (prep.year === startYm.year && prep.month >= startYm.month)
              ) {
                matches = true;
              }
            }
          }

          if (matches) {
            const applied = Math.min(actualBal, prep.amount);
            actualBal = Math.max(0, actualBal - applied);
            prepaymentThisMonth += applied;
            totalPrepaid += applied;
          }
        }

        if (actualBal <= 0.01) {
          actualBal = 0;
        }
        actualMonths = m;
        futureMonthsRemaining = m - elapsedMonths;
        finalMonthEmi = emiPaidThisMonth;
      } else if (!isHistorical && isEmiInsufficient) {
        // Keep flat if EMI is insufficient so loop stops cleanly at tenure
        if (m >= tenure) break;
      } else {
        actualBal = 0;
      }

      monthlySchedule.push({
        monthIndex: m,
        date: currentDateYm,
        yearLabel: currentDateYm.slice(0, 4),
        openingBalance: Math.round(openingBalance),
        emiPaid: Math.round(emiPaidThisMonth),
        baselineRemaining: Math.round(baselineBal),
        actualRemaining: Math.round(actualBal),
        closingBalance: Math.round(actualBal),
        baselineInterestCum: Math.round(baselineInterestCum),
        actualInterestCum: Math.round(actualInterestCum),
        principalPaid: Math.round(principalPaidThisMonth),
        interestPaid: Math.round(interestPaidThisMonth),
        prepaymentApplied: Math.round(prepaymentThisMonth),
        isFuture: !isHistorical,
      });

      if (m > elapsedMonths && baselineBal <= 0 && actualBal <= 0) {
        break;
      }
    }
  }

  const yearlySchedule: LoanSchedulePoint[] = [];
  for (let i = 0; i < monthlySchedule.length; i++) {
    const pt = monthlySchedule[i];
    const isYearBoundary = pt.monthIndex % 12 === 0;
    const isTodayPoint = pt.monthIndex === elapsedMonths;
    const isLast = i === monthlySchedule.length - 1;
    if (isYearBoundary || isTodayPoint || isLast) {
      yearlySchedule.push(pt);
    }
  }

  const monthsSaved =
    currentLeft <= 0
      ? Math.max(0, baselineMonths - elapsedMonths)
      : isEmiInsufficient
      ? 0
      : Math.max(0, baselineMonths - actualMonths);
  const interestSaved = isEmiInsufficient
    ? 0
    : Math.max(0, baselineInterestCum - actualInterestCum);
  const aheadOfBaselineAmount = Math.round(baselineAtToday - currentLeft);

  return {
    standardEmi: Math.round(standardEmi),
    effectiveActualEmi: Math.round(effectiveActualEmi),
    firstMonthInterest: Math.round(firstMonthInterest),
    isEmiInsufficient,
    finalMonthEmi: Math.round(finalMonthEmi),
    baselineMonths,
    actualMonths,
    futureMonthsRemaining,
    monthsSaved,
    baselineTotalInterest: Math.round(baselineInterestCum),
    actualTotalInterest: Math.round(actualInterestCum),
    futureInterestPayable: Math.round(futureInterestPayable),
    interestSaved: Math.round(interestSaved),
    totalPrepaid: Math.round(totalPrepaid),
    baselinePayoffDate: addMonthsToYm(loan.startDate, Math.max(0, baselineMonths)),
    actualPayoffDate: addMonthsToYm(
      loan.startDate,
      currentLeft <= 0 ? elapsedMonths : Math.max(elapsedMonths, actualMonths)
    ),
    todayDateYm,
    currentRemainingPrincipal: Math.round(currentLeft),
    currentBaselineRemainingPrincipal: Math.round(baselineAtToday),
    aheadOfBaselineAmount,
    elapsedMonths,
    monthlySchedule,
    yearlySchedule,
  };
}

/**
 * Investment Compounding Engine:
 * Supports both SIP_COMPOUND (monthly SIP + step-up + CAGR) and
 * LUMPSUM_INTEREST (fixed savings/FD lumpsum earning annual interest).
 */
export function calculateWealthProjection(
  investment: InvestmentProfile,
  horizonYears: number,
  loanComparison: LoanComparisonResult
): WealthProjectionResult {
  const years = Math.min(40, Math.max(1, Math.round(horizonYears)));
  const currentYear = new Date().getFullYear();
  const cagr = Math.max(0, investment.expectedCagrPercent);
  const isLumpsumOnly = investment.kind === 'LUMPSUM_INTEREST';
  const stepUp = isLumpsumOnly ? 0 : Math.max(0, investment.annualStepUpPercent);
  const baseSip = isLumpsumOnly ? 0 : Math.max(0, investment.monthlySip);

  // Effective monthly rate yielding exact annual interest / CAGR
  const monthlyRate = Math.pow(1 + cagr / 100, 1 / 12) - 1;

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
 * Aggregate multiple investments & savings accounts into a combined WealthProjectionResult
 * and per-account results, scanning up to 40 years for accurate Net-Debt-Free Crossover detection.
 */
export function calculateCombinedInvestments(
  investments: InvestmentProfile[],
  horizonYears: number,
  loanComparison: LoanComparisonResult
): {
  individual: Array<{ investment: InvestmentProfile; result: WealthProjectionResult }>;
  combined: WealthProjectionResult;
} {
  const years = Math.min(40, Math.max(1, Math.round(horizonYears)));
  const currentYear = new Date().getFullYear();

  if (!investments.length) {
    const empty = calculateWealthProjection(
      {
        id: 'empty-inv',
        name: 'No Investments',
        kind: 'SIP_COMPOUND',
        currentCorpus: 0,
        monthlySip: 0,
        annualStepUpPercent: 0,
        expectedCagrPercent: 12,
      },
      years,
      loanComparison
    );
    return { individual: [], combined: empty };
  }

  const individual = investments.map((investment) => ({
    investment,
    result: calculateWealthProjection(investment, years, loanComparison),
  }));

  if (individual.length === 1) {
    return { individual, combined: individual[0].result };
  }

  // Run full 40-year scan per investment to detect exact combined crossover year
  const fullScans = investments.map((inv) =>
    calculateWealthProjection(inv, 40, loanComparison)
  );

  const startingLoan = loanComparison.currentRemainingPrincipal;
  let crossoverYear: number | null = null;
  const yearlyBreakdown: WealthYearPoint[] = [];

  for (let y = 0; y <= 40; y++) {
    let investedPrincipal = 0;
    let totalCorpus = 0;
    let annualSipRate = 0;

    for (const scan of fullScans) {
      const pt = scan.yearlyBreakdown[y];
      if (pt) {
        investedPrincipal += pt.investedPrincipal;
        totalCorpus += pt.totalCorpus;
        annualSipRate += pt.annualSipRate;
      }
    }

    const futureMonthIdx = loanComparison.elapsedMonths + y * 12;
    const loanPoint = loanComparison.monthlySchedule[futureMonthIdx];
    const remainingLoan =
      y === 0
        ? startingLoan
        : loanPoint
        ? loanPoint.actualRemaining
        : 0;

    if (crossoverYear === null && totalCorpus >= remainingLoan) {
      crossoverYear = y;
    }

    if (y <= years) {
      yearlyBreakdown.push({
        year: y,
        calendarYear: currentYear + y,
        label: y === 0 ? 'Now' : `Yr ${y}`,
        investedPrincipal: Math.round(investedPrincipal),
        wealthGained: Math.max(0, Math.round(totalCorpus - investedPrincipal)),
        totalCorpus: Math.round(totalCorpus),
        annualSipRate: Math.round(annualSipRate),
        remainingLoanPrincipal: Math.round(remainingLoan),
        netWorthProjection: Math.round(totalCorpus - remainingLoan),
      });
    }
  }

  const finalPoint = yearlyBreakdown[yearlyBreakdown.length - 1];
  const alreadyNetDebtFree = crossoverYear === 0;

  return {
    individual,
    combined: {
      horizonYears: years,
      finalCorpus: finalPoint.totalCorpus,
      totalInvested: finalPoint.investedPrincipal,
      totalWealthGained: finalPoint.wealthGained,
      crossoverYear,
      crossoverCalendarYear:
        crossoverYear !== null ? currentYear + crossoverYear : null,
      alreadyNetDebtFree,
      yearlyBreakdown,
    },
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
 * Combine multiple loans into a single calendar-aligned LoanComparisonResult
 * so Overview, Wealth Crossover, and Combined Loan View aggregate accurately.
 */
export function calculateCombinedLoans(loans: LoanProfile[]): {
  individual: Array<{ loan: LoanProfile; result: LoanComparisonResult }>;
  combined: LoanComparisonResult;
} {
  const now = new Date();
  const todayDateYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}`;

  if (!loans.length) {
    const empty = calculateLoanComparison({
      id: 'empty',
      name: 'No Active Loans',
      originalPrincipal: 0,
      principal: 0,
      annualInterestRate: 0,
      originalTenureMonths: 12,
      startDate: `${todayDateYm}-01`,
      actualMonthlyEmi: 0,
      prepayments: [],
    });
    return { individual: [], combined: empty };
  }

  const individual = loans.map((loan) => ({
    loan,
    result: calculateLoanComparison(loan),
  }));

  if (individual.length === 1) {
    return { individual, combined: individual[0].result };
  }

  // Determine earliest startDate across all loans
  const earliestDateYm = individual
    .map((item) => item.result.monthlySchedule[0]?.date || todayDateYm)
    .sort()[0];

  const earliestStartIso = `${earliestDateYm}-01`;
  const elapsedMonths = getElapsedMonthsFromStart(earliestStartIso, now);

  // Build lookup map per loan by YYYY-MM
  const loanMaps = individual.map(({ result }) => {
    const map = new Map<string, LoanSchedulePoint>();
    for (const pt of result.monthlySchedule) {
      map.set(pt.date, pt);
    }
    const firstDate = result.monthlySchedule[0]?.date || todayDateYm;
    const lastPt = result.monthlySchedule[result.monthlySchedule.length - 1];
    return { map, firstDate, lastPt, result };
  });

  // Determine max month span across all schedules relative to earliestDateYm
  const earliestYm = parseYearMonth(earliestStartIso);
  let maxMonthSpan = elapsedMonths;
  for (const { result } of individual) {
    const first = parseYearMonth(`${result.monthlySchedule[0]?.date || todayDateYm}-01`);
    const offset =
      (first.year - earliestYm.year) * 12 + (first.month - earliestYm.month);
    const totalSpan = offset + result.monthlySchedule.length - 1;
    if (totalSpan > maxMonthSpan) maxMonthSpan = totalSpan;
  }

  const monthlySchedule: LoanSchedulePoint[] = [];

  for (let m = 0; m <= maxMonthSpan; m++) {
    const dateYm = addMonthsToYm(earliestStartIso, m);
    const isFuture = m > elapsedMonths;

    let openingBalance = 0;
    let emiPaid = 0;
    let baselineRemaining = 0;
    let actualRemaining = 0;
    let closingBalance = 0;
    let baselineInterestCum = 0;
    let actualInterestCum = 0;
    let principalPaid = 0;
    let interestPaid = 0;
    let prepaymentApplied = 0;

    for (const lm of loanMaps) {
      if (dateYm < lm.firstDate) {
        // Loan hasn't started yet in this month
        continue;
      }
      const pt = lm.map.get(dateYm);
      if (pt) {
        openingBalance += pt.openingBalance;
        emiPaid += pt.emiPaid;
        baselineRemaining += pt.baselineRemaining;
        actualRemaining += pt.actualRemaining;
        closingBalance += pt.closingBalance;
        baselineInterestCum += pt.baselineInterestCum;
        actualInterestCum += pt.actualInterestCum;
        principalPaid += pt.principalPaid;
        interestPaid += pt.interestPaid;
        prepaymentApplied += pt.prepaymentApplied;
      } else if (lm.lastPt && dateYm > lm.lastPt.date) {
        // Loan already closed; retain cumulative interest totals
        baselineInterestCum += lm.lastPt.baselineInterestCum;
        actualInterestCum += lm.lastPt.actualInterestCum;
      }
    }

    monthlySchedule.push({
      monthIndex: m,
      date: dateYm,
      yearLabel: dateYm.slice(0, 4),
      openingBalance,
      emiPaid,
      baselineRemaining,
      actualRemaining,
      closingBalance,
      baselineInterestCum,
      actualInterestCum,
      principalPaid,
      interestPaid,
      prepaymentApplied,
      isFuture,
    });
  }

  const yearlySchedule: LoanSchedulePoint[] = [];
  for (let i = 0; i < monthlySchedule.length; i++) {
    const pt = monthlySchedule[i];
    const isYearBoundary = pt.monthIndex % 12 === 0;
    const isTodayPoint = pt.monthIndex === elapsedMonths;
    const isLast = i === monthlySchedule.length - 1;
    if (isYearBoundary || isTodayPoint || isLast) {
      yearlySchedule.push(pt);
    }
  }

  const standardEmi = individual.reduce((s, i) => s + i.result.standardEmi, 0);
  const effectiveActualEmi = individual.reduce(
    (s, i) => s + i.result.effectiveActualEmi,
    0
  );
  const firstMonthInterest = individual.reduce(
    (s, i) => s + i.result.firstMonthInterest,
    0
  );
  const isEmiInsufficient = individual.some((i) => i.result.isEmiInsufficient);
  const baselineTotalInterest = individual.reduce(
    (s, i) => s + i.result.baselineTotalInterest,
    0
  );
  const actualTotalInterest = individual.reduce(
    (s, i) => s + i.result.actualTotalInterest,
    0
  );
  const futureInterestPayable = individual.reduce(
    (s, i) => s + i.result.futureInterestPayable,
    0
  );
  const interestSaved = individual.reduce((s, i) => s + i.result.interestSaved, 0);
  const totalPrepaid = individual.reduce((s, i) => s + i.result.totalPrepaid, 0);
  const currentRemainingPrincipal = individual.reduce(
    (s, i) => s + i.result.currentRemainingPrincipal,
    0
  );
  const currentBaselineRemainingPrincipal = individual.reduce(
    (s, i) => s + i.result.currentBaselineRemainingPrincipal,
    0
  );
  const aheadOfBaselineAmount = individual.reduce(
    (s, i) => s + i.result.aheadOfBaselineAmount,
    0
  );

  const futureMonthsRemaining = Math.max(
    0,
    ...individual.map((i) => i.result.futureMonthsRemaining)
  );
  const actualPayoffDate = individual
    .map((i) => i.result.actualPayoffDate)
    .sort()
    .pop() || todayDateYm;
  const baselinePayoffDate = individual
    .map((i) => i.result.baselinePayoffDate)
    .sort()
    .pop() || todayDateYm;

  const payoffDiffMonths = (() => {
    const bYm = parseYearMonth(`${baselinePayoffDate}-01`);
    const aYm = parseYearMonth(`${actualPayoffDate}-01`);
    return Math.max(0, (bYm.year - aYm.year) * 12 + (bYm.month - aYm.month));
  })();

  const finalPt =
    monthlySchedule
      .slice()
      .reverse()
      .find((pt) => pt.emiPaid > 0) || monthlySchedule[monthlySchedule.length - 1];

  return {
    individual,
    combined: {
      standardEmi,
      effectiveActualEmi,
      firstMonthInterest,
      isEmiInsufficient,
      finalMonthEmi: finalPt?.emiPaid || 0,
      baselineMonths: maxMonthSpan,
      actualMonths: elapsedMonths + futureMonthsRemaining,
      futureMonthsRemaining,
      monthsSaved: payoffDiffMonths,
      baselineTotalInterest,
      actualTotalInterest,
      futureInterestPayable,
      interestSaved,
      totalPrepaid,
      baselinePayoffDate,
      actualPayoffDate,
      todayDateYm,
      currentRemainingPrincipal,
      currentBaselineRemainingPrincipal,
      aheadOfBaselineAmount,
      elapsedMonths,
      monthlySchedule,
      yearlySchedule,
    },
  };
}

/**
 * Compute Ideal Wealth Weightage comparison and actionable optimization insights.
 */
export function computeAllocationAndAdvisor(
  transactions: Transaction[],
  monthlySalary: number,
  idealTargets: IdealTargets,
  loans: LoanProfile[],
  investments: InvestmentProfile[],
  combinedLoanComparison: LoanComparisonResult
): AllocationAdvisorResult {
  const debits = transactions.filter((t) => t.type === 'DEBIT');

  // Target the active loan with the highest interest rate (debt avalanche) for surplus simulation
  const targetLoan =
    loans
      .filter((l) => l.principal > 0)
      .sort((a, b) => b.annualInterestRate - a.annualInterestRate)[0] || loans[0];

  // Pick primary SIP growth investment (or fallback 12% growth) for 10Y SIP redirection simulation
  const primarySipInvestment: InvestmentProfile =
    investments.find((i) => i.kind === 'SIP_COMPOUND') ||
    investments[0] || {
      id: 'default-sip',
      name: 'Equity SIP',
      kind: 'SIP_COMPOUND',
      currentCorpus: 0,
      monthlySip: 0,
      annualStepUpPercent: 0,
      expectedCagrPercent: 12,
    };

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

  const catMap = new Map(categories.map((c) => [c.category, c.monthlyAmount]));

  // Pull monthly SIP investments directly from Wealth Forecaster (active SIP_COMPOUND plans)
  const sipInvestments = investments.filter(
    (inv) => inv.kind === 'SIP_COMPOUND' && inv.monthlySip > 0
  );
  const invMonthly = sipInvestments.reduce(
    (sum, inv) => sum + Math.max(0, inv.monthlySip),
    0
  );

  // Pull monthly Loan EMIs directly from Loan Trajectory (active loans combined)
  const activeLoans = loans.filter((l) => l.principal > 0);
  const loanMonthly = combinedLoanComparison.effectiveActualEmi;

  // Pull variable & fixed living expenses from categorized Bank Statement debits
  const essentialsMonthly = Array.from(ESSENTIALS_SET).reduce(
    (sum, cat) => sum + (catMap.get(cat) || 0),
    0
  );
  const lifestyleMonthly = Array.from(LIFESTYLE_SET).reduce(
    (sum, cat) => sum + (catMap.get(cat) || 0),
    0
  );

  const invPct = monthlySalary > 0 ? (invMonthly / monthlySalary) * 100 : 0;
  const loanPct = monthlySalary > 0 ? (loanMonthly / monthlySalary) * 100 : 0;
  const essPct = monthlySalary > 0 ? (essentialsMonthly / monthlySalary) * 100 : 0;
  const lifePct = monthlySalary > 0 ? (lifestyleMonthly / monthlySalary) * 100 : 0;

  const buckets: BucketAllocation[] = [
    {
      key: 'investments',
      label: 'Investments & SIPs',
      description:
        sipInvestments.length > 0
          ? `From Wealth (${sipInvestments.length} SIP ${
              sipInvestments.length === 1 ? 'plan' : 'plans'
            })`
          : 'From Wealth · No monthly SIP set',
      actualMonthlyAmount: invMonthly,
      actualPercent: invPct,
      targetPercent: idealTargets.investments,
      variancePercent: idealTargets.investments - invPct,
      status:
        invPct >= idealTargets.investments
          ? 'on-track'
          : invPct >= idealTargets.investments * 0.75
          ? 'watch'
          : 'over-limit',
    },
    {
      key: 'loans',
      label: 'Loans & EMIs',
      description:
        activeLoans.length > 0
          ? `From Loans (${activeLoans.length} active ${
              activeLoans.length === 1 ? 'loan' : 'loans'
            })`
          : 'From Loans · No active loan EMI',
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
      description: 'From Statement · Food, Fuel, Utilities & Housing',
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
      description: 'From Statement · Shopping, Dining discretionary & transfers',
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

  const nonInvestmentOutflow = loanMonthly + essentialsMonthly + lifestyleMonthly;
  const monthlySavingsAmount = Math.max(0, monthlySalary - nonInvestmentOutflow);
  const monthlySavingsRatePercent =
    monthlySalary > 0 ? (monthlySavingsAmount / monthlySalary) * 100 : 0;

  const insights: OptimizationInsight[] = [];
  const targetLoanBaseComparison = targetLoan
    ? calculateLoanComparison(targetLoan)
    : combinedLoanComparison;

  if (monthlySalary > 0) {
    const invTargetAmount = (idealTargets.investments / 100) * monthlySalary;
    const invShortfall = Math.round(Math.max(0, invTargetAmount - invMonthly));
    if (invShortfall > 0) {
      const sim = simulateRedirectSurplus(
        invShortfall,
        targetLoan,
        targetLoanBaseComparison,
        primarySipInvestment
      );
      insights.push({
        id: 'investment-shortfall',
        title: 'Investment Allocation Below Benchmark',
        summary: `Wealth SIPs are ${(idealTargets.investments - invPct).toFixed(
          1
        )}% below your ${idealTargets.investments}% wealth target.`,
        monthlySurplusAmount: invShortfall,
        loanMonthsSavedIfRedirected: sim.monthsSaved,
        loanInterestSavedIfRedirected: sim.interestSaved,
        extraCorpus10YrIfRedirected: sim.extraCorpus10Yr,
        severity: 'info',
      });
    }
  }

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
        targetLoan,
        targetLoanBaseComparison,
        primarySipInvestment
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

    const essExcess = Math.round(
      Math.max(0, essentialsMonthly - (idealTargets.essentials / 100) * monthlySalary)
    );
    if (essExcess > 0) {
      const sim = simulateRedirectSurplus(
        essExcess,
        targetLoan,
        targetLoanBaseComparison,
        primarySipInvestment
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

    if (insights.length === 0) {
      const bonusStepUp = Math.round(monthlySalary * 0.05);
      const sim = simulateRedirectSurplus(
        bonusStepUp,
        targetLoan,
        targetLoanBaseComparison,
        primarySipInvestment
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
  loan: LoanProfile | undefined,
  baseLoanComparison: LoanComparisonResult,
  investment: InvestmentProfile
): {
  monthsSaved: number;
  interestSaved: number;
  extraCorpus10Yr: number;
} {
  let monthsSaved = 0;
  let interestSaved = 0;
  if (loan && loan.principal > 0 && monthlyAmount > 0) {
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
