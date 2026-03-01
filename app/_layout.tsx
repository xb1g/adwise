import { Stack, router } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useLocalSearchParams } from "expo-router";

type WisdomRole = "elder" | "seeker" | null;

function RootNavigator() {
  const { session, loading, profile, profileLoading } = useAuth();
  const { noredirect } = useLocalSearchParams<{ noredirect?: string }>();
  const [role, setRole] = useState<WisdomRole>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [elderOnboardingDone, setElderOnboardingDone] = useState<boolean | null>(null);

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
  }, [session?.user?.id, profile?.onboarding_done]);

  // Check elder onboarding status once role is known
  useEffect(() => {
    if (role !== "elder" || !session?.user?.id) return;

    supabase
      .from("elder_profiles")
      .select("onboarding_done")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setElderOnboardingDone(data?.onboarding_done ?? false);
      });
  }, [role, session?.user?.id]);

  useEffect(() => {
    if (loading || roleLoading || profileLoading) return;
    if (noredirect === "1") return;

    if (!session) {
      router.replace("/");
    } else if (!role) {
      router.replace("/role-select");
    } else if (!profile?.onboarding_done) {
      router.replace("/onboarding");
    } else if (role === "elder") {
      if (elderOnboardingDone === null) return; // still loading
      if (elderOnboardingDone) {
        router.replace("/(elder)/profile");
      } else {
        router.replace("/(elder)/setup");
      }
    } else {
      router.replace("/(seeker)/problem");
    }
  }, [session, loading, role, roleLoading, profile, profileLoading, elderOnboardingDone]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="role-select" />
      <Stack.Screen name="(elder)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
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

