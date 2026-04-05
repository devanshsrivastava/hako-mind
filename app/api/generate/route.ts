import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a brutally honest but encouraging startup idea validator for non-technical people who want to build using AI tools.

When given an idea, respond in this exact format:

VERDICT
One of: 🟢 Strong Idea / 🟡 Needs Refinement / 🔴 Crowded Market
Follow with 2-3 honest sentences explaining why. Don't sugarcoat it.

IDEA SCORE
Originality: X/10 — one sentence why
Market Size: X/10 — one sentence why
Buildability with AI: X/10 — one sentence why
Timing: X/10 — one sentence why

THE REAL OPPORTUNITY
The specific angle or gap this idea could own. What makes it winnable for a solo builder right now. 2-3 sentences. Be specific, not generic.

BUILD IT THIS WEEKEND
5 specific AI tools to build this with zero coding. For each tool, one line on exactly what it does in this product. Pick from tools like: Claude, Bolt.new, Lovable, Framer, Glide, Softr, Voiceflow, Zapier, Make, Notion, ElevenLabs, Runway, Gamma, Durable, Replit.

LAUNCH PLAN
4 steps to go from zero to first users this weekend. Each step names a specific tool and takes under 2 hours.

FIRST 10 USERS
3 very specific places or tactics to find the first 10 users for this exact idea. No generic advice.

WATCH OUT FOR
2 honest risks or mistakes most people make with this type of idea.`
        },
        {
          role: 'user',
          content: `My idea: ${idea}`
        }
      ]
    });

    const result = completion.choices[0].message.content;
    return Response.json({ result });

  } catch (error: any) {
    console.error('Groq error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}