import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { useConversation } from "@elevenlabs/react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

const AGENT_ID = "agent_4601kjkqjm0de5z86ea0gmpxk1qw";

type Message = { role: "user" | "agent"; text: string };

export default function ElderVoiceOnboarding() {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const [hasStarted, setHasStarted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const conversation = useConversation({
    clientTools: {
      complete_onboarding: async (params: unknown): Promise<string> => {
        const p = params as {
          age_range?: string;
          life_areas?: string[];
          bio?: string;
        };
        await finishOnboarding(p.age_range, p.life_areas, p.bio);
        return "ok";
      },
    },
    },
    onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => {
      setIsSpeaking(mode === "speaking");
    },
    onMessage: ({
      message,
      role,
    }: {
      message: string;
      role: "user" | "agent";
    }) => {
      if (message) setMessages((prev) => [...prev, { role, text: message }]);
    },
    onConnect: ({ conversationId: cid }: { conversationId: string }) => {
      setConversationId(cid);
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
      if (conversation.status === "connected") {
        conversation.endSession();
      }
    };
  }, []);

  async function handleStartSession() {
    setHasStarted(true);
    await conversation.startSession({ agentId: AGENT_ID });
  }

  async function finishOnboarding(
    age_range?: string,
    life_areas?: string[],
    bio?: string,
  ) {
    if (!user || saving) return;
    setSaving(true);

    const { error } = await supabase.functions.invoke("process-elder-onboarding", {
      body: {
        conversationId,
        userId: user.id,
        age_range: age_range ?? null,
        life_areas: life_areas ?? [],
      },
    });

    setSaving(false);
    if (!error) router.replace("/(elder)/home");
  }

  async function handleDone() {
    try {
      await conversation.endSession();
    } catch (_) {}
    finishOnboarding();
  }

  async function handleDevSkip() {
    try {
      await conversation.endSession();
    } catch (_) {}
    await finishOnboarding(
      "60s",
      ["farming", "entrepreneurship", "land-management"],
      "Leo is a dev turn farmer who scaled his farm from a small plot to 300 acres. He brings decades of hands-on experience in agriculture, business scaling, and rural entrepreneurship.",
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
    router.replace({ pathname: "/", params: { noredirect: "1" } });
  }

  const statusLabel = paused
    ? "Paused"
    : !isConnected
      ? "Connecting..."
      : isSpeaking
        ? "Speaking..."
        : "Listening...";

  if (!hasStarted) {
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
        <Pressable
          style={[styles.doneBtn, saving && styles.btnDisabled]}
          onPress={handleDone}
          disabled={saving}
        >
          <Text style={styles.doneBtnText}>
            {saving ? "Saving..." : "I'm Done"}
          </Text>
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
});
