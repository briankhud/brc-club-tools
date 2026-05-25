# RowDay App — MVP Build Complete

**Date:** 2026-05-25  
**Engineer:** RowDay iOS/React Native Agent

---

## What was built

### Task 1 — Zustand store (`store/useAppStore.ts`)
- Replaced hardcoded Brighton Burn / Nora Ashworth defaults with `null` for all three fields (`activeRegatta`, `followedClub`, `followedAthlete`).
- Added Zustand `persist` middleware backed by `@react-native-async-storage/async-storage` (key: `rowday-store`).
- State now survives app restarts. A user who completes onboarding will land on the Schedule tab with their selections intact on next launch.

### Task 2 — Push notifications in onboarding (`app/onboarding.tsx`)
- Imported `expo-notifications` and set `Notifications.setNotificationHandler` at module scope (ensures foreground notifications show while the app is open).
- `NotificationsStep` now calls `requestPermissionsAsync()`, then `getExpoPushTokenAsync()`, then POSTs to `/api/subscriptions` with `device_token`, `platform`, `regatta_id`, and optional `athlete_name`.
- Registration failure is non-fatal — a `console.warn` is emitted and `onFinish()` still runs so onboarding completes regardless.
- Fixed the local `Regatta` interface in `onboarding.tsx` to include `end_date` (was missing, caused a TS error against the store's stricter type).

### Task 3 — Tab bar icons (`app/(tabs)/_layout.tsx`)
- Replaced the `TabBarIcon` stub (which returned `null`) with real `Ionicons` components from `@expo/vector-icons`.
- Icon mapping:
  - **Schedule** → `stopwatch` / `stopwatch-outline`
  - **Results** → `trophy` / `trophy-outline`
  - **Settings** → `settings` / `settings-outline`
- Uses filled variant when focused, outline when inactive, consistent with iOS tab bar convention.

### Task 4 — Settings screen navigation (`app/(tabs)/settings.tsx`)
- Added `useRouter` from `expo-router`.
- All three settings rows (Active Regatta, Club, Athlete) now call `router.push('/onboarding')` on press, re-running the full 4-step onboarding flow.
- MVP approach: not ideal UX long-term (re-runs all steps instead of jumping to the relevant step), but correct for launch.

### Task 5 — COPPA age gate (`app/age-gate.tsx` + `app/index.tsx` + `app/_layout.tsx`)
- Created `app/age-gate.tsx`: full-screen gate with two buttons.
  - "I'm 18 or older — Continue" → sets `hasPassedAgeGate` in AsyncStorage and navigates to `/onboarding`.
  - "I'm under 18" → replaces the screen content with a message ("RowDay is for parents and guardians. Ask your parent to set up the app.") — no navigation, no way to proceed.
- Created `app/index.tsx` as the root entry point: reads `hasPassedAgeGate` from AsyncStorage and redirects to `/age-gate` (first launch) or `/(tabs)` (returning user). Shows a spinner while checking.
- Created `app/_layout.tsx` (was missing): declares all four top-level Stack screens (`index`, `age-gate`, `onboarding`, `(tabs)`).

### Task 6 — `.env` (`app/.env`)
- Created with `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- Points at localhost for local dev. Update to the Railway URL for staging/prod.

### Task 7 — Empty state in Schedule tab (`app/(tabs)/index.tsx`)
- Replaced the bare "No heats found for {club}." text with a styled empty state:
  - ⏱ "Heat assignments not yet posted"
  - Explanatory copy: heat sheets typically released 24–48 hours before racing
  - "Pull to refresh" hint
- Added `RefreshControl` to the `FlatList` so pull-to-refresh actually triggers a TanStack Query `refetch()`.

---

## Packages installed

| Package | Version (SDK 52 pin) |
|---------|---------------------|
| `@react-native-async-storage/async-storage` | 1.23.1 |
| `@expo/vector-icons` | ~14.0.4 |

Both installed via `npx expo install` so Expo resolved SDK 52-compatible versions.

---

## Assumptions and design choices

1. **Age gate navigation:** On passing the gate the user is sent to `/onboarding`, not `/(tabs)`. This is correct — a user who has passed the age gate still needs to complete onboarding before seeing the schedule. On subsequent launches `index.tsx` sends them straight to `/(tabs)`.

2. **Settings → onboarding:** All three settings rows trigger the full 4-step onboarding flow. This is the simplest correct behavior for MVP. For v2, consider deep-linking to a specific step (e.g. `/onboarding?step=club`).

3. **Push token registration:** `getExpoPushTokenAsync()` requires a project ID in EAS builds. In Expo Go it works without one. If you see an error about `projectId` when building for production, pass `{ projectId: Constants.expoConfig?.extra?.eas?.projectId }` as an argument. The current code will work in Expo Go for beta testing.

4. **`Notifications.setNotificationHandler` placement:** Called at module level in `onboarding.tsx`. This is fine for now but should ideally be moved to `_layout.tsx` once the app grows, so it's active even when the user doesn't visit the onboarding screen in a session.

5. **TypeScript strict mode:** All files pass `tsc --noEmit` with zero errors.

---

## Open questions / warnings for the human

- **`POST /api/subscriptions` endpoint does not exist yet** (it's in the "not yet built" list in ARCHITECTURE.md). The push registration code in onboarding will silently fail (non-fatal) until the backend endpoint is built. This is intentional — onboarding completes either way.

- **`/(tabs)/results.tsx` is not wired** — it exists as a file but was not part of this task. The Results tab will render whatever is in that file currently.

- **Expo Go vs production build:** `getExpoPushTokenAsync()` behaves differently in Expo Go vs a standalone build. In Expo Go, tokens are sandboxed and only work with Expo's own push infrastructure. Real APNs/FCM delivery requires an EAS build with the push entitlement.

- **`app.json` references `./assets/` files** that may not exist in the repo yet (icon.png, splash.png, notification-icon.png). The app will warn or error on build if these are missing.

- ~~**TanStack Query provider:**~~ Fixed — `QueryClientProvider` was missing from all layout files. Added to `app/_layout.tsx` with a shared `QueryClient` instance (retry: 1, staleTime: 30s). Without this, every `useQuery` call would have thrown "No QueryClient set" at runtime.
