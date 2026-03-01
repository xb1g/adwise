import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type ElderProfile = {
  id: string;
  name: string;
  age_range: string | null;
  life_areas: string[];
  bio: string;
};

type ElderStats = {
  storiesCount: number;
  peopleHelpedCount: number;
};

export default function ElderProfile() {
  const { user, refreshRole, signOut } = useAuth();
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ElderStats>({
    storiesCount: 0,
    peopleHelpedCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("elder_profiles")
      .select("id, name, age_range, life_areas, bio")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setEditedName(data?.name ?? "");
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!profile?.id) return;
    const elderId = profile.id;

    let active = true;
    setStatsLoading(true);

    async function fetchStats() {
      try {
        const [storiesRes, bookingsRes] = await Promise.all([
          supabase
            .from("stories")
            .select("id", { count: "exact", head: true })
            .eq("elder_id", elderId),
          supabase.from("bookings").select("seeker_id").eq("elder_id", elderId),
        ]);

        if (storiesRes.error) {
          throw storiesRes.error;
        }

        if (bookingsRes.error) {
          throw bookingsRes.error;
        }

        if (!active) return;

        const peopleHelpedCount = new Set(
          (bookingsRes.data ?? []).map((booking) => booking.seeker_id)
        ).size;

        setStats({
          storiesCount: storiesRes.count ?? 0,
          peopleHelpedCount,
        });
      } catch (err) {
        console.error("[profile] fetch stats error:", err);
        if (active) {
          setStats({ storiesCount: 0, peopleHelpedCount: 0 });
        }
      } finally {
        if (active) {
          setStatsLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  function resetEditedName() {
    setEditedName(profile?.name ?? "");
    setIsEditingName(false);
  }

  async function handleSaveName() {
    if (!user || !profile) return;
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter a name.");
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from("elder_profiles")
        .update({ name: trimmedName })
        .eq("id", profile.id);

      if (error) {
        throw error;
      }

      setProfile((current) => (current ? { ...current, name: trimmedName } : current));
      setIsEditingName(false);
      Alert.alert("Saved", "Your name was updated.");
    } catch (err) {
      console.error("[profile] save name error:", err);
      Alert.alert("Error", "Couldn't save your name. Try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  async function handleChangeChoice() {
    if (!user) return;
    await supabase
      .from("wisdom_users")
      .upsert({ user_id: user.id, role: null }, { onConflict: "user_id" });
    await refreshRole();
    router.replace("/");
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.functions.invoke("delete-account");
            if (error) {
              console.error("[profile] delete account error:", error);
              Alert.alert("Error", "Failed to delete account. Try again.");
              return;
            }
            await signOut();
            router.replace("/");
          },
        },
      ]
    );
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
      <Pressable
        style={styles.backBtn}
        onPress={() => router.replace("/(elder)/home")}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go to home"
        accessibilityHint="Returns to elder home screen"
      >
        <Text style={styles.backBtnText}>🏠</Text>
      </Pressable>

      <Text style={styles.title}>My Profile</Text>

      <View style={styles.statsBlock}>
        <View style={styles.statCard}>
          <Text style={styles.statValue} accessibilityRole="text">
            {statsLoading ? "…" : stats.storiesCount}
          </Text>
          <Text style={styles.statLabel}>Stories</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue} accessibilityRole="text">
            {statsLoading ? "…" : stats.peopleHelpedCount}
          </Text>
          <Text style={styles.statLabel}>People helped</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Name</Text>
        {isEditingName ? (
          <View>
            <TextInput
              style={[styles.nameInput, savingName && styles.nameInputDisabled]}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Enter your name"
              placeholderTextColor="#888"
              autoCapitalize="words"
            />
            <View style={styles.nameActions}>
              <Pressable
                style={[styles.saveBtn, (savingName || !editedName.trim()) && styles.btnDisabled]}
                onPress={handleSaveName}
                disabled={savingName || !editedName.trim()}
              >
                {savingName ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={resetEditedName} disabled={savingName}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.nameRow}>
            {profile.name ? <Text style={styles.value}>{profile.name}</Text> : <Text style={styles.emptyText}>No name set</Text>}
            <Pressable
              onPress={() => setIsEditingName(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit name"
              accessibilityHint="Opens name editing field"
            >
              <Text style={styles.editLink}>✏️</Text>
            </Pressable>
          </View>
        )}
      </View>

      {user?.email ? (
        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
      ) : null}

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

      <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Pressable style={styles.changeBtn} onPress={handleChangeChoice}>
        <Text style={styles.changeBtnText}>Change your choice</Text>
      </Pressable>

      <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
        <Text style={styles.deleteBtnText}>Delete account (dev)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 60, gap: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FDFFF5" },

  backBtn: {
    marginBottom: 8,
    width: 56,
    height: 56,
    borderWidth: 1.5,
    borderColor: "#111",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  backBtnText: { fontSize: 30, color: "#111" },

  title: { fontFamily: "Orbit_400Regular", fontSize: 40, color: "#111", fontWeight: "900" },
  statsBlock: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#111",
    padding: 16,
    alignItems: "center",
    backgroundColor: "#FFF",
    gap: 4,
  },
  statValue: {
    fontFamily: "Orbit_400Regular",
    fontSize: 34,
    fontWeight: "900",
    color: "#111",
    lineHeight: 40,
  },
  statLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "900",
    color: "#111",
    textTransform: "uppercase",
    opacity: 0.65,
  },

  section: { gap: 10 },
  label: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  value: { fontFamily: "Orbit_400Regular", fontSize: 28, color: "#111", fontWeight: "900" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  editLink: { fontSize: 26, color: "#111", lineHeight: 30 },
  emptyText: { fontFamily: "Orbit_400Regular", fontSize: 28, color: "#999", fontWeight: "900" },
  nameInput: {
    borderWidth: 2,
    borderColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#111",
    fontWeight: "900",
    backgroundColor: "#FFF",
  },
  nameInputDisabled: { opacity: 0.6 },
  nameActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  saveBtn: {
    borderWidth: 2,
    borderColor: "#111",
    backgroundColor: "#BFFF00",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  saveBtnText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", fontWeight: "700" },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#666" },
  btnDisabled: { opacity: 0.5 },

  bioCard: { backgroundColor: "#F0F2E8", padding: 24, gap: 10, borderWidth: 2, borderColor: "#111" },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 20, color: "#111", fontWeight: "900", lineHeight: 32 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderWidth: 2, borderColor: "#111", paddingVertical: 8, paddingHorizontal: 18 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 18, color: "#111", fontWeight: "900" },

  emptyHint: { fontFamily: "Orbit_400Regular", fontSize: 20, color: "#111", fontWeight: "900", lineHeight: 32 },

  signOutBtn: {
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  signOutText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  changeBtn: {
    borderWidth: 1,
    borderColor: "#CCC",
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  changeBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#555",
  },
  deleteBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 12,
  },
  deleteBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#E33",
    opacity: 0.7,
  },
});
