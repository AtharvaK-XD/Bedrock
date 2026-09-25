# Bedrock — Security Incident Response Plan (IRP)

**Target Launch Date**: November 30  
**Classification**: Internal / Operations Document  
**Version**: 1.0.0 (Production-Ready)

---

## 1. Incident Response Team & Escalation Matrix

| Role | Responsibility | Primary Contact |
| :--- | :--- | :--- |
| **Incident Commander** | Coordinates containment, key rotation, and user updates | `security@bedrock.app` |
| **Lead Backend Engineer** | Diagnoses logs, isolates services, rotates keys | On-Call Lead |
| **Infrastructure Lead** | Manages Cloudflare WAF, DB pools, and host environments | DevOps Team |

---

## 2. Threat Playbooks

### Playbook A: Leaked or Compromised API Key (Groq / OpenRouter / Razorpay / Clerk)

1. **Immediate Revocation (< 5 minutes)**:
   * **Groq / OpenRouter**: Log in to provider console and immediately delete or deactivate the compromised key.
   * **Razorpay**: Rotate Webhook Secret in Razorpay Dashboard (`Settings` -> `Webhooks`).
2. **Key Generation**:
   * Generate a fresh key with appropriate quota restrictions.
3. **Environment Injection**:
   * Update the environment variables in your hosting provider (Vercel, Railway, AWS ECS).
   * In Bedrock's backend, key arrays (`GROQ_API_KEYS`, `OPENROUTER_API_KEYS`) automatically hot-reload or restart gracefully with `npm run start`.
4. **Audit**:
   * Inspect backend `SecurityLog` table and provider usage dashboards to verify unauthorized token usage.

### Playbook B: Credential Stuffing & Brute Force Attacks

1. **Detection**:
   * Sentry / Backend alert triggered: `CREDENTIAL_STUFFING_ALERT` (> 5 failed logins from single IP).
2. **Mitigation**:
   * Origin rate limiter automatically throttles IP to 429 status code.
   * Add offending IP range to **Cloudflare WAF Custom Rules** (`Action: Block` or `Managed Challenge`).
3. **Account Safety**:
   * Require email verification link and force password reset for targeted email addresses.

### Playbook C: Launch Spike / DDoS / Provider Outages

1. **Degradation Detection**:
   * `/api/metrics` reports p95 latency > 5000ms or queue backlog > 20 requests.
2. **Mitigation Steps**:
   * Enable Cloudflare **"Under Attack Mode"** to challenge high-volume automated traffic at the edge.
   * The backend's `QueueService` will automatically queue concurrent LLM requests to prevent socket exhaustion.
   * In the event of primary provider outage, the `AiService` automatically falls back to secondary providers (`Groq` ➡️ `OpenRouter` ➡️ `Gemini` ➡️ `Paid Overflow Model`).
3. **Status Communication**:
   * Update public status page ([`/api/status`](file:///c:/Users/ATHARVA/Desktop/Bedrock/server/src/routes/health.ts)) to reflect component degradation so users are informed.

### Playbook D: Data Breach Notification Procedure

1. **Containment**: Immediately revoke all active user JWT tokens by rotating `JWT_SECRET`.
2. **Investigation**: Query database `SecurityLog` records to isolate affected records.
3. **User Communication (< 72 hours)**:
   * Send transparent advisory email to affected users detailing scope, containment measures, and next steps.

---

## 3. Post-Incident Review (PIR)

Every Sev-1 or Sev-2 incident requires a written PIR within 48 hours covering:
- Timeline of events
- Root cause analysis (5 Whys)
- Preventative backlog items
