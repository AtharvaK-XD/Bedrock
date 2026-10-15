# Bedrock Automated Evaluation Benchmark Report
**Generated:** Thu, 15 Oct 2026 07:35:36 GMT
**Prompt Revision Hash:** `v20261015`
**Overall Pass Rate:** **80%** (72/90 tests passed)

---

## 1. Executive Metric Summary
| Metric | Score / Value | Status |
|:---|:---|:---|
| **Average Composite Score** | **79 / 100** | 🔴 Needs Tuning |
| **Format Compliance** | 77 / 100 | ⚠️ Deviations |
| **Topic Precision** | 72 / 100 | ⚠️ Drift |
| **Forbidden Term Hygiene** | 91 / 100 | ✅ Clean |
| **Models Dropped / Unreliable** | 1 combinations | 🚨 Action Required |

---

## 2. Model Reliability & Status Matrix
| Model | Profile | Total Runs | Pass Rate | Composite | Status |
|:---|:---|:---|:---|:---|:---|
| `gemini-3.8-flash` | hackathon_pitch | 18 | 100% | 87/100 | 🟢 **RELIABLE** |
| `llama-3.3-70b-versatile` | hackathon_pitch | 18 | 100% | 87/100 | 🟢 **RELIABLE** |
| `deepseek-r1-distill-llama-70b` | hackathon_pitch | 18 | 100% | 87/100 | 🟢 **RELIABLE** |
| `gpt-4o-mini` | hackathon_pitch | 18 | 100% | 87/100 | 🟢 **RELIABLE** |
| `hf/zephyr-7b-beta` | hackathon_pitch | 18 | 0% | 47/100 | 🔴 **DROPPED** |

---

## 3. Unreliable Dropped Models
- ❌ **Model `hf/zephyr-7b-beta` dropped for profile `hackathon_pitch`**: Low composite score (47/100) and failing pass rate (0%)

---

## 4. Test Case Breakdown
| Test Case | Profile | Model | Score | Grade | Result |
|:---|:---|:---|:---|:---|:---|
| pitch-01 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-02 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-03 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-04 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-05 | hackathon_pitch | `gemini-3.8-flash` | 84/100 | **B** | ✅ PASS |
| pitch-06 | hackathon_pitch | `gemini-3.8-flash` | 95/100 | **S** | ✅ PASS |
| pitch-07 | hackathon_pitch | `gemini-3.8-flash` | 84/100 | **B** | ✅ PASS |
| pitch-08 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-09 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-10 | hackathon_pitch | `gemini-3.8-flash` | 88/100 | **A** | ✅ PASS |
| pitch-11 | hackathon_pitch | `gemini-3.8-flash` | 84/100 | **B** | ✅ PASS |
| pitch-12 | hackathon_pitch | `gemini-3.8-flash` | 88/100 | **A** | ✅ PASS |
| pitch-13 | hackathon_pitch | `gemini-3.8-flash` | 84/100 | **B** | ✅ PASS |
| pitch-14 | hackathon_pitch | `gemini-3.8-flash` | 84/100 | **B** | ✅ PASS |
| pitch-15 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-16 | hackathon_pitch | `gemini-3.8-flash` | 89/100 | **A** | ✅ PASS |
| pitch-17 | hackathon_pitch | `gemini-3.8-flash` | 84/100 | **B** | ✅ PASS |
| pitch-18 | hackathon_pitch | `gemini-3.8-flash` | 84/100 | **B** | ✅ PASS |
| pitch-01 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-02 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-03 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-04 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-05 | hackathon_pitch | `llama-3.3-70b-versatile` | 84/100 | **B** | ✅ PASS |
| pitch-06 | hackathon_pitch | `llama-3.3-70b-versatile` | 95/100 | **S** | ✅ PASS |
| pitch-07 | hackathon_pitch | `llama-3.3-70b-versatile` | 84/100 | **B** | ✅ PASS |
| pitch-08 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-09 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-10 | hackathon_pitch | `llama-3.3-70b-versatile` | 88/100 | **A** | ✅ PASS |
| pitch-11 | hackathon_pitch | `llama-3.3-70b-versatile` | 84/100 | **B** | ✅ PASS |
| pitch-12 | hackathon_pitch | `llama-3.3-70b-versatile` | 88/100 | **A** | ✅ PASS |
| pitch-13 | hackathon_pitch | `llama-3.3-70b-versatile` | 84/100 | **B** | ✅ PASS |
| pitch-14 | hackathon_pitch | `llama-3.3-70b-versatile` | 84/100 | **B** | ✅ PASS |
| pitch-15 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-16 | hackathon_pitch | `llama-3.3-70b-versatile` | 89/100 | **A** | ✅ PASS |
| pitch-17 | hackathon_pitch | `llama-3.3-70b-versatile` | 84/100 | **B** | ✅ PASS |
| pitch-18 | hackathon_pitch | `llama-3.3-70b-versatile` | 84/100 | **B** | ✅ PASS |
| pitch-01 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 89/100 | **A** | ✅ PASS |
| pitch-02 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 89/100 | **A** | ✅ PASS |
| pitch-03 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 89/100 | **A** | ✅ PASS |
| pitch-04 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 89/100 | **A** | ✅ PASS |
| pitch-05 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 84/100 | **B** | ✅ PASS |
| pitch-06 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 95/100 | **S** | ✅ PASS |
| pitch-07 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 84/100 | **B** | ✅ PASS |
| pitch-08 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 89/100 | **A** | ✅ PASS |
| pitch-09 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 89/100 | **A** | ✅ PASS |
| pitch-10 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 88/100 | **A** | ✅ PASS |
| pitch-11 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 84/100 | **B** | ✅ PASS |
| pitch-12 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 88/100 | **A** | ✅ PASS |
| pitch-13 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 84/100 | **B** | ✅ PASS |
| pitch-14 | hackathon_pitch | `deepseek-r1-distill-llama-70b` | 84/100 | **B** | ✅ PASS |

*(Showing 50 of 90 total test results)*
