import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are the AI Startup War Room — 4 world-class experts who give founders the most honest, detailed, and actionable analysis they've ever received about their startup idea.

Return ONLY a valid JSON object. No text before or after. No markdown. No backticks.

The JSON must follow this exact structure:
{
  "agents": {
    "vc": "4-5 sentences. Cover: market size with a rough estimate, whether this is venture-scale or lifestyle business, what would make this fundable, and the one thing that would kill investor interest. Be specific and opinionated.",
    "pm": "4-5 sentences. Cover: what the MVP should include and exclude, what to build in week 1 vs month 3, the biggest product risk, and one counterintuitive product decision most founders get wrong for this type of idea.",
    "growth": "4-5 sentences. Cover: the single best distribution channel for this specific idea, a concrete first-week growth tactic, what the referral or sharing loop could look like, and the retention risk nobody talks about.",
    "reality": "4-5 sentences. Name 2-3 real specific competitors that exist today with a one-line description of each. Be honest about market saturation. Identify the one risk that kills most ideas like this. End with what would need to be true for this to win anyway."
  },
  "debate": [
    { "agent": "vc", "message": "Start with a specific concern or strong opinion about this idea. 25-35 words." },
    { "agent": "reality", "message": "Respond directly to VC. Add a specific competitor or risk. 25-35 words." },
    { "agent": "pm", "message": "Push back or agree with a specific product argument. Reference something the others said. 25-35 words." },
    { "agent": "growth", "message": "Give a contrarian distribution take. Be specific about a channel or tactic. 25-35 words." },
    { "agent": "reality", "message": "Challenge the growth take with a real concern. Stay grounded in facts. 25-35 words." },
    { "agent": "vc", "message": "Give a final verdict. Reference what others said. End with what needs to happen next. 25-35 words." }
  ],
  "criteria": {
    "marketSize": "one of exactly: large, moderate, small",
    "competition": "one of exactly: low, moderate, high",
    "buildability": "one of exactly: fast, medium, slow",
    "timing": "one of exactly: excellent, good, early, late",
    "monetization": "one of exactly: clear, possible, unclear"
  },
  "criteriaReasons": {
    "marketSize": "one sentence explaining why this market size classification",
    "competition": "one sentence explaining why this competition level",
    "buildability": "one sentence explaining why this buildability rating",
    "timing": "one sentence explaining why this timing classification",
    "monetization": "one sentence explaining why this monetization clarity"
  },
  "improvements": [
    { "action": "specific thing founder can do to improve the idea", "points": 8 },
    { "action": "specific thing founder can do to improve the idea", "points": 6 },
    { "action": "specific thing founder can do to improve the idea", "points": 4 }
  ],
  "agentConfidence": {
    "vc": "integer between 40 and 95",
    "pm": "integer between 40 and 95",
    "growth": "integer between 40 and 95",
    "reality": "integer between 40 and 95"
  },
  "scoreTag": "one of exactly: BUILD_NOW, BUILD_WITH_NICHE, DROP",
  "keyInsight": "one punchy sentence — the single most important thing the founder needs to know",
  "execution": {
    "mvp": ["specific bullet 1", "specific bullet 2", "specific bullet 3", "specific bullet 4"],
    "buildStack": ["specific tool and how to use it 1", "specific tool and how to use it 2", "specific tool and how to use it 3", "specific tool and how to use it 4"],
    "launchPlan": ["specific action with target 1", "specific action with target 2", "specific action with target 3", "specific action with target 4"],
    "firstUsers": ["specific community or person type with tactic 1", "specific community or person type with tactic 2", "specific community or person type with tactic 3", "specific community or person type with tactic 4"]
  }
}

Critical rules:
- criteria values must be exactly one of the specified options — no other values allowed
- scoreTag must be exactly one of: BUILD_NOW, BUILD_WITH_NICHE, DROP
- agentConfidence integers between 40-95 — Reality agent should almost always be 10-15 points lower than others
- debate messages must directly reference each other — no generic statements
- every bullet point must be specific to THIS idea — nothing generic
- name real tools, real platforms, real communities — never say 'social media' or 'relevant communities'
- improvements must be specific and actionable — not generic advice like 'validate your idea'
- assume the founder is non-technical and will build using Claude, Bolt.new, Lovable, Glide, Zapier, Framer or similar AI-first tools`;

// Scoring weights — criteria → points
const WEIGHTS = {
  marketSize:   { large: 30, moderate: 18, small: 8 },
  competition:  { low: 20, moderate: 15, high: 6 },
  buildability: { fast: 20, medium: 13, slow: 5 },
  timing:       { excellent: 15, good: 10, early: 6, late: 3 },
  monetization: { clear: 15, possible: 10, unclear: 4 },
};

export function calculateScore(criteria) {
  let total = 0;
  for (const [key, value] of Object.entries(criteria)) {
    const weight = WEIGHTS[key];
    if (weight && weight[value] !== undefined) {
      total += weight[value];
    }
  }
  return Math.min(100, Math.max(0, total));
}

export function getScoreBreakdown(criteria) {
  const maxPoints = { marketSize: 30, competition: 20, buildability: 20, timing: 15, monetization: 15 };
  return Object.entries(criteria).map(([key, value]) => ({
    key,
    value,
    earned: WEIGHTS[key]?.[value] ?? 0,
    max: maxPoints[key] ?? 0,
  }));
}

export async function POST(req) {
  try {
    const { idea, answers } = await req.json();

    const context = answers?.filter(a => a).length > 0
      ? `\n\nAdditional context:\n- Target user: ${answers[0] || 'not specified'}\n- Monetization: ${answers[1] || 'not specified'}\n- Core problem: ${answers[2] || 'not specified'}`
      : '';

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 3000,
      temperature: 0.75,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this startup idea thoroughly: ${idea}${context}` }
      ]
    });

    const raw = completion.choices[0].message.content;

    let parsed;
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error:', e);
      return Response.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Calculate score from criteria
    const score = calculateScore(parsed.criteria);
    const breakdown = getScoreBreakdown(parsed.criteria);

    return Response.json({
      result: {
        ...parsed,
        score,
        breakdown,
      }
    });

  } catch (error) {
    console.error('War Room error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}