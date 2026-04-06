'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getOrCreateUsername } from '../../../lib/username';

interface Idea {
  id: string;
  idea_text: string;
  result: string;
  verdict: string;
  avg_score: number;
  created_at: string;
}

interface Profile {
  username: string;
  display_name: string | null;
  bio: string | null;
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const myUsername = getOrCreateUsername();
    setIsOwner(myUsername === username);
    fetchProfile();
    fetchIdeas();
  }, [username]);

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setBio(data.bio || '');
    }
    setLoading(false);
  }

  async function fetchIdeas() {
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .eq('username', username)
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (data) setIdeas(data);
  }

  async function handleSaveProfile() {
    setSaving(true);
    await supabase.from('profiles').update({ display_name: displayName, bio }).eq('username', username);
    setProfile(p => p ? { ...p, display_name: displayName, bio } : p);
    setSaving(false);
    setEditing(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function verdictColor(verdict: string) {
    if (verdict === '🟢') return { bg: 'rgba(74,222,128,0.1)', border: 'rgba(22,163,74,0.25)', text: '#16a34a' };
    if (verdict === '🟡') return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(217,119,6,0.25)', text: '#d97706' };
    return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(220,38,38,0.25)', text: '#dc2626' };
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {['#ff6b6b', '#a855f7', '#06b6d4', '#f59e0b'].map((color, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: color, animation: `bounce 1.2s ${i * 0.15}s ease-in-out infinite` }} />
        ))}
      </div>
    </div>
  );

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>📭</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0a0a0f' }}>Profile not found</div>
      <a href="/" style={{ color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}>← Back to Hako Mind</a>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1.2);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f9f9f9; font-family: 'DM Sans', sans-serif; color: #0a0a0f; }
      `}</style>

      {/* Nav */}
      <div style={{ borderBottom: '1px solid #ebebeb', background: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20 }}>
            <span style={{ background: 'linear-gradient(135deg,#ff6b6b,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hako</span>
            {' '}
            <span style={{ background: 'linear-gradient(135deg,#a855f7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mind</span>
          </span>
        </a>
        <a href="/explore" style={{ fontSize: 14, fontWeight: 600, color: '#a855f7', textDecoration: 'none' }}>🌍 Explore ideas</a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Profile card */}
        <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #ebebeb', padding: '32px', marginBottom: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', animation: 'fadeUp .5s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Avatar */}
              <div style={{
                width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg,#a855f7,#06b6d4)', fontSize: 24, fontWeight: 800, color: '#fff',
                fontFamily: 'Syne, sans-serif', flexShrink: 0,
              }}>
                {(profile.display_name || username)[0].toUpperCase()}
              </div>
              <div>
                {editing ? (
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne, sans-serif', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '4px 10px', color: '#0a0a0f', outline: 'none', width: '100%' }}
                  />
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#0a0a0f' }}>
                    {profile.display_name || username}
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#888', fontWeight: 500, marginTop: 2 }}>@{username}</div>
              </div>
            </div>

            {isOwner && (
              editing ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSaveProfile} disabled={saving} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#a855f7,#06b6d4)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', background: '#f0f0f0', border: '1px solid #e0e0e0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#444', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} style={{ padding: '8px 16px', background: '#f0f0f0', border: '1px solid #e0e0e0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#444', cursor: 'pointer' }}>
                  ✏️ Edit profile
                </button>
              )
            )}
          </div>

          {/* Bio */}
          <div style={{ marginTop: 20 }}>
            {editing ? (
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell people what you're building..."
                rows={3}
                style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#0a0a0f', fontFamily: 'DM Sans, sans-serif', resize: 'none', outline: 'none', fontWeight: 500 }}
              />
            ) : (
              <p style={{ fontSize: 15, color: profile.bio ? '#333' : '#aaa', lineHeight: 1.7, fontWeight: 500 }}>
                {profile.bio || (isOwner ? 'Click Edit profile to add a bio...' : 'No bio yet.')}
              </p>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 20, borderTop: '1px solid #f0f0f0' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#0a0a0f' }}>{ideas.length}</div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ideas saved</div>
            </div>
            {ideas.length > 0 && (
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#0a0a0f' }}>
                  {Math.round(ideas.reduce((s, i) => s + (i.avg_score || 0), 0) / ideas.length)}/10
                </div>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Avg score</div>
              </div>
            )}
          </div>
        </div>

        {/* Ideas list */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          Saved ideas ({ideas.length})
        </div>

        {ideas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 20, border: '1px solid #ebebeb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0a0a0f', marginBottom: 8 }}>No ideas saved yet</div>
            <a href="/" style={{ fontSize: 14, color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}>Unbox your first idea →</a>
          </div>
        ) : (
          ideas.map((idea, i) => {
            const vc = verdictColor(idea.verdict);
            const isExpanded = expandedId === idea.id;
            return (
              <div key={idea.id} style={{ background: '#fff', borderRadius: 20, border: '1px solid #ebebeb', padding: '20px 24px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.03)', animation: `fadeUp ${.3 + i * .05}s ease both` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0f', lineHeight: 1.5, marginBottom: 8 }}>
                      {idea.idea_text}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: vc.bg, border: `1px solid ${vc.border}`, borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: vc.text }}>
                        {idea.verdict} {idea.verdict === '🟢' ? 'Strong' : idea.verdict === '🟡' ? 'Needs work' : 'Crowded'}
                      </span>
                      {idea.avg_score > 0 && (
                        <span style={{ background: '#f5f5f7', borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#555' }}>
                          ⭐ {idea.avg_score}/10
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: '#bbb', fontWeight: 500 }}>{formatDate(idea.created_at)}</span>
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
