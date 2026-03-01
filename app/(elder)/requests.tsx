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

type ElderRequest = {
  id: string;
  elder_id: string;
  seeker_id: string;
  problem_text: string;
  match_reason: string;
  rank: number;
  created_at: string;
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

function RequestCard({ request }: { request: ElderRequest }) {
  const isTopRank = request.rank === 1;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.rankBadge, isTopRank && styles.rankBadgeAccent]}>
          <Text style={[styles.rankText, isTopRank && styles.rankTextAccent]}>
            #{request.rank}
          </Text>
        </View>
        <Text style={styles.timestamp}>{formatDate(request.created_at)}</Text>
      </View>

      <Text style={styles.problemText} numberOfLines={3}>
        {request.problem_text}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.matchLabel}>WHY YOU MATCHED</Text>
      <Text style={styles.matchReason} numberOfLines={3}>
        {request.match_reason}
      </Text>
    </View>
  );
}

export default function WisdomRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ElderRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchRequests() {
      const { data: profileData } = await supabase
        .from("elder_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!profileData) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("elder_requests")
        .select("*")
        .eq("elder_id", profileData.id)
        .order("created_at", { ascending: false });

      setRequests(data ?? []);
      setLoading(false);
    }

    fetchRequests();
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

      <Text style={styles.title}>Wisdom{"\n"}Requests</Text>

      {requests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No requests yet. When seekers match with you, they'll appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {requests.map((req) => (
            <RequestCard key={req.id} request={req} />
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

  rankBadge: {
    borderWidth: 2,
    borderColor: "#111",
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#FDFFF5",
  },
  rankBadgeAccent: {
    backgroundColor: "#BFFF00",
    borderColor: "#111",
  },
  rankText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    fontWeight: "900",
    color: "#111",
  },
  rankTextAccent: {
    color: "#111",
  },

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
