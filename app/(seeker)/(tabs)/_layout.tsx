import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  return (
    <Text
      style={{
        fontSize: 18,
        color,
        fontFamily: "Orbit_400Regular",
        lineHeight: 22,
      }}
    >
      {symbol}
    </Text>
  );
}

export default function SeekerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#111",
          borderTopWidth: 0,
          height: 64,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: "#BFFF00",
        tabBarInactiveTintColor: "#555",
        tabBarLabelStyle: {
          fontFamily: "Orbit_400Regular",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color }) => <TabIcon symbol="✦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color }) => <TabIcon symbol="◈" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon symbol="◉" color={color} />,
        }}
      />
    </Tabs>
  );
}
