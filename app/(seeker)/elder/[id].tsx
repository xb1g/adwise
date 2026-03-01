import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";

const BOOKING_PRICE = 10;
const PLATFORM_FEE_PERCENT = 10;
const ELDER_PAYOUT_PERCENT = 100 - PLATFORM_FEE_PERCENT;
const ELDER_PAYOUT = BOOKING_PRICE * (ELDER_PAYOUT_PERCENT / 100);

type Story = {
  id: string;
  preview_text: string;
  transcript: string;
  life_areas: string[];
  key_topics: string[];
  wisdom_snippets: string[];
  tags: string[];
  status: string;
  audio_url: string | null;
  created_at: string;
};

type ElderProfile = {
  name: string;
  bio: string;
  age_range: string;
  life_areas: string[];
  key_topics: string[];
  wisdom_summary: string;
};

async function ensureSeekerProfileName(userId: string, fallbackName: string | null | undefined) {
  const trimmedName = fallbackName?.trim();
  if (!trimmedName) return;

  try {
    const { data: existingProfile, error: existingError } = await supabase
      .from("seeker_profiles")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      console.error("[elder detail] check seeker profile failed:", existingError);
      return;
    }

    if (existingProfile?.name?.trim()) return;

    await supabase
      .from("seeker_profiles")
      .upsert({ user_id: userId, name: trimmedName }, { onConflict: "user_id" });
  } catch (err) {
    console.error("[elder detail] ensure seeker profile name failed:", err);
  }
}

function StoryAudioPlayer({ audioPath }: { audioPath: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.storage
        .from("story-audio")
        .createSignedUrl(audioPath, 3600);
      if (!error && data?.signedUrl) setSignedUrl(data.signedUrl);
    })();
  }, [audioPath]);

  if (!signedUrl) return <ActivityIndicator color="#BFFF00" size="small" style={{ marginTop: 8 }} />;
  return <StoryAudioControls uri={signedUrl} />;
}

function StoryAudioControls({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  const mins = Math.floor(status.currentTime / 60);
  const secs = Math.floor(status.currentTime % 60);
  const totalMins = Math.floor(status.duration / 60);
  const totalSecs = Math.floor(status.duration % 60);

  return (
    <View style={styles.audioBox}>
      <View style={styles.audioTrack}>
        <View style={[styles.audioFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.audioRow}>
        <Pressable
          style={styles.audioPlayBtn}
          onPress={() => (status.playing ? player.pause() : player.play())}
        >
          {status.isBuffering && !status.isLoaded ? (
            <ActivityIndicator color="#111" size="small" />
          ) : (
            <Text style={styles.audioPlayText}>{status.playing ? "⏸" : "▶"}</Text>
          )}
        </Pressable>
        <Text style={styles.audioTime}>
          {mins}:{secs.toString().padStart(2, "0")} / {totalMins}:{totalSecs.toString().padStart(2, "0")}
        </Text>
      </View>
    </View>
  );
}

export default function ElderDetail() {
  const { id, matchReason, problemText } =
    useLocalSearchParams<{
      id: string;
      storyId: string;
      matchReason: string;
      bio: string;
      ageRange: string;
      lifeAreas: string;
      previewText: string;
      problemText: string;
      elderName: string;
    }>();

  const { user } = useAuth();
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [booking, setBooking] = useState(false);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadElderData();
  }, [id]);

  async function loadElderData() {
    setLoadingData(true);

    const [profileRes, storiesRes, bookingsRes] = await Promise.all([
      supabase
        .from("elder_profiles")
        .select("name, bio, age_range, life_areas, key_topics, wisdom_summary")
        .eq("id", id)
        .single(),
      supabase
        .from("stories")
        .select("id, preview_text, transcript, life_areas, key_topics, wisdom_snippets, tags, status, audio_url, created_at")
        .eq("elder_id", id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("elder_id", id)
        .in("status", ["confirmed", "completed"]),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (storiesRes.data) setStories(storiesRes.data);
    setBookingCount(bookingsRes.count ?? 0);
    setLoadingData(false);
  }

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    };
  });

  const TIME_SLOTS = ["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM"];

  async function handleBook() {
    if (!user || !selectedDate || !selectedSlot) return;
    setBooking(true);
    try {
      const fallbackName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0];
      await ensureSeekerProfileName(user.id, fallbackName);

      const { error } = await supabase.from("bookings").insert({
        elder_id: id,
        seeker_id: user.id,
        problem_text: problemText ?? "",
        match_reason: matchReason ?? "",
        scheduled_date: selectedDate,
        scheduled_time: selectedSlot,
        status: "pending",
      });
      if (error) throw error;

      const dateLabel = dates.find((d) => d.key === selectedDate)?.label ?? selectedDate;
      Alert.alert(
        "Booking requested!",
        `${profile?.name || "The elder"} will be notified.\n\n${dateLabel} at ${selectedSlot} (30 min)`,
        [{ text: "Done" }]
      );
      setSelectedDate(null);
      setSelectedSlot(null);
    } catch (err) {
      Alert.alert("Error", "Couldn't complete booking. Try again.");
    } finally {
      setBooking(false);
    }
  }

  if (loadingData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  const allTopics = Array.from(
    new Set([
      ...(profile?.key_topics ?? []),
      ...stories.flatMap((s) => s.key_topics),
    ])
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back to matches</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>
            {profile?.name ? profile.name[0].toUpperCase() : "◎"}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          {profile?.name ? (
            <Text style={styles.elderName}>{profile.name}</Text>
          ) : null}
          <Text style={styles.ageRange}>{profile?.age_range}</Text>
          <View style={styles.chipRow}>
            {(profile?.life_areas ?? []).map((a) => (
              <View key={a} style={styles.chip}>
                <Text style={styles.chipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{stories.length}</Text>
          <Text style={styles.statLabel}>
            {stories.length === 1 ? "Story" : "Stories"}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{allTopics.length}</Text>
          <Text style={styles.statLabel}>Topics</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{bookingCount}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNum}>
            {(profile?.life_areas ?? []).length}
          </Text>
          <Text style={styles.statLabel}>Life areas</Text>
        </View>
      </View>

      {/* Match reason */}
      {matchReason ? (
        <View style={styles.matchBox}>
          <Text style={styles.sectionLabel}>Why you matched</Text>
          <Text style={styles.matchReason}>{matchReason}</Text>
        </View>
      ) : null}

      {/* Bio */}
      {profile?.bio ? (
        <>
          <Text style={styles.sectionLabel}>About</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </>
      ) : null}

      {/* Wisdom summary */}
      {profile?.wisdom_summary ? (
        <>
          <Text style={styles.sectionLabel}>Wisdom summary</Text>
          <Text style={styles.wisdomSummary}>{profile.wisdom_summary}</Text>
        </>
      ) : null}

      {/* Topics */}
      {allTopics.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Topics</Text>
          <View style={styles.topicsRow}>
            {allTopics.map((t) => (
              <View key={t} style={styles.topicChip}>
                <Text style={styles.topicChipText}>{t}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Stories list */}
      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>
        Stories ({stories.length})
      </Text>
      {stories.length === 0 ? (
        <Text style={styles.emptyStories}>No published stories yet.</Text>
      ) : (
        stories.map((story) => {
          const isExpanded = expandedStory === story.id;
          return (
            <Pressable
              key={story.id}
              style={[styles.storyCard, isExpanded && styles.storyCardExpanded]}
              onPress={() =>
                setExpandedStory(isExpanded ? null : story.id)
              }
            >
              <View style={styles.storyHeader}>
                <View style={styles.storyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.storyPreview} numberOfLines={isExpanded ? undefined : 2}>
                    {story.preview_text}
                  </Text>
                </View>
                {story.audio_url ? (
                  <Text style={styles.audioIcon}>🔊</Text>
                ) : null}
                <Text style={styles.storyToggle}>
                  {isExpanded ? "−" : "+"}
                </Text>
              </View>

              {/* Life areas */}
              {story.life_areas.length > 0 ? (
                <View style={styles.storyChipRow}>
                  {story.life_areas.map((a) => (
                    <View key={a} style={styles.storyAreaChip}>
                      <Text style={styles.storyAreaText}>{a}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {isExpanded ? (
                <View style={styles.storyExpanded}>
                  {/* Audio player */}
                  {story.audio_url ? (
                    <StoryAudioPlayer audioPath={story.audio_url} />
                  ) : null}

                  {/* Key topics */}
                  {story.key_topics.length > 0 ? (
                    <View style={styles.storySection}>
                      <Text style={styles.storySectionLabel}>Topics</Text>
                      <View style={styles.storyChipRow}>
                        {story.key_topics.map((t) => (
                          <View key={t} style={styles.storyTopicChip}>
                            <Text style={styles.storyTopicText}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* Wisdom snippets */}
                  {story.wisdom_snippets.length > 0 ? (
                    <View style={styles.storySection}>
                      <Text style={styles.storySectionLabel}>Key wisdom</Text>
                      {story.wisdom_snippets.map((w, i) => (
                        <View key={i} style={styles.wisdomRow}>
                          <Text style={styles.wisdomBullet}>✦</Text>
                          <Text style={styles.wisdomText}>{w}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Tags */}
                  {story.tags.length > 0 ? (
                    <View style={styles.storySection}>
                      <Text style={styles.storySectionLabel}>Tags</Text>
                      <View style={styles.storyChipRow}>
                        {story.tags.map((t) => (
                          <View key={t} style={styles.storyTagChip}>
                            <Text style={styles.storyTagText}>#{t}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* Transcript preview */}
                  {story.transcript ? (
                    <View style={styles.storySection}>
                      <Text style={styles.storySectionLabel}>Transcript</Text>
                      <Text style={styles.transcriptText} numberOfLines={6}>
                        {story.transcript}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.storyDate}>
                {new Date(story.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </Pressable>
          );
        })
      )}

      {/* Book a time */}
      <Text style={[styles.sectionLabel, { marginTop: 32 }]}>Book a 30-min conversation</Text>

      {/* Date picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
        {dates.map((d) => (
          <Pressable
            key={d.key}
            style={[styles.dateChip, selectedDate === d.key && styles.dateChipSelected]}
            onPress={() => { setSelectedDate(d.key); setSelectedSlot(null); }}
          >
            <Text style={[styles.dateChipText, selectedDate === d.key && styles.dateChipTextSelected]}>
              {d.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Time slots */}
      {selectedDate ? (
        <View style={styles.slotsRow}>
          {TIME_SLOTS.map((slot) => (
            <Pressable
              key={slot}
              style={[styles.slotChip, selectedSlot === slot && styles.slotChipSelected]}
              onPress={() => setSelectedSlot(slot)}
            >
              <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextSelected]}>
                {slot}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Confirm button */}
      <Pressable
        style={[styles.bookBtn, (!selectedDate || !selectedSlot || booking) && styles.bookBtnDisabled]}
        onPress={handleBook}
        disabled={!selectedDate || !selectedSlot || booking}
      >
        {booking ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={styles.bookBtnText}>
            {selectedDate && selectedSlot
              ? `Confirm ${selectedSlot} — $${BOOKING_PRICE}`
              : `Select a date & time — $${BOOKING_PRICE}`}
          </Text>
        )}
      </Pressable>

      <Text style={styles.bookNote}>
        Elders earn ${ELDER_PAYOUT} ({ELDER_PAYOUT_PERCENT}%) per booking.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 80 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FDFFF5" },
  back: { marginBottom: 28 },
  backText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.5 },

  header: { flexDirection: "row", gap: 16, alignItems: "flex-start", marginBottom: 24 },
  avatar: {
    width: 56,
    height: 56,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  avatarEmoji: { color: "#BFFF00", fontSize: 22, fontFamily: "Orbit_400Regular", fontWeight: "700" },
  headerInfo: { flex: 1, gap: 4 },
  elderName: { fontFamily: "Orbit_400Regular", fontSize: 20, fontWeight: "700", color: "#111" },
  ageRange: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: "#111", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 3 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111" },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    padding: 16,
    marginBottom: 28,
    alignItems: "center",
  },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontFamily: "Orbit_400Regular", fontSize: 20, fontWeight: "700", color: "#111" },
  statLabel: { fontFamily: "Orbit_400Regular", fontSize: 10, color: "#111", opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: "#E0E0D8" },

  matchBox: { backgroundColor: "#F0FFD4", padding: 16, marginBottom: 24, gap: 6, borderRadius: 8 },
  sectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.5,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  matchReason: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 22 },

  bio: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 26, marginBottom: 24 },
  wisdomSummary: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#333",
    lineHeight: 24,
    marginBottom: 24,
    fontStyle: "italic",
  },

  topicsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  topicChip: {
    backgroundColor: "#F0FFD4",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  topicChipText: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#333" },

  storyCard: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  storyCardExpanded: {
    borderColor: "#BFFF00",
    backgroundColor: "#FCFFF5",
  },
  storyHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  storyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#BFFF00",
    marginTop: 6,
  },
  storyPreview: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 22 },
  storyToggle: { fontFamily: "Orbit_400Regular", fontSize: 18, color: "#111", opacity: 0.4 },
  storyChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 18 },
  storyAreaChip: {
    backgroundColor: "#F0FFD4",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  storyAreaText: { fontFamily: "Orbit_400Regular", fontSize: 10, color: "#444" },
  storyExpanded: { gap: 14, paddingLeft: 18, paddingTop: 4 },
  storySection: { gap: 6 },
  storySectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 10,
    color: "#111",
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  storyTopicChip: {
    borderWidth: 1,
    borderColor: "#CCC",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  storyTopicText: { fontFamily: "Orbit_400Regular", fontSize: 10, color: "#666" },
  wisdomRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  wisdomBullet: { fontSize: 12, color: "#9FE800", marginTop: 1 },
  wisdomText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#222", lineHeight: 20, flex: 1 },
  storyTagChip: {
    backgroundColor: "#F5F5F0",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  storyTagText: { fontFamily: "Orbit_400Regular", fontSize: 10, color: "#888" },
  transcriptText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#444",
    lineHeight: 21,
    fontStyle: "italic",
    backgroundColor: "#F9F9F5",
    padding: 12,
    borderRadius: 6,
  },
  storyDate: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.35,
    paddingLeft: 18,
  },
  emptyStories: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#999",
    marginBottom: 16,
  },

  bookBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 8,
    marginTop: 32,
    borderWidth: 2,
    borderColor: "#111",
  },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText: { fontFamily: "Orbit_400Regular", fontSize: 15, fontWeight: "700", color: "#111" },
  bookNote: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#111",
    opacity: 0.5,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },

  // Audio player
  audioIcon: { fontSize: 14, marginRight: 4, opacity: 0.5 },

  // Date & time booking
  dateScroll: { marginBottom: 12 },
  dateChip: {
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    backgroundColor: "#FFF",
  },
  dateChipSelected: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  dateChipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
  },
  dateChipTextSelected: {
    color: "#BFFF00",
  },
  slotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  slotChip: {
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "#FFF",
  },
  slotChipSelected: {
    borderColor: "#BFFF00",
    backgroundColor: "#F0FFD4",
  },
  slotText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    fontWeight: "700",
  },
  slotTextSelected: {
    color: "#111",
  },
  audioBox: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 8,
    gap: 10,
  },
  audioTrack: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
  },
  audioFill: {
    height: 4,
    backgroundColor: "#BFFF00",
    borderRadius: 2,
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#BFFF00",
    alignItems: "center",
    justifyContent: "center",
  },
  audioPlayText: {
    fontSize: 14,
    color: "#111",
  },
  audioTime: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#FDFFF5",
    opacity: 0.6,
  },
});
