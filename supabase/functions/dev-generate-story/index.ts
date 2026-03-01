// supabase/functions/dev-generate-story/index.ts
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

  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "MISTRAL_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Get authenticated user
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch elder profile
    const { data: profile, error: profileErr } = await supabase
      .from("elder_profiles")
      .select("id, name, bio, life_areas, key_topics, wisdom_summary")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return new Response(
        JSON.stringify({ error: "no elder profile found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = `You are generating a realistic story for an elder on a wisdom-sharing app.

Elder profile:
- Name: ${profile.name}
- Bio: ${profile.bio}
- Life areas: ${(profile.life_areas ?? []).join(", ")}
- Key topics: ${(profile.key_topics ?? []).join(", ")}
- Wisdom summary: ${profile.wisdom_summary ?? ""}

Generate a story this elder might tell, as if they spoke it aloud in a voice recording. Then extract structure from it.

Return ONLY valid JSON (no markdown, no explanation):
{
  "transcript": "3-5 paragraphs of natural, first-person spoken story from this elder. Conversational, personal, a bit rambling — like a real voice recording.",
  "life_areas": [2-4 items from: ${LIFE_AREA_OPTIONS.join(", ")}],
  "key_topics": [3-5 short topic phrases from the story],
  "wisdom_snippets": [3 quotable 1-sentence insights from the elder's experience],
  "preview_text": "one compelling teaser sentence (max 20 words) that makes a young person want to hear more",
  "tags": [4-6 lowercase keyword tags]
}

Make the story feel authentic to this specific elder's background. Vary the topic from their existing bio — dig into a specific episode or lesson.`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral error: ${await response.text()}`);
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const structured = JSON.parse(cleaned);

    // Generate voice audio via ElevenLabs TTS
    let audioUrl: string | null = null;
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (elevenLabsKey && structured.transcript) {
      try {
        // Use a default voice; trim transcript to TTS limit
        const ttsText = structured.transcript.slice(0, 4500);
        const ttsRes = await fetch(
          "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenLabsKey,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg",
            },
            body: JSON.stringify({
              text: ttsText,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          },
        );

        if (ttsRes.ok) {
          const audioBytes = new Uint8Array(await ttsRes.arrayBuffer());
          const audioPath = `${user.id}/${Date.now()}.mp3`;

          // Use service role client for storage upload
          const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          const { error: uploadErr } = await serviceClient.storage
            .from("story-audio")
            .upload(audioPath, audioBytes, { contentType: "audio/mpeg" });

          if (uploadErr) {
            console.warn("[dev-generate-story] audio upload failed:", uploadErr);
          } else {
            audioUrl = audioPath;
          }
        } else {
          console.warn("[dev-generate-story] TTS failed:", await ttsRes.text());
        }
      } catch (ttsErr) {
        console.warn("[dev-generate-story] TTS error:", ttsErr);
      }
    }

    // Save directly to stories table
    const { error: insertErr } = await supabase.from("stories").insert({
      elder_id: profile.id,
      audio_url: audioUrl,
      transcript: structured.transcript,
      life_areas: structured.life_areas,
      key_topics: structured.key_topics,
      wisdom_snippets: structured.wisdom_snippets,
      preview_text: structured.preview_text,
      tags: structured.tags,
      status: "published",
    });

    if (insertErr) throw insertErr;

    // Enrich elder profile: merge new life_areas and key_topics from story
    const existingLifeAreas: string[] = profile.life_areas ?? [];
    const existingKeyTopics: string[] = profile.key_topics ?? [];
    const mergedLifeAreas = [...new Set([...existingLifeAreas, ...(structured.life_areas ?? [])])];
    const mergedKeyTopics = [...new Set([...existingKeyTopics, ...(structured.key_topics ?? [])])];

    const { error: updateErr } = await supabase
      .from("elder_profiles")
      .update({
        life_areas: mergedLifeAreas,
        key_topics: mergedKeyTopics,
      })
      .eq("id", profile.id);

    if (updateErr) {
      console.warn("[dev-generate-story] profile update failed:", updateErr);
    }

    return new Response(JSON.stringify({ success: true, ...structured }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dev-generate-story error]", err);
    return new Response(
      JSON.stringify({ error: "generation failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
