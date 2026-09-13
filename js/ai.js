// Local birthday message generator with mood-flavored templates.
// No API key required. Deterministic-random with a small template library.
const TEMPLATES = {
  Happy: [
    'Happy birthday, {name}! Wishing you a day as bright and wonderful as you are.',
    'Cheers to you, {name}! May {age}be filled with laughter, love and beautiful moments.',
    'Have the happiest of birthdays, {name}. Today is all yours — enjoy every second of it.',
  ],
  Joyful: [
    'Sending you all the joy in the world today, {name}. Let this new year sparkle from start to finish.',
    'Dance, celebrate, and shine, {name} — {age}is going to be your best chapter yet!',
    'A very joyful birthday, {name}. May happiness follow you into every single day.',
  ],
  Candid: [
    'Happy birthday, {name}. Honestly — the world is a warmer place with you in it.',
    "Another trip around the sun, {name}. You're doing amazingly, and I hope this year is kind to you.",
    'Just wanted to say: happy birthday, {name}. Grateful you exist.',
  ],
  Heartfelt: [
    'From the bottom of my heart, {name} — happy birthday. You mean the world to me.',
    'On your special day, {name}, I hope you feel deeply loved and celebrated.',
    'Happy birthday, dearest {name}. May every wish you make find its way home.',
  ],
  Romantic: [
    'Happy birthday, my love {name}. Every day with you is a gift, but today is yours.',
    'To the one who lights up my life — happy birthday, {name}. Forever grateful for you.',
    'Happy birthday, {name}. My heart is yours, today and always.',
  ],
  Funny: [
    "Happy {age}, {name}! You're not older — you're just a limited edition, matured to perfection.",
    "Happy birthday, {name}! Don't worry about the number — worry about the cake.",
    "It's your birthday, {name}! Legally you must eat cake. Twice.",
  ],
  Elegant: [
    'Wishing you a truly beautiful birthday, {name} — filled with grace, warmth and celebration.',
    'To {name}, on this most elegant of days: may every wish unfold as gracefully as you do.',
    'A very refined happy birthday to you, {name}. May {age}be your finest year yet.',
  ],
  Professional: [
    'Wishing you a wonderful birthday, {name}. May the year ahead bring success and happiness.',
    'Warmest wishes on your birthday, {name}. Here is to another remarkable year.',
    'Happy birthday, {name}. Thank you for everything you do — enjoy your special day.',
  ],
};

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}
function seedOf() { return Math.floor(Math.random() * 1e9); }

function render(tpl, ctx) {
  const agePart = ctx.age ? `${ctx.age} ` : '';
  return tpl.replace(/\{name\}/g, ctx.name || 'friend').replace(/\{age\}/g, agePart);
}

export function generateMessage({ mood = 'Happy', name = '', age = '', sender = '' } = {}) {
  const seed = seedOf();
  if (mood === 'Multiple Variations') {
    const moods = ['Heartfelt', 'Joyful', 'Elegant'];
    return moods.map((m, i) => render(pick(TEMPLATES[m], seed + i), { name, age }));
  }
  const list = TEMPLATES[mood] || TEMPLATES.Happy;
  return [render(pick(list, seed), { name, age })];
}
