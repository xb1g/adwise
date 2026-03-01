const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("MISTRAL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "extraction failed", details: "MISTRAL_API_KEY is not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "extraction failed", details: "No conversation messages provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const transcript = messages
      .map((m: { role: string; text: string }) => {
        const speaker = m.role === "agent" ? "[Agent]" : "[You]";
        return `${speaker}: ${m.text}`;
      })
      .join("\n");

    const prompt = `You are extracting a profile from an elder's voice onboarding conversation transcript.
The elder was answering questions about their life experience and areas of expertise.
Extract and return ONLY valid JSON (no markdown, no explanation).

Pay close attention to the transcript — the elder usually introduces themselves by name early in the conversation.

Return JSON matching this exact schema:
{
  "name": "string — the elder's first name (or full name if given). Extract from the conversation. If not mentioned, use empty string",
  "age_range": "string or null (e.g. '60s', '70s') — null if cannot be determined",
  "life_areas": ["array of 2-5 short topic strings, e.g. 'farming', 'entrepreneurship'"],
  "bio": "2-3 sentence summary of the elder's life and expertise, written in third person. Use their actual name if extracted.",
  "key_topics": ["3-5 specific topics or skills discussed"],
  "wisdom_summary": "1-2 sentences of the most valuable insight this elder can offer"
}

Transcript:
${transcript}`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Mistral API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const structured = JSON.parse(cleaned);

    return new Response(JSON.stringify(structured), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("elder-onboarding-extract error:", err);
    return new Response(
      JSON.stringify({ error: "extraction failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
