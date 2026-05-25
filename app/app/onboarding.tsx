import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useAppStore } from "../store/useAppStore";
import { getRegattas, getRegattaClubs } from "../services/api";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type OnboardingStep = "regatta" | "club" | "athlete" | "notifications";

interface Regatta {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  city: string;
  state: string;
  venue?: string;
  status?: string;
}

interface Club {
  id: string;
  name: string;
  short_name: string;
  city: string;
  state: string;
}

// ---------------------------------------------------------------------------
// Step 1: Search + select regatta
// ---------------------------------------------------------------------------
function RegattaStep({
  onSelect,
}: {
  onSelect: (regatta: Regatta) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["regattas"],
    queryFn: getRegattas,
  });

  const regattas: Regatta[] = data?.regattas ?? [];
  const filtered = regattas.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Find your regatta</Text>
      <Text style={styles.stepSubtitle}>
        Search for the event you're attending.
      </Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search regattas…"
        placeholderTextColor="#aaa"
        value={search}
        onChangeText={setSearch}
        autoFocus
      />
      {isLoading ? (
        <ActivityIndicator color="#1a3a5c" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.listItem}
              onPress={() => onSelect(item)}
            >
              <Text style={styles.listItemTitle}>{item.name}</Text>
              <Text style={styles.listItemSub}>
                {new Date(item.start_date).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · {item.city}, {item.state}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No regattas found.</Text>
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Pick your club
// ---------------------------------------------------------------------------
function ClubStep({
  regattaId,
  onSelect,
}: {
  regattaId: string;
  onSelect: (club: Club) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["clubs", regattaId],
    queryFn: () => getRegattaClubs(regattaId),
  });

  const clubs: Club[] = data?.clubs ?? [];
  const filtered = clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Find your club</Text>
      <Text style={styles.stepSubtitle}>
        Which club are you following?
      </Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search clubs…"
        placeholderTextColor="#aaa"
        value={search}
        onChangeText={setSearch}
        autoFocus
      />
      {isLoading ? (
        <ActivityIndicator color="#1a3a5c" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable style={styles.listItem} onPress={() => onSelect(item)}>
              <Text style={styles.listItemTitle}>{item.name}</Text>
              <Text style={styles.listItemSub}>
                {item.city}, {item.state} · {item.short_name}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No clubs found.</Text>
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Find athlete (simplified — text entry for MVP)
// ---------------------------------------------------------------------------
function AthleteStep({
  onSelect,
  onSkip,
}: {
  onSelect: (athlete: { first_name: string; last_name: string }) => void;
  onSkip: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Find your athlete</Text>
      <Text style={styles.stepSubtitle}>
        Enter the rower's name to get personalized countdown alerts.
      </Text>
      <TextInput
        style={styles.searchInput}
        placeholder="First name"
        placeholderTextColor="#aaa"
        value={firstName}
        onChangeText={setFirstName}
        autoFocus
      />
      <TextInput
        style={[styles.searchInput, { marginTop: 8 }]}
        placeholder="Last name"
        placeholderTextColor="#aaa"
        value={lastName}
        onChangeText={setLastName}
      />
      <Pressable
        style={[styles.primaryButton, { marginTop: 16 }]}
        onPress={() => {
          if (firstName.trim() && lastName.trim()) {
            onSelect({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            });
          }
        }}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip — I'll follow the whole club</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Notifications opt-in
// ---------------------------------------------------------------------------
function NotificationsStep({ onFinish }: { onFinish: () => void }) {
  const { activeRegatta, followedAthlete } = useAppStore();

  async function handleEnableNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        await fetch(`${API_BASE}/api/subscriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_token: tokenData.data,
            platform: Platform.OS,
            regatta_id: activeRegatta?.id ?? null,
            athlete_name: followedAthlete
              ? `${followedAthlete.first_name} ${followedAthlete.last_name}`
              : null,
          }),
        });
      } catch (e) {
        // Non-fatal — notifications just won't work but onboarding should complete
        console.warn("Failed to register push token:", e);
      }
    }
    onFinish();
  }

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Stay in the loop</Text>
      <Text style={styles.stepSubtitle}>
        Get a push notification 5 minutes before each heat and again when
        results are posted.
      </Text>
      <Pressable
        style={[styles.primaryButton, { marginTop: 24 }]}
        onPress={handleEnableNotifications}
      >
        <Text style={styles.primaryButtonText}>Enable notifications</Text>
      </Pressable>
      <Pressable onPress={onFinish} style={styles.skipButton}>
        <Text style={styles.skipText}>Not now</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Onboarding shell
// ---------------------------------------------------------------------------
export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardingStep>("regatta");
  const [selectedRegatta, setSelectedRegatta] = useState<Regatta | null>(null);

  const { setActiveRegatta, setFollowedClub, setFollowedAthlete } = useAppStore();

  function handleRegattaSelect(regatta: Regatta) {
    setSelectedRegatta(regatta);
    setActiveRegatta(regatta);
    setStep("club");
  }

  function handleClubSelect(club: Club) {
    setFollowedClub(club);
    setStep("athlete");
  }

  function handleAthleteSelect(athlete: { first_name: string; last_name: string }) {
    setFollowedAthlete(athlete);
    setStep("notifications");
  }

  function handleFinish() {
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Progress dots */}
      <View style={styles.progressRow}>
        {(["regatta", "club", "athlete", "notifications"] as OnboardingStep[]).map(
          (s) => (
            <View
              key={s}
              style={[styles.dot, step === s && styles.dotActive]}
            />
          )
        )}
      </View>

      {step === "regatta" && (
        <RegattaStep onSelect={handleRegattaSelect} />
      )}
      {step === "club" && selectedRegatta && (
        <ClubStep
          regattaId={selectedRegatta.id}
          onSelect={handleClubSelect}
        />
      )}
      {step === "athlete" && (
        <AthleteStep
          onSelect={handleAthleteSelect}
          onSkip={() => setStep("notifications")}
        />
      )}
      {step === "notifications" && (
        <NotificationsStep onFinish={handleFinish} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 60,
    paddingBottom: 8,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
  },
  dotActive: {
    backgroundColor: "#1a3a5c",
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a3a5c",
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
    lineHeight: 21,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#1a1a1a",
  },
  listItem: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  listItemSub: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    color: "#aaa",
    marginTop: 32,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#1a3a5c",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  skipButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    color: "#888",
    fontSize: 15,
  },
});
