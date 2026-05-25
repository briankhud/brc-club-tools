import { Tabs } from "expo-router";
import { Platform } from "react-native";

// Using Unicode characters as icon stand-ins until a proper icon library
// (e.g. @expo/vector-icons) is added. Replace TabBarIcon with Ionicons etc.
function TabBarIcon({ symbol }: { symbol: string }) {
  return null; // placeholder — swap in <Ionicons> once icons are installed
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1a3a5c",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e0e0e0",
        },
        headerStyle: {
          backgroundColor: "#1a3a5c",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Schedule",
          tabBarLabel: "Schedule",
          tabBarIcon: ({ color }) => <TabBarIcon symbol="calendar" />,
          headerTitle: "RowDay",
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: "Results",
          tabBarLabel: "Results",
          tabBarIcon: ({ color }) => <TabBarIcon symbol="trophy" />,
          headerTitle: "Results",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color }) => <TabBarIcon symbol="gear" />,
          headerTitle: "Settings",
        }}
      />
    </Tabs>
  );
}
