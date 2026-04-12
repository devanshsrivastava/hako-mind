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

const PIPELINE_STEPS = [
  { id: 'search', icon: '🔍', label: 'Web search' },
  { id: 'vc', icon: '💰', label: 'VC agent' },
  { id: 'pm', icon: '🛠', label: 'PM agent' },
  { id: 'growth', icon: '🚀', label: 'Growth agent' },
  { id: 'reality', icon: '🧪', label: 'Reality agent' },
  { id: 'synthesize', icon: '⚡', label: 'Synthesizing' },
];

const TABS = ['MVP', 'Build Stack', 'Launch Plan', 'First Users'];
const TAB_KEYS = ['mvp', 'buildStack', 'launchPlan', 'firstUsers'];

const CRITERIA_META: Record<string, { label: string; icon: string; colorMap: Record<string, string> }> = {
  marketSize:   { label: 'Market size',  icon: '📈', colorMap: { large: '#4ade80', moderate: '#fbbf24', small: '#f87171' } },
  competition:  { label: 'Competition',  icon: '⚔️', colorMap: { low: '#4ade80', moderate: '#fbbf24', high: '#f87171' } },
  buildability: { label: 'Buildability', icon: '🛠', colorMap: { fast: '#4ade80', medium: '#fbbf24', slow: '#f87171' } },
  timing:       { label: 'Timing',       icon: '⏰', colorMap: { excellent: '#4ade80', good: '#fbbf24', early: '#38bdf8', late: '#f87171' } },
  monetization: { label: 'Monetization', icon: '💰', colorMap: { clear: '#4ade80', possible: '#fbbf24', unclear: '#f87171' } },
};

type Step = 'entry' | 'questions' | 'loading' | 'agents' | 'debate' | 'score' | 'exec';
type PipelineStatus = 'idle' | 'active' | 'done' | 'error';

interface PipelineState {
  [key: string]: { status: PipelineStatus; message: string; preview?: string };
}

interface BreakdownItem { key: string; value: string; earned: number; max: number; }

interface WarRoomResult {
  agents: Record<string, string>;
  debate: { agent: string; message: string }[];
  criteria: Record<string, string>;
  criteriaReasons: Record<string, string>;
  improvements: { action: string; points: number }[];
  agentConfidence: Record<string, number>;
  scoreTag: string;
  keyInsight: string;
  score: number;
  breakdown: BreakdownItem[];
  execution: Record<string, string[]>;
  sources?: { title: string; url: string; content: string; type: string }[];
  searchUsed?: boolean;
}

export default function Home() {
  const [step, setStep] = useState<Step>('entry');
  const [idea, setIdea] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [parsed, setParsed] = useState<WarRoomResult | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [visibleDebate, setVisibleDebate] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState>({});
  const [pipelineError, setPipelineError] = useState('');
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
    setPipeline({});
    setPipelineError('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, answers: allAnswers }),
      });

      if (!res.body) throw new Error('No response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.step === 'complete') {
              setParsed(event.result);
              setStep('agents');
              return;
            }

            if (event.step === 'error') {
              setPipelineError(event.message);
              return;
            }

            // Update pipeline state
            setPipeline(prev => ({
              ...prev,
              [event.step]: {
                status: event.status,
                message: event.message,
                preview: event.data?.take
                  ? event.data.take.slice(0, 100) + '...'
                  : undefined,
              },
            }));

          } catch (e) {
            // Skip malformed events
          }
        }
      }
    } catch (e) {
      console.error('Stream error:', e);
      setPipelineError('Connection failed. Please try again.');
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
    if (currentQ < QUESTIONS.length - 1) { setCurrentQ(q => q + 1); }
    else { handleGenerate(newAnswers); }
  }

  function handleSkipQ() {
    const newAnswers = [...answers, ''];
    setAnswers(newAnswers);
    setAnswer('');
    if (currentQ < QUESTIONS.length - 1) { setCurrentQ(q => q + 1); }
    else { handleGenerate(newAnswers); }
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
    if (!parsed) return;
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      setDisplayScore(Math.min(n, parsed.score));
      if (n >= parsed.score) { clearInterval(iv); setTimeout(() => { setStep('exec'); launchConfetti(); }, 700); }
    }, 20);
  }

  async function handleSave() {
    if (saving || saved || !parsed) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('profiles').select('username').eq('username', username).single();
      if (!existing) await supabase.from('profiles').insert({ username });
      const verdict = parsed.scoreTag === 'BUILD_NOW' ? '🟢' : parsed.scoreTag === 'BUILD_WITH_NICHE' ? '🟡' : '🔴';
      await supabase.from('ideas').insert({ username, idea_text: idea, result: JSON.stringify(parsed), is_public: true, verdict, avg_score: parsed.score });
      setSaved(true);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function handleShare() {
    if (!parsed) return;
    navigator.clipboard?.writeText(`Just ran my startup idea through the AI War Room on Hako Mind 🔥\n\nScore: ${parsed.score}/100\n\nTry it free → hakomind.vercel.app`);
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
    setDisplayScore(0);
    setSaved(false);
    setCopied(false);
    setActiveTab(0);
    setExpandedCriteria(null);
    setPipeline({});
    setPipelineError('');
  }

  const scoreTagInfo = parsed?.scoreTag === 'BUILD_NOW'
    ? { label: '🟢 Build Now', bg: 'rgba(74,222,128,.15)', color: '#4ade80' }
    : parsed?.scoreTag === 'BUILD_WITH_NICHE'
      ? { label: '🟡 Build With Niche', bg: 'rgba(251,191,36,.15)', color: '#fbbf24' }
      : { label: '🔴 Drop', bg: 'rgba(239,68,68,.15)', color: '#f87171' };

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
              <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 16, fontWeight: 500, maxWidth: 420, margin: '0 auto' }}>
                They'll research the market, argue your idea, score it, and hand you an execution plan.
              </p>
            </div>
            <div className="war-card">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Your startup idea</div>
              <textarea className="war-textarea" rows={4} value={idea} onChange={e => setIdea(e.target.value)} placeholder="e.g. An AI tool that helps non-technical people build products without coding..." />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 }}>
                {['AI meal planner for busy parents', 'Freelancer payment tracker', 'Newsletter tool for indie hackers'].map(ex => (
                  <span key={ex} onClick={() => setIdea(ex)} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 100, padding: '5px 12px', fontSize: 12, color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 500 }}>{ex}</span>
                ))}
              </div>
              <button className="btn-primary" onClick={handleEnter} disabled={!idea.trim()}>⚡ Enter War Room</button>
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
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>Question {currentQ + 1} of {QUESTIONS.length}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20, lineHeight: 1.4 }}>{QUESTIONS[currentQ].q}</div>
              <input className="war-input" type="text" placeholder={QUESTIONS[currentQ].placeholder} value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNextQ()} autoFocus />
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

        {/* STEP 3 — Loading with live pipeline */}
        {step === 'loading' && (
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px', animation: 'fadeUp .4s ease both' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>⚔️ War Room assembling...</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.4)' }}>Each agent is researching and building on the previous</div>
            </div>

            {pipelineError ? (
              <div style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 15, color: '#f87171', fontWeight: 600, marginBottom: 12 }}>Something went wrong</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 16 }}>{pipelineError}</div>
                <button className="btn-primary" onClick={restart} style={{ maxWidth: 200 }}>Try again</button>
              </div>
            ) : (
              <div className="pipeline-container">
                {PIPELINE_STEPS.map((s, i) => {
                  const state = pipeline[s.id];
                  const status = state?.status || 'idle';
                  const isLast = i === PIPELINE_STEPS.length - 1;

                  return (
                    <div key={s.id} className="pipeline-step">
                      <div className="pipeline-step-left">
                        <div className={`pipeline-icon ${status}`}>
                          {status === 'active' ? (
                            <span style={{ animation: 'pulse 1s infinite' }}>{s.icon}</span>
                          ) : status === 'done' ? (
                            '✓'
                          ) : status === 'error' ? (
                            '✗'
                          ) : (
                            s.icon
                          )}
                        </div>
                        {!isLast && <div className={`pipeline-line ${status === 'done' ? 'done' : ''}`} />}
                      </div>
                      <div className="pipeline-content">
                        <div className={`pipeline-label ${status}`}>{s.label}</div>
                        {state?.message && (
                          <div className={`pipeline-message ${status === 'active' ? 'active' : ''}`}>
                            {status === 'active' && <span className="pipeline-spinner" />}
                            {status === 'done' && <span className="pipeline-check">✓</span>}
                            {state.message}
                          </div>
                        )}
                        {status === 'done' && state?.preview && (
                          <div className="agent-preview">
                            {state.preview}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — Agents */}
        {step === 'agents' && parsed && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff' }}>⚔️ War Room</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{idea.length > 55 ? idea.slice(0, 55) + '...' : idea}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {parsed.searchUsed && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 100, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#4ade80' }}>
                    🔍 Live data
                  </div>
                )}
                <div style={{ background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 100, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>COMPLETE</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {AGENTS.map(agent => (
                <div key={agent.id} className="agent-card" onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                  style={{ background: agent.bg, border: `1px solid ${expandedAgent === agent.id ? agent.color : agent.border}`, gridColumn: expandedAgent === agent.id ? 'span 2' : 'span 1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{agent.icon}</span>
                    {parsed.agentConfidence?.[agent.id] && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: agent.color, background: `${agent.color}18`, borderRadius: 100, padding: '2px 8px' }}>
                        {parsed.agentConfidence[agent.id]}% confident
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', fontWeight: 500, marginBottom: 10 }}>{agent.desc}</div>

                  {expandedAgent === agent.id && (
                    <div style={{ animation: 'fadeUp .3s ease both' }}>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.8)', lineHeight: 1.65, fontWeight: 500, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 12, marginTop: 4 }}>
                        {parsed.agents[agent.id]}
                      </div>

                      {/* Live sources for Reality agent */}
                      {agent.id === 'reality' && parsed.sources && parsed.sources.length > 0 && (
                        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🔍 Live sources</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {parsed.sources.map((s, i) => (
                              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{
                                display: 'block',
                                background: s.type === 'producthunt' ? 'rgba(251,146,60,.08)' : 'rgba(255,255,255,.04)',
                                border: `1px solid ${s.type === 'producthunt' ? 'rgba(251,146,60,.2)' : 'rgba(255,255,255,.08)'}`,
                                borderRadius: 8, padding: '8px 12px', textDecoration: 'none',
                              }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: s.type === 'producthunt' ? '#fb923c' : '#a78bfa', marginBottom: 2 }}>
                                  {s.type === 'producthunt' ? '🚀 ' : ''}{s.title.length > 48 ? s.title.slice(0, 48) + '...' : s.title}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                                  {s.url.replace('https://', '').replace('http://', '').split('/')[0]}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: agent.color, fontWeight: 600, marginTop: expandedAgent === agent.id ? 10 : 0 }}>
                    {expandedAgent === agent.id ? 'Collapse ↑' : 'Tap to read →'}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={startDebate}>⚔️ Watch them debate →</button>
          </div>
        )}

        {/* STEP 5 — Debate */}
        {step === 'debate' && parsed && (
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>⚔️ Agent debate</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>Each agent responds to what the others actually said</div>
            <div ref={debateRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto', paddingBottom: 8 }}>
              {parsed.debate.slice(0, visibleDebate).map((msg, i) => {
                const agent = AGENTS.find(a => a.id === msg.agent) || AGENTS[0];
                return (
                  <div key={i} className="debate-bubble">
                    <div className="debate-avatar" style={{ background: agent.bg, border: `1px solid ${agent.border}` }}>{agent.icon}</div>
                    <div className="debate-text">
                      <div style={{ fontSize: 11, fontWeight: 700, color: agent.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{agent.name}</div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.82)', lineHeight: 1.55, fontWeight: 500 }}>{msg.message}</div>
                    </div>
                  </div>
                );
              })}
              {visibleDebate < (parsed.debate?.length || 0) && (
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
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>
            <div className="war-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>War Room score</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 68, fontWeight: 800, color: '#fff', lineHeight: 1, animation: 'countUp .6s ease both' }}>{displayScore}</div>
                    <div style={{ fontSize: 20, color: 'rgba(255,255,255,.3)', fontWeight: 500 }}>/100</div>
                  </div>
                  <div style={{ display: 'inline-block', marginTop: 10, padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: scoreTagInfo.bg, color: scoreTagInfo.color, border: `1px solid ${scoreTagInfo.color}40` }}>
                    {scoreTagInfo.label}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 14, minWidth: 130 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Breakdown</div>
                  {parsed.breakdown.map(item => {
                    const meta = CRITERIA_META[item.key];
                    const color = meta?.colorMap[item.value] || '#888';
                    return (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>{meta?.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color }}>{item.earned}/{item.max}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {parsed.breakdown.map(item => {
                  const meta = CRITERIA_META[item.key];
                  const color = meta?.colorMap[item.value] || '#888';
                  const isExpanded = expandedCriteria === item.key;
                  return (
                    <div key={item.key} onClick={() => setExpandedCriteria(isExpanded ? null : item.key)}
                      style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all .2s', gridColumn: isExpanded ? 'span 2' : 'span 1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 16 }}>{meta?.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color }}>{item.earned}/{item.max}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>{meta?.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>{item.value.charAt(0).toUpperCase() + item.value.slice(1)}</div>
                      {isExpanded && parsed.criteriaReasons?.[item.key] && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 8, lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 8, animation: 'fadeUp .3s ease both' }}>
                          {parsed.criteriaReasons[item.key]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Agent confidence</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AGENTS.map(agent => {
                    const conf = parsed.agentConfidence?.[agent.id] || 70;
                    return (
                      <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 64, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>{agent.icon} {agent.name}</div>
                        <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${conf}%`, background: agent.color, borderRadius: 3, animation: 'barGrow .9s ease both', ['--target-w' as string]: `${conf}%` }} />
                        </div>
                        <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700, color: agent.color }}>{conf}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {parsed.improvements?.length > 0 && (
                <div style={{ background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', marginBottom: 10 }}>🎯 Improve your score</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {parsed.improvements.map((imp, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.4, flex: 1 }}>{imp.action}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>+{imp.points} pts</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parsed.keyInsight && (
                <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
                  💡 <strong style={{ color: 'rgba(255,255,255,.8)' }}>Key insight:</strong> {parsed.keyInsight}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 7 — Execution */}
        {step === 'exec' && parsed && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px', animation: 'fadeUp .5s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: '#fff' }}>🔥 {parsed.score}</div>
              <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.1)' }} />
              <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 100, fontSize: 13, fontWeight: 700, background: scoreTagInfo.bg, color: scoreTagInfo.color }}>{scoreTagInfo.label}</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {parsed.breakdown.map(item => {
                  const meta = CRITERIA_META[item.key];
                  const color = meta?.colorMap[item.value] || '#888';
                  return <div key={item.key} style={{ fontSize: 11, fontWeight: 600, color }}>{meta?.icon} {item.earned}/{item.max}</div>;
                })}
              </div>
            </div>

            {parsed.improvements?.length > 0 && (
              <div style={{ background: 'rgba(251,146,60,.06)', border: '1px solid rgba(251,146,60,.15)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>
                  🎯 Refine your idea to push your score higher
                </div>
                <button onClick={restart} style={{ background: 'none', border: '1px solid rgba(251,146,60,.3)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: '#fb923c', cursor: 'pointer', flexShrink: 0 }}>Refine →</button>
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
              <div className="tab-bar">
                {TABS.map((tab, i) => (
                  <button key={tab} className={`tab-btn${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>{tab}</button>
                ))}
              </div>
              <div style={{ padding: 20 }}>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(parsed.execution?.[TAB_KEYS[activeTab]] || []).map((item, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', animation: `fadeUp ${.1 + i * .08}s ease both` }}>
                      <span style={{ color: '#a78bfa', fontSize: 16, flexShrink: 0, marginTop: 1 }}>▸</span>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,.82)', fontWeight: 500, lineHeight: 1.6 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleSave} disabled={saving || saved} style={{
                width: '100%', padding: 14,
                background: saved ? '#16a34a' : saving ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
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
                <button onClick={restart} className="btn-secondary" style={{ flex: 1 }}>✏️ New idea</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}