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

interface Section {
  key: string;
  icon: string;
  title: string;
  type: string;
  content: string;
}

interface Score {
  label: string;
  score: string;
  pct: number;
  color: string;
  desc: string;
}

function getIdeaHint(text: string): { emoji: string; message: string; color: string } {
  const len = text.trim().length;
  if (len === 0) return { emoji: '', message: '', color: '' };
  if (len < 20) return { emoji: '✏️', message: 'Keep going — describe the problem it solves', color: '#d97706' };
  if (len < 60) return { emoji: '💡', message: "Good start — add who it's for to sharpen the result", color: '#d97706' };
  if (len < 120) return { emoji: '🔥', message: 'Nice detail — this will get a strong analysis', color: '#16a34a' };
  return { emoji: '🚀', message: 'Great idea description — ready to unbox!', color: '#a855f7' };
}

export default function Home() {
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [showResult, setShowResult] = useState(false);
  const [visibleSections, setVisibleSections] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const hint = getIdeaHint(idea);

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

  function revealSectionsOneByOne(total: number) {
    setVisibleSections(0);
    for (let i = 1; i <= total; i++) {
      setTimeout(() => setVisibleSections(i), i * 200);
    }
  }

  function parseScores(content: string): Score[] {
    return content.split('\n').filter(l => l.trim()).map(line => {
      const match = line.match(/(.+?):\s*(\d+)\/10\s*[—-]\s*(.+)/);
      if (!match) return null;
      const [, label, score, desc] = match;
      const pct = (parseInt(score) / 10) * 100;
      const color = pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
      return { label: label.trim(), score, pct, color, desc };
    }).filter(Boolean) as Score[];
  }

  function parseSections(raw: string): Section[] {
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
    }).filter(Boolean) as Section[];
  }

  function getScoreSummary(sections: Section[]): string {
    const scoreSection = sections.find(s => s.type === 'score');
    if (!scoreSection) return '';
    const scores = parseScores(scoreSection.content);
    if (!scores.length) return '';
    const avg = Math.round(scores.reduce((sum, s) => sum + parseInt(s.score), 0) / scores.length);
    return `${avg}/10`;
  }

  function handleShare(sections: Section[]) {
    const verdict = sections.find(s => s.type === 'verdict');
    const emoji = verdict?.content.includes('🟢') ? '🟢' : verdict?.content.includes('🟡') ? '🟡' : '🔴';
    const score = getScoreSummary(sections);
    const tweet = `Just validated my idea on Hako Mind 📦\n\nVerdict: ${emoji}\nAvg score: ${score}\n\nUnbox your ideas free → hakomind.vercel.app`;
    navigator.clipboard.writeText(tweet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleGenerate() {
    if (!idea.trim()) return;
    setLoading(true);
    setShowResult(false);
    setResult('');
    setVisibleSections(0);

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
      const raw = data.result || data.error || 'Something went wrong.';
      setResult(raw);
      setShowResult(true);
      setLoading(false);
      launchConfetti();
      const parsed = parseSections(raw);
      revealSectionsOneByOne(parsed.length);
    } catch (e) {
      clearInterval(interval);
      setResult('Something went wrong. Please try again.');
      setShowResult(true);
      setLoading(false);
      setVisibleSections(1);
    }
  }

  function handleReset() {
    setShowResult(false);
    setResult('');
    setIdea('');
    setVisibleSections(0);
    setCopied(false);
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
            position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.18,
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
            background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 100, padding: '6px 14px', fontSize: 12, fontWeight: 600,
            color: '#444444', marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, background: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            ✦ idea validator
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(42px,8vw,72px)', fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginBottom: 20 }}>
            <span style={{ background: 'linear-gradient(135deg,#ff6b6b,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hako</span>
            {' '}
            <span style={{ background: 'linear-gradient(135deg,#a855f7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mind</span>
          </h1>
          <p style={{ fontSize: 18, color: '#1a1a1a', maxWidth: 500, margin: '0 auto 4px', lineHeight: 1.6, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: -0.3 }}>
            Unbox your box of ideas,
          </p>
          <p style={{ fontSize: 18, color: '#1a1a1a', maxWidth: 500, margin: '0 auto', lineHeight: 1.6, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: -0.3 }}>
            turn them into AI-powered products.
          </p>
        </header>

        {/* Input */}
        {!showResult && !loading && (
          <div style={{
            background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 24, padding: 28, backdropFilter: 'blur(20px)',
            animation: 'fadeUp .7s .15s ease both', marginBottom: 32,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Your idea</div>
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="e.g. An app that helps freelancers track which clients owe them money — no coding needed..."
              rows={4}
              style={{
                width: '100%', background: '#f5f5f7', border: '1.5px solid #e0e0e0',
                borderRadius: 14, padding: '16px 18px', fontFamily: 'DM Sans, sans-serif',
                fontSize: 16, color: '#0a0a0f', resize: 'none', outline: 'none', lineHeight: 1.6,
                fontWeight: 500, transition: 'border-color .2s',
              }}
            />

            {/* Hint + char counter */}
            <div style={{ minHeight: 28, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {hint.message ? (
                <span style={{ fontSize: 13, color: hint.color, fontWeight: 600, transition: 'all .3s' }}>
                  {hint.emoji} {hint.message}
                </span>
              ) : <span />}
              {idea.length > 0 && (
                <span style={{ fontSize: 12, color: '#aaaaaa', fontWeight: 500 }}>
                  {idea.length} chars
                </span>
              )}
            </div>

            {/* Example chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {EXAMPLES.map(ex => (
                <span key={ex} onClick={() => setIdea(ex)} style={{
                  background: '#f0f0f0', border: '1px solid #e0e0e0',
                  borderRadius: 100, padding: '6px 14px', fontSize: 13,
                  color: '#444444', cursor: 'pointer', fontWeight: 500,
                }}>{ex}</span>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={!idea.trim()}
              style={{
                width: '100%', marginTop: 20, padding: 18,
                background: idea.trim() ? 'linear-gradient(135deg,#a855f7,#06b6d4)' : '#e5e5e5',
                border: 'none', borderRadius: 14, fontFamily: 'Syne, sans-serif',
                fontSize: 18, fontWeight: 700,
                color: idea.trim() ? '#fff' : '#aaaaaa',
                cursor: idea.trim() ? 'pointer' : 'not-allowed',
                letterSpacing: -0.3, transition: 'all .3s',
              }}
            >
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
            <div style={{ color: '#555555', fontSize: 14, fontWeight: 500 }}>{loadingMsg}</div>
          </div>
        )}

        {/* Result — sections reveal one by one */}
        {showResult && (
          <div>
            {sections.map((sec, i) => {
              if (i >= visibleSections) return null;

              const sectionStyle: React.CSSProperties = {
                opacity: 1,
                transform: 'translateY(0)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
                marginBottom: 16,
              };

              if (sec.type === 'verdict') {
                const verdictColor = sec.content.includes('🟢')
                  ? { bg: 'linear-gradient(135deg,rgba(74,222,128,0.12),rgba(6,182,212,0.08))', border: 'rgba(22,163,74,0.3)' }
                  : sec.content.includes('🟡')
                    ? { bg: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.08))', border: 'rgba(217,119,6,0.3)' }
                    : { bg: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(248,113,113,0.08))', border: 'rgba(220,38,38,0.3)' };
                return (
                  <div key={i} style={{ ...sectionStyle, background: verdictColor.bg, border: `1.5px solid ${verdictColor.border}`, borderRadius: 20, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', animation: 'fadeUp 0.4s ease both' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 20 }}>{sec.icon}</span>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#555555' }}>{sec.title}</span>
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.8, color: '#0a0a0f', whiteSpace: 'pre-wrap', fontWeight: 500 }}>{sec.content}</div>
                  </div>
                );
              }

              if (sec.type === 'score') {
                const scores = parseScores(sec.content);
                return (
                  <div key={i} style={{ ...sectionStyle, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', animation: 'fadeUp 0.4s ease both' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 20 }}>{sec.icon}</span>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#555555' }}>{sec.title}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {scores.map((s, j) => (
                        <div key={j} style={{ background: '#f5f5f7', borderRadius: 12, padding: '14px 16px' }}>
                          <div style={{ fontSize: 12, color: '#777777', marginBottom: 6, fontWeight: 600 }}>{s.label}</div>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: s.color }}>
                            {s.score}<span style={{ fontSize: 14, color: '#999', fontWeight: 500 }}>/10</span>
                          </div>
                          <div style={{ height: 4, background: '#e5e5e5', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 2, animation: 'barFill .8s ease both' } as React.CSSProperties} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} style={{ ...sectionStyle, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', animation: 'fadeUp 0.4s ease both' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 20 }}>{sec.icon}</span>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#555555' }}>{sec.title}</span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.8, color: '#0a0a0f', whiteSpace: 'pre-wrap', fontWeight: 500 }}>{sec.content}</div>
                </div>
              );
            })}

            {/* Action buttons — appear after all sections revealed */}
            {visibleSections >= sections.length && sections.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8, animation: 'fadeUp .4s ease both' }}>
                <button onClick={() => handleShare(sections)} style={{
                  flex: 1, padding: 14,
                  background: copied ? '#16a34a' : 'linear-gradient(135deg,#a855f7,#06b6d4)',
                  border: 'none', borderRadius: 14, fontFamily: 'Syne, sans-serif',
                  fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  transition: 'all .3s',
                }}>
                  {copied ? '✅ Copied to clipboard!' : '🐦 Share on X / Twitter'}
                </button>
                <button onClick={handleReset} style={{
                  flex: 1, padding: 14,
                  background: '#f0f0f0', border: '1px solid #e0e0e0',
                  borderRadius: 14, fontFamily: 'DM Sans, sans-serif',
                  fontSize: 15, fontWeight: 600, color: '#444444', cursor: 'pointer',
                }}>
                  📦 Unbox another idea
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
