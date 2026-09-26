import React from 'react';
import { useFeature } from '../../hooks/useFeature';
import { useLicense } from '../../hooks/useLicense';

/**
 * Conditionally renders children based on license feature availability.
 *
 * Props:
 *   feature          — feature name string (e.g. 'ai_insights')
 *   children         — content to show when feature is available
 *   fallback         — content to show when feature is unavailable (default: null)
 *   showUpgradePrompt — show an "Upgrade" button instead of fallback (default: false)
 *
 * Usage:
 *   <FeatureGuard feature="ai_insights" showUpgradePrompt>
 *     <AIInsightsPanel />
 *   </FeatureGuard>
 */
export const FeatureGuard = ({ feature, children, fallback = null, showUpgradePrompt = false }) => {
  const { isAvailable } = useFeature(feature);
  const { promptUpgrade } = useLicense();

  if (!isAvailable) {
    if (showUpgradePrompt) {
      return (
        <button
          onClick={() => promptUpgrade(feature)}
          style={{
            background: 'none',
            border: '1px solid #e67e22',
            color: '#e67e22',
            padding: '6px 14px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>🔒</span> Upgrade to unlock
        </button>
      );
    }
    return fallback;
  }

  return children;
};
