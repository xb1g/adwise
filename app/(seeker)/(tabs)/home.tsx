import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = SCREEN_WIDTH - 32;

type Booking = {
  id: string;
  elder_id: string;
  problem_text: string;
  match_reason: string;
  status: string;
  created_at: string;
  elder_name: string;
  elder_age_range: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#FFF8E0", color: "#A68A00", label: "Pending" },
  confirmed: { bg: "#E8FFE0", color: "#2D7A0F", label: "Confirmed" },
  completed: { bg: "#F0F0F0", color: "#555", label: "Completed" },
  cancelled: { bg: "#FFE8E8", color: "#C0392B", label: "Cancelled" },
};

function SpotlightPlayer({ audioUri }: { audioUri: string }) {
  const player = useAudioPlayer(audioUri, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    return () => {
      try { player.pause(); } catch (e) {}
    };
  }, [player]);

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  function fmtTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <View style={voiceStyles.player}>
      <Pressable
        style={[voiceStyles.playCircle, status.playing && voiceStyles.playCircleActive]}
        onPress={() => (player.playing ? player.pause() : player.play())}
      >
        {status.isBuffering && !status.isLoaded ? (
          <ActivityIndicator color="#111" size="small" />
        ) : (
          <Text style={voiceStyles.playIcon}>
            {status.playing ? "⏸" : "▶"}
          </Text>
        )}
      </Pressable>
      <View style={voiceStyles.progressWrap}>
        <View style={voiceStyles.progressTrack}>
          <View style={[voiceStyles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={voiceStyles.timeRow}>
          <Text style={voiceStyles.timeText}>{fmtTime(status.currentTime)}</Text>
          <Text style={voiceStyles.timeText}>{fmtTime(status.duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const voiceStyles = StyleSheet.create({
  player: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#BFFF00",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#BFFF00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  playCircleActive: {
    shadowOpacity: 0.7,
    shadowRadius: 20,
  },
  playIcon: {
    fontSize: 24,
    color: "#111",
    marginLeft: 2,
  },
  progressWrap: {
    width: "100%",
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#E0E0D0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#BFFF00",
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 10,
    color: "#999",
  },
});

export default function HomeScreen() {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user])
  );

  async function loadData() {
    setLoading(true);

    const [storiesRes, bookingsRes] = await Promise.all([
      supabase
        .from("stories")
        .select(
          "id, elder_id, preview_text, wisdom_snippets, life_areas, tags, created_at, audio_url, elder_profiles!inner(name, bio, age_range, life_areas)"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(20),
      user
        ? supabase
            .from("bookings")
            .select("id, elder_id, problem_text, match_reason, status, created_at")
            .eq("seeker_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // Generate signed audio URLs for voice-first playback
    const rawStories = storiesRes.data ?? [];
    const enrichedStories = await Promise.all(
      rawStories.map(async (story: any) => {
        if (story.audio_url) {
          const { data: urlData } = await supabase.storage
            .from("story-audio")
            .createSignedUrl(story.audio_url, 3600);
          return { ...story, signedAudioUrl: urlData?.signedUrl ?? null };
        }
        return { ...story, signedAudioUrl: null };
      })
    );
    setStories(enrichedStories);

    // Enrich bookings with elder names
    const rawBookings = (bookingsRes.data ?? []) as any[];
    if (rawBookings.length > 0) {
      const elderIds = [...new Set(rawBookings.map((b: any) => b.elder_id))];
      const { data: profiles } = await supabase
        .from("elder_profiles")
        .select("id, name, age_range")
        .in("id", elderIds);

      setBookings(
        rawBookings.map((b: any) => {
          const p = profiles?.find((p) => p.id === b.elder_id);
          return {
            ...b,
            elder_name: p?.name ?? "",
            elder_age_range: p?.age_range ?? "",
          };
        })
      );
    } else {
      setBookings([]);
    }

    setLoading(false);
  }

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
              {stories.map((story, i) => (
                <View key={story.id} style={styles.storyCard}>
                  <View style={styles.storyCardTop}>
                    <Text style={styles.storyName}>
                      🎙 {story.elder_profiles?.name || "Elder"},{" "}
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
                  {/* Voice-first: inline audio player */}
                  {i === activeSlide && story.signedAudioUrl ? (
                    <SpotlightPlayer audioUri={story.signedAudioUrl} />
                  ) : story.signedAudioUrl ? (
                    <View style={styles.playPrompt}>
                      <Text style={styles.playPromptIcon}>▶</Text>
                      <Text style={styles.playPromptText}>swipe here to listen</Text>
                    </View>
                  ) : null}
                  <Text style={styles.storyPreview} numberOfLines={2}>
                    {story.preview_text}
                  </Text>
                  <Pressable onPress={() => navigateToElder(story)}>
                    <Text style={styles.readMore}>listen to their story →</Text>
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

        {/* Section B: Your bookings */}
        <Text style={styles.sectionLabel}>◈ your bookings</Text>
        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              no bookings yet — find a match and book a conversation
            </Text>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {bookings.map((b) => {
              const s = STATUS_STYLE[b.status] ?? STATUS_STYLE.pending;
              const shortProblem =
                b.problem_text.length > 60
                  ? b.problem_text.slice(0, 60) + "..."
                  : b.problem_text;
              return (
                <Pressable
                  key={b.id}
                  style={styles.bookingCard}
                  onPress={() =>
                    router.push({
                      pathname: "/(seeker)/elder/[id]",
                      params: { id: b.elder_id, matchReason: b.match_reason, problemText: b.problem_text },
                    })
                  }
                >
                  <View style={styles.bookingTop}>
                    <Text style={styles.bookingElder}>
                      {b.elder_name || "Elder"}
                      {b.elder_age_range ? `, ${b.elder_age_range}` : ""}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statusText, { color: s.color }]}>
                        {s.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bookingProblem} numberOfLines={2}>
                    {shortProblem}
                  </Text>
                  <Text style={styles.bookingDate}>
                    {new Date(b.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Section C: Dashboard */}
        <Text style={styles.sectionLabel}>◇ dashboard</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{bookings.length}</Text>
            <Text style={styles.statLabel}>bookings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stories.length}</Text>
            <Text style={styles.statLabel}>stories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {bookings.filter((b) => b.status === "confirmed").length}
            </Text>
            <Text style={styles.statLabel}>upcoming</Text>
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
                    {story.elder_profiles?.name || "Elder"} · {story.elder_profiles?.age_range ?? ""}
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
    paddingBottom: 100,
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

  /* Voice-first play prompt (inactive slides) */
  playPrompt: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 6,
  },
  playPromptIcon: {
    fontSize: 28,
    color: "#BFFF00",
  },
  playPromptText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#999",
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

  /* Bookings */
  bookingsList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  bookingCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  bookingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookingElder: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    fontWeight: "700",
  },
  bookingProblem: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
  },
  bookingDate: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.35,
  },
});
