import Groq from 'groq-sdk';
import { searchCompetitors, searchMarketData, searchProductHunt, formatSearchContext } from '@/lib/search';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Scoring weights — deterministic
const WEIGHTS = {
  marketSize:   { large: 30, moderate: 18, small: 8 },
  competition:  { low: 20, moderate: 15, high: 6 },
  buildability: { fast: 20, medium: 13, slow: 5 },
  timing:       { excellent: 15, good: 10, early: 6, late: 3 },
  monetization: { clear: 15, possible: 10, unclear: 4 },
};
const MAX_POINTS = { marketSize: 30, competition: 20, buildability: 20, timing: 15, monetization: 15 };

function calculateScore(criteria) {
  let total = 0;
  for (const [key, value] of Object.entries(criteria)) {
    total += WEIGHTS[key]?.[value] ?? 0;
  }
  return Math.min(100, Math.max(0, total));
}

function getScoreBreakdown(criteria) {
  return Object.entries(criteria).map(([key, value]) => ({
    key, value,
    earned: WEIGHTS[key]?.[value] ?? 0,
    max: MAX_POINTS[key] ?? 0,
  }));
}

// Individual agent prompts — each gets previous context
const AGENT_PROMPTS = {
  vc: (idea, context, searchContext) => `You are a brutally honest venture capitalist analysing a startup idea.

Idea: ${idea}
${context}
${searchContext ? `Live market research:\n${searchContext}` : ''}

Return ONLY a JSON object:
{
  "take": "4-5 sentences covering: market size estimate, venture-scale vs lifestyle business, what would make this fundable, and the one thing that kills investor interest. Be specific and opinionated.",
  "confidence": <integer 40-95>
}`,

  pm: (idea, context, vcOutput) => `You are a senior product manager analysing a startup idea.

Idea: ${idea}
${context}

VC's analysis (read this and respond to it where relevant):
${vcOutput}

Return ONLY a JSON object:
{
  "take": "4-5 sentences covering: what MVP should include/exclude, what to build week 1 vs month 3, biggest product risk, and one counterintuitive product decision most founders get wrong. Directly respond to the VC's points where you agree or disagree.",
  "confidence": <integer 40-95>
}`,

  growth: (idea, context, vcOutput, pmOutput) => `You are a growth expert analysing a startup idea.

Idea: ${idea}
${context}

What VC said: ${vcOutput}
What PM said: ${pmOutput}

Return ONLY a JSON object:
{
  "take": "4-5 sentences covering: single best distribution channel for this specific idea, concrete first-week growth tactic, what the referral or sharing loop looks like, and the retention risk nobody talks about. Respond specifically to what VC and PM said.",
  "confidence": <integer 40-95>
}`,

  reality: (idea, context, vcOutput, pmOutput, growthOutput, searchContext) => `You are a brutally honest market analyst who specialises in finding why startups fail.

Idea: ${idea}
${context}

${searchContext ? `LIVE COMPETITOR RESEARCH (use this — cite real URLs):\n${searchContext}` : ''}

What VC said: ${vcOutput}
What PM said: ${pmOutput}
What Growth said: ${growthOutput}

Return ONLY a JSON object:
{
  "take": "4-5 sentences. MUST name 2-3 real competitors from the research with their URLs. Be honest about saturation. Identify the one risk that kills most ideas like this. Challenge at least one point the other agents made. End with what would need to be true for this to win.",
  "confidence": <integer 40-95 — you should almost always be 10-15 points lower than others>
}`,

  synthesizer: (idea, context, vcOutput, pmOutput, growthOutput, realityOutput, searchContext) => `You are synthesizing a War Room analysis from 4 expert agents into a final structured report.

Idea: ${idea}
${context}

VC said: ${vcOutput}
PM said: ${pmOutput}
Growth said: ${growthOutput}
Reality said: ${realityOutput}

${searchContext ? `Live research data:\n${searchContext}` : ''}

Return ONLY a valid JSON object — no markdown, no backticks:
{
  "debate": [
    { "agent": "vc", "message": "Opening strong opinion referencing the market. 25-35 words." },
    { "agent": "reality", "message": "Direct response to VC citing a specific competitor from research. 25-35 words." },
    { "agent": "pm", "message": "Pushback or agreement with specific product argument. 25-35 words." },
    { "agent": "growth", "message": "Contrarian distribution take with specific channel. 25-35 words." },
    { "agent": "reality", "message": "Challenge to growth take with market fact. 25-35 words." },
    { "agent": "vc", "message": "Final verdict referencing all agents. What needs to happen next. 25-35 words." }
  ],
  "criteria": {
    "marketSize": "large|moderate|small",
    "competition": "low|moderate|high",
    "buildability": "fast|medium|slow",
    "timing": "excellent|good|early|late",
    "monetization": "clear|possible|unclear"
  },
  "criteriaReasons": {
    "marketSize": "one sentence — cite market data if available",
    "competition": "one sentence — name specific competitors",
    "buildability": "one sentence",
    "timing": "one sentence",
    "monetization": "one sentence"
  },
  "improvements": [
    { "action": "specific actionable improvement", "points": 8 },
    { "action": "specific actionable improvement", "points": 6 },
    { "action": "specific actionable improvement", "points": 4 }
  ],
  "scoreTag": "BUILD_NOW|BUILD_WITH_NICHE|DROP",
  "keyInsight": "single most important thing the founder needs to know",
  "execution": {
    "mvp": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
    "buildStack": ["specific AI tool + how to use it 1", "2", "3", "4"],
    "launchPlan": ["specific action with target 1", "2", "3", "4"],
    "firstUsers": ["specific community + tactic 1", "2", "3", "4"]
  }
}

Rules:
- debate messages must directly quote or reference what the specific agents said above
- criteria values must be exactly one of the specified options
- scoreTag must be exactly BUILD_NOW, BUILD_WITH_NICHE, or DROP
- every bullet must be specific to this idea — nothing generic
- assume non-technical founder building with Claude, Bolt.new, Lovable, Zapier, Framer`,
};

async function callAgent(prompt) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 800,
    temperature: 0.75,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = completion.choices[0].message.content;
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Agent returned invalid JSON');
  }
}

async function callSynthesizer(prompt) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2500,
    temperature: 0.75,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = completion.choices[0].message.content;
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Synthesizer returned invalid JSON');
  }
}

export async function POST(req) {
  const { idea, answers } = await req.json();

  const context = answers?.filter(a => a).length > 0
    ? `Context: target user: ${answers[0] || 'not specified'}, monetization: ${answers[1] || 'not specified'}, core problem: ${answers[2] || 'not specified'}`
    : '';

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // STEP 1 — Search
        send({ step: 'search', status: 'active', message: 'Searching the web for competitors and market data...' });
        const [competitors, marketData, phResults] = await Promise.all([
          searchCompetitors(idea),
          searchMarketData(idea),
          searchProductHunt(idea),
        ]);
        const searchContext = formatSearchContext(competitors, marketData, phResults);
        const sources = [
          ...competitors.slice(0, 3).map(r => ({ ...r, type: 'competitor' })),
          ...phResults.slice(0, 2).map(r => ({ ...r, type: 'producthunt' })),
        ];
        send({ step: 'search', status: 'done', message: `Found ${competitors.length + phResults.length} live sources` });

        // STEP 2 — VC Agent
        send({ step: 'vc', status: 'active', message: 'VC is analysing the market opportunity...' });
        const vcResult = await callAgent(AGENT_PROMPTS.vc(idea, context, searchContext));
        send({ step: 'vc', status: 'done', message: 'VC analysis complete', data: vcResult });

        // STEP 3 — PM Agent
        send({ step: 'pm', status: 'active', message: 'PM is defining the product scope...' });
        const pmResult = await callAgent(AGENT_PROMPTS.pm(idea, context, vcResult.take));
        send({ step: 'pm', status: 'done', message: 'PM analysis complete', data: pmResult });

        // STEP 4 — Growth Agent
        send({ step: 'growth', status: 'active', message: 'Growth is planning user acquisition...' });
        const growthResult = await callAgent(AGENT_PROMPTS.growth(idea, context, vcResult.take, pmResult.take));
        send({ step: 'growth', status: 'done', message: 'Growth analysis complete', data: growthResult });

        // STEP 5 — Reality Agent
        send({ step: 'reality', status: 'active', message: 'Reality is checking competitors and risks...' });
        const realityResult = await callAgent(AGENT_PROMPTS.reality(idea, context, vcResult.take, pmResult.take, growthResult.take, searchContext));
        send({ step: 'reality', status: 'done', message: 'Reality check complete', data: realityResult });

        // STEP 6 — Synthesizer
        send({ step: 'synthesize', status: 'active', message: 'Synthesizing the full War Room report...' });
        const synthesis = await callSynthesizer(
          AGENT_PROMPTS.synthesizer(idea, context, vcResult.take, pmResult.take, growthResult.take, realityResult.take, searchContext)
        );

        const score = calculateScore(synthesis.criteria);
        const breakdown = getScoreBreakdown(synthesis.criteria);

        const finalResult = {
          agents: {
            vc: vcResult.take,
            pm: pmResult.take,
            growth: growthResult.take,
            reality: realityResult.take,
          },
          agentConfidence: {
            vc: vcResult.confidence || 75,
            pm: pmResult.confidence || 75,
            growth: growthResult.confidence || 70,
            reality: realityResult.confidence || 60,
          },
          debate: synthesis.debate,
          criteria: synthesis.criteria,
          criteriaReasons: synthesis.criteriaReasons,
          improvements: synthesis.improvements,
          scoreTag: synthesis.scoreTag,
          keyInsight: synthesis.keyInsight,
          execution: synthesis.execution,
          score,
          breakdown,
          sources,
          searchUsed: searchContext.length > 0,
        };

        send({ step: 'synthesize', status: 'done', message: 'War Room ready' });
        send({ step: 'complete', result: finalResult });

      } catch (error) {
        console.error('War Room pipeline error:', error);
        send({ step: 'error', message: error.message || 'Something went wrong. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}