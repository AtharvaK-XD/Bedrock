# Bedrock — Data Retention Policy

**Target Launch Date**: November 30, 2026  
**Document Status**: Official Internal Policy  

---

## 1. Scope & Purpose

This policy governs the retention schedules, storage guidelines, and deletion procedures for all data ingested, processed, or generated across Bedrock systems.

---

## 2. Retention Schedules by Data Classification

| Data Category | Examples | Storage Location | Retention Window | Deletion Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **User Account Data** | Name, email, Argon2 hash | User Table (SQLite/Neon) | Duration of active account | Permanent delete upon account closure |
| **User Prompts & Workflows** | Saved trees, prompt markdown | Prompt & BranchingTree | Duration of active account | Cascade delete on User removal or manual deletion |
| **Performance Traces** | Latency, token counts, model | Trace Table | **30 Days** | Automatic rolling purge cron |
| **Security Audit Logs** | Failed logins, rate limits | SecurityLog Table | **90 Days** | Rolling archive & purge |
| **Idempotency Keys** | Replay response caches | IdempotencyKey Table | **24 Hours** | Expiry TTL deletion |
| **Anonymous Session Data** | Guest profile fallback | In-memory / LocalStorage | **Session or 5 Hours** | Client refresh / storage reset |

---

## 3. Account Deletion Workflow

When an account is deleted via user request or administrative action:
1. All foreign key records in `Prompt`, `BranchingTree`, `Trace`, and `PaymentRecord` are purged via database `ON DELETE CASCADE`.
2. Auth cookies are cleared with `Max-Age: 0`.
3. Cached responses in memory/Redis associated with the user ID are evicted immediately.
