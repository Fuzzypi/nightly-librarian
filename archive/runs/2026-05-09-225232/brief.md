═══════════════════════════════════════════
THE NIGHTLY LIBRARIAN
2026-05-10 — Issue #0
═══════════════════════════════════════════

Brought to you by CalenCall — AI-powered phone reception for solo tradespeople.

─── THE 5 SIGNALS ─────────────────────────

1. @ai-sdk/google@3.0.71
   ### Patch Changes - 59530cf: fix(google): emit Vertex no-args streaming tool calls and preserve thoughtSignature Vertex emits a no-args function call as a single chunk shaped `{ functionCall: { name: 'X' } }` with no `args`, no `partialArgs`, and no `willContinue`. The streaming parser had no branch for this shape, so the call was dropped along with any `thoughtSignature` it carried. For Gemini 3 thinking models this caused the next multi-turn step to 400 with `missing thought_signature`.

   BUILDER IMPACT: Updates to continue — directly affects your local dev workflow. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/%40ai-sdk/google%403.0.71

2. v0.9.3
   ### Added - 🔇 **Voice Mode mute control.** Voice Mode now includes a dedicated mute toggle with an "M" shortcut and auto-unmute after assistant playback, so you can prevent accidental interruptions from background noise without leaving the call overlay. [Commit](https://github.com/open-webui/open-webui/commit/072d2000f35a9f7b96342fa9bb28f925a92e7b4c), [#23832](https://github.com/open-webui/open-webui/issues/23832) - 🚀 **Faster prompt list loading.** Prompt and prompt-tag pages now load much faster for non-admin users, even with large prompt libraries, because accessible prompts are filtered efficiently in a single database query. [#24288](https://github.com/open-webui/open-webui/pull/24288), [#24258](https://github.com/open-webui/open-webui/discussions/24258) - ⚡ **Faster chat history loading.** Chat history maps now load from normalized message records when available, reducing overhead for large conversations while preserving fallback behavior for legacy chats.

   BUILDER IMPACT: Updates to v0 — directly affects your local dev workflow.

   Evidence: official_changelog

   Source: https://github.com/open-webui/open-webui/releases/tag/v0.9.3

3. ai@6.0.177
   ### Patch Changes - Updated dependencies [5c73af8] - @ai-sdk/gateway@3.0.112

   BUILDER IMPACT: Security update — check if you're running affected versions. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/ai%406.0.177

4. ai@5.0.186
   ### Patch Changes - Updated dependencies [c261259] - @ai-sdk/gateway@2.0.88

   BUILDER IMPACT: Security update — check if you're running affected versions. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/ai%405.0.186

5. @ai-sdk/vue@3.0.177
   ### Patch Changes - ai@6.0.177

   BUILDER IMPACT: Security update — check if you're running affected versions. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/%40ai-sdk/vue%403.0.177

─── TRY THIS ───────────────────────────────

@ai-sdk/svelte@4.0.177

### Patch Changes - ai@6.0.177 Security update — check if you're running affected versions. Highly actionable — concrete steps available.

Time: 30-60 minutes

Source: https://github.com/vercel/ai/releases/tag/%40ai-sdk/svelte%404.0.177

─── LIBRARIAN'S VERDICT ────────────────────

Action items today: check if any deprecations or security issues affect your stack.

═══════════════════════════════════════════
The Nightly Librarian — thenightlylibrarian.com
Unsubscribe | Archive
═══════════════════════════════════════════