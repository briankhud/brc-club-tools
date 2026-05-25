import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

export interface CountdownCardProps {
  athleteName: string;
  eventName: string;
  heatNumber: string;
  laneNumber: number | null;
  scheduledStart: Date;
  status: string; // "scheduled" | "official" | "unofficial" | "cancelled"
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

function getTimeLeft(target: Date): TimeLeft {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, totalSeconds };
}

/** Returns background and accent colors based on how soon the heat starts. */
function getUrgencyColors(totalSeconds: number): {
  bg: string;
  text: string;
  accent: string;
} {
  if (totalSeconds <= 0) {
    return { bg: "#2c3e50", text: "#ecf0f1", accent: "#95a5a6" }; // grey — race started
  }
  if (totalSeconds <= 5 * 60) {
    // < 5 min — red
    return { bg: "#c0392b", text: "#fff", accent: "#e74c3c" };
  }
  if (totalSeconds <= 15 * 60) {
    // 5–15 min — orange
    return { bg: "#d35400", text: "#fff", accent: "#e67e22" };
  }
  if (totalSeconds <= 30 * 60) {
    // 15–30 min — yellow/amber
    return { bg: "#b7860b", text: "#fff", accent: "#c8a84b" };
  }
  // > 30 min — BRC navy
  return { bg: "#1a3a5c", text: "#fff", accent: "#c8a84b" };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function CountdownCard({
  athleteName,
  eventName,
  heatNumber,
  laneNumber,
  scheduledStart,
  status,
}: CountdownCardProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    getTimeLeft(scheduledStart)
  );

  useEffect(() => {
    // Recalculate immediately when scheduledStart changes
    setTimeLeft(getTimeLeft(scheduledStart));

    const interval = setInterval(() => {
      const t = getTimeLeft(scheduledStart);
      setTimeLeft(t);
      if (t.totalSeconds <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduledStart]);

  const { bg, text, accent } = getUrgencyColors(timeLeft.totalSeconds);
  const isOver = timeLeft.totalSeconds <= 0 && status === "scheduled";
  const isOfficial = status === "official";
  const isCancelled = status === "cancelled";

  const scheduledTimeStr = scheduledStart.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      {/* Event info */}
      <View style={styles.topRow}>
        <View style={styles.eventMeta}>
          <Text style={[styles.eventName, { color: text }]}>{eventName}</Text>
          <Text style={[styles.heatLabel, { color: accent }]}>
            Heat {heatNumber}
            {laneNumber !== null ? ` · Lane ${laneNumber}` : ""}
          </Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: accent }]}>
          <Text style={[styles.statusText, { color: accent }]}>
            {isCancelled
              ? "CANCELLED"
              : isOfficial
              ? "OFFICIAL"
              : status === "unofficial"
              ? "UNOFFICIAL"
              : isOver
              ? "STARTED"
              : "UPCOMING"}
          </Text>
        </View>
      </View>

      {/* Athlete name */}
      <Text style={[styles.athleteName, { color: text }]}>{athleteName}</Text>

      {/* Countdown display */}
      {!isOfficial && !isCancelled && (
        <View style={styles.countdownRow}>
          {timeLeft.hours > 0 && (
            <>
              <View style={styles.timeBlock}>
                <Text style={[styles.timeDigits, { color: text }]}>
                  {pad(timeLeft.hours)}
                </Text>
                <Text style={[styles.timeUnit, { color: accent }]}>hr</Text>
              </View>
              <Text style={[styles.timeSeparator, { color: text }]}>:</Text>
            </>
          )}
          <View style={styles.timeBlock}>
            <Text style={[styles.timeDigits, { color: text }]}>
              {pad(timeLeft.minutes)}
            </Text>
            <Text style={[styles.timeUnit, { color: accent }]}>min</Text>
          </View>
          <Text style={[styles.timeSeparator, { color: text }]}>:</Text>
          <View style={styles.timeBlock}>
            <Text style={[styles.timeDigits, { color: text }]}>
              {pad(timeLeft.seconds)}
            </Text>
            <Text style={[styles.timeUnit, { color: accent }]}>sec</Text>
          </View>
        </View>
      )}

      {/* Scheduled time */}
      <Text style={[styles.scheduledTime, { color: accent }]}>
        Scheduled: {scheduledTimeStr}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  eventMeta: {
    flex: 1,
    marginRight: 8,
  },
  eventName: {
    fontSize: 17,
    fontWeight: "700",
  },
  heatLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  athleteName: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  timeBlock: {
    alignItems: "center",
    minWidth: 52,
  },
  timeDigits: {
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 52,
    fontVariant: ["tabular-nums"],
  },
  timeUnit: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  timeSeparator: {
    fontSize: 40,
    fontWeight: "300",
    lineHeight: 52,
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  scheduledTime: {
    fontSize: 12,
  },
});
