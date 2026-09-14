// Theme definitions for Birthday Card Maker Premium
export const THEMES = {
  'elegant-gold': {
    id: 'elegant-gold',
    label: 'Elegant Gold',
    bg: '#f4ead6',          // ivory / champagne
    bgAccent: '#e6d3a8',
    ink: '#3d2a17',          // deep warm brown
    messageInk: '#2b1a09',   // darker than the gold florals
    accent: '#b78740',       // gold
    accent2: '#e6c98a',
    backgroundImage: 'assets/backgrounds/elegant-gold-v2.webp',
    swatch: 'linear-gradient(135deg,#f4ead6 0%,#e6c98a 55%,#b78740 100%)',
  },
  'romantic-pink': {
    id: 'romantic-pink',
    label: 'Romantic Pink',
    bg: '#fbe6e3',           // blush
    bgAccent: '#f2c9c2',
    ink: '#6d2637',          // burgundy / dusty rose
    messageInk: '#521829',   // stays clear over pink flowers
    accent: '#c26a76',
    accent2: '#eaa5a0',
    backgroundImage: 'assets/backgrounds/romantic-pink-v2.webp',
    swatch: 'linear-gradient(135deg,#fbe6e3 0%,#eaa5a0 55%,#c26a76 100%)',
  },
  'celebration-blue': {
    id: 'celebration-blue',
    label: 'Celebration Blue',
    bg: '#dceffc',
    bgAccent: '#9fd0f4',
    ink: '#082454',
    messageInk: '#061b42',
    accent: '#092f6f',
    accent2: '#d3a441',
    backgroundImage: 'assets/backgrounds/celebration-blue-v2.webp',
    swatch: 'linear-gradient(135deg,#dceffc 0%,#5fa8df 60%,#d3a441 100%)',
  },
  'fresh-natural': {
    id: 'fresh-natural',
    label: 'Fresh & Natural',
    bg: '#eef0e6',           // linen / cream
    bgAccent: '#d7dcc5',
    ink: '#3a4a2b',          // moss / earth
    messageInk: '#233219',
    accent: '#7f9166',       // sage
    accent2: '#c1cba4',
    backgroundImage: 'assets/backgrounds/fresh-natural-v2.webp',
    swatch: 'linear-gradient(135deg,#eef0e6 0%,#c1cba4 55%,#7f9166 100%)',
  },
  'sunshine-yellow': {
    id: 'sunshine-yellow', label: 'Sunshine Joy',
    bg: '#fff2bd', bgAccent: '#f4c94f', ink: '#573611', messageInk: '#452504',
    accent: '#b76508', accent2: '#f1b91f',
    backgroundImage: 'assets/backgrounds/sunshine-yellow-v1.webp',
    swatch: 'linear-gradient(135deg,#fff5c9 0%,#f6c843 58%,#d8850d 100%)',
  },
  'lavender-dream': {
    id: 'lavender-dream', label: 'Lavender Dream',
    bg: '#eee8f7', bgAccent: '#c9b9e5', ink: '#3f285f', messageInk: '#2c1648',
    accent: '#754c9e', accent2: '#d9d3e7',
    backgroundImage: 'assets/backgrounds/lavender-dream-v1.webp',
    swatch: 'linear-gradient(135deg,#f3eff9 0%,#c7afe2 58%,#8060a8 100%)',
  },
  'midnight-silver': {
    id: 'midnight-silver', label: 'Midnight Silver',
    bg: '#09234a', bgAccent: '#03152f', ink: '#f5f7fb',
    accent: '#e5e9f0', accent2: '#8fa8cb', messageInk: '#e6c98a',
    backgroundImage: 'assets/backgrounds/midnight-silver-v1.webp',
    swatch: 'linear-gradient(135deg,#061a38 0%,#173e73 58%,#d8dde7 100%)',
  },
};

export const FONTS = {
  script:  { id: 'script',  label: 'Elegant Script',  family: "'Great Vibes','Snell Roundhand',cursive", size: 1.05 },
  hand:    { id: 'hand',    label: 'Handwritten',     family: "'Caveat','Bradley Hand',cursive",         size: 1.0 },
  bold:    { id: 'bold',    label: 'Modern Bold',     family: "'Poppins','Helvetica Neue',sans-serif",   size: 0.9 },
  casual:  { id: 'casual',  label: 'Friendly Casual', family: "'Nunito',system-ui,sans-serif",           size: 0.9 },
};

export const LAYOUTS = {
  'center-focus':   { id: 'center-focus',   label: 'Center Focus' },
  'left-aligned':   { id: 'left-aligned',   label: 'Left Aligned' },
  'right-aligned':  { id: 'right-aligned',  label: 'Right Aligned' },
  'collage':        { id: 'collage',        label: 'Collage' },
};

// Semantic anchor positions on 500x700 logical canvas with 40px safe margin.
export const SAFE_MARGIN = 40;
export const CANVAS_W = 500;
export const CANVAS_H = 700;

export function anchorPoint(anchor) {
  const m = SAFE_MARGIN;
  const w = CANVAS_W, h = CANVAS_H;
  switch (anchor) {
    case 'top-left':      return { x: m, y: m };
    case 'top-center':    return { x: w / 2, y: m };
    case 'top-right':     return { x: w - m, y: m };
    case 'center-left':   return { x: m, y: h / 2 };
    case 'center':        return { x: w / 2, y: h / 2 };
    case 'center-right':  return { x: w - m, y: h / 2 };
    case 'bottom-left':   return { x: m, y: h - m };
    case 'bottom-center': return { x: w / 2, y: h - m };
    case 'bottom-right':  return { x: w - m, y: h - m };
    default:              return { x: w / 2, y: h / 2 };
  }
}
