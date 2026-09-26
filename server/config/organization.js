/**
 * Customer organization name for white-label confidentiality copy.
 * Saved at first-run setup (deployment.local.json). Env and licensee are fallbacks.
 * Never default to Turnera Tech.
 */

const deploymentConfig = require('./deployment.config');
const instanceConfig = require('./instance.config');

const FALLBACK_DISPLAY = 'this organization';
const MAX_LEN = 200;

const trimName = (value) => (typeof value === 'string' ? value.trim() : '');

const resolveOrganizationName = ({ localName, envName, licensee } = {}) => {
  for (const candidate of [localName, envName, licensee]) {
    const name = trimName(candidate);
    if (name) return name;
  }
  return '';
};

const normalizeOrganizationName = (value) => {
  const name = trimName(value);
  if (!name) {
    const err = new Error('Organization name is required');
    err.status = 400;
    throw err;
  }
  if (name.length > MAX_LEN) {
    const err = new Error(`Organization name must be ${MAX_LEN} characters or fewer`);
    err.status = 400;
    throw err;
  }
  return name;
};

const getOrganizationName = () => {
  const local = deploymentConfig.reloadLocalConfig();
  return resolveOrganizationName({
    localName: local.organizationName,
    envName: process.env.MERTIS_ORGANIZATION_NAME,
    licensee: instanceConfig.licensee
  });
};

const getOrganizationDisplayName = () => getOrganizationName() || FALLBACK_DISPLAY;

/**
 * Confidentiality line for reports, PDFs and emails.
 *
 * White-label: when the operator has not named their organisation we omit the
 * clause rather than printing "proprietary information of this organization",
 * which reads like an unfilled template on a document sent to a client.
 */
const getConfidentialityNotice = (name = getOrganizationName()) => {
  return name
    ? `CONFIDENTIAL — proprietary information of ${name}`
    : 'CONFIDENTIAL — proprietary information';
};

const saveOrganizationName = (value) => {
  const organizationName = normalizeOrganizationName(value);
  deploymentConfig.saveLocalConfig({ organizationName });
  return organizationName;
};

module.exports = {
  FALLBACK_DISPLAY,
  MAX_LEN,
  resolveOrganizationName,
  normalizeOrganizationName,
  getOrganizationName,
  getOrganizationDisplayName,
  getConfidentialityNotice,
  saveOrganizationName
};
