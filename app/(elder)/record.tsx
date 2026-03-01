import { useState, useRef, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  Animated, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { transcribeAudio, structureStory } from "../../lib/ai";

type Phase = "idle" | "recording" | "transcribing" | "structuring" | "saving" | "done";

const STATUS_LABELS: Record<Phase, string> = {
  idle: "Hold to record your story",
  recording: "Recording... release when done",
  transcribing: "Transcribing your voice...",
  structuring: "Structuring your wisdom...",
  saving: "Publishing your profile...",
  done: "Published!",
};

export default function ElderRecord() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [wisdomSnippets, setWisdomSnippets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isProcessing = phase !== "idle" && phase !== "recording" && phase !== "done";

  useEffect(() => {
    if (phase === "recording") {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => pulseLoopRef.current?.stop();
  }, [phase]);

  async function startRecording() {
    if (isProcessing) return;
    setError(null);
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        setError("Microphone permission required.");
        return;
      }
      AudioModule.setAudioMode({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setPhase("recording");
    } catch (err) {
      console.error("[record] start error:", err);
      setError("Could not start recording. Try again.");
    }
  }

  async function stopAndProcess() {
    if (phase !== "recording" || !user) return;

    try {
      // Stop recording
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("No recording URI");

      // Transcribe
      setPhase("transcribing");
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const rawTranscript = await transcribeAudio(audioBase64, "audio/m4a");
      setTranscript(rawTranscript);

      // Structure
      setPhase("structuring");
      const structured = await structureStory(rawTranscript);
      setWisdomSnippets(structured.wisdom_snippets ?? []);

      // Save to DB
      setPhase("saving");

      // Upload audio
      const audioPath = `${user.id}/${Date.now()}.m4a`;
      await supabase.storage.from("story-audio").upload(audioPath, audioBase64, {
        contentType: "audio/m4a",
      });

      // Find or create elder_profile
      let { data: profile } = await supabase
        .from("elder_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        const { data: newProfile, error: insertErr } = await supabase
          .from("elder_profiles")
          .insert({
            user_id: user.id,
            age_range: null,
            life_areas: structured.life_areas,
            bio: structured.bio,
            is_seeded: false,
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        profile = newProfile;
      } else {
        await supabase
          .from("elder_profiles")
          .update({
            bio: structured.bio,
            life_areas: structured.life_areas,
          })
          .eq("id", profile.id);
      }

      // Insert story
      await supabase.from("stories").insert({
        elder_id: profile.id,
        audio_url: audioPath,
        transcript: rawTranscript,
        life_areas: structured.life_areas,
        key_topics: structured.key_topics,
        wisdom_snippets: structured.wisdom_snippets,
        preview_text: structured.preview_text,
        tags: structured.tags,
        status: "published",
      });

      setPhase("done");
      setTimeout(() => router.replace("/(elder)/home"), 1500);
    } catch (err) {
      console.error("[record] pipeline error:", err);
      setError("Something went wrong. Tap to try again.");
      setPhase("idle");
    }
  }

  // Processing screen
  if (isProcessing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#BFFF00" />
          <Text style={styles.processingText}>{STATUS_LABELS[phase]}</Text>
          {phase === "structuring" && (
            <Text style={styles.processingHint}>
              AI is reading your story...
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Done screen
  if (phase === "done") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.processingContainer}>
          <Text style={styles.doneEmoji}>✦</Text>
          <Text style={styles.processingText}>Your wisdom is live.</Text>
          {wisdomSnippets[0] ? (
            <View style={styles.snippetPreview}>
              <Text style={styles.snippetText}>"{wisdomSnippets[0]}"</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  // Idle / recording screen
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>Tell your story</Text>
        <Text style={styles.hint}>
          Speak naturally. Talk about what you've been through and what you learned.
          {"\n"}Aim for 1–3 minutes.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.recordArea}>
          <Animated.View
            style={[
              styles.recordRing,
              phase === "recording" && styles.recordRingActive,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Pressable
              style={[styles.recordBtn, phase === "recording" && styles.recordBtnActive]}
              onPressIn={startRecording}
              onPressOut={stopAndProcess}
              disabled={isProcessing}
            >
              <View style={[styles.recordDot, phase === "recording" && styles.recordDotActive]} />
            </Pressable>
          </Animated.View>

          <Text style={styles.statusText}>{STATUS_LABELS[phase]}</Text>

          {phase === "recording" && (
            <Text style={styles.recordingHint}>Release the button when you're done speaking</Text>
          )}
        </View>

        {transcript.length > 0 && (
          <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContent}>
            <Text style={styles.transcriptLabel}>Transcript</Text>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FDFFF5" },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backText: { fontFamily: "Orbit_400Regular", fontSize: 16, color: "#111", opacity: 0.5 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Orbit_400Regular",
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  hint: {
    fontSize: 14,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    opacity: 0.6,
    lineHeight: 22,
    marginBottom: 48,
    alignSelf: "flex-start",
  },
  recordArea: { alignItems: "center", gap: 24, marginBottom: 32 },
  recordRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "#CCC",
    alignItems: "center",
    justifyContent: "center",
  },
  recordRingActive: { borderColor: "#BFFF00", borderWidth: 3 },
  recordBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtnActive: { backgroundColor: "#1a1a1a" },
  recordDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#BFFF00" },
  recordDotActive: { width: 32, height: 32, borderRadius: 6, backgroundColor: "#FF4444" },
  statusText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    opacity: 0.6,
    textAlign: "center",
  },
  recordingHint: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#111",
    opacity: 0.4,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  errorBox: {
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#FF8888",
    padding: 12,
    marginBottom: 24,
    alignSelf: "stretch",
  },
  errorText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#CC0000" },
  transcriptScroll: { flex: 1, alignSelf: "stretch" },
  transcriptContent: { paddingBottom: 24 },
  transcriptLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    color: "#111",
    opacity: 0.4,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  transcriptText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#111",
    lineHeight: 22,
  },
  processingContainer: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 32,
  },
  processingText: {
    color: "#FDFFF5",
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  processingHint: {
    color: "#FDFFF5",
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    opacity: 0.5,
    textAlign: "center",
  },
  doneEmoji: { fontSize: 48, color: "#BFFF00" },
  snippetPreview: {
    borderLeftWidth: 3,
    borderLeftColor: "#BFFF00",
    paddingLeft: 16,
    marginTop: 8,
  },
  snippetText: {
    color: "#FDFFF5",
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 26,
    opacity: 0.8,
  },
});
