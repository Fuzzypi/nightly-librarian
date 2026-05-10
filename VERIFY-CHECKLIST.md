# The Nightly Librarian — Publish Verify Checklist

This checklist must pass before any issue is published. An agent or human reviewer runs through every item. A single BLOCKING failure halts publication.

---

## BLOCKING GATES (all must pass)

### Source Integrity

- [ ] **VG-SOURCE**: Every signal (1–5) has at least one source reference with a valid URL
- [ ] **VG-STALE**: No source is older than 28 hours unless explicitly marked `[CONTEXT]`
- [ ] **VG-DEDUP**: No two signals refer to the same underlying event or announcement

### Editorial Contract

- [ ] **VG-IMPACT**: Every signal has a `BUILDER IMPACT:` section with ≥10 words
- [ ] **VG-ENTERPRISE**: No signal is enterprise-only without documented solo-builder relevance
- [ ] **VG-POLITICS**: No political or culture-war framing detected
- [ ] **VG-SUPERLATIVE**: No unsupported superlatives ("best," "revolutionary," "game-changing," "unprecedented") — each instance must have adjacent evidence

### Sponsorship

- [ ] **VG-SPONSOR**: Sponsor text appears ONLY in the allowed slot (first line after header)
- [ ] **VG-SPONSOR**: No sponsored content, affiliate links, or paid placement inside editorial body

### Format

- [ ] **VG-COUNT**: Exactly 5 signals present
- [ ] **VG-FORMAT**: All required sections present: header, sponsor line, The 5 Signals, Try This, Ignore This, Librarian's Verdict, footer
- [ ] **VG-TRY-CONCRETE**: "Try This" names a specific tool/API/technique AND includes a time estimate
- [ ] **VG-IGNORE-WHY**: "Ignore This" includes a causal explanation (≥15 words explaining why it's safe to skip)

---

## ADVISORY GATES (logged, do not block)

- [ ] **AG-VOICE**: Tone is consistent with previous 3 issues (no sudden shifts in formality, humor, or aggression)
- [ ] **AG-LENGTH**: Total issue length is 800–2000 words
- [ ] **AG-DIVERSITY**: Signals cover ≥3 different categories (model_release, api_change, tool_release, pricing_change, etc.)
- [ ] **AG-FRESHNESS**: ≥3 of 5 signals are from the last 12 hours
- [ ] **AG-READING-LEVEL**: Flesch-Kincaid grade level 8–12

---

## CROSS-ISSUE CHECKS (run against recent archive)

- [ ] No signal was the lead story in any of the last 3 issues (dedup across issues)
- [ ] "Try This" is not a repeat of a recommendation from the last 7 issues
- [ ] Sponsor rotation is following the weighted schedule (not stuck on one sponsor)

---

## MANUAL REVIEW ITEMS (MVP only — human reviewer)

- [ ] Read the full issue end-to-end. Does it feel useful?
- [ ] Would a solo developer scanning this over coffee learn something actionable?
- [ ] Is any claim stated as fact that should be stated as uncertain?
- [ ] Does the Librarian's Verdict take a clear position (not hedge)?
- [ ] Are there any vendor PR talking points that slipped through as editorial voice?

---

## RESULT

```
Date:          ____-__-__
Issue:         #___
Reviewer:      [human | agent]
Blocking:      __ / 13 passed
Advisory:      __ / 5 passed
Cross-issue:   __ / 3 passed
Manual:        __ / 5 passed (MVP only)

PUBLISH:       [ ] APPROVED  [ ] BLOCKED
Block reason:  ________________________________
```
