import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Landmark,
  ShieldCheck,
  PiggyBank,
} from 'lucide-react';
import {
  AllocationAdvisorResult,
  AppState,
  LoanComparisonResult,
  WealthProjectionResult,
} from '../types/finance';
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonthYear,
  formatMonthsToDuration,
  formatPercent,
} from '../utils/format';

export type ActiveTab = 'overview' | 'loan' | 'wealth' | 'statements';

interface OverviewDashboardProps {
  state: AppState;
  loanComparison: LoanComparisonResult;
  wealthProjection: WealthProjectionResult;
  advisor: AllocationAdvisorResult;
  onNavigate: (tab: ActiveTab) => void;
  onUpdateSalary: (salary: number) => void;
  onApplySurplusToEmi: (extraMonthly: number) => void;
  onApplySurplusToSip: (extraMonthly: number) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  state,
  loanComparison,
  wealthProjection,
  advisor,
  onNavigate,
  onUpdateSalary,
  onApplySurplusToEmi,
  onApplySurplusToSip,
}) => {
  const { currency, monthlySalary, investment, horizonYears } = state;
  const outstandingLoan = loanComparison.currentRemainingPrincipal;
  const netWorth = investment.currentCorpus - outstandingLoan;

  const hasData =
    monthlySalary > 0 ||
    state.loan.principal > 0 ||
    investment.currentCorpus > 0 ||
    state.transactions.length > 0;

  return (
    <div className="space-y-6">
      {/* Top 5-KPI Strip */}
      <section aria-label="Key Financial Metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* KPI 1: Monthly Take-Home Salary (Editable inline) */}
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#94a3b8]">
            <span>Monthly Salary</span>
            <Wallet className="w-4 h-4 text-[#798098]" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-mono text-[#94a3b8]">
                {currency === 'INR' ? '₹' : '$'}
              </span>
              <input
                type="number"
                aria-label="Monthly Take-Home Salary"
                value={monthlySalary || ''}
                min={0}
                onChange={(e) => onUpdateSalary(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-transparent text-2xl font-bold font-mono tabular-nums text-[#f8fafc] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded px-1 -ml-1"
              />
            </div>
            <p className="mt-1.5 text-xs text-[#64748b] tabular-nums">
              {formatCompactCurrency(monthlySalary * 12, currency)} / year take-home
            </p>
          </div>
        </div>

        {/* KPI 2: Invested Corpus */}
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#94a3b8]">
            <span>Invested Corpus</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
              {formatCompactCurrency(investment.currentCorpus, currency)}
            </div>
            <p className="mt-1.5 text-xs text-emerald-400/90 tabular-nums">
              {formatCompactCurrency(wealthProjection.finalCorpus, currency)} in {horizonYears}Y
            </p>
          </div>
        </div>

        {/* KPI 3: Outstanding Loan */}
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#94a3b8]">
            <span>Outstanding Loan</span>
            <Landmark className="w-4 h-4 text-rose-400" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
              {formatCompactCurrency(outstandingLoan, currency)}
            </div>
            <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
              {state.loan.principal > 0
                ? `Payoff ${formatMonthYear(loanComparison.actualPayoffDate)} · ${formatMonthsToDuration(
                    loanComparison.monthsSaved
                  )} saved`
                : 'No active loan configured'}
            </p>
          </div>
        </div>

        {/* KPI 4: Net Worth */}
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#94a3b8]">
            <span>Current Net Worth</span>
            <ShieldCheck
              className={`w-4 h-4 ${netWorth >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}
              aria-hidden="true"
            />
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                netWorth >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatCompactCurrency(netWorth, currency)}
            </div>
            <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
              {wealthProjection.alreadyNetDebtFree
                ? 'Assets exceed loan principal'
                : wealthProjection.crossoverCalendarYear
                ? `Net-debt-free in ${wealthProjection.crossoverCalendarYear} (Yr ${wealthProjection.crossoverYear})`
                : 'Increase SIP or prepayments'}
            </p>
          </div>
        </div>

        {/* KPI 5: Monthly Savings Rate */}
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#94a3b8]">
            <span>Monthly Savings Rate</span>
            <PiggyBank className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
              {state.transactions.length > 0
                ? formatPercent(advisor.monthlySavingsRatePercent, 1)
                : monthlySalary > 0
                ? formatPercent((investment.monthlySip / monthlySalary) * 100, 1)
                : '0.0%'}
            </div>
            <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
              {state.transactions.length > 0
                ? `${formatCompactCurrency(advisor.monthlySavingsAmount, currency)} retained + invested`
                : `${formatCompactCurrency(investment.monthlySip, currency)}/mo active SIP`}
            </p>
          </div>
        </div>
      </section>

      {!hasData && (
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-8 text-center">
          <h2 className="text-lg font-semibold text-[#f8fafc]">
            Your financial workspace is empty
          </h2>
          <p className="mt-2 text-sm text-[#94a3b8] max-w-lg mx-auto">
            Configure your loan and investment parameters, upload a bank statement PDF/CSV for Gemini extraction, or load a sample dataset from the sidebar to explore live trajectories.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('statements')}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Upload Bank Statement
            </button>
            <button
              onClick={() => onNavigate('loan')}
              className="px-4 py-2 text-sm font-medium bg-[#2a2a2b] hover:bg-[#353436] text-[#e4e2e4] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Configure Loan Trajectory
            </button>
          </div>
        </div>
      )}

      {/* Primary Split: Wealth vs Loan Crossover + Ideal Weightage Gauge */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Crossover & Trajectory Chart */}
        <div className="lg:col-span-7 bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#f8fafc]">
                Wealth vs. Remaining Debt Trajectory
              </h2>
              <p className="text-xs text-[#94a3b8] mt-1 tabular-nums">
                {horizonYears}-year forecast at {investment.expectedCagrPercent}% CAGR
                {investment.annualStepUpPercent > 0
                  ? ` · ${investment.annualStepUpPercent}% annual SIP step-up`
                  : ''}
                {wealthProjection.crossoverCalendarYear && !wealthProjection.alreadyNetDebtFree
                  ? ` · Crossover ${wealthProjection.crossoverCalendarYear}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('loan')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#c6c6cd] hover:text-white bg-[#2a2a2b] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Loan Lab
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('wealth')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Wealth Forecaster
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-5 h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={wealthProjection.yearlyBreakdown}
                margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ovCorpusGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="ovLoanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2a2a2b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="calendarYear"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#2e2f36' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                  tickFormatter={(v) => formatCompactCurrency(Number(v), currency)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="bg-[#0e0e10]/95 backdrop-blur-md border border-[#39393b] rounded-xl p-3 shadow-xl text-xs space-y-1.5">
                        <div className="font-semibold text-[#f8fafc] border-b border-[#2a2a2b] pb-1">
                          {pt.calendarYear} ({pt.label})
                        </div>
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-emerald-400">Projected Corpus</span>
                          <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                            {formatCurrency(pt.totalCorpus, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-rose-400">Remaining Loan</span>
                          <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                            {formatCurrency(pt.remainingLoanPrincipal, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-6 pt-1 border-t border-[#2a2a2b]">
                          <span className="text-[#94a3b8]">Projected Net Worth</span>
                          <span className="font-mono tabular-nums font-semibold text-indigo-300">
                            {formatCurrency(pt.netWorthProjection, currency)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                {wealthProjection.crossoverCalendarYear &&
                  wealthProjection.crossoverYear !== null &&
                  wealthProjection.crossoverYear > 0 &&
                  wealthProjection.crossoverYear <= horizonYears && (
                    <ReferenceLine
                      x={wealthProjection.crossoverCalendarYear}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      label={{
                        value: `Crossover ${wealthProjection.crossoverCalendarYear}`,
                        position: 'insideTopRight',
                        fill: '#c3c0ff',
                        fontSize: 11,
                      }}
                    />
                  )}
                <Area
                  type="monotone"
                  dataKey="totalCorpus"
                  name="Projected Corpus"
                  stroke="#10B981"
                  strokeWidth={2.2}
                  fill="url(#ovCorpusGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="remainingLoanPrincipal"
                  name="Remaining Loan"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill="url(#ovLoanGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-4 border-t border-[#2a2a2b] grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[#94a3b8] block">Loan Interest Saved</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-400 text-sm">
                {formatCompactCurrency(loanComparison.interestSaved, currency)}
              </span>
            </div>
            <div>
              <span className="text-[#94a3b8] block">Tenure Reduction</span>
              <span className="font-mono tabular-nums font-semibold text-[#f8fafc] text-sm">
                {formatMonthsToDuration(loanComparison.monthsSaved)} ({loanComparison.monthsSaved} mo)
              </span>
            </div>
            <div>
              <span className="text-[#94a3b8] block">Wealth Gained ({horizonYears}Y)</span>
              <span className="font-mono tabular-nums font-semibold text-indigo-300 text-sm">
                {formatCompactCurrency(wealthProjection.totalWealthGained, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Ideal Wealth Weightage Gauge */}
        <div className="lg:col-span-5 bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#f8fafc]">
                  Ideal Wealth Weightage
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Actual monthly cash flow vs. target allocation · {advisor.activeMonthLabel}
                </p>
              </div>
              <button
                onClick={() => onNavigate('statements')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#c6c6cd] hover:text-white bg-[#2a2a2b] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Details
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {advisor.buckets.map((bucket) => {
                const isInv = bucket.key === 'investments';
                const statusColor =
                  bucket.status === 'on-track'
                    ? 'text-emerald-400'
                    : bucket.status === 'watch'
                    ? 'text-amber-400'
                    : 'text-rose-400';
                const barColor =
                  bucket.status === 'on-track'
                    ? 'bg-emerald-500'
                    : bucket.status === 'watch'
                    ? 'bg-amber-500'
                    : 'bg-rose-500';
                const statusText =
                  bucket.status === 'on-track'
                    ? 'On Target'
                    : bucket.status === 'watch'
                    ? isInv
                      ? 'Below Target'
                      : 'Near Limit'
                    : isInv
                    ? 'Shortfall'
                    : 'Over Limit';

                return (
                  <div key={bucket.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#e4e2e4]">{bucket.label}</span>
                        <span className={`font-medium ${statusColor}`}>· {statusText}</span>
                      </div>
                      <div className="font-mono tabular-nums text-[#e4e2e4]">
                        {formatPercent(bucket.actualPercent, 1)}{' '}
                        <span className="text-[#64748b]">
                          / {isInv ? '≥' : '≤'} {bucket.targetPercent}%
                        </span>
                      </div>
                    </div>

                    <div className="relative h-2.5 w-full bg-[#2a2a2b] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-300`}
                        style={{
                          width: `${Math.min(100, Math.max(0, bucket.actualPercent))}%`,
                        }}
                      />
                      {/* Target marker line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white/75"
                        style={{ left: `${Math.min(99, Math.max(1, bucket.targetPercent))}%` }}
                        title={`Target: ${bucket.targetPercent}%`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#94a3b8] tabular-nums">
                      <span>{bucket.description}</span>
                      <span className="font-mono">
                        {formatCurrency(bucket.actualMonthlyAmount, currency)}/mo
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#2a2a2b] flex items-center justify-between text-xs text-[#94a3b8]">
            <span>Parsed Monthly Debits</span>
            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
              {formatCurrency(advisor.monthlyTotalSpend, currency)} / mo
            </span>
          </div>
        </div>
      </section>

      {/* Actionable Optimization Advisor */}
      {advisor.insights.length > 0 && (
        <section className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#f8fafc]">
                Actionable Wealth Advisor
              </h2>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Live simulations based on your expense leaks, loan rate ({state.loan.annualInterestRate}%), and CAGR ({investment.expectedCagrPercent}%)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {advisor.insights.map((insight) => (
              <div
                key={insight.id}
                className="bg-[#131315] border border-[#2e2f36] rounded-xl p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {insight.severity === 'positive' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${
                          insight.severity === 'warning' ? 'text-amber-400' : 'text-indigo-400'
                        }`}
                      />
                    )}
                    <h3 className="text-sm font-semibold text-[#f8fafc]">{insight.title}</h3>
                  </div>
                  <p className="text-xs text-[#c6c6cd] leading-relaxed">
                    {insight.summary} Redirecting{' '}
                    <span className="font-mono font-semibold text-[#f8fafc] tabular-nums">
                      {formatCurrency(insight.monthlySurplusAmount, currency)}/mo
                    </span>{' '}
                    compounds into:
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#2a2a2b]">
                  <div>
                    <span className="text-[11px] text-[#94a3b8] block">
                      If Routed to Loan EMI
                    </span>
                    <span className="text-sm font-mono font-semibold text-emerald-400 tabular-nums">
                      {insight.loanMonthsSavedIfRedirected > 0
                        ? `${insight.loanMonthsSavedIfRedirected} mo faster`
                        : 'Loan optimal'}
                    </span>
                    {insight.loanInterestSavedIfRedirected > 0 && (
                      <span className="block text-[11px] text-[#94a3b8] font-mono tabular-nums">
                        +{formatCompactCurrency(insight.loanInterestSavedIfRedirected, currency)} saved
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-[#94a3b8] block">
                      If Routed to 10Y SIP
                    </span>
                    <span className="text-sm font-mono font-semibold text-indigo-300 tabular-nums">
                      +{formatCompactCurrency(insight.extraCorpus10YrIfRedirected, currency)}
                    </span>
                    <span className="block text-[11px] text-[#94a3b8]">
                      at {investment.expectedCagrPercent}% CAGR
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {state.loan.principal > 0 && insight.loanMonthsSavedIfRedirected > 0 && (
                    <button
                      onClick={() => onApplySurplusToEmi(insight.monthlySurplusAmount)}
                      className="px-3 py-1.5 text-xs font-medium bg-[#2a2a2b] hover:bg-[#353436] text-[#e4e2e4] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Boost EMI +{formatCompactCurrency(insight.monthlySurplusAmount, currency)}
                    </button>
                  )}
                  <button
                    onClick={() => onApplySurplusToSip(insight.monthlySurplusAmount)}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-200 border border-indigo-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Boost SIP +{formatCompactCurrency(insight.monthlySurplusAmount, currency)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
