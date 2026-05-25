import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";
import { AGE_GATE_KEY } from "./age-gate";

export default function RootIndex() {
  const [destination, setDestination] = useState<
    "/age-gate" | "/(tabs)" | null
  >(null);

  useEffect(() => {
    AsyncStorage.getItem(AGE_GATE_KEY).then((value) => {
      setDestination(value === "true" ? "/(tabs)" : "/age-gate");
    });
  }, []);

  if (destination === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}
