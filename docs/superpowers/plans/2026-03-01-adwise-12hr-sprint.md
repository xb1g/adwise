# Adwise — 12-Hour Final Sprint Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 2 bugs blocking demo, implement elder voice recording, wire real match API.

**Architecture:** Bug fixes are surgical — minimal changes to existing files. Record.tsx is a full rewrite of the stub.

**Priority order:** Bugs first (quick wins, unblocks demo), then record.tsx (most critical feature), then match API wiring.

**Spec:** `docs/superpowers/specs/2026-02-28-adwise-wisdom-marketplace-design.md`

---

## Bug 1: Seeker TextInput loses focus on every keystroke

**File:** `app/(seeker)/onboarding.tsx`

**Root cause:** `Step1`, `Step2`, `Step3`, `Step4` are function components defined *inside* `SeekerOnboarding`. Every state change (e.g. typing a character) re-renders the parent, creating new function references. React sees a new component type, unmounts/remounts the entire subtree, and the `TextInput` loses focus.

**Fix:** Inline the step JSX directly in the render (remove the nested function component wrappers). No props needed — they already close over state from the parent.

### Task 1: Fix TextInput focus loss in seeker onboarding

- [ ] Open `app/(seeker)/onboarding.tsx`

- [ ] Find the render section at the bottom of the file (after all the helper functions):

```tsx
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView ...>
        <View style={styles.header}>...</View>

        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </ScrollView>
    </SafeAreaView>
  );
```

- [ ] Replace **only** the four step lines with inline calls to the step render functions. Rename the four inner functions from `function Step1()` → `function renderStep1()` etc. so React never sees them as components:

Change every inner step function declaration from:
```tsx
function Step1() {
```
to:
```tsx
function renderStep1() {
```

Do the same for `Step2`, `Step3`, `Step4`, and `SummaryRow`.

- [ ] Update the render section to call them as functions, not JSX components:

```tsx
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
```

- [ ] Also rename `<SummaryRow .../>` usage inside `renderStep4()` to `{renderSummaryRow({...})}` and update its declaration to `function renderSummaryRow(...)`.

- [ ] Run the app, go to seeker onboarding step 1, type in the name field. Verify focus is maintained while typing.

- [ ] Commit:

```bash
git add "app/(seeker)/onboarding.tsx"
git commit -m "fix: seeker onboarding TextInput loses focus on every keystroke"
```

---

## Bug 2: Elder onboarding — "I'm Done" fails silently, loses data, doesn't auto-navigate

**File:** `app/(elder)/setup.tsx`

**Root causes:**

1. `onDisconnect: () => console.log(...)` — does nothing. When the ElevenLabs session ends (either via `complete_onboarding` tool or manual disconnect), extraction never triggers automatically.

2. When `elder-onboarding-extract` fails (edge fn not deployed or Mistral key not set), `extractionFailed = true` → UI shows only "Start Over" which calls `handleStartOver()` → **wipes all messages**. User loses everything.

3. No retry path for failed extraction.

**Fix:** Three targeted changes:
- Add `onDisconnect` handler that triggers `enterReview()` as safety net
- Guard against double-calling `enterReview` with a ref flag
- Replace destructive "Start Over" with a "Try Again" button that retries extraction without clearing messages

### Task 2: Fix elder onboarding bugs

- [ ] Open `app/(elder)/setup.tsx`

- [ ] Add a `reviewEnteredRef` guard near the top of the component (after `messagesRef`):

```tsx
const reviewEnteredRef = useRef(false);
```

- [ ] Update `enterReview` to use the guard:

Find:
```tsx
async function enterReview() {
    setPhase("reviewing");
```

Replace with:
```tsx
async function enterReview() {
    if (reviewEnteredRef.current) return;
    reviewEnteredRef.current = true;
    setPhase("reviewing");
```

- [ ] Update `onDisconnect` to trigger `enterReview` automatically:

Find:
```tsx
    onDisconnect: () => console.log("[elder-onboarding] disconnected"),
```

Replace with:
```tsx
    onDisconnect: () => {
      console.log("[elder-onboarding] disconnected");
      enterReview();
    },
```

- [ ] Fix the extraction failure UI — replace the destructive "Start Over" with a "Try Again" that retries without clearing messages. In the `phase === "reviewing"` block, find the `extractionFailed` branch:

Find:
```tsx
            ) : (
              <>
                <Text style={styles.reviewLoadingText}>Couldn't extract your profile.</Text>
                <Text style={styles.reviewLoadingText}>Tap Start Over to try again.</Text>
                <Pressable style={[styles.doneBtn, { marginTop: 24 }]} onPress={handleStartOver}>
                  <Text style={styles.doneBtnText}>Start Over</Text>
                </Pressable>
              </>
            )}
```

Replace with:
```tsx
            ) : (
              <>
                <Text style={styles.reviewLoadingText}>Couldn't extract your profile.</Text>
                <Text style={[styles.reviewLoadingText, { fontSize: 14, opacity: 0.6 }]}>
                  Check your connection and try again.
                </Text>
                <Pressable
                  style={[styles.doneBtn, { marginTop: 24 }]}
                  onPress={() => {
                    // Retry extraction without clearing messages
                    reviewEnteredRef.current = false;
                    setExtractionFailed(false);
                    enterReview();
                  }}
                >
                  <Text style={styles.doneBtnText}>Try Again</Text>
                </Pressable>
                <Pressable style={[styles.repeatBtn, { marginTop: 12 }]} onPress={handleStartOver}>
                  <Text style={styles.repeatBtnText}>Start Over</Text>
                </Pressable>
              </>
            )}
```

- [ ] Verify the edge function is deployed. Run:

```bash
npx supabase functions deploy elder-onboarding-extract
```

And confirm `MISTRAL_API_KEY` is set:

```bash
npx supabase secrets list
```

If `MISTRAL_API_KEY` is missing:

```bash
npx supabase secrets set MISTRAL_API_KEY=your_key_here
```

- [ ] Test the fix:
  1. Start elder onboarding session
  2. Say a few sentences
  3. Tap "I'm Done"
  4. Verify it navigates to reviewing phase and shows the extracted profile (not the error)
  5. If extraction still fails, check Supabase function logs: Supabase dashboard → Edge Functions → `elder-onboarding-extract` → Logs

- [ ] Commit:

```bash
git add "app/(elder)/setup.tsx"
git commit -m "fix: elder onboarding - I'm Done auto-navigation, retry on extraction failure, no data loss"
```

---

## Feature: Elder Voice Recording (record.tsx)

**File:** `app/(elder)/record.tsx`

Currently a 31-line stub. Needs the full expo-av → ElevenLabs STT → Mistral structure pipeline wired to Supabase.

**Check first:** Is `expo-av` and `expo-file-system` installed?

```bash
cat package.json | grep "expo-av\|expo-file-system"
```

If missing:
```bash
pnpm add expo-av expo-file-system
```

### Task 3: Implement elder voice recording screen

- [ ] Replace the entire contents of `app/(elder)/record.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  Animated, SafeAreaView, ScrollView,
} from "react-native";
import { Audio } from "expo-av";
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
  const recordingRef = useRef<Audio.Recording | null>(null);
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
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setError("Microphone permission required.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setPhase("recording");
    } catch (err) {
      console.error("[record] start error:", err);
      setError("Could not start recording. Try again.");
    }
  }

  async function stopAndProcess() {
    if (!recordingRef.current || !user) return;
    const recording = recordingRef.current;
    recordingRef.current = null;

    try {
      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error("No recording URI");

      // Transcribe
      setPhase("transcribing");
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const rawTranscript = await transcribeAudio(base64, "audio/m4a");
      setTranscript(rawTranscript);

      // Structure
      setPhase("structuring");
      const structured = await structureStory(rawTranscript);
      setWisdomSnippets(structured.wisdom_snippets ?? []);

      // Save to DB
      setPhase("saving");

      // Upload audio
      const audioPath = `${user.id}/${Date.now()}.m4a`;
      await supabase.storage.from("story-audio").upload(audioPath, base64, {
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
        // Update bio and life_areas from structured output
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
      // Navigate to elder home after short delay so user sees "Published!"
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

  // Done screen — brief flash before redirect
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
```

- [ ] Make sure `transcribeAudio` and `structureStory` are exported from `lib/ai.ts`. If not, check the file and add them.

- [ ] Run the app on a physical device (expo-av recording doesn't work on simulator without microphone):

```bash
pnpm start
# Scan QR with Expo Go on physical device
```

- [ ] Test: navigate to `/(elder)/record`, hold the button, speak for 30 seconds, release. Verify pipeline runs (transcribing → structuring → saving → redirects to home).

- [ ] Commit:

```bash
git add "app/(elder)/record.tsx"
git commit -m "feat: elder voice recording - expo-av + ElevenLabs STT + Mistral structuring pipeline"
```

---

## Feature: Wire Real Match API

**File:** `app/(seeker)/matches.tsx` and `app/(seeker)/problem.tsx`

### Task 4: Confirm seeding ran, then swap mock for real API

- [ ] First, verify the seeded elder profiles exist in Supabase:

Go to Supabase Studio → Table Editor → `elder_profiles`. If the table is empty or only has real users (no `is_seeded = true` rows), run the seed script:

```bash
cd /Users/bunyasit/dev/adwise
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
EXPO_PUBLIC_SUPABASE_URL=your_url \
npx ts-node supabase/seed/seed-elders.ts
```

Also check `stories` table — should have matching rows with `status = 'published'`.

- [ ] Open `app/(seeker)/problem.tsx`. Find the mock section and replace:

Find:
```tsx
      // Swap to real API once Dev 3 deploys match function:
      // matches = await matchElders(fullProblem, user?.id);
      // For now, use mock:
      await new Promise((r) => setTimeout(r, 1500)); // simulate network
      matches = MOCK_MATCHES;
```

Replace with:
```tsx
      matches = await matchElders(fullProblem, user?.id ?? undefined);
```

- [ ] Remove the `MOCK_MATCHES` constant from `problem.tsx` (it's no longer needed).

- [ ] In `app/(seeker)/matches.tsx`, the `MOCK_ELDERS` fallback can stay as a safety net during the hackathon — it only activates if `elder_id` starts with `"mock-"`. Real DB IDs are UUIDs so won't match. Leave it.

- [ ] Test the full seeker flow end-to-end:
  1. Sign in as seeker → complete onboarding (or skip if already done)
  2. Submit a real problem: "I want to start a company but I'm terrified of losing my stable income"
  3. Verify top 5 real elder matches appear with specific match reasons
  4. Tap best match → verify elder detail screen shows real bio + preview

- [ ] Commit:

```bash
git add "app/(seeker)/problem.tsx"
git commit -m "feat: wire real match API (swap mock for matchElders edge function)"
```

---

## Final Demo Checklist

Run through this before judging:

- [ ] Two devices or simulator windows: one signed in as elder, one as seeker
- [ ] Elder: complete onboarding (voice conversation) → lands on home
- [ ] Elder: record a story → publishes → visible in home
- [ ] Seeker: onboarding done → submit a problem → see real matched elders
- [ ] Tap best match → see elder detail with match reason
- [ ] All 3 edge functions deployed: `transcribe`, `structure-story`, `match`, `elder-onboarding-extract`
- [ ] All secrets set: `ELEVENLABS_API_KEY`, `MISTRAL_API_KEY`
- [ ] Seeded elder profiles in DB (`is_seeded = true` rows in `elder_profiles`)

---

## Time Budget

```
Bug 1 (TextInput focus):    ~15 min
Bug 2 (I'm Done + retry):   ~30 min  (+ 15 min to deploy/verify edge fn)
record.tsx:                 ~2 hrs   (includes testing on physical device)
Match API wiring + seed:    ~30 min
Buffer / polish / bugs:     ~8 hrs
```
