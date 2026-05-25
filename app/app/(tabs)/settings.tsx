import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useAppStore } from "../../store/useAppStore";

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? "Not set"}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { activeRegatta, followedClub, followedAthlete } = useAppStore();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionHeader title="Regatta" />
      <SettingsRow
        label="Active Regatta"
        value={activeRegatta?.name ?? "None"}
        onPress={() => {
          // TODO: navigate to regatta picker
        }}
      />

      <SectionHeader title="Following" />
      <SettingsRow
        label="Club"
        value={followedClub?.name ?? "None"}
        onPress={() => {
          // TODO: navigate to club picker
        }}
      />
      <SettingsRow
        label="Athlete"
        value={
          followedAthlete
            ? `${followedAthlete.first_name} ${followedAthlete.last_name}`
            : "None"
        }
        onPress={() => {
          // TODO: navigate to athlete picker
        }}
      />

      <SectionHeader title="About" />
      <SettingsRow label="Version" value="0.1.0" />
      <SettingsRow label="Built for" value="Brighton Rowing Club" />

      <Text style={styles.footer}>
        RowDay · Brighton Rowing Club · brightoncrew.org
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  rowPressed: {
    backgroundColor: "#f5f5f5",
  },
  rowLabel: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  rowValue: {
    fontSize: 15,
    color: "#888",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#bbb",
    marginTop: 40,
    paddingHorizontal: 16,
  },
});
