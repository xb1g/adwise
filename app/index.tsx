import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type RoleHandling = "elder" | "seeker" | null;

export default function Page() {
  const { user, role, refreshRole } = useAuth();
  const [handleRole, setHandleRole] = useState<RoleHandling>(null);

  const onSelectRole = async (selected: "elder" | "seeker") => {
    setHandleRole(selected);
    try {
      // Seekers sign up after filling in their name + problem
      if (selected === "seeker") {
        router.replace("/(seeker)/problem");
        return;
      }

      // Elders sign up immediately so they can set up their profile
      if (user && role === selected) {
        navigateForRole(selected);
        return;
      }

      let currentUserId = user?.id;

      if (!currentUserId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        currentUserId = data.session?.user.id;
      }

      if (currentUserId) {
        const { error: upsertError } = await supabase
          .from("wisdom_users")
          .upsert({ user_id: currentUserId, role: selected }, { onConflict: "user_id" });

        if (upsertError) throw upsertError;
        await refreshRole();
        navigateForRole(selected);
      }
    } catch (e) {
      console.error("Error setting role:", e);
    } finally {
      setHandleRole(null);
    }
  };

  const navigateForRole = (r: "elder" | "seeker") => {
    if (r === "elder") {
      router.replace("/(elder)/setup");
    } else {
      router.replace("/(seeker)/problem");
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Top (Hero Section) */}
        <View style={styles.hero}>
          <Text style={styles.title}>
            Share Life Experience.{"\n"}Find Real Advice.
          </Text>
          <Text style={styles.subtitle}>
            Connect generations through real stories and paid conversations.
          </Text>
        </View>

        {/* Middle (Two Clear Options) */}
        <View style={styles.optionsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.optionCard,
              pressed && styles.optionCardPressed,
              styles.elderCard,
            ]}
            onPress={() => onSelectRole("elder")}
            disabled={handleRole !== null}
          >
            <View style={styles.optionHeader}>
              <Text style={styles.optionEmoji}>👵</Text>
              {handleRole === "elder" && <ActivityIndicator color="#111" />}
            </View>
            <Text style={styles.optionTitle}>
              I want to share my life stories
            </Text>
            <Text style={styles.optionDesc}>
              Turn your experiences into meaningful advice.
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.optionCard,
              pressed && styles.optionCardPressed,
              styles.seekerCard,
            ]}
            onPress={() => onSelectRole("seeker")}
            disabled={handleRole !== null}
          >
            <View style={styles.optionHeader}>
              <Text style={styles.optionEmoji}>🧑</Text>
              {handleRole === "seeker" && <ActivityIndicator color="#111" />}
            </View>
            <Text style={styles.optionTitle}>I'm looking for advice</Text>
            <Text style={styles.optionDesc}>
              Describe your problem and get matched with real people who've
              lived it.
            </Text>
          </Pressable>
        </View>

        {/* Bottom (Trust Signals) */}
        <View style={styles.trustSignals}>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>✓</Text>
            <Text style={styles.trustText}>Private & secure</Text>
          </View>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>✓</Text>
            <Text style={styles.trustText}>You control what's public</Text>
          </View>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>✓</Text>
            <Text style={styles.trustText}>No spam messages</Text>
          </View>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>✓</Text>
            <Text style={styles.trustText}>Fair revenue sharing</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FDFDFD",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  hero: {
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    lineHeight: 50,
    color: "#111",
    fontFamily: "Orbit_400Regular",
    fontWeight: "900",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: "#555",
    fontFamily: "Orbit_400Regular",
    opacity: 0.9,
  },
  optionsContainer: {
    gap: 20,
    marginBottom: 40,
  },
  optionCard: {
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 24,
    padding: 24,
    minHeight: 180,
    justifyContent: "center",
  },
  elderCard: {
    backgroundColor: "#BFFF00",
  },
  seekerCard: {
    backgroundColor: "#FFF",
  },
  optionCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  optionEmoji: {
    fontSize: 40,
  },
  optionTitle: {
    fontSize: 24,
    fontFamily: "Orbit_400Regular",
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
    lineHeight: 30,
  },
  optionDesc: {
    fontSize: 15,
    fontFamily: "Orbit_400Regular",
    color: "#333",
    lineHeight: 22,
    opacity: 0.85,
  },
  trustSignals: {
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: "#EAEAEA",
    gap: 12,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trustIcon: {
    fontSize: 16,
    color: "#111",
    fontWeight: "bold",
    width: 20,
    textAlign: "center",
  },
  trustText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Orbit_400Regular",
  },
});
