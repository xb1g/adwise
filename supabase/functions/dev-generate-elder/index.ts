// supabase/functions/dev-generate-elder/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const prompt = `Generate a realistic elder profile for a wisdom-sharing app.
The elder should have a unique, interesting life story - vary the background significantly (farmer, engineer, entrepreneur, artist, activist, teacher, immigrant, etc.).

Return ONLY valid JSON (no markdown, no explanation):
{
  "name": "first name only",
  "age_range": "one of: 50s, 60s, 70s, 80s+",
  "life_areas": ["2-4 short topic strings, e.g. farming, immigration, startup, grief, creativity"],
  "bio": "2-3 sentences in third person describing their life and expertise",
  "key_topics": ["3-5 specific skills or topics they can speak to"],
  "wisdom_summary": "1 sentence: the most valuable insight this elder offers",
  "fake_messages": [
    { "role": "agent", "text": "Tell me about yourself and your life journey." },
    { "role": "user", "text": "..." },
    { "role": "agent", "text": "What area of life do you feel you have the most hard-won wisdom in?" },
    { "role": "user", "text": "..." },
    { "role": "agent", "text": "What would you tell a 25-year-old facing that same challenge?" },
    { "role": "user", "text": "..." }
  ]
}

Make fake_messages feel like real voice conversation answers - conversational, personal, a bit rambling. The user messages should match the elder's background.`;

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

    return new Response(JSON.stringify(structured), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dev-generate-elder error]", err);
    return new Response(
      JSON.stringify({ error: "generation failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
