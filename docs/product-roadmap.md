# TrendRadar Product Roadmap

## North Star

TrendRadar should become a Market Signal Research System.

The goal is not to build another news summary app. The goal is to build a Signal Ledger that turns market information into research cases that can be validated over time.

## MVP Redefined

The MVP is not "finish the signal engine."

The MVP is:

Build 5 complete and verifiable historical signal case studies.

Suggested first cases:

1. Memory Supercycle
2. AI Power Infrastructure
3. AI Cooling Infrastructure
4. CoWoS Capacity
5. Nuclear / Grid Infrastructure

Each case must include:

- Time Machine context
- Signal date
- Investment thesis
- Signal DNA
- Beneficiary watchlist
- Timeline
- 7D / 30D / 60D / 90D backtest
- Outcome
- Lessons learned

## Product Surfaces

### 1. `/signals`

Signal Ledger entry page.

Primary question:

What market signals are currently worth researching?

Must show:

- Hero signal
- Wow Moment
- Market Map
- Emerging signals
- Latest validation
- Signal status

### 2. `/signals/[id]`

Signal Case Study page.

Primary question:

Why should I trust this signal?

Must show:

- Executive summary
- Signal DNA
- Evidence
- Timeline
- Investment thesis
- Beneficiary basket
- Backtest
- Outcome
- Lessons learned

### 3. `/daily`

Daily Signals page.

Primary question:

What new market signals appeared today?

This page should later generate:

- Website brief
- Threads post
- X post
- IG card copy

### 4. `/weekly`

Weekly Market Signals page.

Primary question:

Which signals were added, validated, failed, or are gaining momentum this week?

### 5. `/reports/signal-validation`

Investor-readable validation report.

Primary question:

Does TrendRadar's signal process work?

## Sprint Plan

### Sprint 1: Product Clarity

- Turn positioning into website language
- Clarify that TrendRadar is not a news website
- Add landing explanation around Signal Ledger
- Keep existing signal pages as the product core

### Sprint 2: Signal Case Study Model

- Add timeline events support
- Add lessons learned support
- Improve `/signals/[id]` into a real case study page
- Keep the current UI honest when validation data is missing

### Sprint 3: 5 Historical Cases

- Build 5 full case studies
- Allow manual or CSV-backed case data at first
- Prioritize completeness over automation
- Use real historical information when possible

### Sprint 4: Daily Signal Brief

- Create internal daily brief generator
- Output copy for Threads, X, IG, and website
- Keep posting manual at first
- Use public content to test PMF

### Sprint 5: Weekly / Monthly Reports

- Weekly report can be public
- Monthly report can be partially gated
- Paid layer should include full timeline, basket, backtest, and database access

## What Not To Do Yet

Do not prioritize:

- More AI features
- More data sources
- More model complexity
- Automated social posting
- Payments
- Member accounts
- Full market coverage

Until the first 5 verifiable case studies are strong, more automation will not solve the trust problem.

## Product Principle

Evidence before automation.

TrendRadar should win because it can show what it saw at the time, what thesis it formed, and what happened afterward.
