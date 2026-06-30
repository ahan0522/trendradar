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
- Keep external reports last; improve the internal research engine first.
- Ignore `app.7z`.
