import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type ElderProfile = {
  id: string;
  age_range: string | null;
  life_areas: string[];
  bio: string;
};

export default function ElderProfile() {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("elder_profiles")
      .select("id, age_range, life_areas, bio")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { setProfile(data); setLoading(false); });
  }, [user]);

  async function handleDevReset() {
    if (!user) return;
    const r1 = await supabase.from("user_profiles").delete().eq("user_id", user.id);
    const r2 = await supabase.from("wisdom_users").delete().eq("user_id", user.id);
    const r3 = await supabase.from("elder_profiles").delete().eq("user_id", user.id);
    console.log("[reset] user_profiles:", r1.error, "wisdom_users:", r2.error, "elder_profiles:", r3.error);
    await refreshProfile();
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#111" size="large" /></View>;
  }

  if (!profile) {
    router.replace("/(elder)/setup");
    return null;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.replace("/(elder)/home")} hitSlop={12}>
        <Text style={styles.backBtnText}>← Home</Text>
      </Pressable>

      <Text style={styles.title}>My Profile</Text>

      {profile.age_range ? (
        <View style={styles.section}>
          <Text style={styles.label}>Age</Text>
          <Text style={styles.value}>{profile.age_range}</Text>
        </View>
      ) : null}

      {profile.bio ? (
        <View style={styles.bioCard}>
          <Text style={styles.label}>About you</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>
      ) : null}

      {profile.life_areas.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.label}>Life areas</Text>
          <View style={styles.chipRow}>
            {profile.life_areas.map((a) => (
              <View key={a} style={styles.chip}>
                <Text style={styles.chipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!profile.bio && profile.life_areas.length === 0 && !profile.age_range && (
        <Text style={styles.emptyHint}>
          Your guide didn't save any details yet. Try the conversation again.
        </Text>
      )}

      <Pressable style={styles.devResetBtn} onPress={handleDevReset}>
        <Text style={styles.devResetText}>reset (dev)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 60, gap: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FDFFF5" },

  backBtn: { marginBottom: 8 },
  backBtnText: { fontFamily: "Orbit_400Regular", fontSize: 20, color: "#111", fontWeight: "900" },

  title: { fontFamily: "Orbit_400Regular", fontSize: 40, color: "#111", fontWeight: "900" },

  section: { gap: 10 },
  label: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  value: { fontFamily: "Orbit_400Regular", fontSize: 28, color: "#111", fontWeight: "900" },

  bioCard: { backgroundColor: "#F0F2E8", padding: 24, gap: 10, borderWidth: 2, borderColor: "#111" },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 20, color: "#111", fontWeight: "900", lineHeight: 32 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderWidth: 2, borderColor: "#111", paddingVertical: 8, paddingHorizontal: 18 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 18, color: "#111", fontWeight: "900" },

  emptyHint: { fontFamily: "Orbit_400Regular", fontSize: 20, color: "#111", fontWeight: "900", lineHeight: 32 },

  devResetBtn: { marginTop: 16, alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: "#CCC" },
  devResetText: { fontSize: 11, fontFamily: "Orbit_400Regular", color: "#999" },
});
