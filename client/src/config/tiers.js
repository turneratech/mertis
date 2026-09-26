/**
 * Client-side tier catalog — display names, ordering, upgrade paths, and feature gating hints.
 * Canonical limits/features live on the server; this module is UI metadata only.
 */
import { pricingUrl } from './licenseServer';

export const TIER_ORDER = [
  'community',
  'team',
  'professional',
  'business',
  'agency',
  'enterprise',
  'enterprise_plus',
  'cloud'
];

export const TIER_DISPLAY = {
  community: 'Community',
  team: 'Team',
  professional: 'Professional',
  business: 'Business',
  agency: 'Agency',
  enterprise: 'Enterprise',
  enterprise_plus: 'Enterprise Plus',
  cloud: 'Cloud'
};

export const TIER_STYLE = {
  community: { background: '#f0f0f0', color: '#666' },
  team: { background: '#e8eaf6', color: '#3949ab' },
  professional: { background: '#e3f2fd', color: '#1565c0' },
  business: { background: '#fff3e0', color: '#e65100' },
  agency: { background: '#fce4ec', color: '#c2185b' },
  enterprise: { background: '#f3e5f5', color: '#6a1b9a' },
  enterprise_plus: { background: '#ede7f6', color: '#4527a0' },
  cloud: { background: '#e8f5e9', color: '#2e7d32' }
};

/** Minimum tier required for each feature flag (matches server/config/features.js). */
export const FEATURE_MIN_TIER = {
  s3_storage: 'team',
  api_access: 'team',
  basic_reporting: 'team',
  custom_fields: 'team',
  ai_insights: 'professional',
  ai_duplicate_detection: 'professional',
  advanced_reporting: 'professional',
  custom_workflows: 'professional',
  email_reports: 'professional',
  priority_support: 'professional',
  github_integration_advanced: 'professional',
  unlimited_attachments: 'professional',
  all_storage_backends: 'professional',
  staging_instance: 'professional',
  sso_saml: 'business',
  audit_logs: 'business',
  audit_log_export: 'business',
  multi_instance: 'business',
  advanced_permissions: 'business',
  child_licenses: 'agency',
  white_labeling: 'agency',
  custom_branding: 'agency',
  sla_management: 'enterprise',
  offline_activation: 'enterprise',
  deployment_assistance: 'enterprise',
  ai_root_cause_analysis: 'enterprise',
  ai_predictive_alerts: 'enterprise',
  private_llm: 'enterprise_plus',
  managed_hosting: 'cloud',
  auto_updates: 'cloud',
  daily_backups: 'cloud',
  uptime_sla: 'cloud'
};

export const FEATURE_LABEL = {
  s3_storage: 'S3 Storage',
  api_access: 'API Access',
  basic_reporting: 'Basic Reporting',
  custom_fields: 'Custom Fields',
  ai_insights: 'AI Insights',
  ai_duplicate_detection: 'AI Duplicate Detection',
  advanced_reporting: 'Advanced Reporting',
  custom_workflows: 'Custom Workflows',
  email_reports: 'Email Reports',
  priority_support: 'Priority Support',
  github_integration_advanced: 'Advanced GitHub Integration',
  unlimited_attachments: 'Unlimited Attachments',
  all_storage_backends: 'All Storage Backends',
  staging_instance: 'Staging Instance',
  sso_saml: 'SSO / SAML',
  audit_logs: 'Audit Logs',
  audit_log_export: 'Audit Log Export',
  multi_instance: 'Multi-Instance',
  advanced_permissions: 'Advanced Permissions',
  child_licenses: 'Child Licenses',
  white_labeling: 'White Labeling',
  custom_branding: 'Custom Branding',
  sla_management: 'SLA Management',
  offline_activation: 'Offline Activation',
  deployment_assistance: 'Deployment Assistance',
  ai_root_cause_analysis: 'AI Root Cause Analysis',
  ai_predictive_alerts: 'AI Predictive Alerts',
  private_llm: 'Private LLM',
  managed_hosting: 'Managed Hosting',
  auto_updates: 'Auto Updates',
  daily_backups: 'Daily Backups',
  uptime_sla: 'Uptime SLA',
  export_data: 'Data Export'
};

/** Short price labels for upgrade UI (full pricing on portal). */
export const TIER_PRICE_LABEL = {
  community: '$0/forever',
  team: '$29/mo',
  professional: '$79/mo',
  business: '$199/mo',
  agency: '$1,490/yr',
  enterprise: 'Custom annual',
  enterprise_plus: 'Custom annual',
  cloud: 'Per-seat pricing'
};

/** Tiers shown in the setup wizard portal-fetch dropdown. */
export const PORTAL_ISSUABLE_TIERS = [
  { id: 'community', label: 'Community (Free)' },
  { id: 'team', label: 'Team' },
  { id: 'professional', label: 'Professional' },
  { id: 'business', label: 'Business' }
];

export const getTierDisplayName = (tierId) =>
  TIER_DISPLAY[tierId] || tierId || 'Community';

export const getUpgradeTarget = (currentTier) => {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
};

export const getTiersFrom = (minTierId) => {
  const idx = TIER_ORDER.indexOf(minTierId);
  if (idx < 0) return TIER_ORDER;
  return TIER_ORDER.slice(idx);
};

export const getRequiredTierDisplay = (featureName) => {
  const tierId = FEATURE_MIN_TIER[featureName] || 'professional';
  return TIER_DISPLAY[tierId] || 'Professional';
};

/**
 * Where "upgrade" goes. Deliberately NOT the /register page — that is the
 * free-key signup form, which is the wrong destination for someone trying to pay.
 */
export const portalCheckoutUrl = () => pricingUrl();

/**
 * Count limits are not features, and the upgrade modal has to describe them
 * differently. Every limit-reached button used to pass the feature name
 * 'priority_support', so a user who ran out of user slots was told that
 * Priority Support requires Professional — the wrong product, on every path.
 */
export const LIMIT_LABEL = {
  users: 'More users',
  projects: 'More projects',
  bugs: 'More bugs',
  webhooks: 'More webhooks'
};

/**
 * First tier that actually raises each count limit. Team lifts users 5 -> 25,
 * projects 3 -> 15 and bugs 250 -> 5000, so it is the honest first step. The
 * inline copy used to say "Professional", skipping our own cheapest upsell.
 */
export const LIMIT_NEXT_TIER = {
  users: 'team',
  projects: 'team',
  bugs: 'team',
  webhooks: 'team'
};

export const getLimitNextTierDisplay = (limitType) =>
  TIER_DISPLAY[LIMIT_NEXT_TIER[limitType] || 'team'] || 'Team';

/** Limit-approach banner copy. Thresholds live in LIMIT_WARN_PCT below. */
export const LIMIT_WARNING_COPY = {
  users: (remaining) => `~${remaining} user slot${remaining === 1 ? '' : 's'} left on your plan`,
  projects: (remaining) => `~${remaining} project${remaining === 1 ? '' : 's'} left on your plan`,
  bugs: (remaining) => `~${remaining} bug${remaining === 1 ? '' : 's'} left on your plan`,
  webhooks: (remaining) => `~${remaining} webhook${remaining === 1 ? '' : 's'} left on your plan`
};

/**
 * When to warn before the wall. Community users previously got no signal at
 * all — bugs had no counter until the hard 403 at 250/250.
 */
export const LIMIT_WARN_PCT = 0.8;
export const LIMIT_CRITICAL_PCT = 0.95;
