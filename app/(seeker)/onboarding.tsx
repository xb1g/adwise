import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { transcribeAudio } from "../../lib/ai";

const AGE_RANGES = ["20s", "30s", "40s", "50s", "60s+"];
const CATEGORIES = [
  "Career confusion",
  "Startup fear",
  "Marriage doubts",
  "Immigration",
  "Financial crisis",
  "Identity",
  "Grief",
  "Family conflict",
];
const TOTAL_STEPS = 4;

export default function SeekerOnboarding() {
  const { user, signOut } = useAuth();

  // Navigation
  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState("");
  const [ageRange, setAgeRange] = useState<string | null>(null);

  // Step 2
  const [categories, setCategories] = useState<string[]>([]);

  // Step 3
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [problemText, setProblemText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Step 4
  const [saving, setSaving] = useState(false);

  // ── helpers ──────────────────────────────────────────────────────────────

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function exitOnboarding() {
    await signOut();
    router.replace("/");
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  // ── recording ────────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Microphone permission denied",
          "Please allow microphone access in settings, or switch to text mode.",
          [
            { text: "Use text instead", onPress: () => setInputMode("text") },
            { text: "OK" },
          ]
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error("[onboarding] start recording error:", err);
      Alert.alert("Error", "Could not start recording. Try text mode instead.");
      setInputMode("text");
    }
  }

  async function stopRecording() {
    if (!isRecording) return;
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) throw new Error("No recording URI");

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const transcript = await transcribeAudio(base64, "audio/m4a");
      setProblemText(transcript ?? "");
    } catch (err) {
      console.error("[onboarding] transcribe error:", err);
      Alert.alert("Transcription failed", "Please try again or switch to text mode.");
    } finally {
      setIsTranscribing(false);
    }
  }

  // ── submit ────────────────────────────────────────────────────────────────

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("seeker_profiles").upsert(
        {
          user_id: user.id,
          name,
          age_range: ageRange,
          categories,
          problem_text: problemText,
          onboarding_done: true,
        },
        { onConflict: "user_id" }
      );

      await supabase
        .from("wisdom_users")
        .update({ name })
        .eq("user_id", user.id);

      router.replace("/(seeker)/(tabs)/home");
    } catch (err) {
      console.error("[onboarding] save error:", err);
      Alert.alert("Save failed", "Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── progress dots ─────────────────────────────────────────────────────────

  function ProgressDots() {
    return (
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < step ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    );
  }

  // ── step 1 ────────────────────────────────────────────────────────────────

  function renderStep1() {
    const canContinue = name.trim().length >= 2 && ageRange !== null;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Who are you?</Text>
        <Text style={styles.stepSubtitle}>
          Tell us a little about yourself.
        </Text>

        <TextInput
          style={styles.textInput}
          placeholder="Your name"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
          autoCorrect={false}
        />

        <Text style={styles.sectionLabel}>Age range</Text>
        <View style={styles.chipRow}>
          {AGE_RANGES.map((range) => (
            <Pressable
              key={range}
              style={[
                styles.chip,
                ageRange === range ? styles.chipSelected : styles.chipUnselected,
              ]}
              onPress={() => setAgeRange(range)}
            >
              <Text
                style={[
                  styles.chipText,
                  ageRange === range
                    ? styles.chipTextSelected
                    : styles.chipTextUnselected,
                ]}
              >
                {range}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.continueBtn, !canContinue && styles.btnDisabled]}
          onPress={() => canContinue && setStep(2)}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>Continue →</Text>
        </Pressable>
      </View>
    );
  }

  // ── step 2 ────────────────────────────────────────────────────────────────

  function renderStep2() {
    const canContinue = categories.length >= 1;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>What's on your mind?</Text>
        <Text style={styles.stepSubtitle}>
          Select all that apply. You can pick more than one.
        </Text>

        <View style={styles.chipGrid}>
          {CATEGORIES.map((cat) => {
            const selected = categories.includes(cat);
            return (
              <Pressable
                key={cat}
                style={[
                  styles.chip,
                  selected ? styles.chipSelected : styles.chipUnselected,
                ]}
                onPress={() => toggleCategory(cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected
                      ? styles.chipTextSelected
                      : styles.chipTextUnselected,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.continueBtn, !canContinue && styles.btnDisabled]}
          onPress={() => canContinue && setStep(3)}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>Continue →</Text>
        </Pressable>
      </View>
    );
  }

  // ── step 3 ────────────────────────────────────────────────────────────────

  function renderStep3() {
    const canContinue =
      inputMode === "voice"
        ? problemText.length > 5
        : problemText.length > 10;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Describe your situation.</Text>
        <Text style={styles.stepSubtitle}>
          Speak or type. Be as open as you like.
        </Text>

        {inputMode === "voice" ? (
          <View style={styles.voiceContainer}>
            <Pressable
              style={[
                styles.micBtn,
                isRecording && styles.micBtnRecording,
                isTranscribing && styles.btnDisabled,
              ]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <ActivityIndicator color="#BFFF00" size="large" />
              ) : (
                <Text style={styles.micIcon}>
                  {isRecording ? "⏹" : "🎙"}
                </Text>
              )}
            </Pressable>

            <Text style={styles.micHint}>
              {isTranscribing
                ? "Transcribing..."
                : isRecording
                ? "Release to stop"
                : "Hold to record"}
            </Text>

            {problemText.length > 0 && (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptText}>{problemText}</Text>
              </View>
            )}

            <Pressable onPress={() => setInputMode("text")}>
              <Text style={styles.modeToggleLink}>prefer to type?</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.textModeContainer}>
            <TextInput
              style={styles.multilineInput}
              placeholder="Describe what you're going through..."
              placeholderTextColor="#888"
              multiline
              value={problemText}
              onChangeText={setProblemText}
              textAlignVertical="top"
            />
            <Pressable onPress={() => setInputMode("voice")}>
              <Text style={styles.modeToggleLink}>prefer voice? 🎙</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={[styles.continueBtn, !canContinue && styles.btnDisabled]}
          onPress={() => canContinue && setStep(4)}
          disabled={!canContinue || isRecording || isTranscribing}
        >
          <Text style={styles.continueBtnText}>Continue →</Text>
        </Pressable>
      </View>
    );
  }

  // ── step 4 ────────────────────────────────────────────────────────────────

  function renderSummaryRow({
    icon,
    label,
    value,
    onEdit,
  }: {
    icon: string;
    label: string;
    value: string;
    onEdit: () => void;
  }) {
    return (
      <Pressable style={styles.summaryRow} onPress={onEdit}>
        <View style={styles.summaryRowLeft}>
          <Text style={styles.summaryIcon}>{icon}</Text>
          <View>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue} numberOfLines={3}>
              {value}
            </Text>
          </View>
        </View>
        <Text style={styles.summaryEdit}>Edit</Text>
      </Pressable>
    );
  }

  function renderStep4() {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Here's your profile.</Text>
        <Text style={styles.stepSubtitle}>
          Review and tap any row to edit.
        </Text>

        <View style={styles.summaryCard}>
          {renderSummaryRow({
            icon: "🎯",
            label: "Areas",
            value: categories.join(" · "),
            onEdit: () => setStep(2),
          })}
          <View style={styles.summaryDivider} />
          {renderSummaryRow({
            icon: "💬",
            label: "Situation",
            value: problemText,
            onEdit: () => setStep(3),
          })}
          <View style={styles.summaryDivider} />
          {renderSummaryRow({
            icon: "👤",
            label: "Age range",
            value: ageRange ?? "",
            onEdit: () => setStep(1),
          })}
        </View>

        <Pressable
          style={[styles.finishBtn, saving && styles.btnDisabled]}
          onPress={handleFinish}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.finishBtnText}>Enter adwise →</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {step > 1 ? (
            <Pressable style={styles.backBtn} onPress={goBack} hitSlop={12}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.backBtn} onPress={exitOnboarding} hitSlop={12}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          )}
          <ProgressDots />
          <View style={styles.backBtn} />
        </View>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FDFFF5",
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 48,
  },

  // Header + dots
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    minWidth: 64,
  },
  backBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#666",
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#111",
  },
  dotActive: {
    backgroundColor: "#BFFF00",
    borderColor: "#111",
  },
  dotInactive: {
    backgroundColor: "transparent",
    borderColor: "#CCC",
  },

  // Step shell
  stepContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    flex: 1,
  },
  stepTitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 32,
    fontWeight: "900",
    color: "#111",
    lineHeight: 40,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
    marginBottom: 32,
  },

  // Text input
  textInput: {
    fontFamily: "Orbit_400Regular",
    fontSize: 18,
    color: "#111",
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 28,
    backgroundColor: "#FFF",
  },
  sectionLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 36,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 36,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 2,
  },
  chipSelected: {
    backgroundColor: "#BFFF00",
    borderColor: "#111",
  },
  chipUnselected: {
    backgroundColor: "transparent",
    borderColor: "#CCC",
  },
  chipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: "#111",
  },
  chipTextUnselected: {
    color: "#555",
  },

  // Continue button
  continueBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 20,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#111",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },

  // Voice mode
  voiceContainer: {
    alignItems: "center",
    marginBottom: 28,
    gap: 16,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#333",
  },
  micBtnRecording: {
    backgroundColor: "#222",
    borderColor: "#BFFF00",
    shadowColor: "#BFFF00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  micIcon: {
    fontSize: 32,
  },
  micHint: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#888",
    fontWeight: "700",
  },
  transcriptBox: {
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 14,
    padding: 16,
    width: "100%",
  },
  transcriptText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#111",
    lineHeight: 24,
  },
  modeToggleLink: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#888",
    textDecorationLine: "underline",
    marginTop: 4,
  },

  // Text mode
  textModeContainer: {
    marginBottom: 28,
    gap: 12,
  },
  multilineInput: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#111",
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 14,
    padding: 16,
    minHeight: 120,
    backgroundColor: "#FFF",
    lineHeight: 24,
  },

  // Summary card
  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#111",
    marginBottom: 32,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  summaryRowLeft: {
    flexDirection: "row",
    gap: 14,
    flex: 1,
    marginRight: 12,
  },
  summaryIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  summaryLabel: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#111",
    lineHeight: 22,
    fontWeight: "700",
    flexShrink: 1,
  },
  summaryEdit: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#888",
    textDecorationLine: "underline",
    marginTop: 4,
  },
  summaryDivider: {
    height: 2,
    backgroundColor: "#F0F0E8",
    marginHorizontal: 20,
  },

  // Finish button
  finishBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#111",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  finishBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },

  // Shared
  btnDisabled: {
    opacity: 0.3,
  },
});
