const zarFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as South African Rand, e.g. R1,234.56
 */
export function formatZAR(amount) {
  const value = Number(amount) || 0;
  // Intl returns "ZAR 1,234.56" — replace the ISO code with the symbol
  return zarFormatter.format(value).replace('ZAR', 'R').replace(/\s+/, '');
}

/**
 * Format a date in South African locale (DD/MM/YYYY).
 * @param {string|Date} date
 * @param {boolean} includeTime
 */
export function formatDateZA(date, includeTime = false) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '';
  if (includeTime) {
    return d.toLocaleString('en-ZA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  return d.toLocaleDateString('en-ZA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
