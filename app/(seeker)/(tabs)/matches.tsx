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

const MOCK_ELDERS: Record<string, Partial<ElderCard>> = {
  "mock-1": {
    bio: "Moved from the Philippines at 35 with $200. Became a registered nurse, raised three kids alone.",
    age_range: "60s",
    life_areas: ["immigration", "career", "family"],
    preview_text:
      "Left everything behind at 35 to start over in a new country — here's what she learned.",
  },
  "mock-2": {
    bio: "Founded three companies — two failed. Spent five years in depression before finding purpose.",
    age_range: "70s",
    life_areas: ["startup", "failure", "reinvention"],
    preview_text:
      "Lost two companies, a marriage, and his savings — then built something that mattered.",
  },
  "mock-3": {
    bio: "Spent 35 years in finance, then quit at 58 to write poetry — the dream he abandoned at 22.",
    age_range: "60s",
    life_areas: ["identity", "career", "immigration"],
    preview_text:
      "Spent 35 years in the wrong life — and had the courage to change it at 58.",
  },
  "mock-4": {
    bio: "Lost his construction business in 2008, went bankrupt at 55, rebuilt to employ 30 people.",
    age_range: "70s",
    life_areas: ["financial-recovery", "career", "family"],
    preview_text: "Lost everything in 2008 at 55 and rebuilt from zero — twice.",
  },
  "mock-5": {
    bio: "Stayed in a difficult marriage for 28 years, rebuilt from scratch at 55.",
    age_range: "60s",
    life_areas: ["marriage", "divorce", "reinvention"],
    preview_text: "Left a 28-year marriage at 55 and discovered who she actually was.",
  },
};

const MOCK_MATCHES = [
  {
    elder_id: "mock-3",
    story_id: "story-3",
    rank: 1,
    match_reason:
      "She rebuilt her identity from scratch after decades in the wrong career — exactly what you're navigating.",
  },
  {
    elder_id: "mock-2",
    story_id: "story-2",
    rank: 2,
    match_reason:
      "Lost two companies and a marriage, then found purpose — he knows what real reinvention costs.",
  },
  {
    elder_id: "mock-1",
    story_id: "story-1",
    rank: 3,
    match_reason:
      "Started over in a new country with nothing — she understands building identity from zero.",
  },
];

export default function SeekerMatchesTab() {
  const { user } = useAuth();
  const [cards, setCards] = useState<ElderCard[]>([]);
  const [subtitle, setSubtitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);

    // Load seeker problem / categories for subtitle
    const { data: seekerProfile } = await supabase
      .from("seeker_profiles")
      .select("categories, problem_text")
      .eq("user_id", user!.id)
      .single();

    if (seekerProfile?.categories?.length) {
      setSubtitle(seekerProfile.categories.slice(0, 2).join(", "));
    }

    // Build cards from mock matches + mock elder data
    const realElderIds = MOCK_MATCHES.map((m) => m.elder_id).filter(
      (id) => !id.startsWith("mock-")
    );

    let enriched: ElderCard[];

    if (realElderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("elder_profiles")
        .select("id, bio, age_range, life_areas")
        .in("id", realElderIds);

      const { data: stories } = await supabase
        .from("stories")
        .select("elder_id, preview_text")
        .in("elder_id", realElderIds)
        .eq("status", "published");

      enriched = MOCK_MATCHES.map((m) => {
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
    } else {
      enriched = MOCK_MATCHES.map((m) => ({
        ...m,
        bio: MOCK_ELDERS[m.elder_id]?.bio ?? "",
        age_range: MOCK_ELDERS[m.elder_id]?.age_range ?? "",
        life_areas: MOCK_ELDERS[m.elder_id]?.life_areas ?? [],
        preview_text: MOCK_ELDERS[m.elder_id]?.preview_text ?? "",
      }));
    }

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
    paddingBottom: 48,
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
});
