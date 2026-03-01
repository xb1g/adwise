# Adwise — Wisdom Marketplace Design Spec
**Date:** 2026-02-28
**Context:** 24-hour hackathon, 4-person team (3 devs + 1 non-coder)
**Approach:** B — Real voice recording + ElevenLabs STT + AI structuring, with pre-seeded elder profiles as safety net

---

## Product Vision

A voice-first platform where older adults record life stories, and AI transforms them into structured, searchable wisdom profiles. Young users submit a specific problem — career confusion, startup failure, marriage doubts, immigration challenges — and AI matches it to the top five elders with the most relevant lived experience. Users can unlock full stories or book paid conversations with matched storytellers.

---

## Team Responsibilities

| Person | Role | Owns |
|--------|------|------|
| Dev 1 | Elder Side | Role selection, elder setup, voice recording UI, processing screen, elder profile view |
| Dev 2 | Seeker Side | Problem submission, matching results, elder detail page, unlock/book CTAs |
| Dev 3 | Backend & AI | Supabase schema, migrations, storage, 3 edge functions, pre-seeding 6–8 elder profiles |
| Non-coder | Demo & Content | Figma mockups, elder persona content, voice recordings (TTS), pitch deck, demo script |

---

## Tech Stack

- **Framework:** Expo Router v6 (React Native) — existing codebase
- **Backend:** Supabase (auth, database, storage, edge functions)
- **Auth:** Google OAuth — already implemented
- **Voice Recording:** expo-av
- **Transcription:** ElevenLabs STT API
- **AI Structuring & Matching:** Claude via Supabase edge functions
- **Design:** Existing system — #FDFFF5 bg, #111 text, #BFFF00 accent, Orbit font

---

## App Architecture

### Screen Map

```
app/
  index.tsx              — Role selection: "I have wisdom" / "I need wisdom"

  (elder)/
    setup.tsx            — Name, age range, life areas (multi-select chips)
    record.tsx           — Voice recording (hold-to-record, waveform viz)
    processing.tsx       — "Structuring your wisdom..." (progress animation)
    profile.tsx          — Elder's published wisdom profile

  (seeker)/
    problem.tsx          — Problem submission (text input + category chips)
    matches.tsx          — Top 5 matched elders (scrollable cards)
    elder/[id].tsx       — Elder detail: preview + Unlock / Book CTAs

  _layout.tsx            — Root (existing auth + font loading)
```

### Navigation
Pure stack navigation — no tabs. Role selection at root branches into elder or seeker flow. Google OAuth → role selection → respective flow.

---

## AI Pipeline

```
Voice recording (expo-av)
    ↓
[edge fn: transcribe]
  → POST audio blob to ElevenLabs STT API
  → Returns: raw transcript string

    ↓
[edge fn: structure-story]
  → POST transcript to Claude
  → Extracts: life_areas[], key_topics[], wisdom_snippets[],
              preview_text (one teaser line), bio (2–3 sentences), tags[]
  → Returns: structured JSON → stored in stories table

    ↓ (seeker side, on problem submit)
[edge fn: match]
  → POST seeker problem text + all published elder profiles (structured JSON)
  → Claude ranks top 5 by relevance, returns match_reason per elder
  → Returns: [{elder_id, rank, match_reason}]
```

**Rationale for Claude matching over embeddings:** No vector DB setup required. Claude reasons about *why* a specific lived experience matches a stated problem and generates the match reason text displayed on result cards — better demo output, faster to ship.

**ElevenLabs dual use:**
- STT: Transcribing live elder recordings
- TTS (non-coder task): Generating audio clips for pre-seeded profiles so judges hear distinct elder voices

---

## Data Model

```sql
-- Users (extends Supabase auth.users)
users
  id          uuid primary key references auth.users
  email       text
  name        text
  role        text check (role in ('elder', 'seeker'))
  avatar_url  text
  created_at  timestamptz default now()

-- Elder profile metadata
elder_profiles
  id          uuid primary key default gen_random_uuid()
  user_id     uuid references users(id)
  age_range   text check (age_range in ('50s', '60s', '70s', '80s+'))
  life_areas  text[]    -- ['career', 'immigration', 'marriage', 'startup', ...]
  bio         text      -- AI-generated 2–3 sentence summary
  is_seeded   boolean default false
  created_at  timestamptz default now()

-- Stories
stories
  id               uuid primary key default gen_random_uuid()
  elder_id         uuid references elder_profiles(id)
  audio_url        text           -- Supabase storage: story-audio bucket
  transcript       text           -- raw ElevenLabs output
  life_areas       text[]
  key_topics       text[]
  wisdom_snippets  text[]         -- 3–5 quotable lines
  preview_text     text           -- one teaser shown before unlock
  tags             text[]
  status           text check (status in ('processing', 'published'))
  created_at       timestamptz default now()

-- Seeker match results
matches
  id           uuid primary key default gen_random_uuid()
  seeker_id    uuid references users(id)
  problem_text text
  result       jsonb   -- [{elder_id, rank, match_reason}]
  created_at   timestamptz default now()
```

**Storage:** Bucket `story-audio` for audio files uploaded before transcription.

---

## Pre-seeded Elder Profiles (Non-coder Deliverable)

Non-coder writes 6–8 elder personas before the hackathon starts or on hour 0. Each persona needs:

- Name, age, country of origin
- Life areas covered (pick 2–3 from: career change, immigration, startup failure, marriage, grief, financial recovery, creative pivot, health crisis)
- 3–5 paragraph story script (Dev 3 feeds this to Claude to generate structured profile)
- Voice recording or ElevenLabs TTS audio clip

Dev 3 seeds these into `elder_profiles` + `stories` tables by hour 2 so Dev 2 has real matching data immediately.

---

## Build Timeline

```
HOUR 0–1: Setup sprint
  Dev 3:     Run migrations, create storage bucket, seed 2 profiles immediately
  Dev 1:     Scaffold (elder) screens, wire auth → role selection → setup
  Dev 2:     Scaffold (seeker) screens
  Non-coder: Hand off elder persona docs to Dev 3, start Figma

HOUR 1–8: Core build
  Dev 1:     record.tsx (expo-av), processing.tsx animation
  Dev 2:     problem.tsx + matches.tsx against mock/seeded data
  Dev 3:     transcribe + structure-story edge functions, finish all 8 profiles
  Non-coder: Figma handoff by hour 4 → pivot to pitch deck + TTS voice clips

HOUR 8–16: Integration
  Dev 1:     Wire recording → transcribe → structure-story → profile.tsx
  Dev 2:     Wire matches.tsx to real match edge function (ready by hour 12)
  Dev 3:     match edge function + polish seeded data quality
  Non-coder: Finish deck, write demo script, begin rehearsal

HOUR 16–22: Polish & demo prep
  All devs:  Bug fixes, style passes, smooth transitions
  Non-coder: Demo rehearsals, edge case discovery, judge Q&A prep

HOUR 22–24: Freeze & present
  Code freeze at hour 22. Demo only pre-tested flows.
```

---

## Demo Script (Non-coder Owns)

1. Elder opens app on stage → records 60-second voice story live
2. Transcript appears line by line → "Structuring your wisdom..." → profile publishes
3. Switch device to seeker → types a real problem (e.g. "I'm scared to quit my job to start a company")
4. Top 5 match cards appear with match reasons
5. Tap best match → see preview → "Unlock full story" / "Book a 30-min call"
6. Pitch closes on business model slide (marketplace: unlock credits + booking commission)

---

## Out of Scope (Post-hackathon)

- Real payment processing (Stripe)
- Booking calendar integration
- Elder moderation / story review flow
- Push notifications
- Profile photo upload
- Search / browse outside AI matching
