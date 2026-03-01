# Adwise — Dev 3: Backend & AI Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Supabase schema, storage, 3 edge functions (ElevenLabs STT, Mistral story structuring, Mistral matching), seed 6–8 elder profiles so Dev 2 has real data from hour 2.

**Architecture:** New `wisdom_users` table for role tracking (avoids touching existing `user_profiles`). `elder_profiles` + `stories` + `matches` tables. Three Supabase edge functions called sequentially: transcribe → structure-story → match.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions/Deno), ElevenLabs STT API, Mistral API (chat completions via fetch), pnpm, Supabase CLI

**Spec:** `docs/superpowers/specs/2026-02-28-adwise-wisdom-marketplace-design.md`

---

## Chunk 1: Database Schema

### Task 1: Create wisdom marketplace migration

**Files:**
- Create: `supabase/migrations/20260228000001_wisdom_marketplace.sql`

- [ ] Create the migration file:

```sql
-- supabase/migrations/20260228000001_wisdom_marketplace.sql

-- Role tracking (separate from existing user_profiles to avoid breaking the goals app)
create table if not exists public.wisdom_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text,
  role       text check (role in ('elder', 'seeker')),
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.wisdom_users enable row level security;
create policy "wisdom_users: own row" on public.wisdom_users
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Elder profiles
create table if not exists public.elder_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  age_range   text check (age_range in ('50s', '60s', '70s', '80s+')),
  life_areas  text[] not null default '{}',
  bio         text not null default '',
  is_seeded   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.elder_profiles enable row level security;
create policy "elder_profiles: read all published" on public.elder_profiles
  for select using (true);
create policy "elder_profiles: own insert" on public.elder_profiles
  for insert with check (auth.uid() = user_id);
create policy "elder_profiles: own update" on public.elder_profiles
  for update using (auth.uid() = user_id);

-- Stories
create table if not exists public.stories (
  id               uuid primary key default gen_random_uuid(),
  elder_id         uuid not null references public.elder_profiles(id) on delete cascade,
  audio_url        text,
  transcript       text not null default '',
  life_areas       text[] not null default '{}',
  key_topics       text[] not null default '{}',
  wisdom_snippets  text[] not null default '{}',
  preview_text     text not null default '',
  tags             text[] not null default '{}',
  status           text not null default 'processing' check (status in ('processing', 'published')),
  created_at       timestamptz not null default now()
);

alter table public.stories enable row level security;
create policy "stories: read all published" on public.stories
  for select using (status = 'published' or auth.uid() = (
    select user_id from public.elder_profiles where id = elder_id
  ));
create policy "stories: own insert" on public.stories
  for insert with check (
    auth.uid() = (select user_id from public.elder_profiles where id = elder_id)
  );
create policy "stories: service update" on public.stories
  for update using (true);

-- Match results
create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  seeker_id    uuid not null references auth.users(id) on delete cascade,
  problem_text text not null,
  result       jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

alter table public.matches enable row level security;
create policy "matches: own rows" on public.matches
  using (auth.uid() = seeker_id) with check (auth.uid() = seeker_id);

-- Storage bucket for audio files
insert into storage.buckets (id, name, public)
values ('story-audio', 'story-audio', false)
on conflict do nothing;

create policy "story-audio: authenticated upload" on storage.objects
  for insert with check (bucket_id = 'story-audio' and auth.role() = 'authenticated');
create policy "story-audio: authenticated read" on storage.objects
  for select using (bucket_id = 'story-audio' and auth.role() = 'authenticated');
```

- [ ] Run migration:

```bash
npx supabase db push
```

Expected: migration applied with no errors.

- [ ] Verify tables exist in Supabase Studio (or via CLI):

```bash
npx supabase db diff
```

- [ ] Commit:

```bash
git add supabase/migrations/20260228000001_wisdom_marketplace.sql
git commit -m "feat: wisdom marketplace schema (wisdom_users, elder_profiles, stories, matches)"
```

---

## Chunk 2: Seed Elder Profiles

### Task 2: Seed script for elder profiles

Non-coder delivers 6–8 elder persona documents. Use this script to load them into the DB.

**Files:**
- Create: `supabase/seed/seed-elders.ts`

- [ ] Get the Supabase service role key from `.env.local` or Supabase dashboard (Settings → API → service_role key).

- [ ] Create seed script:

```typescript
// supabase/seed/seed-elders.ts
// Run with: npx ts-node supabase/seed/seed-elders.ts
// Or paste directly into Supabase SQL editor as an INSERT statement

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role — bypasses RLS
);

// Replace content with non-coder's actual personas
const elders = [
  {
    name: "Maria Santos",
    age_range: "60s",
    life_areas: ["immigration", "career", "family"],
    bio: "Moved from the Philippines at 35 with $200 and became a registered nurse, raising three kids alone. Now retired, she mentors new immigrants navigating the US healthcare system.",
    story_transcript: "I remember landing in Los Angeles with two suitcases and an address on a piece of paper. My English wasn't perfect, my credentials weren't recognized, and I had no one. The first year was the hardest — I cleaned houses during the day and studied nursing exams at night...",
    wisdom_snippets: [
      "Every door that closes is teaching you which door to build yourself.",
      "Your accent is not a weakness — it is proof you speak more than one world.",
      "When you have nothing, you find out what you are made of.",
    ],
    preview_text: "Left everything behind at 35 to start over in a new country — here's what she learned.",
    tags: ["immigration", "resilience", "single-parent", "career-change", "healthcare"],
  },
  {
    name: "Robert Chen",
    age_range: "70s",
    life_areas: ["startup", "failure", "reinvention"],
    bio: "Founded three companies — two failed spectacularly, one was acquired. Spent five years in depression before finding purpose in teaching entrepreneurship to at-risk youth.",
    story_transcript: "My second company took everything. The house, the marriage, almost my sanity. We had 40 employees and I had to let them all go in one afternoon. I cried in my car for three hours before driving home...",
    wisdom_snippets: [
      "Failure is not the opposite of success — it is the curriculum.",
      "The company I lost taught me more than the one I sold.",
      "You cannot protect yourself from loss. You can only decide what it teaches you.",
    ],
    preview_text: "Lost two companies, a marriage, and his savings — then built something that actually mattered.",
    tags: ["startup-failure", "depression", "reinvention", "entrepreneurship", "resilience"],
  },
  {
    name: "Dorothy Williams",
    age_range: "80s+",
    life_areas: ["grief", "reinvention", "creativity"],
    bio: "Lost her husband of 47 years and became a painter at 72. Her work has been shown in galleries across the South. She says grief taught her to see color.",
    story_transcript: "When Harold died, I didn't leave the house for four months. Then one afternoon I found his old paint set in the garage and I just started. I didn't know what I was doing — I still don't. But I haven't stopped...",
    wisdom_snippets: [
      "Grief is not something you get over. It is something you carry until it becomes light enough to dance with.",
      "It is never too late to begin. I began at 72.",
      "Create something. It does not matter what. Just make something that was not there before.",
    ],
    preview_text: "Found her life's purpose at 72, after the worst loss imaginable.",
    tags: ["grief", "creativity", "late-start", "widowhood", "reinvention"],
  },
  {
    name: "James Okonkwo",
    age_range: "60s",
    life_areas: ["career", "identity", "immigration"],
    bio: "Came from Nigeria as a PhD student, became a finance executive, then quit at 58 to return to writing poetry — the dream he abandoned at 22 to satisfy his parents.",
    story_transcript: "For 35 years I wore the suit. I was good at the job. I made money. My parents were proud. But every Sunday morning I would sit with my coffee and feel this hollow thing. Like I had been living someone else's life on loan...",
    wisdom_snippets: [
      "The dream you abandoned at 22 is still waiting. It has patience.",
      "Success that is not yours will always feel like a costume.",
      "The question is not 'what do I want to do' — it is 'who did I come here to be.'",
    ],
    preview_text: "Spent 35 years in the wrong life — and had the courage to change it at 58.",
    tags: ["identity", "career-pivot", "immigration", "parental-pressure", "creative-calling"],
  },
  {
    name: "Linda Goldberg",
    age_range: "60s",
    life_areas: ["marriage", "divorce", "reinvention"],
    bio: "Stayed in a difficult marriage for 28 years 'for the kids,' then rebuilt her life from scratch at 55. Now runs a support community for women in midlife transitions.",
    story_transcript: "Everyone told me to stay. The kids, the financial advisor, my mother. 'You'll be fine,' they said. 'It's not that bad.' But I knew. I had known for fifteen years. The day I finally left was the day I met myself...",
    wisdom_snippets: [
      "Staying when you should go teaches your children the wrong thing about love.",
      "Starting over at 55 is terrifying. It is also the most alive I have ever felt.",
      "The life you are afraid to leave is smaller than the one waiting for you.",
    ],
    preview_text: "Left a 28-year marriage at 55 and discovered who she actually was.",
    tags: ["divorce", "marriage", "midlife", "reinvention", "courage"],
  },
  {
    name: "Carlos Mendez",
    age_range: "70s",
    life_areas: ["career", "financial-recovery", "family"],
    bio: "Lost his construction business in the 2008 crash, went bankrupt at 55, worked as a laborer for three years, and rebuilt to employ 30 people by 65.",
    story_transcript: "I had forty employees and a company I built with my hands for twenty years. Then 2008 hit and in six months it was gone. I went from signing paychecks to applying for jobs at 55. Nobody wanted to hire me...",
    wisdom_snippets: [
      "Bankruptcy is a legal status. It is not who you are.",
      "Pride will keep you poor. Humility will let you start again.",
      "The only thing that can stop a comeback is the decision to stop trying.",
    ],
    preview_text: "Lost everything in 2008 at 55 and rebuilt from zero — twice.",
    tags: ["financial-crisis", "bankruptcy", "construction", "comeback", "humility"],
  },
];

async function seed() {
  console.log("Seeding elder profiles...");

  for (const elder of elders) {
    // Insert elder_profile (no user_id — seeded, not real user)
    const { data: profile, error: profileError } = await supabase
      .from("elder_profiles")
      .insert({
        age_range: elder.age_range,
        life_areas: elder.life_areas,
        bio: elder.bio,
        is_seeded: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error(`Failed to insert profile for ${elder.name}:`, profileError);
      continue;
    }

    // Insert story
    const { error: storyError } = await supabase.from("stories").insert({
      elder_id: profile.id,
      transcript: elder.story_transcript,
      life_areas: elder.life_areas,
      key_topics: elder.tags,
      wisdom_snippets: elder.wisdom_snippets,
      preview_text: elder.preview_text,
      tags: elder.tags,
      status: "published",
    });

    if (storyError) {
      console.error(`Failed to insert story for ${elder.name}:`, storyError);
      continue;
    }

    // Also insert into wisdom_users so name is accessible (seeded, no auth user)
    // We skip wisdom_users for seeded profiles — elder_profiles.bio has the name embedded
    console.log(`✓ Seeded: ${elder.name}`);
  }

  console.log("Done.");
}

seed();
```

- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (get from Supabase dashboard → Settings → API).

- [ ] Run seed:

```bash
npx ts-node -e "$(cat supabase/seed/seed-elders.ts)"
# OR run in Supabase SQL editor if ts-node fails
```

- [ ] Verify in Supabase Studio: `elder_profiles` table has 6 rows, `stories` table has 6 rows with status='published'.

- [ ] Commit:

```bash
git add supabase/seed/seed-elders.ts
git commit -m "feat: seed 6 elder profiles for demo matching"
```

---

## Chunk 3: Edge Function — transcribe

### Task 3: ElevenLabs STT edge function

Receives audio as base64 string, returns transcript text.

**Files:**
- Create: `supabase/functions/transcribe/index.ts`

- [ ] Test ElevenLabs STT with curl first to confirm your API key works:

```bash
# Create a tiny test wav file or use any audio file
curl -X POST https://api.elevenlabs.io/v1/speech-to-text \
  -H "xi-api-key: YOUR_ELEVENLABS_KEY" \
  -F "file=@/path/to/test.mp3" \
  -F "model_id=scribe_v1"
```

Expected: `{"text": "...", "language_code": "en", ...}`

- [ ] Create edge function:

```typescript
// supabase/functions/transcribe/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { audioBase64, mimeType = "audio/m4a" } = await req.json();

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64 to binary
    const binaryStr = atob(audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Build multipart form
    const blob = new Blob([bytes], { type: mimeType });
    const form = new FormData();
    form.append("file", blob, "recording.m4a");
    form.append("model_id", "scribe_v1");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY")! },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs error: ${err}`);
    }

    const data = await response.json();
    const transcript = data.text ?? "";

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[transcribe error]", err);
    return new Response(
      JSON.stringify({ error: "transcription failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] Set the ElevenLabs secret in Supabase:

```bash
npx supabase secrets set ELEVENLABS_API_KEY=your_key_here
```

- [ ] Deploy:

```bash
npx supabase functions deploy transcribe
```

- [ ] Test with curl (encode a small audio file to base64):

```bash
BASE64=$(base64 -i test.m4a)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/transcribe \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"audioBase64\": \"$BASE64\", \"mimeType\": \"audio/m4a\"}"
```

Expected: `{"transcript": "Hello this is a test..."}`

- [ ] Commit:

```bash
git add supabase/functions/transcribe/
git commit -m "feat: transcribe edge function (ElevenLabs STT)"
```

---

## Chunk 4: Edge Function — structure-story

### Task 4: Mistral story structuring edge function

Receives transcript, returns structured wisdom profile JSON.

**Files:**
- Create: `supabase/functions/structure-story/index.ts`

- [ ] Confirm your Mistral API key works:

```bash
curl https://api.mistral.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_MISTRAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"mistral-small-latest","messages":[{"role":"user","content":"Say hello"}]}'
```

- [ ] Create edge function:

```typescript
// supabase/functions/structure-story/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIFE_AREA_OPTIONS = [
  "career", "immigration", "startup", "marriage", "divorce", "grief",
  "financial-recovery", "creativity", "identity", "family", "health",
  "education", "reinvention", "parental-pressure",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript || transcript.trim().length < 20) {
      return new Response(JSON.stringify({ error: "transcript too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are extracting a wisdom profile from an elder's spoken story transcript.

Transcript:
"${transcript}"

Extract and return ONLY valid JSON (no markdown, no explanation):
{
  "life_areas": [2-4 items from: ${LIFE_AREA_OPTIONS.join(", ")}],
  "key_topics": [3-5 short topic phrases from the story],
  "wisdom_snippets": [3 quotable 1-sentence insights from the elder's experience],
  "preview_text": "one compelling teaser sentence (max 20 words) that makes a young person want to hear more",
  "bio": "2-sentence summary of this elder's lived experience, written in third person",
  "tags": [4-6 lowercase keyword tags]
}`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("MISTRAL_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral error: ${await response.text()}`);
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const structured = JSON.parse(cleaned);

    return new Response(JSON.stringify(structured), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[structure-story error]", err);
    return new Response(
      JSON.stringify({ error: "structuring failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] Set Mistral secret:

```bash
npx supabase secrets set MISTRAL_API_KEY=your_key_here
```

- [ ] Deploy:

```bash
npx supabase functions deploy structure-story
```

- [ ] Test:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/structure-story \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "I moved from Mexico at age 30 with nothing. I cleaned houses for three years while learning English at night. Eventually I started my own cleaning business and now I have fifteen employees. The hardest part was the loneliness, but it taught me to be my own best friend."}'
```

Expected: valid JSON with life_areas, wisdom_snippets, etc.

- [ ] Commit:

```bash
git add supabase/functions/structure-story/
git commit -m "feat: structure-story edge function (Mistral)"
```

---

## Chunk 5: Edge Function — match

### Task 5: Mistral elder matching edge function

Receives seeker's problem text, returns top 5 matched elder IDs with match reasons.

**Files:**
- Create: `supabase/functions/match/index.ts`
- Modify: `lib/ai.ts`

- [ ] Create edge function:

```typescript
// supabase/functions/match/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { problemText, seekerId } = await req.json();

    if (!problemText || problemText.trim().length < 10) {
      return new Response(JSON.stringify({ error: "problemText too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all published stories with elder info
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stories, error } = await supabase
      .from("stories")
      .select("id, elder_id, life_areas, key_topics, wisdom_snippets, preview_text, tags, elder_profiles(id, age_range, life_areas, bio)")
      .eq("status", "published");

    if (error) throw error;
    if (!stories || stories.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build elder summaries for Mistral
    const elderSummaries = stories.map((s: any, i: number) => ({
      index: i,
      elder_id: s.elder_id,
      story_id: s.id,
      life_areas: s.life_areas,
      key_topics: s.key_topics,
      bio: s.elder_profiles?.bio ?? "",
      preview: s.preview_text,
      tags: s.tags,
    }));

    const prompt = `A young person has a problem. Match them to the 5 most relevant elders based on lived experience.

Problem: "${problemText}"

Elders (JSON array):
${JSON.stringify(elderSummaries, null, 2)}

Return ONLY valid JSON (no markdown):
{
  "matches": [
    {
      "elder_id": "<uuid>",
      "story_id": "<uuid>",
      "rank": 1,
      "match_reason": "One sentence explaining exactly why this elder's experience is relevant to this specific problem"
    }
  ]
}

Rules:
- Return exactly 5 matches, ranked 1-5 (1 = best match)
- match_reason must be specific to the problem, not generic
- Only use elder_ids from the provided list`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("MISTRAL_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral error: ${await response.text()}`);
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const { matches } = JSON.parse(cleaned);

    // Save match result if seekerId provided
    if (seekerId) {
      await supabase.from("matches").insert({
        seeker_id: seekerId,
        problem_text: problemText,
        result: matches,
      });
    }

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[match error]", err);
    return new Response(
      JSON.stringify({ error: "matching failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] Deploy:

```bash
npx supabase functions deploy match
```

- [ ] Test against seeded data:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/match \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"problemText": "I am scared to quit my stable job to start a company. I have a family to support."}'
```

Expected: JSON with 5 matches, each with a specific match_reason.

---

## Chunk 6: Client API helpers

### Task 6: Add wisdom functions to lib/ai.ts

**Files:**
- Modify: `lib/ai.ts`

- [ ] Add the following types and functions to the bottom of `lib/ai.ts`:

```typescript
// --- Wisdom Marketplace ---

export type StoryStructure = {
  life_areas: string[];
  key_topics: string[];
  wisdom_snippets: string[];
  preview_text: string;
  bio: string;
  tags: string[];
};

export type MatchResult = {
  elder_id: string;
  story_id: string;
  rank: number;
  match_reason: string;
};

export async function transcribeAudio(audioBase64: string, mimeType = "audio/m4a"): Promise<string> {
  const { data, error } = await supabase.functions.invoke("transcribe", {
    body: { audioBase64, mimeType },
  });
  if (error) throw error;
  return (data as { transcript: string }).transcript;
}

export async function structureStory(transcript: string): Promise<StoryStructure> {
  const { data, error } = await supabase.functions.invoke("structure-story", {
    body: { transcript },
  });
  if (error) throw error;
  return data as StoryStructure;
}

export async function matchElders(problemText: string, seekerId?: string): Promise<MatchResult[]> {
  const { data, error } = await supabase.functions.invoke("match", {
    body: { problemText, seekerId },
  });
  if (error) throw error;
  return (data as { matches: MatchResult[] }).matches;
}
```

- [ ] Commit:

```bash
git add supabase/functions/match/ lib/ai.ts
git commit -m "feat: match edge function (Mistral) + client helpers in lib/ai.ts"
```

---

## Handoff to Dev 1 & Dev 2

After Task 2 (seed) is complete, **ping Dev 2** — they can start building matches.tsx against real seeded data.

After Tasks 3–5 are deployed, **ping Dev 1** — they can wire the recording flow end-to-end.

Share these values with both devs:
- Supabase URL and anon key (already in `.env.local`)
- Table names: `wisdom_users`, `elder_profiles`, `stories`, `matches`
- Function names: `transcribe`, `structure-story`, `match`
- Client helpers: `transcribeAudio()`, `structureStory()`, `matchElders()` from `lib/ai.ts`
