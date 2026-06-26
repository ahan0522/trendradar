# Signal Case Study Spec

## Purpose

Each TrendRadar signal should become a durable case study.

The case study should answer:

- What did TrendRadar detect?
- Why was it investable?
- What evidence existed at the time?
- Which companies might benefit?
- What happened after the signal?
- What did the system learn?

## Case Study Structure

### 1. Executive Summary

Short investor-readable summary.

Required fields:

- Signal name
- Signal date
- As-of date
- Signal type
- Signal strength
- Confidence score
- Current status
- One-paragraph summary

### 2. Time Machine Context

Only information available on or before `as_of_date` can be used to form the signal.

Required fields:

- Available articles
- Available price data
- Available company actions
- Available supply chain information
- Data gaps

### 3. Signal DNA

Explain why the signal exists.

First version dimensions:

- News
- Price
- Supply Chain
- Company Activity
- Persistence
- Beneficiary Clarity

Future version should store raw component scores:

- Mention spike
- Price spike
- Source diversity
- Persistence
- Company activity
- Beneficiary clarity

### 4. Investment Thesis

The thesis must explain why the signal matters.

It should include:

- What changed
- Why it matters
- Why the market may not fully price it yet
- What would confirm the thesis
- What would invalidate the thesis

### 5. Evidence

Evidence should be grouped by type:

- News evidence
- Price evidence
- Supply chain evidence
- Company action evidence
- Official / primary source evidence

Every evidence item should include:

- Date
- Source
- Source type
- URL if available
- Summary
- Why it matters

### 6. Beneficiary Mapping

Each beneficiary should include:

- Symbol
- Company name
- Market
- Thesis
- Weight
- Mapping source
- Risk / caveat

The watchlist is not a buy recommendation.

It is a research basket for validation.

### 7. Timeline

Timeline should show how the signal evolved.

Example:

```text
2026-03-31 Signal detected
2026-04-03 Supply chain evidence expands
2026-04-10 Price spike appears
2026-04-22 News coverage expands
2026-05-18 Company guidance confirms thesis
2026-06-20 Outcome validated
```

Each event should include:

- Date
- Event type
- Title
- Description
- Source link
- Whether the event was known at signal time or only used for validation

### 8. Backtest

Backtest should include:

- Entry date
- Entry price
- Exit prices
- 7D return
- 30D return
- 60D return
- 90D return
- Basket return
- Benchmark return
- Excess return

Suggested benchmarks:

- US signals: SPY or QQQ
- Taiwan signals: 0050.TW
- Mixed AI infrastructure signals: QQQ or custom AI infrastructure basket

### 9. Outcome

Allowed outcomes:

- Success
- Partial
- Failed
- Pending

Initial rules:

- Success: excess return >= 5%
- Partial: excess return >= 0%
- Failed: excess return < 0%
- Pending: insufficient data

### 10. Lessons Learned

Each case should include a postmortem.

Questions:

- What did the signal get right?
- What did the signal miss?
- Which evidence mattered most?
- Which evidence was noisy?
- Should future scoring change?
- Did the beneficiary basket make sense?

## Suggested Future Tables

The current project already has:

- `signal_events`
- `signal_watchlists`
- `stock_prices`
- `signal_outcomes`

Recommended next tables:

- `signal_timeline_events`
- `signal_lessons`
- `signal_evidence_items`

These should be added only when the product direction is confirmed and the first case study format is stable.
