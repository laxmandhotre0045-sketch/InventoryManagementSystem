// A readable name for a person, from the account name or, failing that, the email.
//
// Accounts here have a username rather than a full name, and some of those are
// handles ("sensovibe.software"). Separators become spaces and an all-lowercase
// word is capitalised, so that reads "Sensovibe Software"; anything already
// mixed-case ("Nikita", "McLaren") is left exactly as the person typed it.
const tidy = (raw) => String(raw)
  .replace(/[._-]+/g, ' ')
  .trim()
  .split(/\s+/)
  .map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
  .join(' ');

export const displayName = (username, email) => {
  if (username && username.trim()) return tidy(username);
  if (email && email.includes('@')) return tidy(email.split('@')[0]);
  return email || 'there';
};

export default displayName;
