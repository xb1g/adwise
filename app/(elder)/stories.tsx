import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useConversation } from "@elevenlabs/react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

const STORY_AGENT_ID = "agent_5501kjm712jyfd1v0g0r8gn96dfm";

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

type Message = { role: "user" | "agent"; text: string };

export default function MyStories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [devGenerating, setDevGenerating] = useState(false);

  // Conversation state
  const [chatActive, setChatActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectError, setConnectError] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const conversation = useConversation({
    onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => {
      setIsSpeaking(mode === "speaking");
    },
    onMessage: ({ message, role }: { message: string; role: "user" | "agent" }) => {
      if (message) {
        const next = [...messagesRef.current, { role, text: message }];
        messagesRef.current = next;
        setMessages(next);
      }
    },
    onConnect: ({ conversationId }: { conversationId: string }) => {
      console.log("[elder-story] connected", conversationId);
      setConnectError(null);
    },
    onDisconnect: () => {
      console.log("[elder-story] disconnected");
    },
    onError: (message: string) => {
      console.error("[elder-story] error:", message);
      setConnectError("Connection failed. Tap retry.");
    },
  });

  const isConnected = conversation.status === "connected";

  // Pulse animation when agent is speaking
  useEffect(() => {
    pulseRef.current?.stop();
    if (isSpeaking) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      pulseRef.current.start();
    } else {
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => pulseRef.current?.stop();
  }, [isSpeaking]);

  // Auto-scroll transcript
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { conversation.endSession(); } catch (_) {}
    };
  }, [conversation]);

  async function handleStartChat() {
    setChatActive(true);
    setPaused(false);
    setConnectError(null);
    messagesRef.current = [];
    setMessages([]);
    try {
      await conversation.startSession({ agentId: STORY_AGENT_ID });
    } catch (err) {
      console.error("[elder-story] start error:", err);
      setConnectError("Could not connect. Tap retry.");
    }
  }

  async function handleRetry() {
    setConnectError(null);
    try {
      await conversation.startSession({ agentId: STORY_AGENT_ID });
    } catch (err) {
      console.error("[elder-story] retry error:", err);
      setConnectError("Still can't connect. Try again later.");
    }
  }

  // Pause: go back to stories list but keep messages
  function handlePause() {
    try { conversation.endSession(); } catch (_) {}
    setPaused(true);
    setChatActive(false);
  }

  // Resume: reopen conversation view and reconnect
  async function handleResume() {
    setChatActive(true);
    setPaused(false);
    setConnectError(null);
    try {
      await conversation.startSession({ agentId: STORY_AGENT_ID });
    } catch (err) {
      console.error("[elder-story] resume error:", err);
      setConnectError("Could not reconnect. Tap retry.");
    }
  }

  // Fully end: discard session
  async function handleEndChat() {
    try { await conversation.endSession(); } catch (_) {}
    setChatActive(false);
    setPaused(false);
    messagesRef.current = [];
    setMessages([]);
  }

  async function loadStories() {
    if (!user) return;
    const { data: profileData } = await supabase
      .from("elder_profiles")
      .select("id")
      .eq("user_id", user.id)
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

  useEffect(() => {
    loadStories();
  }, [user]);

  async function handleDevGenerate() {
    setDevGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-generate-story", {});
      if (error || !data?.success) throw new Error(error?.message ?? "generation failed");
      console.log("[stories] dev generate succeeded");
      await loadStories();
    } catch (err) {
      console.error("[stories] dev generate failed:", err);
    } finally {
      setDevGenerating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  // Conversation UI
  if (chatActive) {
    const statusLabel = connectError
      ? "Error"
      : !isConnected
        ? "Connecting..."
        : isSpeaking
          ? "Speaking..."
          : "Listening...";

    return (
      <SafeAreaView style={styles.chatSafe}>
        <View style={styles.chatHeader}>
          <Pressable style={styles.chatHeaderBtn} onPress={handlePause} hitSlop={12}>
            <Text style={styles.chatHeaderBtnText}>← Back</Text>
          </Pressable>
          <View style={styles.chatStatusRow}>
            <Animated.View
              style={[
                styles.chatStatusDot,
                {
                  backgroundColor: connectError ? "#FF4444" : isConnected ? "#BFFF00" : "#555",
                  transform: [{ scale: isSpeaking ? pulseAnim : 1 }],
                },
              ]}
            />
            <Text style={styles.chatStatusLabel}>{statusLabel}</Text>
          </View>
          <View style={{ minWidth: 80 }} />
        </View>

        {connectError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{connectError}</Text>
            <Pressable style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.chatTranscript}
            contentContainerStyle={styles.chatTranscriptContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <Text style={styles.chatEmptyHint}>
                The conversation will appear here...
              </Text>
            )}
            {messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  msg.role === "agent" ? styles.bubbleAgent : styles.bubbleUser,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleLabel,
                    msg.role === "agent" ? styles.bubbleLabelAgent : styles.bubbleLabelUser,
                  ]}
                >
                  {msg.role === "agent" ? "Elder Story" : "You"}
                </Text>
                <Text
                  style={[
                    styles.bubbleText,
                    msg.role === "agent" ? styles.bubbleTextAgent : styles.bubbleTextUser,
                  ]}
                >
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.chatControls}>
          <Pressable
            style={[styles.chatRepeatBtn, !isConnected && styles.chatBtnDisabled]}
            onPress={() => isConnected && conversation.sendUserMessage("Could you please repeat that?")}
            disabled={!isConnected}
          >
            <Text style={styles.chatRepeatBtnText}>↺ Repeat</Text>
          </Pressable>
          <Pressable style={styles.chatDoneBtn} onPress={handleEndChat}>
            <Text style={styles.chatDoneBtnText}>End Conversation</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>My Stories</Text>

      {/* Paused session banner */}
      {paused && messages.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.pausedBanner, pressed && { opacity: 0.8 }]}
          onPress={handleResume}
        >
          <View style={styles.pausedBannerLeft}>
            <Text style={styles.pausedDot}>⏸</Text>
            <View>
              <Text style={styles.pausedTitle}>Session paused</Text>
              <Text style={styles.pausedSub}>{messages.length} messages · tap to resume</Text>
            </View>
          </View>
          <Pressable onPress={handleEndChat} hitSlop={12}>
            <Text style={styles.pausedDiscard}>✕</Text>
          </Pressable>
        </Pressable>
      )}

      {/* AI Story Agent — the only way to create stories */}
      <Pressable
        style={({ pressed }) => [styles.agentBtn, pressed && styles.agentBtnPressed]}
        onPress={handleStartChat}
      >
        <Text style={styles.agentBtnText}>Tell a new story</Text>
        <Text style={styles.agentBtnHint}>Have a guided voice conversation to capture your wisdom</Text>
      </Pressable>

      {stories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No stories yet.{"\n"}Tap above to tell your first one.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </View>
      )}

      {/* Dev shortcut */}
      <Pressable
        style={[styles.devBtn, devGenerating && { opacity: 0.5 }]}
        onPress={handleDevGenerate}
        disabled={devGenerating}
      >
        <Text style={styles.devBtnText}>
          {devGenerating ? "generating..." : "dev: generate story from bio"}
        </Text>
      </Pressable>
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

  // Paused session banner
  pausedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111",
    padding: 16,
    borderWidth: 2,
    borderColor: "#BFFF00",
  },
  pausedBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  pausedDot: { fontSize: 20 },
  pausedTitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#BFFF00",
    fontWeight: "900",
  },
  pausedSub: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#FDFFF5",
    fontWeight: "900",
    opacity: 0.6,
    marginTop: 2,
  },
  pausedDiscard: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#FDFFF5",
    fontWeight: "900",
    opacity: 0.5,
    paddingLeft: 16,
  },

  // Error / retry
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 32,
  },
  errorText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 28,
  },
  retryBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 16,
  },
  retryBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#111",
    fontWeight: "900",
  },

  // AI Agent button
  agentBtn: {
    backgroundColor: "#111",
    padding: 20,
    gap: 6,
    borderWidth: 2,
    borderColor: "#111",
  },
  agentBtnPressed: { opacity: 0.8 },
  agentBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#BFFF00",
    fontWeight: "900",
  },
  agentBtnHint: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#FDFFF5",
    fontWeight: "900",
    opacity: 0.6,
  },

  // Conversation UI
  chatSafe: { flex: 1, backgroundColor: "#FDFFF5" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#111",
  },
  chatHeaderBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 80 },
  chatHeaderBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    fontWeight: "900",
  },
  chatStatusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  chatStatusDot: { width: 12, height: 12, borderRadius: 6 },
  chatStatusLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 17,
    color: "#111",
    fontWeight: "900",
  },
  chatTranscript: { flex: 1 },
  chatTranscriptContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 16,
  },
  chatEmptyHint: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#555",
    fontWeight: "900",
    textAlign: "center",
    marginTop: 48,
    lineHeight: 30,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: "92%",
  },
  bubbleAgent: {
    backgroundColor: "#FFF",
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: "#111",
  },
  bubbleUser: { backgroundColor: "#111", alignSelf: "flex-end" },
  bubbleLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  bubbleLabelAgent: { color: "#111" },
  bubbleLabelUser: { color: "#BFFF00" },
  bubbleText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "900",
  },
  bubbleTextAgent: { color: "#111" },
  bubbleTextUser: { color: "#FDFFF5" },
  chatControls: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 14,
    borderTopWidth: 2,
    borderTopColor: "#111",
  },
  chatRepeatBtn: {
    backgroundColor: "#111",
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: "center",
  },
  chatRepeatBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#FDFFF5",
    fontWeight: "900",
  },
  chatDoneBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: "center",
  },
  chatDoneBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#111",
    fontWeight: "900",
  },
  chatBtnDisabled: { opacity: 0.3 },

  // Dev shortcut
  devBtn: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CCC",
  },
  devBtnText: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#AAA" },
});
