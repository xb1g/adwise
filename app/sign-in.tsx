import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";

export default function SignIn() {
  const { role } = useLocalSearchParams<{ role: "elder" | "seeker" }>();
  const { signInWithGoogle, setPendingRole } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      if (role) await setPendingRole(role);
      await signInWithGoogle();
      // onAuthStateChange in auth.tsx will pick up the pending role,
      // upsert wisdom_users, and _layout.tsx handles navigation
    } catch (e) {
      console.error("Sign-in failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const isElder = role === "elder";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.emoji}>{isElder ? "👵" : "🧑"}</Text>
          <Text style={styles.title}>
            {isElder ? "Share your wisdom." : "Find real advice."}
          </Text>
          <Text style={styles.subtitle}>
            {isElder
              ? "Create an account to start earning from your life experience."
              : "Create an account to get matched with people who've lived it."}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.googleBtn, loading && styles.btnDisabled]}
            onPress={handleGoogle}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#111" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FDFFF5",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: {
    marginBottom: 32,
  },
  backText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#666",
    fontWeight: "700",
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 80,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 24,
  },
  title: {
    fontFamily: "Orbit_400Regular",
    fontSize: 38,
    fontWeight: "900",
    color: "#111",
    lineHeight: 46,
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 17,
    color: "#555",
    lineHeight: 26,
  },
  actions: {
    paddingBottom: 40,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#BFFF00",
    paddingVertical: 20,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#111",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  googleIcon: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },
  googleText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
