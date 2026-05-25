import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../../store/useAppStore";
import { getClubSchedule } from "../../services/api";
import { CountdownCard } from "../../components/CountdownCard";

interface ScheduleItem {
  event: { id: string; name: string; event_number: number };
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
    seed_time_ms: number | null;
  }>;
}

function RegattaHeader({
  name,
  date,
}: {
  name: string;
  date: string;
}) {
  return (
    <View style={styles.regattaHeader}>
      <Text style={styles.regattaName}>{name}</Text>
      <Text style={styles.regattaDate}>{date}</Text>
    </View>
  );
}

function HeatRow({ item }: { item: ScheduleItem }) {
  const { heat, event, club_lanes } = item;
  const startTime = new Date(heat.scheduled_start);
  const timeStr = startTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={styles.heatRow}>
      <View style={styles.heatTime}>
        <Text style={styles.heatTimeText}>{timeStr}</Text>
        <Text style={styles.heatNumber}>Heat {heat.display_number}</Text>
      </View>
      <View style={styles.heatInfo}>
        <Text style={styles.eventName}>{event.name}</Text>
        {club_lanes.map((lane) => (
          <Text key={lane.lane_number} style={styles.athleteName}>
            {lane.entry_name} — Lane {lane.lane_number}
          </Text>
        ))}
      </View>
      <View
        style={[
          styles.statusPill,
          heat.status === "official"
            ? styles.pillOfficial
            : heat.status === "unofficial"
            ? styles.pillUnofficial
            : styles.pillScheduled,
        ]}
      >
        <Text style={styles.pillText}>{heat.status}</Text>
      </View>
    </View>
  );
}

export default function ScheduleScreen() {
  const { activeRegatta, followedClub, followedAthlete } = useAppStore();

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["clubSchedule", activeRegatta?.id, followedClub?.id],
    queryFn: () => {
      if (!activeRegatta || !followedClub) {
        throw new Error("No regatta or club selected");
      }
      return getClubSchedule(activeRegatta.id, followedClub.id);
    },
    enabled: !!(activeRegatta && followedClub),
    refetchInterval: 60_000, // refresh every minute during a regatta
  });

  // Find the next upcoming heat for the followed athlete
  const nextHeat: ScheduleItem | undefined = data?.schedule?.find(
    (item: ScheduleItem) =>
      item.heat.status === "scheduled" &&
      new Date(item.heat.scheduled_start) > new Date()
  );

  // Also find the athlete's specific lane in the next heat
  const athleteLane = nextHeat?.club_lanes?.find((l) =>
    l.entry_name.includes(followedAthlete?.last_name ?? "___NONE___")
  );

  if (!activeRegatta || !followedClub) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No regatta selected</Text>
        <Text style={styles.emptyBody}>
          Go to Settings to choose a regatta and your club.
        </Text>
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
        <Text style={styles.errorText}>
          Could not load schedule. Make sure the backend is running.
        </Text>
      </View>
    );
  }

  const schedule: ScheduleItem[] = data?.schedule ?? [];

  return (
    <FlatList
      data={schedule}
      keyExtractor={(item) => item.heat.id}
      ListHeaderComponent={
        <>
          <RegattaHeader
            name={activeRegatta.name}
            date={new Date(activeRegatta.start_date).toLocaleDateString(
              undefined,
              { weekday: "long", month: "long", day: "numeric", year: "numeric" }
            )}
          />
          {nextHeat && followedAthlete && (
            <CountdownCard
              athleteName={`${followedAthlete.first_name} ${followedAthlete.last_name}`}
              eventName={nextHeat.event.name}
              heatNumber={nextHeat.heat.display_number}
              laneNumber={athleteLane?.lane_number ?? null}
              scheduledStart={new Date(nextHeat.heat.scheduled_start)}
              status={nextHeat.heat.status}
            />
          )}
          <Text style={styles.sectionHeader}>Full Schedule — {followedClub.short_name}</Text>
        </>
      }
      renderItem={({ item }) => <HeatRow item={item} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyBody}>No heats found for {followedClub.name}.</Text>
        </View>
      }
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
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
  regattaHeader: {
    backgroundColor: "#1a3a5c",
    padding: 16,
    paddingBottom: 12,
  },
  regattaName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  regattaDate: {
    color: "#c8a84b",
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  heatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  heatTime: {
    width: 64,
    marginRight: 12,
  },
  heatTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a3a5c",
  },
  heatNumber: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  heatInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  athleteName: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  pillScheduled: {
    backgroundColor: "#e8edf3",
  },
  pillOfficial: {
    backgroundColor: "#d4edda",
  },
  pillUnofficial: {
    backgroundColor: "#fff3cd",
  },
  pillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#333",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
