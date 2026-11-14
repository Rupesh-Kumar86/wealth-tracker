import React, { useState } from 'react';
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
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Download,
  Layers,
  Plus,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import {
  CurrencyCode,
  LoanComparisonResult,
  LoanProfile,
  PrepaymentEntry,
  PrepaymentFrequency,
} from '../types/finance';
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonthYear,
  formatMonthsToDuration,
} from '../utils/format';
import { NumericInput } from './NumericInput';

interface LoanTrajectoryViewProps {
  currency: CurrencyCode;
  loans: LoanProfile[];
  individualResults: Array<{ loan: LoanProfile; result: LoanComparisonResult }>;
  combinedComparison: LoanComparisonResult;
  onUpdateLoans: (updated: LoanProfile[]) => void;
}

const TENURE_PRESETS_YEARS = [5, 10, 15, 20, 25, 30];

export const LoanTrajectoryView: React.FC<LoanTrajectoryViewProps> = ({
  currency,
  loans,
  individualResults,
  combinedComparison,
  onUpdateLoans,
}) => {
  // 'ALL' = combined view across all loans, or a specific loan.id
  const [selectedView, setSelectedView] = useState<string>(() =>
    loans.length > 1 ? 'ALL' : loans[0]?.id || 'ALL'
  );
  const [chartResolution, setChartResolution] = useState<'yearly' | 'monthly'>('yearly');
  const [tableResolution, setTableResolution] = useState<'monthly' | 'yearly'>('monthly');

  const [newPrepDate, setNewPrepDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [newPrepAmount, setNewPrepAmount] = useState<number>(
    currency === 'INR' ? 150000 : 5000
  );
  const [newPrepFreq, setNewPrepFreq] = useState<PrepaymentFrequency>('ONE_TIME');
  const [newPrepLabel, setNewPrepLabel] = useState<string>('');

  // Ensure selectedView stays valid if loans are added/removed
  const activeIndividual = individualResults.find(
    (item) => item.loan.id === selectedView
  );
  const isCombinedView =
    selectedView === 'ALL' || (!activeIndividual && loans.length > 0);

  const activeComparison = isCombinedView
    ? combinedComparison
    : activeIndividual!.result;
  const activeLoan = isCombinedView ? null : activeIndividual!.loan;

  const totalOriginalTaken = loans.reduce(
    (sum, l) =>
      sum +
      (l.originalPrincipal !== undefined && l.originalPrincipal > 0
        ? l.originalPrincipal
        : l.principal),
    0
  );
  const totalCurrentLeft = loans.reduce((sum, l) => sum + Math.max(0, l.principal), 0);

  const handleAddLoan = () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextIdx = loans.length + 1;
    const newLoan: LoanProfile = {
      id: `loan-${Date.now()}`,
      name: `Loan ${nextIdx}`,
      originalPrincipal: currency === 'INR' ? 1000000 : 30000,
      principal: currency === 'INR' ? 850000 : 25000,
      annualInterestRate: currency === 'INR' ? 9.5 : 6.5,
      originalTenureMonths: 60,
      startDate: today,
      actualMonthlyEmi: currency === 'INR' ? 22000 : 650,
      prepayments: [],
    };
    onUpdateLoans([...loans, newLoan]);
    setSelectedView(newLoan.id);
  };

  const handleDeleteLoan = (id: string) => {
    const remaining = loans.filter((l) => l.id !== id);
    onUpdateLoans(remaining);
    if (selectedView === id) {
      setSelectedView(remaining.length > 1 ? 'ALL' : remaining[0]?.id || 'ALL');
    }
  };

  const handleUpdateSingleLoan = (updatedLoan: LoanProfile) => {
    onUpdateLoans(
      loans.map((l) => (l.id === updatedLoan.id ? updatedLoan : l))
    );
  };

  const handleFieldChange = <K extends keyof LoanProfile>(
    key: K,
    value: LoanProfile[K]
  ) => {
    if (!activeLoan) return;
    handleUpdateSingleLoan({
      ...activeLoan,
      [key]: value,
    });
  };

  const handleAddPrepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;
    if (!Number.isFinite(newPrepAmount) || newPrepAmount <= 0 || !newPrepDate) return;

    const entry: PrepaymentEntry = {
      id: `prep-${Date.now()}`,
      date: newPrepDate,
      amount: newPrepAmount,
      frequency: newPrepFreq,
      label:
        newPrepLabel.trim() ||
        (newPrepFreq === 'ANNUAL' ? 'Annual Prepayment' : 'Lump-Sum Prepayment'),
    };

    handleUpdateSingleLoan({
      ...activeLoan,
      prepayments: [...activeLoan.prepayments, entry].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    });
    setNewPrepLabel('');
  };

  const handleDeletePrepayment = (prepId: string) => {
    if (!activeLoan) return;
    handleUpdateSingleLoan({
      ...activeLoan,
      prepayments: activeLoan.prepayments.filter((p) => p.id !== prepId),
    });
  };

  const handleExportScheduleCsv = () => {
    const headers = [
      'Month',
      'Period',
      'Phase',
      'Opening Base Left',
      'EMI Paid',
      'Interest Paid',
      'Principal Paid',
      'Prepayment',
      'Closing Base Left',
      'Baseline Remaining',
      'Cumulative Interest Saved',
    ];
    const rows = activeComparison.monthlySchedule
      .filter((pt) => pt.monthIndex > 0)
      .map((pt) => [
        pt.monthIndex,
        pt.date,
        pt.isFuture ? 'Projected' : 'Historical',
        pt.openingBalance,
        pt.emiPaid,
        pt.interestPaid,
        pt.principalPaid,
        pt.prepaymentApplied,
        pt.closingBalance,
        pt.baselineRemaining,
        Math.max(0, pt.baselineInterestCum - pt.actualInterestCum),
      ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const slug = isCombinedView
      ? 'all-loans-combined'
      : activeLoan?.name.toLowerCase().replace(/\s+/g, '-') || 'loan';
    link.download = `${slug}-payment-schedule.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData =
    chartResolution === 'yearly'
      ? activeComparison.yearlySchedule
      : activeComparison.monthlySchedule;

  const futureMonths = activeComparison.monthlySchedule.filter(
    (pt) => pt.isFuture && (pt.openingBalance > 0 || pt.emiPaid > 0)
  );
  const tableRows =
    tableResolution === 'monthly'
      ? futureMonths
      : activeComparison.yearlySchedule.filter((pt) => pt.isFuture && pt.monthIndex > 0);

  const todayChartMarker =
    chartData.find((pt) => pt.date === activeComparison.todayDateYm)?.date ||
    chartData.find((pt) => pt.monthIndex >= activeComparison.elapsedMonths)?.date;

  const displayedOriginalTaken = isCombinedView
    ? totalOriginalTaken
    : activeLoan?.originalPrincipal !== undefined
    ? activeLoan.originalPrincipal
    : activeLoan?.principal || 0;

  const displayedCurrentLeft = isCombinedView
    ? totalCurrentLeft
    : activeLoan?.principal || 0;

  const firstMonthPrincipal = Math.max(
    0,
    activeComparison.effectiveActualEmi - activeComparison.firstMonthInterest
  );

  const principalMax = currency === 'INR' ? 30000000 : 1500000;
  const principalStep = currency === 'INR' ? 50000 : 5000;
  const emiMin = Math.max(
    0,
    activeComparison.firstMonthInterest + (currency === 'INR' ? 500 : 25)
  );
  const emiMax = Math.max(
    activeComparison.standardEmi * 3,
    activeComparison.effectiveActualEmi * 1.5,
    currency === 'INR' ? 300000 : 15000
  );
  const emiStep = currency === 'INR' ? 500 : 25;

  return (
    <div className="space-y-6">
      {/* Multi-Loan Selector & Management Bar */}
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
            <span>All Loans Combined ({loans.length})</span>
          </button>

          {individualResults.map(({ loan, result }) => {
            const isSelected = !isCombinedView && selectedView === loan.id;
            return (
              <button
                key={loan.id}
                type="button"
                onClick={() => setSelectedView(loan.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#2a2a2b] text-[#f8fafc] border border-indigo-500/60'
                    : 'bg-[#131315] text-[#94a3b8] hover:text-[#e4e2e4] border border-[#2e2f36]'
                }`}
              >
                <span className="truncate max-w-[160px]">{loan.name}</span>
                <span className="font-mono tabular-nums text-[11px] text-emerald-400">
                  {formatCompactCurrency(result.currentRemainingPrincipal, currency)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAddLoan}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#2a2a2b] hover:bg-[#353436] text-[#f8fafc] border border-[#39393b] rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          Add Loan
        </button>
      </div>

      {/* Top Impact Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">
            {isCombinedView ? 'Total Taken → Total Base Left' : 'Taken → Current Base Left'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
              {formatCompactCurrency(displayedCurrentLeft, currency)}
            </span>
            <span className="text-xs font-mono tabular-nums text-[#94a3b8]">
              from {formatCompactCurrency(displayedOriginalTaken, currency)}
            </span>
          </div>
          <p
            className={`mt-1.5 text-xs tabular-nums ${
              activeComparison.aheadOfBaselineAmount >= 0
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {activeComparison.elapsedMonths === 0
              ? 'Starting this month'
              : activeComparison.aheadOfBaselineAmount >= 0
              ? `${formatCompactCurrency(
                  activeComparison.aheadOfBaselineAmount,
                  currency
                )} ahead of baseline today`
              : `${formatCompactCurrency(
                  Math.abs(activeComparison.aheadOfBaselineAmount),
                  currency
                )} behind baseline today`}
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">
            {isCombinedView ? 'Combined Fixed Monthly EMIs' : 'Fixed Monthly EMI Paid'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
              {formatCurrency(activeComparison.effectiveActualEmi, currency)}
            </span>
            <span className="text-xs font-mono tabular-nums text-[#94a3b8]">/ mo</span>
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            Next month: {formatCurrency(activeComparison.firstMonthInterest, currency)} int ·{' '}
            {formatCurrency(firstMonthPrincipal, currency)} prin
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">
            {isCombinedView ? 'All Loans Closed By' : 'Closes At Current Rate'}
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {displayedCurrentLeft <= 0
              ? 'Paid Off'
              : activeComparison.isEmiInsufficient
              ? 'Won’t Close'
              : formatMonthYear(activeComparison.actualPayoffDate)}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            {displayedCurrentLeft <= 0
              ? 'Zero remaining debt'
              : activeComparison.isEmiInsufficient
              ? 'One or more loans have EMI ≤ monthly interest'
              : `${activeComparison.futureMonthsRemaining} months left (${formatMonthsToDuration(
                  activeComparison.futureMonthsRemaining
                )})`}
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">
            Total Interest Saved vs. Baseline
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {formatCompactCurrency(activeComparison.interestSaved, currency)}
          </div>
          <p className="mt-1.5 text-xs text-indigo-300 tabular-nums">
            {formatMonthsToDuration(activeComparison.monthsSaved)} ({activeComparison.monthsSaved}{' '}
            mo) earlier than {formatMonthYear(activeComparison.baselinePayoffDate)}
          </p>
        </div>
      </section>

      {activeComparison.isEmiInsufficient && (
        <div className="bg-rose-500/10 border border-rose-500/35 rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            {isCombinedView
              ? 'One of your loans has a Fixed Monthly EMI at or below its monthly interest. Select that loan tab to increase its EMI.'
              : `Your Fixed Monthly EMI (${formatCurrency(
                  activeComparison.effectiveActualEmi,
                  currency
                )}) is at or below this month's interest (${formatCurrency(
                  activeComparison.firstMonthInterest,
                  currency
                )}). Increase your Fixed EMI to close the loan.`}
          </span>
        </div>
      )}

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Either Portfolio Summary List (Combined View) OR Single Loan Controls */}
        <div className="lg:col-span-4 space-y-6">
          {isCombinedView ? (
            <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#f8fafc]">
                    Active Loans Portfolio
                  </h2>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    Select any loan to edit its amount taken, balance left, fixed EMI, or prepayments
                  </p>
                </div>
              </div>

              {individualResults.length === 0 ? (
                <div className="p-6 border border-dashed border-[#353436] rounded-xl text-center space-y-3">
                  <p className="text-xs text-[#94a3b8]">No loans configured yet.</p>
                  <button
                    type="button"
                    onClick={handleAddLoan}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add First Loan
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {individualResults.map(({ loan, result }) => {
                    const orig =
                      loan.originalPrincipal !== undefined
                        ? loan.originalPrincipal
                        : loan.principal;
                    const paidPct =
                      orig > 0
                        ? Math.min(100, Math.max(0, ((orig - loan.principal) / orig) * 100))
                        : 0;
                    return (
                      <div
                        key={loan.id}
                        className="bg-[#131315] border border-[#2e2f36] rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-[#f8fafc]">
                              {loan.name}
                            </h3>
                            <p className="text-[11px] text-[#94a3b8] font-mono tabular-nums mt-0.5">
                              {loan.annualInterestRate}% p.a. · Taken{' '}
                              {formatMonthYear(loan.startDate.slice(0, 7))}
                            </p>
                          </div>
                          {loans.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLoan(loan.id)}
                              aria-label={`Delete ${loan.name}`}
                              className="p-1 text-[#64748b] hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[11px] text-[#64748b] block">Base Left</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCompactCurrency(loan.principal, currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#64748b] block">Fixed EMI</span>
                            <span className="font-mono tabular-nums font-semibold text-emerald-400">
                              {formatCurrency(result.effectiveActualEmi, currency)}/mo
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#64748b] block">Closes</span>
                            <span className="font-mono tabular-nums text-[#e4e2e4]">
                              {result.isEmiInsufficient
                                ? 'EMI too low'
                                : formatMonthYear(result.actualPayoffDate)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#64748b] block">
                              Interest Saved
                            </span>
                            <span className="font-mono tabular-nums text-indigo-300">
                              {formatCompactCurrency(result.interestSaved, currency)}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar from Original Taken -> Current Left */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[#94a3b8] font-mono tabular-nums">
                            <span>Paid down {paidPct.toFixed(0)}%</span>
                            <span>of {formatCompactCurrency(orig, currency)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#2a2a2b] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${paidPct}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedView(loan.id)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 rounded-lg transition-colors"
                        >
                          Edit &amp; Add Prepayments
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddLoan}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#2a2a2b] hover:bg-[#353436] text-[#f8fafc] border border-[#39393b] rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Add Another Loan
              </button>
            </div>
          ) : (
            activeLoan && (
              <>
                <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-[#f8fafc]">
                      Loan Parameters
                    </h2>
                    <div className="flex items-center gap-2">
                      {loans.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLoan(activeLoan.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 border border-rose-500/25 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                      <TrendingDown className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                        Loan Name
                      </label>
                      <input
                        type="text"
                        value={activeLoan.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-[#f8fafc] focus:outline-none"
                      />
                    </div>

                    {/* Section 1: Original Loan History */}
                    <div className="pt-3 border-t border-[#2a2a2b] space-y-3">
                      <div className="text-xs font-semibold text-[#c6c6cd]">
                        Original Loan History (For Baseline Curve)
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <label className="font-medium text-[#94a3b8]">
                            Amount Taken Originally
                          </label>
                          <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                            {formatCompactCurrency(displayedOriginalTaken, currency)}
                          </span>
                        </div>
                        <NumericInput
                          value={displayedOriginalTaken}
                          min={0}
                          allowDecimal={false}
                          onChange={(val) => handleFieldChange('originalPrincipal', val)}
                          className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                        />
                        <input
                          type="range"
                          min={0}
                          max={principalMax}
                          step={principalStep}
                          value={Math.min(principalMax, displayedOriginalTaken)}
                          onChange={(e) =>
                            handleFieldChange('originalPrincipal', Number(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                            When Taken
                          </label>
                          <input
                            type="date"
                            value={activeLoan.startDate}
                            onChange={(e) => handleFieldChange('startDate', e.target.value)}
                            className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-[#f8fafc] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                            Interest Rate (% p.a.)
                          </label>
                          <NumericInput
                            value={activeLoan.annualInterestRate}
                            min={0}
                            max={30}
                            onChange={(val) => handleFieldChange('annualInterestRate', val)}
                            className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <label className="font-medium text-[#94a3b8]">Original Tenure</label>
                          <span className="font-mono tabular-nums text-[#c6c6cd]">
                            {Math.round(activeLoan.originalTenureMonths / 12)}Y (Base EMI{' '}
                            {formatCurrency(activeComparison.standardEmi, currency)})
                          </span>
                        </div>
                        <div className="grid grid-cols-6 gap-1.5">
                          {TENURE_PRESETS_YEARS.map((yr) => {
                            const active =
                              Math.round(activeLoan.originalTenureMonths / 12) === yr;
                            return (
                              <button
                                key={yr}
                                type="button"
                                onClick={() =>
                                  handleFieldChange('originalTenureMonths', yr * 12)
                                }
                                className={`py-1 text-[11px] font-mono font-medium rounded border transition-colors ${
                                  active
                                    ? 'bg-[#2a2a2b] border-indigo-500 text-[#f8fafc]'
                                    : 'bg-[#131315] border-[#2e2f36] text-[#94a3b8] hover:text-[#e4e2e4]'
                                }`}
                              >
                                {yr}Y
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Current Balance Left & Fixed EMI */}
                    <div className="pt-3 border-t border-[#2a2a2b] space-y-4">
                      <div className="text-xs font-semibold text-[#c6c6cd]">
                        Current Balance &amp; Fixed Repayment (From Today)
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <label className="font-medium text-[#e4e2e4]">
                            Current Base Amount Left Today
                          </label>
                          <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                            {formatCompactCurrency(activeLoan.principal, currency)}
                          </span>
                        </div>
                        <NumericInput
                          value={activeLoan.principal}
                          min={0}
                          allowDecimal={false}
                          onChange={(val) => handleFieldChange('principal', val)}
                          className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                        />
                        <input
                          type="range"
                          min={0}
                          max={Math.max(principalMax, displayedOriginalTaken)}
                          step={principalStep}
                          value={Math.min(
                            Math.max(principalMax, displayedOriginalTaken),
                            activeLoan.principal
                          )}
                          onChange={(e) =>
                            handleFieldChange('principal', Number(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <label className="font-medium text-[#e4e2e4]">
                            Fixed Monthly EMI Paid
                          </label>
                          <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                            {formatCurrency(activeComparison.effectiveActualEmi, currency)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94a3b8] mb-2">
                          Stays constant every month so extra payments close the loan faster.
                        </p>
                        <NumericInput
                          value={activeLoan.actualMonthlyEmi}
                          min={0}
                          allowDecimal={false}
                          onChange={(val) => handleFieldChange('actualMonthlyEmi', val)}
                          className="w-full bg-[#131315] border border-[#353436] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                        />
                        <input
                          type="range"
                          min={emiMin}
                          max={emiMax}
                          step={emiStep}
                          value={Math.max(
                            emiMin,
                            Math.min(emiMax, activeComparison.effectiveActualEmi)
                          )}
                          onChange={(e) =>
                            handleFieldChange('actualMonthlyEmi', Number(e.target.value))
                          }
                          className="w-full"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          {[
                            { label: 'Base EMI', mult: 1 },
                            { label: '+10%', mult: 1.1 },
                            { label: '+25%', mult: 1.25 },
                            { label: '+50%', mult: 1.5 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                handleFieldChange(
                                  'actualMonthlyEmi',
                                  Math.round(activeComparison.standardEmi * preset.mult)
                                )
                              }
                              className="flex-1 py-1 text-[11px] font-medium bg-[#2a2a2b] hover:bg-[#353436] text-[#c6c6cd] rounded border border-[#39393b] transition-colors whitespace-nowrap"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prepayments Logger */}
                <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[#f8fafc]">
                      Planned Prepayments ({activeLoan.name})
                    </h2>
                    <Calendar className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                  </div>

                  <form onSubmit={handleAddPrepayment} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">Amount</label>
                        <NumericInput
                          value={newPrepAmount}
                          min={0}
                          allowDecimal={false}
                          onChange={setNewPrepAmount}
                          placeholder="Amount"
                          className="w-full bg-[#131315] border border-[#353436] rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">Date</label>
                        <input
                          type="date"
                          value={newPrepDate}
                          onChange={(e) => setNewPrepDate(e.target.value)}
                          className="w-full bg-[#131315] border border-[#353436] rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#f8fafc] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">Frequency</label>
                        <select
                          value={newPrepFreq}
                          onChange={(e) =>
                            setNewPrepFreq(e.target.value as PrepaymentFrequency)
                          }
                          className="w-full bg-[#131315] border border-[#353436] rounded-lg px-2.5 py-1.5 text-xs text-[#f8fafc] focus:outline-none focus:border-indigo-500"
                        >
                          <option value="ONE_TIME">One-Time Lump Sum</option>
                          <option value="ANNUAL">Recurring Annual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">
                          Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={newPrepLabel}
                          onChange={(e) => setNewPrepLabel(e.target.value)}
                          placeholder="e.g. Annual bonus"
                          className="w-full bg-[#131315] border border-[#353436] rounded-lg px-2.5 py-1.5 text-xs text-[#f8fafc] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Prepayment
                    </button>
                  </form>

                  <div className="pt-2 border-t border-[#2a2a2b] space-y-2 max-h-56 overflow-y-auto">
                    {activeLoan.prepayments.length === 0 ? (
                      <p className="text-xs text-[#64748b] py-2">
                        No extra prepayments scheduled for this loan.
                      </p>
                    ) : (
                      activeLoan.prepayments.map((prep) => (
                        <div
                          key={prep.id}
                          className="flex items-center justify-between gap-2 py-2 px-2.5 bg-[#131315] border border-[#2a2a2b] rounded-lg text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-[#e4e2e4] truncate">
                              {prep.label || 'Prepayment'}
                            </div>
                            <div className="text-[11px] text-[#94a3b8] font-mono tabular-nums">
                              {prep.date} ·{' '}
                              {prep.frequency === 'ANNUAL' ? 'Annual' : 'One-Time'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono tabular-nums font-semibold text-emerald-400">
                              {formatCurrency(prep.amount, currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeletePrepayment(prep.id)}
                              aria-label={`Remove ${prep.label || 'prepayment'}`}
                              className="p-1 text-[#64748b] hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )
          )}
        </div>

        {/* Right: Dual-Curve Chart & Upcoming Monthly Payment Breakdown */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-[#f8fafc]">
                  {isCombinedView
                    ? `Combined Baseline vs. Actual Trajectory (${loans.length} Loans)`
                    : `${activeLoan?.name} — Baseline vs. Actual & Projected`}
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1 tabular-nums">
                  {isCombinedView
                    ? `Total debt ${formatCompactCurrency(
                        displayedOriginalTaken,
                        currency
                      )} taken → ${formatCompactCurrency(
                        displayedCurrentLeft,
                        currency
                      )} left today → debt-free ${formatMonthYear(
                        activeComparison.actualPayoffDate
                      )}`
                    : `From ${formatMonthYear(
                        activeLoan?.startDate.slice(0, 7) || ''
                      )} (${formatCompactCurrency(
                        displayedOriginalTaken,
                        currency
                      )}) through today (${formatCompactCurrency(
                        displayedCurrentLeft,
                        currency
                      )}) to payoff`}
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#131315] border border-[#2e2f36] rounded-lg">
                <button
                  onClick={() => setChartResolution('yearly')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartResolution === 'yearly'
                      ? 'bg-[#2a2a2b] text-[#f8fafc]'
                      : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                  }`}
                >
                  Yearly Curve
                </button>
                <button
                  onClick={() => setChartResolution('monthly')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartResolution === 'monthly'
                      ? 'bg-[#2a2a2b] text-[#f8fafc]'
                      : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                  }`}
                >
                  Monthly Detail
                </button>
              </div>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 14, right: 12, left: 6, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="baseLoanGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="actLoanGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2a2a2b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(v) => String(v).slice(0, 4)}
                    minTickGap={28}
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
                      const gap = Math.max(0, pt.baselineRemaining - pt.actualRemaining);
                      return (
                        <div className="bg-[#0e0e10]/95 backdrop-blur-md border border-[#39393b] rounded-xl p-3 shadow-xl text-xs space-y-1.5">
                          <div className="font-semibold text-[#f8fafc] border-b border-[#2a2a2b] pb-1">
                            {formatMonthYear(pt.date)}{' '}
                            {pt.monthIndex === activeComparison.elapsedMonths
                              ? '(Today)'
                              : pt.isFuture
                              ? '(Projected)'
                              : '(Past)'}
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-amber-400">Supposed-to-be (Baseline)</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCurrency(pt.baselineRemaining, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-emerald-400">Actual / Projected Left</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCurrency(pt.actualRemaining, currency)}
                            </span>
                          </div>
                          {pt.isFuture && pt.emiPaid > 0 && (
                            <div className="flex items-center justify-between gap-6 text-[#c6c6cd]">
                              <span>Monthly EMI Paid</span>
                              <span className="font-mono tabular-nums">
                                {formatCurrency(pt.emiPaid, currency)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-6 pt-1 border-t border-[#2a2a2b]">
                            <span className="text-[#94a3b8]">Principal Ahead</span>
                            <span className="font-mono tabular-nums font-semibold text-indigo-300">
                              {formatCurrency(gap, currency)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {activeComparison.elapsedMonths > 0 && todayChartMarker && (
                    <ReferenceLine
                      x={todayChartMarker}
                      stroke="#c3c0ff"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Today',
                        position: 'insideTopRight',
                        fill: '#c3c0ff',
                        fontSize: 11,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="baselineRemaining"
                    name="Baseline Schedule"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    fill="url(#baseLoanGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="actualRemaining"
                    name="Actual & Projected"
                    stroke="#10B981"
                    strokeWidth={2.4}
                    fill="url(#actLoanGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Month-by-Month Payment Breakdown Table */}
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#f8fafc]">
                  {isCombinedView
                    ? 'Combined Upcoming Monthly Payments & Balance'
                    : `Upcoming Monthly Breakdown — ${activeLoan?.name}`}
                </h3>
                <p className="text-xs text-[#94a3b8] mt-0.5 tabular-nums">
                  {activeComparison.futureMonthsRemaining > 0 &&
                  !activeComparison.isEmiInsufficient
                    ? `Starting from today (${formatCompactCurrency(
                        displayedCurrentLeft,
                        currency
                      )} left) · All debt closed in ${formatMonthYear(
                        activeComparison.actualPayoffDate
                      )} (${activeComparison.futureMonthsRemaining} months)`
                    : 'Shows Opening Base Left, EMI Paid, Interest, Principal, and Closing Base Left'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#131315] border border-[#2e2f36] rounded-lg">
                  <button
                    onClick={() => setTableResolution('monthly')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      tableResolution === 'monthly'
                        ? 'bg-[#2a2a2b] text-[#f8fafc]'
                        : 'text-[#94a3b8]'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setTableResolution('yearly')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      tableResolution === 'yearly'
                        ? 'bg-[#2a2a2b] text-[#f8fafc]'
                        : 'text-[#94a3b8]'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
                <button
                  onClick={handleExportScheduleCsv}
                  disabled={activeComparison.monthlySchedule.length <= 1}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2a2a2b] hover:bg-[#353436] disabled:opacity-40 text-[#e4e2e4] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {activeComparison.futureMonthsRemaining > 0 &&
              !activeComparison.isEmiInsufficient && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {isCombinedView
                        ? `Across ${loans.length} loans (${formatCompactCurrency(
                            displayedCurrentLeft,
                            currency
                          )} left), full debt freedom is reached in `
                        : `Paying ${formatCurrency(
                            activeComparison.effectiveActualEmi,
                            currency
                          )}/mo fixed EMI closes the remaining ${formatCompactCurrency(
                            displayedCurrentLeft,
                            currency
                          )} in `}
                      <strong className="font-mono text-emerald-300">
                        {formatMonthYear(activeComparison.actualPayoffDate)}
                      </strong>{' '}
                      ({formatMonthsToDuration(activeComparison.futureMonthsRemaining)} from
                      today).
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-emerald-300 font-semibold">
                    Future Interest:{' '}
                    {formatCurrency(activeComparison.futureInterestPayable, currency)}
                  </span>
                </div>
              )}

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-[#2a2a2b] rounded-xl">
              {tableRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#94a3b8]">
                  Enter a Current Base Amount Left and Fixed Monthly EMI to view the upcoming
                  monthly breakdown.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#131315] text-[11px] font-semibold text-[#94a3b8] border-b border-[#2e2f36]">
                    <tr>
                      <th className="py-2.5 px-3">EMI #</th>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3 text-right">Opening Base Left</th>
                      <th className="py-2.5 px-3 text-right">EMI Paid</th>
                      <th className="py-2.5 px-3 text-right">Interest</th>
                      <th className="py-2.5 px-3 text-right">Principal</th>
                      <th className="py-2.5 px-3 text-right">Prepay</th>
                      <th className="py-2.5 px-3 text-right">Closing Base Left</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2b] text-xs font-mono tabular-nums">
                    {tableRows.map((row) => {
                      const isPayoffMonth = row.closingBalance === 0 && row.openingBalance > 0;
                      const upcomingIndex = Math.max(
                        1,
                        row.monthIndex - activeComparison.elapsedMonths
                      );
                      return (
                        <tr
                          key={row.monthIndex}
                          className={
                            isPayoffMonth
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/20'
                              : 'hover:bg-[#2a2a2b]/40 transition-colors'
                          }
                        >
                          <td className="py-2 px-3 text-[#94a3b8]">#{upcomingIndex}</td>
                          <td className="py-2 px-3 text-[#e4e2e4] whitespace-nowrap">
                            {formatMonthYear(row.date)}
                            {isPayoffMonth && (
                              <span className="ml-2 text-[10px] font-sans font-semibold text-emerald-300">
                                Closed
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-[#c6c6cd]">
                            {formatCurrency(row.openingBalance, currency)}
                          </td>
                          <td className="py-2 px-3 text-right text-[#f8fafc] font-semibold">
                            {formatCurrency(row.emiPaid, currency)}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-300/90">
                            {formatCurrency(row.interestPaid, currency)}
                          </td>
                          <td className="py-2 px-3 text-right text-indigo-300">
                            {formatCurrency(row.principalPaid, currency)}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-300">
                            {row.prepaymentApplied > 0
                              ? formatCurrency(row.prepaymentApplied, currency)
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                            {formatCurrency(row.closingBalance, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
