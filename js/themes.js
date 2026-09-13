// Theme definitions for Birthday Card Maker Premium
export const THEMES = {
  'elegant-gold': {
    id: 'elegant-gold',
    label: 'Elegant Gold',
    bg: '#f4ead6',          // ivory / champagne
    bgAccent: '#e6d3a8',
    ink: '#3d2a17',          // deep warm brown
    accent: '#b78740',       // gold
    accent2: '#e6c98a',
    swatch: 'linear-gradient(135deg,#f4ead6 0%,#e6c98a 55%,#b78740 100%)',
  },
  'romantic-pink': {
    id: 'romantic-pink',
    label: 'Romantic Pink',
    bg: '#fbe6e3',           // blush
    bgAccent: '#f2c9c2',
    ink: '#6d2637',          // burgundy / dusty rose
    accent: '#c26a76',
    accent2: '#eaa5a0',
    swatch: 'linear-gradient(135deg,#fbe6e3 0%,#eaa5a0 55%,#c26a76 100%)',
  },
  'celebration-blue': {
    id: 'celebration-blue',
    label: 'Celebration Blue',
    bg: '#0f1d3a',           // navy
    bgAccent: '#1e3160',
    ink: '#f0f6ff',          // white
    accent: '#c8a45e',       // gold / silver accent
    accent2: '#a9b8d1',
    swatch: 'linear-gradient(135deg,#0f1d3a 0%,#5a76a8 60%,#e6c98a 100%)',
  },
  'fresh-natural': {
    id: 'fresh-natural',
    label: 'Fresh & Natural',
    bg: '#eef0e6',           // linen / cream
    bgAccent: '#d7dcc5',
    ink: '#3a4a2b',          // moss / earth
    accent: '#7f9166',       // sage
    accent2: '#c1cba4',
    swatch: 'linear-gradient(135deg,#eef0e6 0%,#c1cba4 55%,#7f9166 100%)',
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
