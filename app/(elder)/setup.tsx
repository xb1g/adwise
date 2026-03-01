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

type Message = { role: "ai" | "user"; text: string };

export default function ElderVoiceOnboarding() {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const conversation = useConversation({
    clientTools: {
      complete_onboarding: async (params: unknown): Promise<string> => {
        const p = params as { age_range?: string; life_areas?: string[] };
        await finishOnboarding(p.age_range, p.life_areas);
        return "ok";
      },
    },
    onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => {
      setIsSpeaking(mode === "speaking");
    },
    onMessage: ({ message }: { message: any }) => {
      if (message?.type === "agent_response") {
        const text: string = message.agent_response_event?.agent_response;
        if (text) setMessages((prev) => [...prev, { role: "ai", text }]);
      } else if (message?.type === "user_transcript") {
        const text: string = message.user_transcription_event?.user_transcript;
        if (text) setMessages((prev) => [...prev, { role: "user", text }]);
      }
    },
    onConnect: ({ conversationId: cid }: { conversationId: string }) => {
      setConversationId(cid);
      console.log("[elder-onboarding] connected", cid);
      setPaused(false);
    },
    onDisconnect: () => {
      console.log("[elder-onboarding] disconnected");
    },
    onError: (message: string) => {
      console.error("[elder-onboarding] error:", message);
    },
  });

  const isConnected = conversation.status === "connected";

  // Pulse animation when AI is speaking
  useEffect(() => {
    pulseRef.current?.stop();
    if (isSpeaking) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => pulseRef.current?.stop();
  }, [isSpeaking]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // Auto-start on mount
  useEffect(() => {
    conversation.startSession({ agentId: AGENT_ID });
    return () => { conversation.endSession(); };
  }, []);

  async function finishOnboarding(age_range?: string, life_areas?: string[]) {
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
    if (!error) router.replace("/(elder)/profile");
  }

  async function handleDone() {
    try { await conversation.endSession(); } catch (_) {}
    finishOnboarding();
  }

  function handleRepeat() {
    if (!isConnected) return;
    conversation.sendUserMessage("Could you please repeat that?");
  }

  async function handlePause() {
    if (paused) {
      // Resume — restart session
      setPaused(false);
      await conversation.startSession({ agentId: AGENT_ID });
    } else {
      // Pause — end session
      try { await conversation.endSession(); } catch (_) {}
      setPaused(true);
    }
  }

  function handleBack() {
    try { conversation.endSession(); } catch (_) {}
    router.back();
  }

  const statusLabel = paused
    ? "Paused"
    : !isConnected
    ? "Connecting..."
    : isSpeaking
    ? "Speaking..."
    : "Listening...";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={handleBack}>
          <Text style={styles.headerBtnText}>← Back</Text>
        </Pressable>

        <View style={styles.statusRow}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: paused ? "#999" : isConnected ? "#BFFF00" : "#555",
                transform: [{ scale: isSpeaking ? pulseAnim : 1 }],
              },
            ]}
          />
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>

        <Pressable style={styles.headerBtn} onPress={handlePause}>
          <Text style={styles.headerBtnText}>{paused ? "Resume" : "Pause"}</Text>
        </Pressable>
      </View>

      {/* Transcript */}
      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <Text style={styles.emptyHint}>
            {paused ? "Conversation paused." : "The conversation will appear here..."}
          </Text>
        )}
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              msg.role === "user" ? styles.bubbleUser : styles.bubbleAi,
            ]}
          >
            <Text style={styles.bubbleLabel}>
              {msg.role === "ai" ? "AI" : "You"}
            </Text>
            <Text
              style={[
                styles.bubbleText,
                msg.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAi,
              ]}
            >
              {msg.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.repeatBtn, !isConnected && styles.btnDisabled]}
          onPress={handleRepeat}
          disabled={!isConnected}
        >
          <Text style={styles.repeatBtnText}>↺  Repeat</Text>
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
  safe: {
    flex: 1,
    backgroundColor: "#FDFFF5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E0",
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 70,
  },
  headerBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#555",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#111",
  },
  transcript: {
    flex: 1,
  },
  transcriptContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 14,
  },
  emptyHint: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#BBBBB0",
    textAlign: "center",
    marginTop: 40,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: "90%",
  },
  bubbleAi: {
    backgroundColor: "#FFF",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E8E8E0",
  },
  bubbleUser: {
    backgroundColor: "#111",
    alignSelf: "flex-end",
  },
  bubbleLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#999",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  bubbleText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    lineHeight: 26,
  },
  bubbleTextAi: {
    color: "#111",
  },
  bubbleTextUser: {
    color: "#BFFF00",
  },
  controls: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E0",
  },
  repeatBtn: {
    backgroundColor: "#111",
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  repeatBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#FDFFF5",
    fontWeight: "700",
  },
  doneBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  doneBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#111",
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.3,
  },
});
