import React from 'react';
import { useFeature } from '../../hooks/useFeature';
import { useLicense } from '../../hooks/useLicense';

/**
 * A locked Pulse surface.
 *
 * A locked state is a sales surface, not an error. It has to say three things:
 * what this is, why it is worth having, and what unlocks it. The old shared
 * FeatureGuard rendered a bare orange "Upgrade to unlock" button with no page
 * shell and no explanation, which reads as a bug.
 */
export function PulseLocked({ title, what, why, feature = 'advanced_reporting' }) {
  const { promptUpgrade } = useLicense();
  return (
    <section className="pulse-locked">
      <h3>{title}</h3>
      <p className="pulse-locked-what">{what}</p>
      {why ? <p className="pulse-locked-why">{why}</p> : null}
      <button type="button" className="btn btn-primary" onClick={() => promptUpgrade(feature)} data-tip="See which tier unlocks this surface">
        See upgrade options
      </button>
      <p className="pulse-locked-foot">
        Your boards, triage, The Line and The Wait stay free on every tier.
      </p>
    </section>
  );
}

/**
 * Renders children when the feature is available, the locked panel otherwise.
 * While the licence is still loading it renders nothing rather than flashing a
 * paywall at someone who has already paid.
 */
export function PaidSurface({ feature = 'advanced_reporting', title, what, why, children }) {
  const { isAvailable } = useFeature(feature);
  // license.loading is true until the first /api/license poll returns. Render
  // nothing until then, rather than flashing a paywall at someone who has paid.
  const { license } = useLicense();
  if (license?.loading) return null;
  if (!isAvailable) return <PulseLocked title={title} what={what} why={why} feature={feature} />;
  return children;
}
