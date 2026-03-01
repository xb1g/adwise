import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";

type SeekerProfile = {
  name: string | null;
  age_range: string | null;
  categories: string[];
  problem_text: string | null;
  phone: string | null;
};

type Booking = {
  id: string;
  problem_text: string | null;
  match_reason: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function SeekerProfileTab() {
  const { user, refreshRole, signOut } = useAuth();
  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAgeRange, setEditAgeRange] = useState("");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user])
  );

  function loadData() {
    if (!user) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("seeker_profiles")
        .select("name, age_range, categories, problem_text, phone")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("bookings")
        .select("id, problem_text, match_reason, status, created_at")
        .eq("seeker_id", user.id)
        .order("created_at", { ascending: false }),
    ]).then(([profileRes, bookingsRes]) => {
      const p = profileRes.data ?? null;
      setProfile(p);
      setEditName(p?.name ?? "");
      setEditPhone(p?.phone ?? "");
      setEditAgeRange(p?.age_range ?? "");
      setBookings((bookingsRes.data as Booking[]) ?? []);
      setLoading(false);
    });
  }

  function startEditing() {
    setEditName(profile?.name ?? "");
    setEditPhone(profile?.phone ?? "");
    setEditAgeRange(profile?.age_range ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("seeker_profiles")
        .update({
          name: editName.trim() || null,
          phone: editPhone.trim() || null,
          age_range: editAgeRange.trim() || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Also update wisdom_users name
      if (editName.trim()) {
        await supabase
          .from("wisdom_users")
          .update({ name: editName.trim() })
          .eq("user_id", user.id);
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim() || null,
              phone: editPhone.trim() || null,
              age_range: editAgeRange.trim() || null,
            }
          : prev
      );
      setEditing(false);
    } catch {
      Alert.alert("Error", "Couldn't save profile. Try again.");
    } finally {
      setSaving(false);
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
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {profile?.name ?? "You"}
            {profile?.age_range ? (
              <Text style={styles.ageRange}>,  {profile.age_range}</Text>
            ) : null}
          </Text>
        </View>
        {!editing ? (
          <Pressable style={styles.editProfileBtn} onPress={startEditing}>
            <Text style={styles.editProfileBtnText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Edit form */}
      {editing ? (
        <View style={styles.editForm}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="Your name"
            placeholderTextColor="#999"
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          <Text style={styles.fieldLabel}>Age range</Text>
          <TextInput
            style={styles.input}
            value={editAgeRange}
            onChangeText={setEditAgeRange}
            placeholder="e.g. 20s, 30s"
            placeholderTextColor="#999"
          />

          <View style={styles.editActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#111" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {/* Display info */}
          {user?.email ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Email</Text>
              <Text style={styles.sectionValue}>{user.email}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Phone</Text>
            <Text style={styles.sectionValue}>
              {profile?.phone || "Not added yet"}
            </Text>
          </View>
        </>
      )}

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
      {bookings.length === 0 ? (
        <Text style={styles.emptyText}>No sessions yet</Text>
      ) : (
        bookings.map((b) => (
          <View key={b.id} style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
              <View
                style={[
                  styles.statusBadge,
                  b.status === "pending" && styles.statusPending,
                  b.status === "confirmed" && styles.statusConfirmed,
                  b.status === "completed" && styles.statusCompleted,
                  b.status === "cancelled" && styles.statusCancelled,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    b.status === "confirmed" && styles.statusTextDark,
                  ]}
                >
                  {b.status}
                </Text>
              </View>
              <Text style={styles.bookingTime}>{timeAgo(b.created_at)}</Text>
            </View>
            {b.problem_text ? (
              <Text style={styles.bookingProblem} numberOfLines={2}>
                {b.problem_text}
              </Text>
            ) : null}
          </View>
        ))
      )}

      <View style={styles.divider} />

      {/* Sign out */}
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
  container: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDFFF5",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
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
  editProfileBtn: {
    borderWidth: 1.5,
    borderColor: "#111",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  editProfileBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },

  /* Edit form */
  editForm: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    padding: 16,
    gap: 12,
  },
  fieldLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.5,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#D8D8D0",
    borderRadius: 8,
    padding: 12,
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#111",
    backgroundColor: "#FDFFF5",
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#D8D8D0",
    borderRadius: 8,
  },
  cancelBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#666",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#BFFF00",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#111",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
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
  section: {
    marginBottom: 12,
  },
  sectionValue: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#111",
    lineHeight: 22,
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
    marginTop: 4,
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
  changeBtn: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  changeBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#111",
    opacity: 0.7,
  },
  deleteBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  deleteBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#E33",
    opacity: 0.7,
  },
  bookingCard: {
    borderWidth: 1,
    borderColor: "#D8D8D0",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFF",
    marginBottom: 8,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: "#222",
  },
  statusConfirmed: {
    backgroundColor: "#BFFF00",
  },
  statusCompleted: {
    backgroundColor: "#E0E0DC",
  },
  statusCancelled: {
    backgroundColor: "#FFD6D6",
  },
  statusText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusTextDark: {
    color: "#111",
  },
  bookingTime: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.4,
  },
  bookingProblem: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    lineHeight: 22,
  },
});
