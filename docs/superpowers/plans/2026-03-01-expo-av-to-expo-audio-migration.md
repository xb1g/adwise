# expo-av → expo-audio Migration Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `expo-av` with `expo-audio` in both voice-recording screens.

**Architecture:** Both `app/(elder)/record.tsx` and `app/(seeker)/onboarding.tsx` use only the `Audio` recording API from `expo-av` (no video). Migrate each file to `expo-audio`'s `useAudioRecorder` hook + `AudioModule`. The `recordingRef` pattern is replaced by the stable hook-returned recorder.

**Tech Stack:** expo-audio, expo-router, Supabase, TypeScript

---

## Files

| Action | File |
|--------|------|
| Modify | `package.json` — swap `expo-av` for `expo-audio` |
| Modify | `app/(elder)/record.tsx` |
| Modify | `app/(seeker)/onboarding.tsx` |

---

## API mapping reference

| expo-av | expo-audio |
|---------|-----------|
| `import { Audio } from 'expo-av'` | `import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio'` |
| `Audio.requestPermissionsAsync()` | `AudioModule.requestRecordingPermissionsAsync()` |
| `Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })` | `AudioModule.setAudioMode({ allowsRecordingIOS: true, playsInSilentModeIOS: true })` |
| `Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)` | `await audioRecorder.prepareToRecordAsync(); audioRecorder.record()` |
| `recording.stopAndUnloadAsync()` | `await audioRecorder.stop()` |
| `recording.getURI()` | `audioRecorder.uri` |

---

## Task 1: Install expo-audio, remove expo-av

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install expo-audio and remove expo-av**

```bash
pnpm add expo-audio
pnpm remove expo-av
```

- [ ] **Step 2: Verify package.json**

Check that `expo-av` is gone and `expo-audio` appears in dependencies.

---

## Task 2: Migrate `app/(elder)/record.tsx`

**Files:**
- Modify: `app/(elder)/record.tsx`

The current file uses:
- `Audio.requestPermissionsAsync()` — permissions
- `Audio.setAudioModeAsync(...)` — audio session config
- `Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)` — create + start recording
- `recordingRef = useRef<Audio.Recording | null>(null)` — hold the recording instance
- `recording.stopAndUnloadAsync()` — stop
- `recording.getURI()` — get file URI

Replace with `useAudioRecorder` hook. The hook returns a stable `audioRecorder` object — no ref needed.

- [ ] **Step 1: Update imports**

Replace:
```ts
import { Audio } from "expo-av";
```
With:
```ts
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
```

- [ ] **Step 2: Replace recordingRef with hook**

Remove:
```ts
const recordingRef = useRef<Audio.Recording | null>(null);
```

Add at the top of the component (alongside other hooks):
```ts
const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
```

- [ ] **Step 3: Rewrite `startRecording`**

Replace the entire `startRecording` function:
```ts
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
```

- [ ] **Step 4: Rewrite `stopAndProcess`**

Replace the stop + URI lines. The guard that checked `recordingRef.current` now checks `phase`:
```ts
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
```

- [ ] **Step 5: Commit**

```bash
git add app/(elder)/record.tsx
git commit -m "feat: migrate elder record screen from expo-av to expo-audio"
```

---

## Task 3: Migrate `app/(seeker)/onboarding.tsx`

**Files:**
- Modify: `app/(seeker)/onboarding.tsx`

Same pattern: permissions → set mode → record → stop → get URI.

- [ ] **Step 1: Update imports**

Replace:
```ts
import { Audio } from "expo-av";
```
With:
```ts
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
```

- [ ] **Step 2: Replace recordingRef with hook**

Remove:
```ts
const recordingRef = useRef<Audio.Recording | null>(null);
```

Add with the other hooks near the top of the component:
```ts
const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
```

Note: `useRef` is still used elsewhere in this file — only remove the `recordingRef` line, not the entire `useRef` import if it's still needed. Check after removing.

- [ ] **Step 3: Rewrite `startRecording`**

```ts
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

    AudioModule.setAudioMode({
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
```

- [ ] **Step 4: Rewrite `stopRecording`**

```ts
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
```

- [ ] **Step 5: Clean up unused useRef import if needed**

Check if `useRef` is still used anywhere in `onboarding.tsx` after removing `recordingRef`. If not, remove it from the React import line.

- [ ] **Step 6: Commit**

```bash
git add app/(seeker)/onboarding.tsx
git commit -m "feat: migrate seeker onboarding screen from expo-av to expo-audio"
```

---

## Task 4: Final verification

- [ ] **Step 1: Start the dev server and confirm no module errors**

```bash
pnpm start
```

Expected: no "Cannot find module 'expo-av'" errors in the console.

- [ ] **Step 2: Test on device**

Test voice recording in both screens:
- Elder: `/(elder)/record` — hold button, speak, release, verify transcription pipeline runs
- Seeker onboarding: step 3 — hold mic button, speak, release, verify transcript appears

Note: Audio recording requires a physical device or a simulator with microphone access enabled.
