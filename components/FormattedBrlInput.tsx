import React, { useState } from 'react';

interface FormattedBrlInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  decimals?: number;
  emptyWhenZero?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function formatBrlDecimal(value: number, decimals = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function parseBrlInput(raw: string): number {
  const trimmed = raw.replace(/R\$/g, '').replace(/\s+/g, '').trim();
  if (!trimmed || trimmed === ',' || trimmed === '.') return 0;

  let normalized = trimmed;
  if (normalized.includes(',')) {
    // Em pt-BR, pontos são separadores de milhar quando há vírgula decimal
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    const dotParts = normalized.split('.');
    if (dotParts.length > 2) {
      normalized = dotParts.join('');
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toEditableString(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  const rounded = Number(value.toFixed(decimals));
  return String(rounded).replace('.', ',');
}

export const FormattedBrlInput: React.FC<FormattedBrlInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  min = 0,
  max,
  decimals = 2,
  emptyWhenZero = false,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  onFocus,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const clampValue = (num: number): number => {
    let safe = Number.isFinite(num) ? num : 0;
    if (min !== undefined) safe = Math.max(min, safe);
    if (max !== undefined) safe = Math.min(max, safe);
    const factor = Math.pow(10, decimals);
    return Math.round(safe * factor) / factor;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setDraft(toEditableString(value, decimals));
    onFocus?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Permite apenas dígitos, vírgula e ponto (e sinal negativo se min < 0)
    const sanitized =
      min !== undefined && min < 0
        ? raw.replace(/[^\d.,-]/g, '')
        : raw.replace(/[^\d.,]/g, '');
    setDraft(sanitized);
    if (!sanitized.trim()) {
      onChange(clampValue(0));
      return;
    }
    const parsed = parseBrlInput(sanitized);
    onChange(clampValue(parsed));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const finalNum = draft.trim() ? clampValue(parseBrlInput(draft)) : clampValue(0);
    onChange(finalNum);
    onBlur?.(e);
  };

  const displayValue = isFocused
    ? draft
    : emptyWhenZero && (!value || value === 0)
    ? ''
    : formatBrlDecimal(value, decimals);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      value={displayValue}
      placeholder={placeholder}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`compact-select ${className}`}
    />
  );
};
