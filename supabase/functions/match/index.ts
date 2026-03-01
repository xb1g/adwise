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
    const { problemText } = await req.json();

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
