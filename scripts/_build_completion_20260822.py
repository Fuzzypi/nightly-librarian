#!/usr/bin/env python3
"""One-off builder for the 2026-08-22 Nightly Librarian completion payload."""
import json, sys, subprocess, datetime

CLAIM = "/tmp/nl-claim2.json"
OUT = "/tmp/nl-completion.json"
DATE = "2026-08-22"

d = json.load(open(CLAIM))
run_id = d["run_id"]
items = {i["raw_item_id"]: i for i in d["items"]}
deferred = d["pre_triage"]["deferred_ids"]

# id-prefix -> (title, source, url) for deferred items, filled from DB dump
DEFERRED_META = json.load(open("/tmp/nl-deferred-meta.json"))
for m in DEFERRED_META:
    items.setdefault(m["raw_item_id"], m)

Z = dict(score_worth_mentioning=0, score_solo_dev_relevance=0, score_owner_work_relevance=0,
         score_future_work_relevance=0, score_decision_impact=0, score_evidence_strength=0,
         score_cost_time_leverage=0, score_risk_reduction=0, score_business_opportunity=0,
         score_hype_risk=0, score_novelty_penalty=0)

def S(**kw):
    s = dict(Z); s.update(kw); return s

# prefix -> record
SCORES = {}

def add(prefix, title, summary, claim, category, evidence, verdict, reason,
        uncertainty="", worth="", **scores):
    SCORES[prefix] = dict(title=title, summary=summary, raw_claim=claim, category=category,
                          evidence_level=evidence, verdict=verdict, verdict_reason=reason,
                          uncertainty=uncertainty, worth_mentioning_reason=worth,
                          scores=S(**scores))

REJ = dict(category="solo_business", evidence="early_signal", verdict="reject")

# ---------------- PUBLISH_PUBLIC ----------------
add("a65ab5dd",
    "GPT-5.6 Sol list price cut, and Vercel's 50% AI Gateway discount now applies to the lower price",
    "OpenAI cut list pricing for GPT-5.6 Sol: input down ~20% and output down about a third. Vercel's existing 50% AI Gateway discount stacks on top of the new lower price through September 18. If you route any GPT-5.6 Sol traffic, re-check your per-token cost assumptions and consider pulling batch or backfill work forward before the discount window closes.",
    "OpenAI lowered GPT-5.6 Sol list pricing (input -20%, output -33%) and Vercel's 50% AI Gateway discount applies to the new price through September 18, 2026.",
    "pricing_cost", "vendor_claim", "publish_public",
    "Direct, dated cost change that shifts near-term routing and batching decisions.",
    uncertainty="The changelog text is partially truncated in the feed; exact per-million-token figures should be confirmed on the pricing page.",
    worth="A dated discount window plus a permanent list-price cut is an immediately actionable cost lever.",
    score_worth_mentioning=5, score_solo_dev_relevance=5, score_owner_work_relevance=4,
    score_future_work_relevance=4, score_decision_impact=5, score_evidence_strength=4,
    score_cost_time_leverage=5, score_risk_reduction=1, score_business_opportunity=2,
    score_hype_risk=0, score_novelty_penalty=1)

add("41e25687",
    "Cloudflare launches Bot Preference Sync to auto-align robots.txt with AI bot policy",
    "Cloudflare now generates and syncs robots.txt from your configured AI bot policies across Search, Agent, and Training categories, instead of you hand-maintaining a static file. For anyone hosting on Cloudflare this collapses a chronically stale config into one managed setting. Worth checking your zones: an implicit policy change here alters who can crawl and train on your content.",
    "Cloudflare released Bot Preference Sync, which automatically keeps robots.txt aligned with a zone's configured AI bot policies for Search, Agent, and Training.",
    "api_platform_change", "vendor_claim", "publish_public",
    "Platform-level change to crawl/training access control on infrastructure the audience already runs.",
    uncertainty="Unclear whether the sync overwrites an existing hand-written robots.txt or merges with it.",
    worth="Changes a real configuration decision for anyone serving content behind Cloudflare.",
    score_worth_mentioning=4, score_solo_dev_relevance=4, score_owner_work_relevance=4,
    score_future_work_relevance=4, score_decision_impact=4, score_evidence_strength=4,
    score_cost_time_leverage=3, score_risk_reduction=4, score_business_opportunity=2,
    score_hype_risk=1, score_novelty_penalty=1)

add("45d202b5",
    "Ollama v0.33.0 ships MLX cross-platform fixes and a Claude Desktop app integration",
    "Ollama v0.33.0 fixes MLX code that wrongly assumed macOS when running on Linux and Windows, refreshes the MLX backend, and adds a Claude Desktop app integration plus onboarding polish. If you run local models on a Mac and wire them into desktop agents, this is the release that makes the MLX path less mac-specific and the Claude Desktop hop first-class. Upgrade is low-risk; the MLX fixes matter most if you run mixed-OS hosts.",
    "Ollama v0.33.0 adds a Claude Desktop app integration, updates MLX, and fixes MLX assumptions that broke on Linux and Windows.",
    "open_source", "vendor_claim", "publish_public",
    "Concrete release with user-facing features on a tool central to local-model and agent workflows.",
    uncertainty="Item was fetched from an -rc2 tag URL, so the exact final v0.33.0 changelog may differ slightly.",
    worth="Direct leverage for local-model work and desktop agent wiring.",
    score_worth_mentioning=4, score_solo_dev_relevance=4, score_owner_work_relevance=5,
    score_future_work_relevance=4, score_decision_impact=3, score_evidence_strength=4,
    score_cost_time_leverage=3, score_risk_reduction=2, score_business_opportunity=1,
    score_hype_risk=0, score_novelty_penalty=1)

add("3c37e9b1",
    "Show HN: Shoehorn quantizes arbitrary models to fit the machine you actually have",
    "Shoehorn is a cross-platform (Mac/Linux/Windows) tool that quantizes models down to fit local hardware, with a GUI for discovering models and running the build. The author reports it working across several models and documents the approach in the repo's README and DESIGN.md. If you have been hand-rolling quantization to squeeze a model onto a laptop, this is worth a trial run before you write more scripts.",
    "Shoehorn is a new open-source cross-platform tool with a GUI that quantizes arbitrary models to run on local hardware.",
    "open_source", "builder_reported", "publish_public",
    "Open source release with genuine time leverage for local-inference work; author documents method rather than just claiming results.",
    uncertainty="Single-author Show HN with no third-party benchmarks; quality loss across quantization targets is unverified.",
    worth="Removes a recurring manual step for anyone running local models on constrained hardware.",
    score_worth_mentioning=4, score_solo_dev_relevance=4, score_owner_work_relevance=4,
    score_future_work_relevance=3, score_decision_impact=3, score_evidence_strength=2,
    score_cost_time_leverage=4, score_risk_reduction=1, score_business_opportunity=1,
    score_hype_risk=1, score_novelty_penalty=2)

# ---------------- PUBLISH_PRIVATE ----------------
add("06ec5564",
    "Haystack 3.1.0-rc3 makes Jinja custom_filters deserialization opt-in via unsafe flag",
    "Haystack 3.1.0-rc now refuses to load serialized OutputAdapter and ConditionalRouter components containing Jinja custom_filters unless you explicitly pass unsafe=True, with a HAYSTACK_UNSAFE_DESERIALIZATION env var as the process-wide equivalent. This is a deliberate hardening of a code-execution path in pipeline deserialization. If you load pipeline definitions from anywhere you do not fully control, this is the correct default and you should not reach for the escape hatch.",
    "Haystack 3.1.0-rc3 requires an explicit unsafe=True flag or HAYSTACK_UNSAFE_DESERIALIZATION env var to deserialize pipeline components containing Jinja custom_filters.",
    "security_risk", "vendor_claim", "publish_private",
    "Real security hardening with a breaking upgrade note, but scoped to Haystack users and still a release candidate.",
    uncertainty="Release candidate; final 3.1.0 behavior could change.",
    worth="Anyone deserializing untrusted pipeline configs needs to know the default flipped.",
    score_worth_mentioning=3, score_solo_dev_relevance=2, score_owner_work_relevance=2,
    score_future_work_relevance=3, score_decision_impact=3, score_evidence_strength=4,
    score_cost_time_leverage=1, score_risk_reduction=4, score_business_opportunity=0,
    score_hype_risk=0, score_novelty_penalty=1)

add("1e389f45",
    "Vercel Deployment Storage keeps prior deployment files inspectable and rollback-ready",
    "Vercel now retains the files each deployment produces — pages, functions, assets — so you can inspect an earlier deployment and roll production back to it in seconds. This turns rollback from a redeploy-and-pray operation into an actual restore. If you ship to Vercel without a staging gate, this is the cheapest incident-response improvement available to you right now.",
    "Vercel introduced Deployment Storage, retaining per-deployment files so previous deployments can be inspected and rolled back to instantly.",
    "infrastructure", "vendor_claim", "publish_private",
    "Meaningful operational risk reduction, but only for teams already deployed on Vercel.",
    uncertainty="Retention window and any storage cost implications are not stated in the changelog excerpt.",
    worth="Changes the rollback plan for anyone shipping to Vercel production.",
    score_worth_mentioning=3, score_solo_dev_relevance=3, score_owner_work_relevance=2,
    score_future_work_relevance=3, score_decision_impact=3, score_evidence_strength=4,
    score_cost_time_leverage=3, score_risk_reduction=4, score_business_opportunity=0,
    score_hype_risk=0, score_novelty_penalty=1)

add("66e8b44c",
    "Vercel CLI adds first-class DNS, domain, and project commands",
    "The Vercel CLI now has dedicated commands for managing DNS records, domains, and projects, including retrieving a full DNS record config and updating it in place. Vercel explicitly frames this as usable by agents, not just humans. If you have been shelling out to the REST API from automation, the CLI surface is now wide enough to script directly.",
    "Vercel CLI gained dedicated DNS record, domain, and project management commands intended for interactive, scripted, and agent use.",
    "automation", "vendor_claim", "publish_private",
    "Useful automation surface expansion, but narrow to Vercel users.",
    worth="Removes a hand-rolled API wrapper for anyone automating Vercel infrastructure.",
    score_worth_mentioning=3, score_solo_dev_relevance=3, score_owner_work_relevance=3,
    score_future_work_relevance=3, score_decision_impact=2, score_evidence_strength=4,
    score_cost_time_leverage=3, score_risk_reduction=1, score_business_opportunity=0,
    score_hype_risk=0, score_novelty_penalty=1)

add("bc08bbc5",
    "Vercel Connect lets v0 apps and agents authenticate into 100+ third-party services",
    "Apps and agents built in v0 can now connect to more than 100 external services — Slack, Google, Notion, GitHub, Salesforce — through Vercel Connect, with the connection flow driven by prompting rather than hand-wiring OAuth. This is the managed-integration layer that agent builders keep rebuilding themselves. Worth evaluating against maintaining your own connector credentials if you are already in the Vercel ecosystem.",
    "Vercel Connect enables v0-built apps and agents to securely connect to 100+ third-party services including Slack, Google, Notion, GitHub, and Salesforce.",
    "agent_workflow", "vendor_claim", "publish_private",
    "Relevant to agent/integration work but locks the pattern to one vendor's platform.",
    uncertainty="Unclear whether Connect is usable outside v0-authored apps.",
    worth="Directly overlaps with hand-built MCP/connector plumbing.",
    score_worth_mentioning=3, score_solo_dev_relevance=3, score_owner_work_relevance=4,
    score_future_work_relevance=4, score_decision_impact=2, score_evidence_strength=3,
    score_cost_time_leverage=3, score_risk_reduction=1, score_business_opportunity=2,
    score_hype_risk=2, score_novelty_penalty=1)

add("678e626f",
    "DeepSeek V4 Flash with vision lands on Vercel AI Gateway (experimental)",
    "An experimental DeepSeek V4 Flash variant that accepts images alongside text is now routable through Vercel's AI Gateway — describe an image, OCR a screenshot, or read a chart in the same request as text. Flash-tier vision at DeepSeek pricing is a plausible cost floor for bulk screenshot and document work. Treat as experimental: do not put it on a path you cannot fall back from.",
    "DeepSeek V4 Flash with vision (experimental) is now available through Vercel AI Gateway and accepts images alongside text in a single request.",
    "model_change", "vendor_claim", "publish_private",
    "New cheap multimodal option worth knowing, but experimental and single-gateway.",
    uncertainty="No published accuracy or latency numbers; 'experimental' implies no stability guarantee.",
    worth="Potential low-cost path for screenshot and chart extraction workloads.",
    score_worth_mentioning=3, score_solo_dev_relevance=3, score_owner_work_relevance=3,
    score_future_work_relevance=3, score_decision_impact=2, score_evidence_strength=3,
    score_cost_time_leverage=3, score_risk_reduction=0, score_business_opportunity=2,
    score_hype_risk=1, score_novelty_penalty=1)

add("6ebe5dd6",
    "Vercel Sandbox CLI 4.0.1 rewrites its output and errors for agent consumption",
    "Sandbox CLI 4.0.1 ships four output and error improvements whose common theme is that every message now states the next action rather than leaving the caller to infer it — including a connect hint appended to fresh-sandbox output. This is small but it is exactly the failure mode that makes CLIs unusable inside agent loops. A useful pattern to copy if you are writing tools an agent has to drive.",
    "Vercel Sandbox CLI 4.0.1 changed its output and error messages to always state the next action, making the CLI easier for agents to drive.",
    "agent_workflow", "vendor_claim", "publish_private",
    "Small release, but the design pattern generalizes to anyone building agent-drivable tooling.",
    worth="Concrete example of making CLI output machine-actionable inside agent loops.",
    score_worth_mentioning=2, score_solo_dev_relevance=3, score_owner_work_relevance=3,
    score_future_work_relevance=3, score_decision_impact=1, score_evidence_strength=4,
    score_cost_time_leverage=2, score_risk_reduction=1, score_business_opportunity=0,
    score_hype_risk=0, score_novelty_penalty=2)

add("05d94aa4",
    "Ora's writeup on benchmarking every major AI agent harness on one platform",
    "Ora describes running every major agent harness side by side against live sites, with front end, back end, and agent runtime all on Vercel — the core problem being that each harness expects its own infrastructure. It is a vendor-published builder report, so read it for the harness-comparison methodology rather than the conclusion. Useful if you are choosing between agent frameworks and want a picture of what standardizing the substrate costs.",
    "Ora benchmarks every major AI agent harness side by side on live sites using a single Vercel-hosted platform for front end, back end, and agent runtime.",
    "builder_report", "builder_reported", "publish_private",
    "Genuinely useful methodology, but vendor-published and therefore not neutral.",
    uncertainty="No raw benchmark numbers in the excerpt; the vendor hosts the platform being praised.",
    worth="Rare side-by-side comparison of agent harnesses under one runtime.",
    score_worth_mentioning=3, score_solo_dev_relevance=3, score_owner_work_relevance=4,
    score_future_work_relevance=4, score_decision_impact=2, score_evidence_strength=2,
    score_cost_time_leverage=2, score_risk_reduction=1, score_business_opportunity=1,
    score_hype_risk=2, score_novelty_penalty=1)

add("2f2d4adb",
    "Hugging Face measures benchmark optimization in speech recognition",
    "A Hugging Face writeup quantifying how much ASR leaderboard performance reflects benchmark-specific optimization rather than general transcription quality. If you pick a speech model off a leaderboard, this is the correction to that instinct: test on your own audio distribution before committing. Relevant to any voice-agent or transcription pipeline where leaderboard WER has been standing in for real-world accuracy.",
    "Hugging Face published an analysis measuring how much speech recognition benchmark results reflect optimization to the benchmark rather than general performance.",
    "voice_agents", "reproducible", "publish_private",
    "Methodologically valuable for model selection, but narrow to teams building on ASR.",
    uncertainty="Feed content was empty; assessment is based on the title and Hugging Face's blog conventions, so the specific findings are unverified.",
    worth="Directly challenges leaderboard-driven ASR model selection.",
    score_worth_mentioning=3, score_solo_dev_relevance=2, score_owner_work_relevance=4,
    score_future_work_relevance=4, score_decision_impact=3, score_evidence_strength=3,
    score_cost_time_leverage=2, score_risk_reduction=3, score_business_opportunity=1,
    score_hype_risk=0, score_novelty_penalty=2)

add("72913c0f",
    "Show HN: OzBrain, a shared knowledge layer for agents and teammates",
    "OzBrain is a shared knowledge store built on the premise that agents, not humans, will be the primary readers and writers of research and analysis — so notes tools designed for human browsing are the wrong shape. Whether or not the product lands, the framing is the interesting part for anyone maintaining a persistent memory layer for agents. Worth a look as a design comparison, not as a dependency.",
    "OzBrain launched as a shared knowledge store designed for AI agents rather than humans to be the primary consumers of stored research and analysis.",
    "agent_workflow", "early_signal", "publish_private",
    "Direct conceptual overlap with agent memory work, but an unproven early launch.",
    uncertainty="No evidence of production usage, retrieval quality, or durability; pure launch post.",
    worth="Adjacent design point for anyone building an agent-facing memory layer.",
    score_worth_mentioning=2, score_solo_dev_relevance=2, score_owner_work_relevance=4,
    score_future_work_relevance=3, score_decision_impact=1, score_evidence_strength=1,
    score_cost_time_leverage=1, score_risk_reduction=0, score_business_opportunity=2,
    score_hype_risk=3, score_novelty_penalty=2)

add("3a76f666",
    "Builder report: BYOK pricing wins on paper and loses at the API-key setup step",
    "A developer shipped a $19.99 one-time transcription tool where users bring their own Deepgram key, paying roughly 30 cents an hour instead of $15 a month — clearly cheaper — and found that users bail during key setup, not at the price. The economics were never the objection; the onboarding was. If you are considering BYOK to dodge usage margin, budget the real cost in an assisted key-provisioning flow, not in the pricing page.",
    "A solo builder reports that a BYOK transcription product with clearly superior unit economics loses users at the API key setup step rather than on price.",
    "solo_business", "builder_reported", "publish_private",
    "First-hand conversion data on a pricing model many solo builders are actively considering.",
    uncertainty="Single product, no conversion numbers given; may not generalize beyond technical-key setup flows.",
    worth="Concrete counterexample to the assumption that BYOK removes a purchase objection.",
    score_worth_mentioning=3, score_solo_dev_relevance=4, score_owner_work_relevance=2,
    score_future_work_relevance=3, score_decision_impact=3, score_evidence_strength=2,
    score_cost_time_leverage=2, score_risk_reduction=2, score_business_opportunity=3,
    score_hype_risk=1, score_novelty_penalty=2)

# ---------------- MONITOR ----------------
add("c5081aaa",
    "Latent Space: Simile's Joon Sung Park on simulation as the next scaling law",
    "The Generative Agents author is now building Simile, pitching population-scale digital twins as a research and product substrate. It is a podcast interview, so treat the scaling-law framing as a thesis rather than a result. Track it: if agent-population simulation becomes a usable evaluation surface, it changes how you test agent behavior — but nothing to act on today.",
    "Simile CEO Joon Sung Park argues simulation is the next scaling law and is building population-scale digital twins from the Generative Agents research line.",
    "agent_workflow", "early_signal", "monitor",
    "Credible researcher and a real thesis, but conversational evidence with no near-term action.",
    uncertainty="No published results, benchmarks, or availability; entirely a forward-looking claim.",
    worth="Early signal on simulation-based agent evaluation from a credible source.",
    score_worth_mentioning=2, score_solo_dev_relevance=1, score_owner_work_relevance=2,
    score_future_work_relevance=4, score_decision_impact=1, score_evidence_strength=2,
    score_cost_time_leverage=0, score_risk_reduction=0, score_business_opportunity=2,
    score_hype_risk=3, score_novelty_penalty=2)

add("cb135447",
    "Stratechery weekly roundup 2026.34: Apple's EU compromises",
    "Stratechery's weekly digest for the week of August 17, covering Apple conceding ground in the EU alongside unrelated media and sports commentary. The Apple/EU thread is the only part with distribution implications for app developers, and it is a summary of paywalled analysis rather than primary reporting. Track the EU regulatory direction; nothing here changes a decision this week.",
    "Stratechery's weekly roundup for August 17, 2026 covers Apple making regulatory compromises in the EU among other topics.",
    "distribution", "early_signal", "monitor",
    "Mostly a paywalled weekly digest with one thread of genuine platform relevance; not directly actionable.",
    uncertainty="Content is a summary of paywalled analysis; specifics of the Apple EU concessions are not in the excerpt.",
    worth="EU platform regulation shifts eventually affect app distribution economics.",
    score_worth_mentioning=2, score_solo_dev_relevance=1, score_owner_work_relevance=1,
    score_future_work_relevance=2, score_decision_impact=1, score_evidence_strength=2,
    score_cost_time_leverage=0, score_risk_reduction=1, score_business_opportunity=1,
    score_hype_risk=1, score_novelty_penalty=3)

# ---------------- REJECT ----------------
REJECTS = [
    ("1ad4779b", "Haystack v3.1.0-rc2", "Duplicate of the v3.1.0-rc3 release notes covering the same upgrade and feature entries; rc3 retained instead.", "open_source"),
    ("206c5f79", "langchain-perplexity 1.4.1", "Patch release consisting of dependency bumps, lockfile refreshes, and small internal fixes with no user-facing change.", "open_source"),
    ("0a419d93", "Next.js v16.4.0-canary.1", "Canary build listing docs typo fixes and internal Turbopack refactors; no user-facing change and not a stable release.", "open_source"),
    ("82f72c92", "Which tool should I use for my product launch video", "Low-effort tool-recommendation request with no findings or reusable information.", "solo_business"),
    ("82224989", "How do you advertise your projects?", "Generic marketing-help thread; the poster is asking for advice rather than reporting a result.", "solo_business"),
    ("ccd63de7", "I wanted to see my rentals like my stock portfolio, so we built it", "Product self-promotion outside the audience's domain, with no transferable technical or business detail.", "solo_business"),
    ("716e015a", "I need volunteer to test my app", "Recruitment post with no informational content.", "solo_business"),
    ("2858ac57", "Explain your market and challenges (I'll start)", "Open-ended discussion prompt; no claim, finding, or decision-relevant content.", "solo_business"),
    ("630536d3", "How often do you actually ask customers for feedback?", "Generic discussion question with no data or reported outcome.", "solo_business"),
    ("7c7bfde6", "At what point is supporting AI models actually too much?", "Speculative discussion prompt about multi-model maintenance burden with no measurements or conclusions.", "solo_business"),
    ("fc260c0a", "What are some actual tech companies of 2026", "Vague open-ended question with no substance.", "solo_business"),
    ("39f8786a", "Any free MMPs that aren't a pain to set up?", "Mobile attribution tool shopping request; niche and outside the audience's decision space.", "solo_business"),
    ("cfd68611", "This actually happened..", "Image-based engagement bait with no informational content.", "solo_business"),
    ("7be7e138", "Revision de codigo?", "Request for informal code review of a personal project; no reusable content.", "solo_business"),
    ("c85128fa", "Want an advice on a Blog", "Request for feedback on a draft blog post; no claim or finding.", "solo_business"),
    ("331770af", "Looking for annoying daily tasks or workflows you wish were automated", "Idea-solicitation post with no findings.", "automation"),
    ("18e566db", "Now know why AI sent your visitors", "Promotional launch post for an AI-referral attribution tool, framed as a discovery; no independent evidence.", "distribution"),
    ("6247fbd8", "How do you properly validate a B2C SaaS idea before building it?", "Beginner validation-advice request; well-covered ground with no new information.", "solo_business"),
    ("49b4f912", "What is your take on raise of outbid sites?", "Hype-cycle commentary and speculation with no substance or evidence.", "solo_business"),
    ("6debbc8f", "I want some real user feedback", "Bare feedback solicitation with no content.", "solo_business"),
    ("6cc693ee", "Turned \"attention is winner-take-all\" into a $1 product", "Self-promotional launch post for a pay-to-rank novelty site; no transferable insight.", "solo_business"),
    ("6518c5f6", "The internet's front page always belongs to whoever paid the most", "Duplicate promotion of the same $1 leaderboard product posted under a second title.", "solo_business"),
    ("4fa15f34", "Where can I track my webapp?", "Basic analytics tool request answerable in one line; no signal.", "solo_business"),
    ("3dd4a262", "Struggling to get my first customers for my SaaS", "Generic first-customer distribution question with no reported outcome or data.", "solo_business"),
]
for prefix, title, reason, cat in REJECTS:
    add(prefix, title, reason, title, cat, "early_signal", "reject", reason,
        score_worth_mentioning=0, score_solo_dev_relevance=0, score_owner_work_relevance=0,
        score_future_work_relevance=0, score_decision_impact=0, score_evidence_strength=1,
        score_cost_time_leverage=0, score_risk_reduction=0, score_business_opportunity=0,
        score_hype_risk=3, score_novelty_penalty=4)

# ---- resolve prefixes to full ids ----
results = []
by_prefix = {}
for rid in items:
    by_prefix[rid[:8]] = rid

missing = [p for p in SCORES if p not in by_prefix]
if missing:
    print("MISSING PREFIXES:", missing, file=sys.stderr); sys.exit(1)
unscored = [r for p, r in by_prefix.items() if p not in SCORES]
if unscored:
    print("UNSCORED ITEMS:", unscored, file=sys.stderr); sys.exit(1)

ORDER = []
for prefix, rec in SCORES.items():
    rid = by_prefix[prefix]
    it = items[rid]
    url = it.get("url") or ""
    row = {
        "raw_item_id": rid,
        "title": rec["title"],
        "summary": rec["summary"],
        "raw_claim": rec["raw_claim"] or rec["title"],
        "category": rec["category"],
        "evidence_level": rec["evidence_level"],
        "evidence_sources": [url] if url else [],
        "uncertainty": rec["uncertainty"],
        "worth_mentioning_reason": rec["worth_mentioning_reason"],
        "verdict": rec["verdict"],
        "verdict_reason": rec["verdict_reason"],
    }
    row.update(rec["scores"])
    results.append(row)
    ORDER.append((prefix, rid, it.get("source_id"), url, rec))

# ---- private memo ----
RANK = {"publish_public": 0, "publish_private": 1, "monitor": 2, "reject": 3}
ORDER.sort(key=lambda t: (RANK[t[4]["verdict"]], -t[4]["scores"]["score_worth_mentioning"]))

L = []
L.append(f"# Morning memo — {DATE}")
L.append("")
L.append("**Source failures:** `reddit-localllama` failed with HTTP 429 (Reddit rate limit). "
         "44/46 sources OK; one configured source has no fetcher implementation and is skipped silently.")
L.append("")
L.append("**Note:** the fetch cron had not yet run when triage started (cron fires 08:00 UTC, this run began 06:09 UTC). "
         "The fetch was triggered manually before claiming, producing 87 new items.")
L.append("")
L.append("## Worth attention")
L.append("")
n = 0
for prefix, rid, src, url, rec in ORDER:
    if rec["verdict"] not in ("publish_public", "publish_private"):
        continue
    n += 1
    if n > 12:
        break
    L.append(f"- **{rec['title']}** — {url}")
    L.append(f"  {rec['summary']}")
    L.append("")
L.append("## Full digest")
TAG = {"publish_public": "P", "publish_private": "P", "monitor": "M", "reject": "R"}
for prefix, rid, src, url, rec in ORDER:
    one = rec["summary"].split(". ")[0].strip().rstrip(".")
    L.append(f"- [{TAG[rec['verdict']]}] [{src}] {rec['title']} — {url} — {one}.")
memo = "\n".join(L)

payload = {"run_id": run_id, "private_memo": memo, "results": results}
json.dump(payload, open(OUT, "w"), indent=1)
print("run_id", run_id)
print("results", len(results))
from collections import Counter
print(Counter(r["verdict"] for r in results))
pub = [r for r in results if r["verdict"] == "publish_public"]
srcs = Counter(items[r["raw_item_id"]]["source_id"] for r in pub)
print("public per source:", dict(srcs))
assert all(v <= 2 for v in srcs.values()), "source diversity cap violated"
assert all(r["raw_claim"].strip() for r in results), "empty raw_claim"
print("OK ->", OUT)
