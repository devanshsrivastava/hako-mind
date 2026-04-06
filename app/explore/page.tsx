'use client';
import { useEffect, useState } from 'react';
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

export default function ExplorePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | '🟢' | '🟡' | '🔴'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchIdeas();
  }, []);

  async function fetchIdeas() {
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setIdeas(data);
    setLoading(false);
  }

  function verdictColor(verdict: string) {
    if (verdict === '🟢') return { bg: 'rgba(74,222,128,0.1)', border: 'rgba(22,163,74,0.25)', text: '#16a34a', label: 'Strong' };
    if (verdict === '🟡') return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(217,119,6,0.25)', text: '#d97706', label: 'Needs work' };
    return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(220,38,38,0.25)', text: '#dc2626', label: 'Crowded' };
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const filtered = filter === 'all' ? ideas : ideas.filter(i => i.verdict === filter);

  const stats = {
    total: ideas.length,
    strong: ideas.filter(i => i.verdict === '🟢').length,
    avgScore: ideas.length ? Math.round(ideas.reduce((s, i) => s + (i.avg_score || 0), 0) / ideas.length) : 0,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
        @keyframes bounce { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1.2);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f9f9f9; font-family: 'DM Sans', sans-serif; color: #0a0a0f; }
      `}</style>

      {/* Nav */}
      <div style={{ borderBottom: '1px solid #ebebeb', background: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20 }}>
            <span style={{ background: 'linear-gradient(135deg,#ff6b6b,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hako</span>
            {' '}
            <span style={{ background: 'linear-gradient(135deg,#a855f7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mind</span>
          </span>
        </a>
        <a href="/" style={{ fontSize: 14, fontWeight: 600, color: '#a855f7', textDecoration: 'none' }}>📦 Unbox an idea</a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, animation: 'fadeUp .5s ease both' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 8, color: '#0a0a0f' }}>
            🌍 Explore ideas
          </h1>
          <p style={{ fontSize: 16, color: '#666', fontWeight: 500 }}>See what the community is building with AI tools</p>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Ideas shared', value: stats.total },
            { label: 'Strong ideas', value: stats.strong },
            { label: 'Avg score', value: `${stats.avgScore}/10` },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #ebebeb', padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#0a0a0f' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {([
            { key: 'all', label: 'All ideas' },
            { key: '🟢', label: '🟢 Strong' },
            { key: '🟡', label: '🟡 Needs work' },
            { key: '🔴', label: '🔴 Crowded' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
              padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
              background: filter === tab.key ? 'linear-gradient(135deg,#a855f7,#06b6d4)' : '#fff',
              border: filter === tab.key ? 'none' : '1px solid #e0e0e0',
              color: filter === tab.key ? '#fff' : '#555',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ideas feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {['#ff6b6b', '#a855f7', '#06b6d4', '#f59e0b'].map((color, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: color, animation: `bounce 1.2s ${i * 0.15}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 20, border: '1px solid #ebebeb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0a0a0f', marginBottom: 8 }}>No ideas here yet</div>
            <a href="/" style={{ fontSize: 14, color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}>Be the first to unbox one →</a>
          </div>
        ) : (
          filtered.map((idea, i) => {
            const vc = verdictColor(idea.verdict);
            const isExpanded = expandedId === idea.id;
            return (
              <div key={idea.id} style={{ background: '#fff', borderRadius: 20, border: '1px solid #ebebeb', padding: '20px 24px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.03)', animation: `fadeUp ${.2 + i * .04}s ease both`, transition: 'box-shadow .2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0f', lineHeight: 1.5, marginBottom: 10 }}>
                      {idea.idea_text}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: vc.bg, border: `1px solid ${vc.border}`, borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: vc.text }}>
                        {idea.verdict} {vc.label}
                      </span>
                      {idea.avg_score > 0 && (
                        <span style={{ background: '#f5f5f7', borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#555' }}>
                          ⭐ {idea.avg_score}/10
                        </span>
                      )}
                      <a href={`/profile/${idea.username}`} style={{ fontSize: 12, color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}>
                        @{idea.username}
                      </a>
                      <span style={{ fontSize: 12, color: '#ccc', fontWeight: 500 }}>{formatDate(idea.created_at)}</span>
                    </div>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : idea.id)} style={{ background: '#f5f5f7', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#666', cursor: 'pointer', flexShrink: 0 }}>
                    {isExpanded ? 'Hide ↑' : 'View ↓'}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0', fontSize: 14, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                    {idea.result}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
