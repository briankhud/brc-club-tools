# BRC Club Tools

Internal tools, planning documents, and resources for **Brighton Rowing Club** (Rochester, NY) — covering event registration, team tracking, and club operations.

## Contents

### Planning Docs
- [`brighton-burn-registration-onepager.html`](brighton-burn-registration-onepager.html) — Board discussion one-pager: proposal to move Brighton Burn registration off Regatta Central and onto the BRC website, with fee comparison, platform options, and registration form requirements.

### RowDay App (`app/`)

React Native + Expo companion app for parents and athletes to track race schedules, heat sheets, and results from Regatta Central during regattas.

- Live countdown to next heat
- Heat sheets with lane-by-lane breakdown
- Results as they're posted
- Push notifications for heat starts and results

See [`app/README.md`](app/README.md) for setup instructions.

### RowDay Backend (`backend/`)

Node.js + Hono REST API that serves regatta data to the app. Backed by PostgreSQL, with a cron-based scraper for pulling live data from Regatta Central.

See [`backend/README.md`](backend/README.md) for setup instructions.

## Background

Brighton Rowing Club serves 7–12th grade student athletes from Brighton and surrounding Rochester-area communities. The **Brighton Burn** is BRC's annual indoor rowing fundraiser, held each February at Twelve Corners Middle School.

This repo is a workspace for building out club tooling including:
- Event registration (Brighton Burn and others)
- Participant and team tracking
- Waiver management
- Reporting / results
- Regatta companion app (RowDay)

## Status

- Registration migration research: see board discussion doc above
- RowDay app: initial scaffold complete, hardcoded seed data for Brighton Burn 2026, Regatta Central scraper stubbed

## Contact

[info@brightoncrew.org](mailto:info@brightoncrew.org) · [brightoncrew.org](https://www.brightoncrew.org)
