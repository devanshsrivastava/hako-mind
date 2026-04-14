'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Idea {
  id: string;
  idea_text: string;
  result: string;
  verdict: string;
  avg_score: number;
  created_at: string;
  username: string;
}

interface ParsedResult {
  agents?: Record<string, string>;
  debate?: { agent: string; message: string }[];
  keyInsight?: string;
  execution?: Record<string, string[]>;
}

const AGENTS = [
  { id: 'vc',     icon: '💰', name: 'VC',     color: '#a78bfa' },
  { id: 'pm',     icon: '🛠', name: 'PM',     color: '#38bdf8' },
  { id: 'growth', icon: '🚀', name: 'Growth', color: '#4ade80' },
  { id: 'reality',icon: '🧪', name: 'Reality',color: '#fb923c' },
];

function parseResult(raw: string): ParsedResult | null {
  try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); }
  catch { return null; }
}

function verdictInfo(verdict: string) {
  if (verdict === '🟢') return { bg: 'rgba(74,222,128,.1)', border: 'rgba(74,222,128,.25)', text: '#4ade80', label: 'Strong', glow: 'rgba(74,222,128,.15)' };
  if (verdict === '🟡') return { bg: 'rgba(251,191,36,.1)', border: 'rgba(251,191,36,.25)', text: '#fbbf24', label: 'Needs work', glow: 'rgba(251,191,36,.1)' };
  return { bg: 'rgba(248,113,113,.1)', border: 'rgba(248,113,113,.25)', text: '#f87171', label: 'Crowded', glow: 'rgba(248,113,113,.1)' };
}

function timeAgo(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Modal ────────────────────────────────────────────────
function IdeaModal({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'summary' | 'plan' | 'debate'>('summary');
  const vc = verdictInfo(idea.verdict);
  const parsed = parseResult(idea.result);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)' }} />
      <div style={{ position: 'relative', background: '#1a1a2e', border: '1px solid rgba(255,255,255,.12)', borderRadius: 24, width: '100%', maxWidth: 580, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'modalUp .3s ease both' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.5, flex: 1 }}>{idea.idea_text}</div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: 'rgba(255,255,255,.6)', fontSize: 14, flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: vc.bg, border: `1px solid ${vc.border}`, borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: vc.text }}>{idea.verdict} {vc.label}</span>
            {idea.avg_score > 0 && <span style={{ background: 'rgba(255,255,255,.07)', borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#fff' }}>🔥 {idea.avg_score}/100</span>}
            <a href={`/profile/${idea.username}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>@{idea.username}</a>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{timeAgo(idea.created_at)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
          {([{ id: 'summary', label: '🧠 Expert views' }, { id: 'plan', label: '🚀 Execution' }, { id: 'debate', label: '⚔️ Debate' }] as const).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, padding: '10px 6px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? '#a78bfa' : 'transparent'}`, fontSize: 12, fontWeight: 600, color: activeTab === t.id ? '#a78bfa' : 'rgba(255,255,255,.4)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{t.label}</button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          {parsed ? (
            <>
              {activeTab === 'summary' && (
                <div>
                  {parsed.keyInsight && (
                    <div style={{ background: '#12121f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.6 }}>
                      💡 <strong style={{ color: '#fff' }}>Key insight:</strong> {parsed.keyInsight}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {AGENTS.map(agent => {
                      const text = parsed.agents?.[agent.id];
                      if (!text) return null;
                      return (
                        <div key={agent.id} style={{ background: '#12121f', borderLeft: `3px solid ${agent.color}`, border: `1px solid rgba(255,255,255,.07)`, borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span>{agent.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: agent.color }}>{agent.name}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.5 }}>{text.split('. ').slice(0, 2).join('. ') + '.'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {activeTab === 'plan' && parsed.execution && (
                <div>
                  {['mvp', 'launchPlan'].map(key => {
                    const items = parsed.execution?.[key];
                    if (!items?.length) return null;
                    return (
                      <div key={key} style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{key === 'mvp' ? 'MVP' : 'Launch plan'}</div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {items.map((item, i) => (
                            <li key={i} style={{ display: 'flex', gap: 8 }}>
                              <span style={{ color: key === 'mvp' ? '#a78bfa' : '#4ade80', fontSize: 13, flexShrink: 0 }}>▸</span>
                              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeTab === 'debate' && parsed.debate && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {parsed.debate.map((msg, i) => {
                    const agent = AGENTS.find(a => a.id === msg.agent) || AGENTS[0];
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${agent.color}18`, border: `1px solid ${agent.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{agent.icon}</div>
                        <div style={{ background: '#12121f', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, borderTopLeftRadius: 4, padding: '8px 12px', flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: agent.color, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{agent.name}</div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', lineHeight: 1.5 }}>{msg.message}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.7 }}>{idea.result?.slice(0, 500)}...</div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
          <a href="/" style={{ display: 'block', textAlign: 'center', padding: '11px', background: 'linear-gradient(135deg,#7c3aed,#0ea5e9)', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', textDecoration: 'none', fontFamily: 'Syne, sans-serif' }}>
            ⚡ Validate my own idea →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Carousel row ─────────────────────────────────────────
function CarouselRow({ title, ideas, onSelect }: { title: string; ideas: Idea[]; onSelect: (idea: Idea) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  }

  if (ideas.length === 0) return null;

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingRight: 4 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => scroll('left')} disabled={!canScrollLeft} style={{ width: 30, height: 30, background: canScrollLeft ? '#1a1a2e' : 'rgba(255,255,255,.03)', border: `1px solid ${canScrollLeft ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.06)'}`, borderRadius: '50%', cursor: canScrollLeft ? 'pointer' : 'default', color: canScrollLeft ? '#fff' : 'rgba(255,255,255,.2)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>←</button>
          <button onClick={() => scroll('right')} disabled={!canScrollRight} style={{ width: 30, height: 30, background: canScrollRight ? '#1a1a2e' : 'rgba(255,255,255,.03)', border: `1px solid ${canScrollRight ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.06)'}`, borderRadius: '50%', cursor: canScrollRight ? 'pointer' : 'default', color: canScrollRight ? '#fff' : 'rgba(255,255,255,.2)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>→</button>
        </div>
      </div>

      {/* Scrollable track */}
      <div ref={scrollRef} onScroll={checkScroll} style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {ideas.map((idea) => {
          const vc = verdictInfo(idea.verdict);
          const parsed = parseResult(idea.result);
          return (
            <div key={idea.id} onClick={() => onSelect(idea)} style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: '18px', cursor: 'pointer', flexShrink: 0, width: 260, scrollSnapAlign: 'start', transition: 'transform .2s, border-color .2s', display: 'flex', flexDirection: 'column', gap: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,.35)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.08)'; }}>

              {/* Top */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ background: vc.bg, border: `1px solid ${vc.border}`, borderRadius: 100, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: vc.text }}>{idea.verdict} {vc.label}</span>
                {idea.avg_score > 0 && <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, color: '#fff' }}>🔥 {idea.avg_score}</span>}
              </div>

              {/* Idea text */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.45, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                {idea.idea_text}
              </div>

              {/* Key insight */}
              {parsed?.keyInsight && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.5, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  💡 {parsed.keyInsight}
                </div>
              )}

              {/* Bottom */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>@{idea.username.split('-').slice(0, 2).join('-')}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{timeAgo(idea.created_at)}</span>
              </div>
            </div>
          );
        })}

        {/* End card — CTA */}
        <div style={{ background: 'rgba(139,92,246,.08)', border: '1px dashed rgba(139,92,246,.3)', borderRadius: 18, padding: '18px', flexShrink: 0, width: 200, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>⚡</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', lineHeight: 1.4 }}>Validate your own idea</div>
          <a href="/" style={{ background: 'linear-gradient(135deg,#7c3aed,#0ea5e9)', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>Enter War Room →</a>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────
export default function ExplorePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);

  useEffect(() => { fetchIdeas(); }, []);

  async function fetchIdeas() {
    const { data } = await supabase
      .from('ideas').select('*').eq('is_public', true)
      .order('created_at', { ascending: false }).limit(60);
    if (data) setIdeas(data);
    setLoading(false);
  }

  const strong   = ideas.filter(i => i.verdict === '🟢');
  const needWork = ideas.filter(i => i.verdict === '🟡');
  const crowded  = ideas.filter(i => i.verdict === '🔴');
  const topPicks = [...ideas].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0)).slice(0, 8);
  const recent   = [...ideas].slice(0, 8);

  const stats = {
    total: ideas.length,
    strong: strong.length,
    avgScore: ideas.length ? Math.round(ideas.reduce((s, i) => s + (i.avg_score || 0), 0) / ideas.length) : 0,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes bounce{0%,80%,100%{transform:scale(.8);opacity:.5}40%{transform:scale(1.2);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalUp{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0d0d14;font-family:'DM Sans',sans-serif;color:#f0f0f0}
        :root{color-scheme:dark;background-color:#0d0d14}
        div::-webkit-scrollbar{display:none}
      `}</style>

      {/* Nav */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(13,13,20,.95)', backdropFilter: 'blur(10px)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18 }}>
            <span style={{ background: 'linear-gradient(135deg,#ff6b6b,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hako</span>
            {' '}
            <span style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mind</span>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
<a href="/" style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', textDecoration: 'none', background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 100, padding: '6px 14px' }}>⚡ War Room</a>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, animation: 'fadeUp .5s ease both' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, letterSpacing: -1, marginBottom: 4, color: '#fff' }}>🌍 Explore ideas</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>See what the community is building and validating</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          {[
            { label: 'Ideas validated', value: stats.total, color: '#a78bfa' },
            { label: 'Strong ideas',    value: stats.strong, color: '#4ade80' },
            { label: 'Avg score',       value: `${stats.avgScore}/100`, color: '#38bdf8' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 14px', flex: 1 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {['#a78bfa', '#38bdf8', '#4ade80', '#fb923c'].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, animation: `bounce 1.2s ${i * 0.15}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        ) : ideas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: '#1a1a2e', borderRadius: 20, border: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>No ideas yet</div>
            <a href="/" style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>Be the first →</a>
          </div>
        ) : (
          <>
            <CarouselRow title="🏆 Top picks" ideas={topPicks} onSelect={setSelectedIdea} />
            <CarouselRow title="🟢 Strong ideas — ready to build" ideas={strong} onSelect={setSelectedIdea} />
            <CarouselRow title="🕐 Recently validated" ideas={recent} onSelect={setSelectedIdea} />
            <CarouselRow title="🟡 Needs work — worth refining" ideas={needWork} onSelect={setSelectedIdea} />
            {crowded.length > 0 && <CarouselRow title="🔴 Crowded market" ideas={crowded} onSelect={setSelectedIdea} />}
          </>
        )}
      </div>

      {selectedIdea && <IdeaModal idea={selectedIdea} onClose={() => setSelectedIdea(null)} />}
    </>
  );
}