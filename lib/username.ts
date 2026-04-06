const adjectives = [
  'cosmic', 'swift', 'bright', 'bold', 'sharp', 'calm', 'wild',
  'clever', 'vivid', 'sleek', 'brave', 'fresh', 'keen', 'nimble',
];

const nouns = [
  'panda', 'falcon', 'orbit', 'spark', 'pixel', 'wave', 'nova',
  'comet', 'prism', 'quasar', 'breeze', 'fox', 'hawk', 'tide',
];

export function generateUsername(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}-${noun}-${num}`;
}

export function getOrCreateUsername(): string {
  if (typeof window === 'undefined') return '';
  let username = localStorage.getItem('hako_username');
  if (!username) {
    username = generateUsername();
    localStorage.setItem('hako_username', username);
  }
  return username;
}