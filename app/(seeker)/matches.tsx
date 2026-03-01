import { useLocalSearchParams, router } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { MatchResult } from "../../lib/ai";

type ElderCard = MatchResult & {
  bio: string;
  age_range: string;
  life_areas: string[];
  preview_text: string;
};

const MOCK_ELDERS: Record<string, Partial<ElderCard>> = {
  "mock-1": { bio: "Moved from the Philippines at 35 with $200. Became a registered nurse, raised three kids alone.", age_range: "60s", life_areas: ["immigration", "career", "family"], preview_text: "Left everything behind at 35 to start over in a new country — here's what she learned." },
  "mock-2": { bio: "Founded three companies — two failed. Spent five years in depression before finding purpose.", age_range: "70s", life_areas: ["startup", "failure", "reinvention"], preview_text: "Lost two companies, a marriage, and his savings — then built something that mattered." },
  "mock-3": { bio: "Spent 35 years in finance, then quit at 58 to write poetry — the dream he abandoned at 22.", age_range: "60s", life_areas: ["identity", "career", "immigration"], preview_text: "Spent 35 years in the wrong life — and had the courage to change it at 58." },
  "mock-4": { bio: "Lost his construction business in 2008, went bankrupt at 55, rebuilt to employ 30 people.", age_range: "70s", life_areas: ["financial-recovery", "career", "family"], preview_text: "Lost everything in 2008 at 55 and rebuilt from zero — twice." },
  "mock-5": { bio: "Stayed in a difficult marriage for 28 years, rebuilt from scratch at 55.", age_range: "60s", life_areas: ["marriage", "divorce", "reinvention"], preview_text: "Left a 28-year marriage at 55 and discovered who she actually was." },
};

export default function MatchesScreen() {
  const { matches: matchesParam, problem } = useLocalSearchParams<{ matches: string; problem: string }>();
  const [cards, setCards] = useState<ElderCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const matches: MatchResult[] = JSON.parse(matchesParam ?? "[]");
    loadElderData(matches);
  }, [matchesParam]);

  async function loadElderData(matches: MatchResult[]) {
    const elderIds = matches.map((m) => m.elder_id).filter((id) => !id.startsWith("mock-"));

    if (elderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("elder_profiles")
        .select("id, bio, age_range, life_areas")
        .in("id", elderIds);

      const { data: stories } = await supabase
        .from("stories")
        .select("elder_id, preview_text")
        .in("elder_id", elderIds)
        .eq("status", "published");

      const enriched: ElderCard[] = matches.map((m) => {
        const profile = profiles?.find((p) => p.id === m.elder_id);
        const story = stories?.find((s) => s.elder_id === m.elder_id);
        return {
          ...m,
          bio: profile?.bio ?? "",
          age_range: profile?.age_range ?? "",
          life_areas: profile?.life_areas ?? [],
          preview_text: story?.preview_text ?? "",
        };
      });

      setCards(enriched);
    } else {
      const enriched: ElderCard[] = matches.map((m) => ({
        ...m,
        ...(MOCK_ELDERS[m.elder_id] ?? {}),
        bio: MOCK_ELDERS[m.elder_id]?.bio ?? "",
        age_range: MOCK_ELDERS[m.elder_id]?.age_range ?? "",
        life_areas: MOCK_ELDERS[m.elder_id]?.life_areas ?? [],
        preview_text: MOCK_ELDERS[m.elder_id]?.preview_text ?? "",
      }));
      setCards(enriched);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Finding your elders...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Your top matches</Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        For: "{problem}"
      </Text>

      {cards.map((card, index) => (
        <Pressable
          key={card.elder_id}
          style={[styles.card, index === 0 && styles.cardBest]}
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
              },
            })
          }
        >
          {index === 0 && (
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
                {(card.life_areas ?? []).slice(0, 3).map((a) => (
                  <View key={a} style={styles.chip}>
                    <Text style={styles.chipText}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.bio} numberOfLines={2}>{card.bio}</Text>
          <Text style={styles.matchReason}>✦ {card.match_reason}</Text>
          <Text style={styles.cta}>Read their story →</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 48 },
  loadingContainer: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  loadingText: { fontFamily: "Orbit_400Regular", color: "#BFFF00", fontSize: 18 },
  back: { marginBottom: 24 },
  backText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", opacity: 0.5 },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 8 },
  subtitle: { fontSize: 13, fontFamily: "Orbit_400Regular", color: "#111", opacity: 0.5, marginBottom: 32, lineHeight: 20 },
  card: { borderWidth: 1.5, borderColor: "#111", padding: 20, marginBottom: 16 },
  cardBest: { borderColor: "#BFFF00", borderWidth: 2.5, backgroundColor: "#F8FFE0" },
  bestBadge: { backgroundColor: "#BFFF00", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, marginBottom: 12 },
  bestBadgeText: { fontFamily: "Orbit_400Regular", fontSize: 11, fontWeight: "700", color: "#111" },
  cardHeader: { flexDirection: "row", gap: 16, marginBottom: 12 },
  avatar: { width: 44, height: 44, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#BFFF00", fontFamily: "Orbit_400Regular", fontSize: 18, fontWeight: "700" },
  cardMeta: { flex: 1, gap: 8 },
  ageRange: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#111", paddingVertical: 2, paddingHorizontal: 8 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111" },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 22, marginBottom: 10 },
  matchReason: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#555", lineHeight: 20, marginBottom: 14, fontStyle: "italic" },
  cta: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", fontWeight: "700" },
});
