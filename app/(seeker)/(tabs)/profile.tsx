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
  const { user, refreshRole } = useAuth();
  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase
        .from("seeker_profiles")
        .select("name, age_range, categories, problem_text")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("bookings")
        .select("id, problem_text, match_reason, status, created_at")
        .eq("seeker_id", user.id)
        .order("created_at", { ascending: false }),
    ]).then(([profileRes, bookingsRes]) => {
      setProfile(profileRes.data ?? null);
      setBookings((bookingsRes.data as Booking[]) ?? []);
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

  async function handleSwitchToElder() {
    if (!user) return;
    setSwitching(true);
    await supabase
      .from("wisdom_users")
      .upsert({ user_id: user.id, role: "elder" }, { onConflict: "user_id" });
    await refreshRole();
    // _layout.tsx detects role change and navigates to elder setup or home
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

      {/* Switch side */}
      <Pressable
        style={[styles.switchBtn, switching && styles.btnDisabled]}
        onPress={handleSwitchToElder}
        disabled={switching}
      >
        {switching ? (
          <ActivityIndicator color="#111" size="small" />
        ) : (
          <Text style={styles.switchBtnText}>Switch to Elder side 👵</Text>
        )}
      </Pressable>

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
  switchBtn: {
    borderWidth: 1.5,
    borderColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  switchBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  btnDisabled: {
    opacity: 0.4,
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
