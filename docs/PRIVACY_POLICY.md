# Bedrock — Privacy Policy

**Effective Date**: November 30, 2026  
**Last Updated**: September 25, 2026  

At Bedrock ("we", "our", or "us"), we value your privacy and are committed to protecting the prompts, ideas, and personal information you entrust to us.

---

## 1. Information We Collect

* **Account Data**: When you register, we collect your name, email address, and authentication credentials (hashed securely using Argon2id).
* **Prompt & Idea Content**: Idea submissions, clarifying question answers, prompt refinement instructions, and generated project briefs.
* **Technical & Usage Telemetry**: Latency, token count, model selected, IP address (anonymized for rate-limiting), and error logs.
* **Payment Records**: Subscription status, order IDs, and payment IDs provided by our payment gateway (Razorpay). **We never receive, process, or store raw credit/debit card numbers on Bedrock servers.**

---

## 2. How We Use User-Submitted Idea Text

* **Core Service Delivery**: User-submitted ideas are used exclusively to generate clarifying questions, implementation plans, and prompt assets via our AI engine.
* **No Model Training Guarantee**: **We do NOT use your submitted ideas, prompts, or briefs to train our own proprietary models or third-party foundational models.**
* **API Providers**: Prompts are transmitted to external inference providers (Groq, OpenRouter, Google) via zero-data-retention enterprise API endpoints where inputs are not used for provider training, in accordance with their respective commercial API terms.

---

## 3. Data Retention & Deletion

* **Saved Library Prompts**: Retained until explicitly deleted by you in your Library.
* **Traces & Metrics**: Execution traces are retained for 30 days for operational debugging and latency optimization, after which they are purged.
* **Account Deletion**: Upon account deletion, all associated prompts, workflows, traces, and personal records are permanently scrubbed from the active database within 48 hours.

---

## 4. Security Measures

We implement multi-layered defense-in-depth:
* Encryption in transit (TLS 1.3/HTTPS everywhere)
* Server-side secrets isolation (no API keys exposed to browsers)
* Strict per-endpoint rate-limiting and WAF filters
* Argon2id cryptographic password hashing

---

## 5. Contact Us

For questions or data deletion requests, contact our Data Protection Officer at:  
`privacy@bedrock.app`
