import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FolderUp,
  Landmark,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Save,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  AppState,
  CurrencyCode,
  InvestmentProfile,
  LoanProfile,
} from './types/finance';
import { getDemoState, getEmptyState } from './data/demoData';
import {
  applyRulesToTransactions,
  calculateCombinedInvestments,
  calculateCombinedLoans,
  calculateLoanComparison,
  computeAllocationAndAdvisor,
} from './utils/finance';
import { buildBackupPayload, parseImportedState } from './utils/backup';
import { formatCompactCurrency } from './utils/format';
import { ActiveTab, OverviewDashboard } from './components/OverviewDashboard';
import { LoanTrajectoryView } from './components/LoanTrajectoryView';
import { WealthForecasterView } from './components/WealthForecasterView';
import { StatementAnalyzerView } from './components/StatementAnalyzerView';

const STORAGE_KEY = 'wealthpulse_state_v1';

interface LegacyAppState extends Partial<AppState> {
  loan?: LoanProfile;
  investment?: Partial<InvestmentProfile>;
}

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LegacyAppState;
      const demo = getDemoState(parsed.currency === 'USD' ? 'USD' : 'INR');

      const migratedLoans = Array.isArray(parsed.loans)
        ? parsed.loans
        : parsed.loan
        ? [parsed.loan]
        : demo.loans;

      const migratedInvestments: InvestmentProfile[] = Array.isArray(
        parsed.investments
      )
        ? parsed.investments.map((inv, idx) => ({
            id: inv.id || `inv-${idx}`,
            name: inv.name || `Investment ${idx + 1}`,
            kind: inv.kind || 'SIP_COMPOUND',
            currentCorpus: inv.currentCorpus ?? 0,
            monthlySip: inv.monthlySip ?? 0,
            annualStepUpPercent: inv.annualStepUpPercent ?? 0,
            expectedCagrPercent: inv.expectedCagrPercent ?? 12,
          }))
        : parsed.investment
        ? [
            {
              id: 'inv-migrated',
              name: 'Primary Portfolio',
              kind: 'SIP_COMPOUND',
              currentCorpus: parsed.investment.currentCorpus ?? 0,
              monthlySip: parsed.investment.monthlySip ?? 0,
              annualStepUpPercent: parsed.investment.annualStepUpPercent ?? 0,
              expectedCagrPercent: parsed.investment.expectedCagrPercent ?? 12,
            },
          ]
        : demo.investments;

      return {
        currency: parsed.currency === 'USD' ? 'USD' : 'INR',
        monthlySalary:
          typeof parsed.monthlySalary === 'number'
            ? parsed.monthlySalary
            : demo.monthlySalary,
        loans: migratedLoans,
        investments: migratedInvestments,
        horizonYears:
          typeof parsed.horizonYears === 'number'
            ? parsed.horizonYears
            : demo.horizonYears,
        transactions: Array.isArray(parsed.transactions)
          ? parsed.transactions
          : demo.transactions,
        customRules: Array.isArray(parsed.customRules)
          ? parsed.customRules
          : demo.customRules,
        idealTargets: parsed.idealTargets
          ? { ...demo.idealTargets, ...parsed.idealTargets }
          : demo.idealTargets,
      };
    }
  } catch {
    // Fall back to demo state on corrupt storage
  }
  return getDemoState('INR');
}

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'loan', label: 'Loan Trajectory', icon: Landmark },
  { id: 'wealth', label: 'Wealth Forecaster', icon: TrendingUp },
  { id: 'statements', label: 'Statement Analyzer', icon: FileSpreadsheet },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => loadInitialState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Real-time financial calculation engines
  const { individual: individualLoanResults, combined: combinedLoanComparison } =
    useMemo(() => calculateCombinedLoans(state.loans), [state.loans]);

  const {
    individual: individualInvestmentResults,
    combined: combinedWealthProjection,
  } = useMemo(
    () =>
      calculateCombinedInvestments(
        state.investments,
        state.horizonYears,
        combinedLoanComparison
      ),
    [state.investments, state.horizonYears, combinedLoanComparison]
  );

  const advisor = useMemo(
    () =>
      computeAllocationAndAdvisor(
        state.transactions,
        state.monthlySalary,
        state.idealTargets,
        state.loans,
        state.investments,
        combinedLoanComparison
      ),
    [
      state.transactions,
      state.monthlySalary,
      state.idealTargets,
      state.loans,
      state.investments,
      combinedLoanComparison,
    ]
  );

  const handleCurrencyToggle = (currency: CurrencyCode) => {
    setState((prev) => ({ ...prev, currency }));
  };

  const handleLoadDemo = () => {
    const demo = getDemoState(state.currency);
    setState(demo);
    showToast(
      `Loaded ${state.currency} demo profile with 2 loans, 2 investments, and sample transactions.`
    );
  };

  const handleResetData = () => {
    const empty = getEmptyState(state.currency);
    setState(empty);
    showToast('Workspace cleared. All figures reset.');
  };

  const handleSaveLocally = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showToast(
        `Saved locally (${state.loans.length} loans, ${state.investments.length} investments, ${state.transactions.length} txns).`
      );
    } catch {
      showToast('Unable to write to browser storage (storage quota exceeded).');
    }
  };

  const handleExportReportJson = () => {
    const payload = buildBackupPayload(
      state,
      combinedLoanComparison,
      combinedWealthProjection,
      advisor
    );

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealthpulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported complete backup (.json) with all your saved numbers.');
  };

  const handleImportBackupFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsedJson = JSON.parse(text);
      const restoredState = parseImportedState(parsedJson);
      setState(restoredState);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restoredState));
      } catch {
        // Ignore storage quota error
      }
      showToast(
        `Restored backup: ${restoredState.loans.length} loans, ${restoredState.investments.length} investments, ${restoredState.transactions.length} txns.`
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Could not import backup file. Ensure it is a valid WealthPulse JSON file.'
      );
    }
  };

  const handleApplySurplusToEmi = (extraMonthly: number) => {
    const target =
      state.loans
        .filter((l) => l.principal > 0)
        .sort((a, b) => b.annualInterestRate - a.annualInterestRate)[0] ||
      state.loans[0];
    if (!target) return;

    const targetBaseEmi = calculateLoanComparison(target).effectiveActualEmi;
    setState((prev) => ({
      ...prev,
      loans: prev.loans.map((l) =>
        l.id === target.id
          ? { ...l, actualMonthlyEmi: Math.round(targetBaseEmi + extraMonthly) }
          : l
      ),
    }));
    showToast(
      `Boosted ${target.name} EMI by ${formatCompactCurrency(
        extraMonthly,
        state.currency
      )}.`
    );
  };

  const handleApplySurplusToSip = (extraMonthly: number) => {
    const targetSip = state.investments.find((i) => i.kind === 'SIP_COMPOUND');
    if (targetSip) {
      setState((prev) => ({
        ...prev,
        investments: prev.investments.map((inv) =>
          inv.id === targetSip.id
            ? { ...inv, monthlySip: Math.round(inv.monthlySip + extraMonthly) }
            : inv
        ),
      }));
      showToast(
        `Boosted ${targetSip.name} SIP by ${formatCompactCurrency(
          extraMonthly,
          state.currency
        )}.`
      );
    } else {
      const newSip: InvestmentProfile = {
        id: `inv-${Date.now()}`,
        name: 'Equity SIP Portfolio',
        kind: 'SIP_COMPOUND',
        currentCorpus: 0,
        monthlySip: Math.round(extraMonthly),
        annualStepUpPercent: 10,
        expectedCagrPercent: 12,
      };
      setState((prev) => ({
        ...prev,
        investments: [...prev.investments, newSip],
      }));
      showToast(
        `Created Equity SIP with ${formatCompactCurrency(
          extraMonthly,
          state.currency
        )}/mo.`
      );
    }
  };

  const activeNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#131315] text-[#e4e2e4] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#0e0e10] border-r border-[#2a2a2b] min-h-screen sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-[#2a2a2b]">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-indigo-300" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#f8fafc] whitespace-nowrap">
              WealthPulse
            </span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1f1f21] text-[#f8fafc] border border-[#353436]'
                    : 'text-[#94a3b8] hover:text-[#e4e2e4] hover:bg-[#1b1b1d] border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-[#64748b]'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#2a2a2b] space-y-2">
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportBackupFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={handleSaveLocally}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Save Numbers Locally</span>
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleExportReportJson}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-[#c6c6cd] hover:text-white bg-[#1b1b1d] hover:bg-[#2a2a2b] border border-[#2e2f36] rounded-lg transition-colors whitespace-nowrap"
              title="Download full JSON backup of all your figures"
            >
              <Download className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-[#c6c6cd] hover:text-white bg-[#1b1b1d] hover:bg-[#2a2a2b] border border-[#2e2f36] rounded-lg transition-colors whitespace-nowrap"
              title="Restore saved numbers from a previously exported JSON file"
            >
              <FolderUp className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
              <span>Import</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleLoadDemo}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#e4e2e4] bg-[#1b1b1d] hover:bg-[#2a2a2b] border border-[#2e2f36] rounded-lg transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Load Demo Data ({state.currency})</span>
          </button>
          <button
            type="button"
            onClick={handleResetData}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-300/90 hover:text-rose-200 bg-transparent hover:bg-rose-500/10 border border-[#2a2a2b] rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reset / Clear Data</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0e0e10] border-r border-[#2a2a2b] h-full flex flex-col p-4 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-[#2a2a2b]">
              <span className="text-lg font-bold text-[#f8fafc]">WealthPulse</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-[#94a3b8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-[#1f1f21] text-[#f8fafc] border border-[#353436]'
                        : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-[#2a2a2b] space-y-2">
              <button
                type="button"
                onClick={() => {
                  handleSaveLocally();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                Save Numbers Locally
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleExportReportJson();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium bg-[#1b1b1d] border border-[#2e2f36] rounded-lg"
                >
                  <Download className="w-3.5 h-3.5 text-[#94a3b8]" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => {
                    backupInputRef.current?.click();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium bg-[#1b1b1d] border border-[#2e2f36] rounded-lg"
                >
                  <FolderUp className="w-3.5 h-3.5 text-[#94a3b8]" />
                  Import
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleLoadDemo();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium bg-[#1b1b1d] border border-[#2e2f36] rounded-lg"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Load Demo Data ({state.currency})
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetData();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-300 border border-[#2a2a2b] rounded-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset / Clear Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#131315]/90 backdrop-blur-md border-b border-[#2a2a2b] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg bg-[#1b1b1d] border border-[#2e2f36] text-[#e4e2e4]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-[#64748b] hidden sm:inline">Workspace</span>
              <span className="text-[#64748b] hidden sm:inline">/</span>
              <h1 className="font-semibold text-[#f8fafc] truncate">{activeNavLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center gap-1 p-1 bg-[#1b1b1d] border border-[#2e2f36] rounded-lg"
              role="group"
              aria-label="Currency display toggle"
            >
              <button
                type="button"
                onClick={() => handleCurrencyToggle('INR')}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  state.currency === 'INR'
                    ? 'bg-[#2a2a2b] text-[#f8fafc]'
                    : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                }`}
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => handleCurrencyToggle('USD')}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  state.currency === 'USD'
                    ? 'bg-[#2a2a2b] text-[#f8fafc]'
                    : 'text-[#94a3b8] hover:text-[#e4e2e4]'
                }`}
              >
                $ USD
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('statements')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Statement</span>
              <span className="sm:hidden">Upload</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewDashboard
              state={state}
              loanComparison={combinedLoanComparison}
              wealthProjection={combinedWealthProjection}
              advisor={advisor}
              onNavigate={setActiveTab}
              onUpdateSalary={(monthlySalary) =>
                setState((prev) => ({ ...prev, monthlySalary }))
              }
              onApplySurplusToEmi={handleApplySurplusToEmi}
              onApplySurplusToSip={handleApplySurplusToSip}
            />
          )}

          {activeTab === 'loan' && (
            <LoanTrajectoryView
              currency={state.currency}
              loans={state.loans}
              individualResults={individualLoanResults}
              combinedComparison={combinedLoanComparison}
              onUpdateLoans={(loans) => setState((prev) => ({ ...prev, loans }))}
            />
          )}

          {activeTab === 'wealth' && (
            <WealthForecasterView
              currency={state.currency}
              investments={state.investments}
              individualResults={individualInvestmentResults}
              combinedProjection={combinedWealthProjection}
              horizonYears={state.horizonYears}
              loanComparison={combinedLoanComparison}
              onUpdateInvestments={(investments) =>
                setState((prev) => ({ ...prev, investments }))
              }
              onUpdateHorizon={(horizonYears) =>
                setState((prev) => ({ ...prev, horizonYears }))
              }
            />
          )}

          {activeTab === 'statements' && (
            <StatementAnalyzerView
              currency={state.currency}
              monthlySalary={state.monthlySalary}
              transactions={state.transactions}
              customRules={state.customRules}
              idealTargets={state.idealTargets}
              advisor={advisor}
              onUpdateTransactions={(transactions) =>
                setState((prev) => ({ ...prev, transactions }))
              }
              onUpdateRules={(customRules) =>
                setState((prev) => ({
                  ...prev,
                  customRules,
                  transactions: applyRulesToTransactions(
                    prev.transactions,
                    customRules
                  ),
                }))
              }
              onUpdateTargets={(idealTargets) =>
                setState((prev) => ({ ...prev, idealTargets }))
              }
              onUpdateSalary={(monthlySalary) =>
                setState((prev) => ({ ...prev, monthlySalary }))
              }
            />
          )}
        </main>
      </div>

      {/* Non-intrusive Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-[#1f1f21] border border-[#39393b] text-[#f8fafc] px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2.5"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="text-[#94a3b8] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
