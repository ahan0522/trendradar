# TrendRadar Development Progress

Last updated: 2026-06-30
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
