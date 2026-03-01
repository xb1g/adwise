import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { router } from "expo-router";
import { useConversation } from "@elevenlabs/react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

const AGENT_ID = "agent_4601kjkqjm0de5z86ea0gmpxk1qw";

type Status = "disconnected" | "connecting" | "connected" | "disconnecting";

export default function ElderVoiceOnboarding() {
  const { user } = useAuth();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Track these explicitly via callbacks — reactive properties can lag in RN
  const [status, setStatus] = useState<Status>("connecting");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const conversation = useConversation({
    clientTools: {
      // Called by the ElevenLabs agent when it has gathered enough info
      complete_onboarding: async (params: unknown): Promise<string> => {
        const p = params as { age_range?: string; life_areas?: string[] };
        await finishOnboarding(p.age_range, p.life_areas);
        return "ok";
      },
    },
    onStatusChange: ({ status: s }: { status: Status }) => {
      setStatus(s);
    },
    onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => {
      setIsSpeaking(mode === "speaking");
    },
    onConnect: ({ conversationId: cid }: { conversationId: string }) => {
      setConversationId(cid);
      console.log("[elder-onboarding] connected", cid);
    },
    onDisconnect: () => {
      console.log("[elder-onboarding] disconnected");
    },
    onError: (message: string) => {
      console.error("[elder-onboarding] error:", message);
    },
  });

  // Pulse animation while AI is speaking
  useEffect(() => {
    pulseRef.current?.stop();
    if (isSpeaking) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => pulseRef.current?.stop();
  }, [isSpeaking]);

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

  function handleRepeat() {
    if (status !== "connected") return;
    conversation.sendUserMessage("Could you please repeat that?");
  }

  async function handleDone() {
    if (status === "connected") await conversation.endSession();
    finishOnboarding();
  }

  const isConnected = status === "connected";

  return (
    <View style={styles.container}>
      {/* Status label */}
      <Text style={styles.statusText}>
        {status === "connecting"
          ? "Connecting..."
          : isSpeaking
          ? "Speaking to you"
          : "I'm listening..."}
      </Text>

      {/* Animated orb */}
      <View style={styles.orbWrapper}>
        <Animated.View
          style={[styles.orbGlow, { transform: [{ scale: pulseAnim }] }]}
        />
        <View style={[styles.orbCore, isSpeaking && styles.orbCoreActive]} />
      </View>

      {/* Buttons */}
      <View style={styles.btnGroup}>
        <Pressable
          style={[styles.repeatBtn, !isConnected && styles.btnDisabled]}
          onPress={handleRepeat}
          disabled={!isConnected}
        >
          <Text style={styles.repeatBtnText}>↺  Repeat</Text>
        </Pressable>

        <Pressable
          style={[styles.doneBtn, (!isConnected || saving) && styles.btnDisabled]}
          onPress={handleDone}
          disabled={!isConnected || saving}
        >
          <Text style={styles.doneBtnText}>
            {saving ? "Saving..." : "I'm Done"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFFF5",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 120,
    paddingBottom: 80,
    paddingHorizontal: 32,
  },
  statusText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 30,
    color: "#111",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  orbWrapper: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  orbGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#BFFF00",
    opacity: 0.2,
  },
  orbCore: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#111",
  },
  orbCoreActive: {
    backgroundColor: "#BFFF00",
  },
  btnGroup: {
    width: "100%",
    gap: 16,
  },
  repeatBtn: {
    backgroundColor: "#111",
    paddingVertical: 24,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
  },
  repeatBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#FDFFF5",
    fontWeight: "700",
  },
  doneBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 24,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
  },
  doneBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#111",
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.3,
  },
});
