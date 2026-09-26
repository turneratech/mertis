import { useEffect } from 'react';
import { PUBLIC_BASE } from '../config/publicPath';

const PULSE_ICONS = [
  { rel: 'icon', type: 'image/svg+xml', href: `${PUBLIC_BASE}/pulse/favicon.svg` },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${PUBLIC_BASE}/pulse/favicon-32x32.png` },
  { rel: 'icon', href: `${PUBLIC_BASE}/pulse/favicon.ico`, sizes: 'any' },
];

function applyPulseIcons() {
  const previous = [];
  document.querySelectorAll('link[rel="icon"]').forEach((el) => {
    previous.push({ parent: el.parentNode, html: el.outerHTML });
    el.remove();
  });
  PULSE_ICONS.forEach((attrs) => {
    const link = document.createElement('link');
    Object.entries(attrs).forEach(([k, v]) => link.setAttribute(k, v));
    document.head.appendChild(link);
  });
  const prevTitle = document.title;
  document.title = 'Pulse';
  return () => {
    document.querySelectorAll('link[rel="icon"]').forEach((el) => {
      if ((el.getAttribute('href') || '').includes('/pulse/')) el.remove();
    });
    previous.forEach(({ parent, html }) => {
      if (!parent) return;
      parent.insertAdjacentHTML('beforeend', html);
    });
    document.title = prevTitle;
  };
}

/** Swap tab icon + title while a Pulse route is mounted. Restores Mertis on leave. */
export function usePulseBrand() {
  useEffect(() => applyPulseIcons(), []);
}
