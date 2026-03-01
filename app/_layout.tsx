import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { AuthProvider } from "../lib/auth";
import { ElevenLabsProvider } from "@elevenlabs/react-native";

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="role-select" />
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
