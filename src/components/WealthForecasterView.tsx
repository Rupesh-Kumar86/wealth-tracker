import React, { useState } from 'react';
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
import {
  ArrowRight,
  Flag,
  Layers,
  PiggyBank,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  CurrencyCode,
  InvestmentKind,
  InvestmentProfile,
  LoanComparisonResult,
  WealthProjectionResult,
} from '../types/finance';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { NumericInput } from './NumericInput';

interface WealthForecasterViewProps {
  currency: CurrencyCode;
  investments: InvestmentProfile[];
  individualResults: Array<{
    investment: InvestmentProfile;
    result: WealthProjectionResult;
  }>;
  combinedProjection: WealthProjectionResult;
  horizonYears: number;
  loanComparison: LoanComparisonResult;
  onUpdateInvestments: (updated: InvestmentProfile[]) => void;
  onUpdateHorizon: (years: number) => void;
}

const HORIZON_PRESETS = [5, 10, 15, 20];
const SIP_CAGR_PRESETS = [
  { label: 'Conservative', rate: 8 },
  { label: 'Moderate', rate: 12 },
  { label: 'Aggressive', rate: 15 },
];
const SAVINGS_RATE_PRESETS = [
  { label: 'Savings 5%', rate: 5 },
  { label: '6%', rate: 6 },
  { label: 'FD 7%', rate: 7 },
  { label: 'Bond 8%', rate: 8 },
];

export const WealthForecasterView: React.FC<WealthForecasterViewProps> = ({
  currency,
  investments,
  individualResults,
  combinedProjection,
  horizonYears,
  loanComparison,
  onUpdateInvestments,
  onUpdateHorizon,
}) => {
  const [selectedView, setSelectedView] = useState<string>(() =>
    investments.length > 1 ? 'ALL' : investments[0]?.id || 'ALL'
  );

  const activeIndividual = individualResults.find(
    (item) => item.investment.id === selectedView
  );
  const isCombinedView =
    selectedView === 'ALL' || (!activeIndividual && investments.length > 0);

  const activeProjection = isCombinedView
    ? combinedProjection
    : activeIndividual!.result;
  const activeInvestment = isCombinedView ? null : activeIndividual!.investment;

  const totalCurrentCorpus = investments.reduce(
    (sum, i) => sum + Math.max(0, i.currentCorpus),
    0
  );
  const totalMonthlySip = investments.reduce(
    (sum, i) => sum + (i.kind === 'LUMPSUM_INTEREST' ? 0 : Math.max(0, i.monthlySip)),
    0
  );

  const handleAddInvestment = (kind: InvestmentKind) => {
    const count = investments.length + 1;
    const isSavings = kind === 'LUMPSUM_INTEREST';
    const newInv: InvestmentProfile = {
      id: `inv-${Date.now()}`,
      name: isSavings ? `Savings / FD ${count}` : `Investment Account ${count}`,
      kind,
      currentCorpus: currency === 'INR' ? (isSavings ? 500000 : 250000) : isSavings ? 20000 : 10000,
      monthlySip: isSavings ? 0 : currency === 'INR' ? 15000 : 500,
      annualStepUpPercent: isSavings ? 0 : 8,
      expectedCagrPercent: isSavings ? 7 : 12,
    };
    onUpdateInvestments([...investments, newInv]);
    setSelectedView(newInv.id);
  };

  const handleDeleteInvestment = (id: string) => {
    const remaining = investments.filter((i) => i.id !== id);
    onUpdateInvestments(remaining);
    if (selectedView === id) {
      setSelectedView(remaining.length > 1 ? 'ALL' : remaining[0]?.id || 'ALL');
    }
  };

  const handleUpdateSingle = (updated: InvestmentProfile) => {
    onUpdateInvestments(
      investments.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleFieldChange = <K extends keyof InvestmentProfile>(
    key: K,
    value: InvestmentProfile[K]
  ) => {
    if (!activeInvestment) return;
    handleUpdateSingle({
      ...activeInvestment,
      [key]: value,
    });
  };

  const handleKindChange = (newKind: InvestmentKind) => {
    if (!activeInvestment || activeInvestment.kind === newKind) return;
    if (newKind === 'LUMPSUM_INTEREST') {
      handleUpdateSingle({
        ...activeInvestment,
        kind: 'LUMPSUM_INTEREST',
        monthlySip: 0,
        annualStepUpPercent: 0,
        expectedCagrPercent:
          activeInvestment.expectedCagrPercent > 9
            ? 7
            : activeInvestment.expectedCagrPercent,
      });
    } else {
      handleUpdateSingle({
        ...activeInvestment,
        kind: 'SIP_COMPOUND',
        monthlySip:
          activeInvestment.monthlySip > 0
            ? activeInvestment.monthlySip
            : currency === 'INR'
            ? 15000
            : 500,
        expectedCagrPercent:
          activeInvestment.expectedCagrPercent <= 8
            ? 12
            : activeInvestment.expectedCagrPercent,
      });
    }
  };

  const displayedCorpusNow = isCombinedView
    ? totalCurrentCorpus
    : activeInvestment?.currentCorpus || 0;

  const multiplier =
    activeProjection.totalInvested > 0
      ? activeProjection.finalCorpus / activeProjection.totalInvested
      : 1;

  const corpusMax = currency === 'INR' ? 20000000 : 1000000;
  const corpusStep = currency === 'INR' ? 50000 : 5000;
  const sipMax = currency === 'INR' ? 300000 : 15000;
  const sipStep = currency === 'INR' ? 1000 : 100;

  return (
    <div className="space-y-6">
      {/* Multi-Investment Selector & Add Bar */}
      <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedView('ALL')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
              isCombinedView
                ? 'bg-indigo-600 text-white'
                : 'bg-[#131315] text-[#c6c6cd] hover:text-white border border-[#2e2f36]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Accounts Combined ({investments.length})</span>
          </button>

          {individualResults.map(({ investment }) => {
            const isSelected = !isCombinedView && selectedView === investment.id;
            return (
              <button
                key={investment.id}
                type="button"
                onClick={() => setSelectedView(investment.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#2a2a2b] text-[#f8fafc] border border-indigo-500/60'
                    : 'bg-[#131315] text-[#94a3b8] hover:text-[#e4e2e4] border border-[#2e2f36]'
                }`}
              >
                <span className="truncate max-w-[160px]">{investment.name}</span>
                <span className="font-mono tabular-nums text-[11px] text-emerald-400">
                  {formatCompactCurrency(investment.currentCorpus, currency)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleAddInvestment('LUMPSUM_INTEREST')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#2a2a2b] hover:bg-[#353436] text-[#f8fafc] border border-[#39393b] rounded-xl transition-colors whitespace-nowrap"
          >
            <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
            + Savings (5–7%)
          </button>
          <button
            type="button"
            onClick={() => handleAddInvestment('SIP_COMPOUND')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#2a2a2b] hover:bg-[#353436] text-[#f8fafc] border border-[#39393b] rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            + SIP Investment
          </button>
        </div>
      </div>

      {/* Top Milestone Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">
            {isCombinedView ? `Combined Value (${horizonYears}Y)` : `Projected Value (${horizonYears}Y)`}
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {formatCompactCurrency(activeProjection.finalCorpus, currency)}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            From {formatCompactCurrency(displayedCorpusNow, currency)} starting base
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Principal Invested</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
            {formatCompactCurrency(activeProjection.totalInvested, currency)}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            {isCombinedView
              ? `${formatCurrency(totalMonthlySip, currency)}/mo active SIP total`
              : activeInvestment?.kind === 'LUMPSUM_INTEREST'
              ? 'One-time lumpsum (no recurring SIP)'
              : activeInvestment && activeInvestment.annualStepUpPercent > 0
              ? `Includes ${activeInvestment.annualStepUpPercent}%/yr SIP step-up`
              : 'Fixed monthly SIP contribution'}
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">
            Interest &amp; Compounded Gains
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-indigo-300">
            {formatCompactCurrency(activeProjection.totalWealthGained, currency)}
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
              : activeProjection.alreadyNetDebtFree
              ? 'Achieved Now'
              : activeProjection.crossoverCalendarYear
              ? `${activeProjection.crossoverCalendarYear} (Yr ${activeProjection.crossoverYear})`
              : 'Beyond 40Y'}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            When {isCombinedView ? 'Combined Corpus' : 'Account Value'} ≥ Remaining Debt
          </p>
        </div>
      </section>

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Combined Portfolio List OR Single Account Controls */}
        <div className="lg:col-span-4 space-y-6">
          {isCombinedView ? (
            <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-[#f8fafc]">
                  Active Investments &amp; Savings
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Mix SIP growth funds and 5%–7% lumpsum savings accounts in one forecast
                </p>
              </div>

              {individualResults.length === 0 ? (
                <div className="p-6 border border-dashed border-[#353436] rounded-xl text-center space-y-3">
                  <p className="text-xs text-[#94a3b8]">No investments or savings added yet.</p>
                  <button
                    type="button"
                    onClick={() => handleAddInvestment('LUMPSUM_INTEREST')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Savings / Investment
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {individualResults.map(({ investment, result }) => {
                    const isLumpsum = investment.kind === 'LUMPSUM_INTEREST';
                    return (
                      <div
                        key={investment.id}
                        className="bg-[#131315] border border-[#2e2f36] rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-[#f8fafc]">
                              {investment.name}
                            </h3>
                            <p className="text-[11px] text-[#94a3b8] mt-0.5">
                              {isLumpsum
                                ? `Lumpsum Savings · ${investment.expectedCagrPercent}% p.a. interest`
                                : `SIP Growth · ${investment.expectedCagrPercent}% CAGR`}
                            </p>
                          </div>
                          {investments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteInvestment(investment.id)}
                              aria-label={`Delete ${investment.name}`}
                              className="p-1 text-[#64748b] hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[11px] text-[#64748b] block">
                              {isLumpsum ? 'Lumpsum Base' : 'Current Corpus'}
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCompactCurrency(investment.currentCorpus, currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#64748b] block">
                              {isLumpsum ? 'Interest Earned' : 'Monthly SIP'}
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-indigo-300">
                              {isLumpsum
                                ? `+${formatCompactCurrency(result.totalWealthGained, currency)}`
                                : `${formatCurrency(investment.monthlySip, currency)}/mo`}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#64748b] block">
                              {horizonYears}Y Projected Value
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-emerald-400">
                              {formatCompactCurrency(result.finalCorpus, currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#64748b] block">Rate</span>
                            <span className="font-mono tabular-nums text-[#e4e2e4]">
                              {investment.expectedCagrPercent}% p.a.
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedView(investment.id)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 rounded-lg transition-colors"
                        >
                          Edit Account Parameters
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shared Time Horizon Control in Combined View */}
              <div className="pt-4 border-t border-[#2a2a2b]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <label className="font-medium text-[#94a3b8]">Forecast Horizon</label>
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
              </div>
            </div>
          ) : (
            activeInvestment && (
              <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#f8fafc]">
                    Account Parameters
                  </h2>
                  <div className="flex items-center gap-2">
                    {investments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteInvestment(activeInvestment.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 border border-rose-500/25 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                    <TrendingUp className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={activeInvestment.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-[#f8fafc] focus:outline-none"
                    />
                  </div>

                  {/* Type Toggle: SIP & Market Growth vs Savings / FD Lumpsum */}
                  <div>
                    <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                      Account Type
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#131315] border border-[#2e2f36] rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleKindChange('SIP_COMPOUND')}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors ${
                          activeInvestment.kind === 'SIP_COMPOUND'
                            ? 'bg-[#2a2a2b] text-[#f8fafc]'
                            : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                        }`}
                      >
                        SIP &amp; Growth
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKindChange('LUMPSUM_INTEREST')}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors ${
                          activeInvestment.kind === 'LUMPSUM_INTEREST'
                            ? 'bg-[#2a2a2b] text-emerald-300'
                            : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                        }`}
                      >
                        Lumpsum Savings
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <label className="font-medium text-[#94a3b8]">
                        {activeInvestment.kind === 'LUMPSUM_INTEREST'
                          ? 'Lumpsum Savings Amount'
                          : 'Current Portfolio Value'}
                      </label>
                      <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                        {formatCompactCurrency(activeInvestment.currentCorpus, currency)}
                      </span>
                    </div>
                    <NumericInput
                      value={activeInvestment.currentCorpus}
                      min={0}
                      allowDecimal={false}
                      onChange={(val) => handleFieldChange('currentCorpus', val)}
                      className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                    />
                    <input
                      type="range"
                      min={0}
                      max={corpusMax}
                      step={corpusStep}
                      value={Math.min(corpusMax, activeInvestment.currentCorpus)}
                      onChange={(e) =>
                        handleFieldChange('currentCorpus', Number(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>

                  {activeInvestment.kind === 'SIP_COMPOUND' && (
                    <>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <label className="font-medium text-[#94a3b8]">
                            Monthly SIP Contribution
                          </label>
                          <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                            {formatCurrency(activeInvestment.monthlySip, currency)}/mo
                          </span>
                        </div>
                        <NumericInput
                          value={activeInvestment.monthlySip}
                          min={0}
                          allowDecimal={false}
                          onChange={(val) => handleFieldChange('monthlySip', val)}
                          className="w-full bg-[#131315] border border-[#353436] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                        />
                        <input
                          type="range"
                          min={0}
                          max={sipMax}
                          step={sipStep}
                          value={Math.min(sipMax, activeInvestment.monthlySip)}
                          onChange={(e) =>
                            handleFieldChange('monthlySip', Number(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <label className="font-medium text-[#94a3b8]">
                            Annual SIP Step-Up (%)
                          </label>
                          <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                            {activeInvestment.annualStepUpPercent}% / yr
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={25}
                          step={1}
                          value={activeInvestment.annualStepUpPercent}
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
                    </>
                  )}

                  {/* Expected Rate / Interest Rate */}
                  <div className="pt-2 border-t border-[#2a2a2b]">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <label className="font-medium text-[#94a3b8]">
                        {activeInvestment.kind === 'LUMPSUM_INTEREST'
                          ? 'Annual Interest Rate (% p.a.)'
                          : 'Expected Return (CAGR %)'}
                      </label>
                      <span className="font-mono tabular-nums text-indigo-300 font-semibold">
                        {activeInvestment.expectedCagrPercent}% p.a.
                      </span>
                    </div>

                    {activeInvestment.kind === 'LUMPSUM_INTEREST' ? (
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {SAVINGS_RATE_PRESETS.map((preset) => {
                          const active =
                            activeInvestment.expectedCagrPercent === preset.rate;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                handleFieldChange('expectedCagrPercent', preset.rate)
                              }
                              className={`py-1.5 px-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap ${
                                active
                                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                                  : 'bg-[#131315] border-[#2e2f36] text-[#94a3b8] hover:text-[#e4e2e4]'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {SIP_CAGR_PRESETS.map((preset) => {
                          const active =
                            activeInvestment.expectedCagrPercent === preset.rate;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                handleFieldChange('expectedCagrPercent', preset.rate)
                              }
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
                    )}

                    <NumericInput
                      value={activeInvestment.expectedCagrPercent}
                      min={0}
                      max={30}
                      onChange={(val) => handleFieldChange('expectedCagrPercent', val)}
                      className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                    />
                    <input
                      type="range"
                      min={1}
                      max={activeInvestment.kind === 'LUMPSUM_INTEREST' ? 12 : 24}
                      step={0.25}
                      value={Math.min(
                        activeInvestment.kind === 'LUMPSUM_INTEREST' ? 12 : 24,
                        Math.max(1, activeInvestment.expectedCagrPercent)
                      )}
                      onChange={(e) =>
                        handleFieldChange('expectedCagrPercent', Number(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Time Horizon */}
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
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Right: Stacked Principal vs Gains + Loan Crossover Chart & Table */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-[#f8fafc]">
                  {isCombinedView
                    ? `Combined Wealth & Savings Growth (${investments.length} Accounts)`
                    : `${activeInvestment?.name} — Principal vs. ${
                        activeInvestment?.kind === 'LUMPSUM_INTEREST'
                          ? 'Interest Earned'
                          : 'Compounding Gains'
                      }`}
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Stacked accumulation overlaid with your remaining combined loan balance
                </p>
              </div>
              {activeProjection.crossoverCalendarYear &&
                !activeProjection.alreadyNetDebtFree &&
                loanComparison.currentRemainingPrincipal > 0 && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
                    <Flag className="w-3.5 h-3.5" />
                    <span>
                      Crossover in {activeProjection.crossoverCalendarYear} (Year{' '}
                      {activeProjection.crossoverYear})
                    </span>
                  </div>
                )}
            </div>

            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={activeProjection.yearlyBreakdown}
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
                            <span className="text-emerald-400">Interest / Wealth Gained</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCurrency(pt.wealthGained, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6 pt-1 border-t border-[#2a2a2b]">
                            <span className="text-[#f8fafc] font-semibold">Total Value</span>
                            <span className="font-mono tabular-nums font-bold text-emerald-400">
                              {formatCurrency(pt.totalCorpus, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-rose-400">Remaining Debt</span>
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
                  {activeProjection.crossoverCalendarYear &&
                    activeProjection.crossoverYear !== null &&
                    activeProjection.crossoverYear > 0 &&
                    activeProjection.crossoverYear <= horizonYears && (
                      <ReferenceLine
                        x={activeProjection.crossoverCalendarYear}
                        stroke="#c3c0ff"
                        strokeDasharray="4 4"
                        label={{
                          value: `Net-Debt-Free ${activeProjection.crossoverCalendarYear}`,
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
                    name="Interest & Gains"
                    stroke="#10B981"
                    strokeWidth={2.2}
                    fill="url(#wfGainedGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="remainingLoanPrincipal"
                    name="Remaining Debt"
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
                Principal Base
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                Interest &amp; Compounding Gains
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
                  Year-by-Year Compounding &amp; Interest Schedule
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  Annual SIP rate, principal base, interest/gains earned, and net worth milestone
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
                    <th className="py-2.5 px-3 text-right">Interest / Gains</th>
                    <th className="py-2.5 px-3 text-right">Total Value</th>
                    <th className="py-2.5 px-3 text-right">Debt Bal.</th>
                    <th className="py-2.5 px-3 text-right">Net Worth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2b] text-xs font-mono tabular-nums">
                  {activeProjection.yearlyBreakdown.map((row) => {
                    const isCrossover =
                      activeProjection.crossoverYear !== null &&
                      row.year === activeProjection.crossoverYear &&
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
                          {row.annualSipRate > 0
                            ? formatCurrency(row.annualSipRate, currency)
                            : '—'}
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
