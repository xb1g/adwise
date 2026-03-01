import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type Story = {
  id: string;
  wisdom_snippets: string[];
  preview_text: string;
  life_areas: string[];
  tags: string[];
  status: string;
};

type ElderProfile = {
  id: string;
  age_range: string;
  life_areas: string[];
  bio: string;
};

export default function ElderProfile() {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data: ep } = await supabase
      .from("elder_profiles")
      .select("id, age_range, life_areas, bio")
      .eq("user_id", user!.id)
      .maybeSingle();

    setProfile(ep);

    if (ep) {
      const { data: s } = await supabase
        .from("stories")
        .select("id, wisdom_snippets, preview_text, life_areas, tags, status")
        .eq("elder_id", ep.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setStory(s);
    }

    setLoading(false);
  }

  async function handleDevReset() {
    if (!user) return;
    await supabase.from("user_profiles").delete().eq("user_id", user.id);
    await supabase.from("wisdom_users").delete().eq("user_id", user.id);
    await refreshProfile();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" />
      </View>
    );
  }

  // No profile yet — send to setup
  if (!profile) {
    router.replace("/(elder)/setup");
    return null;
  }

  // Profile but no story — send to record
  if (!story) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.devResetBtn} onPress={handleDevReset}>
          <Text style={styles.devResetText}>reset (dev)</Text>
        </Pressable>
        <Text style={styles.title}>Welcome, elder.</Text>
        <Text style={styles.subtitle}>Your profile is ready. Now record your story.</Text>
        <Pressable style={styles.btn} onPress={() => router.push("/(elder)/record")}>
          <Text style={styles.btnText}>Record my story →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your wisdom profile</Text>

      <View style={styles.bioCard}>
        <Text style={styles.bio}>{profile.bio}</Text>
        <View style={styles.chipRow}>
          {profile.life_areas.map((a) => (
            <View key={a} style={styles.chip}>
              <Text style={styles.chipText}>{a}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Your wisdom</Text>
      {story.wisdom_snippets.map((s, i) => (
        <View key={i} style={styles.quoteCard}>
          <Text style={styles.quote}>" {s} "</Text>
        </View>
      ))}

      <Pressable style={styles.recordAgainBtn} onPress={() => router.push("/(elder)/record")}>
        <Text style={styles.recordAgainText}>+ Record another story</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FDFFF5" },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Orbit_400Regular", color: "#111", opacity: 0.6, marginBottom: 32 },
  bioCard: { backgroundColor: "#F0F2E8", padding: 20, marginBottom: 32, gap: 12 },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 24 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#111", paddingVertical: 4, paddingHorizontal: 12 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111" },
  sectionLabel: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111", opacity: 0.5, letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" },
  quoteCard: { borderLeftWidth: 3, borderLeftColor: "#BFFF00", paddingLeft: 16, marginBottom: 20 },
  quote: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 24, fontStyle: "italic" },
  btn: { backgroundColor: "#111", paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnText: { color: "#FDFFF5", fontFamily: "Orbit_400Regular", fontSize: 16, fontWeight: "700" },
  recordAgainBtn: { borderWidth: 1.5, borderColor: "#111", paddingVertical: 14, alignItems: "center", marginTop: 32 },
  recordAgainText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111" },
  devResetBtn: { position: "absolute", top: 52, right: 20, zIndex: 10, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: "#CCC" },
  devResetText: { fontSize: 11, fontFamily: "Orbit_400Regular", color: "#999" },
});
