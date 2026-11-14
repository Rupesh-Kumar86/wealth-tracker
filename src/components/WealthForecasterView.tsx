import React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Flag, Sparkles, TrendingUp } from 'lucide-react';
import {
  CurrencyCode,
  InvestmentProfile,
  LoanComparisonResult,
  WealthProjectionResult,
} from '../types/finance';
import { formatCompactCurrency, formatCurrency } from '../utils/format';

interface WealthForecasterViewProps {
  currency: CurrencyCode;
  investment: InvestmentProfile;
  horizonYears: number;
  projection: WealthProjectionResult;
  loanComparison: LoanComparisonResult;
  onUpdateInvestment: (updated: InvestmentProfile) => void;
  onUpdateHorizon: (years: number) => void;
}

const HORIZON_PRESETS = [5, 10, 15, 20];
const CAGR_PRESETS = [
  { label: 'Conservative', rate: 8 },
  { label: 'Moderate', rate: 12 },
  { label: 'Aggressive', rate: 15 },
];

export const WealthForecasterView: React.FC<WealthForecasterViewProps> = ({
  currency,
  investment,
  horizonYears,
  projection,
  loanComparison,
  onUpdateInvestment,
  onUpdateHorizon,
}) => {
  const handleFieldChange = <K extends keyof InvestmentProfile>(
    key: K,
    value: InvestmentProfile[K]
  ) => {
    onUpdateInvestment({
      ...investment,
      [key]: value,
    });
  };

  const multiplier =
    projection.totalInvested > 0
      ? projection.finalCorpus / projection.totalInvested
      : 1;

  const corpusMax = currency === 'INR' ? 20000000 : 1000000;
  const corpusStep = currency === 'INR' ? 50000 : 5000;
  const sipMax = currency === 'INR' ? 300000 : 15000;
  const sipStep = currency === 'INR' ? 1000 : 100;

  return (
    <div className="space-y-6">
      {/* Top Milestone Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">
            Projected Corpus ({horizonYears}Y)
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {formatCompactCurrency(projection.finalCorpus, currency)}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            From {formatCompactCurrency(investment.currentCorpus, currency)} starting base
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Principal Invested</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
            {formatCompactCurrency(projection.totalInvested, currency)}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            {investment.annualStepUpPercent > 0
              ? `Includes ${investment.annualStepUpPercent}%/yr SIP step-up`
              : 'Fixed monthly SIP contribution'}
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Compounded Wealth Gained</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-indigo-300">
            {formatCompactCurrency(projection.totalWealthGained, currency)}
          </div>
          <p className="mt-1.5 text-xs text-emerald-400 tabular-nums">
            {multiplier.toFixed(2)}x total wealth multiplier
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Net-Debt-Free Crossover</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
            {loanComparison.currentRemainingPrincipal <= 0
              ? 'Debt-Free'
              : projection.alreadyNetDebtFree
              ? 'Achieved Now'
              : projection.crossoverCalendarYear
              ? `${projection.crossoverCalendarYear} (Yr ${projection.crossoverYear})`
              : 'Beyond 40Y'}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            When Investment Corpus ≥ Remaining Loan
          </p>
        </div>
      </section>

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="lg:col-span-4 bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#f8fafc]">Compounding Inputs</h2>
            <TrendingUp className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-medium text-[#94a3b8]">Current Portfolio Value</label>
                <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                  {formatCompactCurrency(investment.currentCorpus, currency)}
                </span>
              </div>
              <input
                type="number"
                min={0}
                step={corpusStep}
                value={investment.currentCorpus}
                onChange={(e) =>
                  handleFieldChange('currentCorpus', Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
              />
              <input
                type="range"
                min={0}
                max={corpusMax}
                step={corpusStep}
                value={Math.min(corpusMax, investment.currentCorpus)}
                onChange={(e) => handleFieldChange('currentCorpus', Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-medium text-[#94a3b8]">Monthly SIP Contribution</label>
                <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                  {formatCurrency(investment.monthlySip, currency)}/mo
                </span>
              </div>
              <input
                type="number"
                min={0}
                step={sipStep}
                value={investment.monthlySip}
                onChange={(e) =>
                  handleFieldChange('monthlySip', Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full bg-[#131315] border border-[#353436] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
              />
              <input
                type="range"
                min={0}
                max={sipMax}
                step={sipStep}
                value={Math.min(sipMax, investment.monthlySip)}
                onChange={(e) => handleFieldChange('monthlySip', Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-medium text-[#94a3b8]">Annual SIP Step-Up (%)</label>
                <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                  {investment.annualStepUpPercent}% / yr
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={investment.annualStepUpPercent}
                onChange={(e) =>
                  handleFieldChange('annualStepUpPercent', Number(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-[#64748b] font-mono mt-1">
                <span>0%</span>
                <span>10%</span>
                <span>25%</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#2a2a2b]">
              <div className="flex items-center justify-between text-xs mb-2">
                <label className="font-medium text-[#94a3b8]">Expected Return (CAGR %)</label>
                <span className="font-mono tabular-nums text-indigo-300 font-semibold">
                  {investment.expectedCagrPercent}% p.a.
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {CAGR_PRESETS.map((preset) => {
                  const active = investment.expectedCagrPercent === preset.rate;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleFieldChange('expectedCagrPercent', preset.rate)}
                      className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-200'
                          : 'bg-[#131315] border-[#2e2f36] text-[#94a3b8] hover:text-[#e4e2e4]'
                      }`}
                    >
                      {preset.label} {preset.rate}%
                    </button>
                  );
                })}
              </div>
              <input
                type="range"
                min={4}
                max={24}
                step={0.5}
                value={investment.expectedCagrPercent}
                onChange={(e) =>
                  handleFieldChange('expectedCagrPercent', Number(e.target.value))
                }
                className="w-full"
              />
            </div>

            <div className="pt-2 border-t border-[#2a2a2b]">
              <div className="flex items-center justify-between text-xs mb-2">
                <label className="font-medium text-[#94a3b8]">Time Horizon</label>
                <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                  {horizonYears} Years
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {HORIZON_PRESETS.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => onUpdateHorizon(yr)}
                    className={`py-1.5 text-xs font-mono font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      horizonYears === yr
                        ? 'bg-[#2a2a2b] border-indigo-500 text-[#f8fafc]'
                        : 'bg-[#131315] border-[#2e2f36] text-[#94a3b8] hover:text-[#e4e2e4]'
                    }`}
                  >
                    {yr}Y
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={horizonYears}
                onChange={(e) => onUpdateHorizon(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-[#64748b] font-mono mt-1">
                <span>1Y</span>
                <span>20Y</span>
                <span>40Y</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stacked Principal vs Gains + Loan Crossover Chart & Table */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-[#f8fafc]">
                  Invested Principal vs. Compounding Gains
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Stacked wealth accumulation overlaid with your remaining accelerated loan balance
                </p>
              </div>
              {projection.crossoverCalendarYear &&
                !projection.alreadyNetDebtFree &&
                loanComparison.currentRemainingPrincipal > 0 && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
                    <Flag className="w-3.5 h-3.5" />
                    <span>
                      Crossover in {projection.crossoverCalendarYear} (Year {projection.crossoverYear})
                    </span>
                  </div>
                )}
            </div>

            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={projection.yearlyBreakdown}
                  margin={{ top: 12, right: 12, left: 6, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="wfInvestedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.12} />
                    </linearGradient>
                    <linearGradient id="wfGainedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.12} />
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
                            {pt.calendarYear} · {pt.label}
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-indigo-300">Principal Invested</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCurrency(pt.investedPrincipal, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-emerald-400">Wealth Gained</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCurrency(pt.wealthGained, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6 pt-1 border-t border-[#2a2a2b]">
                            <span className="text-[#f8fafc] font-semibold">Total Corpus</span>
                            <span className="font-mono tabular-nums font-bold text-emerald-400">
                              {formatCurrency(pt.totalCorpus, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-rose-400">Remaining Loan</span>
                            <span className="font-mono tabular-nums text-rose-300">
                              {formatCurrency(pt.remainingLoanPrincipal, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-[#94a3b8]">Net Worth</span>
                            <span className="font-mono tabular-nums text-[#f8fafc]">
                              {formatCurrency(pt.netWorthProjection, currency)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {projection.crossoverCalendarYear &&
                    projection.crossoverYear !== null &&
                    projection.crossoverYear > 0 &&
                    projection.crossoverYear <= horizonYears && (
                      <ReferenceLine
                        x={projection.crossoverCalendarYear}
                        stroke="#c3c0ff"
                        strokeDasharray="4 4"
                        label={{
                          value: `Net-Debt-Free ${projection.crossoverCalendarYear}`,
                          position: 'insideTopRight',
                          fill: '#c3c0ff',
                          fontSize: 11,
                        }}
                      />
                    )}
                  <Area
                    type="monotone"
                    stackId="wealth"
                    dataKey="investedPrincipal"
                    name="Invested Principal"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#wfInvestedGrad)"
                  />
                  <Area
                    type="monotone"
                    stackId="wealth"
                    dataKey="wealthGained"
                    name="Compounded Gains"
                    stroke="#10B981"
                    strokeWidth={2.2}
                    fill="url(#wfGainedGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="remainingLoanPrincipal"
                    name="Remaining Loan"
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2a2a2b] flex flex-wrap items-center gap-6 text-xs text-[#94a3b8]">
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-0.5 bg-indigo-500 inline-block" />
                Invested Principal
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                Compounded Wealth Gained
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-0.5 bg-rose-500 inline-block border-b border-dashed" />
                Remaining Loan Balance
              </span>
            </div>
          </div>

          {/* Year-by-Year Breakdown Table */}
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#f8fafc]">
                  Year-by-Year Compounding Schedule
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  Annual SIP rate, invested capital, wealth gained, and net worth milestone
                </p>
              </div>
              <Sparkles className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            </div>

            <div className="overflow-x-auto max-h-[340px] overflow-y-auto border border-[#2a2a2b] rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#131315] text-[11px] font-semibold text-[#94a3b8] border-b border-[#2e2f36]">
                  <tr>
                    <th className="py-2.5 px-3">Year</th>
                    <th className="py-2.5 px-3 text-right">Monthly SIP</th>
                    <th className="py-2.5 px-3 text-right">Invested</th>
                    <th className="py-2.5 px-3 text-right">Wealth Gained</th>
                    <th className="py-2.5 px-3 text-right">Total Corpus</th>
                    <th className="py-2.5 px-3 text-right">Loan Bal.</th>
                    <th className="py-2.5 px-3 text-right">Net Worth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2b] text-xs font-mono tabular-nums">
                  {projection.yearlyBreakdown.map((row) => {
                    const isCrossover =
                      projection.crossoverYear !== null &&
                      row.year === projection.crossoverYear &&
                      row.year > 0;
                    return (
                      <tr
                        key={row.year}
                        className={`transition-colors ${
                          isCrossover
                            ? 'bg-indigo-600/15 hover:bg-indigo-600/20'
                            : 'hover:bg-[#2a2a2b]/40'
                        }`}
                      >
                        <td className="py-2 px-3 text-[#e4e2e4]">
                          {row.calendarYear}{' '}
                          <span className="text-[#64748b]">({row.label})</span>
                        </td>
                        <td className="py-2 px-3 text-right text-[#c6c6cd]">
                          {formatCurrency(row.annualSipRate, currency)}
                        </td>
                        <td className="py-2 px-3 text-right text-indigo-300">
                          {formatCompactCurrency(row.investedPrincipal, currency)}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400">
                          {formatCompactCurrency(row.wealthGained, currency)}
                        </td>
                        <td className="py-2 px-3 text-right text-[#f8fafc] font-semibold">
                          {formatCompactCurrency(row.totalCorpus, currency)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-300/90">
                          {formatCompactCurrency(row.remainingLoanPrincipal, currency)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            row.netWorthProjection >= 0
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {formatCompactCurrency(row.netWorthProjection, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
