import React from "react";
import { View, Text, StyleSheet } from "react-native";

export interface HeatLane {
  lane_number: number;
  entry_name: string;
  club_short: string;
  seed_time_ms: number | null;
  place: number | null;
  time_ms: number | null;
  dnf: boolean;
  dns: boolean;
  dq: boolean;
}

export interface HeatSheetProps {
  eventName: string;
  heatNumber: string;
  stageName: string;
  scheduledStart: Date;
  status: string;
  lanes: HeatLane[];
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function placeStyle(place: number | null) {
  if (place === 1) return styles.goldPlace;
  if (place === 2) return styles.silverPlace;
  if (place === 3) return styles.bronzePlace;
  return styles.defaultPlace;
}

export function HeatSheet({
  eventName,
  heatNumber,
  stageName,
  scheduledStart,
  status,
  lanes,
}: HeatSheetProps) {
  const timeStr = scheduledStart.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const sortedLanes = [...lanes].sort((a, b) => {
    // If results are in: sort by place then lane
    if (a.place !== null && b.place !== null) return a.place - b.place;
    if (a.place !== null) return -1;
    if (b.place !== null) return 1;
    return a.lane_number - b.lane_number;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{eventName}</Text>
        <Text style={styles.headerSub}>
          {stageName} · {timeStr}
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              status === "official"
                ? styles.pillOfficial
                : status === "unofficial"
                ? styles.pillUnofficial
                : styles.pillScheduled,
            ]}
          >
            <Text style={styles.pillText}>{status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Column headers */}
      <View style={styles.columnHeader}>
        <Text style={[styles.colLabel, styles.colLane]}>Lane</Text>
        <Text style={[styles.colLabel, styles.colName]}>Entry</Text>
        <Text style={[styles.colLabel, styles.colClub]}>Club</Text>
        <Text style={[styles.colLabel, styles.colSeed]}>Seed</Text>
        <Text style={[styles.colLabel, styles.colResult]}>Result</Text>
      </View>

      {/* Lane rows */}
      {sortedLanes.map((lane, idx) => {
        const resultText = lane.dnf
          ? "DNF"
          : lane.dns
          ? "DNS"
          : lane.dq
          ? "DQ"
          : lane.time_ms !== null
          ? formatTime(lane.time_ms)
          : "—";

        const seedText =
          lane.seed_time_ms !== null ? formatTime(lane.seed_time_ms) : "—";

        return (
          <View
            key={lane.lane_number}
            style={[
              styles.laneRow,
              idx % 2 === 1 && styles.laneRowAlt,
            ]}
          >
            <View style={styles.colLane}>
              {lane.place !== null ? (
                <View style={[styles.placeCircle, placeStyle(lane.place)]}>
                  <Text style={styles.placeText}>{lane.place}</Text>
                </View>
              ) : (
                <Text style={styles.laneNumber}>{lane.lane_number}</Text>
              )}
            </View>
            <Text style={[styles.cellText, styles.colName]} numberOfLines={1}>
              {lane.entry_name}
            </Text>
            <Text style={[styles.cellText, styles.colClub]}>{lane.club_short}</Text>
            <Text style={[styles.cellText, styles.colSeed, styles.monoText]}>
              {seedText}
            </Text>
            <Text
              style={[
                styles.cellText,
                styles.colResult,
                styles.monoText,
                lane.place === 1 && styles.winnerText,
              ]}
            >
              {resultText}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    backgroundColor: "#1a3a5c",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  headerSub: {
    color: "#c8a84b",
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    marginTop: 6,
    flexDirection: "row",
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillScheduled: { backgroundColor: "#2c567a" },
  pillOfficial: { backgroundColor: "#1e6b3a" },
  pillUnofficial: { backgroundColor: "#7a5c00" },
  pillText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  columnHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f4f8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dde3ea",
  },
  colLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  colLane: { width: 44 },
  colName: { flex: 1, marginRight: 6 },
  colClub: { width: 42 },
  colSeed: { width: 64, textAlign: "right" },
  colResult: { width: 64, textAlign: "right" },
  laneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  laneRowAlt: {
    backgroundColor: "#fafbfc",
  },
  cellText: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  monoText: {
    fontVariant: ["tabular-nums"],
  },
  winnerText: {
    fontWeight: "700",
    color: "#1a6b3a",
  },
  laneNumber: {
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
    width: 44,
  },
  placeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  goldPlace: { backgroundColor: "#c8a84b" },
  silverPlace: { backgroundColor: "#adb5bd" },
  bronzePlace: { backgroundColor: "#a0522d" },
  defaultPlace: { backgroundColor: "#ccc" },
  placeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
});
