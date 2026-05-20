# Redundancy

## Operating Model

The system has two intended paths.

Primary path:

- Cowork / AI-assisted triage produces a high-quality digest.
- The artifact is marked completed and trusted only if the run finished cleanly and passed required policy gates.

Backup path:

- A VPS cron watchdog runs later.
- It checks whether the primary path produced a trusted completed digest for the expected date.
- If the primary path failed, the watchdog may produce a fallback digest.

## Fallback Labeling

Fallback output must be clearly labeled as fallback, unscored, raw, or reduced-quality if it lacks full AI triage.

Fallback content must never be presented as a normal scored digest.

## Staleness Rules

Delivery must never silently publish stale or fabricated reports.

The distribution layer should reject or clearly label:

- missing digest artifacts
- failed digest status
- partial digest status
- stale digest date
- fallback output without fallback metadata
- social drafts generated from untrusted input

## Social Generation Gate

Future social generation should consume only:

- completed trusted digest artifacts, or
- clearly labeled fallback artifacts that policy allows

No social posting should happen if digest status is failed, partial, or untrusted unless the output is explicitly marked fallback and approved by policy.

## Watchdog Principle

The watchdog should preserve trust before freshness. A late or fallback-labeled digest is acceptable. A fabricated, stale, or falsely normal digest is not.
