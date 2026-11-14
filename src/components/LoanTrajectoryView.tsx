import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Plus, Trash2, Calendar, TrendingDown } from 'lucide-react';
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

interface LoanTrajectoryViewProps {
  currency: CurrencyCode;
  loan: LoanProfile;
  comparison: LoanComparisonResult;
  onUpdateLoan: (updated: LoanProfile) => void;
}

export const LoanTrajectoryView: React.FC<LoanTrajectoryViewProps> = ({
  currency,
  loan,
  comparison,
  onUpdateLoan,
}) => {
  const [chartResolution, setChartResolution] = useState<'yearly' | 'monthly'>('yearly');
  const [tableResolution, setTableResolution] = useState<'yearly' | 'monthly'>('yearly');

  const [newPrepDate, setNewPrepDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [newPrepAmount, setNewPrepAmount] = useState<string>(
    currency === 'INR' ? '150000' : '5000'
  );
  const [newPrepFreq, setNewPrepFreq] = useState<PrepaymentFrequency>('ONE_TIME');
  const [newPrepLabel, setNewPrepLabel] = useState<string>('');

  const handleFieldChange = <K extends keyof LoanProfile>(
    key: K,
    value: LoanProfile[K]
  ) => {
    onUpdateLoan({
      ...loan,
      [key]: value,
    });
  };

  const handleAddPrepayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(newPrepAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !newPrepDate) return;

    const entry: PrepaymentEntry = {
      id: `prep-${Date.now()}`,
      date: newPrepDate,
      amount,
      frequency: newPrepFreq,
      label:
        newPrepLabel.trim() ||
        (newPrepFreq === 'ANNUAL' ? 'Annual Prepayment' : 'Lump-Sum Prepayment'),
    };

    onUpdateLoan({
      ...loan,
      prepayments: [...loan.prepayments, entry].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    });
    setNewPrepLabel('');
  };

  const handleDeletePrepayment = (id: string) => {
    onUpdateLoan({
      ...loan,
      prepayments: loan.prepayments.filter((p) => p.id !== id),
    });
  };

  const handleExportScheduleCsv = () => {
    const headers = [
      'Month',
      'Date',
      'Baseline Remaining',
      'Accelerated Remaining',
      'Principal Paid',
      'Interest Paid',
      'Prepayment Applied',
      'Cumulative Interest Saved',
    ];
    const rows = comparison.monthlySchedule.map((pt) => [
      pt.monthIndex,
      pt.date,
      pt.baselineRemaining,
      pt.actualRemaining,
      pt.principalPaid,
      pt.interestPaid,
      pt.prepaymentApplied,
      Math.max(0, pt.baselineInterestCum - pt.actualInterestCum),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${loan.name.toLowerCase().replace(/\s+/g, '-')}-amortization.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData =
    chartResolution === 'yearly'
      ? comparison.yearlySchedule
      : comparison.monthlySchedule;
  const tableRows =
    tableResolution === 'yearly'
      ? comparison.yearlySchedule
      : comparison.monthlySchedule;

  const principalMax = currency === 'INR' ? 30000000 : 1500000;
  const principalStep = currency === 'INR' ? 100000 : 10000;
  const emiMax = Math.max(
    comparison.standardEmi * 3,
    currency === 'INR' ? 300000 : 15000
  );
  const emiStep = currency === 'INR' ? 1000 : 50;

  return (
    <div className="space-y-6">
      {/* Top Impact Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Standard vs. Actual EMI</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
              {formatCurrency(comparison.effectiveActualEmi, currency)}
            </span>
            <span className="text-xs font-mono tabular-nums text-[#94a3b8]">
              / {formatCurrency(comparison.standardEmi, currency)} base
            </span>
          </div>
          <p className="mt-1.5 text-xs text-emerald-400 tabular-nums">
            +{formatCurrency(
              Math.max(0, comparison.effectiveActualEmi - comparison.standardEmi),
              currency
            )}
            /mo extra principal reduction
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Accelerated Debt-Free Date</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {loan.principal > 0 ? formatMonthYear(comparison.actualPayoffDate) : '—'}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            Baseline: {loan.principal > 0 ? formatMonthYear(comparison.baselinePayoffDate) : '—'}
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Total Tenure Saved</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#f8fafc]">
            {formatMonthsToDuration(comparison.monthsSaved)}
          </div>
          <p className="mt-1.5 text-xs text-indigo-300 tabular-nums">
            {comparison.monthsSaved} months closed early · {comparison.actualMonths} mo total
          </p>
        </div>

        <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-5">
          <span className="text-xs font-medium text-[#94a3b8]">Total Interest Saved</span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {formatCompactCurrency(comparison.interestSaved, currency)}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8] tabular-nums">
            Interest reduced from {formatCompactCurrency(comparison.baselineTotalInterest, currency)} to{' '}
            {formatCompactCurrency(comparison.actualTotalInterest, currency)}
          </p>
        </div>
      </section>

      {/* Main Split: Controls + Dual-Curve Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#f8fafc]">Loan Parameters</h2>
              <TrendingDown className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                  Loan Label
                </label>
                <input
                  type="text"
                  value={loan.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-[#f8fafc] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="font-medium text-[#94a3b8]">Original Loan Principal</label>
                  <span className="font-mono tabular-nums text-[#f8fafc] font-semibold">
                    {formatCompactCurrency(loan.principal, currency)}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={principalStep}
                  value={loan.principal}
                  onChange={(e) =>
                    handleFieldChange('principal', Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                />
                <input
                  type="range"
                  min={0}
                  max={principalMax}
                  step={principalStep}
                  value={Math.min(principalMax, loan.principal)}
                  onChange={(e) => handleFieldChange('principal', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    step={0.05}
                    value={loan.annualInterestRate}
                    onChange={(e) =>
                      handleFieldChange(
                        'annualInterestRate',
                        Math.min(30, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                    className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                    Original Tenure (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={Math.round(loan.originalTenureMonths / 12)}
                    onChange={(e) =>
                      handleFieldChange(
                        'originalTenureMonths',
                        Math.min(480, Math.max(12, (Number(e.target.value) || 1) * 12))
                      )
                    }
                    className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                  Loan Start Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={loan.startDate}
                    onChange={(e) => handleFieldChange('startDate', e.target.value)}
                    className="w-full bg-[#131315] border border-[#353436] focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#2a2a2b]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="font-medium text-[#e4e2e4]">Actual Monthly EMI Paid</label>
                  <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                    {formatCurrency(comparison.effectiveActualEmi, currency)}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={emiStep}
                  value={loan.actualMonthlyEmi}
                  onChange={(e) =>
                    handleFieldChange(
                      'actualMonthlyEmi',
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                  className="w-full bg-[#131315] border border-[#353436] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#f8fafc] focus:outline-none mb-2"
                />
                <input
                  type="range"
                  min={comparison.standardEmi}
                  max={emiMax}
                  step={emiStep}
                  value={Math.max(comparison.standardEmi, Math.min(emiMax, loan.actualMonthlyEmi))}
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
                          Math.round(comparison.standardEmi * preset.mult)
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

          {/* Prepayments Logger */}
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#f8fafc]">
                Lump-Sum &amp; Annual Prepayments
              </h2>
              <Calendar className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            </div>

            <form onSubmit={handleAddPrepayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[#94a3b8] mb-1">Amount</label>
                  <input
                    type="number"
                    min={1}
                    value={newPrepAmount}
                    onChange={(e) => setNewPrepAmount(e.target.value)}
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
                    onChange={(e) => setNewPrepFreq(e.target.value as PrepaymentFrequency)}
                    className="w-full bg-[#131315] border border-[#353436] rounded-lg px-2.5 py-1.5 text-xs text-[#f8fafc] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ONE_TIME">One-Time Lump Sum</option>
                    <option value="ANNUAL">Recurring Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#94a3b8] mb-1">Note (Optional)</label>
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
                Add Prepayment to Schedule
              </button>
            </form>

            <div className="pt-2 border-t border-[#2a2a2b] space-y-2 max-h-60 overflow-y-auto">
              {loan.prepayments.length === 0 ? (
                <p className="text-xs text-[#64748b] py-2">
                  No prepayments logged yet. Add a lump sum or recurring annual prepayment above.
                </p>
              ) : (
                loan.prepayments.map((prep) => (
                  <div
                    key={prep.id}
                    className="flex items-center justify-between gap-2 py-2 px-2.5 bg-[#131315] border border-[#2a2a2b] rounded-lg text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[#e4e2e4] truncate">
                        {prep.label || 'Prepayment'}
                      </div>
                      <div className="text-[11px] text-[#94a3b8] font-mono tabular-nums">
                        {prep.date} · {prep.frequency === 'ANNUAL' ? 'Annual' : 'One-Time'}
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
        </div>

        {/* Right: Dual-Curve Chart & Amortization Table */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-[#f8fafc]">
                  Baseline vs. Accelerated Loan Trajectory
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1 tabular-nums">
                  Total prepayments applied: {formatCurrency(comparison.totalPrepaid, currency)}
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

            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="baseLoanGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.22} />
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
                      const savedInterest = Math.max(
                        0,
                        pt.baselineInterestCum - pt.actualInterestCum
                      );
                      return (
                        <div className="bg-[#0e0e10]/95 backdrop-blur-md border border-[#39393b] rounded-xl p-3 shadow-xl text-xs space-y-1.5">
                          <div className="font-semibold text-[#f8fafc] border-b border-[#2a2a2b] pb-1">
                            Month {pt.monthIndex} · {formatMonthYear(pt.date)}
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-amber-400">Supposed-to-be (Baseline)</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCurrency(pt.baselineRemaining, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-emerald-400">Actual / Accelerated</span>
                            <span className="font-mono tabular-nums font-semibold text-[#f8fafc]">
                              {formatCurrency(pt.actualRemaining, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6 pt-1 border-t border-[#2a2a2b]">
                            <span className="text-[#94a3b8]">Principal Gap Closed</span>
                            <span className="font-mono tabular-nums font-semibold text-indigo-300">
                              {formatCurrency(
                                Math.max(0, pt.baselineRemaining - pt.actualRemaining),
                                currency
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-[#94a3b8]">Cumulative Interest Saved</span>
                            <span className="font-mono tabular-nums font-semibold text-emerald-400">
                              {formatCurrency(savedInterest, currency)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
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
                    name="Accelerated Schedule"
                    stroke="#10B981"
                    strokeWidth={2.4}
                    fill="url(#actLoanGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Amortization Schedule Table */}
          <div className="bg-[#1b1b1d] border border-[#2e2f36] rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#f8fafc]">
                  Amortization Schedule Ledger
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  Showing {tableRows.length} milestones from {formatMonthYear(loan.startDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#131315] border border-[#2e2f36] rounded-lg">
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
                </div>
                <button
                  onClick={handleExportScheduleCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2a2a2b] hover:bg-[#353436] text-[#e4e2e4] border border-[#39393b] rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[340px] overflow-y-auto border border-[#2a2a2b] rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#131315] text-[11px] font-semibold text-[#94a3b8] border-b border-[#2e2f36]">
                  <tr>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-right">Baseline Bal.</th>
                    <th className="py-2.5 px-3 text-right">Actual Bal.</th>
                    <th className="py-2.5 px-3 text-right">Prepayment</th>
                    <th className="py-2.5 px-3 text-right">Interest Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2b] text-xs font-mono tabular-nums">
                  {tableRows.map((row) => (
                    <tr
                      key={row.monthIndex}
                      className="hover:bg-[#2a2a2b]/40 transition-colors"
                    >
                      <td className="py-2 px-3 text-[#94a3b8]">M{row.monthIndex}</td>
                      <td className="py-2 px-3 text-[#e4e2e4]">{formatMonthYear(row.date)}</td>
                      <td className="py-2 px-3 text-right text-amber-300/90">
                        {formatCurrency(row.baselineRemaining, currency)}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                        {formatCurrency(row.actualRemaining, currency)}
                      </td>
                      <td className="py-2 px-3 text-right text-[#c6c6cd]">
                        {row.prepaymentApplied > 0
                          ? formatCurrency(row.prepaymentApplied, currency)
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-indigo-300">
                        {formatCurrency(
                          Math.max(0, row.baselineInterestCum - row.actualInterestCum),
                          currency
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
