import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { matchElders, MatchResult } from "../../lib/ai";
import { supabase } from "../../lib/supabase";


const PROBLEM_PROMPTS = [
  "Career confusion",
  "Starting a business",
  "Marriage doubts",
  "Immigration questions",
  "Recovering from failure",
];

export default function ProblemScreen() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [problemText, setProblemText] = useState("");
  const [loading, setLoading] = useState(false);

  // We no longer strictly separate 'category' for the user input in UI,
  // but if clicked, we can append it or use it as a starter.
  const handlePromptClick = (prompt: string) => {
    if (problemText.includes(prompt)) return;
    setProblemText((prev) => (prev ? prev + "\n" + prompt : prompt));
  };

  const canSubmit = name.trim().length > 0 && problemText.trim().length > 10;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);

    try {
      let userId = user?.id;

      if (!userId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        userId = data.session?.user.id;
        if (userId) {
          await supabase
            .from("wisdom_users")
            .upsert({ user_id: userId, role: "seeker", name: name.trim() }, { onConflict: "user_id" });
        }
      } else {
        await supabase
          .from("wisdom_users")
          .update({ name: name.trim() })
          .eq("user_id", userId);
      }

      let matches: MatchResult[];

      matches = await matchElders(problemText, user?.id ?? undefined);

      router.push({
        pathname: "/(seeker)/matches",
        params: {
          matches: JSON.stringify(matches),
          problem: problemText,
        },
      });
    } catch (err) {
      console.error("Match failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
      >
        <Pressable style={styles.backBtn} onPress={() => router.replace("/")} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>What problem are you facing right now?</Text>

        <TextInput
          style={styles.nameInput}
          placeholder="Your name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          multiline
          numberOfLines={8}
          placeholder="e.g. I'm 28 and terrified to leave my stable job to start a company. I have student loans and my parents think I'm crazy..."
          placeholderTextColor="#999"
          value={problemText}
          onChangeText={setProblemText}
          textAlignVertical="top"
        />

        <View style={styles.promptsContainer}>
          {PROBLEM_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              style={styles.promptChip}
              onPress={() => handlePromptClick(prompt)}
            >
              <Text style={styles.promptChipText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.btnText}>Find People Who've Lived This</Text>
          )}
        </Pressable>

        {/* Trust Signals */}
        <View style={styles.trustSignals}>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>•</Text>
            <Text style={styles.trustText}>See top 5 matches</Text>
          </View>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>•</Text>
            <Text style={styles.trustText}>Unlock stories</Text>
          </View>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>•</Text>
            <Text style={styles.trustText}>Book a call if helpful</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 48 },
  backBtn: { position: "absolute", top: 60, left: 24, zIndex: 10, padding: 4 },
  backText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#666",
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: "Orbit_400Regular",
    fontWeight: "900",
    color: "#111",
    marginBottom: 24,
    marginTop: 20,
    letterSpacing: -0.5,
  },
  input: {
    borderWidth: 2,
    borderColor: "#111",
    padding: 16,
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#111",
    lineHeight: 24,
    minHeight: 180,
    backgroundColor: "#FFF",
    borderRadius: 12,
  },
  nameInput: {
    borderWidth: 2,
    borderColor: "#111",
    padding: 16,
    fontFamily: "Orbit_400Regular",
    fontSize: 16,
    color: "#111",
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginBottom: 12,
  },
  promptsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: "#DDD",
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  promptChipText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#555",
  },
  btn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 40,
    borderWidth: 2,
    borderColor: "#111",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  btnText: {
    color: "#111",
    fontFamily: "Orbit_400Regular",
    fontSize: 17,
    fontWeight: "900",
  },
  trustSignals: {
    marginTop: 24,
    gap: 8,
    alignItems: "center", // center horizontally for bottom trust block
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trustIcon: {
    fontSize: 16,
    color: "#666",
  },
  trustText: {
    fontSize: 14,
    fontFamily: "Orbit_400Regular",
    color: "#666",
  },
});
