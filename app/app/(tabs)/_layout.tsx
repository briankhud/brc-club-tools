import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: "stopwatch", inactive: "stopwatch-outline" },
  results: { active: "trophy", inactive: "trophy-outline" },
  settings: { active: "settings", inactive: "settings-outline" },
};

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
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS.index.active : TAB_ICONS.index.inactive}
              size={size}
              color={color}
            />
          ),
          headerTitle: "RowDay",
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: "Results",
          tabBarLabel: "Results",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS.results.active : TAB_ICONS.results.inactive}
              size={size}
              color={color}
            />
          ),
          headerTitle: "Results",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS.settings.active : TAB_ICONS.settings.inactive}
              size={size}
              color={color}
            />
          ),
          headerTitle: "Settings",
        }}
      />
    </Tabs>
  );
}
