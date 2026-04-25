'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getOrCreateUsername } from '../lib/username';

const QUESTIONS = [
  { q: 'Who is the primary target user?', placeholder: 'e.g. Freelancers, busy parents, students...' },
  { q: 'How will this make money?', placeholder: 'e.g. Subscription, one-time fee, marketplace...' },
  { q: 'What core problem are you solving?', placeholder: 'e.g. People waste hours doing X manually...' },
];

const AGENTS = [
  { id: 'vc',     icon: '💰', name: 'VC',     desc: 'Market & funding' },
  { id: 'pm',     icon: '🛠', name: 'PM',     desc: 'Product & roadmap' },
  { id: 'growth', icon: '🚀', name: 'Growth', desc: 'Users & scale' },
  { id: 'reality',icon: '🧪', name: 'Reality',desc: 'Risks & competitors' },
];

const PIPELINE_STEPS = [
  { id: 'search',    icon: '🔍', label: 'Web search' },
  { id: 'vc',        icon: '💰', label: 'VC agent' },
  { id: 'pm',        icon: '🛠', label: 'PM agent' },
  { id: 'growth',    icon: '🚀', label: 'Growth agent' },
  { id: 'reality',   icon: '🧪', label: 'Reality agent' },
  { id: 'synthesize',icon: '⚡', label: 'Synthesizing' },
];

const TABS = ['MVP', 'Stack', 'Launch', 'Users'];
const TAB_KEYS = ['mvp', 'buildStack', 'launchPlan', 'firstUsers'];

const CRITERIA_META: Record<string, { label: string; icon: string }> = {
  marketSize:   { label: 'Market',      icon: '📈' },
  competition:  { label: 'Competition', icon: '⚔️' },
  buildability: { label: 'Build speed', icon: '🛠' },
  timing:       { label: 'Timing',      icon: '⏰' },
  monetization: { label: 'Monetize',    icon: '💰' },
};

const GRADIENTS = {
  entry:    'linear-gradient(160deg,#667eea 0%,#764ba2 50%,#f093fb 100%)',
  pipeline: 'linear-gradient(160deg,#f093fb 0%,#667eea 50%,#4facfe 100%)',
  agents:   'linear-gradient(160deg,#4facfe 0%,#00f2fe 35%,#43e97b 70%,#38f9d7 100%)',
  debate:   'linear-gradient(160deg,#43e97b 0%,#38f9d7 40%,#4facfe 100%)',
  score:    'linear-gradient(160deg,#f7971e 0%,#ffd200 40%,#f093fb 80%,#667eea 100%)',
  exec:     'linear-gradient(160deg,#a18cd1 0%,#fbc2eb 50%,#f093fb 100%)',
};

type Step = 'entry' | 'questions' | 'loading' | 'agents' | 'debate' | 'score' | 'exec';
type PipelineStatus = 'idle' | 'active' | 'done' | 'error';
interface PipelineState { [key: string]: { status: PipelineStatus; message: string; preview?: string } }
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
  sources?: { title: string; url: string; type: string }[];
  searchUsed?: boolean;
}
interface RefinedIdea { refinedIdea: string; changes: string[]; }

// Shared glass card style
const glass = {
  background: 'rgba(255,255,255,.85)',
  border: '1px solid rgba(0,0,0,.1)',
  borderRadius: 14,
  padding: '12px 14px',
} as React.CSSProperties;

const glassBtn = {
  background: 'rgba(255,255,255,.22)',
  border: '1px solid rgba(255,255,255,.35)',
  borderRadius: 12,
  padding: '11px',
  textAlign: 'center' as const,
  fontFamily: 'Syne, sans-serif',
  fontSize: 14,
  fontWeight: 800,
  color: '#1a1a2e',
  cursor: 'pointer',
  width: '100%',
} as React.CSSProperties;

const glassBtnSm = {
  ...glassBtn,
  fontSize: 12,
  padding: '9px',
  fontFamily: 'DM Sans, sans-serif',
  fontWeight: 600,
} as React.CSSProperties;

export default function MobileWarRoom() {
  const [step, setStep] = useState<Step>('entry');
  const [idea, setIdea] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [parsed, setParsed] = useState<WarRoomResult | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [visibleDebate, setVisibleDebate] = useState(0);
  const [debateComplete, setDebateComplete] = useState(false);
  const [scoreRevealed, setScoreRevealed] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [pipeline, setPipeline] = useState<PipelineState>({});
  const [pipelineError, setPipelineError] = useState('');
  const [refined, setRefined] = useState<RefinedIdea | null>(null);
  const [refining, setRefining] = useState(false);
  const [showRefined, setShowRefined] = useState(false);
  const debateRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setUsername(getOrCreateUsername()); }, []);

  function scrollTop() { topRef.current?.scrollIntoView({ behavior: 'smooth' }); }

  function launchConfetti() {
    const colors = ['#fff', '#ffd200', '#f093fb', '#4facfe', '#43e97b', '#f7971e'];
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('div');
      const size = 5 + Math.random() * 5;
      el.style.cssText = `position:fixed;top:-10px;z-index:9999;pointer-events:none;left:${Math.random()*100}vw;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation:confettiFall ${1.5+Math.random()*2}s ${Math.random()*.5}s linear forwards`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }
  }

  async function handleGenerate(allAnswers: string[], ideaOverride?: string) {
    setStep('loading');
    setPipeline({});
    setPipelineError('');
    setDebateComplete(false);
    setScoreRevealed(false);
    setDisplayScore(0);
    scrollTop();
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: ideaOverride || idea, answers: allAnswers }),
      });
      if (!res.body) throw new Error('No stream');
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
            if (event.step === 'complete') { setParsed(event.result); setStep('agents'); scrollTop(); return; }
            if (event.step === 'error') { setPipelineError(event.message); return; }
            setPipeline(prev => ({ ...prev, [event.step]: { status: event.status, message: event.message, preview: event.data?.take?.slice(0, 80) } }));
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setPipelineError('Connection failed. Please try again.');
    }
  }

  function handleEnter() {
    if (!idea.trim()) return;
    setCurrentQ(0); setAnswers([]); setAnswer('');
    setRefined(null); setShowRefined(false);
    setStep('questions'); scrollTop();
  }

  function handleNextQ() {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers); setAnswer('');
    if (currentQ < QUESTIONS.length - 1) { setCurrentQ(q => q + 1); }
    else { handleGenerate(newAnswers); }
  }

  function handleSkipQ() {
    const newAnswers = [...answers, ''];
    setAnswers(newAnswers); setAnswer('');
    if (currentQ < QUESTIONS.length - 1) { setCurrentQ(q => q + 1); }
    else { handleGenerate(newAnswers); }
  }

  function startDebate() {
    setStep('debate'); setVisibleDebate(0); setDebateComplete(false); scrollTop();
    if (!parsed) return;
    parsed.debate.forEach((_, i) => {
      setTimeout(() => {
        setVisibleDebate(v => v + 1);
        if (debateRef.current) debateRef.current.scrollTop = debateRef.current.scrollHeight;
        if (i === parsed.debate.length - 1) setDebateComplete(true);
      }, i * 900);
    });
  }

  function showScore() {
    setStep('score'); setScoreRevealed(false); scrollTop();
    if (!parsed) return;
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setDisplayScore(Math.min(n, parsed.score));
      if (n >= parsed.score) { clearInterval(iv); setScoreRevealed(true); launchConfetti(); }
    }, 18);
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
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  function handleShare() {
    if (!parsed) return;
    navigator.clipboard?.writeText(`Just ran my startup idea through the AI War Room on Hako Mind 🔥\n\nScore: ${parsed.score}/100\n\nTry it free → hakomind.in`);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  async function handleRefine() {
    if (!parsed?.improvements || refining) return;
    setRefining(true);
    try {
      const res = await fetch('/api/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea, improvements: parsed.improvements }) });
      const data = await res.json();
      if (data.result) { setRefined(data.result); setShowRefined(true); }
    } catch (e) { console.error(e); } finally { setRefining(false); }
  }

  function runRefinedIdea() {
    if (!refined) return;
    setIdea(refined.refinedIdea); setShowRefined(false); setRefined(null);
    setParsed(null); setSaved(false); setCopied(false);
    handleGenerate(answers, refined.refinedIdea);
  }

  function restart() {
    setStep('entry'); setIdea(''); setAnswers([]); setAnswer('');
    setParsed(null); setExpandedAgent(null); setVisibleDebate(0);
    setDebateComplete(false); setScoreRevealed(false); setDisplayScore(0);
    setSaved(false); setCopied(false); setActiveTab(0);
    setPipeline({}); setPipelineError('');
    setRefined(null); setShowRefined(false); setRefining(false);
    scrollTop();
  }

  const scoreTagLabel = parsed?.scoreTag === 'BUILD_NOW' ? '🟢 Build Now' : parsed?.scoreTag === 'BUILD_WITH_NICHE' ? '🟡 Build With Niche' : '🔴 Drop';

  const gradientBg = step === 'entry' || step === 'questions' ? GRADIENTS.entry
    : step === 'loading' ? GRADIENTS.pipeline
    : step === 'agents' ? GRADIENTS.agents
    : step === 'debate' ? GRADIENTS.debate
    : step === 'score' ? GRADIENTS.score
    : GRADIENTS.exec;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{0%,80%,100%{transform:scale(.8);opacity:.5}40%{transform:scale(1.2);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes lineGrow{from{height:0}to{height:100%}}
        @keyframes countUp{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
        *{-webkit-tap-highlight-color:transparent}
      `}</style>

      <div ref={topRef} style={{ background: gradientBg, minHeight: '100vh', transition: 'background 0.6s ease', fontFamily: 'DM Sans, sans-serif' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,.3)' }}>
          <span onClick={restart} style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#1a1a2e', cursor: 'pointer' }}>
            Hako <span style={{ opacity: .65 }}>Mind</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {username && (
              <a href={`/profile/${username}`} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 20, padding: '4px 10px', fontSize: 10, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}>
                👤 Profile
              </a>
            )}
            <a href="/explore" style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 20, padding: '4px 10px', fontSize: 10, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}>
              🌍 Explore
            </a>
          </div>
        </div>

        <div style={{ padding: '0 14px 40px' }}>

          {/* ENTRY */}
          {step === 'entry' && (
            <div style={{ animation: 'fadeUp .5s ease both' }}>
              <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 20, padding: '4px 12px', fontSize: 10, fontWeight: 600, color: '#1a1a2e', marginBottom: 14 }}>
                  <span style={{ width: 5, height: 5, background: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  AI STARTUP WAR ROOM
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.15, marginBottom: 10, letterSpacing: -.5 }}>
                  Pitch your idea to<br />4 brutal AI experts
                </div>
                <div style={{ fontSize: 12, color: 'rgba(26,26,46,.75)', lineHeight: 1.55 }}>
                  They research, argue, score and<br />hand you an execution plan
                </div>
              </div>

              <div style={{ ...glass, marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(26,26,46,.6)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Your startup idea</div>
                <textarea
                  value={idea}
                  onChange={e => setIdea(e.target.value)}
                  placeholder="e.g. An AI tool that helps non-technical people build products without coding..."
                  rows={4}
                  style={{ width: '100%', background: 'rgba(255,255,255,.9)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1a1a2e', resize: 'none', outline: 'none', lineHeight: 1.55, fontFamily: 'DM Sans, sans-serif' }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 12px' }}>
                  {['AI meal planner for busy parents', 'Freelancer payment tracker', 'Newsletter for indie hackers'].map(ex => (
                    <span key={ex} onClick={() => setIdea(ex)} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 20, padding: '4px 10px', fontSize: 10, color: '#1a1a2e', fontWeight: 500, cursor: 'pointer' }}>{ex}</span>
                  ))}
                </div>
                <button onClick={handleEnter} disabled={!idea.trim()} style={{ ...glassBtn, opacity: idea.trim() ? 1 : 0.5 }}>⚡ Enter War Room</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
                {[['4', 'AI agents'], ['Free', 'always'], ['2 min', 'to results']].map(([v, l], i, arr) => (
                  <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{v}</div>
                      <div style={{ fontSize: 9, color: 'rgba(26,26,46,.6)', fontWeight: 500 }}>{l}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.2)' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUESTIONS */}
          {step === 'questions' && (
            <div style={{ paddingTop: 24, animation: 'fadeUp .4s ease both' }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>Quick clarification</div>
                <div style={{ fontSize: 11, color: 'rgba(26,26,46,.65)' }}>Helps agents give sharper analysis</div>
              </div>
              <div style={glass}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(26,26,46,.5)', marginBottom: 8 }}>Question {currentQ + 1} of {QUESTIONS.length}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 16, lineHeight: 1.4 }}>{QUESTIONS[currentQ].q}</div>
                <input
                  type="text"
                  placeholder={QUESTIONS[currentQ].placeholder}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNextQ()}
                  autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,.9)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1a1a2e', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSkipQ} style={{ ...glassBtnSm, flex: 0.6 }}>Skip</button>
                  <button onClick={handleNextQ} style={{ ...glassBtn, flex: 1, fontSize: 13 }}>
                    {currentQ < QUESTIONS.length - 1 ? 'Next →' : '⚡ Launch War Room'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 14 }}>
                  {QUESTIONS.map((_, i) => (
                    <div key={i} style={{ height: 3, borderRadius: 2, background: i <= currentQ ? '#fff' : 'rgba(255,255,255,.25)', width: i === currentQ ? 20 : 6, transition: 'all .3s' }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LOADING PIPELINE */}
          {step === 'loading' && (
            <div style={{ paddingTop: 24, animation: 'fadeUp .4s ease both' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>⚔️ Assembling War Room...</div>
                <div style={{ fontSize: 11, color: 'rgba(26,26,46,.65)' }}>Each agent builds on the previous</div>
              </div>

              {pipelineError ? (
                <div style={{ ...glass, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
                  <div style={{ fontSize: 12, color: 'rgba(26,26,46,.6)', marginBottom: 14 }}>{pipelineError}</div>
                  <button onClick={restart} style={glassBtn}>Try again</button>
                </div>
              ) : (
                <div style={glass}>
                  {PIPELINE_STEPS.map((s, i, arr) => {
                    const state = pipeline[s.id];
                    const status = state?.status || 'idle';
                    const isLast = i === arr.length - 1;
                    return (
                      <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: status === 'done' ? 'rgba(74,222,128,.3)' : status === 'active' ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)', border: `1.5px solid ${status === 'done' ? 'rgba(74,222,128,.6)' : status === 'active' ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.2)'}` }}>
                            {status === 'done' ? '✓' : status === 'active' ? <span style={{ animation: 'pulse 1s infinite' }}>{s.icon}</span> : s.icon}
                          </div>
                          {!isLast && <div style={{ width: 1.5, minHeight: 14, background: status === 'done' ? 'rgba(74,222,128,.5)' : 'rgba(255,255,255,.15)', margin: '2px 0' }} />}
                        </div>
                        <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 14, flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: status === 'idle' ? 'rgba(26,26,46,.35)' : '#1a1a2e', marginBottom: state?.message ? 2 : 0 }}>{s.label}</div>
                          {state?.message && (
                            <div style={{ fontSize: 10, color: 'rgba(26,26,46,.6)', lineHeight: 1.4 }}>
                              {status === 'active' && <span style={{ display: 'inline-block', width: 8, height: 8, border: '1.5px solid rgba(255,255,255,.3)', borderTopColor: '#1a1a2e', borderRadius: '50%', animation: 'spin .8s linear infinite', marginRight: 4, verticalAlign: 'middle' }} />}
                              {state.message}
                            </div>
                          )}
                          {status === 'done' && state?.preview && (
                            <div style={{ fontSize: 10, color: 'rgba(26,26,46,.5)', lineHeight: 1.4, marginTop: 2, fontStyle: 'italic' }}>{state.preview}...</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* AGENTS */}
          {step === 'agents' && parsed && (
            <div style={{ paddingTop: 16, animation: 'fadeUp .5s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>⚔️ War Room</div>
                  <div style={{ fontSize: 10, color: 'rgba(26,26,46,.65)', marginTop: 1 }}>{idea.length > 42 ? idea.slice(0, 42) + '...' : idea}</div>
                </div>
                {parsed.searchUsed && (
                  <div style={{ background: 'rgba(74,222,128,.2)', border: '1px solid rgba(74,222,128,.4)', borderRadius: 20, padding: '3px 8px', fontSize: 9, fontWeight: 600, color: '#4ade80' }}>🔍 Live data</div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {AGENTS.map(agent => (
                  <div key={agent.id} onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                    style={{ ...glass, cursor: 'pointer', gridColumn: expandedAgent === agent.id ? 'span 2' : 'span 1', transition: 'all .2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{agent.icon}</span>
                      {parsed.agentConfidence?.[agent.id] && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#1a1a2e', background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '1px 5px' }}>{parsed.agentConfidence[agent.id]}%</span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 800, color: '#1a1a2e', marginBottom: 2 }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(26,26,46,.6)', marginBottom: expandedAgent === agent.id ? 10 : 0 }}>{agent.desc}</div>
                    {expandedAgent === agent.id && (
                      <div style={{ animation: 'fadeUp .3s ease both' }}>
                        <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.55, borderTop: '1px solid rgba(255,255,255,.2)', paddingTop: 10, marginTop: 2 }}>
                          {parsed.agents[agent.id]}
                        </div>
                        {agent.id === 'reality' && parsed.sources && parsed.sources.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(26,26,46,.5)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>🔍 Live sources</div>
                            {parsed.sources.slice(0, 3).map((s, i) => (
                              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '6px 10px', marginBottom: 5, textDecoration: 'none' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e', marginBottom: 1 }}>{s.title.slice(0, 36)}...</div>
                                <div style={{ fontSize: 10, color: 'rgba(26,26,46,.5)' }}>{s.url.replace('https://', '').split('/')[0]}</div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'rgba(26,26,46,.7)', fontWeight: 600, marginTop: expandedAgent === agent.id ? 8 : 0 }}>
                      {expandedAgent === agent.id ? 'Collapse ↑' : 'Tap to read →'}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={startDebate} style={glassBtn}>⚔️ Watch them debate →</button>
            </div>
          )}

          {/* DEBATE */}
          {step === 'debate' && parsed && (
            <div style={{ paddingTop: 16, animation: 'fadeUp .5s ease both' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>⚔️ Agent debate</div>
              <div style={{ fontSize: 10, color: 'rgba(26,26,46,.65)', marginBottom: 14 }}>Each agent responds to what the others said</div>

              <div ref={debateRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', marginBottom: 14 }}>
                {parsed.debate.slice(0, visibleDebate).map((msg, i) => {
                  const agent = AGENTS.find(a => a.id === msg.agent) || AGENTS[0];
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, animation: 'fadeUp .3s ease both' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{agent.icon}</div>
                      <div style={{ background: 'rgba(255,255,255,.85)', border: '1px solid rgba(0,0,0,.1)', borderRadius: 12, borderTopLeftRadius: 3, padding: '8px 10px', flex: 1 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(26,26,46,.7)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>{agent.name}</div>
                        <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>{msg.message}</div>
                      </div>
                    </div>
                  );
                })}
                {!debateComplete && (
                  <div style={{ display: 'flex', gap: 5, paddingLeft: 34 }}>
                    {['#fff', 'rgba(255,255,255,.6)', 'rgba(255,255,255,.3)'].map((c, i) => (
                      <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: c, animation: `bounce 1s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                )}
              </div>

              {debateComplete && (
                <div style={{ animation: 'fadeUp .4s ease both' }}>
                  <div style={{ ...glass, marginBottom: 10, fontSize: 12, color: 'rgba(26,26,46,.8)' }}>
                    💬 The agents have weighed in. Ready to see your score?
                  </div>
                  <button onClick={showScore} style={glassBtn}>📊 See my score →</button>
                </div>
              )}
            </div>
          )}

          {/* SCORE */}
          {step === 'score' && parsed && (
            <div style={{ paddingTop: 16, animation: 'fadeUp .5s ease both' }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(26,26,46,.7)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>War Room score</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 72, fontWeight: 800, color: '#1a1a2e', lineHeight: 1, animation: 'countUp .6s ease both' }}>{displayScore}</div>
                <div style={{ fontSize: 14, color: 'rgba(26,26,46,.6)', marginBottom: 10 }}>/100</div>
                <div style={{ display: 'inline-block', background: 'rgba(255,255,255,.25)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>
                  {scoreTagLabel}
                </div>
              </div>

              {/* Criteria grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
                {parsed.breakdown.map(item => {
                  const meta = CRITERIA_META[item.key];
                  return (
                    <div key={item.key} style={{ ...glass, padding: '9px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12 }}>{meta?.icon}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#1a1a2e', opacity: .8 }}>{item.earned}/{item.max}</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(26,26,46,.55)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 1 }}>{meta?.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{item.value.charAt(0).toUpperCase() + item.value.slice(1)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Key insight */}
              {parsed.keyInsight && (
                <div style={{ ...glass, marginBottom: 10, fontSize: 12, color: '#1a1a2e', lineHeight: 1.55 }}>
                  💡 <strong>Key insight:</strong> {parsed.keyInsight}
                </div>
              )}

              {/* Improvements */}
              {parsed.improvements?.length > 0 && (
                <div style={{ ...glass, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🎯 Improve your score</div>
                  {parsed.improvements.map((imp, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'rgba(26,26,46,.85)', lineHeight: 1.4, flex: 1 }}>{imp.action}</div>
                      <div style={{ background: 'rgba(255,255,255,.25)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>+{imp.points}pts</div>
                    </div>
                  ))}
                </div>
              )}

              {scoreRevealed && (
                <div style={{ animation: 'fadeUp .4s ease both' }}>
                  <button onClick={() => { setStep('exec'); scrollTop(); }} style={glassBtn}>🚀 See execution plan →</button>
                </div>
              )}
            </div>
          )}

          {/* EXEC */}
          {step === 'exec' && parsed && (
            <div style={{ paddingTop: 16, animation: 'fadeUp .5s ease both' }}>

              {/* Score strip */}
              <div style={{ ...glass, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: '#1a1a2e' }}>🔥 {parsed.score}</div>
                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.25)' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{scoreTagLabel}</div>
              </div>

              {/* Agent summaries */}
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(26,26,46,.6)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Expert summaries</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
                {AGENTS.map(agent => (
                  <div key={agent.id} style={{ ...glass, borderLeft: '3px solid rgba(255,255,255,.5)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                      <span style={{ fontSize: 13 }}>{agent.icon}</span>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 800, color: '#1a1a2e' }}>{agent.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(26,26,46,.75)', lineHeight: 1.45 }}>
                      {parsed.agents[agent.id]?.split('. ').slice(0, 2).join('. ') + '.'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Improvements + refine */}
              {parsed.improvements?.length > 0 && (
                <div style={{ ...glass, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🎯 How to improve your score</div>
                  {parsed.improvements.map((imp, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'rgba(26,26,46,.8)', lineHeight: 1.4, flex: 1 }}>{imp.action}</div>
                      <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>+{imp.points}pts</div>
                    </div>
                  ))}

                  {!showRefined && (
                    <button onClick={handleRefine} disabled={refining} style={{ ...glassBtnSm, marginTop: 4, opacity: refining ? .6 : 1 }}>
                      {refining ? '✨ Generating improved idea...' : '✨ Generate improved idea →'}
                    </button>
                  )}

                  {showRefined && refined && (
                    <div style={{ animation: 'fadeUp .4s ease both', marginTop: 10 }}>
                      <div style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(0,0,0,.1)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(26,26,46,.6)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>✨ Improved idea</div>
                        <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.55, marginBottom: 8 }}>{refined.refinedIdea}</div>
                        {refined.changes?.map((c, i) => (
                          <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                            <span style={{ color: 'rgba(26,26,46,.7)', fontSize: 10 }}>✓</span>
                            <span style={{ fontSize: 10, color: 'rgba(26,26,46,.65)', lineHeight: 1.4 }}>{c}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={runRefinedIdea} style={{ ...glassBtn, flex: 2, fontSize: 12 }}>⚡ Run War Room with this</button>
                        <button onClick={() => setShowRefined(false)} style={{ ...glassBtnSm, flex: 1 }}>Keep original</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div style={{ ...glass, marginBottom: 14, padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.2)' }}>
                  {TABS.map((tab, i) => (
                    <button key={tab} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: '9px 4px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === i ? '#1a1a2e' : 'transparent'}`, fontSize: 11, fontWeight: 600, color: activeTab === i ? '#1a1a2e' : 'rgba(26,26,46,.45)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{tab}</button>
                  ))}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(parsed.execution?.[TAB_KEYS[activeTab]] || []).map((item, i) => (
                      <li key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                        <span style={{ color: 'rgba(26,26,46,.7)', fontSize: 12, flexShrink: 0 }}>▸</span>
                        <span style={{ fontSize: 12, color: 'rgba(26,26,46,.9)', lineHeight: 1.5 }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handleSave} disabled={saving || saved} style={{ ...glassBtn, opacity: saved || saving ? .6 : 1 }}>
                  {saved ? `✅ Saved → /profile/${username}` : saving ? 'Saving...' : '💾 Save to my profile'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleShare} style={{ ...glassBtnSm, flex: 1 }}>{copied ? '✅ Copied!' : '📤 Share'}</button>
                  <button onClick={restart} style={{ ...glassBtnSm, flex: 1 }}>✏️ New idea</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
