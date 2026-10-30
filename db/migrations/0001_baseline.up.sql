-- 0001_baseline: records the tables the code already relies on so the DB can be rebuilt from the repo.
-- Source of truth used: server/prisma/schema.prisma (read 2026-10-30). NOT yet compared with the live Neon schema.
-- On a database that already has these tables this does nothing (every statement is IF NOT EXISTS).
-- migrate:break
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  avatar_initials TEXT,
  plan TEXT NOT NULL DEFAULT 'Free Plan',
  role TEXT NOT NULL DEFAULT 'Lead Prompt Architect',
  bio TEXT,
  location TEXT,
  organization TEXT,
  github TEXT,
  huggingface TEXT,
  website TEXT,
  joined_date TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  razorpay_customer_id TEXT,
  razorpay_subscription_id TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
-- migrate:break
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"(email);
-- migrate:break
CREATE TABLE IF NOT EXISTS "Prompt" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  title TEXT NOT NULL,
  snippet TEXT NOT NULL,
  full_content TEXT NOT NULL,
  tags TEXT NOT NULL,
  target_type TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
-- migrate:break
CREATE TABLE IF NOT EXISTS "Trace" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  node_origin TEXT NOT NULL,
  model_target TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- migrate:break
CREATE TABLE IF NOT EXISTS "BranchingTree" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  title TEXT NOT NULL,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
-- migrate:break
CREATE TABLE IF NOT EXISTS "SecurityLog" (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO',
  ip_address TEXT,
  endpoint TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- migrate:break
CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  user_id TEXT,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL,
  response_body TEXT,
  response_code INTEGER,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP(3) NOT NULL
);
-- migrate:break
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_key_key" ON "IdempotencyKey"(key);
-- migrate:break
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  order_id TEXT NOT NULL,
  payment_id TEXT,
  signature TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL,
  tier TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
-- migrate:break
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_order_id_key" ON "PaymentRecord"(order_id);
-- migrate:break
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_payment_id_key" ON "PaymentRecord"(payment_id);
