import { Stack, router, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { ElevenLabsProvider } from "@elevenlabs/react-native";

function RootNavigator() {
  const { session, loading, role, roleLoading } = useAuth();
  const { noredirect } = useLocalSearchParams<{ noredirect?: string }>();
  const pathname = usePathname();
  const [elderOnboardingDone, setElderOnboardingDone] = useState<boolean | null>(null);
  const [seekerOnboardingDone, setSeekerOnboardingDone] = useState<boolean | null>(null);

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
    if (role !== "seeker" || !session?.user?.id) return;
    supabase
      .from("seeker_profiles")
      .select("onboarding_done")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSeekerOnboardingDone(data?.onboarding_done ?? false);
      });
  }, [role, session?.user?.id]);

  useEffect(() => {
    if (loading || roleLoading) return;
    if (noredirect === "1") return;
    if (pathname === "/(seeker)/problem") return;

    if (!session) {
      if (pathname !== "/" && pathname !== "/sign-in") router.replace("/");
    } else if (!role) {
      // Guard against race conditions where role is transiently null during
      // sign-in (onAuthStateChange fires before wisdom_users upsert completes).
      // If already in a role-specific route, wait for the role to load properly.
      if (!pathname.startsWith("/(seeker)") && !pathname.startsWith("/(elder)") && pathname !== "/" && pathname !== "/sign-in") {
        router.replace("/");
      }
    } else if (role === "elder") {
      if (elderOnboardingDone === null) return;
      if (elderOnboardingDone) {
        if (pathname !== "/(elder)/home") router.replace("/(elder)/home");
      } else {
        if (pathname !== "/(elder)/setup") router.replace("/(elder)/setup");
      }
    } else if (role === "seeker") {
      if (seekerOnboardingDone === null) return;
      if (seekerOnboardingDone) {
        if (pathname !== "/(seeker)/(tabs)/feed") router.replace("/(seeker)/(tabs)/feed");
      } else {
        if (pathname !== "/(seeker)/onboarding") router.replace("/(seeker)/onboarding");
      }
    }
  }, [session, loading, role, roleLoading, elderOnboardingDone, seekerOnboardingDone, pathname]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="(elder)" />
      <Stack.Screen name="(seeker)" />
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
    <ElevenLabsProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ElevenLabsProvider>
  );
}
