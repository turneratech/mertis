#!/usr/bin/env node
/**
 * Recovery: make a user the God Mode owner of this instance.
 *
 *   node scripts/grant-godmode.js <username>
 *
 * Why this exists. God Mode is the only role that can reset another user's
 * password or change roles, there is exactly one of them, and nobody can change
 * their own role. So if the owner leaves, forgets their password, or their
 * account breaks, an otherwise healthy install becomes permanently
 * unadministrable — and on self-hosted software no vendor can rescue it.
 *
 * Filesystem access to the server is the proof of ownership here: anyone who can
 * run this could read the database anyway. It is deliberately not an HTTP route.
 *
 * Demotes the current owner to admin, so exactly one God Mode account remains.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const storage = require('../server/storage');

const fail = (msg) => {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
};

(async () => {
  const username = process.argv[2];
  if (!username) {
    console.error('\n  Usage: node scripts/grant-godmode.js <username>\n');
    process.exit(1);
  }

  await storage.initializeStorage();

  const users = await storage.getAllUsers();
  const target = users.find((u) => u.username === username);
  if (!target) {
    fail(`No user named "${username}". Known users: ${users.map((u) => u.username).join(', ') || '(none)'}`);
  }

  const currentOwners = users.filter((u) => u.role === 'godmode' && u.id !== target.id);

  if (target.role === 'godmode') {
    console.log(`\n  "${username}" is already the God Mode owner. Nothing to do.\n`);
    process.exit(0);
  }

  for (const owner of currentOwners) {
    await storage.updateUserRole(owner.id, 'admin');
    console.log(`  · ${owner.username}: godmode → admin`);
  }
  await storage.updateUserRole(target.id, 'godmode');

  console.log(`  · ${username}: ${target.role} → godmode`);
  console.log(`\n  ✓ "${username}" now owns this instance.`);
  console.log('    Restart the server so any cached session picks up the new role.\n');
  process.exit(0);
})().catch((err) => {
  fail(err.message);
});
