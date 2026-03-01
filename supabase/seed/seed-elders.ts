// supabase/seed/seed-elders.ts
// Run with: npx ts-node supabase/seed/seed-elders.ts
// Or paste directly into Supabase SQL editor as an INSERT statement

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

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
