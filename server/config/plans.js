/**
 * Canonical tier catalog — limits, features, and display/pricing metadata.
 * Import tier matrices from features.js; use this module for pricing/portal UI.
 */
const { TIERS, FEATURES, TIER_FEATURES, TIER_LIMITS } = require('./features');

const PLANS = {
  [TIERS.COMMUNITY]: {
    id: TIERS.COMMUNITY,
    name: 'Community',
    displayName: 'Community Edition',
    deployment: 'self-hosted',
    billing: {
      type: 'free',
      label: '$0/forever',
      usd: { monthly: 0, annual: 0 },
      inr: { monthly: 0, annual: 0 },
      unit: 'instance'
    },
    limits: TIER_LIMITS[TIERS.COMMUNITY],
    features: TIER_FEATURES[TIERS.COMMUNITY],
    highlights: [
      '5 users · 3 projects · 250 bugs',
      'Core bug tracking & data export',
      'GitHub integration',
      '5 MB attachments · 1 webhook',
      'Self-hosted CSV or DB'
    ],
    public: true,
    issuable: true,
    contactSales: false,
    trialTier: false
  },
  [TIERS.TEAM]: {
    id: TIERS.TEAM,
    name: 'Team',
    displayName: 'Team',
    deployment: 'self-hosted',
    billing: {
      type: 'subscription',
      label: '$29/mo',
      annualLabel: '$290/yr',
      usd: { monthly: 29, annual: 290 },
      inr: { monthly: 1499, annual: 14990 },
      unit: 'instance'
    },
    limits: TIER_LIMITS[TIERS.TEAM],
    features: TIER_FEATURES[TIERS.TEAM],
    highlights: [
      '25 users · 15 projects · 5,000 bugs',
      'S3 storage & API access',
      'Basic reporting & custom fields',
      '25 MB attachments · 3 webhooks'
    ],
    public: true,
    issuable: true,
    contactSales: false,
    trialTier: false
  },
  [TIERS.PROFESSIONAL]: {
    id: TIERS.PROFESSIONAL,
    name: 'Professional',
    displayName: 'Professional',
    deployment: 'self-hosted',
    billing: {
      type: 'subscription',
      label: '$79/mo',
      annualLabel: '$790/yr',
      usd: { monthly: 79, annual: 790 },
      inr: { monthly: 3999, annual: 39990 },
      unit: 'instance'
    },
    limits: TIER_LIMITS[TIERS.PROFESSIONAL],
    features: TIER_FEATURES[TIERS.PROFESSIONAL],
    highlights: [
      'Up to 500 users · unlimited projects & bugs',
      'AI insights & advanced reports',
      'All storage backends & staging instance',
      'Email scheduled reports · priority support'
    ],
    public: true,
    issuable: true,
    contactSales: false,
    trialTier: true
  },
  [TIERS.BUSINESS]: {
    id: TIERS.BUSINESS,
    name: 'Business',
    displayName: 'Business',
    deployment: 'self-hosted',
    billing: {
      type: 'subscription',
      label: '$199/mo',
      annualLabel: '$1,990/yr',
      usd: { monthly: 199, annual: 1990 },
      inr: { monthly: 9999, annual: 99990 },
      unit: 'instance'
    },
    limits: TIER_LIMITS[TIERS.BUSINESS],
    features: TIER_FEATURES[TIERS.BUSINESS],
    highlights: [
      'Up to 2,000 users · 3 instances',
      'SSO / SAML & audit log export',
      'Advanced permissions',
      'Multi-instance deployment'
    ],
    public: true,
    issuable: true,
    contactSales: false,
    trialTier: false
  },
  [TIERS.AGENCY]: {
    id: TIERS.AGENCY,
    name: 'Agency',
    displayName: 'Agency',
    deployment: 'self-hosted',
    billing: {
      type: 'contract',
      label: '$1,490/yr',
      usd: { monthly: null, annual: 1490 },
      inr: { monthly: null, annual: 74990 },
      unit: 'contract'
    },
    limits: TIER_LIMITS[TIERS.AGENCY],
    features: TIER_FEATURES[TIERS.AGENCY],
    highlights: [
      'Up to 10 client instances',
      'Child license management',
      'White-label & custom branding',
      'Team-tier limits per client'
    ],
    public: false,
    issuable: false,
    contactSales: true,
    contactEmail: 'sales@turneratech.com',
    trialTier: false
  },
  [TIERS.ENTERPRISE]: {
    id: TIERS.ENTERPRISE,
    name: 'Enterprise',
    displayName: 'Enterprise',
    deployment: 'self-hosted',
    billing: {
      type: 'contract',
      label: 'Custom annual',
      usd: { monthly: null, annual: null },
      inr: { monthly: null, annual: null },
      unit: 'contract'
    },
    limits: TIER_LIMITS[TIERS.ENTERPRISE],
    features: TIER_FEATURES[TIERS.ENTERPRISE],
    highlights: [
      'Unlimited users, projects & instances',
      'SSO / SAML · audit logs & SLA',
      'Offline activation & deployment assistance',
      'Advanced AI analytics · dedicated support'
    ],
    public: false,
    issuable: false,
    contactSales: true,
    contactEmail: 'sales@turneratech.com',
    trialTier: false
  },
  [TIERS.ENTERPRISE_PLUS]: {
    id: TIERS.ENTERPRISE_PLUS,
    name: 'Enterprise Plus',
    displayName: 'Enterprise Plus',
    deployment: 'self-hosted',
    billing: {
      type: 'contract',
      label: 'Custom annual',
      usd: { monthly: null, annual: null },
      inr: { monthly: null, annual: null },
      unit: 'contract'
    },
    limits: TIER_LIMITS[TIERS.ENTERPRISE_PLUS],
    features: TIER_FEATURES[TIERS.ENTERPRISE_PLUS],
    highlights: [
      'All Enterprise features',
      'Private LLM / air-gapped AI',
      'Custom deployment & support SLA'
    ],
    public: false,
    issuable: false,
    contactSales: true,
    contactEmail: 'sales@turneratech.com',
    trialTier: false
  },
  [TIERS.CLOUD]: {
    id: TIERS.CLOUD,
    name: 'Cloud',
    displayName: 'Managed Cloud',
    deployment: 'managed',
    billing: {
      type: 'per-seat',
      label: 'Per-seat pricing',
      usd: { monthly: null, annual: null },
      inr: { monthly: null, annual: null },
      unit: 'seat'
    },
    limits: TIER_LIMITS[TIERS.CLOUD],
    features: TIER_FEATURES[TIERS.CLOUD],
    highlights: [
      'All Professional features',
      'Managed hosting & auto-updates',
      'Daily backups · uptime SLA',
      '1,000 AI requests/mo included'
    ],
    public: false,
    issuable: false,
    contactSales: true,
    contactEmail: 'sales@turneratech.com',
    trialTier: false
  }
};

const getPlan = (tierId) => PLANS[tierId] || PLANS[TIERS.COMMUNITY];

const getAllPlans = () => Object.values(PLANS);

const getIssuablePlans = () => getAllPlans().filter(p => p.issuable);

const getPublicPlans = () => getAllPlans().filter(p => p.public);

module.exports = {
  TIERS,
  FEATURES,
  TIER_FEATURES,
  TIER_LIMITS,
  PLANS,
  getPlan,
  getAllPlans,
  getIssuablePlans,
  getPublicPlans
};
