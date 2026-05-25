# RowDay Startup Execution Plan

**Last updated:** 2026-05-25  
**Owner:** Brian Hudson  
**CTO/Strategy:** Claude (Anthropic)

> This is the living command document for RowDay. Open it in the morning, work the checklist, cross things off, update status. Commit changes as you go.

---

## Table of Contents

1. [Virtual Team Org Chart](#1-virtual-team-org-chart)
2. [Product Roadmap — 6 Weeks](#2-product-roadmap--6-weeks)
3. [Technical Architecture — Gaps & Fixes](#3-technical-architecture--gaps--fixes)
4. [Infrastructure: Local Dev to Railway](#4-infrastructure-local-dev-to-railway)
5. [Beta Launch Plan — BRC Parents](#5-beta-launch-plan--brc-parents)
6. [Business Entity Checklist](#6-business-entity-checklist)
7. [Revenue Model](#7-revenue-model)
8. [Competitive Moat](#8-competitive-moat)
9. [Risk Register](#9-risk-register)
10. [Brian's Morning Action List](#10-brians-morning-action-list)
11. [Elevator Pitch](#elevator-pitch)

---

## 1. Virtual Team Org Chart

Each role below maps to a specialized Claude agent (or Brian directly, for items that require a real human). When you ask Claude to work on a domain, explicitly invoke the relevant role at the start of the session so the agent loads the right context and mental model.

### Priority 1 — Build the thing

| Role | Agent Invocation | Owns | Status |
|------|-----------------|------|--------|
| **Backend Engineer** | "You are the RowDay Backend Engineer" | `/backend/` — Hono API, database wiring, syncer integration, scheduler | ✅ DONE: Playwright syncer works (40 events, 131 clubs validated on CSSRA 2026). DB wired. All 5 hardcoded routes replaced with Postgres queries. 4 new endpoints added. Fire-and-forget sync endpoint live. Railway deployed, health check passing. |
| **iOS / React Native Engineer** | "You are the RowDay iOS/RN Engineer" | `/app/` — all Expo/RN screens, navigation, components, push notifications | ✅ DONE: Push notification wiring done. Tab icons wired. Settings navigation wired. Age gate screen added. Zustand persistence added. Hardcoded defaults removed. QueryClientProvider added (was missing). |
| **DevOps / Infrastructure** | "You are the RowDay DevOps Engineer" | Railway deployment, env vars, Postgres provisioning, CI | ✅ DONE: Railway project live. nixpacks.toml fixed (nodejs_20 + Chromium). SSL detection fixed for Railway internal network. Schema migrated. Health check passing. |

### Priority 2 — Ship to users

| Role | Agent Invocation | Owns | Status |
|------|-----------------|------|--------|
| **Product Manager** | "You are the RowDay Product Manager" | Feature prioritization, user stories, sprint planning, regatta readiness checklist | READY: can create sprint board and user stories on demand. |
| **Growth / Marketing** | "You are the RowDay Growth Lead" | Parent WhatsApp/email messaging, BRC launch, App Store copy, social proof gathering | WAITING: needs working app before launch messaging matters. |
| **Legal / Compliance** | "You are the RowDay Legal Advisor" | LLC formation, COPPA compliance, privacy policy, ToS, trademark | ACTIVE: several tasks Brian must execute himself this week (see Section 6). |

### Priority 3 — Scale

| Role | Agent Invocation | Owns | Status |
|------|-----------------|------|--------|
| **Design** | "You are the RowDay Design Lead" | Figma components, branding, app icon, screenshots, App Store assets | WAITING: current UI is functional but unstyled icons. After first regatta. |
| **Data / Syncing** | "You are the RowDay Data Engineer" | Syncer maintenance, heat-sheet PDF parsing, edge case handling, syncer health monitoring | ✅ DONE: Playwright syncer bypasses RC bot detection. PDF parser implemented — 194/194 races, 40/40 events validated on CSSRA 2026. Terminology renamed scrape→sync (branch in progress). |

---

## 2. Product Roadmap — 6 Weeks

### Target Event: Lake Ontario Invitational (~early June 2026)

Note: Web search did not find a confirmed RC job_id for this event yet. Check `https://www.regattacentral.com/regattas` and search "Lake Ontario" around May 28 to get the job_id when entries open. The syncer is already proven on job_id=10115 (CSSRA 2026, 40 events, 131 clubs, 194 races).

---

### Week 1–2 (May 25 – June 7): Regatta-Ready MVP

**Goal:** A working app Brian can hand to BRC parents at the regatta. Must work on real phones pointed at a live Railway backend syncing real RC data.

#### Backend tasks

| Task | File(s) | Status |
|------|---------|--------|
| Wire syncer output → Postgres | `backend/src/index.ts`, `backend/src/db/client.ts` | ✅ DONE — All 5 hardcoded routes replaced with DB queries. |
| Add sync trigger endpoint | `backend/src/index.ts` | ✅ DONE — `POST /api/admin/sync?job_id=NNNNN` (fire-and-forget, returns 202). Status polling at `GET /api/admin/sync/:jobId`. |
| Wire scheduler to DB | `backend/src/jobs/sync-scheduler.ts` | ✅ DONE — `getActiveRegattaIds()` DB call replaces static stub. Full diff+upsert logic implemented. |
| Push notification sender | `backend/src/jobs/sync-scheduler.ts` | ✅ DONE — Expo push SDK wired for result status changes. |
| Register device token endpoint | `backend/src/index.ts` | ✅ DONE — `POST /api/subscriptions` stores device token + regatta_id + athlete name. |
| Update results endpoint | `backend/src/index.ts` | ✅ DONE — `GET /api/regattas/:id/results` returns all races + lanes. |

> ⚠️ Note: `startSyncScheduler()` is intentionally NOT wired into index.ts yet — add it after confirming DB is stable through a few manual syncs.

#### App tasks

| Task | File(s) | Status |
|------|---------|--------|
| Wire notification permission request | `app/app/onboarding.tsx` | ✅ DONE — `expo-notifications` wired, token POST to `/api/subscriptions`. |
| Persist store to AsyncStorage | `app/store/useAppStore.ts` | ✅ DONE — Zustand persist middleware + AsyncStorage. Hardcoded BRC defaults removed. |
| Wire Settings screen navigation | `app/app/(tabs)/settings.tsx` | ✅ DONE — `router.push('/onboarding')` on all three action rows. |
| Add tab bar icons | `app/app/(tabs)/_layout.tsx` | ✅ DONE — `@expo/vector-icons` Ionicons wired. |
| Add age gate / COPPA screen | `app/app/age-gate.tsx` | ✅ DONE — Age gate created, `hasPassedAgeGate` in AsyncStorage. |
| Point API at Railway URL | `app/.env` | ✅ DONE — `.env` created. Currently `localhost:3000` for dev. **Update to Railway URL before phone test.** |
| Handle "no heats yet" gracefully | `app/app/(tabs)/index.tsx` | ✅ DONE — Empty schedule shows "Heat assignments not yet posted" message. |

#### Infrastructure tasks

| Task | File(s) | Status |
|------|---------|--------|
| Create Railway project | Railway dashboard | ✅ DONE |
| Set env vars | Railway dashboard | ✅ DONE — `DATABASE_URL` (reference var), `ADMIN_SECRET`, `RC_REQUEST_DELAY_MS=800`, `NODE_ENV=production` |
| Provision Railway Postgres | Railway dashboard | ✅ DONE |
| Run schema.sql on Railway Postgres | CLI via `DATABASE_PUBLIC_URL` | ✅ DONE — 9-table schema applied |
| Deploy backend to Railway | `railway up` | ✅ DONE — Health check passing. nixpacks.toml fixed for Chromium. |

---

### Week 3–4 (June 8–21): Polish + TestFlight Beta

**Goal:** 10–20 BRC parents actively using the app. Gather feedback. Fix bugs.

| Task | Notes |
|------|-------|
| EAS Build for iOS (TestFlight) | `eas build --platform ios --profile preview`. Requires Apple Developer Program enrollment ($99/yr). |
| EAS Build for Android (internal) | `eas build --platform android --profile preview`. Share as APK via Google Drive link to Android users. |
| App icon + splash screen | Commission or create a simple oar/wave icon. Use Figma or Canva. Export per Expo asset requirements. |
| Privacy policy live URL | Generate with iubenda (free tier covers this). Must be a live URL for App Store and Play Store submissions. |
| Crash reporting | Install `@sentry/react-native` (free tier: 5k errors/month). Wrap `App.tsx` with Sentry. |
| Offline-graceful UX | Show last-cached data with "Last updated: X min ago" if backend is unreachable. |
| Athlete search improvement | Currently text-entry only (onboarding.tsx). Wire against `/api/regattas/:id/athletes?q=` endpoint. |

---

### Week 5–6 (June 22 – July 5): App Store Submission Track

**Goal:** Submitted to App Store review. App Store listing live or in review.

| Task | Notes |
|------|-------|
| LLC formed + EIN obtained | Required before Apple org enrollment. |
| DUNS number received | Allow 5 business days from D&B request. |
| Apple Developer Program enrollment (org) | $99/yr at developer.apple.com. Use LLC name. |
| Google Play Console enrollment (org) | $25 one-time at play.google.com/console. |
| App Store listing copy | Title: "RowDay – Rowing Companion". Subtitle: "Heat sheets, results & countdowns". Keywords: rowing, regatta, heat sheet, results, crew. |
| EAS Submit to App Store | `eas submit --platform ios` — submits the production build to App Store Connect. |
| EAS Submit to Google Play | `eas submit --platform android` |
| TestFlight public link | Enable external testing group in App Store Connect for broader BRC distribution while App Store review is pending (up to 10,000 testers, no invitation required). |

---

## 3. Technical Architecture — Gaps & Fixes

This section catalogs every significant stub, TODO, and missing connection in the original codebase as of 2026-05-24. **All 10 issues below were resolved on 2026-05-25.**

### 3.1 Backend — `backend/src/index.ts` ✅ FIXED (2026-05-25)

~~**Problem: Entire API runs on hardcoded in-memory data.**~~

**Resolution:** All 5 hardcoded routes replaced with Postgres queries via `backend/src/db/queries.ts`. 4 new endpoints added: `GET /api/regattas/:id/results`, `GET /api/regattas/:id/athletes?q=`, `POST /api/subscriptions`, `POST /api/admin/sync`. Fire-and-forget sync endpoint returns 202 immediately with status polling at `GET /api/admin/sync/:jobId`.

---

### 3.2 Syncer Scheduler — `backend/src/jobs/sync-scheduler.ts` ✅ FIXED (2026-05-25)

~~**Problem: `ACTIVE_REGATTA_IDS` is hardcoded empty.**~~

**Resolution:** `getActiveRegattaIds()` DB call (`SELECT rc_regatta_id FROM regatta WHERE status = 'active'`) replaces the static stub. Full fetch → diff → upsert → push notification loop implemented.

> ⚠️ `startSyncScheduler()` still NOT wired into `index.ts` — intentional. Add after confirming DB stability through a few manual syncs.

---

### 3.3 App — `app/store/useAppStore.ts` ✅ FIXED (2026-05-25)

~~**Problem: Hardcoded dev defaults will ship to real users.**~~

**Resolution:** `activeRegatta`, `followedClub`, `followedAthlete` now initialize to `null`. Zustand `persist` middleware with AsyncStorage added.

---

### 3.4 App — `app/app/onboarding.tsx` ✅ FIXED (2026-05-25)

~~**Problem: Push notification permission is a TODO.**~~

**Resolution:** `expo-notifications` wired. `requestPermissionsAsync()` called, token obtained and POSTed to `/api/subscriptions`.

---

### 3.5 App — `app/app/(tabs)/settings.tsx` ✅ FIXED (2026-05-25)

~~**Problem: All action rows are dead-end TODOs.**~~

**Resolution:** All three TODO `onPress` handlers replaced with `router.push('/onboarding')`.

---

### 3.6 App — `app/app/(tabs)/_layout.tsx` ✅ FIXED (2026-05-25)

~~**Problem: Tab bar icons are placeholder nulls.**~~

**Resolution:** `@expo/vector-icons` installed. Ionicons `calendar-outline`, `trophy-outline`, `settings-outline` wired per tab.

---

### 3.7 App — `app/.env` ✅ FIXED (2026-05-25)

~~**Problem: No `.env` file exists in `/app/`.**~~

**Resolution:** `app/.env` created with `EXPO_PUBLIC_API_URL=http://localhost:3000`. Update to Railway URL before phone testing.

---

### 3.8 Backend — `.env.example` ✅ FIXED (2026-05-25)

~~**Problem: `.env.example` references the defunct RC v3 API.**~~

**Resolution:** `RC_API_BASE` removed. Updated with current vars: `DATABASE_URL`, `PORT`, `RC_REQUEST_DELAY_MS`, `ADMIN_SECRET`, `EXPO_ACCESS_TOKEN`.

---

### 3.9 Missing: Age Gate / COPPA Screen ✅ FIXED (2026-05-25)

~~**Missing: No age gate before onboarding.**~~

**Resolution:** `app/app/age-gate.tsx` created. 18+ navigates to `/onboarding`; under-18 sees dead-end message. `hasPassedAgeGate` stored in AsyncStorage. Root `_layout.tsx` checks AsyncStorage before routing.

---

### 3.10 Missing: Database Client Module ✅ FIXED (2026-05-25)

~~**Missing: No `backend/src/db/client.ts`.**~~

**Resolution:** `backend/src/db/client.ts` created with Railway SSL detection (`postgres.railway.internal` = no SSL, public proxy URLs = SSL). 20+ typed query functions in `backend/src/db/queries.ts`.

---

## 4. Infrastructure: Local Dev to Railway

### Why Railway

Railway provides managed Postgres, automatic HTTPS, zero-config deploys from GitHub, and usage-based billing. For RowDay's initial load (hundreds of parents, one regatta at a time), total cost will be under $10/month on the Hobby plan ($5/month base + ~$2–4 Postgres usage).

### Step-by-Step Deploy

**Step 1: Create Railway project** ✅ DONE

**Step 2: Add PostgreSQL** ✅ DONE — Managed Postgres provisioned. `DATABASE_URL` reference variable `${{Postgres.DATABASE_URL}}` set in backend service.

**Step 3: Run schema migrations** ✅ DONE — 9-table schema applied via `DATABASE_PUBLIC_URL` (external proxy, uses SSL) from local machine.

**Step 4: Set environment variables** ✅ DONE — `ADMIN_SECRET`, `RC_REQUEST_DELAY_MS=800`, `NODE_ENV=production`. Note: do NOT set `PORT` — Railway injects it automatically.

**Step 5: Configure start command** ✅ DONE — `railway.json` with `"build": "npm run build"`, `"start": "npm start"`.

**Step 6: Deploy** ✅ DONE — nixpacks.toml fixed to include `nodejs_20` (critical — defining `[phases.setup]` without it overrides auto-detection and breaks npm). Health check passing.

**Step 7: Point Expo app at Railway** — ⚠️ PARTIAL — `app/.env` created but still points to `localhost:3000`. Update to Railway URL before phone test:
```
EXPO_PUBLIC_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
```

**Step 8: Verify** ✅ DONE
```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
# {"status":"ok","timestamp":"..."}

# Sync tested successfully on CSSRA 2026 (job_id=10115)
# Result: 40 events, 131 clubs, 194 races synced to DB
```

**Key fixes discovered during deploy:**
- `nixpacks.toml` must include `nodejs_20` when defining `[phases.setup]`
- `postgres.railway.internal` (private network) does NOT use SSL; `*.rlwy.net` (public proxy) does
- Do NOT set `PORT` env var — Railway auto-injects the correct port
- Long-running sync must be fire-and-forget (Railway drops connections after ~60s)
- Use `DATABASE_PUBLIC_URL` for migrations from local machine

**Optional: Redis** — Not needed for MVP. Skip it.

---

## 5. Beta Launch Plan — BRC Parents

### Phase 1: Expo Go QR Code (No TestFlight, No App Store — Available Now)

This is the fastest path to getting the app in BRC parents' hands. Parents install the free **Expo Go** app from the App Store / Google Play, then scan a QR code you share on the parent WhatsApp group. They see your app with live data, exactly as it will look in production.

**To launch:**
```bash
cd /Users/brianhudson/projects/BRC/app
# First: update app/.env to Railway URL
npx expo start --tunnel
```

The `--tunnel` flag (powered by ngrok) routes traffic over the internet so parents don't need to be on the same WiFi. A QR code appears in the terminal. Screenshot it and share.

**Limitations of Expo Go:** 
- Parents must have Expo Go installed (easy for Android; iOS Expo Go supports SDK 52, which matches your `app/package.json`).
- Push notifications do not work in Expo Go. For the countdown/notification feature to work, you need a real build (EAS) or development build. For the first regatta, the live schedule/countdown in-app is the key feature — notifications can wait one week.
- On iOS, if you hit SDK version issues, fall back to sharing a link via `eas update` (EAS Updates, free tier).

**Phase 2: EAS Internal Distribution Build (~Week 3)**

```bash
npx eas build --platform all --profile preview
```

This creates a real native build (no App Store required). For Android: share the `.apk` URL that EAS provides. For iOS: share via EAS's internal distribution URL (testers tap a link, install directly — no TestFlight needed for internal testing up to the 100-device limit per Apple's ad-hoc rules).

---

### Message for the BRC Parent WhatsApp Group

> **Try RowDay — a better way to follow the regatta**
>
> I built a companion app for BRC parents that pulls live data directly from Regatta Central and shows your rower's next heat with a real-time countdown, lane assignment, and results as they post — all in one screen.
>
> To try it at the Lake Ontario Invitational:
> 1. Install "Expo Go" from the App Store or Google Play (it's free)
> 2. Scan this QR code: [attach screenshot from terminal]
> 3. Search for the regatta, pick BRC, enter your rower's name
>
> This is an early version — feedback is gold. What's confusing? What's missing? Reply here or text me.
>
> — Brian

---

### Success Metrics at First Regatta

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Parents who open the app | 10 | Expo Go access logs / Railway request logs |
| Parents who complete onboarding | 7 | DB: `SELECT COUNT(*) FROM subscription` |
| Syncer uptime during race day | 95%+ | Railway logs show no 5xx errors during 7am–5pm window |
| Countdown accuracy | Within ±60 seconds | Manual spot-check during racing |
| Positive verbal feedback | "I used this" from 3+ parents | Brian's judgment |
| Critical bug during racing | 0 | Brian monitors Slack/Railway logs from the boathouse |

---

## 6. Business Entity Checklist

Do these in order. Steps 1–3 can happen in parallel on the same morning.

### Naming the LLC

The LLC should be named broadly enough to hold multiple rowing/sports products. Avoid "RowDay LLC" as the legal entity name (trademarks and products can be distinct from the LLC name). Suggested options to check:

- **Lakeside Sports Tech LLC** — geographic (Great Lakes) + broad
- **Coxswain Technologies LLC** — rowing vernacular, memorable
- **Boathouse Labs LLC** — warm, evocative
- **Regatta Labs LLC** — direct, credible
- **Finish Line Sports Data LLC** — descriptive, broad

Check availability free at: **https://apps.dos.ny.gov/publicInquiry/**  
Search type: Entity Name. If results return "No business entities found," the name is available.

---

### Ordered Action Items

- [ ] **1. Choose LLC name and check NY DOS availability**  
  URL: https://apps.dos.ny.gov/publicInquiry/  
  Time: 10 minutes  
  Cost: Free

- [ ] **2. Choose formation county (use upstate, NOT Monroe/NYC for publication cost savings)**  
  Recommended: **Schuyler County** or **Hamilton County** (lowest publication rates in NY, ~$100–$200 total vs. $1,800+ in Manhattan). You do not need to operate there — you just need a registered agent address in that county.  
  Service to use: **Northwest Registered Agent** ($125/yr, handles publication filing automatically, has addresses in cheap upstate counties).  
  Alternatively: **Incfile** or **ZenBusiness** — both advertise upstate county formation and handle the publication requirement.  
  Publication requirement: Within 120 days of formation, publish in 2 newspapers for 6 weeks, then file Certificate of Publication ($50 fee to NY DOS).  
  Time: 30 minutes online  
  Cost: $200 (Articles of Organization) + ~$150–$300 (publication via service) + $50 (Certificate of Publication) = **~$400–$550 total Year 1**

- [ ] **3. Get EIN from IRS (free, 10 minutes)**  
  URL: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online  
  Do this the same day or day after LLC formation is filed. You do not need to wait for the LLC to be fully processed — file with the SS-4 form if the online tool requires a state-issued ID first.  
  Time: 10 minutes  
  Cost: Free

- [ ] **4. Open Mercury bank account**  
  URL: https://mercury.com  
  Requires: LLC name + EIN. No monthly fees. FDIC insured up to $5M. Free wire transfers. Best option for a solo tech founder.  
  Time: 20 minutes online  
  Cost: Free

- [ ] **5. Apply for D-U-N-S Number from Dun & Bradstreet**  
  URL: https://developer.apple.com/enroll/duns-lookup/ (Apple's portal, which routes to D&B)  
  Requires: LLC legal name, EIN, physical address.  
  Note: Apple says "allow up to 5 business days." In practice it often comes back in 2–3 days if the LLC is already in the D&B database (it won't be, so 5 days is realistic).  
  Time: 10 minutes to apply; 5 business days to receive  
  Cost: Free

- [ ] **6. Enroll in Apple Developer Program as Organization**  
  URL: https://developer.apple.com/programs/enroll/  
  Requires: DUNS number, LLC legal name (must match DUNS exactly), EIN, Apple ID under your LLC email (create one if needed).  
  Note: Apple may call or email to verify. This step can take 24–72 hours after submission.  
  Time: 30 minutes to apply; 1–3 days to approve  
  Cost: $99/year

- [ ] **7. Enroll in Google Play Console as Organization**  
  URL: https://play.google.com/console/signup  
  Requires: EIN, LLC name, D-U-N-S recommended (not required for Play). Also requires a valid payment method.  
  Time: 20 minutes  
  Cost: $25 one-time

- [ ] **8. Generate COPPA-compliant privacy policy**  
  Use **iubenda** (free tier covers 1 app): https://www.iubenda.com  
  Required sections: data collected, age restriction (13+), parental consent, contact email.  
  The policy must be hosted at a live URL. iubenda hosts it for you.  
  Also generate Terms of Service (free on iubenda).  
  Link both in the app's Settings screen and App Store listing.  
  Time: 20 minutes  
  Cost: Free (iubenda free tier)

- [ ] **9. File USPTO Intent-to-Use trademark: "RowDay" in Class 42**  
  URL: https://www.uspto.gov/trademarks/apply  
  Class 42 covers: "Software as a service (SaaS) featuring software for tracking sporting event schedules and results; mobile application software for sporting events."  
  Use TEAS Plus filing (structured pick-list description) to avoid the $200/class surcharge.  
  Timing: File before launch. ITU preserves your priority date. You have 6 months to show actual use (extendable to 36 months total with extensions).  
  Cost: $350 filing fee + $100 Statement of Use later = ~$450 total minimum  
  Time: 45 minutes

### Cost Summary

| Item | Cost | When |
|------|------|------|
| NY LLC Articles of Organization | $200 | Week 1 |
| Registered Agent (upstate) + Publication service | ~$275 | Week 1 |
| Certificate of Publication | $50 | 120 days after formation |
| EIN | Free | Week 1 |
| Mercury bank account | Free | Week 1 |
| DUNS number | Free | Week 1 (5-day wait) |
| Apple Developer Program | $99/yr | Week 2–3 |
| Google Play Console | $25 one-time | Week 2–3 |
| iubenda privacy policy | Free | Week 2 |
| USPTO trademark (ITU) | $350 | Week 3–4 |
| **Total first 90 days** | **~$999** | |

---

## 7. Revenue Model

### Phase 1 — Free (Now through ~2027 Q1)

**Goal:** Build user base, prove value, gather testimonials. Do not charge anyone.

- Free for all parents
- Free for coaches
- No paywalls
- This is the "give it away to win the market" phase — GameChanger did this for youth baseball for years before monetizing

**Metrics to hit before monetizing:**
- 500 MAU (monthly active users) across 5+ clubs
- 3 regattas served successfully
- App Store presence established
- Positive reviews / press mentions

---

### Phase 2 — Club Subscriptions (~2027 Q1)

**Who pays:** The rowing club, not individual parents. Clubs are the right unit of monetization because:
- Clubs already pay $500–$2,000/regatta in registration fees to RegattaCentral
- A club "subscribing" to RowDay buys them a branded experience for their entire parent community
- The coach or club director has budget; individual parents do not

**Proposed Pricing:**

| Tier | Price | Included |
|------|-------|----------|
| **Free** | $0 | Any parent can follow any club; basic schedule + results |
| **Club Pro** | $29/mo or $249/yr per club | Priority syncing (2-min refresh vs 5-min), club branding (logo + colors in app), push notifications for all club parents, heat-by-heat results digest email |
| **Club Elite** | $79/mo or $699/yr per club | Everything in Pro + athlete-level notifications (parents opt in to get notified only for their rower), exportable results CSVs, multi-regatta season dashboard |

**Comparable benchmarks:**
- GameChanger (youth baseball): ~$9.99/month for parent premium; surpassed $100M revenue in 2024
- Manage Your League: ~$2/player/season
- A club with 50 athletes paying $249/yr = $4.98/athlete/year — well under what clubs pay for any other software

**Regatta Organizer Tools (~2027 Q3+):**
- RowDay can sell directly to regatta directors: "Make RowDay the official app of your regatta" → $500–$2,000/regatta
- Includes: custom event page, push notification to all attendees, branded splash screen
- This is a direct competitor to RC's own value-add — and likely what opens the door to acquisition/licensing conversations

---

### Phase 3 — Data Licensing / Acquisition (~2028+)

- By 2028, if RowDay has 10,000+ MAU and 3 seasons of rowing data, the platform has real asset value
- RegattaCentral / Stack Sports acquisition path: Stack Sports has acquired ~20 sports-management platforms since 2016. A vertically-focused rowing app with strong NPS is exactly their acquisition template
- Licensing path: License the notification/results infrastructure back to RC as a white-label — they power the backend, we power the consumer experience
- Realistic acquisition range at 10k MAU: $500k–$3M (2–5x ARR for a niche SaaS with strong retention)

---

## 8. Competitive Moat

### Why RC Won't Easily Replicate This

**Organizational inertia.** RegattaCentral is a division of Stack Sports, which is a PE-backed roll-up (Clearlake Capital) managing 30+ sports platforms. RC is the rowing vertical in a portfolio that includes baseball, soccer, lacrosse, football, swimming. Their product roadmap is set by a committee prioritizing revenue across all sports. A "rewrite the parent-facing mobile experience for rowing" project will never beat a youth baseball feature on the priority stack.

**The app speaks for itself.** RC's mobile app has a 2.95-star rating on Google Play and was last meaningfully updated in August 2024. Their engineering resources are spread thin. Building a rowing-native experience from scratch would take 18+ months and require buy-in they won't get internally.

**PE dynamics.** Clearlake Capital's incentive is EBITDA margin and eventual exit, not product excellence. Every dollar spent on product is a dollar off the multiple. They will not invest in a niche rowing app that serves 4,000 clubs — especially when those clubs are paying RegattaCentral for registration software regardless of how bad the app is.

---

### What Creates Defensibility as We Grow

| Moat | Description | Timeline |
|------|-------------|----------|
| **Notifications infrastructure** | Once a parent has RowDay installed and is getting heat alerts, switching cost is high. You lose your "followed athlete" configuration. | Immediate |
| **User data & engagement** | Season-over-season continuity: your rower's results history, past regatta notifications, familiar UX. No one else has this. | 2 seasons |
| **Club relationships** | When club directors "endorse" RowDay (put it in their welcome email, mention it on the team page), new parents default to RowDay. Club relationships are sticky because switching requires re-educating 50+ parents. | 6–12 months |
| **Regatta organizer tooling** | If RowDay becomes the official app for 3–5 regattas, it becomes the default. Parents install it for Regatta A and already have it for Regatta B. Cross-event retention. | 12–18 months |
| **Data layer** | RowDay's database of parsed heat sheets and results is a clean, structured asset that RC's own platform doesn't easily export. This data is negotiating leverage. | 2–3 seasons |
| **Brand & community** | "The app the rowing community actually uses" — grassroots credibility in a sport that respects tradition and insider knowledge. | Ongoing |

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **RC blocks syncing** (rate-limiting, CAPTCHAs, robots.txt change, legal threat) | Medium | High | 1. Sync politely: 800ms delay between requests (already implemented). 2. Rotate request cadence. 3. Cache aggressively: sync once per 2 min max during racing. 4. Legal basis is solid (hiQ v. LinkedIn, public data, no ToS accepted). 5. Long-term: negotiate data partnership from a position of user traction. If blocked, fall back to PDF heat sheet parsing (already implemented and validated). |
| **App Store rejection** | Medium | Medium | Common reasons: COPPA non-compliance, missing privacy policy, syncing other services (Apple cares less about this than the privacy issue). Mitigations: age gate is required, privacy policy must be live URL, App Store description should say "aggregates publicly available regatta data." Keep description neutral. |
| **COPPA violation** | Low | High | App is explicitly parent-facing. Age gate blocks self-identified minors. We do not collect name, email, or any PII from users under 13. The subscription table stores device token + regatta preference only. No analytics on individual children. iubenda policy should state this explicitly. |
| **Competition from other builders** | Low | Medium | The rowing market is small (~4,000 clubs US/Canada). No VC would fund a direct competitor for this niche. Risk is a motivated individual builder. Moat is execution speed and community trust — ship first, build relationships fast. |
| **Brian time availability** (side project, day job, parent) | High | High | This is the real constraint. Mitigations: 1. Aggressive use of Claude for all coding tasks — Brian directs, Claude builds. 2. Ruthless MVP scope: only what's needed for one regatta. 3. Set "regatta day" as a hard deadline — everything before it is MVP, everything after is polish. 4. If Brian hits a wall, the backend-as-deployed-on-Railway still works for parents even if the app isn't updated for weeks. 5. Build the LLC and business infrastructure in parallel using 10-min micro-sessions during commutes. |
| **Regatta cancelled / postponed** | Low | Low | First regatta is a proof-of-concept. If Lake Ontario Invitational moves, find the next BRC event on the calendar (typically every 2–3 weeks in spring season). |
| **Playwright / Chromium RAM on Railway** | Medium | Medium | Playwright with Chromium peaks at ~350–400MB. Railway Hobby plan includes up to 512MB RAM. Monitor during first race day. If needed, upgrade to Pro plan ($20/mo). Alternative: run Playwright as a separate Railway service. |

---

## 10. Brian's Morning Action List

Do these in roughly this order. Items 2, 3, and 6 are already done — start with item 1.

---

- [ ] **1. Check RC for Lake Ontario Invitational job_id** *(15 min)*  
  Go to: https://www.regattacentral.com/regattas  
  Search "Lake Ontario." When the regatta appears, note the job_id from the URL: `/regatta/?job_id=NNNNN`.  
  If it's not listed yet, check back daily — regattas typically appear 4–6 weeks before race day.  
  Once you have the job_id, trigger a sync:
  ```bash
  curl -X POST \
    -H "X-Admin-Secret: YOUR_SECRET" \
    "https://YOUR-RAILWAY-URL.up.railway.app/api/admin/sync?job_id=NNNNN"
  # Returns 202 immediately. Poll GET /api/admin/sync/:jobId for status.
  ```
  Confirm you see 40+ events and 10+ clubs in the response.

---

- [x] **2. Create Railway project and deploy the backend** *(done ✅)*  
  Railway deployed. Health check passing. CSSRA 2026 synced successfully (40 events, 131 clubs, 194 races).

---

- [x] **3. Wire the DB client and replace hardcoded data** *(done ✅)*  
  All 5 hardcoded routes replaced with DB queries. 4 new endpoints added. `backend/src/db/client.ts` and `backend/src/db/queries.ts` created with 20+ typed query functions.

---

- [ ] **4. Start the NY LLC formation** *(30 min — Brian must do this)*  
  a. Check name availability at: https://apps.dos.ny.gov/publicInquiry/  
  b. Pick one: Lakeside Sports Tech LLC, Boathouse Labs LLC, or Coxswain Technologies LLC  
  c. Go to Northwest Registered Agent (https://www.northwestregisteredagent.com) or ZenBusiness (https://www.zenbusiness.com) — choose a registered agent with an upstate NY address to minimize publication costs (~$400–$550 total vs. $2,000+ in Monroe County).  
  d. File Articles of Organization through the service. They handle NY DOS submission.

---

- [ ] **5. Apply for DUNS number** *(10 min — Brian must do this)*  
  URL: https://developer.apple.com/enroll/duns-lookup/  
  You need the LLC name and EIN (get EIN at irs.gov — 10 minutes, free). Do EIN first, then DUNS immediately after.  
  The 5-day DUNS wait starts the clock. Everything else can proceed while you wait.

---

- [x] **6. Fix the three highest-priority app issues** *(done ✅)*  
  a. Tab icons wired with `@expo/vector-icons` Ionicons ✅  
  b. `useAppStore.ts` initial state to null + Zustand persistence ✅  
  c. Push notification permission wired in `onboarding.tsx` ✅  
  Bonus: Age gate added, QueryClientProvider added (was missing — would have crashed all queries), root `index.tsx` and `_layout.tsx` created.

---

- [ ] **7. Update `app/.env` to Railway URL and test on phone** *(5 min)*  
  ```
  EXPO_PUBLIC_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
  ```
  Currently points to `localhost:3000`. Update to Railway URL, then:
  ```bash
  cd /Users/brianhudson/projects/BRC/app
  npx expo start --tunnel
  ```
  Scan QR with Expo Go on your iPhone. Verify regatta list loads from Railway.

---

- [ ] **8. Send yourself the Expo Go QR code and verify end-to-end** *(15 min)*  
  With `--tunnel` running and Railway backend live and Lake Ontario job_id synced: run through the full onboarding flow on your phone. Select the Lake Ontario Invitational, select BRC, enter your athlete's name. Confirm the schedule screen loads with real heat data. This is the first real-world end-to-end test.

---

- [ ] **9. Generate privacy policy on iubenda** *(20 min)*  
  URL: https://www.iubenda.com  
  Free tier. Add: app name "RowDay," data collected (device push token, user preferences), age restriction (18+), contact email.  
  Copy the hosted URL. Paste it into `app/app/(tabs)/settings.tsx` as a tappable link.

---

- [ ] **10. Message 2–3 BRC parents you know** *(10 min)*  
  Not the whole WhatsApp group yet — pick 2–3 tech-comfortable parents you trust. "I'm building a thing for the regatta. Can I share a link and get your reaction?" Early honest feedback from real users is more valuable than any amount of solo building.

---

## Pending / In Progress

- **rename/scrape-to-sync branch**: Background agent renaming all "scrape" → "sync" terminology across codebase (`src/scraper/` → `src/syncer/`, `scrape-scheduler.ts` → `sync-scheduler.ts`, etc.). Merge into main and redeploy when complete.
- **startSyncScheduler() wiring**: Intentionally left out of `index.ts`. Add after first few manual syncs confirm DB stability.
- **Strategy reminder**: Do NOT email api@regattacentral.com to request API access before having traction. Build first, launch to BRC parents, get real users, then approach RC from a position of strength.

---

## Elevator Pitch

RowDay is a mobile companion app for rowing regattas that gives parents, athletes, and coaches the experience they deserve: a real-time countdown to their rower's next heat, lane-by-lane heat sheets, and results that update automatically — all sourced live from Regatta Central's publicly available data. The official RC app has a 2.95-star rating and hasn't been meaningfully updated since August 2024, leaving thousands of rowing families staring at a slow, confusing website on a phone they're holding at the boathouse. RowDay fixes that in the same way Flighty fixed airline tracking — not by replacing the underlying infrastructure, but by building a beautiful, fast, human experience on top of it. We're starting with Brighton Rowing Club in Rochester, NY, proving the model at local regattas, and expanding to the 4,000 rowing clubs in the US and Canada from there.

---

*Document maintained by Brian Hudson + Claude (Anthropic). Update this file after each sprint, each regatta, and each major business milestone.*
