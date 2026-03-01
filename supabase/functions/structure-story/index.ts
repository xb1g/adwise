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
