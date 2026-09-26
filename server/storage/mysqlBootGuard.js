/**
 * When .env (or DATABASE_PROVIDER=mysql) says this install uses MySQL,
 * do not silently fall back to CSV. PM2 must show a hard failure.
 */

const RED = '\x1b[1;31m';
const RESET = '\x1b[0m';

const MYSQL_ENV_KEYS = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD'];

const shouldRefuseCsvFallback = (env = process.env, provider) => {
  const p = String(provider || env.DATABASE_PROVIDER || 'auto').toLowerCase();
  if (p === 'csv') return false;
  if (p === 'mysql') return true;
  return MYSQL_ENV_KEYS.some((key) => String(env[key] || '').trim() !== '');
};

const mysqlFailureBanner = ({ host, port, user, database, reason }) => {
  const lines = [
    '********************************************************************************',
    '**  ERROR ACCESSING MYSQL',
    '**  Mertis will NOT start. CSV fallback is disabled for this install.',
    `**  host=${host} port=${port} user=${user} database=${database}`,
    `**  ${reason}`,
    '**  Check DB_* in server/.env vs server/data/deployment.local.json',
    '**  (JSON overrides .env when those fields are non-empty.)',
    '********************************************************************************'
  ];
  return `${RED}${lines.join('\n')}${RESET}`;
};

module.exports = {
  shouldRefuseCsvFallback,
  mysqlFailureBanner
};
