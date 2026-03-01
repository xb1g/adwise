import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { supabase } from "../../lib/supabase";

type Story = {
  id: string;
  elder_id: string;
  preview_text: string;
  wisdom_snippets: string[];
  life_areas: string[];
  created_at: string;
  audio_url: string | null;
  status: "processing" | "published";
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function PlayerControls({
  audioUri,
  storyId,
}: {
  audioUri: string;
  storyId: string;
}) {
  console.log("[story-player] PlayerControls mount, uri:", audioUri);

  const player = useAudioPlayer(audioUri, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  // Direct event listener for raw status updates
  useEffect(() => {
    console.log("[story-player] attaching playbackStatusUpdate listener");
    const sub = player.addListener("playbackStatusUpdate", (s) => {
      console.log("[story-player] RAW status:", JSON.stringify({
        isLoaded: s.isLoaded,
        playing: s.playing,
        isBuffering: s.isBuffering,
        duration: s.duration,
        currentTime: s.currentTime,
        playbackState: s.playbackState,
        timeControlStatus: s.timeControlStatus,
        reasonForWaitingToPlay: s.reasonForWaitingToPlay,
      }));
    });
    return () => sub.remove();
  }, [player]);

  // Also log direct player properties
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[story-player] POLL player:", {
        isLoaded: player.isLoaded,
        playing: player.playing,
        paused: player.paused,
        duration: player.duration,
        currentTime: player.currentTime,
        isBuffering: player.isBuffering,
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [player]);

  function handlePlay() {
    console.log("[story-player] PLAY pressed — player.isLoaded:", player.isLoaded, "player.playing:", player.playing, "status.isLoaded:", status.isLoaded);
    try {
      if (player.playing) {
        player.pause();
        console.log("[story-player] pause() called OK");
      } else {
        player.play();
        console.log("[story-player] play() called OK");
      }
    } catch (err) {
      console.error("[story-player] play/pause ERROR:", err);
    }
  }

  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;
  const minutes = Math.floor(status.currentTime / 60);
  const seconds = Math.floor(status.currentTime % 60);
  const totalMin = Math.floor(status.duration / 60);
  const totalSec = Math.floor(status.duration % 60);

  return (
    <View style={styles.playerBox}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {minutes}:{seconds.toString().padStart(2, "0")}
        </Text>
        <Text style={styles.timeText}>
          {totalMin}:{totalSec.toString().padStart(2, "0")}
        </Text>
      </View>

      {/* Play button — always enabled, let player handle state */}
      <Pressable style={styles.bigPlayBtn} onPress={handlePlay}>
        {status.isBuffering && !status.isLoaded ? (
          <ActivityIndicator color="#111" size="small" />
        ) : (
          <Text style={styles.bigPlayText}>
            {status.playing ? "⏸  Pause" : "▶  Play"}
          </Text>
        )}
      </Pressable>

      {/* Debug info */}
      <Text style={styles.debugText}>
        {status.isLoaded ? "loaded" : "loading..."} ·{" "}
        {status.isBuffering ? "buffering" : "ready"} ·{" "}
        {status.playbackState} · {status.timeControlStatus}
      </Text>
    </View>
  );
}

export default function StoryPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      console.log("[story-player] loading story:", id);
      const { data, error } = await supabase
        .from("stories")
        .select(
          "id, elder_id, preview_text, wisdom_snippets, life_areas, created_at, status, audio_url"
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[story-player] DB error:", error);
      }

      console.log("[story-player] story loaded:", {
        id: data?.id,
        audio_url: data?.audio_url,
        status: data?.status,
      });

      if (data) {
        setStory(data);

        if (data.audio_url) {
          const { data: urlData, error: urlError } = await supabase.storage
            .from("story-audio")
            .createSignedUrl(data.audio_url, 3600);
          if (urlError || !urlData?.signedUrl) {
            console.error("[story-player] signed URL error:", urlError);
          } else {
            console.log("[story-player] signed URL:", urlData.signedUrl.slice(0, 80) + "...");
            setAudioUri(urlData.signedUrl);
          }
        } else {
          console.log("[story-player] no audio_url on story");
        }
      }

      setLoading(false);
    }

    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  if (!story) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtnText}>🔙</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Story not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtnText}>🔙</Text>
          </Pressable>
        </View>

        <Text style={styles.date}>{formatDate(story.created_at)}</Text>

        {/* Preview text */}
        {story.preview_text ? (
          <Text style={styles.previewText}>{story.preview_text}</Text>
        ) : null}

        {/* Audio player */}
        {audioUri ? (
          <PlayerControls audioUri={audioUri} storyId={story.id} />
        ) : (
          <View style={styles.noAudioBox}>
            <Text style={styles.noAudioText}>No audio available</Text>
          </View>
        )}

        {/* Wisdom snippets */}
        {story.wisdom_snippets?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wisdom</Text>
            {story.wisdom_snippets.map((snippet, i) => (
              <Text key={i} style={styles.snippet}>
                {`\u201C${snippet}\u201D`}
              </Text>
            ))}
          </View>
        )}

        {/* Life areas */}
        {story.life_areas?.length > 0 && (
          <View style={styles.chipRow}>
            {story.life_areas.map((area) => (
              <View key={area} style={styles.chip}>
                <Text style={styles.chipText}>{area}</Text>
              </View>
            ))}
          </View>
        )}

        {story.status === "processing" && (
          <View style={styles.processingBadge}>
            <Text style={styles.processingText}>processing</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FDFFF5" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDFFF5",
  },
  container: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 24,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderWidth: 1.5,
    borderColor: "#111",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 30, color: "#111" },

  date: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  previewText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#111",
    fontWeight: "900",
    lineHeight: 34,
  },

  // Player
  playerBox: {
    backgroundColor: "#111",
    padding: 24,
    gap: 16,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#BFFF00",
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#FDFFF5",
    fontWeight: "900",
    opacity: 0.6,
  },
  bigPlayBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bigPlayText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#111",
    fontWeight: "900",
  },
  debugText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 10,
    color: "#FDFFF5",
    fontWeight: "900",
    opacity: 0.4,
    textAlign: "center",
  },

  noAudioBox: {
    backgroundColor: "#F0F2E8",
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#111",
  },
  noAudioText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#555",
    fontWeight: "900",
  },

  // Sections
  section: { gap: 12 },
  sectionTitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  snippet: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#333",
    fontWeight: "900",
    lineHeight: 28,
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

  processingBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#111",
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  processingText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#FDFFF5",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#555",
    fontWeight: "900",
  },
});
