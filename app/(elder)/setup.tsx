import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useConversation } from "@elevenlabs/react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

const AGENT_ID = "agent_4601kjkqjm0de5z86ea0gmpxk1qw";

type Message = { role: "user" | "agent"; text: string };

type Phase = "intro" | "conversation" | "reviewing" | "saving";

type ExtractedProfile = {
  age_range: string | null;
  life_areas: string[];
  bio: string;
  key_topics: string[];
  wisdom_summary: string;
};

export default function ElderVoiceOnboarding() {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const messagesRef = useRef<Message[]>([]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [paused, setPaused] = useState(false);
  const [extractedProfile, setExtractedProfile] =
    useState<ExtractedProfile | null>(null);
  const [extractionFailed, setExtractionFailed] = useState(false);

  const conversation = useConversation({
    clientTools: {
      complete_onboarding: async (parameters: any): Promise<string> => {
        try {
          await conversation.endSession();
        } catch (_) {}
        await enterReview();
        return "done";
      },
    },
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
    onConnect: ({ conversationId: cid }: { conversationId: string }) => {
      console.log("[elder-onboarding] connected", cid);
      setPaused(false);
    },
    onDisconnect: () => console.log("[elder-onboarding] disconnected"),
    onError: (message: string) =>
      console.error("[elder-onboarding] error:", message),
  });

  const isConnected = conversation.status === "connected";

  useEffect(() => {
    pulseRef.current?.stop();
    if (isSpeaking) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();
    } else {
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => pulseRef.current?.stop();
  }, [isSpeaking]);

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

  async function handleStartSession() {
    setPhase("conversation");
    await conversation.startSession({ agentId: AGENT_ID });
  }

  async function enterReview() {
    setPhase("reviewing");
    const { data, error } = await supabase.functions.invoke(
      "elder-onboarding-extract",
      { body: { messages: messagesRef.current } },
    );
    if (error || !data) {
      setExtractionFailed(true);
      setPhase("reviewing");
      return;
    }
    setExtractionFailed(false);
    setExtractedProfile(data as ExtractedProfile);
    // phase stays "reviewing" but now extractedProfile is set → shows review UI
  }

  async function finishOnboarding(
    rawTranscript: typeof messages | null,
    age_range: string | null,
    life_areas: string[],
    bio: string,
    key_topics: string[],
    wisdom_summary: string,
  ) {
    if (!user) return;
    setPhase("saving");
    try {
      const { error } = await supabase.from("elder_profiles").upsert(
        {
          user_id: user.id,
          raw_transcript: rawTranscript,
          age_range: age_range ?? null,
          life_areas: life_areas ?? [],
          bio: bio ?? "",
          key_topics: key_topics ?? [],
          wisdom_summary: wisdom_summary ?? "",
          onboarding_done: true,
          is_seeded: false,
        },
        { onConflict: "user_id" },
      );
      if (!error) router.replace("/(elder)/home");
      else setPhase("reviewing");
    } catch {
      setPhase("reviewing");
    }
  }

  async function handleDone() {
    try {
      await conversation.endSession();
    } catch (_) {}
    await enterReview();
  }

  async function handleConfirm() {
    if (!extractedProfile) return;
    await finishOnboarding(
      messages,
      extractedProfile.age_range,
      extractedProfile.life_areas,
      extractedProfile.bio,
      extractedProfile.key_topics,
      extractedProfile.wisdom_summary,
    );
  }

  async function handleStartOver() {
    setExtractedProfile(null);
    setExtractionFailed(false);
    setMessages([]);
    setPaused(false);
    setPhase("intro");
  }

  async function handleDevSkip() {
    try {
      await conversation.endSession();
    } catch (_) {}
    await finishOnboarding(
      messages,
      "60s",
      ["farming", "entrepreneurship", "land-management"],
      "Leo is a dev turn farmer who scaled his farm from a small plot to 300 acres. He brings decades of hands-on experience in agriculture, business scaling, and rural entrepreneurship.",
      ["scaling farms", "rural entrepreneurship", "land management"],
      "Hands-on experience beats theory when scaling any land-based business.",
    );
  }

  function handleRepeat() {
    if (!isConnected) return;
    conversation.sendUserMessage("Could you please repeat that?");
  }

  async function handlePause() {
    if (paused) {
      setPaused(false);
      await conversation.startSession({ agentId: AGENT_ID });
    } else {
      try {
        await conversation.endSession();
      } catch (_) {}
      setPaused(true);
    }
  }

  async function handleBack() {
    try {
      await conversation.endSession();
    } catch (_) {}
    if (phase === "reviewing") {
      setExtractedProfile(null);
      setExtractionFailed(false);
      setMessages([]);
      messagesRef.current = [];
      setPaused(false);
      setPhase("intro");
    } else {
      setMessages([]);
      messagesRef.current = [];
      setPaused(false);
      router.replace({ pathname: "/", params: { noredirect: "1" } });
    }
  }

  const statusLabel = paused
    ? "Paused"
    : !isConnected
      ? "Connecting..."
      : isSpeaking
        ? "Speaking..."
        : "Listening...";

  // Intro phase
  if (phase === "intro") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.introContainer}>
          <Pressable
            style={styles.introBackBtn}
            onPress={handleBack}
            hitSlop={12}
          >
            <Text style={styles.introBackText}>← Back</Text>
          </Pressable>

          <View style={styles.introContent}>
            <Text style={styles.introTitle}>
              Let's set up your storyteller profile.
            </Text>
            <Text style={styles.introSubtitle}>
              You only need to speak. No typing required.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.startBtn,
                pressed && styles.startBtnPressed,
              ]}
              onPress={handleStartSession}
            >
              <Text style={styles.startBtnText}>Start with Your Name</Text>
            </Pressable>

            <View style={styles.introTrustBlock}>
              <View style={styles.introTrustRow}>
                <Text style={styles.introTrustIcon}>•</Text>
                <Text style={styles.introTrustText}>Takes 5–7 minutes</Text>
              </View>
              <View style={styles.introTrustRow}>
                <Text style={styles.introTrustIcon}>•</Text>
                <Text style={styles.introTrustText}>You can stop anytime</Text>
              </View>
              <View style={styles.introTrustRow}>
                <Text style={styles.introTrustIcon}>•</Text>
                <Text style={styles.introTrustText}>
                  You control what's shared
                </Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Review phase
  if (phase === "reviewing") {
    return (
      <SafeAreaView style={styles.safe}>
        {extractedProfile === null ? (
          // Loading / error state
          <View style={styles.reviewLoadingContainer}>
            {extractionFailed ? (
              <>
                <Text style={styles.reviewLoadingText}>Couldn't extract your profile.</Text>
                <Text style={styles.reviewLoadingText}>Tap Start Over to try again.</Text>
                <Pressable style={[styles.doneBtn, { marginTop: 24 }]} onPress={handleStartOver}>
                  <Text style={styles.doneBtnText}>Start Over</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color="#111" size="large" />
                <Text style={styles.reviewLoadingText}>
                  Reviewing your conversation...
                </Text>
              </>
            )}
          </View>
        ) : (
          // Review UI
          <ScrollView
            style={styles.reviewScroll}
            contentContainerStyle={styles.reviewContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.reviewTitle}>Here's what we captured</Text>

            {extractedProfile.bio ? (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>About You</Text>
                <View style={styles.bioCard}>
                  <Text style={styles.bio}>{extractedProfile.bio}</Text>
                </View>
              </View>
            ) : null}

            {extractedProfile.life_areas.length > 0 ? (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Life Areas</Text>
                <View style={styles.chipRow}>
                  {extractedProfile.life_areas.map((area) => (
                    <View key={area} style={styles.chip}>
                      <Text style={styles.chipText}>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {extractedProfile.key_topics.length > 0 ? (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Key Topics</Text>
                <View style={styles.chipRow}>
                  {extractedProfile.key_topics.map((topic) => (
                    <View key={topic} style={styles.chip}>
                      <Text style={styles.chipText}>{topic}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {extractedProfile.wisdom_summary ? (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Your Wisdom</Text>
                <View style={styles.bioCard}>
                  <Text style={styles.bio}>
                    {extractedProfile.wisdom_summary}
                  </Text>
                </View>
              </View>
            ) : null}

            {extractedProfile.age_range ? (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Age</Text>
                <Text style={styles.reviewValue}>
                  {extractedProfile.age_range}
                </Text>
              </View>
            ) : null}

            <View style={styles.reviewControls}>
              <Pressable style={styles.doneBtn} onPress={handleConfirm}>
                <Text style={styles.doneBtnText}>Looks Good →</Text>
              </Pressable>
              <Pressable style={styles.repeatBtn} onPress={handleStartOver}>
                <Text style={styles.repeatBtnText}>Start Over</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // Saving phase (brief overlay while DB write completes)
  if (phase === "saving") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.reviewLoadingContainer}>
          <ActivityIndicator color="#111" size="large" />
          <Text style={styles.reviewLoadingText}>Saving your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Conversation phase
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={handleBack} hitSlop={12}>
          <Text style={styles.headerBtnText}>← Back</Text>
        </Pressable>

        <View style={styles.statusRow}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: paused
                  ? "#555"
                  : isConnected
                    ? "#BFFF00"
                    : "#555",
                transform: [{ scale: isSpeaking ? pulseAnim : 1 }],
              },
            ]}
          />
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>

        <Pressable style={styles.headerBtn} onPress={handlePause} hitSlop={12}>
          <Text style={styles.headerBtnText}>
            {paused ? "Resume" : "Pause"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <Text style={styles.emptyHint}>
            {paused
              ? "Conversation paused."
              : "The conversation will appear here..."}
          </Text>
        )}
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              msg.role === "agent" ? styles.bubbleAi : styles.bubbleUser,
            ]}
          >
            <Text
              style={[
                styles.bubbleLabel,
                msg.role === "agent"
                  ? styles.bubbleLabelAi
                  : styles.bubbleLabelUser,
              ]}
            >
              {msg.role === "agent" ? "Adwise AI" : "You"}
            </Text>
            <Text
              style={[
                styles.bubbleText,
                msg.role === "agent"
                  ? styles.bubbleTextAi
                  : styles.bubbleTextUser,
              ]}
            >
              {msg.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Pressable style={styles.devBtn} onPress={handleDevSkip}>
        <Text style={styles.devBtnText}>dev: skip as Leo</Text>
      </Pressable>

      <View style={styles.controls}>
        <Pressable
          style={[styles.repeatBtn, !isConnected && styles.btnDisabled]}
          onPress={handleRepeat}
          disabled={!isConnected}
        >
          <Text style={styles.repeatBtnText}>↺ Repeat</Text>
        </Pressable>
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>I'm Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FDFFF5" },

  introContainer: {
    flex: 1,
  },
  introBackBtn: {
    position: "absolute",
    top: 20,
    left: 24,
    zIndex: 10,
    padding: 10,
  },
  introBackText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#666",
  },
  introContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  introTitle: {
    fontSize: 38,
    fontFamily: "Orbit_400Regular",
    fontWeight: "900",
    color: "#111",
    lineHeight: 46,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  introSubtitle: {
    fontSize: 18,
    fontFamily: "Orbit_400Regular",
    color: "#444",
    lineHeight: 26,
    marginBottom: 48,
  },
  startBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#111",
    alignItems: "center",
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  startBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  startBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
  introTrustBlock: {
    gap: 12,
    marginLeft: 12,
  },
  introTrustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  introTrustIcon: {
    fontSize: 18,
    color: "#666",
  },
  introTrustText: {
    fontSize: 15,
    fontFamily: "Orbit_400Regular",
    color: "#666",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#111",
  },
  headerBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 80 },
  headerBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    fontWeight: "900",
  },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 17,
    color: "#111",
    fontWeight: "900",
  },

  transcript: { flex: 1 },
  transcriptContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 16,
  },

  emptyHint: {
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
  bubbleAi: {
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
  bubbleLabelAi: { color: "#111" },
  bubbleLabelUser: { color: "#BFFF00" },

  bubbleText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "900",
  },
  bubbleTextAi: { color: "#111" },
  bubbleTextUser: { color: "#FDFFF5" },

  controls: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 14,
    borderTopWidth: 2,
    borderTopColor: "#111",
  },
  repeatBtn: {
    backgroundColor: "#111",
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: "center",
  },
  repeatBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#FDFFF5",
    fontWeight: "900",
  },
  doneBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: "center",
  },
  doneBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#111",
    fontWeight: "900",
  },
  btnDisabled: { opacity: 0.3 },

  devBtn: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CCC",
    marginBottom: 8,
  },
  devBtnText: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#AAA" },

  // Review phase styles
  reviewLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  reviewLoadingText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
  reviewScroll: { flex: 1 },
  reviewContainer: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 28,
  },
  reviewTitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 38,
    fontWeight: "900",
    color: "#111",
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  reviewSection: { gap: 10 },
  reviewLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  reviewValue: {
    fontFamily: "Orbit_400Regular",
    fontSize: 28,
    color: "#111",
    fontWeight: "900",
  },
  bioCard: {
    backgroundColor: "#F0F2E8",
    padding: 24,
    gap: 10,
    borderWidth: 2,
    borderColor: "#111",
  },
  bio: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#111",
    fontWeight: "900",
    lineHeight: 32,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    borderWidth: 2,
    borderColor: "#111",
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  chipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    fontWeight: "900",
  },
  reviewControls: {
    marginTop: 8,
    gap: 14,
  },
});
