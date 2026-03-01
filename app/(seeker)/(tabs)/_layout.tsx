import { Tabs } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const TAB_CONFIG: Record<string, { label: string; icon: string }> = {
  home: { label: "Home", icon: "⌂" },
  matches: { label: "Matches", icon: "◈" },
  profile: { label: "Profile", icon: "◉" },
};

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.barOuter, { paddingBottom: bottomPadding }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const config = TAB_CONFIG[route.name] ?? { label: route.name, icon: "•" };

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              onLongPress={() => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              }}
            >
              <Text style={[styles.icon, focused && styles.iconActive]}>
                {config.icon}
              </Text>
              <Text style={[styles.label, focused && styles.labelActive]}>
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SeekerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barOuter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  bar: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 40,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#EAEAE4",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 20,
  },
  icon: {
    fontSize: 18,
    color: "#BBB",
    marginBottom: 2,
  },
  iconActive: {
    color: "#111",
  },
  label: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#BBB",
    fontWeight: "600",
  },
  labelActive: {
    color: "#111",
    fontWeight: "700",
  },
});
