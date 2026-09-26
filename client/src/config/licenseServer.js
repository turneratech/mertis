/**
 * Turnera Tech licence server (https://license.turneratech.com).
 *
 * The browser only ever LINKS here — registration happens on the website and the
 * key arrives by email. Activation itself is done server-side by Mertis, because
 * the licence server enforces a CORS allowlist that cannot know every
 * self-hosted customer's hostname.
 */
export const LICENSE_SERVER_URL =
  process.env.REACT_APP_LICENSE_SERVER_URL || 'https://license.turneratech.com';

export const licenseRegisterUrl = () => `${LICENSE_SERVER_URL}/register`;

/**
 * The product website. Distinct from the licence server: that host issues keys,
 * this one explains what they cost.
 */
export const SITE_URL =
  process.env.REACT_APP_SITE_URL || 'https://mantis.turneratech.com';

/**
 * Where an upgrade click should land.
 *
 * This used to resolve to the licence server's /register page — the FREE
 * Community signup form — so a user who clicked "upgrade" was sent somewhere
 * they could only get another free key. Point at pricing until self-serve
 * checkout exists.
 */
export const pricingUrl = () => `${SITE_URL}/#pricing`;
