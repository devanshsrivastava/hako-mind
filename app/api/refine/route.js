import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function extractJSON(raw) {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {}

  // Strip markdown code blocks
  const stripped = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {}

  // Extract first { ... } block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  return null;
}

export async function POST(req) {
  try {
    const { idea, improvements } = await req.json();

    const improvementList = improvements
      .map((imp, i) => `${i + 1}. ${imp.action} (+${imp.points} pts)`)
      .join('\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      temperature: 0.65,
      messages: [
        {
          role: 'system',
          content: `You are a startup idea refiner. Rewrite a startup idea to incorporate specific improvements.

You MUST respond with ONLY a raw JSON object. No markdown. No backticks. No explanation. Just the JSON.

Example of correct output format:
{"refinedIdea": "your refined idea here", "changes": ["change 1", "change 2", "change 3"]}`
        },
        {
          role: 'user',
          content: `Original idea: ${idea}

Improvements to incorporate:
${improvementList}

Rewrite the idea in 2-3 sentences to naturally address these improvements. Be specific about the target user, problem, monetization, and differentiation.

Respond with ONLY this JSON (no markdown, no backticks):
{"refinedIdea": "...", "changes": ["...", "...", "..."]}`
        }
      ]
    });

    const raw = completion.choices[0].message.content;
    console.log('Refine raw output:', raw.slice(0, 300));

    const parsed = extractJSON(raw);

    if (!parsed || !parsed.refinedIdea) {
      // Graceful fallback — construct a basic refined idea from improvements
      return Response.json({
        result: {
          refinedIdea: `${idea} — refined to address: ${improvements.slice(0, 2).map(i => i.action.toLowerCase()).join(' and ')}.`,
          changes: improvements.map(i => i.action),
        }
      });
    }

    return Response.json({ result: parsed });

  } catch (error) {
    console.error('Refine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}