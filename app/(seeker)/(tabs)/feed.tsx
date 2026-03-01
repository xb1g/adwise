import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = SCREEN_WIDTH - 32;

export default function FeedScreen() {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  useEffect(() => {
    supabase
      .from("stories")
      .select(
        "id, elder_id, preview_text, wisdom_snippets, life_areas, tags, created_at, elder_profiles!inner(bio, age_range, life_areas)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setStories(data ?? []);
        setLoading(false);
      });
  }, []);

  function handleCarouselScroll(
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    setActiveSlide(index);
  }

  function navigateToElder(story: any) {
    router.push({
      pathname: "/(seeker)/elder/[id]",
      params: {
        id: story.elder_id,
        bio: story.elder_profiles?.bio,
        ageRange: story.elder_profiles?.age_range,
        lifeAreas: JSON.stringify(story.life_areas),
        previewText: story.preview_text,
        matchReason: "",
      },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BFFF00" />
          <Text style={styles.loadingText}>loading stories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLogo}>adwise</Text>
          <Text style={styles.headerBell}>🔔</Text>
        </View>

        {/* Section A: Spotlight Story Carousel */}
        <Text style={styles.sectionLabel}>✦ spotlight stories</Text>
        {stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              no stories yet — check back soon
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 12}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
            >
              {stories.map((story) => (
                <View key={story.id} style={styles.storyCard}>
                  <View style={styles.storyCardTop}>
                    <Text style={styles.storyName}>
                      Elder,{" "}
                      <Text style={styles.storyAgeRange}>
                        {story.elder_profiles?.age_range ?? ""}
                      </Text>
                    </Text>
                    <View style={styles.chipsRow}>
                      {(story.life_areas ?? []).map((area: string) => (
                        <View key={area} style={styles.chip}>
                          <Text style={styles.chipText}>{area}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Text style={styles.storyPreview}>
                    {story.preview_text}
                  </Text>
                  <Pressable onPress={() => navigateToElder(story)}>
                    <Text style={styles.readMore}>read their story →</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            {/* Pagination dots */}
            <View style={styles.dotsRow}>
              {stories.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === activeSlide ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          </>
        )}

        {/* Section B: Dashboard */}
        <Text style={styles.sectionLabel}>◈ your dashboard</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stories.length}</Text>
            <Text style={styles.statLabel}>stories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {stories.length > 0
                ? stories.filter(
                    (s) =>
                      Date.now() - new Date(s.created_at).getTime() <
                      7 * 24 * 60 * 60 * 1000
                  ).length
                : 0}
            </Text>
            <Text style={styles.statLabel}>new this week</Text>
          </View>
        </View>

        {/* Section C: Story feed */}
        <Text style={styles.sectionLabel}>✦ story feed</Text>
        {stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              no stories to show yet
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {stories.map((story) => (
              <Pressable
                key={story.id}
                style={styles.feedRow}
                onPress={() => navigateToElder(story)}
              >
                <Text style={styles.feedPrefix}>✦ </Text>
                <View style={styles.feedTextBlock}>
                  <Text style={styles.feedName}>
                    Elder · {story.elder_profiles?.age_range ?? ""}
                  </Text>
                  <Text style={styles.feedPreview} numberOfLines={1}>
                    {story.preview_text}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FDFFF5",
  },
  container: {
    flex: 1,
    backgroundColor: "#FDFFF5",
  },
  contentContainer: {
    paddingBottom: 32,
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#555",
  },

  /* Empty state */
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLogo: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#111",
    fontWeight: "400",
  },
  headerBell: {
    fontSize: 20,
  },

  /* Section labels */
  sectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#555",
    letterSpacing: 1,
    textTransform: "lowercase",
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 20,
  },

  /* Carousel */
  carouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  storyCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginRight: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: "space-between",
    minHeight: 180,
  },
  storyCardTop: {
    marginBottom: 12,
  },
  storyName: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#111",
    fontWeight: "700",
    marginBottom: 8,
  },
  storyAgeRange: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#555",
    fontWeight: "400",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "#FDFFF5",
    borderWidth: 1,
    borderColor: "#BFFF00",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 10,
    color: "#111",
  },
  storyPreview: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#444",
    fontStyle: "italic",
    lineHeight: 20,
    marginBottom: 14,
  },
  readMore: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#BFFF00",
    fontWeight: "700",
  },

  /* Dots */
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#BFFF00",
  },
  dotInactive: {
    backgroundColor: "#DDD",
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statNumber: {
    fontFamily: "Orbit_400Regular",
    fontSize: 36,
    color: "#111",
    fontWeight: "700",
    lineHeight: 42,
  },
  statLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#555",
    marginTop: 2,
  },

  /* Feed list */
  feedList: {
    paddingHorizontal: 16,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0D0",
  },
  feedPrefix: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#BFFF00",
    marginTop: 1,
    marginRight: 4,
  },
  feedTextBlock: {
    flex: 1,
  },
  feedName: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    fontWeight: "700",
    marginBottom: 3,
  },
  feedPreview: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
});
