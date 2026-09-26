/**
 * Public URL prefix for axios + React Router (baked in at `npm run build`).
 *
 * Product / path install:  PUBLIC_URL=/mertis   (client/package.json homepage)
 * Served at a domain root:  PUBLIC_URL=/         (e.g. https://mertis.example.com)
 */
const raw = process.env.REACT_APP_PUBLIC_BASE ?? process.env.PUBLIC_URL ?? '/';
export const PUBLIC_BASE = raw === '/' ? '' : String(raw).replace(/\/$/, '');
