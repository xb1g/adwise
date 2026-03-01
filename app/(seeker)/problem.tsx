import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { matchElders, MatchResult } from "../../lib/ai";

const MOCK_MATCHES: MatchResult[] = [
  { elder_id: "mock-1", story_id: "s-1", rank: 1, match_reason: "Maria immigrated alone at 35 and rebuilt her career from scratch — exactly the fear of starting over you're describing." },
  { elder_id: "mock-2", story_id: "s-2", rank: 2, match_reason: "Robert founded three companies and lost two — he knows what it costs to bet on yourself." },
  { elder_id: "mock-3", story_id: "s-3", rank: 3, match_reason: "James spent 35 years in the wrong career before leaving — he understands the pull between safety and calling." },
  { elder_id: "mock-4", story_id: "s-4", rank: 4, match_reason: "Carlos lost his business in 2008 and rebuilt — he's walked the exact path you're afraid of." },
  { elder_id: "mock-5", story_id: "s-5", rank: 5, match_reason: "Linda reinvented her life at 55 — she knows what it means to choose yourself when it's terrifying." },
];

const PROBLEM_CATEGORIES = [
  "Career confusion", "Startup fear", "Marriage doubts",
  "Immigration", "Financial crisis", "Identity", "Grief", "Family conflict",
];

export default function ProblemScreen() {
  const { user } = useAuth();
  const [problemText, setProblemText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fullProblem = selectedCategory
    ? `[${selectedCategory}] ${problemText}`
    : problemText;

  const canSubmit = problemText.trim().length > 10;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);

    try {
      let matches: MatchResult[];

      // Swap to real API once Dev 3 deploys match function:
      // matches = await matchElders(fullProblem, user?.id);
      // For now, use mock:
      await new Promise((r) => setTimeout(r, 1500));
      matches = MOCK_MATCHES;

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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.title}>What's weighing on you?</Text>
        <Text style={styles.subtitle}>
          Be specific. The more honest you are, the better the match.
        </Text>

        <Text style={styles.label}>Category (optional)</Text>
        <View style={styles.chipRow}>
          {PROBLEM_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipSelected]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextSelected]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Describe your situation</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={6}
          placeholder="e.g. I'm 28 and terrified to leave my stable job to start a company. I have student loans and my parents think I'm crazy..."
          placeholderTextColor="#999"
          value={problemText}
          onChangeText={setProblemText}
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FDFFF5" />
          ) : (
            <Text style={styles.btnText}>Find my elders →</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Orbit_400Regular", color: "#111", opacity: 0.6, lineHeight: 22, marginBottom: 32 },
  label: { fontSize: 12, fontFamily: "Orbit_400Regular", color: "#111", opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, marginTop: 24 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1.5, borderColor: "#111", paddingVertical: 6, paddingHorizontal: 14 },
  chipSelected: { backgroundColor: "#BFFF00", borderColor: "#BFFF00" },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111" },
  chipTextSelected: { fontWeight: "700" },
  input: {
    borderWidth: 1.5, borderColor: "#111",
    padding: 16, fontFamily: "Orbit_400Regular",
    fontSize: 14, color: "#111", lineHeight: 22,
    minHeight: 140, marginTop: 8,
  },
  btn: { backgroundColor: "#111", paddingVertical: 16, alignItems: "center", marginTop: 32 },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: "#FDFFF5", fontFamily: "Orbit_400Regular", fontSize: 16, fontWeight: "700" },
});