import { Stack, router, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../lib/auth";
import { ElevenLabsProvider } from "@elevenlabs/react-native";

// usePathname() strips Expo Router group segments, so:
//   (elder)/setup  → /setup      (elder)/home → /home
//   (seeker)/onboarding → /onboarding
//   (seeker)/(tabs)/home → /home   (seeker)/(tabs)/profile → /profile
const ELDER_PAGES = new Set(["/home", "/setup", "/profile", "/requests", "/sessions", "/stories", "/record", "/story-player"]);

function isElderPage(pathname: string) {
  return ELDER_PAGES.has(pathname) || pathname.startsWith("/request/");
}

function isSeekerPage(pathname: string) {
  return ["/home", "/matches", "/profile", "/problem", "/onboarding"].includes(pathname) ||
    pathname.startsWith("/elder/") ||
    pathname.startsWith("/matches/");
}

function RootNavigator() {
  const { session, loading, role, roleLoading, seekerOnboardingDone, elderOnboardingDone } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    console.log(
      `[_layout] session=${!!session} loading=${loading} roleLoading=${roleLoading}` +
      ` role=${role} pathname=${pathname}` +
      ` elderDone=${elderOnboardingDone} seekerDone=${seekerOnboardingDone}`
    );

    if (loading || roleLoading) return;
    if (pathname === "/problem") return;

    const isAuthPage = pathname === "/" || pathname === "/sign-in" || pathname === "/google-auth";

    if (!session) {
      if (!isAuthPage) router.replace("/");
      return;
    }

    if (!role) {
      // While role is being set (sign-in flow), stay put on auth/role pages
      const isKnownPage = isElderPage(pathname) || isSeekerPage(pathname) || isAuthPage;
      if (!isKnownPage) router.replace("/");
      return;
    }

    if (role === "elder") {
      if (elderOnboardingDone === null) return; // still loading
      if (elderOnboardingDone) {
        if (!isElderPage(pathname) || pathname === "/setup") {
          router.replace("/(elder)/home");
        }
      } else {
        if (pathname !== "/setup") router.replace("/(elder)/setup");
      }
    } else if (role === "seeker") {
      if (seekerOnboardingDone === null) return; // still loading
      if (seekerOnboardingDone) {
        if (pathname === "/onboarding" || !isSeekerPage(pathname)) {
          router.replace("/(seeker)/(tabs)/home");
        }
      } else {
        if (pathname !== "/onboarding") router.replace("/(seeker)/onboarding");
      }
    }
  }, [session, loading, role, roleLoading, elderOnboardingDone, seekerOnboardingDone, pathname]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="google-auth" />
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
