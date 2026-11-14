import React, { useEffect, useState } from 'react';

interface NumericInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type'
  > {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
}

/**
 * Controlled numeric input that avoids sticky leading/trailing zeros
 * when clearing or editing numbers, while staying synced with external
 * updates (sliders, presets, demo data).
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  allowDecimal = true,
  className = '',
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState<string>(() =>
    Number.isFinite(value) ? String(value) : ''
  );

  // Sync draft with external prop changes when not actively typing
  useEffect(() => {
    if (!isFocused) {
      setDraft(Number.isFinite(value) ? String(value) : '');
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // If current value is 0, clear draft so typing immediately enters digits without "0" prefix
    if (value === 0) {
      setDraft('');
    } else {
      setDraft(String(value));
    }
    onFocus?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow empty string while typing
    if (raw === '') {
      setDraft('');
      onChange(min > 0 ? min : 0);
      return;
    }

    // Permit only valid numeric characters
    const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (!pattern.test(raw)) {
      return;
    }

    // Strip leading zeros before non-decimal digits (e.g. "0500" -> "500", keep "0.5" intact)
    const normalized = raw.replace(/^0+(?=\d)/, '');
    setDraft(normalized);

    if (normalized === '' || normalized === '.') {
      onChange(min > 0 ? min : 0);
      return;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      let clamped = parsed;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      onChange(clamped);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (draft === '' || draft === '.') {
      const fallback = min > 0 ? min : 0;
      setDraft(String(fallback));
      onChange(fallback);
    } else {
      const parsed = Number(draft);
      if (Number.isFinite(parsed)) {
        let clamped = parsed;
        if (min !== undefined && clamped < min) clamped = min;
        if (max !== undefined && clamped > max) clamped = max;
        setDraft(String(clamped));
        onChange(clamped);
      } else {
        setDraft(String(value));
      }
    }
    onBlur?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={draft}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};
