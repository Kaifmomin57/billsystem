/**
 * PRD v2 Formatter Utilities
 * Single source of truth for Indian currency, date formatting, and tabular numbers.
 */

/**
 * Format currency with Indian digit grouping and symbol (₹1,25,000.00)
 */
export const formatINR = (value, showDecimals = true) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '₹0.00';
  }
  const num = Number(value);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = absNum.toLocaleString('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return `${isNegative ? '-' : ''}₹${formatted}`;
};

/**
 * Format date strictly to Indian format DD/MM/YYYY
 */
export const formatDateIN = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Format date and time strictly to DD/MM/YYYY, hh:mm A
 */
export const formatDateTimeIN = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
};

/**
 * Compact format for quantities or weights (e.g. 1,250 kg)
 */
export const formatQuantityIN = (qty, unit = '') => {
  if (qty === null || qty === undefined || isNaN(Number(qty))) {
    return `0 ${unit}`.trim();
  }
  const formatted = Number(qty).toLocaleString('en-IN', {
    maximumFractionDigits: 3,
  });
  return `${formatted}${unit ? ` ${unit}` : ''}`;
};
