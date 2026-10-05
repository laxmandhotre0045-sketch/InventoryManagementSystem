// Ordering for component Values ("10kΩ", "100nF", "16MHz", "5.1V Zener", "LM358").
//
// A plain text sort — even a "numeric" one — puts 10kΩ before 100Ω, because it compares
// the digits 10 and 100 and never looks at the k. Electronics values only read in
// ascending order once the SI prefix is applied: 100Ω < 2.2kΩ < 10kΩ, 470pF < 1nF < 1µF.

const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
const UNIT = '(Ω|ohms?|F|H|Hz|V|A|W)';

// A number, an optional prefix, a unit, then optionally descriptive words ("5.1V Zener").
// The unit is required, so part numbers that merely start with a digit (1N4007, 2N7000)
// are not mistaken for quantities and fall through to the text ordering.
const QUANTITY = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*([pnuµμmkKMG])?${UNIT}(?:\\s+.*)?$`, 'i');

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Magnitude and unit of a value like "2.2kΩ", or null when it isn't a quantity. */
export const parseQuantity = (value) => {
  const m = QUANTITY.exec(String(value || '').trim());
  if (!m) return null;
  // "m" is milli, "M" is mega: the prefix is matched case-sensitively even though the
  // unit isn't, so mΩ and MΩ stay apart.
  const prefix = m[2] ? PREFIX[m[2]] ?? 1 : 1;
  const unit = m[3].toLowerCase().startsWith('ohm') ? 'Ω' : m[3].toLowerCase();
  return { magnitude: parseFloat(m[1]) * prefix, unit };
};

/**
 * Compares two values for ascending display. Quantities come first, smallest to largest
 * (grouped by unit if a type ever mixes them); then text values such as part numbers, in
 * natural order (LM317 before LM2596); then `lastLabel` (e.g. "Unspecified value") at the end.
 */
export const compareValues = (a, b, lastLabel) => {
  if (a === b) return 0;
  if (lastLabel != null) {
    if (a === lastLabel) return 1;
    if (b === lastLabel) return -1;
  }
  const qa = parseQuantity(a);
  const qb = parseQuantity(b);
  if (qa && qb) {
    if (qa.unit !== qb.unit) return collator.compare(qa.unit, qb.unit);
    return qa.magnitude - qb.magnitude || collator.compare(String(a), String(b));
  }
  if (qa) return -1;
  if (qb) return 1;
  return collator.compare(String(a), String(b));
};

/** Natural text order (A→Z, with "Item 2" before "Item 10"), `lastLabel` kept at the end. */
export const compareLabels = (a, b, lastLabel) => {
  if (a === b) return 0;
  if (lastLabel != null) {
    if (a === lastLabel) return 1;
    if (b === lastLabel) return -1;
  }
  return collator.compare(String(a || ''), String(b || ''));
};
