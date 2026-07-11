# TrendRadar Development Progress

Last updated: 2026-07-11
Production: https://trendradar-prod.vercel.app
Latest verified code commit: pending current changes
Latest documentation commit: pending current changes

## 1. Product Positioning

TrendRadar is an internal market signal research and validation platform.

It converts news, industry observations, commodity data, company actions, and market prices into:

1. Market Signals
2. Research Hypotheses
3. Beneficiary Watchlists
4. Evidence Panels
5. Forward Return Validation
6. A versioned Signal Ledger

TrendRadar is not a news summary website, investment advisory service, or automatic trading system. External daily, weekly, and monthly reports remain a later publishing layer. The current product is the internal data collection, research, review, and validation engine.

### Live-First Policy

TrendRadar now treats `2026-07-01` onward as the formal live Signal Ledger start date.

- July 2026 and later data is the primary product dataset.
- July daily and weekly market briefs are the current execution priority.
- June and May report reconstruction should only begin after July daily/weekly collection and analysis are stable.
- Historical 2025 and early 2026 backfills remain audit/sample material unless independently time-verified.
- Large historical backfill expansion is intentionally deprioritized to reduce token, compute, and review cost.
- Paid/public research should be built from live-collected Signals first; historical cases can demonstrate methodology but should not be marketed as strict live discoveries unless verified.

### Market Brief Layer

The external reporting layer starts from the live dataset and remains separate from the internal Signal Ledger.

- Added `/api/reports/market-brief`.
- Supported periods: `daily`, `weekly`, `monthly`.
- Report windows are period-aware: daily uses the report date, weekly uses the current week, and monthly uses month-to-date. Live July weekly windows are clamped to `2026-07-01` so June data is not mixed into the first July weekly report.
- Daily brief contract now includes Taiwan market, US market, internal Signals, tomorrow watch items, and data gaps.
- Taiwan placeholders explicitly cover index moves, industry winners/losers, top stocks, and institutional flows.
- US placeholders explicitly cover Dow, Nasdaq, S&P 500, Philadelphia Semiconductor, industry movers, and top stocks.
- Missing market data is reported as `pending`; the system must not fabricate institutional flow, sector ranking, streak, or index numbers.
- TWSE official TAIEX history is now connected for `^TWII` and can populate verified weighted index prices.
- Next data tasks are TPEx index prices, official/authorized Taiwan institutional flows, Taiwan industry constituents, US sector/constituent performance, and independently verified US index price series.

## 2. Current Architecture

```text
RSS / Historical Backfill / Official Research Sources
                         |
                         v
                 Raw Data Storage
 articles / industry_observations / commodity_quotes
 company_actions / stock_prices / market_price_series
                         |
                         v
            Deduplication and Topic Discovery
                         |
                         v
         Monthly Discovery and Signal Detection
                         |
                         v
 Signal -> Hypothesis -> Evidence -> Beneficiary Mapping
                         |
                         v
               Versioned Signal Ledger
                         |
                         v
     7D / 30D / 60D / 90D Forward Validation
                         |
                         v
       Publication Review and Publishing Brief
```

### Technology

- Next.js App Router
- TypeScript
- Supabase PostgreSQL
- Vercel and Vercel Cron
- Rule-based research logic with an AI-ready extension path

## 3. Completed Features

### 3.1 Data Collection and Storage

- RSS collection through `lib/rss.ts`.
- Production sync through `/api/topics/sync-grouped`.
- Historical news backfill workflow and coverage inspection.
- Taipei timezone month boundaries are used consistently.
- Structured research tables:
  - `articles`
  - `topics`
  - `topic_articles`
  - `trend_metrics`
  - `industry_observations`
  - `commodity_quotes`
  - `company_actions`
  - `stock_prices`
  - `market_price_series`
- Verified research-source ingestion for FRED, SEC, TWSE, and TPEx paths.
- Data quality status and provenance fields for research data and stock prices.

### 3.2 Article Deduplication and Discovery

- URL and title normalization.
- Conservative daily research-event fingerprints.
- Cross-source event deduplication for candidate discovery.
- Raw article count and research-event count are reported separately.
- Effective source counts exclude aggregator inflation.
- Full-month pagination replaces the former 1,000/10,000-row truncation.
- June 2026 full-month discovery was reduced from about 103 seconds to about 14 seconds.
- Monthly public reports read the Signal Ledger instead of recalculating discovery on every request.

### 3.3 Monthly Signal Discovery

- Full-market monthly candidate discovery.
- Source diversity and event-depth thresholds.
- Topic-family diversity limits prevent one theme from occupying every result.
- Signal heat and Research Confidence are separate concepts.
- Lifecycle support currently includes:
  - Emerging
  - Rising
  - Sustained High
  - Cooling
- Signals preserve `as_of_date`; generation cannot use later information.
- Current month can contain fewer than five signals when quality is insufficient.

### 3.4 Signal Research Model

- Signal types and shared TypeScript contracts in `types/signals.ts`.
- Signal strength components are stored with:
  - raw value
  - normalized score
  - weight
  - contribution
  - calculation version
  - input snapshot
- Research Brief includes:
  - why now
  - causal chain
  - tracking indicators
  - invalidation conditions
  - evidence assessment
  - beneficiary logic
  - data gaps
  - validation summary
- Supporting evidence and later validation evidence are separated by `known_at_signal_time`.
- Research Confidence V2 now gives less weight to source/news breadth and more weight to hard evidence:
  - industry evidence
  - commodity or price evidence
  - company evidence
  - supply-chain evidence
  - market evidence
  - required evidence coverage
- If no explicit required evidence coverage is supplied, the model infers it from hard-evidence categories instead of treating missing evidence as neutral.
- The evidence-weighted monthly discovery model is versioned separately:
  - `monthly-full-market-v3`
  - `research-confidence-v3`
- Model replay now records v3 as the candidate model so old v2/v1 outputs remain comparable instead of being silently overwritten.

### 3.5 Beneficiary Mapping

- Rule-based mapping supports Taiwan, US, Korea, Japan, and global market codes.
- Initial coverage includes memory, AI power, cooling, packaging, optical networking, defense, and related infrastructure.
- Watchlists include company name, symbol, market, thesis, weight, and mapping source.
- Signals without a defensible company relationship may remain industry research only.

### 3.6 Price Quality and Backtesting

- CSV import and automated verified-price ingestion paths.
- Trading-day lookup uses the nearest valid session.
- Unverified, missing, or implausible prices cannot enter backtests.
- Individual-return and basket-return plausibility gates prevent corrupted outcomes.
- Basket return, benchmark return, alpha, and outcome are stored.
- Forward horizons support 7, 14, 30, 60, and 90 days in different workflows.
- Success, partial, failed, and pending outcomes are retained.
- Failure cases are not hidden.

### 3.7 Signal Ledger and Replay

- Signal Ledger tables are the production source of truth.
- Monthly reports read finalized Ledger rows.
- Historical replay and baseline/candidate model comparison exist.
- Model replay results preserve model version and run identity.
- Existing replay covered 2025-01 through 2026-04.
- Time Machine rules prohibit future-data leakage.

### 3.8 Publication Review Gate

- Append-only `signal_publication_reviews` table.
- Versioned states:
  - draft
  - reviewed
  - approved
  - rejected
  - published
- Required publication gates currently check:
  - source diversity
  - event depth
  - Research Confidence
  - signal strength
  - evidence known at signal time
  - beneficiary mapping quality
- API-level transition validation prevents invalid approval or publication.
- Structured Publishing Brief is generated for internal use.
- Production validation:
  - high-quality sample: quality score 96, eligible
  - low-quality sample: quality score 16, blocked

### 3.9 Evidence Framework

Signal details expose six evidence categories:

1. News
2. Industry
3. Commodity
4. Company
5. Supply Chain
6. Market

Each category reports:

- status: confirmed, partial, missing, or contradicted
- score
- evidence count
- plain-language explanation

Missing evidence is shown explicitly and is not replaced by news volume.

Verified research evidence can be materialized into signals through:

- `lib/signals/evidence-materialization.ts`
- `POST /api/admin/signals/materialize-evidence`

Evidence source requirements are now defined in:

- `lib/signals/evidence-source-registry.ts`

The registry currently covers:

- Memory / HBM / DRAM
- AI Compute / AI Server
- AI Power / Grid
- AI Cooling / Thermal
- CoWoS / Advanced Packaging
- Optical Networking / CPO
- Robotics / Embodied AI

It can detect which evidence families a signal belongs to, list required non-news evidence, and identify missing required evidence. Tests enforce that generic industry data cannot satisfy every evidence requirement by source type alone.

Signal Research Brief now surfaces evidence coverage:

- required evidence families detected from topic and hypothesis
- satisfied required evidence count
- missing required evidence labels
- missing evidence items folded into `dataGaps`

Publication Review now uses the same evidence-coverage model as a required approval gate when a signal maps to a modeled family. A signal can have enough news heat, sources, watchlist mapping, and confidence, but still be blocked from approval/publishing if required industry, commodity, company, supply-chain, or official evidence is missing.

Production sanity check after deployment:

- `/api/signals`: ok, 52 signal rows from `signal_tables`
- `/api/signals/[id]`: ok for the first signal row
- `/signals`: HTTP 200
- First production signal currently maps to Robotics / Embodied AI and reports `0/2` required evidence coverage. This is expected: it means the signal may be hot, but is not yet publication-ready without robotics adoption/order data and company milestone evidence.

Recent verified industry-series expansion added:

- semiconductor and related component producer price index
- semiconductor and other electronic component industrial production index
- power and specialty transformer producer price index

Production materialization currently added:

- 8 company-action evidence records
- 1 industry evidence record
- 0 forced commodity matches
- 0 future-data leaks

### 3.10 Internal and Public Pages

- `/signals`
- `/signals/[id]`
- `/signals/monthly`
- `/admin/signals`
- `/admin/backfill`
- `/admin/research`
- `/admin/stocks/import`
- `/admin/backtest`
- `/reports/signal-validation`
- `/reports/model-comparison`
- `/failed-signals`
- `/market-map`

The publication-review workspace and Evidence Panel have been verified on desktop and mobile without horizontal overflow.

`/admin/stocks/import` now includes an internal replay price-gap diagnostic panel:

- dry-run latest model replay price backfill
- run verified price backfill for the top missing replay symbols
- summarize blocked rows by normalized reason
- summarize blocked rows by symbol
- show a suggested next repair action for each symbol-level gap
- optionally exclude markets from the diagnostic run; KR can be skipped while Taiwan and US price quality are fixed first

## 4. Production and Test Status

### Production

- Vercel production deployment is active.
- Supabase production schema includes publication reviews.
- Monthly Signal API returns 18 months and 50 finalized Ledger signals.
- Evidence Panel returns all six categories.
- Evidence materialization is idempotent.

### Automated Checks

The following passed after the latest changes:

- `npm run test:signals`
- `npm run test:research`
- `npm run lint`
- `npm run build`

Lint currently has no errors. It still reports pre-existing warnings in unrelated older topic/news components.

## 5. Known Issues and Data Gaps

### P0 - Research Data Coverage

- Industry evidence is too narrow.
  - Current verified industry coverage mainly contains semiconductor/compute capacity utilization.
- Commodity coverage is narrow.
  - Current verified series mainly contain Henry Hub natural gas and copper producer-price data.
- Memory-specific evidence is still missing:
  - DRAM contract prices
  - NAND prices
  - HBM capacity and supply
  - inventory and lead-time data
- AI infrastructure evidence is incomplete:
  - AI server shipments
  - hyperscaler capital expenditure
  - rack power density
  - liquid cooling adoption
  - transformer and grid-equipment lead times
- Existing data must not be attached merely because it exists. Relevance and `known_at <= as_of_date` remain mandatory.

### P0 - Price and Corporate-Action Accuracy

- Stock prices still need broader automated split/dividend adjustment verification.
- Currency normalization is not yet complete for mixed-market baskets.
- Benchmark selection needs stronger sector-aware rules.
- Some symbols and exchanges require more reliable official-price providers.
- Missing or rejected prices correctly produce `pending`, but coverage remains incomplete.

### P1 - Signal Lifecycle

- `Reactivated` and `Expired` are not fully implemented.
- Cross-month identity continuity requires more validation.
- Similar themes may still create separate signals when naming changes substantially.
- Sustained AI themes need clearer separation between persistent background heat and genuinely new developments.

### P1 - Beneficiary Mapping

- Current mappings are still heavily rule-based.
- Value-chain roles are not consistently stored as structured fields.
- Each company needs explicit:
  - value-chain role
  - exposure mechanism
  - validation KPI
  - invalidation condition
- Non-TW/US market coverage is less complete.
- Industry-only signals should continue avoiding forced stock mappings.

### P1 - Research Confidence

- Research Confidence now penalizes news-only signals more strongly, but existing Signal Ledger rows are not automatically recalculated yet.
- Contradictory evidence is represented in the UI contract but lacks a complete ingestion and scoring workflow.
- Industry, commodity, company, supply-chain, and market evidence need category-specific weights.
- Publication drafts become stale when evidence changes; a controlled re-evaluation workflow exists but is not automatically scheduled.

### P1 - Backtest Automation

- Forward-price backfill is not yet fully scheduled for every mature horizon.
- 7/30/60/90-day validation should be run by a reliable periodic job.
- Split, dividend, delisting, symbol-change, and market-holiday cases require additional test fixtures.
- Outcome recalculation needs a clear version policy when corrected price data arrives.

### P2 - Internal Workflow

- Admin review currently uses a shared secret rather than user accounts and role-based permissions.
- Reviewer notes are supported by the API but the UI does not yet provide a full note editor.
- Bulk review and bulk evidence refresh are limited.
- Publishing Brief export is not yet available as a stable JSON/PDF/content API.

### P2 - Performance and Legacy Surface

- Signal detail API performs multiple return-detail queries and can take several seconds.
- Some older mock-era or legacy topic APIs and pages still exist in the repository.
- They are not the current product source of truth, but removal should be handled in a separate cleanup pass.
- Existing lint warnings remain in older components.
- `app.7z` is intentionally ignored and must never be committed.

## 6. Current Blockers

There is no blocking infrastructure failure at this time.

The primary constraint is data breadth and licensing:

- MacroMicro is useful as a taxonomy and research-design reference.
- Its charts and curated data must not be copied without an appropriate commercial license or API agreement.
- TrendRadar should prefer primary and legally usable sources such as official agencies, exchanges, filings, company disclosures, and licensed market-data providers.

The product can continue developing with current infrastructure, but high-confidence paid research should not be published until evidence coverage improves.

## 7. Next Development Target

### Target: Expand Verified Industry Evidence and Deepen Beneficiary Research

Immediate next step before overwriting or publishing historical outputs:

1. Run a new `monthly-full-market-v3` replay for 2025-01 through 2026-06. Completed.
2. Compare v3 confidence distribution against the previous Signal Ledger. In progress.
3. Backtest mature v3 candidates separately from old finalized rows. Completed first pass.
4. Only after comparison should any production monthly Ledger rows be finalized with the new model.

Latest v3 replay:

- run id: `replay-2025-01-2026-06-1782805159545`
- period: 2025-01 through 2026-06
- baseline model: `monthly-signal-v2`
- candidate model: `monthly-full-market-v3`
- baseline signals: 48
- candidate signals: 77
- average baseline family count: 2.67
- average candidate family count: 4.28
- coverage breadth lift: 60.3%
- candidate families discovered across the run:
  - ai-compute
  - biotech-health
  - defense-geopolitics
  - energy-commodities
  - ev-battery
  - macro-rates
  - memory
  - optical-network
  - power-grid
  - robotics
  - semiconductor
  - trade-tariffs

Latest v3 replay backtest first pass:

- total replay rows: 125
- mapped rows: 98
- tested rows: 69
- missing price rows: 23
- pending horizon rows: 6
- 30D test count: 71
- average 30D excess return: 8.47%
- baseline 30D average excess return: 8.01%
- candidate 30D average excess return: 9.04%
- baseline 30D success rate: 46.2%
- candidate 30D success rate: 53.1%

Interpretation: v3 catches materially broader market families and early backtest output is slightly better than baseline, but candidate confidence is intentionally lower because it now discounts news-only signals. The next task is not to publish v3 rows yet; it is to diagnose missing prices, inspect false positives, and decide which signal families deserve stronger evidence ingestion.

Latest replay price backfill diagnostic:

- Backfilled 103 verified prices for the latest replay run.
- Replay summary did not change after backfill, which means the remaining missing-price outcomes are blocked by price-quality gates rather than simple absence of data.
- Replay price backfill now groups skipped rows by normalized reason and symbol, and each symbol-level gap includes a suggested action for the next repair pass.
- Dry-run diagnostic for the next top 8 symbols found:
  - 102 fetchable prices
  - 37 sanity-range rejections
  - 10 corporate-action adjustment gaps
  - 5 no-price-found cases
  - 3 provider HTTP errors
- Main blocked symbols:
  - `1519.TW`: official vs Yahoo close gap now classified as `corporate_action_adjustment_gap`; likely adjusted-price or corporate-action handling issue.
  - `2408.TW`, `000660.KS`, `005930.KS`, `MU`: sanity range rejections on later 2026 dates; do not relax ranges without a second reliable source.
- Decision: keep these samples pending until official/adjusted price handling is improved. Do not force them into backtests.
- Suggested next actions are now explicit:
  - corporate-action adjustment gaps: add a Taiwan split/dividend/adjusted-price source before using the sample
  - sanity-range rejections: confirm with a second reliable source before changing the range gate
  - provider/no-price gaps: add a fallback provider or extend the trading-day lookup window while preserving source URL, currency, and quality status
- Latest dry-run with KR excluded selected only TW/US symbols:
  - `2408.TW`, `1519.TW`, `MU`, `NOC`, `RTX`, `2049.TW`, `8299.TW`, `ROK`
  - remaining blocked reasons: 18 sanity-range rejections, 10 corporate-action adjustment gaps, 4 no-price-found cases, 1 provider HTTP error
  - this confirms the current repair lane can focus on Taiwan and US first without deleting or hiding Korea gaps

#### Phase A - Source Registry

1. Define required evidence series by signal family.
2. Record source, license, frequency, unit, currency, publication lag, and revision policy.
3. Reject sources without traceable publication and known-at timestamps.

Initial families:

- Memory
- AI Compute
- AI Power and Grid
- AI Cooling
- Advanced Packaging
- Optical Networking
- Robotics / Embodied AI

#### Phase B - Data Ingestion

Prioritize legally usable primary sources:

- official statistics and energy agencies
- exchange filings
- SEC filings
- company investor relations
- FRED and similar public economic series
- licensed commodity and semiconductor pricing providers when available

Every record must include:

- observed date
- published date
- known-at timestamp
- source URL
- quality status
- unit and currency
- revision metadata

#### Phase C - Structured Beneficiary Mapping

Add structured fields for:

- value-chain role
- direct/indirect exposure
- revenue driver
- validation KPI
- invalidation condition
- geographic and currency exposure

#### Phase D - Confidence Recalculation

Recalculate Research Confidence when verified evidence changes.

Rules:

- Heat must remain separate from Research Confidence.
- Missing categories do not receive neutral scores.
- Contradictory evidence lowers confidence.
- Later evidence validates the signal but cannot rewrite information available at signal birth.

#### Phase E - Lifecycle and Validation Automation

1. Implement Reactivated and Expired.
2. Schedule verified price backfill.
3. Run mature 7/30/60/90-day outcomes.
4. Preserve corrected-data and model versions.
5. Compare model performance before and after evidence expansion.

## 8. Acceptance Criteria for the Next Milestone

The next milestone is complete when:

- At least three signal families have two or more non-news evidence categories.
- Every materialized evidence record passes `known_at <= as_of_date`.
- No unverified source enters Research Confidence or backtesting.
- Beneficiary rows include structured value-chain roles and validation KPIs.
- Research Confidence automatically updates through a versioned process.
- At least one monthly replay demonstrates whether the expanded evidence improves signal selection.
- All tests, lint, build, browser checks, production deployment, and production API checks pass.

## 9. Working Rules

- Do not return to mock APIs or mock topic data.
- Supabase Signal Ledger is the source of truth.
- Preserve successful and failed signals.
- Never hide missing data.
- Never use future information during signal generation.
- Do not force beneficiary mappings.
- Do not publish unverified prices.
- Replay price diagnostics distinguish above-range breakthroughs from below-range split, currency, or adjustment anomalies without relaxing the price-quality gate.
- A 2026-06-30 dry-run excluding KR classified 18 rows as `sanity_range_above_max`, 10 as `corporate_action_adjustment_gap`, 4 as `no_price_found`, and 1 as `provider_http_error`; questionable rows remain excluded from backtests.
- The next price-data task is symbol-specific verification: confirm `2408.TW` and `MU` against a second reliable source before versioning their sanity ranges, and add a trustworthy adjusted-price source for `1519.TW`.
- `price-sanity-v2-2026-06-30` versioned the `2408.TW` range after TWSE official and Yahoo same-date verification. The gate now requires both verification markers; a single source cannot use the revised range.
- The revised validation order checks Yahoo structure, date, and currency before pairing it with TWSE, then applies the final range gate to the combined record. This removed a circular verification failure without weakening validation.
- 111 verified TW/US replay prices were upserted. The replay now has 72 tested signals, 74 complete 30-day samples, and 20 signals still blocked by missing prices.
- Current replay comparison: candidate model 30-day success rate 51.4% and average excess return 8.59%; baseline 46.2% and 8.10%. These are research diagnostics, not investment advice.
- `MU` remains blocked above its old sanity range because a stable independent source was not available.
- `tw-corporate-actions-v1-2026-06-30` records the `1519.TW` 2025-07-25 stock-dividend adjustment. Pre-ex-date prices are accepted only when the TWSE/Yahoo observed factor matches the registered 1.1 factor within 0.5%.
- The corporate-action gate removed 10 false price blocks without introducing a general mismatch tolerance. Replay tested signals increased from 72 to 82, complete 30-day samples from 74 to 84, and missing-price signals fell from 20 to 10.
- After the broader sample entered validation, candidate 30-day success rate recalibrated to 50.0% and average excess return to 8.0%; the less flattering result is retained as the honest updated measurement.
- Formal TWSE ex-right/ex-dividend data is the required basis for future registry entries. Symbol-specific exceptions must include an ex-date, factor, source, and version.
- Monthly full-market Discovery now reads a 180-day historical window while preserving the strict `published_at <= as_of_date` boundary. This makes `Reactivated` meaningful instead of attempting to infer long-term dormancy from roughly one prior month.
- `Expired` will be derived from cross-month Signal Ledger continuity rather than inserted into the current month's hot-topic candidates.
- Discovery now checks candidate titles, keywords, and the majority of sample titles for explicit sports, entertainment, travel, food, anime, and game content. This protects the signal set when upstream categories are wrong.
- A 2026-06-30 production-data preview removed an MLB cluster mislabeled as technology and naturally promoted optical networking as the fifth qualified market direction.
- `signal_lifecycle_snapshots` now stores append-only cross-month continuity using stable family keys. A missing family cools first, expires after more than 45 dormant days, and becomes reactivated when it returns.
- The first 2026-06 lifecycle snapshot materialized five families: AI compute and memory sustained, defense/geopolitics and optical networking cooling, and power/grid emerging.
- Monthly finalization now ignores duplicate signal, watchlist, evidence, score component, and lifecycle keys. A rerun cannot silently rewrite the original research snapshot; corrections require a new model/versioned record.
- `signal_research_snapshots` now stores an append-only research contract that separates Heat, Research Confidence, Validation, Outcome, supporting evidence, counter evidence, validation conditions, invalidation conditions, and data gaps.
- Research snapshots reject evidence published after `as_of_date`; future evidence cannot enter the signal-birth record.
- The first 2026-06 materialization created five `signal-research-v1` rows. Verification then found that downside language such as `見頂`, `隱憂`, `示警`, and `降溫` was not classified as counter evidence, and that the power/grid topic could match the broader AI-compute beneficiary rule first.
- `signal-research-v2` fixes both issues without rewriting v1. It separates counter evidence from supporting evidence and selects the most specific beneficiary rule by matched-label coverage.
- Production verification retains all five v1 rows and adds five v2 rows. AI Compute and Memory each record one counter-evidence item, Power Grid now tracks grid/transformer orders and data-center power revenue, and an identical rerun keeps the total at ten rows.
- Current confidence remains intentionally low because the June snapshots are dominated by news evidence. Industry, commodity, company, and supply-chain evidence must be added before Research Confidence can rise.
- Beneficiary research mapping v2 replaces copied sector-level explanations with company-level value-chain roles, causal links, tracking KPIs, invalidation conditions, and primary-source URLs for AI Compute, Memory, and Power/Grid.
- `signal_beneficiary_mapping_snapshots` preserves these mappings as append-only records keyed by signal, symbol, market, and mapping version. Re-running the same month does not rewrite or duplicate the original mapping.
- The 2026-06 production materialization stored 21 beneficiary mapping snapshots. The three prioritized families contain 17 mappings; all 15 TW/US rows have primary-source URLs, while two KR memory rows remain explicitly deferred.
- Representative distinctions now include Micron as a DRAM/NAND/HBM manufacturer versus Phison as a NAND controller/storage solution provider, and Eaton as data-center power management versus Fortune Electric as a transformer/switchgear manufacturer.
- Generic or unrelated topics still return no beneficiary mapping. A company is not added merely because its share price or name appears near a hot topic.
- Evidence materialization v3 now reads the latest versioned beneficiary mappings instead of stale base watchlists. This prevents Power/Grid signals from inheriting AI Compute companies and filings.
- Commodity relevance is family-specific: copper and natural gas can support Power/Grid or Energy research, but no longer raise AI Compute confidence merely because a topic mentions data centers.
- Company-action evidence now rejects governance changes, dividends, bond conversion adjustments, and generic SEC form metadata. A filing must contain signal-specific operating evidence such as capacity, equipment, orders, shipments, revenue, contracts, or guidance.
- Generic high-tech utilization no longer satisfies Memory or Power/Grid evidence requirements. Memory requires memory-specific pricing and supply data; Power/Grid requires power, transformer, grid, or load data.
- Research Confidence v4 is append-only and evidence-based. It scores source quality, non-news category depth, required evidence coverage, verified beneficiary mappings, persistence, and contradictions without allowing news volume to substitute for hard evidence.
- The first 2026-06 confidence replay produced seven immutable snapshots: AI Compute 23.2, Memory 4.17, Power/Grid 31.45, and unsupported signals 0-5. These low scores are retained because the required industry data is genuinely missing.
- Identical confidence reruns keep seven rows. Each snapshot stores component scores and explicit data gaps; signal-birth Heat remains unchanged.
- Research raw-data upserts now preserve the first successful `known_at` instead of rewriting it on every sync. Two consecutive production FRED syncs changed zero existing timestamps.
- Four official Power/Grid series are now active: transformer PPI, electric-power transmission/distribution production, total electric-power production, and electric-power capacity utilization. The first ingestion stored 68 observations.
- These observations were first obtained on 2026-07-01, so they are intentionally excluded from the 2026-06-30 Signal snapshots even when their observation periods are older.
- Scheduled research ingestion now uses the FRED official CSV endpoint when an API key is unavailable. Source metadata records licensing notes, first-seen policy, revision policy, frequency, and original series URL.
- The internal quality report explicitly labels Memory pricing and AI Server shipment data as `licensed_or_manual_required`; news volume, generic filings, and stock prices cannot substitute for these missing research inputs.
- Keep external reports last; improve the internal research engine first.
- Ignore `app.7z`.

## 10. Scheduled Multi-Horizon Validation (2026-07-01)

- Formal Signal and historical replay backtests now share one canonical horizon set: 7, 30, 60, and 90 calendar days.
- The scheduled research cron, replay price backfill, admin backfill API, Signal detail API, and local replay scripts use the same horizon contract.
- A horizon is evaluated only after it matures. Missing, rejected, or unverified entry, exit, or benchmark prices leave the outcome as `pending`; they are never converted into a zero return.
- The latest immutable replay contains 125 signals. Of these, 98 have a direct beneficiary mapping, 27 remain explicitly unmapped, 12 are blocked by missing prices, and 4 have no mature complete horizon.
- Complete verified outcomes in the latest replay:
  - 7 days: 84 complete, 14 pending
  - 30 days: 86 complete, 12 pending
  - 60 days: 82 complete, 16 pending
  - 90 days: 76 complete, 22 pending
- The candidate model has 42 complete 30-day tests, a 52.4% success rate, and 8.13% average excess return. The baseline has 44 complete tests, a 45.5% success rate, and 7.61% average excess return.
- These figures are internal model diagnostics. They are not investment advice and must not be published without the review and publishing gates.
- Korean prices remain optional and may stay pending. The next validation task should prioritize remaining US/TW data gaps, then automate review-state updates from mature outcomes.

## 11. Internal Review and Publishing Gate (2026-07-01)

- The internal workflow keeps the explicit state machine: `draft -> reviewed -> approved -> published`, with rejection available before publication.
- Invalid jumps remain blocked. A published Signal cannot silently reopen as a draft, and approval or publication remains impossible while any required gate fails.
- Reopening a rejected Signal now recalculates the draft from current verified evidence instead of copying stale gate results.
- Draft evaluation is idempotent. Canonical JSON comparison prevents Postgres key-order differences from creating meaningless new versions.
- The daily research cron creates at most five missing internal drafts per run. It never marks a Signal reviewed, approved, or published.
- Publication evaluation now prefers the latest append-only beneficiary mapping snapshots. Legacy `signal_watchlists` are only a compatibility fallback.
- Production verification created five drafts with zero failures. Re-evaluating June Memory and Power/Grid correctly found six direct beneficiary mappings each and raised both quality scores from 72 to 88.
- Both signals remain ineligible because Research Confidence and required industry-evidence coverage are still below threshold. The gate is working as intended and does not mistake a good watchlist for a validated research thesis.
- Running the unchanged Memory draft twice returned the same review id and version. No duplicate version was created.

## 12. External Publication Data Contract (2026-07-01)

- A separate `/api/publications` contract now sits between the internal research platform and any future external report experience.
- The public feed returns only the latest `published` version for each Signal. Draft, reviewed, rejected, and approved research cannot leak through the public endpoint.
- An authenticated `includeApproved=true` mode supports internal preview of approved briefs before publication.
- Daily, ISO-weekly, and monthly grouping use the same versioned `SignalPublishingBrief` structure.
- The feed contains the approved headline, why-it-matters explanation, evidence summary, attention directions, tracking indicators, invalidation conditions, validation summary, quality score, disclosure, and immutable review version.
- No live Signal table is used to rewrite a published brief. External content remains tied to the reviewed snapshot.
- There are currently no approved or published Signals, so the correct public response is an empty feed. Existing drafts remain internal.
- The legacy validation report still reads internal Signal tables and should be treated as an internal diagnostic until its page is migrated to the publication feed.

## 13. Public Monthly Report Experience (2026-07-01)

- `/reports/signal-validation` now reads only the safe publication feed. It no longer renders internal Signal tables, replay diagnostics, draft candidates, or unreviewed watchlists.
- The page is server-rendered so the report content is present in the initial HTML without a client-side loading dependency.
- An honest empty state explains that the first report is still being verified. Candidate content is not used to fill an otherwise empty page.
- Published monthly research is structured around four user questions: why it matters, which companies deserve attention, what to track next, and what would invalidate the thesis.
- Desktop and mobile browser checks passed with no horizontal overflow, no loading state left behind, and no internal `Signal Ledger` or `Historical Validation` content.
- The full-page mobile screenshot facility rendered a distorted composite, but viewport-level screenshots and measured DOM geometry confirmed the real page is correctly responsive at 390 px.
- The older `/api/reports/signal-validation` remains available as an internal diagnostic API for now. The public page no longer consumes it.

## 14. Daily Evidence-to-Confidence Pipeline (2026-07-02)

- The scheduled research job now runs the complete internal sequence: source sync, Signal Ledger generation, beneficiary snapshot materialization, research-evidence materialization, versioned Research Confidence recalculation, backtest update, and draft creation.
- Each step is isolated through the existing degraded-mode wrapper. A source or evidence failure is reported without fabricating a successful downstream result.
- Daily Signal beneficiary mappings are now written to the append-only `signal_beneficiary_mapping_snapshots` table, not only the mutable compatibility watchlist table.
- Research Confidence snapshot versions include a deterministic fingerprint of accepted evidence ids, mapping symbols, assessment version, and evidence-materialization version. Identical reruns are idempotent; genuinely changed evidence creates a new auditable version.
- Publication evaluation now reads the latest Research Confidence snapshot instead of the stale initial value on `signal_events`.
- A strict 2026-07-02 production replay generated two active Signals. June research-snapshot counts stayed exactly 17 before and after, proving that evidence first known in July did not rewrite June.
- Production testing exposed a false positive: the embodied-robotics Signal inherited a generic semiconductor capacity-utilization metric. `evidence-v4` now requires robotics-specific industry data such as robot shipments, adoption, orders, deployments, automation equipment, servo motors, or reducers.
- The incorrect `evidence-v3` row remains in the ledger for auditability, but current confidence ignores it. The robotics score fell from 15.7 to 0, with explicit missing-data reasons.
- Re-running the same v4 assessment kept the robotics snapshot count unchanged at three. Its refreshed draft remains ineligible and correctly shows Research Confidence 0.
- The first production cron verification after this change exceeded Vercel's 300-second request budget. The request was cancelled and no success was reported.
- Root cause analysis found that the daily job still re-ran four horizons for the latest 25 Signals, regardless of maturity or completed outcomes.
- Daily backtesting now selects only mature horizons whose outcome is missing or pending, prioritizes never-attempted or oldest attempts, and processes at most five Signals per run.
- A production database run processed 17 due horizons across five Signals in 23.5 seconds. Completed success, partial, and failed outcomes will not be recalculated by the daily job.
- Historical replay validation is no longer embedded in daily ingestion. It remains available through the dedicated admin endpoint so it cannot exhaust the core data-ingestion budget.
- Every scheduled source task now reports its own duration, making future timeout diagnosis observable instead of speculative.
- After deployment, the full production cron completed successfully in 86.1 seconds: TWSE 4.0s, TPEx 10.8s, SEC 1.2s, FRED 15.0s, Signal Ledger 5.0s, evidence 2.7s, confidence 1.5s, incremental backtest 52.7s, and drafts 7.1s.
- The run reported `degraded: true`, meaning at least one external source task did not fully succeed, while Signal Ledger, evidence, confidence, backtest, and draft stages all completed. Partial source failure remains visible and does not become fabricated research evidence.
- Follow-up dry-runs and real idempotent upserts succeeded for all four sources: TWSE, TPEx, SEC EDGAR, and FRED. The earlier degraded result was transient rather than a reproducible schema or parser failure.
- External source tasks now retry once and report `attempts` plus cumulative duration. Downstream evidence, confidence, backtest, and publication tasks are never automatically retried.

## 15. TW Price Quality Remediation (2026-07-02)

- The 84-row price-quality backlog was separated by market and source before remediation. Korean prices remain deferred, and Yahoo-only US prices remain blocked until an independent source is available.
- Nineteen TW rows were re-fetched on their exact trading dates and cross-checked against TWSE or TPEx official closes plus Yahoo adjustment data.
- All nineteen passed the dual-source gate and were upserted as verified. A second dry-run found zero remaining TW `needs_review` rows.
- `price-sanity-v3-2026-07-02` adds narrow, versioned ranges for `2344.TW` and `6187.TW`. The revised ranges are unusable unless both the official-market and Yahoo-adjustment verification markers are present.
- Single-source records remain `needs_review`, and values above the revised maxima remain blocked. The change does not relax the general price-quality gate.
- `npm run prices:revalidate-tw` is a safe dry-run maintenance command. Adding `-- --write` is required before verified replacements are written.
- The expected unresolved backlog is now 65 rows: 38 deferred Korean rows and 27 Yahoo-only US rows. These must not enter backtests until their own source-quality requirements are satisfied.

## 16. US Independent Price Verification Gate (2026-07-04)

- The remaining US backlog contains 27 Yahoo-only rows across `AMD`, `GEV`, and `MU`. None were promoted based on Yahoo alone.
- `us-price-sanity-v1-2026-07-04` keeps each symbol's prior ceiling as a legacy boundary. Prices inside the old range retain existing behavior; only values above it can use the expanded range, and only with both Yahoo and Alpha Vantage verification markers.
- The independent-source adapter parses Alpha Vantage `TIME_SERIES_DAILY` data, compares raw closes on the exact trading date, and rejects symbol, date, or close differences above 1%.
- Stored provenance URLs never contain the Alpha Vantage API key.
- `npm run prices:revalidate-us` is dry-run by default. `-- --write` is required to persist rows that pass every gate.
- The production environment does not currently provide `ALPHA_VANTAGE_API_KEY`. The dry-run checked all 27 rows, verified zero, wrote zero, and retained all rows as `needs_review`.
- Historical `outputsize=full` access may require an appropriate Alpha Vantage plan. Until a valid independent source is configured, these US prices remain excluded from backtests.

## 17. Legacy RSS Topic Isolation (2026-07-04)

- A production audit found 125 legacy `rss-topic-*` rows with `slug = null`, no grouped-sync timestamp, and `status = active`. These rows represented individual RSS headlines rather than durable grouped topics.
- The legacy `syncRssToDatabase` path now writes articles only. Topic creation remains exclusively owned by `/api/topics/sync-grouped`.
- General topic reads and formal Signal detection now require an active topic with a non-null slug, preventing archived or legacy headline rows from entering research inputs.
- `npm run topics:archive-legacy` is dry-run by default and matches only the narrow legacy signature. `-- --write` changes matching rows to inactive without deleting them.
- The production cleanup archived all 125 matching rows. Verification found seven active grouped topics, zero active null-slug topics, and 125 preserved inactive legacy rows.
- Historical data remains available for audit. No topic, article, metric, or relationship row was deleted.

## 18. Historical Article Availability Gate (2026-07-04)

- A strict replay audit found that all 5,943 articles dated in 2025 were Google News historical-backfill rows first inserted on 2026-06-28. None can prove that TrendRadar possessed the data during 2025.
- Several rows exposed concrete date contamination, including titles explicitly labelled June 2026 while carrying June 2025 `published_at` values.
- Historical-backfill articles now use their database `created_at` as the earliest research-availability timestamp. Ordinary live RSS articles continue to use `published_at`.
- A Signal replay excludes any article whose research-availability timestamp is later than `as_of_date`. Google News archive metadata can no longer manufacture historical foresight.
- The monthly API now reads only the current strict `monthly-full-market-v3` ledger by default. Older v1/v2 rows and their backtests remain preserved for audit and model comparison, but are not presented as valid current research.
- Verification previews for 2025-01, 2025-06, and 2026-04 correctly returned zero eligible Signals. The 2026-06 preview retained five candidates based on data actually available by that date.
- Historical Time Machine coverage must now be rebuilt from sources with independently verifiable publication or archive timestamps. Lowering the gate to restore old charts is not acceptable.

## 19. Historical Article Time Verification Framework (2026-07-05)

- An append-only `article_time_verifications` migration records the claimed publication time, independently verified publication time, earliest proven availability time, verification method, evidence, verifier version, and check time.
- The first deterministic verifier recognizes explicit edition-date conflicts and accepts historical availability only when supported by original-page metadata plus archive evidence, or another independent archive existence proof.
- A dry-run audited all 8,858 historical-backfill articles:
  - 47 explicit timestamp conflicts
  - 8,811 unverifiable rows
  - 0 independently verified rows
- The 8,811 unverifiable rows are not assumed false, but they cannot participate in a historical Time Machine replay until independent evidence proves when they were available.
- Monthly Discovery now reads verified availability timestamps when present. Conflict, unverifiable, missing-table, and unreviewed records retain the conservative database `created_at` fallback.
- The write audit persists at most 500 rows per request, reports completed batch counts, and identifies the exact failed row range. A rerun remains idempotent through the article/version uniqueness key.
- Unit, research, lint, and production build checks pass with this gate.
- Deployment blocker: the migration has not yet been applied to production because this execution environment has neither a Supabase CLI access token nor an attached authenticated Supabase browser session. No database password was written into source code or shell history.
- After the migration is applied, run `npm run articles:audit-time -- --limit=10000 --write`. Expected initial result: 8,858 immutable verification rows, including 47 conflicts and no promoted 2025 Time Machine evidence.
- `npm run articles:verify-source -- --article-id=<id> --original-url=<url>` now performs a strict single-article verification:
  - query the earliest successful Internet Archive capture
  - read title and publication metadata from that archived snapshot
  - require at least 0.72 normalized title similarity
  - reject Google URLs and mismatched archive paths
  - produce a dry-run result unless `--write` is explicitly supplied
- The first real dry-run verified iThome article `171039`: archived title similarity 1.0, archived publication date 2025-09-05, and archive first-seen time 2025-09-05 12:02:29 UTC. This proves the evidence path works, but the row remains unwritten until the migration is applied.
- `npm run articles:verification-queue -- --month=YYYY-MM --limit=N` now creates a deterministic, read-only queue of unverified historical articles. It prioritizes official and trusted investable sources, emits exact-title/site search queries, and excludes ETF, stock-picking, price-target, institutional-flow, earnings-per-share, entertainment, and sports noise.
- The September 2025 queue scanned 577 historical rows and produced ten high-priority candidates, led by Presidency, Ministry of Foreign Affairs, Executive Yuan, and Ministry of Economic Affairs primary-source records.
- A second real dry-run verified Presidency article `39436`: the earliest archive snapshot retained the official ROC calendar publication date, the stored headline matched the archived headline as a full 0.95 prefix, and the archive first-seen time was 2025-09-09 13:29:17 UTC.
- Confirmed original URL mappings now live in the versioned `data/historical-source-manifest.ts` instead of conversation notes. A manifest entry is only a resolution candidate; every run still re-fetches the earliest archive capture and re-applies title, path, date, and evidence gates.
- `npm run articles:verify-manifest` replayed both confirmed entries with two verified results and zero failures. Adding `-- --write` will persist them only after the verification table migration is available.
- Three additional September 2025 primary-source records passed dry-run verification and entered the manifest: Ministry of Foreign Affairs semiconductor supply-chain forum, Executive Yuan AI Basic Act policy, and Ministry of Economic Affairs AI adoption program.
- The Ministry of Economic Affairs article was published on 2025-09-30 but first independently archived on 2025-10-01. Its strict `available_at` is therefore October 1, so it cannot enter a September 30 Time Machine snapshot even though the article's own publication date is in September.
- Three more September 2025 records passed the same independent gate: the Presidency biotechnology-industry event and two CNA reports about Taiwan's AI software policy. Their strict availability times come from the earliest matching archive captures, not the later database insertion date.
- The 2025/2026 Ministry of Economic Affairs industry whitepaper was not added to the manifest. Its live page exposes a publication date, but no matching successful Internet Archive capture was found, so it still lacks independent first-seen evidence.
- Cross-month verification started with the October 2025 queue. A CNA report on Taiwan's Russian-energy procurement policy passed with an independently archived publication time and first-seen timestamp.
- Two October government candidates were rejected rather than inferred: the AI patent-analysis page had no matching successful archive capture, while the A+ subsidy page's earliest snapshot lacked a usable title or publication timestamp.
- November verification found one reproducible CNA AI-policy record. The original article date is 2025-10-31, the historical feed claimed 2025-11-01, and the earliest independent archive capture is 2025-11-18. Strict replay therefore uses November 18 as `available_at`.
- Three November Ministry of Economic Affairs candidates had no matching successful archive capture, and a CNA semiconductor article failed the title-similarity gate. None was promoted.
- Production manifest writes still cannot proceed because the verification migration is unavailable. The write path now preserves Supabase `code`, `message`, `details`, and `hint` instead of collapsing plain PostgREST error objects into `Unknown verification error`, so the next attempt identifies the exact database blocker.
- A single-row production write probe confirmed the exact blocker as PostgREST `PGRST205`: `public.article_time_verifications` is absent from the schema cache. This is a migration absence, not a source-evidence or network failure.
- December verification added one reproducible Executive Yuan defense-industry policy record. Its page date is 2025-12-09 and the first independent archive capture is 2025-12-10, so strict replay uses December 10.
- Three other December primary-source candidates were rejected: two lacked matching successful archive captures and one earliest snapshot failed the title-similarity gate.
- Historical verification queues now treat versioned manifest entries as already verified even before the database migration exists. Database verification rows are merged into the same set when available, preventing completed source-resolution work from reappearing in later queues.
- The first January 2026 primary-source pass rejected both top candidates: the Tainan semiconductor-supply-chain page had no matching successful archive capture, and the Presidency health-technology page's earliest snapshot failed the title-similarity gate.
- February 2026 verification added iThome article `173751` about Intel and Saimemory's Z-Angle Memory collaboration. The archived title matched exactly, the original page date is 2026-02-04, and the earliest independent archive capture is 2026-02-04 03:46:19 UTC.
- A Ministry of Economic Affairs minerals-policy candidate was rejected. Its search index retained a 2026-02-25 date, but the original page no longer resolved and no matching successful archive capture was available, so it cannot enter strict replay.
- March 2026 verification added iThome article `174217` about AI data centers assuming incremental power and grid costs. The archived title matched exactly, the original page date is 2026-03-05, and the earliest independent archive capture is 2026-03-05 07:07:56 UTC.
- The Ministry of Economic Affairs five-trusted-industries article remains excluded from strict replay. Its live page exposes a 2026-03-04 timestamp, but no matching successful archive capture independently proves first-seen availability.
- The first April 2026 verification pass promoted no records. Three investable TechNews candidates covering BBU, data-center power constraints, and DRAM capacity competition had archive captures whose earliest snapshots lacked a usable title or publication timestamp.
- A Taichung semiconductor-investment announcement and a CNA press-release-platform record had no matching successful archive capture. Both remain excluded. April strict replay must stay unavailable until stronger independent first-seen evidence is found.
- Monthly coverage now separates raw published-month inventory from articles actually known by that month-end. Ordinary RSS records use their immutable database `created_at` as first-known time when available; `published_at` remains the event timestamp and can no longer imply earlier system possession.
- Coverage exposes eligible article count, observed collection days, and first/last known timestamps. A completed month with fewer than 14 actual collection days is classified as `discovery_limited`, even when article, source, price, commodity, and company-action counts are high.
- SEC EDGAR Company Facts now supplies traceable company-wide capital expenditure, inventory, and revenue observations. Memory research uses Micron inventory and capex; cloud infrastructure research uses company-wide capex for Microsoft, Alphabet, Meta, and Amazon.
- Every Company Facts observation retains the filing date, accession number, form, period, CIK, and official SEC archive URL. Company-wide capex is explicitly prohibited from being labelled as AI-specific capex.
- The first production Company Facts sync wrote and read back 96 verified observations: 35 Memory / DRAM / NAND observations for Micron and 61 AI Compute / Cloud Capex observations across Microsoft, Alphabet, Meta, and Amazon.
- Official filing-date coverage runs from 2025-01-29 through 2026-06-25. These hard-data rows do not bypass article availability gates: months without trustworthy discovery inputs remain `backfill_required`, while June 2026 retains multi-evidence readiness with 29 actual collection days and 21 industry observations.
- Beneficiary mapping v3 now emits only research-ready TW/US companies with an item-specific value-chain role, causal reason, at least three tracking metrics, at least three invalidation conditions, and at least one mapping source. Korean mappings are deferred.
- AI Cooling now has company-specific mappings for Vertiv, Auras, AVC, and Delta. Advanced Packaging initially retains only TSMC, ASE, and Amkor; equipment candidates without completed item-level evidence remain excluded rather than inheriting generic group text.
- Current `signal_watchlists` are replaced per generated Signal for rule-based sources, including when v3 returns no eligible beneficiary. Immutable mapping snapshots remain untouched, so old model decisions stay auditable without leaking into the current watchlist view.
- `npm run signals:rebuild-beneficiaries` provides a dry-run maintenance audit across all existing Signals. `-- --write` replaces only rule-based current watchlists with v3 while preserving manual rows and immutable historical mapping snapshots.
- The first production v3 rebuild found 290 existing rule-based rows, planned 253 research-ready rows, and identified 65 stale mappings. Production lacks the `causal_reason` watchlist column, so the maintenance command now uses the same explicit legacy-column fallback as normal ledger generation.
- After fallback recovery, production contains 253 current rule-based rows: 102 US and 151 TW, with zero KR rows. The temporary failed research-column write did not cause lasting data loss. Full item-level fields require the existing watchlist research-column migration before they can be exposed from the current-view table.
- Daily backtesting now compares every stored outcome's detail basket with the current watchlist before treating a completed result as final. A changed beneficiary set makes the outcome due for recalculation; Signals with no current watchlist are skipped instead of repeatedly writing meaningless pending outcomes.
- The first production consistency audit found 280 outcomes: 79 matched beneficiary v3, 173 used stale baskets, and 28 belonged to Signals with no current mapping. Existing rows remain preserved until the updater recalculates eligible stale outcomes.
- Automatic daily backtesting now accepts only `monthly-full-market-v3` and live `rule-v2` Signals. Legacy `monthly-signal-v2` and `monthly-full-market-v1` outcomes remain available for model audit but cannot enter the current updater.
- Before the model-version gate was added, the first five legacy Signals were recalculated across 20 horizons with beneficiary v3. They remain explicitly legacy results and are not counted as strict Time Machine validation.
- The model-comparison API now includes an independent `strictPerformance` section. It counts only current model versions, mature horizons, complete prices, and outcomes whose stored basket matches the current beneficiary basket.
- Strict statistics report per-horizon mature and valid sample counts, success/partial/failure counts, Basket, Benchmark, Alpha, first completed validation days, and explicit exclusion reasons measured in Signal-horizons. Market-consensus lead time remains unavailable until a versioned consensus event exists; the system does not fabricate it.
- The first production strict-statistics run on 2026-07-06 found 8 current-model Signals and 4 with direct beneficiary mappings. No valid outcome is mature yet, so success rate, returns, Alpha, and lead-time statistics correctly remain unavailable instead of borrowing legacy results.
- Daily research automation now backfills independently validated prices for current `monthly-full-market-v3` and `rule-v2` Signals before running due 7/30/60/90-day outcomes. Legacy models are excluded from both the automatic price queue and current performance statistics.
- US prices now require exact-date Yahoo and Alpha Vantage agreement within 1% before they can enter backtests. The automatic fetch path reuses the existing independent-source adapter and caches each symbol's daily series per execution; Yahoo-only database rows are rejected by the final usability gate.
- Evidence materialization v5 preserves older evidence rows for audit but excludes stale v4 matches from current confidence calculations. Daily automation refreshes every current-model Signal and recalculates immutable research snapshots at each original `as_of_date`, rather than updating only Signals created today.
- Evidence materialization v6 selects the latest source observation by `period_end` or `quote_date`, not by retrieval time alone. Historical FRED backfills with identical `known_at` timestamps can no longer surface stale 2003/2025 values as the current Signal evidence.
- The first production v6 refresh rebuilt all 8 current-model Signals with 12 relevant non-news evidence rows. Power evidence now uses May/June 2026 copper and natural-gas observations; unsupported robotics, CPO, optical-network, and geopolitical Signals remain at zero or minimal hard-evidence confidence instead of inheriting generic metrics.
- SEC Company Facts coverage now includes explicit profiles for GEV, ETN, and VRT in addition to Memory and cloud-capex companies. Unknown tickers produce no observations instead of inheriting an AI Compute label.
- Evidence materialization v7 classifies SEC Company Facts as `official` company evidence. Company-wide capex, inventory, and revenue can support corporate activity but cannot masquerade as industry shipments, grid lead times, cooling adoption, or AI-specific segment performance.
- The first production expansion wrote 103 verified Company Facts observations: 33 GEV, 33 ETN, and 37 VRT. The v7 refresh produced 18 relevant evidence rows; Power/Grid gained official company activity while both required grid-equipment and power-demand gaps remained open, confirming that company-wide facts do not falsely complete industry requirements.
- The EIA US48 Grid Monitor adapter is ready for daily average and peak electricity demand. It requires `EIA_API_KEY`, uses retrieval time as `known_at`, and labels the observations as general grid demand rather than data-center-specific consumption. EIA bulk archives were rejected for Vercel ingestion after HEAD checks found 672 MB and 290 MB ZIP files.
- `price-sanity-v4-2026-07-06` expands the 2344.TW ceiling only above the prior 150 boundary and only when TWSE official and Yahoo same-date verification markers are both present. The 2026-06-30 close was independently reproduced as 207.50 from both sources.
## 25. Grid Equipment Evidence Expansion (2026-07-06)

- Added the official FRED/BLS `WPU117409` monthly producer price index for power and distribution transformers.
- Added the Federal Reserve `IPG3353S` monthly industrial production index for electrical equipment manufacturing.
- Both series retain the FRED source URL, observation period, and TrendRadar retrieval time. Historical periods are not treated as historically known before retrieval.
- FRED ingestion now isolates failures by series. One unavailable series no longer discards all other verified observations; a complete provider failure still fails the source task.
- A live CSV-fallback verification fetched both series with no failures. The latest available observations were May 2026: transformer PPI `365.306` and electrical-equipment production `97.4443`.
- Research and Signal invariants, lint, and production build pass. Existing lint warnings remain unrelated to this data change.
## 26. Micron Official Memory Milestones (2026-07-06)

- Added a server-compatible parser for Micron's fiscal Q3 2026 press release filed as SEC Form 8-K Exhibit 99.1.
- Materialized two verified company-product observations: HBM4 high-volume shipments and the stated HBM4E calendar-2027 volume-production plan.
- The SEC exhibit does not expose an exact release minute, so `known_at` conservatively uses 23:59:59 UTC on the filing date. The pipeline does not claim earlier availability.
- Each observation retains the SEC exhibit URL and explicit `company-product` scope. It is not treated as a market-wide shipment, capacity, contract-price, or bit-shipment series.
- Direct Micron IR HTML is protected by a bot challenge in server-side fetches, so the reproducible SEC exhibit is the ingestion source.
- DRAM/NAND contract pricing, comparable industry capacity, and bit-shipment series remain open licensed/manual data gaps.
## 27. NVIDIA Data Center Demand Proxy (2026-07-06)

- Added a reproducible SEC Exhibit parser for NVIDIA fiscal Q4 2026 and fiscal Q1 2027 releases.
- Materialized verified Data Center segment revenue observations of USD 62.3 billion and USD 75.2 billion for periods ending 2026-01-25 and 2026-04-26.
- Each observation uses conservative end-of-release-date UTC as `known_at`, retains its SEC URL, and is scoped as `company-segment`.
- The evidence registry accepts Data Center revenue as an AI compute demand proxy, but the quality plan remains `partial`: segment revenue is not labelled as GPU or AI Server shipment volume.
- Daily research ingestion now refreshes these SEC exhibits independently of generic filing metadata.
- Actual GPU and AI Server shipment counts remain an explicit licensed/manual data gap.
## 28. First Strict 7-Day Validation Readiness (2026-07-06)

- Audited all eight current strict Signals against their current beneficiary baskets and stored outcomes.
- The mapped June monthly Signals use `2026-06-30` as the Signal date. Their first 7-day horizon matures on `2026-07-07`; no result was calculated early.
- Verified-price backfill requested 27 entry, exit, and benchmark observations. Twelve TW observations passed exact-date TWSE plus Yahoo adjustment checks and were written as `verified`.
- Fifteen US or SPY requests remained blocked because `ALPHA_VANTAGE_API_KEY` is not configured. They remain pending and are not replaced with zero returns or single-source Yahoo data.
- Existing unmapped CPO, robotics, geopolitical, and optical-network Signals remain explicitly unmapped. The system does not invent beneficiary baskets merely to increase sample size.
- A mixed-market outcome will remain pending until every member of its immutable current basket and its benchmark pass the strict price gate.

## 29. Daily and Weekly Market Brief Data Map (2026-07-11)

- Expanded the market brief data-requirement contract for the July live reporting workflow.
- Added the official TWSE institutional trading page supplied by the user as the primary source candidate for TWSE foreign/institutional flow work: `https://www.twse.com.tw/zh/trading/foreign/twt38u.html`.
- Added explicit pending requirements for TAIFEX futures positioning, options PCR, TW margin/short data, TWD FX, US VIX/risk sentiment, cross-asset macro inputs, and market-news RSS.
- Global macro and RSS inputs are now represented as auxiliary evidence requirements rather than Taiwan or US market-number fields.
- The report contract continues to show missing numerical sections as `pending`; no institutional, futures, sector, macro, or sentiment number is emitted before an official or authorized connector exists.
- Next connector priority: official TW institutional flows, TPEx OTC index, and Taiwan sector/constituent movers for the July daily/weekly reports.

## 30. TWSE Foreign Investor Flow Connector (2026-07-11)

- Added a server-side parser and fetcher for the official TWSE `TWT38U` endpoint behind the user-supplied foreign trading page.
- The connector parses foreign and mainland investor daily buy, sell, and net-share data by listed security from `https://www.twse.com.tw/rwd/zh/fund/TWT38U?date=YYYYMMDD&response=json`.
- Daily market brief now uses the official TWSE foreign-investor summary when available. The output is marked `partial`, uses unit `shares`, retains the source URL, and exposes the top net-buy or net-sell stocks.
- The system still does not claim full three-institution coverage: investment trust, dealer, cumulative flow, and consecutive buy/sell days remain pending until their official sources are connected.
- Dates with no TWSE data safely return pending instead of breaking the report or fabricating flows.
