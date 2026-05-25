import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../../store/useAppStore";
import { getClubSchedule } from "../../services/api";

interface ResultItem {
  event: { id: string; name: string };
  heat: {
    id: string;
    display_number: string;
    stage_name: string;
    scheduled_start: string;
    status: string;
  };
  club_lanes: Array<{
    lane_number: number;
    entry_name: string;
    place: number | null;
    time_ms: number | null;
    dnf: boolean;
    dns: boolean;
    dq: boolean;
  }>;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function placeLabel(place: number | null): string {
  if (place === null) return "—";
  const suffixes = ["th", "st", "nd", "rd"];
  const suffix = place <= 3 ? suffixes[place] : suffixes[0];
  return `${place}${suffix}`;
}

function ResultRow({ item }: { item: ResultItem }) {
  const startTime = new Date(item.heat.scheduled_start);
  const timeStr = startTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={styles.resultCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEventName}>{item.event.name}</Text>
        <Text style={styles.cardMeta}>
          Heat {item.heat.display_number} · {timeStr}
        </Text>
      </View>

      {item.club_lanes.map((lane) => (
        <View key={lane.lane_number} style={styles.laneRow}>
          <Text style={styles.lanePlace}>{placeLabel(lane.place)}</Text>
          <View style={styles.laneInfo}>
            <Text style={styles.laneName}>{lane.entry_name}</Text>
            <Text style={styles.laneNumber}>Lane {lane.lane_number}</Text>
          </View>
          <Text style={styles.laneTime}>
            {lane.dnf
              ? "DNF"
              : lane.dns
              ? "DNS"
              : lane.dq
              ? "DQ"
              : lane.time_ms !== null
              ? formatTime(lane.time_ms)
              : "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function ResultsScreen() {
  const { activeRegatta, followedClub } = useAppStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["clubSchedule", activeRegatta?.id, followedClub?.id],
    queryFn: () => {
      if (!activeRegatta || !followedClub) throw new Error("No regatta or club selected");
      return getClubSchedule(activeRegatta.id, followedClub.id);
    },
    enabled: !!(activeRegatta && followedClub),
    refetchInterval: 60_000,
  });

  if (!activeRegatta || !followedClub) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No regatta selected</Text>
        <Text style={styles.emptyBody}>Choose a regatta in Settings.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load results.</Text>
      </View>
    );
  }

  // Show only heats with at least one result posted
  const results: ResultItem[] = (data?.schedule ?? []).filter(
    (item: ResultItem) =>
      item.heat.status === "official" ||
      item.heat.status === "unofficial" ||
      item.club_lanes.some((l: ResultItem["club_lanes"][0]) => l.place !== null || l.time_ms !== null)
  );

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.heat.id}
      ListHeaderComponent={
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>{followedClub.name}</Text>
          <Text style={styles.pageSubtitle}>{activeRegatta.name}</Text>
        </View>
      }
      renderItem={({ item }) => <ResultRow item={item} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyBody}>
            No results posted yet. Check back during and after racing.
          </Text>
        </View>
      }
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a3a5c",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    color: "#c0392b",
    textAlign: "center",
  },
  pageHeader: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a3a5c",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: "#1a3a5c",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardEventName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  cardMeta: {
    color: "#c8a84b",
    fontSize: 12,
    marginTop: 2,
  },
  laneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  lanePlace: {
    width: 36,
    fontSize: 16,
    fontWeight: "700",
    color: "#1a3a5c",
  },
  laneInfo: {
    flex: 1,
  },
  laneName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  laneNumber: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
  },
  laneTime: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    fontVariant: ["tabular-nums"],
  },
});
