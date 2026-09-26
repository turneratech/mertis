import React from 'react';
import { useLicense } from '../../hooks/useLicense';
import {
  TIER_DISPLAY,
  FEATURE_MIN_TIER,
  TIER_PRICE_LABEL,
  FEATURE_LABEL,
  LIMIT_LABEL,
  LIMIT_NEXT_TIER,
  getLimitNextTierDisplay,
  getRequiredTierDisplay,
  getTierDisplayName,
  getTiersFrom,
  portalCheckoutUrl
} from '../../config/tiers';

export function UpgradePrompt() {
  const { upgradePrompt, closeUpgradePrompt, license } = useLicense();

  if (!upgradePrompt.open) return null;

  const feature = upgradePrompt.feature;
  const limit = upgradePrompt.limit;

  // A count limit and a locked feature need different words for the same modal.
  const requiredTierId = limit
    ? (LIMIT_NEXT_TIER[limit] || 'team')
    : (feature ? (FEATURE_MIN_TIER[feature] || 'professional') : 'professional');
  const requiredTier = limit ? getLimitNextTierDisplay(limit) : getRequiredTierDisplay(feature);
  const featureLabel = limit ? (LIMIT_LABEL[limit] || limit) : (FEATURE_LABEL[feature] || feature);
  const currentTier = getTierDisplayName(license.tier);

  const headline = limit ? 'Limit reached' : 'Upgrade Required';
  const subtitle = limit
    ? `You have used all the ${limit} included in your plan`
    : 'This feature requires a higher plan';

  const upgradeTiers = getTiersFrom(requiredTierId).map(id => ({
    id,
    name: TIER_DISPLAY[id],
    price: TIER_PRICE_LABEL[id] || 'Contact us'
  }));

  return (
    <div style={s.overlay} onClick={closeUpgradePrompt}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.lockCircle}>🔒</div>
          <div>
            <h2 style={s.title}>{headline}</h2>
            <p style={s.subtitle}>{subtitle}</p>
          </div>
        </div>

        <div style={s.body}>
          <div style={s.featurePill}>{featureLabel}</div>
          <p style={s.description}>
            You are on the <strong>{currentTier}</strong> plan.{' '}
            <strong>{featureLabel}</strong> is available starting from the{' '}
            <span style={s.highlight}>{requiredTier}</span> plan.
          </p>

          <div style={s.tierGrid}>
            {upgradeTiers.map(tier => (
              <div key={tier.id} style={s.tierCard}>
                <div style={s.tierName}>{tier.name}</div>
                <div style={s.tierPrice}>{tier.price}</div>
              </div>
            ))}
          </div>

          <p style={s.contactLine}>
            <a href={portalCheckoutUrl()} target="_blank" rel="noopener noreferrer" style={s.link}>
              Get a license at the portal
            </a>
            {' · '}
            <a href="mailto:sales@turneratech.com" style={s.link}>sales@turneratech.com</a>
          </p>
        </div>

        <div style={s.footer}>
          <button style={s.closeBtn} onClick={closeUpgradePrompt}>Close</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  modal: {
    background: '#fff', borderRadius: '10px',
    width: '440px', maxWidth: '95vw',
    boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
    overflow: 'hidden'
  },
  header: {
    background: '#1a1a2e', color: '#fff',
    padding: '20px 24px',
    display: 'flex', alignItems: 'center', gap: '16px'
  },
  lockCircle: {
    fontSize: '32px', lineHeight: 1
  },
  title: { margin: 0, fontSize: '18px', fontWeight: 700 },
  subtitle: { margin: '2px 0 0', fontSize: '13px', opacity: 0.7 },
  body: { padding: '20px 24px' },
  featurePill: {
    display: 'inline-block',
    background: '#fff3e0', color: '#e67e22',
    border: '1px solid #e67e22',
    padding: '3px 12px', borderRadius: '20px',
    fontSize: '13px', fontWeight: 600,
    marginBottom: '12px'
  },
  description: { color: '#444', lineHeight: 1.6, marginBottom: '16px', fontSize: '14px' },
  highlight: {
    background: '#e67e22', color: '#fff',
    padding: '1px 7px', borderRadius: '3px', fontSize: '13px'
  },
  tierGrid: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  tierCard: {
    flex: '1 1 120px',
    border: '1px solid #e0e0e0', borderRadius: '6px',
    padding: '12px', textAlign: 'center'
  },
  tierName: { fontWeight: 600, color: '#1a1a2e', fontSize: '14px', marginBottom: '4px' },
  tierPrice: { color: '#e67e22', fontSize: '13px' },
  contactLine: { fontSize: '13px', color: '#666', textAlign: 'center', margin: 0 },
  link: { color: '#e67e22', textDecoration: 'none', fontWeight: 500 },
  footer: {
    padding: '14px 24px', borderTop: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'flex-end'
  },
  closeBtn: {
    background: '#1a1a2e', color: '#fff',
    border: 'none', padding: '8px 22px',
    borderRadius: '5px', cursor: 'pointer', fontSize: '14px'
  }
};
