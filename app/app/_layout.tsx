import React from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry once on failure; avoids aggressive retries when the backend is
      // unreachable at a regatta with spotty connectivity.
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/**
 * Root layout — declares all first-level routes and provides global context.
 *
 * First-launch routing is handled by app/index.tsx, which reads AsyncStorage
 * and redirects to /age-gate or /(tabs) as appropriate.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="age-gate" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}
