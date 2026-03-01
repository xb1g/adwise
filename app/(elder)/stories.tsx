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

type Story = {
  id: string;
  elder_id: string;
  preview_text: string;
  wisdom_snippets: string[];
  life_areas: string[];
  created_at: string;
  status: "processing" | "published";
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StoryCard({ story }: { story: Story }) {
  const firstSnippet = story.wisdom_snippets?.[0] ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(story.created_at)}</Text>
        {story.status === "processing" && (
          <View style={styles.processingBadge}>
            <Text style={styles.processingText}>processing</Text>
          </View>
        )}
      </View>

      {story.preview_text ? (
        <Text style={styles.previewText} numberOfLines={2} ellipsizeMode="tail">
          {story.preview_text}
        </Text>
      ) : null}

      {firstSnippet ? (
        <Text style={styles.snippet} numberOfLines={2} ellipsizeMode="tail">
          {`\u201C${firstSnippet}`}
        </Text>
      ) : null}

      {story.life_areas?.length > 0 ? (
        <View style={styles.chipRow}>
          {story.life_areas.map((area) => (
            <View key={area} style={styles.chip}>
              <Text style={styles.chipText}>{area}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function MyStories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: profileData } = await supabase
        .from("elder_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!profileData) {
        setLoading(false);
        return;
      }

      const { data: storiesData } = await supabase
        .from("stories")
        .select("id, elder_id, preview_text, wisdom_snippets, life_areas, created_at, status")
        .eq("elder_id", profileData.id)
        .order("created_at", { ascending: false });

      setStories(storiesData ?? []);
      setLoading(false);
    }

    load();
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
      {/* Header row */}
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={styles.recordBtn}
          onPress={() => router.push("/(elder)/record")}
        >
          <Text style={styles.recordBtnText}>Record new story →</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>My Stories</Text>

      {stories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No stories yet.{"\n"}Record your first one.
          </Text>
          <Pressable
            style={styles.recordBtnLarge}
            onPress={() => router.push("/(elder)/record")}
          >
            <Text style={styles.recordBtnLargeText}>Record your first story →</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
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

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {},
  backBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#111",
    fontWeight: "900",
  },
  recordBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: "#111",
  },
  recordBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    fontWeight: "900",
  },

  title: {
    fontFamily: "Orbit_400Regular",
    fontSize: 40,
    color: "#111",
    fontWeight: "900",
  },

  list: { gap: 20 },

  card: {
    borderWidth: 2,
    borderColor: "#111",
    padding: 20,
    backgroundColor: "#F0F2E8",
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardDate: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  processingBadge: {
    backgroundColor: "#111",
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  processingText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#FDFFF5",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  previewText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    fontWeight: "900",
    fontStyle: "italic",
    lineHeight: 28,
  },
  snippet: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#333",
    fontWeight: "900",
    lineHeight: 24,
    fontStyle: "italic",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 2,
    borderColor: "#111",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    fontWeight: "900",
  },

  emptyState: { alignItems: "center", marginTop: 40, gap: 28 },
  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#111",
    fontWeight: "900",
    lineHeight: 36,
    textAlign: "center",
  },
  recordBtnLarge: {
    backgroundColor: "#BFFF00",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#111",
  },
  recordBtnLargeText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    fontWeight: "900",
  },
});
