const TIERS = {
  COMMUNITY: 'community',
  TEAM: 'team',
  PROFESSIONAL: 'professional',
  BUSINESS: 'business',
  AGENCY: 'agency',
  ENTERPRISE: 'enterprise',
  ENTERPRISE_PLUS: 'enterprise_plus',
  CLOUD: 'cloud'
};

const FEATURES = {
  BASIC_BUG_TRACKING: 'basic_bug_tracking',
  PROJECT_MANAGEMENT: 'project_management',
  GITHUB_INTEGRATION_BASIC: 'github_integration_basic',
  AI_INSIGHTS: 'ai_insights',
  AI_DUPLICATE_DETECTION: 'ai_duplicate_detection',
  ADVANCED_REPORTING: 'advanced_reporting',
  CUSTOM_FIELDS: 'custom_fields',
  CUSTOM_WORKFLOWS: 'custom_workflows',
  API_ACCESS: 'api_access',
  EMAIL_REPORTS: 'email_reports',
  PRIORITY_SUPPORT: 'priority_support',
  GITHUB_INTEGRATION_ADVANCED: 'github_integration_advanced',
  UNLIMITED_ATTACHMENTS: 'unlimited_attachments',
  EXPORT_DATA: 'export_data',
  SSO_SAML: 'sso_saml',
  AUDIT_LOGS: 'audit_logs',
  WHITE_LABELING: 'white_labeling',
  AI_ROOT_CAUSE_ANALYSIS: 'ai_root_cause_analysis',
  AI_PREDICTIVE_ALERTS: 'ai_predictive_alerts',
  ADVANCED_PERMISSIONS: 'advanced_permissions',
  SLA_MANAGEMENT: 'sla_management',
  CUSTOM_BRANDING: 'custom_branding',
  DEPLOYMENT_ASSISTANCE: 'deployment_assistance',
  MANAGED_HOSTING: 'managed_hosting',
  AUTO_UPDATES: 'auto_updates',
  DAILY_BACKUPS: 'daily_backups',
  UPTIME_SLA: 'uptime_sla',
  // v2 catalog (append-only — keys may appear in JWTs and feature_usage_log)
  S3_STORAGE: 's3_storage',
  ALL_STORAGE_BACKENDS: 'all_storage_backends',
  STAGING_INSTANCE: 'staging_instance',
  AUDIT_LOG_EXPORT: 'audit_log_export',
  MULTI_INSTANCE: 'multi_instance',
  OFFLINE_ACTIVATION: 'offline_activation',
  PRIVATE_LLM: 'private_llm',
  CHILD_LICENSES: 'child_licenses',
  BASIC_REPORTING: 'basic_reporting'
};

const COMMUNITY_FEATURES = [
  FEATURES.BASIC_BUG_TRACKING,
  FEATURES.PROJECT_MANAGEMENT,
  FEATURES.GITHUB_INTEGRATION_BASIC,
  FEATURES.EXPORT_DATA
];

const TEAM_FEATURES = [
  ...COMMUNITY_FEATURES,
  FEATURES.S3_STORAGE,
  FEATURES.API_ACCESS,
  FEATURES.BASIC_REPORTING,
  FEATURES.CUSTOM_FIELDS
];

const PROFESSIONAL_FEATURES = [
  ...TEAM_FEATURES,
  FEATURES.AI_INSIGHTS,
  FEATURES.AI_DUPLICATE_DETECTION,
  FEATURES.ADVANCED_REPORTING,
  FEATURES.EMAIL_REPORTS,
  FEATURES.CUSTOM_WORKFLOWS,
  FEATURES.GITHUB_INTEGRATION_ADVANCED,
  FEATURES.UNLIMITED_ATTACHMENTS,
  FEATURES.ALL_STORAGE_BACKENDS,
  FEATURES.STAGING_INSTANCE,
  FEATURES.PRIORITY_SUPPORT
];

const BUSINESS_FEATURES = [
  ...PROFESSIONAL_FEATURES,
  FEATURES.SSO_SAML,
  FEATURES.AUDIT_LOGS,
  FEATURES.AUDIT_LOG_EXPORT,
  FEATURES.MULTI_INSTANCE,
  FEATURES.ADVANCED_PERMISSIONS
];

const AGENCY_FEATURES = [
  ...TEAM_FEATURES,
  FEATURES.CHILD_LICENSES,
  FEATURES.WHITE_LABELING,
  FEATURES.CUSTOM_BRANDING
];

const ENTERPRISE_FEATURES = [
  ...BUSINESS_FEATURES,
  FEATURES.SLA_MANAGEMENT,
  FEATURES.OFFLINE_ACTIVATION,
  FEATURES.DEPLOYMENT_ASSISTANCE,
  FEATURES.AI_ROOT_CAUSE_ANALYSIS,
  FEATURES.AI_PREDICTIVE_ALERTS
];

const ENTERPRISE_PLUS_FEATURES = [
  ...ENTERPRISE_FEATURES,
  FEATURES.PRIVATE_LLM
];

const CLOUD_FEATURES = [
  ...PROFESSIONAL_FEATURES,
  FEATURES.MANAGED_HOSTING,
  FEATURES.AUTO_UPDATES,
  FEATURES.DAILY_BACKUPS,
  FEATURES.UPTIME_SLA
];

const TIER_FEATURES = {
  [TIERS.COMMUNITY]: COMMUNITY_FEATURES,
  [TIERS.TEAM]: TEAM_FEATURES,
  [TIERS.PROFESSIONAL]: PROFESSIONAL_FEATURES,
  [TIERS.BUSINESS]: BUSINESS_FEATURES,
  [TIERS.AGENCY]: AGENCY_FEATURES,
  [TIERS.ENTERPRISE]: ENTERPRISE_FEATURES,
  [TIERS.ENTERPRISE_PLUS]: ENTERPRISE_PLUS_FEATURES,
  [TIERS.CLOUD]: CLOUD_FEATURES
};

const TIER_LIMITS = {
  [TIERS.COMMUNITY]: {
    maxUsers: 5,
    maxProjects: 3,
    maxBugs: 250,
    maxAttachmentSizeMB: 5,
    aiRequestsPerMonth: 0,
    maxWebhooks: 1,
    maxInstances: 1
  },
  [TIERS.TEAM]: {
    maxUsers: 25,
    maxProjects: 15,
    maxBugs: 5000,
    maxAttachmentSizeMB: 25,
    aiRequestsPerMonth: 0,
    maxWebhooks: 3,
    maxInstances: 1
  },
  [TIERS.PROFESSIONAL]: {
    maxUsers: 500,
    maxProjects: null,
    maxBugs: null,
    maxAttachmentSizeMB: null,
    aiRequestsPerMonth: null,
    maxWebhooks: null,
    maxInstances: 1
  },
  [TIERS.BUSINESS]: {
    maxUsers: 2000,
    maxProjects: null,
    maxBugs: null,
    maxAttachmentSizeMB: null,
    aiRequestsPerMonth: null,
    maxWebhooks: null,
    maxInstances: 3
  },
  [TIERS.AGENCY]: {
    maxUsers: 25,
    maxProjects: 15,
    maxBugs: 5000,
    maxAttachmentSizeMB: 25,
    aiRequestsPerMonth: 0,
    maxWebhooks: 3,
    maxInstances: 10
  },
  [TIERS.ENTERPRISE]: {
    maxUsers: null,
    maxProjects: null,
    maxBugs: null,
    maxAttachmentSizeMB: null,
    aiRequestsPerMonth: null,
    maxWebhooks: null,
    maxInstances: null
  },
  [TIERS.ENTERPRISE_PLUS]: {
    maxUsers: null,
    maxProjects: null,
    maxBugs: null,
    maxAttachmentSizeMB: null,
    aiRequestsPerMonth: null,
    maxWebhooks: null,
    maxInstances: null
  },
  [TIERS.CLOUD]: {
    maxUsers: null,
    maxProjects: null,
    maxBugs: null,
    maxAttachmentSizeMB: null,
    aiRequestsPerMonth: 1000,
    maxWebhooks: null,
    maxInstances: null
  }
};

module.exports = { TIERS, FEATURES, TIER_FEATURES, TIER_LIMITS };
