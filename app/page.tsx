'use client';
import { useState } from 'react';

const LOADING_MESSAGES = [
  'Unboxing your idea...',
  'Checking the market...',
  'Consulting the AI oracle...',
  'Almost ready to ship...',
];

const EXAMPLES = [
  'AI meal planner for busy parents',
  'Marketplace for local tutors',
  'Newsletter for indie hackers',
];

export default function Home() {
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [showResult, setShowResult] = useState(false);

  function launchConfetti() {
    const colors = ['#ff6b6b', '#a855f7', '#06b6d4', '#f59e0b', '#4ade80', '#f472b6'];
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div');
      const size = 6 + Math.random() * 6;
      el.style.cssText = `
        position:fixed;top:-10px;z-index:999;pointer-events:none;
        left:${Math.random() * 100}vw;
        width:${size}px;height:${size}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        animation:confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * 0.5}s linear forwards;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }
  }

  function getVerdictClass(content: string) {
    if (content.includes('🟢')) return styles.verdictGreen;
    if (content.includes('🟡')) return styles.verdictYellow;
    return styles.verdictRed;
  }

  function parseScores(content: string) {
    return content.split('\n').filter(l => l.trim()).map(line => {
      const match = line.match(/(.+?):\s*(\d+)\/10\s*[—-]\s*(.+)/);
      if (!match) return null;
      const [, label, score, desc] = match;
      const pct = (parseInt(score) / 10) * 100;
      const color = pct >= 70 ? '#4ade80' : pct >= 50 ? '#f59e0b' : '#f87171';
      return { label: label.trim(), score, pct, color, desc };
    }).filter(Boolean);
  }

  function parseSections(raw: string) {
    const sections = [
      { key: 'VERDICT', icon: '🎯', title: 'Verdict', type: 'verdict' },
      { key: 'IDEA SCORE', icon: '📊', title: 'Idea Score', type: 'score' },
      { key: 'THE REAL OPPORTUNITY', icon: '💡', title: 'The real opportunity', type: 'text' },
      { key: 'BUILD IT THIS WEEKEND', icon: '🛠️', title: 'Build it this weekend', type: 'text' },
      { key: 'LAUNCH PLAN', icon: '🚀', title: 'Launch plan', type: 'text' },
      { key: 'FIRST 10 USERS', icon: '👥', title: 'First 10 users', type: 'text' },
      { key: 'WATCH OUT FOR', icon: '⚠️', title: 'Watch out for', type: 'text' },
    ];

    const keys = sections.map(s => s.key);
    return sections.map((sec, i) => {
      const start = raw.indexOf(sec.key);
      if (start === -1) return null;
      const contentStart = raw.indexOf('\n', start) + 1;
      const nextPositions = keys.slice(i + 1).map(k => raw.indexOf(k)).filter(p => p > start);
      const end = nextPositions.length ? Math.min(...nextPositions) : raw.length;
      return { ...sec, content: raw.slice(contentStart, end).trim() };
    }).filter(Boolean);
  }

  async function handleGenerate() {
    if (!idea.trim()) return;
    setLoading(true);
    setShowResult(false);
    setResult('');

    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 1800);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      clearInterval(interval);
      setResult(data.result || data.error || 'Something went wrong.');
      setShowResult(true);
      setLoading(false);
      launchConfetti();
    } catch (e) {
      clearInterval(interval);
      setResult('Something went wrong. Please try again.');
      setShowResult(true);
      setLoading(false);
    }
  }

  function handleReset() {
    setShowResult(false);
    setResult('');
    setIdea('');
  }

  const sections = result ? parseSections(result) : [];

  return (
    <>

      {/* Background blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {[
          { bg: '#ff6b6b', top: '-100px', left: '-100px', size: 500, delay: '0s' },
          { bg: '#a855f7', top: '20%', right: '-80px', size: 400, delay: '-2s' },
          { bg: '#06b6d4', bottom: '10%', left: '20%', size: 350, delay: '-4s' },
          { bg: '#f59e0b', bottom: '-80px', right: '10%', size: 300, delay: '-6s' },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.35,
            width: b.size, height: b.size, background: b.bg,
            top: b.top, left: b.left, right: b.right, bottom: b.bottom,
            animation: `drift 8s ${b.delay} ease-in-out infinite alternate`,
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: 56, animation: 'fadeUp .7s ease both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 100, padding: '6px 14px', fontSize: 12, fontWeight: 500,
            color: 'rgba(255,255,255,0.7)', marginBottom: 20, backdropFilter: 'blur(8px)',
          }}>
            <span style={{ width: 6, height: 6, background: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            ✦ idea validator
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(42px,8vw,72px)', fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginBottom: 16 }}>
            <span style={{ background: 'linear-gradient(135deg,#ff6b6b,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hako</span>
            <span style={{ color: '#fff' }}> </span>
            <span style={{ background: 'linear-gradient(135deg,#a855f7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mind</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', maxWidth: 500, margin: '0 auto 10px', lineHeight: 1.6, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: -0.3 }}>
            Unbox your box of ideas,
          </p>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: -0.3 }}>
            turn them into AI-powered products.
          </p>
        </header>

        {/* Input */}
        {!showResult && !loading && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: 28, backdropFilter: 'blur(20px)',
            animation: 'fadeUp .7s .15s ease both', marginBottom: 32,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Your idea</div>
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="e.g. An app that helps freelancers track which clients owe them money — no coding needed..."
              rows={4}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '16px 18px', fontFamily: 'DM Sans, sans-serif',
                fontSize: 16, color: '#fff', resize: 'none', outline: 'none', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {EXAMPLES.map(ex => (
                <span key={ex} onClick={() => setIdea(ex)} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 100, padding: '6px 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                }}>{ex}</span>
              ))}
            </div>
            <button onClick={handleGenerate} style={{
              width: '100%', marginTop: 20, padding: 18,
              background: 'linear-gradient(135deg,#a855f7,#06b6d4)', border: 'none',
              borderRadius: 14, fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700,
              color: '#fff', cursor: 'pointer', letterSpacing: -0.3,
            }}>
              📦 Unbox my idea
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', animation: 'fadeUp .4s ease both' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              {['#ff6b6b', '#a855f7', '#06b6d4', '#f59e0b'].map((color, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%', background: color,
                  animation: `bounce 1.2s ${i * 0.15}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>{loadingMsg}</div>
          </div>
        )}

        {/* Result */}
        {showResult && (
          <div style={{ animation: 'fadeUp .5s ease both' }}>
            {sections.map((sec, i) => {
              if (sec.type === 'verdict') {
                const verdictColor = sec.content.includes('🟢')
                  ? { bg: 'linear-gradient(135deg,rgba(74,222,128,0.15),rgba(6,182,212,0.1))', border: 'rgba(74,222,128,0.3)' }
                  : sec.content.includes('🟡')
                    ? { bg: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.1))', border: 'rgba(245,158,11,0.3)' }
                    : { bg: 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(248,113,113,0.1))', border: 'rgba(239,68,68,0.3)' };
                return (
                  <div key={i} style={{ background: verdictColor.bg, border: `1px solid ${verdictColor.border}`, borderRadius: 20, padding: '24px 28px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 20 }}>{sec.icon}</span>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)' }}>{sec.title}</span>
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap' }}>{sec.content}</div>
                  </div>
                );
              }

              if (sec.type === 'score') {
                const scores = parseScores(sec.content);
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '24px 28px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 20 }}>{sec.icon}</span>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)' }}>{sec.title}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {scores.map((s, j) => (
                        <div key={j} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 16px' }}>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: s.color }}>
                            {s.score}<span style={{ fontSize: 14, opacity: 0.5 }}>/10</span>
                          </div>
                          <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 2, animation: 'barFill .8s ease both', '--target-width': `${s.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '24px 28px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 20 }}>{sec.icon}</span>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)' }}>{sec.title}</span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap' }}>{sec.content}</div>
                </div>
              );
            })}

            <button onClick={handleReset} style={{
              width: '100%', marginTop: 8, padding: 14,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 500,
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            }}>
              📦 Unbox another idea
            </button>
          </div>
        )}
      </div>
    </>
  );
}