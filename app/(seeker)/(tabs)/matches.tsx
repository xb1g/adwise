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

type ElderCard = {
  elder_id: string;
  story_id: string;
  rank: number;
  match_reason: string;
  bio: string;
  age_range: string;
  life_areas: string[];
  preview_text: string;
};

export default function SeekerMatchesTab() {
  const { user } = useAuth();
  const [cards, setCards] = useState<ElderCard[]>([]);
  const [subtitle, setSubtitle] = useState<string>("");
  const [problemText, setProblemText] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);

    // Fetch the latest match row for this seeker
    const { data: latestMatch } = await supabase
      .from("matches")
      .select("problem_text, result")
      .eq("seeker_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestMatch) {
      setCards([]);
      setLoading(false);
      return;
    }

    // Set subtitle from the problem text
    const problem = latestMatch.problem_text ?? "";
    setProblemText(problem);
    setSubtitle(problem.length > 60 ? problem.slice(0, 60) + "..." : problem);

    // Parse match results from JSONB
    const matchResults = latestMatch.result as Array<{
      elder_id: string;
      story_id: string;
      rank: number;
      match_reason: string;
    }>;

    if (!matchResults || matchResults.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const elderIds = matchResults.map((m) => m.elder_id);

    const { data: profiles } = await supabase
      .from("elder_profiles")
      .select("id, bio, age_range, life_areas")
      .in("id", elderIds);

    const { data: stories } = await supabase
      .from("stories")
      .select("elder_id, preview_text")
      .in("elder_id", elderIds)
      .eq("status", "published");

    const enriched = matchResults.map((m) => ({
      ...m,
      bio: profiles?.find((p) => p.id === m.elder_id)?.bio ?? "",
      age_range: profiles?.find((p) => p.id === m.elder_id)?.age_range ?? "",
      life_areas: profiles?.find((p) => p.id === m.elder_id)?.life_areas ?? [],
      preview_text:
        stories?.find((s) => s.elder_id === m.elder_id)?.preview_text ?? "",
    }));

    setCards(enriched);
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  if (!loading && cards.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptyText}>
          Describe your situation to find elders who've been there.
        </Text>
        <Pressable
          style={styles.emptyBtn}
          onPress={() => router.push("/(seeker)/problem")}
        >
          <Text style={styles.emptyBtnText}>Find matches</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your matches</Text>
      {subtitle ? (
        <Text style={styles.subtitle}>For: "{subtitle}"</Text>
      ) : null}

      {cards.map((card, index) => {
        const isBest = index === 0;
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
                  problemText: problemText,
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
          </Pressable>
        );
      })}

      <Pressable
        style={styles.newProblemBtn}
        onPress={() => router.push("/(seeker)/problem")}
      >
        <Text style={styles.newProblemText}>+ Describe a new problem</Text>
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
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDFFF5",
  },
  title: {
    fontSize: 28,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    opacity: 0.5,
    marginBottom: 28,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    padding: 16,
    marginBottom: 12,
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
  cardMeta: {
    flex: 1,
    gap: 6,
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
  newProblemBtn: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#111",
    borderRadius: 8,
  },
  newProblemText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    fontWeight: "700",
  },
  emptyTitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#111",
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#111",
  },
  emptyBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#111",
    fontWeight: "700",
  },
});
