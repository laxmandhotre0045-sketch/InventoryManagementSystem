// Builds the address a phone opens after scanning the capture QR code.
//
// The subtlety this module exists for: the page the desktop is looking at is not
// necessarily reachable from the phone, and its protocol and port are often wrong
// for the address that is. Served behind an HTTPS proxy, window.location gives
// protocol "https:" and an empty port — so pairing those with a LAN IP produces
// "https://192.168.1.44", pointing at port 443 of a machine that only serves plain
// HTTP on 8090. The QR then encodes a URL that can never connect.

// Port the stack publishes the web app on (FRONTEND_PORT in .env). Used only as a
// fallback, when this page is proxied and so carries no port of its own.
export const DEFAULT_LAN_PORT = '8090';

const PRIVATE_IP = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)\d/;
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/i;
const CGNAT = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;

const stripPort = (h) => String(h || '').replace(/:\d+$/, '');

const isLanHost = (host) => PRIVATE_IP.test(host) || LOOPBACK.test(host) || CGNAT.test(host);

/**
 * Expands user input ("192.168.1.44", "192.168.1.44:8090", a full URL) into an
 * origin the phone can actually open.
 *
 * @param input what the operator typed
 * @param location the page's location (injected so it can be tested)
 */
export const normalizeBase = (input, location = window.location) => {
  const raw = String(input || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const host = stripPort(raw);
  const hasPort = /:\d+$/.test(raw);
  const lan = isLanHost(host);

  // A LAN address is plain HTTP; a public hostname keeps this page's scheme.
  const protocol = lan ? 'http:' : location.protocol;
  if (hasPort) return `${protocol}//${raw}`;

  // Keep this page's port when it has one; otherwise a LAN address needs the app's
  // own port spelled out, because the proxy's 443/80 isn't open on the LAN.
  const port = location.port || (lan ? DEFAULT_LAN_PORT : '');
  return `${protocol}//${host}${port ? `:${port}` : ''}`;
};

/** Plain-language advice about an address. level: 'ok' | 'info' | 'error'. */
export const classifyBase = (base) => {
  if (!base) return { level: 'error', note: '' };
  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    return { level: 'error', note: 'That doesn’t look like a valid address.' };
  }

  if (LOOPBACK.test(host)) {
    return {
      level: 'error',
      note: 'localhost only means “this computer” — a phone can never reach it. Use this site’s public address, or your PC’s Wi-Fi IP such as 192.168.1.44:8090.',
    };
  }
  if (CGNAT.test(host)) {
    return { level: 'info', note: 'Tailscale/VPN address — works only if your phone is on the same VPN.' };
  }
  if (PRIVATE_IP.test(host)) {
    return { level: 'ok', note: 'Local address — your phone must be on the same Wi-Fi as this computer.' };
  }
  return { level: 'ok', note: 'Public address — your phone can open this from any network, including mobile data.' };
};

/**
 * The address to offer first.
 *
 * When the app is served from a real domain, that domain is the answer: the phone
 * reaches it over any network, with no LAN, IP or firewall guesswork. Only a
 * localhost-served page has to fall back to asking for a Wi-Fi IP.
 */
export const defaultBase = (location = window.location) =>
  (LOOPBACK.test(location.hostname) ? '' : location.origin);

export const buildCaptureUrl = (sessionId, base) =>
  (sessionId && base ? `${base}/m/capture?s=${sessionId}` : '');
