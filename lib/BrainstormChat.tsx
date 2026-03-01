import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { useConversation } from "@elevenlabs/react-native";

const AGENT_ID = "agent_5501kjnqpr36enzs4tx0j1r3r4nj";

type Message = { role: "user" | "agent"; text: string };

type Props = {
  onComplete: (problemText: string) => void;
  onCancel: () => void;
};

export default function BrainstormChat({ onComplete, onCancel }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionStartedRef = useRef(false);

  const [phase, setPhase] = useState<"intro" | "conversation">("intro");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [paused, setPaused] = useState(false);

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
      console.log("[brainstorm] connected", conversationId);
      setPaused(false);
    },
    onDisconnect: () => {
      console.log("[brainstorm] disconnected");
    },
    onError: (message: string) =>
      console.error("[brainstorm] error:", message),
  });

  const isConnected = conversation.status === "connected";

  // Pulse animation when agent is speaking
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
        ])
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

  async function handleStart() {
    sessionStartedRef.current = true;
    setPhase("conversation");
    await conversation.startSession({ agentId: AGENT_ID });
  }

  async function handleDone() {
    try { await conversation.endSession(); } catch (_) {}

    // Extract problem text from user messages
    const userMessages = messagesRef.current
      .filter((m) => m.role === "user")
      .map((m) => m.text);
    const problemText = userMessages.join(" ").trim();
    onComplete(problemText || "");
  }

  async function handlePause() {
    if (paused) {
      setPaused(false);
      await conversation.startSession({ agentId: AGENT_ID });
    } else {
      try { await conversation.endSession(); } catch (_) {}
      setPaused(true);
    }
  }

  function handleRepeat() {
    if (!isConnected) return;
    conversation.sendUserMessage("Could you please repeat that?");
  }

  async function handleCancel() {
    try { await conversation.endSession(); } catch (_) {}
    onCancel();
  }

  const statusLabel = paused
    ? "Paused"
    : !isConnected
      ? "Connecting..."
      : isSpeaking
        ? "Speaking..."
        : "Listening...";

  // ── Intro ──────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <View style={styles.container}>
        <View style={styles.introContent}>
          <Pressable style={styles.cancelBtn} onPress={handleCancel} hitSlop={12}>
            <Text style={styles.cancelBtnText}>✕</Text>
          </Pressable>

          <Text style={styles.introTitle}>
            Brainstorm with AI
          </Text>
          <Text style={styles.introSubtitle}>
            Talk through your problem out loud. The AI will listen, ask questions, and help you articulate what you're going through.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
            onPress={handleStart}
          >
            <Text style={styles.startBtnText}>Start Talking 🎙</Text>
          </Pressable>

          <View style={styles.trustBlock}>
            <View style={styles.trustRow}>
              <Text style={styles.trustIcon}>•</Text>
              <Text style={styles.trustText}>Just speak naturally</Text>
            </View>
            <View style={styles.trustRow}>
              <Text style={styles.trustIcon}>•</Text>
              <Text style={styles.trustText}>AI guides the conversation</Text>
            </View>
            <View style={styles.trustRow}>
              <Text style={styles.trustIcon}>•</Text>
              <Text style={styles.trustText}>Your words become your problem description</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ── Conversation ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBackBtn} onPress={handleCancel} hitSlop={12}>
          <Text style={styles.headerBackBtnText}>✕</Text>
        </Pressable>

        <View style={styles.statusRow}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: paused ? "#555" : isConnected ? "#BFFF00" : "#555",
                transform: [{ scale: isSpeaking ? pulseAnim : 1 }],
              },
            ]}
          />
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>

        <Pressable style={styles.headerBtn} onPress={handlePause} hitSlop={12}>
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
            style={[styles.bubble, msg.role === "agent" ? styles.bubbleAi : styles.bubbleUser]}
          >
            <Text
              style={[
                styles.bubbleLabel,
                msg.role === "agent" ? styles.bubbleLabelAi : styles.bubbleLabelUser,
              ]}
            >
              {msg.role === "agent" ? "Adwise AI" : "You"}
            </Text>
            <Text
              style={[
                styles.bubbleText,
                msg.role === "agent" ? styles.bubbleTextAi : styles.bubbleTextUser,
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
          <Text style={styles.repeatBtnText}>↺ Repeat</Text>
        </Pressable>
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>I'm Done →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFFF5" },

  // Intro
  introContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  cancelBtn: {
    position: "absolute",
    top: 20,
    right: 24,
    zIndex: 10,
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: "#CCC",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 18,
    color: "#888",
  },
  introTitle: {
    fontSize: 34,
    fontFamily: "Orbit_400Regular",
    fontWeight: "900",
    color: "#111",
    lineHeight: 42,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  introSubtitle: {
    fontSize: 16,
    fontFamily: "Orbit_400Regular",
    color: "#444",
    lineHeight: 24,
    marginBottom: 40,
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
  startBtnPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  startBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
  trustBlock: { gap: 12, marginLeft: 12 },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  trustIcon: { fontSize: 18, color: "#666" },
  trustText: { fontSize: 15, fontFamily: "Orbit_400Regular", color: "#666" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#111",
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: "#CCC",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackBtnText: { fontSize: 18, color: "#888" },
  headerBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 80 },
  headerBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    fontWeight: "900",
  },

  // Status
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 17,
    color: "#111",
    fontWeight: "900",
  },

  // Transcript
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

  // Bubbles
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

  // Controls
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
});
