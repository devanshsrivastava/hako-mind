const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

async function tavilySearch(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  if (!TAVILY_API_KEY) {
    console.warn('TAVILY_API_KEY not set — skipping search');
    return [];
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!res.ok) {
      console.error(`Tavily error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data: TavilyResponse = await res.json();
    return (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));
  } catch (e) {
    console.error('Tavily search failed:', e);
    return [];
  }
}

const STRIP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'with', 'that', 'and', 'or', 'but', 'using', 'helps', 'which',
  'who', 'how', 'what', 'where', 'ai', 'ml', 'powered', 'based', 'driven', 'enabled',
  'smart', 'startup', 'saas', 'solution', 'system', 'software', 'better', 'faster',
  'easier', 'simple', 'best', 'new', 'modern',
]);

function extractCoreDomain(idea: string): string {
  return idea
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STRIP_WORDS.has(w))
    .slice(0, 5)
    .join(' ');
}

export async function searchCompetitors(idea: string): Promise<SearchResult[]> {
  const domain = extractCoreDomain(idea);
  const [r1, r2, r3] = await Promise.all([
    tavilySearch(`${domain} app competitors alternatives`, 4),
    tavilySearch(`best new ${domain} apps tools`, 4),
    tavilySearch(`${domain} site:reddit.com OR site:producthunt.com`, 4),
  ]);
  const seen = new Map<string, SearchResult>();
  for (const r of [...r1, ...r2, ...r3]) {
    const existing = seen.get(r.url);
    if (!existing || r.score > existing.score) seen.set(r.url, r);
  }
  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .filter(r => r.score > 0.3)
    .slice(0, 5);
}

export async function searchMarketData(idea: string): Promise<SearchResult[]> {
  const domain = extractCoreDomain(idea);
  const results = await tavilySearch(`${domain} market size industry growth`, 3);
  return results.filter(r => r.score > 0.3);
}

export async function searchProductHunt(idea: string): Promise<SearchResult[]> {
  const domain = extractCoreDomain(idea);
  return tavilySearch(`${domain} site:producthunt.com`, 3);
}

export function formatSearchContext(
  competitors: SearchResult[],
  marketData: SearchResult[],
  phResults: SearchResult[]
): string {
  let context = '';

  if (competitors.length > 0) {
    context += '=== REAL COMPETITORS (from live web search) ===\n';
    competitors.forEach((r, i) => {
      context += `${i + 1}. ${r.title}\n`;
      context += `   URL: ${r.url}\n`;
      context += `   ${r.content.slice(0, 200)}...\n\n`;
    });
  }

  if (phResults.length > 0) {
    context += '=== PRODUCT HUNT LAUNCHES (similar products) ===\n';
    phResults.forEach((r, i) => {
      context += `${i + 1}. ${r.title} — ${r.url}\n`;
      context += `   ${r.content.slice(0, 150)}...\n\n`;
    });
  }

  if (marketData.length > 0) {
    context += '=== MARKET DATA ===\n';
    marketData.forEach((r, i) => {
      context += `${i + 1}. ${r.title}\n`;
      context += `   ${r.content.slice(0, 200)}...\n\n`;
    });
  }

  return context;
}
