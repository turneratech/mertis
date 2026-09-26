/**
 * MANTIS_* environment variables keep working after the rename to Mertis.
 *
 * The product was called Mantis until 2026-09-26. Every install in the field
 * has a .env written against the old names, and a rename that silently ignores
 * them would look like the setting had stopped being read rather than like it
 * had moved. So: MERTIS_* wins, MANTIS_* is honoured with a warning, and the
 * operator gets told once per process rather than once per read.
 *
 * Required before anything reads process.env, which means the first line of
 * server/index.js and of the test app helper. The mapping runs both ways: the
 * old name is filled in from the new one as well, so code that has not been
 * renamed yet still sees its setting.
 *
 * Remove this file when no supported install predates the rename. Delete the
 * fallback, not the warning - a silent removal is how an operator discovers the
 * change by finding their storage empty.
 */

const ALIASED = [
  'DEV_DEFAULTS',
  'ORGANIZATION_NAME',
  'DATA_DIR',
  'VERSION',
  'STATUSES',
  'SKIP_LICENSE_CHECKS',
  'PREFIX',
  'LIMIT_LOCK_TIMEOUT_MS',
  'WAIVER_TIER',
  'TRACKER_ENABLED'
];

const applyEnvAliases = (env = process.env) => {
  const migrated = [];

  for (const suffix of ALIASED) {
    const current = `MERTIS_${suffix}`;
    const legacy = `MANTIS_${suffix}`;
    // An explicit new name always wins, even when both are set: that is the
    // operator saying which one they mean.
    if (env[current] === undefined && env[legacy] !== undefined) {
      env[current] = env[legacy];
      migrated.push(`${legacy} -> ${current}`);
    }

    // And the other way, quietly. Some files still read the old name while the
    // rename lands file by file, and an operator who has already moved to
    // MERTIS_* should not have to care which ones.
    if (env[legacy] === undefined && env[current] !== undefined) {
      env[legacy] = env[current];
    }
  }

  if (migrated.length) {
    console.warn(
      `[Config] Reading ${migrated.length} legacy MANTIS_* variable(s). The product is now Mertis; ` +
      `rename them in your .env before the next major version.\n         ${migrated.join('\n         ')}`
    );
  }

  return migrated;
};

module.exports = { applyEnvAliases, ALIASED };
