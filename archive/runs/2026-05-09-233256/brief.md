═══════════════════════════════════════════
THE NIGHTLY LIBRARIAN
2026-05-10 — Issue #0
═══════════════════════════════════════════

Brought to you by Veremun — Verify any contractor's license in seconds.

─── THE 5 SIGNALS ─────────────────────────

1. ai@6.0.177
   ### Patch Changes - Updated dependencies [5c73af8] - @ai-sdk/gateway@3.0.112

   BUILDER IMPACT: Security update — check affected versions, patch availability, and exposure in your deployed stack. Highly actionable — concrete steps available.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/ai%406.0.177

2. ai@7.0.0-canary.127
   ### Patch Changes - e95e38d: fix: Make `generateText` and `streamText` result `usage` report total usage across all steps and deprecate `totalUsage`. - 016e877: feat(ai): add `instructions` as the primary prompt option and deprecate `system` - ca99fea: feat: expose `finalStep` on text generation results - d775a57: feat: introduce Instructions type - 538c12b: feat: use instructions on ToolCallRepairFunction, parseToolCall, and events - Updated dependencies [ca39020] - @ai-sdk/provider-utils@5.0.0-canary.36 - @ai-sdk/gateway@4.0.0-canary.74

   BUILDER IMPACT: Breaking change — check affected dependencies, migration notes, and release timing before upgrading.

   Evidence: official_changelog

   Source: https://github.com/vercel/ai/releases/tag/ai%407.0.0-canary.127

3. v0.9.3
   ### Added - 🔇 **Voice Mode mute control.** Voice Mode now includes a dedicated mute toggle with an "M" shortcut and auto-unmute after assistant playback, so you can prevent accidental interruptions from background noise without leaving the call overlay. [Commit](https://github.com/open-webui/open-webui/commit/072d2000f35a9f7b96342fa9bb28f925a92e7b4c), [#23832](https://github.com/open-webui/open-webui/issues/23832) - 🚀 **Faster prompt list loading.** Prompt and prompt-tag pages now load much faster for non-admin users, even with large prompt libraries, because accessible prompts are filtered efficiently in a single database query. [#24288](https://github.com/open-webui/open-webui/pull/24288), [#24258](https://github.com/open-webui/open-webui/discussions/24258) - ⚡ **Faster chat history loading.** Chat history maps now load from normalized message records when available, reducing overhead for large conversations while preserving fallback behavior for legacy chats.

   BUILDER IMPACT: General AI signal — evaluate whether it changes your stack, workflow, or roadmap.

   Evidence: official_changelog

   Source: https://github.com/open-webui/open-webui/releases/tag/v0.9.3

4. b9093
   model : add sarvam_moe architecture support (#20275) **macOS/iOS:** - [macOS Apple Silicon (arm64)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-macos-arm64.tar.gz) - [macOS Apple Silicon (arm64, KleidiAI enabled)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-macos-arm64-kleidiai.tar.gz) - [macOS Intel (x64)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-macos-x64.tar.gz) - [iOS XCFramework](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-xcframework.zip) **Linux:** - [Ubuntu x64 (CPU)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-x64.tar.gz) - [Ubuntu arm64 (CPU)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-arm64.tar.gz) - [Ubuntu s390x (CPU)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-s390x.tar.gz) - [Ubuntu x64 (Vulkan)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-vulkan-x64.tar.gz) - [Ubuntu arm64 (Vulkan)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-vulkan-arm64.tar.gz) - [Ubuntu x64 (ROCm 7.2)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-rocm-7.2-x64.tar.gz) - [Ubuntu x64 (OpenVINO)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-openvino-2026.0-x64.tar.gz) - [Ubuntu x64 (SYCL FP32)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-sycl-fp32-x64.tar.gz) - [Ubuntu x64 (SYCL FP16)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-ubuntu-sycl-fp16-x64.tar.gz) **Android:** - [Android arm64 (CPU)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-android-arm64.tar.gz) **Windows:** - [Windows x64 (CPU)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-win-cpu-x64.zip) - [Windows arm64 (CPU)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-win-cpu-arm64.zip) - [Windows x64 (CUDA 12)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-win-cuda-12.4-x64.zip) - [CUDA 12.4 DLLs](https://github.com/ggml-org/llama.cpp/releases/download/b9093/cudart-llama-bin-win-cuda-12.4-x64.zip) - [Windows x64 (CUDA 13)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-win-cuda-13.1-x64.zip) - [CUDA 13.1 DLLs](https://github.com/ggml-org/llama.cpp/releases/download/b9093/cudart-llama-bin-win-cuda-13.1-x64.zip) - [Windows x64 (Vulkan)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-win-vulkan-x64.zip) - [Windows x64 (SYCL)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-win-sycl-x64.zip) - [Windows x64 (HIP)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-win-hip-radeon-x64.zip) **openEuler:** - [openEuler x86 (310p)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-310p-openEuler-x86.tar.gz) - [openEuler x86 (910b, ACL Graph)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-910b-openEuler-x86-aclgraph.tar.gz) - [openEuler aarch64 (310p)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-310p-openEuler-aarch64.tar.gz) - [openEuler aarch64 (910b, ACL Graph)](https://github.com/ggml-org/llama.cpp/releases/download/b9093/llama-b9093-bin-910b-openEuler-aarch64-aclgraph.tar.gz)

   BUILDER IMPACT: General AI signal — evaluate whether it changes your stack, workflow, or roadmap.

   Evidence: official_changelog

   Source: https://github.com/ggml-org/llama.cpp/releases/tag/b9093

5. Using Claude Code: The Unreasonable Effectiveness of HTML
   Using Claude Code: The Unreasonable Effectiveness of HTML Thought-provoking piece by Thariq Shihipar (on the Claude Code team at Anthropic) advocating for HTML over Markdown as an output format to request from Claude. The article is crammed with interesting examples (collected on this site ) and prompt suggestions like this one: Help me review this PR by creating an HTML artifact that describes it. I'm not very familiar with the streaming/backpressure logic so focus on that.

   BUILDER IMPACT: Updates to claude code — directly affects your local development workflow and automation choices.

   Evidence: single_credible

   Source: https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html/#atom-everything

─── TRY THIS ───────────────────────────────

ai@5.0.186

### Patch Changes - Updated dependencies [c261259] - @ai-sdk/gateway@2.0.88 Security update — check affected versions, patch availability, and exposure in your deployed stack. Highly actionable — concrete steps available.

Time: 30-60 minutes

Source: https://github.com/vercel/ai/releases/tag/ai%405.0.186

─── LIBRARIAN'S VERDICT ────────────────────

Action items today: check if any deprecations or security issues affect your stack. Broad signal spread today across multiple categories.

═══════════════════════════════════════════
The Nightly Librarian — thenightlylibrarian.com
Unsubscribe | Archive
═══════════════════════════════════════════