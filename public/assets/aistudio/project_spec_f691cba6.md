Project Specification: Personal Wealth, Loan Trajectory & Expense Intelligence App1. Executive SummaryA personal finance and wealth forecasting application designed to give users complete visibility into their financial trajectory. While users often know their static numbers (salary, current investments, total loan), they lack dynamic foresight into how fast they are actually closing their loans, how their wealth compounds over custom horizons, and how their monthly cash flow aligns with optimal wealth-building ratios.The app solves this by combining amortization & wealth projection engines with automated bank statement parsing and normative budget benchmarking.2. Core User Problems & SolutionsLoan Blindness: Users opt for long-tenure loans (e.g., 30 years) but make prepayments or pay higher EMIs without knowing the exact impact on tenure reduction and interest saved.Solution: Dual-curve amortization visualizer ("Baseline/Supposed-to-be" vs. "Accelerated/Actual" trajectory) calculating exact months saved and interest avoided.Investment Uncertainty: Users don't know what their current SIPs/lump-sum investments will grow into over 5, 10, or $N$ years.Solution: Interactive compound growth simulator with customizable time horizons, expected CAGR, and step-up contribution sliders.Expense Leakage & Manual Tracking: Users don't know what percentage of their salary goes to food, fuel, utilities, or EMIs without tedious manual entry.Solution: AI-powered bank statement parser (PDF/CSV) that extracts transactions, auto-categorizes them, allows instant user overrides (with rule-learning), and compares actual spending against an "Ideal Wealth Weightage" model (e.g., 50/30/20 or custom FIRE ratios).3. Functional RequirementsModule A: Dashboard & Net Worth OverviewKPI Cards: Monthly Take-Home Salary, Total Invested Corpus, Outstanding Loan Principal, Net Worth, and Monthly Savings Rate (%).Health Score / Wealth Weightage Gauge: Visual comparison of Actual Salary Allocation vs. Ideal Allocation (Needs, Wants, Debt/EMI, Investments).Module B: Loan Acceleration & Amortization VisualizerInputs:Original Loan Amount, Interest Rate (% p.a.), Original Tenure (e.g., 30 Years / 360 Months).Start Date, Standard EMI (auto-calculated).Actual EMI currently being paid (if higher than standard).Prepayment History & Future Planned Prepayments (one-time lump sums or annual extra payments).Calculations & Outputs:Graph: Multi-line area/line chart plotting Remaining Principal over time:Curve 1: Supposed-to-be Schedule (Original 30-year baseline).Curve 2: Actual / Projected Schedule (Factoring in higher EMIs + prepayments).Impact Metrics: New Debt-Free Date, Total Tenure Saved (Years & Months), Total Interest Saved.Module C: Wealth & Investment ForecasterInputs:Current Portfolio Value (Equity, Mutual Funds, FD/Debt, Gold, etc.).Monthly Investment Contribution (SIP) & Annual Step-Up (%).Expected Rate of Return (CAGR %) — with presets (Conservative 8%, Moderate 12%, Aggressive 15%).Time Horizon Selector: Quick toggles (5Y, 10Y, 15Y, 20Y) + Custom Year Slider (1 to 40 years).Calculations & Outputs:Graph: Stacked bar or area chart separating Total Principal Invested vs. Wealth Gained (Compounding) over the selected period.Crossover Milestone: Highlight the exact year when Investment Corpus > Remaining Loan Principal (Net Debt-Free Milestone).Module D: Smart Bank Statement Analyzer & CategorizerUpload & Extraction:Drag-and-drop support for Bank Statements (.csv, .xlsx, and .pdf).Extracts: Date, Merchant/Narration, Debit/Credit Amount, Transaction Type.Auto-Categorization Engine:Maps narration strings (e.g., UPI IDs, POS descriptions) to core categories:Loans & EMIs, Food & Dining, Fuel / Petrol, Utilities & Bills, Rent/Housing, Shopping & Lifestyle, Investments/SIPs, Transfers/Others.Interactive Recategorization (Human-in-the-Loop):Inline dropdown on every transaction row to change its category."Apply to all similar transactions" toggle (e.g., mapping a specific UPI merchant ID to "Petrol" updates all past and future occurrences).Allocation & Ideal Weightage Advisor:Donut/Bar chart showing actual % of salary spent per category.Side-by-side comparison with Ideal Wealth Weightage (customizable target benchmarks, e.g., Investments $\ge$ 30%, EMIs $\le$ 30%, Essentials $\le$ 25%, Lifestyle $\le$ 15%) with actionable recommendations (e.g., "Reducing Food & Lifestyle spend by ₹4,500/mo and routing it to SIPs will grow your 10-year corpus by ₹10.4L").4. Technical Architecture & Data ModelsRecommended StackFrontend: React (TypeScript), Tailwind CSS, Lucide Icons.Data Visualization: Recharts or Chart.js (responsive tooltips, dual-axis, reference lines).AI & Parsing (Google AI Studio / Gemini API):gemini-2.5-flash with Structured Outputs (JSON Schema) for parsing raw PDF/CSV bank statements and classifying transaction narrations accurately.State & Persistence: LocalStorage / IndexedDB for immediate client-side privacy (financial data stays in the browser unless exported).Core Data Schemasinterface LoanProfile {
  id: string;
  name: string; // e.g., "Home Loan"
  principal: number;
  annualInterestRate: number;
  originalTenureMonths: number;
  startDate: string;
  actualMonthlyEmi: number;
  prepayments: { date: string; amount: number }[];
}

interface InvestmentProfile {
  currentCorpus: number;
  monthlySip: number;
  annualStepUpPercent: number;
  expectedCagrPercent: number;
}

interface Transaction {
  id: string;
  date: string;
  narration: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category: ExpenseCategory;
  isManuallyEdited?: boolean;
}

type ExpenseCategory = 
  | 'Loans & EMI' 
  | 'Food & Dining' 
  | 'Petrol & Fuel' 
  | 'Utilities & Bills' 
  | 'Investments' 
  | 'Shopping & Lifestyle' 
  | 'Housing & Rent' 
  | 'Uncategorized';
5. Non-Functional RequirementsPrivacy First: Bank statements processed via API must not be logged permanently; parsed transactions are stored locally in the user's browser.Currency & Locale Agnostic (Default INR ₹ / USD $): Clean Indian numbering formatting (Lakhs/Crores) toggleable with standard Millions/Billions.Responsive & Exportable: Users can export their projected schedules and categorized expense reports as CSV/JSON.