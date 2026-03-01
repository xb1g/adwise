import { Stack, router } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type WisdomRole = "elder" | "seeker" | null;

function RootNavigator() {
  const { session, loading } = useAuth();
  const [role, setRole] = useState<WisdomRole>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    setRoleLoading(true);
    supabase
      .from("wisdom_users")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole((data?.role as WisdomRole) ?? null);
        setRoleLoading(false);
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading || roleLoading) return;

    if (!session) {
      router.replace("/");
    } else if (!role) {
      router.replace("/role-select");
    } else if (role === "elder") {
      router.replace("/(elder)/profile");
    } else {
      router.replace("/goal-create");
    }
  }, [session, loading, role, roleLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="role-select" />
      <Stack.Screen name="(elder)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="goal-create" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbit_400Regular: require("../assets/Orbit_400Regular.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
