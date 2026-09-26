-- Mantis PostgreSQL schema (Supabase, Neon, self-hosted Postgres)
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f server/database/mantis.postgres.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'godmode')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  project_key VARCHAR(10) NOT NULL UNIQUE,
  description TEXT,
  client VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'on-hold')),
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "Temp1" VARCHAR(500),
  "Temp2" VARCHAR(500),
  "Temp3" VARCHAR(500),
  "Temp4" VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, username)
);

CREATE TABLE IF NOT EXISTS bug_sequences (
  project_key VARCHAR(10) PRIMARY KEY,
  last_number INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bugs (
  id SERIAL PRIMARY KEY,
  bug_id VARCHAR(20) NOT NULL UNIQUE,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_key VARCHAR(10) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  client VARCHAR(100),
  module VARCHAR(100),
  environment VARCHAR(20) DEFAULT 'Development',
  severity VARCHAR(20) DEFAULT 'Medium',
  priority VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(20) DEFAULT 'Open',
  reporter VARCHAR(50) NOT NULL,
  assignee VARCHAR(50),
  qa_owner VARCHAR(50),
  qa_status VARCHAR(20) DEFAULT 'Not Started',
  target_fix_version VARCHAR(50),
  due_sla DATE,
  attachment_links TEXT,
  closure_reason VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  arb VARCHAR(500),
  "bugType" VARCHAR(20) DEFAULT 'Bug',
  triaged_at TIMESTAMP,
  attachments TEXT
);

CREATE TABLE IF NOT EXISTS bug_activity (
  id SERIAL PRIMARY KEY,
  bug_id VARCHAR(20) NOT NULL,
  "user" VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  temp1 VARCHAR(500),
  temp2 VARCHAR(500),
  temp3 VARCHAR(500),
  temp4 VARCHAR(500)
);

ALTER TABLE bug_activity ADD COLUMN IF NOT EXISTS temp1 VARCHAR(500);
ALTER TABLE bug_activity ADD COLUMN IF NOT EXISTS temp2 VARCHAR(500);
ALTER TABLE bug_activity ADD COLUMN IF NOT EXISTS temp3 VARCHAR(500);
ALTER TABLE bug_activity ADD COLUMN IF NOT EXISTS temp4 VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_bugs_project_key ON bugs(project_key);
CREATE INDEX IF NOT EXISTS idx_bugs_assignee ON bugs(assignee);
CREATE INDEX IF NOT EXISTS idx_bug_activity_bug_id ON bug_activity(bug_id);

-- Email tables (optional)
CREATE TABLE IF NOT EXISTS email_config (
  id SERIAL PRIMARY KEY,
  config_name VARCHAR(100) DEFAULT 'Default',
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INT DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT FALSE,
  smtp_user VARCHAR(255) NOT NULL,
  smtp_password VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(100) DEFAULT 'Mantis Reports',
  logo_url VARCHAR(500),
  company_name VARCHAR(100) DEFAULT 'Mantis',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
);

-- License tables
CREATE TABLE IF NOT EXISTS licenses (
  id SERIAL PRIMARY KEY,
  license_key TEXT,
  tier VARCHAR(20) DEFAULT 'community' CHECK (tier IN ('community','professional','enterprise','cloud')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','expired','suspended','trial')),
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  company_name VARCHAR(255),
  max_users INT,
  max_projects INT,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  last_validated_at TIMESTAMP,
  last_online_check TIMESTAMP,
  grace_period_ends TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feature_usage_log (
  id SERIAL PRIMARY KEY,
  feature_name VARCHAR(100) NOT NULL,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  allowed BOOLEAN NOT NULL,
  tier_required VARCHAR(50),
  current_tier VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS deployment_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(36)
);

-- Default admin (password: admin123 — change immediately)
INSERT INTO users (id, username, password, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '$2a$10$9g7kjWZT7pdTYg8SbWuoNe1ZQRVdSJcb3G8e2MsbUsaPB3pUR4Pgq',
  'admin'
) ON CONFLICT (username) DO NOTHING;

-- Note: run server seed or change password via UI after first login.
-- To hash admin123: node -e "console.log(require('bcryptjs').hashSync('admin123',10))"

INSERT INTO licenses (tier, status, max_users, max_projects)
SELECT 'community', 'active', 5, 3
WHERE NOT EXISTS (SELECT 1 FROM licenses LIMIT 1);

CREATE TABLE IF NOT EXISTS pulse_missions (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  intent TEXT NOT NULL,
  owner VARCHAR(50),
  target_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'hunting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pulse_mission_bugs (
  mission_id VARCHAR(36) NOT NULL,
  bug_id VARCHAR(20) NOT NULL PRIMARY KEY,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS pulse_calendar_sources (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  label VARCHAR(80) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
