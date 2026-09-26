// Mertis-only seam. Pulse-only (hide tracker chrome) is not built yet.
// Combinations: Pulse+Mertis, Pulse-only, Mertis-only.
const isPulseEnabled = () =>
  String(process.env.PULSE_ENABLED || 'true').toLowerCase() !== 'false';

const botUsers = () =>
  (process.env.PULSE_BOT_USERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = { isPulseEnabled, botUsers };
