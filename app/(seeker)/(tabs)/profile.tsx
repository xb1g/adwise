import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";

const __DEV__ = process.env.NODE_ENV !== "production";

type SeekerProfile = {
  name: string | null;
  age_range: string | null;
  categories: string[];
  problem_text: string | null;
};

export default function SeekerProfileTab() {
  const { user, refreshRole } = useAuth();
  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("seeker_profiles")
      .select("name, age_range, categories, problem_text")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setProfile(data ?? null);
        setLoading(false);
      });
  }, [user]);

  async function handleDevReset() {
    if (!user) return;
    const r1 = await supabase.from("seeker_profiles").delete().eq("user_id", user.id);
    const r2 = await supabase.from("wisdom_users").update({ onboarding_done: false }).eq("user_id", user.id);
    console.log("[reset] seeker_profiles:", r1.error, "wisdom_users:", r2.error);
    await refreshRole();
    router.replace("/(seeker)/onboarding");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.name}>
          {profile?.name ?? "You"}
          {profile?.age_range ? (
            <Text style={styles.ageRange}>,  {profile.age_range}</Text>
          ) : null}
        </Text>
      </View>

      {/* Category chips */}
      {profile?.categories?.length ? (
        <View style={styles.chipRow}>
          {profile.categories.map((cat) => (
            <View key={cat} style={styles.chip}>
              <Text style={styles.chipText}>{cat}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.divider} />

      {/* Situation block */}
      <Text style={styles.sectionLabel}>Your situation</Text>
      <View style={styles.situationCard}>
        <Text style={styles.situationText}>
          {profile?.problem_text ?? "No situation added yet."}
        </Text>
      </View>
      <Pressable
        style={styles.editBtn}
        onPress={() => router.push("/(seeker)/problem")}
      >
        <Text style={styles.editBtnText}>edit</Text>
      </Pressable>

      <View style={styles.divider} />

      {/* Sessions */}
      <Text style={styles.sectionLabel}>Sessions</Text>
      <Text style={styles.emptyText}>No sessions yet</Text>

      <View style={styles.divider} />

      {/* Sign out */}
      <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      {__DEV__ && (
        <Pressable style={styles.devResetBtn} onPress={handleDevReset}>
          <Text style={styles.devResetText}>reset onboarding (dev)</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 64,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDFFF5",
  },
  headerRow: {
    marginBottom: 4,
  },
  name: {
    fontFamily: "Orbit_400Regular",
    fontSize: 26,
    fontWeight: "700",
    color: "#111",
    lineHeight: 34,
  },
  ageRange: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    fontWeight: "400",
    color: "#111",
    opacity: 0.6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#111",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  chipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#111",
  },
  divider: {
    height: 1,
    backgroundColor: "#111",
    opacity: 0.1,
    marginVertical: 4,
  },
  sectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.5,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  situationCard: {
    borderWidth: 1,
    borderColor: "#D8D8D0",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFF",
  },
  situationText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    lineHeight: 22,
  },
  editBtn: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 4,
  },
  editBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#111",
    fontWeight: "700",
  },
  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    opacity: 0.4,
  },
  signOutBtn: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  signOutText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    opacity: 0.5,
  },
  devResetBtn: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#CCC",
    marginTop: 8,
  },
  devResetText: {
    fontSize: 11,
    fontFamily: "Orbit_400Regular",
    color: "#999",
  },
});
