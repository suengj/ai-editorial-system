# Capture note — design-reference MCPs, automation claims, effort controls, and X algorithm

- **Captured from:** user-provided Instagram / Threads screenshots
- **Captured date:** 2026-09-27
- **Editorial role:** discovery / tool-reference / claim-intake
- **Factual authority:** none unless separately verified. Social-post claims, earnings screenshots, benchmark summaries, and command names are preserved as source-derived observations only.
- **Rights:** raw screenshots are not reproduced in-repo; this note stores normalized observations and editorial implications.

## 1. Design-reference MCP cluster

**Screenshot context:** an Instagram reel recommends connecting design-reference MCPs while using Claude to build screens such as payment flows.

Names visible in the capture:
- Mobbin MCP
- Nicelydone MCP
- Refero MCP
- Lazyweb MCP
- InspoAI MCP

**Observed concept:** expose curated interface/reference libraries to an agent through MCP-style connectors so the agent can inspect existing design patterns while generating UI.

**Editorial / system relevance**
- Strong discovery lead for AES visual-reference retrieval and UI/slide/infographic ideation.
- Useful architectural pattern: reference retrieval should be an explicit tool surface rather than an untraceable prompt-memory step.
- A design-reference connector must remain craft evidence only; it must not become factual authority.
- The presence of a reference library does not authorize copying a specific composition, brand identity, or proprietary screen.

**Verification needed:** canonical project/service identity for each MCP, licensing/terms, whether an official MCP actually exists, retrieval scope, image/reference rights, and whether results expose stable provenance.

---

## 2. Startup Stash / consolidated tool directory

**Screenshot claim:** a Threads post says Bram Kanstein created Startup Stash after repeatedly spending time searching for startup development, marketing, and free-image tools, with the idea of collecting roughly 400 essential tools on one page.

**Observed concept:** curated tool-directory products reduce repeated discovery cost by turning scattered software choices into a maintained taxonomy.

**Editorial / system relevance**
- Useful benchmark for building a curated reference surface rather than accumulating unstructured bookmarks.
- Relevant to AES only as an information-architecture pattern: category, purpose, applicability, and provenance should be easier to scan than raw links.
- The historical/Product Hunt framing and exact tool count are source claims until checked against primary sources.

---

## 3. Lightweight creator-video tool stack

One Threads reply lists:
- Perplexity — research
- OpusClip — automated Shorts editing
- ElevenLabs — AI voice
- Runway — video editing / generation
- Recraft — logo/design

**Observed concept:** a creator workflow assembled from specialized tools rather than one monolithic application.

**Editorial / system relevance**
- Supports a modular production model: research, clipping, voice, video, and design can be separate adapters.
- Does not establish that these five are the best tools or that they should be adopted.
- AES should preserve provider independence at the contract layer and evaluate each adapter on evidence quality, cost, rights, latency, and reproducibility.

---

## 4. Social-post automation + monetization claim

**Screenshot claim:** a Threads post proposes joining Threads, installing Claude/Claude Code, building posting automation, and scheduling one post every 1–2 hours. It includes a revenue screenshot and says only 10–20 minutes/day are needed.

**Observed concept:** use a coding agent to build high-frequency social publishing automation, with monetization presented as the outcome.

**Editorial / system relevance**
- Treat as a cautionary case for separating automation capability from business-outcome evidence.
- A revenue screenshot does not establish causality between posting automation and earnings.
- Posting frequency, platform policy, account safety, editorial quality, and audience response are separate variables.
- Relevant to AES publication governance: scheduling is not publication authority, and automated posting should remain behind explicit policy and human gates where required.

**Verification needed:** original account data, attribution of revenue, platform terms, posting mechanism, content quality, account-age effects, and whether the reported workload includes setup/maintenance.

---

## 5. `/uncertain`, `/x10think`, and claimed reasoning controls

**Screenshot wording visible:**
- `/uncertain` — described as preventing lying when answering
- `/x10think` — described as thinking/analyzing 10× more deeply

**Observed concept:** user-facing slash commands or prompt macros that attempt to control epistemic caution and reasoning effort.

**Editorial / system relevance**
- Useful as a UI/interaction pattern: expose epistemic mode and effort level explicitly instead of hiding them in prose.
- The command names and effects shown are not treated as first-party product facts unless independently verified.
- For AES, a better transferable principle is to encode `uncertainty`, `evidence threshold`, and `effort/review depth` as named workflow controls with measurable acceptance criteria.

---

## 6. Claude Code effort-level guidance

**Screenshot claim:** a verified Threads account states that Claude Code team member Thariq summarized when to raise/lower effort using experiments and Terminal-Bench 3.0 results. The embedded card reads "Using Claude Code: Spending Your Effort" and shows `/effort medium`.

**Observed concept:** dynamic reasoning/effort allocation based on task difficulty rather than running every task at maximum effort.

**Editorial / system relevance**
- Strong operating-pattern reference for cost/latency/quality balancing.
- Relevant to AES model routing and reviewer-depth policy: routine transformations can use lower effort, while ambiguity, high-risk claims, or repeated failures justify escalation.
- Benchmark interpretation must preserve the tested population, model/version, task distribution, and scoring method; the screenshot alone does not provide those details.

**Verification needed:** original first-party post/document, exact effort levels, supported interface, tested models, Terminal-Bench 3.0 setup, and measured quality/cost trade-offs.

---

## 7. Finance-data automation anecdote

**Screenshot claim:** a Threads post says a university student wrote a Claude Code script that automatically scans daily foreign/institutional net-buy/net-sell data for all stocks, analyzes fund flows with AI, and emails the result. The post contrasts this with manual financial-statement/data work.

**Observed concept:** automate repetitive market-data collection and first-pass analysis, then deliver a compact daily digest.

**Editorial / system relevance**
- Useful workflow pattern for research automation: deterministic data collection → structured transformation → AI analysis → scheduled delivery.
- Not evidence of trading edge, profitability, or correctness.
- Particularly relevant to maintaining a hard boundary between research automation and trading authority.
- Any finance-related implementation must retain source timestamps, market coverage, data licensing, missing-data handling, and validation before downstream use.

---

## 8. X recommendation algorithm source release

**Screenshot claim:** an Instagram carousel says X released code that determines what appears in the recommendation feed, framing it as access to the principle that makes ranking decisions.

The embedded repository path visibly references `xai-org/x-algorithm` and a file under `home-mixer/params/params.rs`.

**Observed concept:** a recommendation system's implementation/code can provide direct evidence about ranking architecture and configurable parameters, subject to the exact repository version and what portions are actually published.

**Editorial / system relevance**
- High-value primary-source candidate for articles about recommender systems, feed ranking, transparency, and platform incentives.
- The code itself may establish implementation details for the published version, but it does not automatically reveal every production weight, experiment, feature flag, or private service dependency.
- Any article should distinguish `open-source implementation`, `production deployment`, and `current live ranking behavior`.

**Verification needed:** canonical repository, release date, license, repository scope, commit/version, relationship to live X production, and which parameters/configuration are mirrored vs runtime-controlled.

---

## Cross-cutting synthesis

These captures fall into four reusable editorial buckets:

1. **Reference retrieval** — design-reference MCPs and curated tool directories.
2. **Composable production stacks** — research, clipping, voice, video, design as separate tools.
3. **Automation claims requiring skepticism** — social monetization and finance automation anecdotes.
4. **Explicit control surfaces** — effort/uncertainty modes and open recommender-system code.

### Editorial handling rules

- Social screenshots are discovery evidence, not factual authority.
- Promotional earnings, token/time savings, and 'best tool' claims require primary or measured evidence before reuse.
- Tool lists should be normalized by function, not repeated as popularity rankings.
- Automation capability must be separated from business outcome, safety, compliance, and publication authority.
- Open-source code can be primary evidence for code that is actually present, but not for undocumented production behavior.
- If any item is selected for publication or implementation, promote it into the normal reference-evaluation / verification flow with canonical URLs and dated evidence.
