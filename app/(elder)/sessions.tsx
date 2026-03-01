import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type Booking = {
  id: string;
  elder_id: string;
  seeker_id: string;
  problem_text: string;
  match_reason: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
  seeker_name: string | null;
  seeker_age_range: string | null;
  seeker_categories: string[];
  seeker_problem_text: string | null;
  seeker_onboarding_done: boolean | null;
};

type SeekerProfile = {
  user_id: string;
  name: string | null;
  age_range: string | null;
  categories: string[] | null;
  problem_text: string | null;
  onboarding_done: boolean | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  const badgeStyle = [
    styles.statusBadge,
    status === "pending" && styles.statusPending,
    status === "confirmed" && styles.statusConfirmed,
    status === "completed" && styles.statusCompleted,
    status === "cancelled" && styles.statusCancelled,
  ];
  const textStyle = [
    styles.statusText,
    status === "pending" && styles.statusTextPending,
    status === "confirmed" && styles.statusTextConfirmed,
    status === "completed" && styles.statusTextCompleted,
    status === "cancelled" && styles.statusTextCancelled,
  ];

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{status.toUpperCase()}</Text>
    </View>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const onboardingLabel =
    booking.seeker_onboarding_done === null
      ? null
      : booking.seeker_onboarding_done
        ? "Onboarded"
        : "Not onboarded";
  const hasProfileMetadata =
    booking.seeker_name !== null ||
    booking.seeker_age_range !== null ||
    booking.seeker_categories.length > 0 ||
    booking.seeker_problem_text !== null ||
    booking.seeker_onboarding_done !== null;
  const displayName = booking.seeker_name?.trim() || "Seeker";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <StatusBadge status={booking.status} />
        <Text style={styles.timestamp}>{formatDate(booking.created_at)}</Text>
      </View>

      <Text style={styles.seekerText}>
        {displayName}
      </Text>
      {hasProfileMetadata ? (
        <Text style={styles.seekerMeta}>
          {[
            booking.seeker_age_range ? `Age ${booking.seeker_age_range}` : null,
            onboardingLabel,
            booking.seeker_categories.length > 0
              ? `${booking.seeker_categories.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" • ")}
        </Text>
      ) : null}
      {booking.seeker_problem_text ? (
        <Text style={styles.seekerProblemText} numberOfLines={2}>
          {booking.seeker_problem_text}
        </Text>
      ) : null}

      <Text style={styles.problemText} numberOfLines={3}>
        {booking.problem_text}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.matchLabel}>WHY YOU WERE MATCHED</Text>
      <Text style={styles.matchReason} numberOfLines={3}>
        {booking.match_reason?.trim() ? booking.match_reason : "No match reason recorded."}
      </Text>
    </View>
  );
}

export default function MySessions() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchBookings() {
      const { data: profileData } = await supabase
        .from("elder_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!profileData) {
        setLoading(false);
        return;
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("elder_id", profileData.id)
        .order("created_at", { ascending: false });

      if (bookingsError) {
        console.error("[sessions] fetch bookings error:", bookingsError);
        setLoading(false);
        return;
      }

      const seekerIds = Array.from(new Set((bookingsData ?? []).map((b) => b.seeker_id)));
      const seekerById = new Map<string, SeekerProfile>();

      if (seekerIds.length > 0) {
        const { data: seekersData, error: seekersError } = await supabase
          .from("seeker_profiles")
          .select("user_id, name, age_range, categories, problem_text, onboarding_done")
          .in("user_id", seekerIds);

        if (seekersError) {
          console.error("[sessions] fetch seeker profiles error:", seekersError);
        } else {
          seekersData?.forEach((s: SeekerProfile) => {
            seekerById.set(s.user_id, s);
          });
        }
      }

      const enriched: Booking[] = (bookingsData ?? []).map((booking) => ({
        ...booking,
        seeker_name: seekerById.get(booking.seeker_id)?.name ?? null,
        seeker_age_range: seekerById.get(booking.seeker_id)?.age_range ?? null,
        seeker_categories: seekerById.get(booking.seeker_id)?.categories ?? [],
        seeker_problem_text: seekerById.get(booking.seeker_id)?.problem_text ?? null,
        seeker_onboarding_done: seekerById.get(booking.seeker_id)?.onboarding_done ?? null,
      }));

      setBookings(enriched);
      setLoading(false);
    }

    fetchBookings();
  }, [user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable
        style={styles.backBtn}
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to previous screen"
      >
        <Text style={styles.backBtnText}>🔙</Text>
      </Pressable>

      <Text style={styles.title}>My{"\n"}Sessions</Text>

      {bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No sessions yet. When seekers book a conversation, it will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </View>
      )}
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

  title: {
    fontFamily: "Orbit_400Regular",
    fontSize: 44,
    color: "#111",
    fontWeight: "900",
    lineHeight: 52,
  },

  list: { gap: 20 },

  card: {
    borderWidth: 2,
    borderColor: "#111",
    padding: 20,
    gap: 12,
    backgroundColor: "#FDFFF5",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusBadge: {
    borderWidth: 2,
    borderColor: "#111",
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusPending: {
    backgroundColor: "#111",
  },
  statusConfirmed: {
    backgroundColor: "#BFFF00",
    borderColor: "#111",
  },
  statusCompleted: {
    backgroundColor: "#E0E0E0",
    borderColor: "#999",
  },
  statusCancelled: {
    backgroundColor: "#FFE5E5",
    borderColor: "#111",
  },

  statusText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  statusTextPending: { color: "#FFFFFF" },
  statusTextConfirmed: { color: "#111" },
  statusTextCompleted: { color: "#666" },
  statusTextCancelled: { color: "#111" },

  timestamp: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#666",
    fontWeight: "900",
    letterSpacing: 1,
  },

  problemText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#111",
    fontWeight: "900",
    lineHeight: 30,
  },
  seekerText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#111",
    fontWeight: "900",
    letterSpacing: 1,
  },
  seekerMeta: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#555",
    letterSpacing: 0.7,
  },
  seekerProblemText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#444",
    lineHeight: 20,
  },

  divider: {
    height: 2,
    backgroundColor: "#111",
  },

  matchLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    fontWeight: "900",
    letterSpacing: 2,
  },

  matchReason: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#444",
    fontWeight: "900",
    fontStyle: "italic",
    lineHeight: 24,
  },

  emptyCard: {
    borderWidth: 2,
    borderColor: "#111",
    padding: 28,
  },
  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#111",
    fontWeight: "900",
    lineHeight: 32,
  },
});
