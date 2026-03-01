// supabase/functions/process-elder-onboarding/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { conversationId, userId, age_range, life_areas } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch conversation transcript from ElevenLabs (if conversationId provided)
    let transcript = "";
    if (conversationId) {
      const convRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        { headers: { "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY")! } }
      );

      if (convRes.ok) {
        const convData = await convRes.json();
        // Format transcript from message array
        const messages: { role: string; message: string }[] = convData.transcript ?? [];
        transcript = messages
          .map((m) => `${m.role === "agent" ? "Interviewer" : "Elder"}: ${m.message}`)
          .join("\n");
      } else {
        console.warn("[process-elder-onboarding] ElevenLabs fetch failed:", await convRes.text());
      }
    }

    // 2. Extract structured profile from transcript via Mistral
    let extracted: {
      bio?: string;
      life_areas?: string[];
      wisdom_snippets?: string[];
      preview_text?: string;
      tags?: string[];
    } = {};

    if (transcript.length > 50) {
      const prompt = `You are extracting a wisdom profile from an elder's voice onboarding conversation transcript.

Transcript:
"${transcript}"

Extract and return ONLY valid JSON (no markdown, no explanation):
{
  "bio": "2-sentence summary of this elder's lived experience, written in third person",
  "life_areas": [2-4 items from: ${LIFE_AREA_OPTIONS.join(", ")}],
  "wisdom_snippets": [3 quotable 1-sentence insights from the elder's experience],
  "preview_text": "one compelling teaser sentence (max 20 words) that makes a young person want to hear more",
  "tags": [4-6 lowercase keyword tags]
}`;

      const mistralRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
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

      if (mistralRes.ok) {
        const mistralData = await mistralRes.json();
        const raw = mistralData.choices[0].message.content;
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        extracted = JSON.parse(cleaned);
      }
    }

    // 3. Upsert elder_profiles
    const { data: elderProfile, error: profileErr } = await supabase
      .from("elder_profiles")
      .upsert(
        {
          user_id: userId,
          age_range: age_range ?? null,
          life_areas: (life_areas && life_areas.length > 0 ? life_areas : extracted.life_areas) ?? [],
          bio: extracted.bio ?? "",
          onboarding_done: true,
          is_seeded: false,
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();

    if (profileErr) {
      throw new Error(`elder_profiles upsert failed: ${profileErr.message}`);
    }

    // 4. Insert story if we have wisdom snippets
    if (extracted.wisdom_snippets?.length && elderProfile?.id) {
      await supabase.from("stories").insert({
        elder_id: elderProfile.id,
        wisdom_snippets: extracted.wisdom_snippets,
        preview_text: extracted.preview_text ?? "",
        life_areas: extracted.life_areas ?? [],
        tags: extracted.tags ?? [],
        status: "active",
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[process-elder-onboarding error]", err);
    return new Response(
      JSON.stringify({ error: "processing failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
