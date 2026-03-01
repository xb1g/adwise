import { Stack, router, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { ElevenLabsProvider } from "@elevenlabs/react-native";

// usePathname() strips Expo Router group segments, so:
//   (elder)/setup  → /setup      (elder)/home → /home
//   (seeker)/onboarding → /onboarding
//   (seeker)/(tabs)/feed → /feed   (seeker)/(tabs)/profile → /profile
const ELDER_PAGES = new Set(["/home", "/setup", "/profile", "/requests", "/sessions", "/stories", "/record"]);

function isSeekerPage(pathname: string) {
  return ["/feed", "/matches", "/profile", "/problem", "/onboarding"].includes(pathname) ||
    pathname.startsWith("/elder/");
}

function RootNavigator() {
  const { session, loading, role, roleLoading, seekerOnboardingDone } = useAuth();
  const { noredirect } = useLocalSearchParams<{ noredirect?: string }>();
  const pathname = usePathname();
  const [elderOnboardingDone, setElderOnboardingDone] = useState<boolean | null>(null);
  // Track previous pathname so we know when we've just left the setup page.
  // NOTE: usePathname() returns /setup (not /(elder)/setup) because groups are stripped.
  const prevPathnameRef = useRef<string | null>(null);

  // Re-fetch elderOnboardingDone on first load and whenever we navigate away
  // from /setup (i.e. the user just completed onboarding and we need fresh data).
  useEffect(() => {
    if (role !== "elder" || !session?.user?.id) return;

    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const isFirstLoad = prev === null;
    const justLeftSetup = prev === "/setup";

    if (!isFirstLoad && !justLeftSetup) {
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
      console.log("[_layout] skip: still loading");
      return;
    }
    if (noredirect === "1") {
      console.log("[_layout] skip: noredirect=1");
      return;
    }
    // /problem is a special seeker page that doesn't require onboarding
    if (pathname === "/problem") return;

    if (!session) {
      if (pathname !== "/" && pathname !== "/sign-in") {
        console.log("[_layout] no session → /");
        router.replace("/");
      }
    } else if (!role) {
      // Guard against race where role is transiently null during sign-in
      // (onAuthStateChange fires before wisdom_users upsert completes).
      const isRolePage = ELDER_PAGES.has(pathname) || isSeekerPage(pathname);
      if (!isRolePage && pathname !== "/" && pathname !== "/sign-in") {
        console.log("[_layout] no role, unknown route → /");
        router.replace("/");
      } else {
        console.log("[_layout] no role yet, waiting on", pathname);
      }
    } else if (role === "elder") {
      if (elderOnboardingDone === null) {
        console.log("[_layout] elder: waiting for onboarding check…");
        return;
      }
      if (elderOnboardingDone) {
        // Allow free navigation within elder pages (except /setup which means stale state).
        if (!ELDER_PAGES.has(pathname) || pathname === "/setup") {
          console.log(`[_layout] elder done, bad path "${pathname}" → /home`);
          router.replace("/(elder)/home");
        } else {
          console.log(`[_layout] elder done, staying on ${pathname}`);
        }
      } else {
        if (pathname !== "/setup") {
          console.log(`[_layout] elder NOT done, "${pathname}" → /setup`);
          router.replace("/(elder)/setup");
        } else {
          console.log("[_layout] elder NOT done, already on /setup");
        }
      }
    } else if (role === "seeker") {
      if (seekerOnboardingDone === null) {
        console.log("[_layout] seeker: waiting for onboarding check…");
        return;
      }
      if (seekerOnboardingDone) {
        // Redirect away from onboarding only; all other seeker pages are fine.
        if (pathname === "/onboarding") {
          console.log("[_layout] seeker done but on /onboarding → /feed");
          router.replace("/(seeker)/(tabs)/feed");
        } else if (!isSeekerPage(pathname)) {
          console.log(`[_layout] seeker done, unknown page "${pathname}" → /feed`);
          router.replace("/(seeker)/(tabs)/feed");
        } else {
          console.log(`[_layout] seeker done, staying on ${pathname}`);
        }
      } else {
        if (pathname !== "/onboarding") {
          console.log(`[_layout] seeker NOT done, "${pathname}" → /onboarding`);
          router.replace("/(seeker)/onboarding");
        } else {
          console.log("[_layout] seeker NOT done, already on /onboarding");
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
