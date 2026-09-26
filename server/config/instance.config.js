/**
 * Per-install licensing waiver.
 *
 * Off unless MERTIS_SKIP_LICENSE_CHECKS=true is set in that host's .env.
 * Product builds must leave it unset. The licensee/company shown while waived
 * comes from the host's own environment -- no customer name is hard-coded here.
 */
const waived = process.env.MERTIS_SKIP_LICENSE_CHECKS === 'true';

const orNull = (value) => {
  const trimmed = (value || '').trim();
  return trimmed || null;
};

module.exports = {
  skipSetupWizard: waived,
  skipLicenseChecks: waived,
  licenseTier: waived ? (orNull(process.env.MERTIS_WAIVER_TIER) || 'enterprise') : 'community',
  licensee: waived ? orNull(process.env.MERTIS_ORGANIZATION_NAME) : null,
  company: waived ? orNull(process.env.MERTIS_ORGANIZATION_NAME) : null
};
