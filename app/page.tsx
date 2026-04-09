'use client';
import { useState, useEffect, useRef } from 'react';
import './war-room.css';
import { supabase } from '../lib/supabase';
import { getOrCreateUsername } from '../lib/username';

const QUESTIONS = [
  { q: 'Who is the primary target user?', placeholder: 'e.g. Freelancers, students, small business owners...' },
  { q: 'How will this product make money?', placeholder: 'e.g. Subscription, one-time fee, marketplace...' },
  { q: 'What core problem are you solving?', placeholder: 'e.g. People waste hours doing X manually...' },
];

const AGENTS = [
  { id: 'vc', icon: '💰', name: 'VC', color: '#a78bfa', bg: 'rgba(139,92,246,.12)', border: 'rgba(139,92,246,.25)', desc: 'Market & funding' },
  { id: 'pm', icon: '🛠', name: 'PM', color: '#38bdf8', bg: 'rgba(56,189,248,.12)', border: 'rgba(56,189,248,.25)', desc: 'Product & roadmap' },
  { id: 'growth', icon: '🚀', name: 'Growth', color: '#4ade80', bg: 'rgba(74,222,128,.12)', border: 'rgba(74,222,128,.25)', desc: 'Acquisition & scale' },
  { id: 'reality', icon: '🧪', name: 'Reality', color: '#fb923c', bg: 'rgba(251,146,60,.12)', border: 'rgba(251,146,60,.25)', desc: 'Risks & competitors' },
];

const TABS = ['MVP', 'Build Stack', 'Launch Plan', 'First Users'];
const TAB_KEYS = ['MVP', 'BUILD_STACK', 'LAUNCH_PLAN', 'FIRST_USERS'];

type Step = 'entry' | 'questions' | 'loading' | 'agents' | 'debate' | 'score' | 'exec';

interface DebateMsg { agent: string; msg: string; }
interface ParsedResult {
  agentViews: Record<string, string>;
  debate: DebateMsg[];
  scores: Record<string, number>;
  scoreTag: string;
  tabs: Record<string, string[]>;
}

function parseResult(raw: string): ParsedResult {
  function extract(key: string): string {
    const start = raw.indexOf(key + '\n');
    if (start === -1) return '';
    const contentStart = start + key.length + 1;
    const nextSection = raw.slice(contentStart).search(/\n[A-Z_]+\n/);
    return nextSection === -1 ? raw.slice(contentStart).trim() : raw.slice(contentStart, contentStart + nextSection).trim();
  }

  function extractBullets(key: string): string[] {
    return extract(key).split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim());
  }

  const debateRaw = extract('DEBATE');
  const debate: DebateMsg[] = debateRaw.split('\n').filter(l => l.includes(':')).map(line => {
    const colonIdx = line.indexOf(':');
    const agent = line.slice(0, colonIdx).replace(/[\[\]]/g, '').trim().toLowerCase();
    const msg = line.slice(colonIdx + 1).trim();
    const mapped = agent === 'growth' ? 'growth' : agent === 'reality' ? 'reality' : agent === 'pm' ? 'pm' : 'vc';
    return { agent: mapped, msg };
  }).filter(d => d.msg.length > 0).slice(0, 6);

  const scoreTag = extract('SCORE_TAG').trim();

  return {
    agentViews: {
      vc: extract('VC_TAKE'),
      pm: extract('PM_TAKE'),
      growth: extract('GROWTH_TAKE'),
      reality: extract('REALITY_TAKE'),
    },
    debate,
    scores: {
      vc: parseInt(extract('VC_SCORE')) || 17,
      pm: parseInt(extract('PM_SCORE')) || 17,
      growth: parseInt(extract('GROWTH_SCORE')) || 17,
      reality: parseInt(extract('REALITY_SCORE')) || 17,
    },
    scoreTag,
    tabs: {
      MVP: extractBullets('MVP'),
      BUILD_STACK: extractBullets('BUILD_STACK'),
      LAUNCH_PLAN: extractBullets('LAUNCH_PLAN'),
      FIRST_USERS: extractBullets('FIRST_USERS'),
    },
  };
}

export default function Home() {
  const [step, setStep] = useState<Step>('entry');
  const [idea, setIdea] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [rawResult, setRawResult] = useState('');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [visibleDebate, setVisibleDebate] = useState(0);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const debateRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setUsername(getOrCreateUsername()); }, []);

  function launchConfetti() {
    const colors = ['#a78bfa', '#38bdf8', '#4ade80', '#fb923c', '#f472b6'];
    for (let i = 0; i < 50; i++) {
      const el = document.createElement('div');
      const size = 6 + Math.random() * 6;
      el.style.cssText = `position:fixed;top:-10px;z-index:999;pointer-events:none;left:${Math.random() * 100}vw;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};animation:confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * 0.5}s linear forwards`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }
  }

  async function handleGenerate(allAnswers: string[]) {
    setStep('loading');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, answers: allAnswers }),
      });
      const data = await res.json();
      const raw = data.result || '';
      setRawResult(raw);
      const p = parseResult(raw);
      setParsed(p);
      setStep('agents');
    } catch (e) {
      setStep('entry');
    }
  }

  function handleEnter() {
    if (!idea.trim()) return;
    setCurrentQ(0);
    setAnswers([]);
    setAnswer('');
    setStep('questions');
  }

  function handleNextQ() {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    setAnswer('');
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(q => q + 1);
    } else {
      handleGenerate(newAnswers);
    }
  }

  function handleSkipQ() {
    const newAnswers = [...answers, ''];
    setAnswers(newAnswers);
    setAnswer('');
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(q => q + 1);
    } else {
      handleGenerate(newAnswers);
    }
  }

  function startDebate() {
    setStep('debate');
    setVisibleDebate(0);
    if (!parsed) return;
    parsed.debate.forEach((_, i) => {
      setTimeout(() => {
        setVisibleDebate(v => v + 1);
        if (debateRef.current) debateRef.current.scrollTop = debateRef.current.scrollHeight;
        if (i === parsed.debate.length - 1) setTimeout(showScore, 800);
      }, i * 950);
    });
  }

  function showScore() {
    setStep('score');
    setScoreVisible(true);
    if (!parsed) return;
    const total = Math.round(Object.values(parsed.scores).reduce((s, v) => s + v, 0));
    let n = 0;
    const iv = setInterval(() => {
      n += 2;
      setDisplayScore(Math.min(n, total));
      if (n >= total) { clearInterval(iv); setTimeout(() => { setStep('exec'); launchConfetti(); }, 600); }
    }, 25);
  }

  async function handleSave() {
    if (saving || saved || !parsed) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('profiles').select('username').eq('username', username).single();
      if (!existing) await supabase.from('profiles').insert({ username });
      const total = Math.round(Object.values(parsed.scores).reduce((s, v) => s + v, 0));
      const verdict = parsed.scoreTag === 'BUILD_NOW' ? '🟢' : parsed.scoreTag === 'BUILD_WITH_NICHE' ? '🟡' : '🔴';
      await supabase.from('ideas').insert({ username, idea_text: idea, result: rawResult, is_public: true, verdict, avg_score: total });
      setSaved(true);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function handleShare() {
    if (!parsed) return;
    const total = Math.round(Object.values(parsed.scores).reduce((s, v) => s + v, 0));
    navigator.clipboard?.writeText(`Just ran my startup idea through the AI War Room on Hako Mind 🔥\n\nScore: ${total}/100\n\nTry it free → hakomind.vercel.app`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function restart() {
    setStep('entry');
    setIdea('');
    setAnswers([]);
    setAnswer('');
    setParsed(null);
    setExpandedAgent(null);
    setVisibleDebate(0);
    setScoreVisible(false);
    setDisplayScore(0);
    setSaved(false);
    setCopied(false);
    setActiveTab(0);
  }

  const totalScore = parsed ? Math.round(Object.values(parsed.scores).reduce((s, v) => s + v, 0)) : 0;
  const scoreTagInfo = parsed?.scoreTag === 'BUILD_NOW'
    ? { label: '🟢 Build Now', bg: 'rgba(74,222,128,.15)', color: '#4ade80' }
    : parsed?.scoreTag === 'BUILD_WITH_NICHE'
      ? { label: '🟡 Build With Niche', bg: 'rgba(251,191,36,.15)', color: '#fbbf24' }
      : { label: '🔴 Drop', bg: 'rgba(239,68,68,.15)', color: '#f87171' };

  const stepIndex = ['entry', 'questions', 'loading', 'agents', 'debate', 'score', 'exec'].indexOf(step);

  return (
    <div style={{ background: '#0d0d14', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>

      {/* Background blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {[
          { bg: '#7c3aed', top: '-150px', left: '-150px', size: 500 },
          { bg: '#0ea5e9', top: '30%', right: '-100px', size: 400 },
          { bg: '#4ade80', bottom: '10%', left: '10%', size: 350 },
        ].map((b, i) => (
          <div key={i} className="blob" style={{ width: b.size, height: b.size, background: b.bg, top: b.top, left: b.left, right: b.right, bottom: b.bottom }} />
        ))}
      </div>

      {/* Nav */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, cursor: 'pointer' }} onClick={restart}>
          <span style={{ background: 'linear-gradient(135deg,#ff6b6b,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hako</span>
          {' '}
          <span style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mind</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {username && (
            <a href={`/profile/${username}`} style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', textDecoration: 'none', background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.2)', borderRadius: 100, padding: '5px 12px' }}>
              👤 {username}
            </a>
          )}
          <a href="/explore" style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', textDecoration: 'none' }}>🌍 Explore</a>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* STEP 1 — Entry */}
        {step === 'entry' && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px', animation: 'fadeUp .5s ease both' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.3)', borderRadius: 100, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#a78bfa', marginBottom: 20 }}>
                <span style={{ width: 6, height: 6, background: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                AI STARTUP WAR ROOM
              </div>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(32px,6vw,52px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 16, color: '#fff' }}>
                Pitch your idea to<br />
                <span style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>4 brutal AI experts</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 16, fontWeight: 500, maxWidth: 400, margin: '0 auto' }}>
                They'll argue, score, and hand you an execution plan. In minutes.
              </p>
            </div>
            <div className="war-card">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Your startup idea</div>
              <textarea
                className="war-textarea"
                rows={4}
                value={idea}
                onChange={e => setIdea(e.target.value)}
                placeholder="e.g. An AI tool that helps non-technical people build products without coding..."
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 }}>
                {['AI meal planner', 'Freelancer payment tracker', 'Newsletter for founders'].map(ex => (
                  <span key={ex} onClick={() => setIdea(ex)} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 100, padding: '5px 12px', fontSize: 12, color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 500 }}>{ex}</span>
                ))}
              </div>
              <button className="btn-primary" onClick={handleEnter} disabled={!idea.trim()}>
                ⚡ Enter War Room
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Questions */}
        {step === 'questions' && (
          <div style={{ maxWidth: 540, margin: '0 auto', padding: '48px 24px', animation: 'fadeUp .5s ease both' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🧠</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Quick clarification</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Helps the agents give sharper analysis</div>
            </div>
            <div className="war-card" style={{ animation: 'fadeUp .4s ease both' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>
                Question {currentQ + 1} of {QUESTIONS.length}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20, lineHeight: 1.4 }}>
                {QUESTIONS[currentQ].q}
              </div>
              <input
                className="war-input"
                type="text"
                placeholder={QUESTIONS[currentQ].placeholder}
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNextQ()}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn-secondary" onClick={handleSkipQ} style={{ flex: 0.5 }}>Skip</button>
                <button className="btn-primary" onClick={handleNextQ} style={{ flex: 1, fontSize: 15 }}>
                  {currentQ < QUESTIONS.length - 1 ? 'Next →' : '⚡ Launch War Room'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
                {QUESTIONS.map((_, i) => (
                  <div key={i} style={{ height: 4, borderRadius: 2, background: i === currentQ ? '#a78bfa' : i < currentQ ? 'rgba(167,139,250,.4)' : 'rgba(255,255,255,.15)', width: i === currentQ ? 24 : 6, transition: 'all .3s' }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Loading */}
        {step === 'loading' && (
          <div style={{ maxWidth: 540, margin: '0 auto', padding: '100px 24px', textAlign: 'center', animation: 'fadeUp .4s ease both' }}>
            <div style={{ fontSize: 36, marginBottom: 24 }}>⚔️</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Briefing the agents...</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', marginBottom: 32 }}>4 experts are reviewing your idea</div>
            <div className="loading-dots">
              {['#a78bfa', '#38bdf8', '#4ade80', '#fb923c'].map((color, i) => (
                <div key={i} className="loading-dot" style={{ background: color, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 — Agents */}
        {step === 'agents' && parsed && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff' }}>⚔️ War Room</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{idea.length > 55 ? idea.slice(0, 55) + '...' : idea}</div>
              </div>
              <div style={{ background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 100, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>LIVE</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {AGENTS.map(agent => (
                <div key={agent.id} className="agent-card" onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                  style={{ background: agent.bg, border: `1px solid ${expandedAgent === agent.id ? agent.color : agent.border}`, gridColumn: expandedAgent === agent.id ? 'span 2' : 'span 1' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{agent.icon}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', fontWeight: 500, marginBottom: expandedAgent === agent.id ? 14 : 10 }}>{agent.desc}</div>
                  {expandedAgent === agent.id && (
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,.8)', lineHeight: 1.65, fontWeight: 500, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 12, marginTop: 4, animation: 'fadeUp .3s ease both' }}>
                      {parsed.agentViews[agent.id]}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: agent.color, fontWeight: 600, marginTop: expandedAgent === agent.id ? 8 : 0 }}>
                    {expandedAgent === agent.id ? 'Collapse ↑' : 'Tap to read →'}
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={startDebate}>
              ⚔️ Watch them debate →
            </button>
          </div>
        )}

        {/* STEP 5 — Debate */}
        {step === 'debate' && parsed && (
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>⚔️ Agent debate</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>Watch the experts argue your idea out</div>
            <div ref={debateRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto', paddingBottom: 8 }}>
              {parsed.debate.slice(0, visibleDebate).map((msg, i) => {
                const agent = AGENTS.find(a => a.id === msg.agent) || AGENTS[0];
                return (
                  <div key={i} className="debate-bubble">
                    <div className="debate-avatar" style={{ background: agent.bg, border: `1px solid ${agent.border}` }}>{agent.icon}</div>
                    <div className="debate-text">
                      <div style={{ fontSize: 11, fontWeight: 700, color: agent.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{agent.name}</div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.82)', lineHeight: 1.55, fontWeight: 500 }}>{msg.msg}</div>
                    </div>
                  </div>
                );
              })}
              {visibleDebate < parsed.debate.length && (
                <div style={{ display: 'flex', gap: 6, paddingLeft: 40 }}>
                  {['#a78bfa', '#38bdf8', '#4ade80'].map((c, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c, animation: `bounce 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 6 — Score */}
        {step === 'score' && parsed && (
          <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>
            <div className="war-card" style={{ marginBottom: 16 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Idea score</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 72, fontWeight: 800, color: '#fff', lineHeight: 1, animation: 'countUp .6s ease both' }}>
                  🔥 {displayScore}
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,.4)', fontWeight: 500, marginBottom: 12 }}>/100</div>
                <div style={{ display: 'inline-block', padding: '6px 18px', borderRadius: 100, fontSize: 14, fontWeight: 700, background: scoreTagInfo.bg, color: scoreTagInfo.color }}>
                  {scoreTagInfo.label}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {AGENTS.map(agent => (
                  <div key={agent.id} className="score-bar-row">
                    <div style={{ width: 68, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.55)' }}>{agent.icon} {agent.name}</div>
                    <div className="score-bar-track">
                      <div className="score-bar-fill" style={{ width: `${(parsed.scores[agent.id] / 25) * 100}%`, background: agent.color, '--target-w': `${(parsed.scores[agent.id] / 25) * 100}%` } as React.CSSProperties} />
                    </div>
                    <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#fff' }}>{parsed.scores[agent.id]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 7 — Execution */}
        {step === 'exec' && parsed && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>

            {/* Compact score strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: '#fff' }}>🔥 {totalScore}</div>
              <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.1)' }} />
              <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 100, fontSize: 13, fontWeight: 700, background: scoreTagInfo.bg, color: scoreTagInfo.color }}>{scoreTagInfo.label}</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {AGENTS.map(a => (
                  <div key={a.id} title={a.name} style={{ fontSize: 14 }}>{a.icon} <span style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{parsed.scores[a.id]}</span></div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
              <div className="tab-bar">
                {TABS.map((tab, i) => (
                  <button key={tab} className={`tab-btn${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>
                    {tab}
                  </button>
                ))}
              </div>
              <div style={{ padding: 20 }}>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(parsed.tabs[TAB_KEYS[activeTab]] || []).map((item, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', animation: `fadeUp ${.1 + i * .08}s ease both` }}>
                      <span style={{ color: '#a78bfa', fontSize: 16, flexShrink: 0, marginTop: 1 }}>▸</span>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,.82)', fontWeight: 500, lineHeight: 1.6 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleSave} disabled={saving || saved} style={{
                width: '100%', padding: 14, background: saved ? '#16a34a' : saving ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
                border: 'none', borderRadius: 12, fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700,
                color: saving ? 'rgba(255,255,255,.4)' : '#fff', cursor: saved || saving ? 'not-allowed' : 'pointer', transition: 'all .3s',
              }}>
                {saved ? `✅ Saved → /profile/${username}` : saving ? 'Saving...' : '💾 Save to my profile'}
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleShare} style={{
                  flex: 1, padding: 13, background: copied ? '#16a34a' : 'linear-gradient(135deg,#7c3aed,#0ea5e9)',
                  border: 'none', borderRadius: 12, fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', transition: 'all .3s',
                }}>
                  {copied ? '✅ Copied!' : '📤 Share on X'}
                </button>
                <button onClick={restart} className="btn-secondary" style={{ flex: 1 }}>
                  ✏️ New idea
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
