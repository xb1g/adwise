# Adwise — Dev 2: Seeker Screens Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all seeker-facing screens — problem submission, top 5 match results, and elder detail with unlock/book CTAs.

**Architecture:** Expo Router group `app/(seeker)/` with stack navigation. Problem submitted → `matchElders()` from `lib/ai.ts` → results displayed as ranked cards. Start against mock data (Task 1), swap to real API once Dev 3 deploys match function (Task 3).

**Tech Stack:** Expo Router v6, React Native, Supabase JS client, TypeScript

**Spec:** `docs/superpowers/specs/2026-02-28-adwise-wisdom-marketplace-design.md`

**Depends on Dev 3:** seeded elder profiles in `elder_profiles` + `stories` tables (available by hour 2), `matchElders()` helper in `lib/ai.ts` (available by hour 12). Build Tasks 1–2 with mock data, wire real API in Task 3.

---

## Chunk 1: Layout + Problem Submission

### Task 1: Seeker group layout and problem screen

**Files:**
- Create: `app/(seeker)/_layout.tsx`
- Create: `app/(seeker)/problem.tsx`

- [ ] Create seeker group layout:

```typescript
// app/(seeker)/_layout.tsx
import { Stack } from "expo-router";

export default function SeekerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] Create problem submission screen:

```typescript
// app/(seeker)/problem.tsx
import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { matchElders, MatchResult } from "../../lib/ai";

// Mock data for dev — remove once match edge function is live
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
      await new Promise((r) => setTimeout(r, 1500)); // simulate network
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
```

- [ ] Run and verify: seeker → problem screen renders, chips toggle, text input works, submit button activates when text > 10 chars.

```bash
pnpm ios
```

- [ ] Commit:

```bash
git add app/(seeker)/_layout.tsx app/(seeker)/problem.tsx
git commit -m "feat: seeker problem submission screen (with mock matches)"
```

---

## Chunk 2: Match Results Screen

### Task 2: Top 5 elder match cards

**Files:**
- Create: `app/(seeker)/matches.tsx`

- [ ] Create matches screen. Receives `matches` JSON and `problem` string via route params:

```typescript
// app/(seeker)/matches.tsx
import { useLocalSearchParams, router } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { MatchResult } from "../../lib/ai";

type ElderCard = MatchResult & {
  bio: string;
  age_range: string;
  life_areas: string[];
  preview_text: string;
};

// Fallback mock elder data for offline dev (keyed by mock elder_id)
const MOCK_ELDERS: Record<string, Partial<ElderCard>> = {
  "mock-1": { bio: "Moved from the Philippines at 35 with $200. Became a registered nurse, raised three kids alone.", age_range: "60s", life_areas: ["immigration", "career", "family"], preview_text: "Left everything behind at 35 to start over in a new country — here's what she learned." },
  "mock-2": { bio: "Founded three companies — two failed. Spent five years in depression before finding purpose.", age_range: "70s", life_areas: ["startup", "failure", "reinvention"], preview_text: "Lost two companies, a marriage, and his savings — then built something that mattered." },
  "mock-3": { bio: "Spent 35 years in finance, then quit at 58 to write poetry — the dream he abandoned at 22.", age_range: "60s", life_areas: ["identity", "career", "immigration"], preview_text: "Spent 35 years in the wrong life — and had the courage to change it at 58." },
  "mock-4": { bio: "Lost his construction business in 2008, went bankrupt at 55, rebuilt to employ 30 people.", age_range: "70s", life_areas: ["financial-recovery", "career", "family"], preview_text: "Lost everything in 2008 at 55 and rebuilt from zero — twice." },
  "mock-5": { bio: "Stayed in a difficult marriage for 28 years, rebuilt from scratch at 55.", age_range: "60s", life_areas: ["marriage", "divorce", "reinvention"], preview_text: "Left a 28-year marriage at 55 and discovered who she actually was." },
};

export default function MatchesScreen() {
  const { matches: matchesParam, problem } = useLocalSearchParams<{ matches: string; problem: string }>();
  const [cards, setCards] = useState<ElderCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const matches: MatchResult[] = JSON.parse(matchesParam ?? "[]");
    loadElderData(matches);
  }, [matchesParam]);

  async function loadElderData(matches: MatchResult[]) {
    const elderIds = matches.map((m) => m.elder_id).filter((id) => !id.startsWith("mock-"));

    if (elderIds.length > 0) {
      // Real data from DB
      const { data: profiles } = await supabase
        .from("elder_profiles")
        .select("id, bio, age_range, life_areas")
        .in("id", elderIds);

      const { data: stories } = await supabase
        .from("stories")
        .select("elder_id, preview_text")
        .in("elder_id", elderIds)
        .eq("status", "published");

      const enriched: ElderCard[] = matches.map((m) => {
        const profile = profiles?.find((p) => p.id === m.elder_id);
        const story = stories?.find((s) => s.elder_id === m.elder_id);
        return {
          ...m,
          bio: profile?.bio ?? "",
          age_range: profile?.age_range ?? "",
          life_areas: profile?.life_areas ?? [],
          preview_text: story?.preview_text ?? "",
        };
      });

      setCards(enriched);
    } else {
      // Mock data
      const enriched: ElderCard[] = matches.map((m) => ({
        ...m,
        ...(MOCK_ELDERS[m.elder_id] ?? {}),
        bio: MOCK_ELDERS[m.elder_id]?.bio ?? "",
        age_range: MOCK_ELDERS[m.elder_id]?.age_range ?? "",
        life_areas: MOCK_ELDERS[m.elder_id]?.life_areas ?? [],
        preview_text: MOCK_ELDERS[m.elder_id]?.preview_text ?? "",
      }));
      setCards(enriched);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Finding your elders...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Your top matches</Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        For: "{problem}"
      </Text>

      {cards.map((card, index) => (
        <Pressable
          key={card.elder_id}
          style={[styles.card, index === 0 && styles.cardBest]}
          onPress={() =>
            router.push({
              pathname: "/(seeker)/elder/[id]",
              params: {
                id: card.elder_id,
                storyId: card.story_id,
                matchReason: card.match_reason,
                bio: card.bio,
                ageRange: card.age_range,
                lifeAreas: JSON.stringify(card.life_areas),
                previewText: card.preview_text,
              },
            })
          }
        >
          {index === 0 && (
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>Best Match</Text>
            </View>
          )}

          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{index + 1}</Text>
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.ageRange}>{card.age_range}</Text>
              <View style={styles.chipRow}>
                {(card.life_areas ?? []).slice(0, 3).map((a) => (
                  <View key={a} style={styles.chip}>
                    <Text style={styles.chipText}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.bio} numberOfLines={2}>{card.bio}</Text>
          <Text style={styles.matchReason}>✦ {card.match_reason}</Text>
          <Text style={styles.cta}>Read their story →</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 48 },
  loadingContainer: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  loadingText: { fontFamily: "Orbit_400Regular", color: "#BFFF00", fontSize: 18 },
  back: { marginBottom: 24 },
  backText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", opacity: 0.5 },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 8 },
  subtitle: { fontSize: 13, fontFamily: "Orbit_400Regular", color: "#111", opacity: 0.5, marginBottom: 32, lineHeight: 20 },
  card: { borderWidth: 1.5, borderColor: "#111", padding: 20, marginBottom: 16 },
  cardBest: { borderColor: "#BFFF00", borderWidth: 2.5, backgroundColor: "#F8FFE0" },
  bestBadge: { backgroundColor: "#BFFF00", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, marginBottom: 12 },
  bestBadgeText: { fontFamily: "Orbit_400Regular", fontSize: 11, fontWeight: "700", color: "#111" },
  cardHeader: { flexDirection: "row", gap: 16, marginBottom: 12 },
  avatar: { width: 44, height: 44, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#BFFF00", fontFamily: "Orbit_400Regular", fontSize: 18, fontWeight: "700" },
  cardMeta: { flex: 1, gap: 8 },
  ageRange: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#111", paddingVertical: 2, paddingHorizontal: 8 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111" },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 22, marginBottom: 10 },
  matchReason: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#555", lineHeight: 20, marginBottom: 14, fontStyle: "italic" },
  cta: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", fontWeight: "700" },
});
```

- [ ] Verify: mock matches render as ranked cards, best match has highlighted border and badge, tapping a card navigates to elder detail.

- [ ] Commit:

```bash
git add app/(seeker)/matches.tsx
git commit -m "feat: seeker match results screen (top 5 elder cards)"
```

---

## Chunk 3: Elder Detail Screen

### Task 3: Elder profile detail with unlock/book CTAs

**Files:**
- Create: `app/(seeker)/elder/[id].tsx`

- [ ] Create the elder detail screen. Receives all data via route params (no extra DB fetch needed for hackathon):

```typescript
// app/(seeker)/elder/[id].tsx
import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

export default function ElderDetail() {
  const { id, matchReason, bio, ageRange, lifeAreas, previewText } =
    useLocalSearchParams<{
      id: string;
      storyId: string;
      matchReason: string;
      bio: string;
      ageRange: string;
      lifeAreas: string;
      previewText: string;
    }>();

  const [unlocked, setUnlocked] = useState(false);
  const areas: string[] = JSON.parse(lifeAreas ?? "[]");

  function handleUnlock() {
    // Demo: show unlock animation, in prod this would be a paywall
    setUnlocked(true);
  }

  function handleBook() {
    Alert.alert(
      "Book a conversation",
      "In the full version, you'd schedule a 30-minute call with this elder. Coming soon.",
      [{ text: "Got it" }]
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back to matches</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>◎</Text>
        </View>
        <View>
          <Text style={styles.ageRange}>{ageRange}</Text>
          <View style={styles.chipRow}>
            {areas.map((a) => (
              <View key={a} style={styles.chip}>
                <Text style={styles.chipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Match reason */}
      <View style={styles.matchBox}>
        <Text style={styles.matchLabel}>Why you matched</Text>
        <Text style={styles.matchReason}>{matchReason}</Text>
      </View>

      {/* Bio */}
      <Text style={styles.bio}>{bio}</Text>

      {/* Story section */}
      <Text style={styles.sectionLabel}>Their story</Text>

      {!unlocked ? (
        <View>
          <Text style={styles.preview}>{previewText}</Text>
          <View style={styles.blurOverlay}>
            <Text style={styles.blurText}>
              Unlock to read the full story — the struggles, the turning points, the lessons.
            </Text>
            <Pressable style={styles.unlockBtn} onPress={handleUnlock}>
              <Text style={styles.unlockBtnText}>Unlock full story — $2</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.unlockedStory}>
          <Text style={styles.unlockedText}>
            {/* In prod: fetch full story transcript/snippets from DB */}
            {bio}{"\n\n"}
            The full story is available in the complete app. During this demo, imagine 10 minutes of
            this elder speaking directly to your situation — the exact moment they faced what you're
            facing, and what happened next.
          </Text>
        </View>
      )}

      {/* Book CTA */}
      <Pressable style={styles.bookBtn} onPress={handleBook}>
        <Text style={styles.bookBtnText}>Book a 30-min conversation — $30</Text>
      </Pressable>

      <Text style={styles.bookNote}>
        Real conversations with real people who have lived your exact problem.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 64 },
  back: { marginBottom: 32 },
  backText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.5 },
  header: { flexDirection: "row", gap: 16, alignItems: "flex-start", marginBottom: 24 },
  avatar: { width: 56, height: 56, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#BFFF00", fontSize: 24 },
  ageRange: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.6, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#111", paddingVertical: 2, paddingHorizontal: 8 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111" },
  matchBox: { backgroundColor: "#F0FFD4", padding: 16, marginBottom: 24, gap: 8 },
  matchLabel: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111", opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5 },
  matchReason: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 22 },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 26, marginBottom: 32 },
  sectionLabel: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111", opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 },
  preview: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 26, marginBottom: 16, fontStyle: "italic" },
  blurOverlay: { backgroundColor: "#F5F5F0", padding: 24, alignItems: "center", gap: 20, borderWidth: 1, borderColor: "#DDD" },
  blurText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", textAlign: "center", lineHeight: 22, opacity: 0.7 },
  unlockBtn: { backgroundColor: "#111", paddingVertical: 14, paddingHorizontal: 32 },
  unlockBtnText: { fontFamily: "Orbit_400Regular", fontSize: 15, fontWeight: "700", color: "#BFFF00" },
  unlockedStory: { backgroundColor: "#F8FFE8", padding: 20, borderLeftWidth: 3, borderLeftColor: "#BFFF00" },
  unlockedText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 24 },
  bookBtn: { backgroundColor: "#BFFF00", paddingVertical: 16, alignItems: "center", marginTop: 40 },
  bookBtnText: { fontFamily: "Orbit_400Regular", fontSize: 15, fontWeight: "700", color: "#111" },
  bookNote: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111", opacity: 0.5, textAlign: "center", marginTop: 12, lineHeight: 18 },
});
```

- [ ] Verify: elder detail renders with match reason box, bio, blurred preview + unlock button. Tapping unlock reveals full story area. Book button shows alert.

- [ ] Commit:

```bash
git add "app/(seeker)/elder/[id].tsx"
git commit -m "feat: elder detail screen (preview, unlock, book CTAs)"
```

---

## Chunk 4: Wire Real Matching API

### Task 4: Swap mock data for real match edge function

**Do this after Dev 3 confirms `match` edge function is deployed.**

**Files:**
- Modify: `app/(seeker)/problem.tsx`

- [ ] In `app/(seeker)/problem.tsx`, replace the mock section:

Find this block:
```typescript
      // Swap to real API once Dev 3 deploys match function:
      // matches = await matchElders(fullProblem, user?.id);
      // For now, use mock:
      await new Promise((r) => setTimeout(r, 1500)); // simulate network
      matches = MOCK_MATCHES;
```

Replace with:
```typescript
      matches = await matchElders(fullProblem, user?.id ?? undefined);
```

- [ ] Also remove the `MOCK_MATCHES` constant and `MOCK_ELDERS` from `matches.tsx` once real DB data is confirmed working.

- [ ] Test the full seeker flow end-to-end:
  1. Sign in as seeker
  2. Type a real problem (e.g. "I'm scared to leave my job to start a company")
  3. Tap "Find my elders"
  4. Verify top 5 results appear with specific match reasons
  5. Tap the best match → verify detail screen shows real bio + preview

- [ ] Commit:

```bash
git add "app/(seeker)/problem.tsx" "app/(seeker)/matches.tsx"
git commit -m "feat: wire real match API (swap mock for matchElders())"
```
