# Adwise — Dev 1: Elder Screens Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all elder-facing screens — role selection entry, elder profile setup, voice recording, processing/structuring animation, and published wisdom profile view.

**Architecture:** Expo Router group `app/(elder)/` with stack navigation. Voice recording via expo-av. Audio uploaded to Supabase storage as base64, then transcribed via `transcribeAudio()` + structured via `structureStory()` from `lib/ai.ts` (Dev 3 delivers these).

**Tech Stack:** Expo Router v6, expo-av (install needed), React Native, Supabase JS client, TypeScript

**Spec:** `docs/superpowers/specs/2026-02-28-adwise-wisdom-marketplace-design.md`

**Depends on Dev 3:** `wisdom_users` table, `elder_profiles` table, `stories` table, `transcribeAudio()` and `structureStory()` helpers in `lib/ai.ts`. Start with Tasks 1–3 while Dev 3 finishes backend.

---

## Chunk 1: Setup & Entry Point

### Task 1: Install expo-av and update root layout

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`

- [ ] Install expo-av:

```bash
pnpm add expo-av
```

- [ ] Read the current `app/_layout.tsx` to understand the existing auth routing logic before modifying.

- [ ] Update `app/_layout.tsx` to route based on `wisdom_role`. The existing file routes signed-in users to `/(tabs)/goals`. Change the post-auth destination to check `wisdom_users` table for role:

```typescript
// app/_layout.tsx
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { router } from "expo-router";
import * as Font from "expo-font";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type WisdomRole = "elder" | "seeker" | null;

function RootNavigator() {
  const { session, loading } = useAuth();
  const [role, setRole] = useState<WisdomRole>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    setRoleLoading(true);
    supabase
      .from("wisdom_users")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole((data?.role as WisdomRole) ?? null);
        setRoleLoading(false);
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading || roleLoading) return;

    if (!session) {
      router.replace("/");
    } else if (!role) {
      router.replace("/role-select");
    } else if (role === "elder") {
      router.replace("/(elder)/profile");
    } else {
      router.replace("/(seeker)/problem");
    }
  }, [session, loading, role, roleLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="role-select" />
      <Stack.Screen name="(elder)" />
      <Stack.Screen name="(seeker)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = Font.useFonts({
    Orbit_400Regular: require("../assets/Orbit_400Regular.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
```

- [ ] Create `app/role-select.tsx` — shown after sign-in when no role set yet:

```typescript
// app/role-select.tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function RoleSelect() {
  const { user } = useAuth();

  async function selectRole(role: "elder" | "seeker") {
    if (!user) return;

    await supabase.from("wisdom_users").upsert({
      user_id: user.id,
      name: user.user_metadata?.full_name ?? "",
      role,
    });

    if (role === "elder") {
      router.replace("/(elder)/setup");
    } else {
      router.replace("/(seeker)/problem");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>adwise</Text>
      <Text style={styles.subtitle}>What brings you here?</Text>

      <Pressable style={styles.card} onPress={() => selectRole("elder")}>
        <Text style={styles.cardTitle}>I have wisdom</Text>
        <Text style={styles.cardDesc}>
          Share your life story. Help someone who is exactly where you were.
        </Text>
      </Pressable>

      <Pressable style={[styles.card, styles.cardAccent]} onPress={() => selectRole("seeker")}>
        <Text style={styles.cardTitle}>I need wisdom</Text>
        <Text style={styles.cardDesc}>
          Describe your challenge. Meet elders who have lived through it.
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFFF5",
    paddingTop: 100,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    marginBottom: 48,
    opacity: 0.6,
  },
  card: {
    borderWidth: 2,
    borderColor: "#111",
    padding: 24,
    marginBottom: 16,
  },
  cardAccent: {
    backgroundColor: "#BFFF00",
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Orbit_400Regular",
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    lineHeight: 22,
  },
});
```

- [ ] Run the app and verify: sign in → role-select screen appears → tapping a role navigates correctly (elder group, seeker group).

```bash
pnpm ios
```

- [ ] Commit:

```bash
git add app/_layout.tsx app/role-select.tsx
git commit -m "feat: role-select screen + root routing for elder/seeker"
```

---

## Chunk 2: Elder Setup Screen

### Task 2: Elder profile setup

**Files:**
- Create: `app/(elder)/_layout.tsx`
- Create: `app/(elder)/setup.tsx`

- [ ] Create elder group layout:

```typescript
// app/(elder)/_layout.tsx
import { Stack } from "expo-router";

export default function ElderLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] Create setup screen:

```typescript
// app/(elder)/setup.tsx
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

const AGE_RANGES = ["50s", "60s", "70s", "80s+"] as const;

const LIFE_AREA_OPTIONS = [
  "career", "immigration", "startup", "marriage", "divorce",
  "grief", "financial-recovery", "creativity", "identity",
  "family", "health", "education", "reinvention",
];

export default function ElderSetup() {
  const { user } = useAuth();
  const [ageRange, setAgeRange] = useState<string>("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleArea(area: string) {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  async function handleContinue() {
    if (!ageRange || selectedAreas.length === 0 || !user) return;
    setSaving(true);

    const { error } = await supabase.from("elder_profiles").insert({
      user_id: user.id,
      age_range: ageRange,
      life_areas: selectedAreas,
      bio: "",
      is_seeded: false,
    });

    setSaving(false);
    if (!error) router.replace("/(elder)/record");
  }

  const canContinue = ageRange !== "" && selectedAreas.length > 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your story starts here</Text>
      <Text style={styles.label}>How old are you?</Text>
      <View style={styles.row}>
        {AGE_RANGES.map((r) => (
          <Pressable
            key={r}
            style={[styles.chip, ageRange === r && styles.chipSelected]}
            onPress={() => setAgeRange(r)}
          >
            <Text style={[styles.chipText, ageRange === r && styles.chipTextSelected]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>What have you lived through? (pick all that apply)</Text>
      <View style={styles.row}>
        {LIFE_AREA_OPTIONS.map((area) => (
          <Pressable
            key={area}
            style={[styles.chip, selectedAreas.includes(area) && styles.chipSelected]}
            onPress={() => toggleArea(area)}
          >
            <Text style={[styles.chipText, selectedAreas.includes(area) && styles.chipTextSelected]}>
              {area}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.btn, !canContinue && styles.btnDisabled]}
        onPress={handleContinue}
        disabled={!canContinue || saving}
      >
        {saving ? (
          <ActivityIndicator color="#FDFFF5" />
        ) : (
          <Text style={styles.btnText}>Record my story →</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 40 },
  label: { fontSize: 14, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 12, marginTop: 24, opacity: 0.7 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1.5, borderColor: "#111", paddingVertical: 6, paddingHorizontal: 14 },
  chipSelected: { backgroundColor: "#BFFF00", borderColor: "#BFFF00" },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111" },
  chipTextSelected: { fontWeight: "700" },
  btn: { backgroundColor: "#111", paddingVertical: 16, alignItems: "center", marginTop: 48 },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: "#FDFFF5", fontFamily: "Orbit_400Regular", fontSize: 16, fontWeight: "700" },
});
```

- [ ] Verify: elder setup renders, chips toggle correctly, Continue button disabled until both age + area selected.

- [ ] Commit:

```bash
git add app/(elder)/
git commit -m "feat: elder setup screen (age range + life area chips)"
```

---

## Chunk 3: Voice Recording Screen

### Task 3: Voice recording with expo-av

**Files:**
- Create: `app/(elder)/record.tsx`

- [ ] Create record screen:

```typescript
// app/(elder)/record.tsx
import { useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { Audio } from "expo-av";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { transcribeAudio, structureStory } from "../../lib/ai";

// Note: expo-file-system may need install: pnpm add expo-file-system
// If not installed: pnpm add expo-file-system

export default function RecordScreen() {
  const { user } = useAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "transcribing" | "structuring">("idle");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setStatus("recording");

      // Pulse animation while recording
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }

  async function stopAndProcess() {
    if (!recording || !user) return;
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    setIsRecording(false);
    setProcessing(true);

    try {
      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error("No recording URI");

      // Read as base64
      setStatus("uploading");
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Transcribe
      setStatus("transcribing");
      const transcript = await transcribeAudio(base64, "audio/m4a");

      // Structure
      setStatus("structuring");
      const structured = await structureStory(transcript);

      // Find elder_profile for this user
      const { data: profile } = await supabase
        .from("elder_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Elder profile not found");

      // Save story
      const audioPath = `${user.id}/${Date.now()}.m4a`;
      const { data: uploadData } = await supabase.storage
        .from("story-audio")
        .upload(audioPath, base64, { contentType: "audio/m4a" });

      const audioUrl = uploadData?.path ?? "";

      await supabase.from("stories").insert({
        elder_id: profile.id,
        audio_url: audioUrl,
        transcript,
        life_areas: structured.life_areas,
        key_topics: structured.key_topics,
        wisdom_snippets: structured.wisdom_snippets,
        preview_text: structured.preview_text,
        tags: structured.tags,
        status: "published",
      });

      // Update elder bio
      await supabase
        .from("elder_profiles")
        .update({ bio: structured.bio, life_areas: structured.life_areas })
        .eq("id", profile.id);

      router.replace("/(elder)/profile");
    } catch (err) {
      console.error("Processing failed:", err);
      setProcessing(false);
      setStatus("idle");
    }
  }

  const statusLabels = {
    idle: "Hold to record your story",
    recording: "Recording... release when done",
    uploading: "Uploading...",
    transcribing: "Transcribing your voice...",
    structuring: "Structuring your wisdom...",
  };

  if (processing) {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color="#BFFF00" />
        <Text style={styles.processingText}>{statusLabels[status]}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tell your story</Text>
      <Text style={styles.hint}>Speak freely. Talk about what you've been through and what you learned.</Text>

      <View style={styles.recordArea}>
        <Animated.View style={[styles.recordRing, { transform: [{ scale: pulseAnim }] }]}>
          <Pressable
            style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
            onPressIn={startRecording}
            onPressOut={stopAndProcess}
          >
            <View style={[styles.recordDot, isRecording && styles.recordDotActive]} />
          </Pressable>
        </Animated.View>
        <Text style={styles.statusText}>{statusLabels[status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFFF5", paddingTop: 100, paddingHorizontal: 24, alignItems: "center" },
  processingContainer: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", gap: 24 },
  processingText: { color: "#FDFFF5", fontFamily: "Orbit_400Regular", fontSize: 18, textAlign: "center" },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 16, alignSelf: "flex-start" },
  hint: { fontSize: 14, fontFamily: "Orbit_400Regular", color: "#111", opacity: 0.6, lineHeight: 22, marginBottom: 80 },
  recordArea: { alignItems: "center", gap: 32 },
  recordRing: { width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: "#BFFF00", alignItems: "center", justifyContent: "center" },
  recordBtn: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  recordBtnActive: { backgroundColor: "#222" },
  recordDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#BFFF00" },
  recordDotActive: { borderRadius: 6, backgroundColor: "#FF4444" },
  statusText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", opacity: 0.7, textAlign: "center" },
});
```

- [ ] If `expo-file-system` is not already installed:

```bash
pnpm add expo-file-system
```

- [ ] Verify: hold button starts recording (dot turns red), release triggers processing state with cycling status text.

- [ ] Commit:

```bash
git add app/(elder)/record.tsx
git commit -m "feat: elder voice recording screen (expo-av + ElevenLabs + Mistral pipeline)"
```

---

## Chunk 4: Elder Profile View

### Task 4: Published wisdom profile screen

**Files:**
- Create: `app/(elder)/profile.tsx`

- [ ] Create profile screen:

```typescript
// app/(elder)/profile.tsx
import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type Story = {
  id: string;
  wisdom_snippets: string[];
  preview_text: string;
  life_areas: string[];
  tags: string[];
  status: string;
};

type ElderProfile = {
  id: string;
  age_range: string;
  life_areas: string[];
  bio: string;
};

export default function ElderProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data: ep } = await supabase
      .from("elder_profiles")
      .select("id, age_range, life_areas, bio")
      .eq("user_id", user!.id)
      .maybeSingle();

    setProfile(ep);

    if (ep) {
      const { data: s } = await supabase
        .from("stories")
        .select("id, wisdom_snippets, preview_text, life_areas, tags, status")
        .eq("elder_id", ep.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setStory(s);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" />
      </View>
    );
  }

  // No profile yet — send to setup
  if (!profile) {
    router.replace("/(elder)/setup");
    return null;
  }

  // Profile but no story — send to record
  if (!story) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome, elder.</Text>
        <Text style={styles.subtitle}>Your profile is ready. Now record your story.</Text>
        <Pressable style={styles.btn} onPress={() => router.push("/(elder)/record")}>
          <Text style={styles.btnText}>Record my story →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your wisdom profile</Text>

      <View style={styles.bioCard}>
        <Text style={styles.bio}>{profile.bio}</Text>
        <View style={styles.chipRow}>
          {profile.life_areas.map((a) => (
            <View key={a} style={styles.chip}>
              <Text style={styles.chipText}>{a}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Your wisdom</Text>
      {story.wisdom_snippets.map((s, i) => (
        <View key={i} style={styles.quoteCard}>
          <Text style={styles.quote}>" {s} "</Text>
        </View>
      ))}

      <Pressable style={styles.recordAgainBtn} onPress={() => router.push("/(elder)/record")}>
        <Text style={styles.recordAgainText}>+ Record another story</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FDFFF5" },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Orbit_400Regular", color: "#111", opacity: 0.6, marginBottom: 32 },
  bioCard: { backgroundColor: "#F0F2E8", padding: 20, marginBottom: 32, gap: 12 },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 24 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#111", paddingVertical: 4, paddingHorizontal: 12 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111" },
  sectionLabel: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111", opacity: 0.5, letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" },
  quoteCard: { borderLeftWidth: 3, borderLeftColor: "#BFFF00", paddingLeft: 16, marginBottom: 20 },
  quote: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 24, fontStyle: "italic" },
  btn: { backgroundColor: "#111", paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnText: { color: "#FDFFF5", fontFamily: "Orbit_400Regular", fontSize: 16, fontWeight: "700" },
  recordAgainBtn: { borderWidth: 1.5, borderColor: "#111", paddingVertical: 14, alignItems: "center", marginTop: 32 },
  recordAgainText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111" },
});
```

- [ ] Verify full elder flow: sign in → role-select → setup → record → processing → profile with wisdom snippets displayed.

- [ ] Commit:

```bash
git add app/(elder)/profile.tsx
git commit -m "feat: elder wisdom profile view"
```
