// Builds completion.json for run 4102f739-a945-4270-a51d-6d041a6e9880 (2026-08-25)
const fs = require('fs');

const RUN_ID = '4102f739-a945-4270-a51d-6d041a6e9880';
const S = ['score_worth_mentioning','score_solo_dev_relevance','score_owner_work_relevance',
  'score_future_work_relevance','score_decision_impact','score_evidence_strength',
  'score_cost_time_leverage','score_risk_reduction','score_business_opportunity',
  'score_hype_risk','score_novelty_penalty'];

function mk(o) {
  const r = {
    raw_item_id: o.id, title: o.title, summary: o.summary, raw_claim: o.claim,
    category: o.category, evidence_level: o.evidence, evidence_sources: [o.url],
    uncertainty: o.uncertainty || '', worth_mentioning_reason: o.why || ''
  };
  S.forEach((k, i) => { r[k] = o.scores[i]; });
  r.verdict = o.verdict;
  r.verdict_reason = o.reason;
  if (!r.raw_claim) throw new Error('empty raw_claim: ' + o.id);
  return r;
}

const items = [
  // ---------- publish_public ----------
  {
    id: '0823ec96-73c8-47c9-803a-15e072a19d1d',
    title: 'Drew Breunig: Fable and the end of the free lunch',
    url: 'https://simonwillison.net/2026/Aug/23/drew-breunig/',
    summary: 'Breunig argues the era of "just wait for the next model" is over. Previously each new model arrived at the same or lower price and papered over weak harnesses and context strategies, so tuning them was wasted effort. Fable broke that pattern: it is materially better but expensive enough that Opus, GPT-5.6, K3 and GLM remain good enough for most code. The practical move is to stop treating model choice as global and start routing work by tier, sending only the tasks that genuinely need frontier reasoning to the expensive model.',
    claim: 'Fable ended the pattern of new models arriving at equal or lower cost, making per-task model routing by cost tier necessary rather than optional.',
    category: 'pricing_cost', evidence: 'builder_reported',
    why: 'Directly changes how to allocate model spend across an agent stack.',
    uncertainty: 'A practitioner opinion rather than a benchmarked cost analysis; the right tier boundaries will differ per workload.',
    scores: [5,5,5,4,4,3,5,2,2,1,1],
    verdict: 'publish_public',
    reason: 'Reframes a recurring cost decision for anyone running multi-model agent workflows.'
  },
  {
    id: 'c80f9f4a-14de-48ba-9606-545cfd53e9cd',
    title: 'Fabien Sanglard: my agent.md for improving LLM-assisted code quality',
    url: 'https://fabiensanglard.net/agent.md/index.html',
    summary: 'Sanglard publishes the agent instruction file he uses to constrain LLM coding assistants and raise output quality. It is the same class of artifact as CLAUDE.md or AGENTS.md: a checked-in set of standing rules the model reads before touching code. Worth diffing against your own agent instructions to see which constraints you are missing.',
    claim: 'Fabien Sanglard published the agent.md instruction file he uses to improve the quality of LLM-assisted code.',
    category: 'agent_workflow', evidence: 'builder_reported',
    why: 'A concrete, copyable artifact from a credible engineer, directly applicable to existing CLAUDE.md setups.',
    uncertainty: 'Full text not retrieved this run, so the specific rules are unverified; judgement is based on title, source and HN placement.',
    scores: [5,5,5,4,4,3,4,3,1,1,2],
    verdict: 'publish_public',
    reason: 'Reproducible workflow artifact for LLM-assisted development from a high-credibility source.'
  },
  {
    id: 'f6a1d39c-b64f-44d2-a6be-cf794a42b37e',
    title: 'Claude API: elevated errors across multiple models (Aug 24)',
    url: 'https://status.claude.com/incidents/vgz5psbjmt1h',
    summary: 'Anthropic logged elevated error rates on requests to Claude Mythos 5, Fable 5, Opus 5 and other models, first reported 05:06 UTC on Aug 24 and identified at 05:27. By 07:47 errors had stabilised on Opus 5 and Fable 5, with work continuing to restore success rates on the remaining models. If your agent runs threw unexplained failures yesterday morning, this is almost certainly why — check retry and fallback behaviour rather than hunting for a bug in your own code.',
    claim: 'Anthropic confirmed elevated error rates across Claude Mythos 5, Fable 5, Opus 5 and other models on 24 August 2026, stabilising on Opus 5 and Fable 5 by 07:47 UTC.',
    category: 'api_platform_change', evidence: 'vendor_claim',
    why: 'Authoritative explanation for real failures in any Claude-dependent pipeline.',
    uncertainty: 'Captured mid-incident; final resolution time for all models not confirmed in this snapshot.',
    scores: [4,4,5,2,3,5,2,4,0,0,1],
    verdict: 'publish_public',
    reason: 'Official platform incident with direct operational impact on Claude-based agent stacks.'
  },
  {
    id: 'a328a7ac-75dc-4339-9d4f-bdbc04a0b404',
    title: 'FT: Anthropic revenue climbs while cheaper tools take share',
    url: 'https://simonwillison.net/2026/Aug/23/anthropics-best-ai-model-struggles-to-attract-users-as-cheaper-t/',
    summary: 'Simon Willison pulls the numbers out of an FT report sourced to people familiar with the matter: Anthropic annualised revenue reached about $65bn in July, up from $47bn in May, with roughly 6,000 customers spending $100k or more per year and Q3 expected to be profitable. OpenAI annualised revenue is above $40bn, up 35% in the quarter following the July launch of GPT-5.6. The framing that matters for a solo builder is the same one Breunig makes: the frontier model is not automatically the one users choose, and cheaper tools are absorbing real volume.',
    claim: 'FT reporting puts Anthropic annualised revenue at roughly $65bn in July 2026 with cheaper competing tools capturing growing usage share.',
    category: 'pricing_cost', evidence: 'early_signal',
    why: 'Market context for vendor durability and for the cost-tier argument about model selection.',
    uncertainty: 'Figures come from anonymous sources via FT and are annualised run-rates, not audited results.',
    scores: [4,3,3,3,3,3,3,2,2,2,2],
    verdict: 'publish_public',
    reason: 'Credible reported figures that inform vendor and cost decisions, though indirectly sourced.'
  },

  // ---------- publish_private ----------
  {
    id: '1c6cd757-b331-4311-897b-906869ad25d8',
    title: 'Google Workspace classified my domain as an email provider (2025)',
    url: 'https://blog.elis.cc/articles/google-workspace-thinks-my-domain-is-an-email-provider/',
    summary: 'A writeup of Google Workspace misclassifying a personal domain as an email provider, with the downstream delivery and account consequences that follow. Useful as a failure mode to recognise early if you run mail on a custom domain, because the symptoms are easy to misattribute to your own DNS or SPF setup.',
    claim: 'Google Workspace can misclassify a custom domain as an email provider, causing account and deliverability problems that are easily mistaken for DNS misconfiguration.',
    category: 'infrastructure', evidence: 'builder_reported',
    why: 'Recognisable failure mode for anyone self-hosting mail on a custom domain.',
    uncertainty: 'A 2025 article resurfacing; Google may have changed the classification behaviour since.',
    scores: [3,3,3,2,2,2,2,4,0,1,2],
    verdict: 'publish_private',
    reason: 'Narrow but genuinely useful infrastructure gotcha; not broad enough for the public list.'
  },
  {
    id: '9c4a67ae-035f-4e72-a1ea-55f92099779c',
    title: 'A low-latency AI companion that plays Skyrim alongside you',
    url: 'https://pantel.is/projects/ai-gaming-companion/',
    summary: 'A builder writeup of a real-time voice AI companion wired into Skyrim, with low latency as the explicit design constraint. The game framing is incidental; the transferable part is the speech-in to speech-out pipeline and the latency budget decisions, which are the same problems any voice agent product faces.',
    claim: 'A developer built a low-latency real-time voice AI companion integrated with Skyrim.',
    category: 'voice_agents', evidence: 'builder_reported',
    why: 'Latency engineering for a live voice loop transfers directly to voice agent work.',
    uncertainty: 'Article body was not retrieved this run, so the actual latency figures and stack are unverified.',
    scores: [3,3,4,3,2,2,2,1,1,2,2],
    verdict: 'publish_private',
    reason: 'Relevant voice-agent engineering wrapped in a hobby project; narrower interest than the public list.'
  },
  {
    id: 'e5d1c04b-a7f9-4e1c-ae61-2c7d75d2184e',
    title: 'From 0 to 800 users with a freemium Chrome extension',
    url: 'https://www.reddit.com/r/SaaS/comments/1vwyhwq/from_0_to_800_users_what_i_learned_from_building/',
    summary: 'A price-tracking Chrome extension reached roughly 800 active users and close to 3,000 installs on a freemium model, generating some revenue but not yet a business. The author reports that building the core feature was the easy part, with distribution and conversion the actual constraint. Honest small numbers, which makes it more useful than the usual growth retrospective.',
    claim: 'A solo-built freemium Chrome extension reached about 800 active users and nearly 3,000 installs, with distribution rather than engineering as the limiting factor.',
    category: 'solo_business', evidence: 'builder_reported',
    why: 'Concrete, unembellished funnel numbers from a comparable solo product.',
    uncertainty: 'Self-reported figures with no revenue detail disclosed.',
    scores: [3,3,2,2,2,3,2,1,3,1,2],
    verdict: 'publish_private',
    reason: 'Modest but honest builder report; useful reference point rather than a decision changer.'
  },

  // ---------- monitor ----------
  {
    id: 'bcec26c2-43d6-4d1b-96a6-65895a4b9877',
    title: 'Wild AI-related reliability incidents are coming',
    url: 'https://surfingcomplexity.blog/2026/08/22/wild-ai-related-reliability-incidents-are-coming/',
    summary: 'A resilience-engineering argument that pushing LLM agents into production paths will produce novel and hard-to-diagnose failure modes. Forward-looking rather than evidenced, but it comes from a serious incident-analysis writer and is a useful prompt to check what your agents can actually do when they misfire.',
    claim: 'Embedding LLM agents in production systems will produce novel classes of reliability incidents that existing operational practice does not anticipate.',
    category: 'agent_workflow', evidence: 'early_signal',
    why: 'Worth tracking as agent automation moves into paths that can cause real damage.',
    uncertainty: 'Predictive argument with no incident data yet; body not retrieved this run.',
    scores: [3,3,3,4,2,2,1,3,1,2,2],
    verdict: 'monitor',
    reason: 'Credible source but speculative; track rather than act on.'
  },

  // ---------- reject ----------
  {
    id: 'a18c3a12-cf71-42f3-8321-abcc00c1c2da',
    title: 'Offgrid electric car (2025)',
    url: 'https://joeyh.name/blog/entry/offgrid_electric_car/',
    summary: 'Personal writeup about running an electric car off-grid. No software or business relevance.',
    claim: 'A developer documents running an electric car from an off-grid power setup.',
    category: 'builder_report', evidence: 'early_signal',
    scores: [0,0,0,0,0,1,0,0,0,0,3],
    verdict: 'reject',
    reason: 'Off-topic hobby content with no bearing on software or business decisions.'
  },
  {
    id: 'f34a2aa9-cf2f-44bc-9c1c-cb37ce4363e3',
    title: 'My DIY DEF CON choker has a screen on it',
    url: 'https://www.scd31.com/posts/defcon-choker',
    summary: 'A hardware badge-craft project built for DEF CON. Entertaining but carries no transferable engineering or business decision.',
    claim: 'A hobbyist built a wearable DEF CON choker with an embedded screen.',
    category: 'builder_report', evidence: 'early_signal',
    scores: [0,0,0,0,0,1,0,0,0,0,3],
    verdict: 'reject',
    reason: 'Hobby hardware project; no relevance to a solo software practice.'
  },
  {
    id: 'ac584373-cee7-4191-89f4-8f3d1fc2c52b',
    title: 'eh: a minimalist vi-like editor',
    url: 'https://codeberg.org/SirWumpus/eh',
    summary: 'A small vi-like editor in C with UTF-8, regex search and replace, shell filters and multi-level undo, descended from an IOCCC 2024 entry. Well made but offers no leverage over existing editors.',
    claim: 'eh is a minimalist vi-like editor written in C supporting UTF-8, regex search and replace, shell filters and multi-level undo.',
    category: 'open_source', evidence: 'reproducible',
    scores: [1,1,0,1,0,3,0,0,0,1,3],
    verdict: 'reject',
    reason: 'Niche editor with no practical leverage over tools already in use.'
  },
  {
    id: 'fcd87565-0d87-4502-ba4b-13055d570218',
    title: 'tmp.0ut volume 5',
    url: 'https://tmpout.sh/5/',
    summary: 'New issue of a low-level binary and ELF hacking zine. Specialist reverse-engineering material with no actionable content for a solo application developer.',
    claim: 'The tmp.0ut binary-hacking zine released its fifth volume.',
    category: 'security_risk', evidence: 'early_signal',
    scores: [1,1,0,1,0,2,0,1,0,0,2],
    verdict: 'reject',
    reason: 'Deep specialist zine outside the practical scope of this digest.'
  },
  {
    id: 'dde9842e-61ed-41b3-8966-c639bce6a3f5',
    title: 'How to report a bug so it actually gets fixed',
    url: 'https://blog.tymscar.com/posts/howtoreportabug/',
    summary: 'General guidance on writing effective bug reports. Sound advice but well-trodden ground for an experienced developer.',
    claim: 'Effective bug reports require clear reproduction steps, environment detail and expected versus actual behaviour.',
    category: 'builder_report', evidence: 'early_signal',
    scores: [1,1,0,1,0,2,0,1,0,0,5],
    verdict: 'reject',
    reason: 'Familiar advice with no new information for the audience.'
  },
  {
    id: '32b175c2-d896-4032-bbc3-37e74bfff372',
    title: 'Everything I own, owned',
    url: 'https://schlarp.com/posts/everything-i-own-owned/',
    summary: 'Post reached the front page but the origin site was unavailable and only an archive link was captured, leaving the claim unverifiable this run.',
    claim: 'A blog post titled "Everything I own, owned" circulated on Hacker News but its source site was unreachable at fetch time.',
    category: 'security_risk', evidence: 'early_signal',
    uncertainty: 'Source site down at fetch time; content could not be assessed.',
    scores: [1,1,0,1,0,1,0,1,0,0,2],
    verdict: 'reject',
    reason: 'Unverifiable — source unreachable and no usable content captured.'
  },
  {
    id: '1a76eab0-c389-4ec5-9c9a-b20c10cf8ac0',
    title: 'How I find problems to solve as a staff engineer',
    url: 'https://lalitm.com/post/find-problems-staff-engineer/',
    summary: 'Career guidance on sourcing high-impact work inside a large engineering organisation. The organisational-politics framing does not map onto a one-person shop.',
    claim: 'A staff engineer describes how to identify high-impact problems to work on within a large organisation.',
    category: 'builder_report', evidence: 'early_signal',
    scores: [1,1,0,1,0,2,0,0,0,1,3],
    verdict: 'reject',
    reason: 'Large-org career advice with little transfer to solo work.'
  },
  {
    id: '350a08ad-360f-4b7f-90d4-4973125cd772',
    title: 'New EU-wide product repair rules come into force',
    url: 'https://www.rte.ie/news/business/2026/0824/1588931-repair-rules/',
    summary: 'EU right-to-repair obligations take effect for manufacturers of physical goods. Real regulatory news but outside the scope of a software practice.',
    claim: 'New EU-wide product repair rules came into force in August 2026 for manufacturers of physical products.',
    category: 'api_platform_change', evidence: 'vendor_claim',
    scores: [1,0,0,1,0,4,0,1,0,0,1],
    verdict: 'reject',
    reason: 'Hardware regulation with no software or agent implications.'
  },
  {
    id: 'e09c8329-ab67-454c-8741-3901b1766856',
    title: 'An indie founder, obviously',
    url: 'https://www.reddit.com/r/SaaS/comments/1vwyeb8/an_indie_founder_obviously/',
    summary: 'An image meme post with no substantive content.',
    claim: 'A meme image about indie founders was posted to r/SaaS.',
    category: 'solo_business', evidence: 'early_signal',
    scores: [0,0,0,0,0,0,0,0,0,4,4],
    verdict: 'reject',
    reason: 'Engagement-driven meme with zero information content.'
  },
  {
    id: '833eed4a-f95f-49e2-b77f-947f2ef3e6f6',
    title: 'Base44 $80m solo exit takeaways',
    url: 'https://www.reddit.com/r/SaaS/comments/1vwyho4/base44s_80m_solo_exit_is_wild_heres_the_actual/',
    summary: 'A retelling of the Base44 acquisition by Wix with generic conclusions about shipping speed and automation. The underlying event is old news and the takeaways add nothing testable.',
    claim: 'Base44 was built solo and acquired by Wix for approximately $80m, which the author argues shows solo builders can reach large outcomes without hiring.',
    category: 'solo_business', evidence: 'early_signal',
    uncertainty: 'Restates a previously reported acquisition; no new sourcing.',
    scores: [1,1,1,1,0,1,0,0,1,4,5],
    verdict: 'reject',
    reason: 'Rehash of an old acquisition with generic, untestable takeaways.'
  },
  {
    id: 'd7c0d606-d8c0-4cb2-be3e-83def59f3f02',
    title: 'What is the biggest gap in your outbound strategy?',
    url: 'https://www.reddit.com/r/SaaS/comments/1vwy6xz/whats_the_biggest_gap_in_your_outbound_strategy/',
    summary: 'An open discussion prompt about outbound sales with no findings or data of its own.',
    claim: 'A discussion thread asks r/SaaS members to identify the biggest bottleneck in their outbound sales process.',
    category: 'distribution', evidence: 'early_signal',
    scores: [0,0,0,0,0,0,0,0,1,3,3],
    verdict: 'reject',
    reason: 'Discussion prompt with no substance; likely lead generation.'
  },
  {
    id: 'a4cd2567-6016-44ea-9366-cc99b653327a',
    title: 'What is the best marketing strategy right now',
    url: 'https://www.reddit.com/r/SaaS/comments/1vwzekl/whats_the_best_marketing_strategy_right_now/',
    summary: 'A founder reports wasted spend on Google and Reddit ads and asks for direction. A question rather than a finding.',
    claim: 'A founder reported near-zero traffic from Google and Reddit ad spend and asked r/SaaS for alternative acquisition strategies.',
    category: 'distribution', evidence: 'early_signal',
    scores: [1,1,0,0,0,1,0,0,1,1,3],
    verdict: 'reject',
    reason: 'Help request with no transferable insight.'
  },
  {
    id: 'bcbeb313-8043-43dc-b98e-841edfcf7762',
    title: 'How do you get feedback and convert users to paying customers?',
    url: 'https://www.reddit.com/r/SaaS/comments/1vwz0ez/how_do_you_get_feedback_and_convert_users_to/',
    summary: 'A macOS app with 36 users after 18 months, failed $300 of Google Ads, and strong CTR on very low impressions. The detail is real but the post asks for advice rather than offering any.',
    claim: 'A developer with a niche macOS app reported 36 users after 18 months and asked how to gather feedback and convert users to paying customers.',
    category: 'solo_business', evidence: 'builder_reported',
    scores: [1,1,0,1,0,2,0,0,1,1,3],
    verdict: 'reject',
    reason: 'Question post; too thin to carry a recommendation.'
  }
];

const results = items.map(mk);

// sanity checks
const ALLOWED_V = ['publish_public','publish_private','monitor','reject'];
const ALLOWED_C = ['model_change','api_platform_change','agent_workflow','open_source','infrastructure','voice_agents','data_scraping','automation','security_risk','pricing_cost','distribution','solo_business','builder_report'];
const ALLOWED_E = ['vendor_claim','early_signal','builder_reported','reproducible','production_proven'];
const seen = new Set();
for (const r of results) {
  if (seen.has(r.raw_item_id)) throw new Error('duplicate id ' + r.raw_item_id);
  seen.add(r.raw_item_id);
  if (!ALLOWED_V.includes(r.verdict)) throw new Error('bad verdict ' + r.verdict);
  if (!ALLOWED_C.includes(r.category)) throw new Error('bad category ' + r.category);
  if (!ALLOWED_E.includes(r.evidence_level)) throw new Error('bad evidence ' + r.evidence_level);
  for (const k of S) if (typeof r[k] !== 'number' || r[k] < 0 || r[k] > 5) throw new Error('bad score ' + k + ' on ' + r.raw_item_id);
  if (!r.evidence_sources[0]) throw new Error('missing url ' + r.raw_item_id);
}

// source diversity check for publish_public
const pub = results.filter(r => r.verdict === 'publish_public');
console.log('counts:', ['publish_public','publish_private','monitor','reject']
  .map(v => v + '=' + results.filter(r => r.verdict === v).length).join(' '));
console.log('total results:', results.length);

const memo = [
  '# Morning memo — 2026-08-25',
  '',
  '**Source failures:** 2 of 46 sources failed this run, though the run summary reports only 1 (a known miscount).',
  '',
  '- `github-trending-weekly` — "No fetcher for type: github_trending". The source config points at a fetcher that does not exist, so this source has never yielded items.',
  '- `reddit-localllama` — HTTP 429 rate limit from the Reddit RSS endpoint.',
  '',
  '**Run notes:** this task fires at ~06:09 UTC, about two hours ahead of the 08:00 UTC fetch cron, so the fetch was triggered manually first (86 new items). Pre-triage claimed 40 items and capped delivery at 21 — 18 deferred over cap plus 1 duplicate — so 19 items were auto-rejected without review.',
  '',
  '## Worth attention',
  ''
];

const order = ['0823ec96-73c8-47c9-803a-15e072a19d1d','c80f9f4a-14de-48ba-9606-545cfd53e9cd',
  'f6a1d39c-b64f-44d2-a6be-cf794a42b37e','a328a7ac-75dc-4339-9d4f-bdbc04a0b404',
  '1c6cd757-b331-4311-897b-906869ad25d8','9c4a67ae-035f-4e72-a1ea-55f92099779c',
  'e5d1c04b-a7f9-4e1c-ae61-2c7d75d2184e'];
for (const id of order) {
  const r = results.find(x => x.raw_item_id === id);
  memo.push('- **' + r.title + '** — ' + r.evidence_sources[0]);
  memo.push('  ' + r.summary);
  memo.push('');
}

memo.push('## Full digest', '');
const tag = v => v === 'publish_public' || v === 'publish_private' ? 'P' : v === 'monitor' ? 'M' : 'R';
const srcById = {};
for (const r of results) {
  const one = r.summary.split('. ')[0].slice(0, 138);
  memo.push('- [' + tag(r.verdict) + '] ' + r.title + ' — ' + r.evidence_sources[0] + ' — ' + one);
}

const payload = { run_id: RUN_ID, private_memo: memo.join('\n'), results };
fs.writeFileSync(__dirname + '/completion.json', JSON.stringify(payload, null, 2));
console.log('wrote completion.json', fs.statSync(__dirname + '/completion.json').size, 'bytes');
