import { Stack, router, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { ElevenLabsProvider } from "@elevenlabs/react-native";

function RootNavigator() {
  const { session, loading, role, roleLoading, seekerOnboardingDone } = useAuth();
  const { noredirect } = useLocalSearchParams<{ noredirect?: string }>();
  const pathname = usePathname();
  const [elderOnboardingDone, setElderOnboardingDone] = useState<boolean | null>(null);
  // Track previous pathname so we know when we've just left the setup page
  const prevPathnameRef = useRef<string | null>(null);

  // Re-fetch elderOnboardingDone on first load and whenever we navigate away
  // from setup (i.e. the user just completed onboarding and we need fresh data).
  useEffect(() => {
    if (role !== "elder" || !session?.user?.id) return;

    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const isFirstLoad = prev === null;
    const justLeftSetup = prev === "/(elder)/setup";

    if (!isFirstLoad && !justLeftSetup) {
      // No need to re-fetch; elder onboarding status doesn't change mid-session
      // (except right after completing setup).
      console.log(`[_layout] skip elder re-fetch: prev=${prev} → current=${pathname}`);
      return;
    }

    console.log(`[_layout] fetching elderOnboardingDone (isFirstLoad=${isFirstLoad}, justLeftSetup=${justLeftSetup})`);
    setElderOnboardingDone(null); // pause routing while loading
    supabase
      .from("elder_profiles")
      .select("onboarding_done")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        const done = data?.onboarding_done ?? false;
        console.log(`[_layout] elderOnboardingDone=${done}`, error ? `error:${error.message}` : "");
        setElderOnboardingDone(done);
      });
  }, [role, session?.user?.id, pathname]);

  useEffect(() => {
    console.log(
      `[_layout] routing check — session=${!!session} loading=${loading} roleLoading=${roleLoading}` +
      ` role=${role} pathname=${pathname}` +
      ` elderOnboardingDone=${elderOnboardingDone} seekerOnboardingDone=${seekerOnboardingDone}` +
      ` noredirect=${noredirect}`
    );

    if (loading || roleLoading) {
      console.log("[_layout] skip: still loading auth/role");
      return;
    }
    if (noredirect === "1") {
      console.log("[_layout] skip: noredirect=1");
      return;
    }
    if (pathname === "/(seeker)/problem") return;

    if (!session) {
      if (pathname !== "/" && pathname !== "/sign-in") {
        console.log("[_layout] no session → /");
        router.replace("/");
      }
    } else if (!role) {
      // Guard against race where role is transiently null during sign-in
      // (onAuthStateChange fires before wisdom_users upsert completes).
      // If already in a role-specific route, wait for role to resolve.
      if (
        !pathname.startsWith("/(seeker)") &&
        !pathname.startsWith("/(elder)") &&
        pathname !== "/" &&
        pathname !== "/sign-in"
      ) {
        console.log("[_layout] no role, outside role routes → /");
        router.replace("/");
      } else {
        console.log("[_layout] no role yet, staying on", pathname);
      }
    } else if (role === "elder") {
      if (elderOnboardingDone === null) {
        console.log("[_layout] elder: waiting for onboarding check…");
        return;
      }
      if (elderOnboardingDone) {
        // Onboarding complete. Allow free navigation within /(elder)/.
        // Only redirect if completely outside the elder section or stuck on setup.
        if (!pathname.startsWith("/(elder)") || pathname === "/(elder)/setup") {
          console.log(`[_layout] elder done, bad path ${pathname} → /(elder)/home`);
          router.replace("/(elder)/home");
        } else {
          console.log(`[_layout] elder done, staying on ${pathname}`);
        }
      } else {
        // Not done — send to setup unless already there.
        if (pathname !== "/(elder)/setup") {
          console.log(`[_layout] elder NOT done, ${pathname} → /(elder)/setup`);
          router.replace("/(elder)/setup");
        } else {
          console.log("[_layout] elder NOT done, already on setup");
        }
      }
    } else if (role === "seeker") {
      if (seekerOnboardingDone === null) {
        console.log("[_layout] seeker: waiting for onboarding check…");
        return;
      }
      if (seekerOnboardingDone) {
        if (!pathname.startsWith("/(seeker)/(tabs)")) {
          console.log(`[_layout] seeker done, ${pathname} → feed`);
          router.replace("/(seeker)/(tabs)/feed");
        }
      } else {
        if (pathname !== "/(seeker)/onboarding") {
          console.log(`[_layout] seeker NOT done, ${pathname} → onboarding`);
          router.replace("/(seeker)/onboarding");
        }
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
