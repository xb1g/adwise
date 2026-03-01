import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";

type RequestDetail = {
  id: string;
  seeker_id: string;
  problem_text: string;
  match_reason: string;
  rank: number;
  created_at: string;
};

type SeekerProfile = {
  name: string | null;
  age_range: string | null;
  categories: string[] | null;
  problem_text: string | null;
  onboarding_done: boolean | null;
  phone: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [seeker, setSeeker] = useState<SeekerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    loadData();
  }, [user, id]);

  async function loadData() {
    setLoading(true);

    const { data: elderProfile } = await supabase
      .from("elder_profiles")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!elderProfile) {
      setLoading(false);
      return;
    }

    const { data: reqData } = await supabase
      .from("elder_requests")
      .select("id, seeker_id, problem_text, match_reason, rank, created_at")
      .eq("id", id)
      .eq("elder_id", elderProfile.id)
      .single();

    if (!reqData) {
      setLoading(false);
      return;
    }

    setRequest(reqData);

    const { data: seekerData } = await supabase
      .from("seeker_profiles")
      .select("name, age_range, categories, problem_text, onboarding_done, phone")
      .eq("user_id", reqData.seeker_id)
      .maybeSingle();

    setSeeker(seekerData ?? null);
    setLoading(false);
  }

  function handleCall() {
    if (!seeker?.phone) {
      Alert.alert("No phone number", "This seeker hasn't added a phone number yet.");
      return;
    }
    Linking.openURL(`tel:${seeker.phone}`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Request not found.</Text>
      </View>
    );
  }

  const displayName = seeker?.name?.trim() || "Seeker";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>

      {/* Seeker header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {displayName[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.seekerName}>{displayName}</Text>
          {seeker?.age_range ? (
            <Text style={styles.ageRange}>Age {seeker.age_range}</Text>
          ) : null}
        </View>
      </View>

      {/* Categories */}
      {seeker?.categories && seeker.categories.length > 0 ? (
        <View style={styles.chipRow}>
          {seeker.categories.map((c) => (
            <View key={c} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Rank + date */}
      <View style={styles.metaRow}>
        <View style={[styles.rankBadge, request.rank === 1 && styles.rankBadgeAccent]}>
          <Text style={styles.rankText}>Match #{request.rank}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(request.created_at)}</Text>
      </View>

      {/* Seeker's problem */}
      {seeker?.problem_text ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THEIR SITUATION</Text>
          <Text style={styles.sectionBody}>{seeker.problem_text}</Text>
        </View>
      ) : null}

      {/* Request problem */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>WHAT THEY ASKED</Text>
        <Text style={styles.sectionBody}>{request.problem_text}</Text>
      </View>

      {/* Match reason */}
      {request.match_reason?.trim() ? (
        <View style={styles.matchBox}>
          <Text style={styles.sectionLabel}>WHY YOU WERE MATCHED</Text>
          <Text style={styles.matchReason}>{request.match_reason}</Text>
        </View>
      ) : null}

      {/* Call button */}
      <Pressable style={styles.callBtn} onPress={handleCall}>
        <Text style={styles.callBtnText}>📞  Call {displayName}</Text>
      </Pressable>

      {!seeker?.phone ? (
        <Text style={styles.noPhoneNote}>
          No phone number on file yet.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 80, gap: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FDFFF5" },

  backBtn: { marginBottom: 8 },
  backBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    opacity: 0.5,
  },

  header: { flexDirection: "row", gap: 16, alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  avatarLetter: {
    color: "#BFFF00",
    fontSize: 22,
    fontFamily: "Orbit_400Regular",
    fontWeight: "700",
  },
  headerInfo: { flex: 1, gap: 2 },
  seekerName: {
    fontFamily: "Orbit_400Regular",
    fontSize: 28,
    fontWeight: "900",
    color: "#111",
  },
  ageRange: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#666",
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111" },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rankBadge: {
    borderWidth: 2,
    borderColor: "#111",
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "#FDFFF5",
  },
  rankBadgeAccent: { backgroundColor: "#BFFF00" },
  rankText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    fontWeight: "900",
    color: "#111",
  },
  dateText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#666",
  },

  section: { gap: 8 },
  sectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    fontWeight: "900",
    letterSpacing: 2,
  },
  sectionBody: {
    fontFamily: "Orbit_400Regular",
    fontSize: 17,
    color: "#111",
    lineHeight: 28,
  },

  matchBox: {
    backgroundColor: "#F0FFD4",
    padding: 16,
    gap: 8,
    borderRadius: 8,
  },
  matchReason: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#333",
    fontStyle: "italic",
    lineHeight: 24,
  },

  callBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#111",
    marginTop: 12,
  },
  callBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  noPhoneNote: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },

  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
  },
});
