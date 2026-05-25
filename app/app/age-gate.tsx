import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export const AGE_GATE_KEY = "hasPassedAgeGate";

export default function AgeGateScreen() {
  const [declined, setDeclined] = useState(false);

  async function handleConfirmAge() {
    await AsyncStorage.setItem(AGE_GATE_KEY, "true");
    router.replace("/onboarding");
  }

  function handleDeclineAge() {
    setDeclined(true);
  }

  if (declined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>For parents &amp; guardians</Text>
          <Text style={styles.body}>
            RowDay is for parents and guardians. Ask your parent to set up the
            app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>RowDay</Text>
        <Text style={styles.title}>Before we continue</Text>
        <Text style={styles.body}>
          RowDay is designed for parents and guardians of youth rowing athletes.
          Please confirm you are 18 or older.
        </Text>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleConfirmAge}
        >
          <Text style={styles.buttonPrimaryText}>
            I&apos;m 18 or older — Continue
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleDeclineAge}
        >
          <Text style={styles.buttonSecondaryText}>I&apos;m under 18</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a3a5c",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a3a5c",
    marginBottom: 16,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
    marginBottom: 40,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonPrimary: {
    backgroundColor: "#1a3a5c",
  },
  buttonPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonSecondaryText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "500",
  },
});
