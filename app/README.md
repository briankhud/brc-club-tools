# RowDay App

React Native + Expo app for the RowDay rowing companion.

## Setup

### 1. Install Expo Go on your phone

- iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

### 2. Install dependencies

```bash
cd app
npm install
```

### 3. Configure the API URL

The app defaults to `http://localhost:3000`. When testing on a physical device,
you need your Mac's local IP instead:

```bash
# Find your IP
ipconfig getifaddr en0

# Set it in a .env.local file
echo "EXPO_PUBLIC_API_URL=http://192.168.1.xx:3000" > .env.local
```

### 4. Start the app

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Structure

```
app/
  app/
    (tabs)/
      _layout.tsx     — Tab bar configuration (Schedule, Results, Settings)
      index.tsx       — Schedule screen with countdown card
      results.tsx     — Results screen
      settings.tsx    — Settings / preferences
    onboarding.tsx    — First-run flow: pick regatta → club → athlete → notifications
  components/
    CountdownCard.tsx — Hero countdown component (live-ticking)
    HeatSheet.tsx     — Lane-by-lane heat sheet table
  store/
    useAppStore.ts    — Zustand global state
  services/
    api.ts            — Typed API client for the backend
```

## Development defaults

The store is seeded with Brighton Burn 2026 / Brighton Rowing Club / Nora Ashworth
so you get a useful starting state without running onboarding. Clear defaults by
calling `useAppStore.getState().clearAll()` in a component or the Expo dev menu.
