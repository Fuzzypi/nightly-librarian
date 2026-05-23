═══════════════════════════════════════════
THE NIGHTLY LIBRARIAN
2026-05-09 — Issue #0
═══════════════════════════════════════════

Brought to you by Veremun — Verify any contractor's license in seconds.

─── THE 5 SIGNALS ─────────────────────────

1. @ai-sdk/google@3.0.71
   ### Patch Changes - 59530cf: fix(google): emit Vertex no-args streaming tool calls and preserve thoughtSignature Vertex emits a no-args function call as a single chunk shaped `{ functionCall: { name: 'X' } }` with no `args`, no `partialArgs`, and no `willContinue`. The streaming parser had no branch for this shape, so the call was dropped along with any `thoughtSignature` it carried. For Gemini 3 thinking models this caused the next multi-turn step to 400 with `missing thought_signature`.

   BUILDER IMPACT: Directly affects tools and APIs that solo developers rely on in daily workflows. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/%40ai-sdk/google%403.0.71

2. ai@6.0.177
   ### Patch Changes - Updated dependencies [5c73af8] - @ai-sdk/gateway@3.0.112

   BUILDER IMPACT: Directly affects tools and APIs that solo developers rely on in daily workflows. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/ai%406.0.177

3. ai@5.0.186
   ### Patch Changes - Updated dependencies [c261259] - @ai-sdk/gateway@2.0.88

   BUILDER IMPACT: Directly affects tools and APIs that solo developers rely on in daily workflows. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/ai%405.0.186

4. @ai-sdk/vue@3.0.177
   ### Patch Changes - ai@6.0.177

   BUILDER IMPACT: Directly affects tools and APIs that solo developers rely on in daily workflows. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/%40ai-sdk/vue%403.0.177

5. @ai-sdk/svelte@4.0.177
   ### Patch Changes - ai@6.0.177

   BUILDER IMPACT: Directly affects tools and APIs that solo developers rely on in daily workflows. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/%40ai-sdk/svelte%404.0.177

─── TRY THIS ───────────────────────────────

@ai-sdk/rsc@2.0.177

### Patch Changes - ai@6.0.177 Directly affects tools and APIs that solo developers rely on in daily workflows. Highly actionable — concrete steps available.

Time: 30-60 minutes

Source: https://github.com/vercel/ai/releases/tag/%40ai-sdk/rsc%402.0.177

─── LIBRARIAN'S VERDICT ────────────────────

A day of tooling updates. Review the changes and test any that touch your workflow.

═══════════════════════════════════════════
The Nightly Librarian — thenightlylibrarian.com
Unsubscribe | Archive
═══════════════════════════════════════════