# Bedrock — Cloudflare Edge, CDN & DDoS Configuration

This guide details setting up Cloudflare (Free Tier) in front of the Bedrock application to handle the November 30 launch-day spike.

---

## 1. DNS & SSL/TLS Configuration

1. **Proxy Status**: Point your domain `bedrock.app` (and `api.bedrock.app`) to your origin server IP with **Proxied (Orange Cloud)** enabled.
2. **SSL/TLS Encryption Mode**: Set to **Full (Strict)**.
3. **Always Use HTTPS**: Enabled in `SSL/TLS` -> `Edge Certificates`.
4. **Minimum TLS Version**: Set to `TLS 1.2` or `TLS 1.3`.
5. **Opportunistic Encryption & TLS 1.3**: Enabled.

---

## 2. Web Application Firewall (WAF) Rules

Navigate to **Security** -> **WAF** -> **Custom Rules**:

### Rule 1: Challenge Suspicious Threat Score
* **Rule Name**: `Block High Threat Visitors`
* **Expression**: `(cf.threat_score gt 15 and not cf.client.bot)`
* **Action**: `Managed Challenge`

### Rule 2: Protect Authentication & Billing Endpoints
* **Rule Name**: `Throttle Sensitive Endpoints`
* **Expression**: `http.request.uri.path in {"/api/auth/login" "/api/auth/register" "/api/billing/create-order"}`
* **Action**: `Rate Limiting` (Threshold: 10 requests / 1 minute per IP)

---

## 3. Caching & Edge Optimization

Navigate to **Caching** -> **Cache Rules**:

* **Cache Static Assets**:
  * Match: `http.request.uri.path starts_with "/assets/"`
  * Edge TTL: `7 days`
  * Browser TTL: `1 day`
* **Bypass Dynamic API**:
  * Match: `http.request.uri.path starts_with "/api/"`
  * Action: `Bypass Cache` (handled by origin with SWR caching on `/api/status`)

---

## 4. Cloudflare Worker Deployment (Optional Edge Routing)

To deploy the included [`worker.js`](worker.js):
```bash
npx wrangler deploy cloudflare/worker.js --name bedrock-edge-guard
```
