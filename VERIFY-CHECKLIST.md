# The Nightly Librarian — Publish Verify Checklist

This checklist must pass before any issue is published. An agent or human reviewer runs through every item. A single BLOCKING failure halts publication.

---

## BLOCKING GATES (all must pass)

### Signal Structure

- [ ] **VG-COUNT**: Exactly 5 signals present
- [ ] **VG-SOURCE**: Every signal (1–5) has at least one `Source:` URL
- [ ] **VG-WORTH**: Every signal has a `BUILDER IMPACT:` section
- [ ] **VG-RELEVANCE**: Every `BUILDER IMPACT:` section has ≥10 words
- [ ] **VG-EVIDENCE**: Every signal has an `Evidence:` level (not "rumor")

### Sponsorship

- [ ] **VG-SPONSOR-POS**: Sponsor text appears ONLY in the allowed slot (first line after header)
- [ ] **VG-SPONSOR-EXPLAIN**: No unexplained sponsor language in editorial body
- [ ] **VG-AFFILIATE**: No affiliate links, discount codes, or paid placement language

### Tone & Framing

- [ ] **VG-TRY-NEXT**: "Try This" section uses neutral framing (no "must-have," "you need this")
- [ ] **VG-SUPERLATIVE**: No unsupported superlatives ("best," "revolutionary," "game-changing")
- [ ] **VG-HYPE**: No hype language ("changes everything," "paradigm shift")
- [ ] **VG-CULTURE**: No culture-war framing
- [ ] **VG-PARTISAN**: No partisan political framing
- [ ] **VG-PANIC**: No moral-panic framing ("threat to humanity," "doomsday")
- [ ] **VG-VENDOR**: No vendor cheerleading ("thrilled," "excited to announce")

### Cross-Signal Checks

- [ ] **VG-DEDUP**: No two signals refer to the same event (entity overlap, title similarity, or same source+category)
- [ ] **VG-STALE**: No source is older than 28 hours
- [ ] **VG-NO-IGNORE**: Brief does not contain an "IGNORE THIS" pile section

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
Blocking:      __ / 18 passed
Advisory:      __ / 5 passed
Cross-issue:   __ / 3 passed
Manual:        __ / 5 passed (MVP only)

PUBLISH:       [ ] APPROVED  [ ] BLOCKED
Block reason:  ________________________________
```
