import React from 'react';
import { useLicense } from '../../hooks/useLicense';
import { TIER_STYLE, getTierDisplayName } from '../../config/tiers';

/**
 * Small inline badge showing the current license tier.
 * Renders nothing while the license is still loading.
 */
export function LicenseStatus() {
  const { license } = useLicense();
  if (license.loading) return null;

  const tier = license.tier || 'community';
  const style = TIER_STYLE[tier] || TIER_STYLE.community;
  const label = getTierDisplayName(tier);

  return (
    <span style={{
      ...style,
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
      whiteSpace: 'nowrap'
    }}>
      {label}
      {license.isTrial && ' · Trial'}
      {license.isGracePeriod && ' · Grace Period'}
    </span>
  );
}
