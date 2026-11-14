import { CurrencyCode } from '../types/finance';

export function formatCurrency(
  value: number,
  currency: CurrencyCode,
  options?: { decimals?: number }
): string {
  const decimals = options?.decimals ?? 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (currency === 'INR') {
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(abs);
    return `${sign}₹${formatted}`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  return `${sign}$${formatted}`;
}

export function formatCompactCurrency(
  value: number,
  currency: CurrencyCode
): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (currency === 'INR') {
    if (abs >= 1e7) {
      return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
    }
    if (abs >= 1e5) {
      return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
    }
    if (abs >= 1e3) {
      return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
    }
    return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
  }

  if (abs >= 1e9) {
    return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(decimals)}%`;
}

export function formatMonthsToDuration(totalMonths: number): string {
  const clamped = Math.max(0, Math.round(totalMonths));
  const years = Math.floor(clamped / 12);
  const months = clamped % 12;
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}

export function formatMonthYear(yyyyMm: string): string {
  if (!yyyyMm || yyyyMm.length < 7) return yyyyMm;
  const [yStr, mStr] = yyyyMm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return yyyyMm;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function addMonthsToYm(startDateIso: string, addMonths: number): string {
  const parsed = parseYearMonth(startDateIso);
  const totalMonths = parsed.year * 12 + (parsed.month - 1) + addMonths;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseYearMonth(dateStr: string): { year: number; month: number } {
  const parts = (dateStr || '').split('-');
  const now = new Date();
  const year = Number(parts[0]) || now.getFullYear();
  const month = Math.min(12, Math.max(1, Number(parts[1]) || now.getMonth() + 1));
  return { year, month };
}
