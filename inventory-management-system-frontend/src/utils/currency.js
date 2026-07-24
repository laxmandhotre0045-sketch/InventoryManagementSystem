/**
 * Single source of truth for money formatting.
 *
 * All monetary values from the API (unit price, purchase totals, stock value)
 * are plain numbers; the backend declares the ISO code via
 * dashboard summary -> currencyCode. Formatting lives here so switching
 * currency is a one-line change instead of a hunt through pages.
 *
 * en-IN grouping is used, so values read the Indian way:
 *   1234567.5  ->  ₹12,34,567.50
 */
export const CURRENCY_CODE = 'INR';
export const CURRENCY_LOCALE = 'en-IN';
export const CURRENCY_SYMBOL = '₹';

const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Full currency string, e.g. ₹12,34,567.50 */
export const formatCurrency = (value) => formatter.format(Number(value || 0));

/** Number only with Indian grouping (no symbol), e.g. 12,34,567.50 */
export const formatAmount = (value) =>
  new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default formatCurrency;
