const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || messages.length < 2) {
      return new Response(
        JSON.stringify({ error: "not enough conversation to summarize" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transcript = messages
      .map((m: { role: string; text: string }) => `${m.role}: ${m.text}`)
      .join("\n");

    const prompt = `You are summarizing a brainstorm conversation between a seeker and an AI counselor.

The seeker talked through their life situation and problems. Extract a clear, first-person problem description that captures what they're going through.

Conversation:
${transcript}

Return ONLY valid JSON (no markdown, no explanation):
{
  "problem_text": "A clear 2-4 sentence first-person summary of the seeker's situation and what kind of guidance they need. Written as if the seeker wrote it themselves. Be specific about their actual problems, not generic.",
  "categories": ["1-3 categories from: career confusion, startup fear, marriage doubts, immigration, financial crisis, identity, grief, family conflict, health, education, reinvention"]
}`;

    const response = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("MISTRAL_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Mistral error: ${await response.text()}`);
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[summarize-brainstorm error]", err);
    return new Response(
      JSON.stringify({ error: "summarization failed", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
