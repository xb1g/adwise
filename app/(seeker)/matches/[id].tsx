import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";

type ElderCard = {
  elder_id: string;
  story_id: string;
  rank: number;
  match_reason: string;
  name: string;
  bio: string;
  age_range: string;
  life_areas: string[];
  preview_text: string;
};

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [cards, setCards] = useState<ElderCard[]>([]);
  const [problemText, setProblemText] = useState("");
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadMatch();
  }, [id]);

  async function loadMatch() {
    setLoading(true);

    const { data: match } = await supabase
      .from("matches")
      .select("problem_text, result")
      .eq("id", id)
      .single();

    if (!match) {
      setCards([]);
      setLoading(false);
      return;
    }

    setProblemText(match.problem_text ?? "");

    const results = (match.result ?? []) as Array<{
      elder_id: string;
      story_id: string;
      rank: number;
      match_reason: string;
    }>;

    if (results.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const elderIds = results.map((m) => m.elder_id);

    const [{ data: profiles }, { data: stories }] = await Promise.all([
      supabase
        .from("elder_profiles")
        .select("id, name, bio, age_range, life_areas")
        .in("id", elderIds),
      supabase
        .from("stories")
        .select("elder_id, preview_text")
        .in("elder_id", elderIds)
        .eq("status", "published"),
    ]);

    const enriched: ElderCard[] = results.map((m) => ({
      ...m,
      name: profiles?.find((p) => p.id === m.elder_id)?.name ?? "",
      bio: profiles?.find((p) => p.id === m.elder_id)?.bio ?? "",
      age_range: profiles?.find((p) => p.id === m.elder_id)?.age_range ?? "",
      life_areas: profiles?.find((p) => p.id === m.elder_id)?.life_areas ?? [],
      preview_text:
        stories?.find((s) => s.elder_id === m.elder_id)?.preview_text ?? "",
    }));

    setCards(enriched);
    setLoading(false);
  }

  async function handleBook(card: ElderCard) {
    if (!user) return;
    setBookingId(card.elder_id);
    try {
      const { error } = await supabase.from("bookings").insert({
        elder_id: card.elder_id,
        seeker_id: user.id,
        problem_text: problemText,
        match_reason: card.match_reason,
        status: "pending",
      });
      if (error) throw error;
      Alert.alert(
        "Booking requested!",
        `${card.name || "The elder"} will be notified and reach out to schedule your conversation.`,
        [{ text: "Done" }]
      );
    } catch {
      Alert.alert("Error", "Couldn't complete booking. Try again.");
    } finally {
      setBookingId(null);
    }
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
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Situations</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Your situation</Text>
      <Text style={styles.problem}>"{problemText}"</Text>

      <Text style={styles.matchesLabel}>
        {cards.length} {cards.length === 1 ? "elder" : "elders"} matched
      </Text>

      {cards.map((card, index) => {
        const isBest = index === 0;
        const isBooking = bookingId === card.elder_id;

        return (
          <Pressable
            key={card.elder_id}
            style={[styles.card, isBest && styles.cardBest]}
            onPress={() =>
              router.push({
                pathname: "/(seeker)/elder/[id]",
                params: {
                  id: card.elder_id,
                  storyId: card.story_id,
                  matchReason: card.match_reason,
                  bio: card.bio,
                  ageRange: card.age_range,
                  lifeAreas: JSON.stringify(card.life_areas),
                  previewText: card.preview_text,
                  problemText,
                  elderName: card.name,
                },
              })
            }
          >
            {isBest && (
              <View style={styles.bestBadge}>
                <Text style={styles.bestBadgeText}>Best Match</Text>
              </View>
            )}

            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{index + 1}</Text>
              </View>
              <View style={styles.cardMeta}>
                {card.name ? (
                  <Text style={styles.elderName}>{card.name}</Text>
                ) : null}
                <Text style={styles.ageRange}>{card.age_range}</Text>
                <View style={styles.chipRow}>
                  {(card.life_areas ?? []).slice(0, 3).map((area) => (
                    <View key={area} style={styles.chip}>
                      <Text style={styles.chipText}>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={styles.viewCta}>view →</Text>
            </View>

            <Text style={styles.bio} numberOfLines={2}>
              {card.bio}
            </Text>
            <Text style={styles.matchReason}>✦ {card.match_reason}</Text>

            <Pressable
              style={[styles.bookBtn, isBooking && styles.bookBtnDisabled]}
              disabled={isBooking}
              onPress={(e) => {
                e.stopPropagation();
                handleBook(card);
              }}
            >
              {isBooking ? (
                <ActivityIndicator color="#111" size="small" />
              ) : (
                <Text style={styles.bookBtnText}>Book</Text>
              )}
            </Pressable>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 100 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDFFF5",
  },
  back: { marginBottom: 28 },
  backText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    opacity: 0.5,
  },
  sectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.5,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  problem: {
    fontFamily: "Orbit_400Regular",
    fontSize: 17,
    color: "#111",
    lineHeight: 26,
    marginBottom: 28,
  },
  matchesLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    opacity: 0.6,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardBest: {
    borderWidth: 2,
    borderColor: "#BFFF00",
    backgroundColor: "#F8FFE0",
  },
  bestBadge: {
    backgroundColor: "#BFFF00",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 12,
  },
  bestBadgeText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    fontWeight: "700",
    color: "#111",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  avatarText: {
    color: "#BFFF00",
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    fontWeight: "700",
  },
  cardMeta: { flex: 1, gap: 4 },
  elderName: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  ageRange: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    opacity: 0.6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    borderWidth: 1,
    borderColor: "#111",
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 3,
  },
  chipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 10,
    color: "#111",
  },
  viewCta: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    fontWeight: "700",
    alignSelf: "center",
  },
  bio: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    lineHeight: 22,
    marginBottom: 8,
  },
  matchReason: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
    fontStyle: "italic",
  },
  bookBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
    marginTop: 12,
  },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
});
