// Canvas Engine — logical 500x700, DPR-aware, rotated hit testing, interactions.
import { THEMES, FONTS, CANVAS_W, CANVAS_H, SAFE_MARGIN, anchorPoint } from './themes.js';

// Place an element of size (w,h) at a semantic anchor while insetting so the element
// remains fully inside the safe area of the canvas.
export function placeAtAnchor(anchor, w, h) {
  const m = SAFE_MARGIN;
  const [vy, hx] = anchor.split('-');
  const halfW = w / 2, halfH = h / 2;
  const minX = m + halfW, maxX = CANVAS_W - m - halfW;
  const minY = m + halfH, maxY = CANVAS_H - m - halfH;
  let x = CANVAS_W / 2, y = CANVAS_H / 2;
  if (hx === 'left')   x = minX;
  if (hx === 'right')  x = maxX;
  if (hx === 'center') x = CANVAS_W / 2;
  if (vy === 'top')    y = minY;
  if (vy === 'bottom') y = maxY;
  if (vy === 'center') y = CANVAS_H / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

export const LAYER_ORDER = [
  'background', 'bg-decoration', 'photo', 'headline', 'age', 'body', 'decoration', 'overlay'
];
const LAYER_INDEX = Object.fromEntries(LAYER_ORDER.map((l, i) => [l, i]));

export const PHOTO_SLOTS = {
  'center-focus': [
    { x: 250, y: 252, w: 206, h: 206, rotation: 0, shape: 'circle' },
  ],
  'left-aligned': [
    { x: 142, y: 308, w: 200, h: 258, rotation: -2, shape: 'polaroid' },
  ],
  'right-aligned': [
    { x: 358, y: 308, w: 200, h: 258, rotation: 2, shape: 'polaroid' },
  ],
  collage: [
    { x: 132, y: 280, w: 166, h: 206, rotation: -7, shape: 'polaroid' },
    { x: 250, y: 250, w: 166, h: 206, rotation: 1, shape: 'polaroid' },
    { x: 368, y: 282, w: 166, h: 206, rotation: 7, shape: 'polaroid' },
  ],
};

export function makeInitialState() {
  return {
    themeId: 'elegant-gold',
    fontId: 'script',
    layout: 'center-focus',
    composition: {},
    content: { name: '', age: '', message: '', sender: '', secondary: '' },
    photo: null, // { id, adj:{...} }
    photos: [], // for collage
    elements: [], // decorations, photos, text overrides
    selectedId: null,
    nextZ: 100,
  };
}

// Utility: rotated rect hit
export function pointInRotatedRect(px, py, cx, cy, w, h, rotDeg) {
  const rad = (-rotDeg * Math.PI) / 180;
  const dx = px - cx, dy = py - cy;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(rx) <= w / 2 && Math.abs(ry) <= h / 2;
}

// Wrap text into lines that fit within maxWidth on ctx.
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

// Auto-fit text: try sizes descending until fits box (or min).
function fitText(ctx, text, fontFamily, weight, maxWidth, maxHeight, startSize, minSize = 14) {
  let size = startSize;
  let lines = [];
  let lineH = 0;
  while (size >= minSize) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    lines = wrapLines(ctx, text, maxWidth);
    lineH = size * 1.15;
    if (lines.length * lineH <= maxHeight) break;
    size -= 1;
  }
  return { size, lines, lineH, overflow: lines.length * lineH > maxHeight };
}

export class CardEngine {
  constructor(canvas, handlesEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.handles = handlesEl;
    this.state = makeInitialState();
    this.assetCache = new Map(); // path -> HTMLImageElement
    this.photoCache = new Map(); // photoId -> HTMLImageElement (from ObjectURL)
    this.photoURLs = new Map(); // photoId -> ObjectURL
    this.onSelect = null;
    this.onChange = null;
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.needsRender = false;
    this._raf = null;
    this.installDpr();
    this.installInteractions();
    window.addEventListener('resize', () => { this.installDpr(); this.requestRender(); });
  }

  installDpr() {
    const w = CANVAS_W, h = CANVAS_H;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  setState(patch, { silent = false } = {}) {
    Object.assign(this.state, patch);
    if (!silent && this.onChange) this.onChange();
    this.requestRender();
  }

  requestRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this.render(); });
  }

  /* -------- Rendering -------- */
  render(targetCtx = null, targetW = CANVAS_W, targetH = CANVAS_H) {
    const s = this.state;
    const theme = THEMES[s.themeId];
    const font = FONTS[s.fontId];
    const ctx = targetCtx || this.ctx;
    const scale = targetCtx ? (targetW / CANVAS_W) : this.dpr;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Clip strictly to card rectangle so nothing can render outside
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_W, CANVAS_H);
    ctx.clip();

    // 1) Background — subtle vertical gradient of theme colors
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, theme.bg);
    grad.addColorStop(1, theme.bgAccent);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle inner frame line
    ctx.strokeStyle = theme.accent + '55';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(SAFE_MARGIN / 2, SAFE_MARGIN / 2, CANVAS_W - SAFE_MARGIN, CANVAS_H - SAFE_MARGIN);

    this.drawThemeDetails(ctx, theme);
    this.drawEmptyPhotoSlots(ctx, theme);

    // 2) sorted elements: by layer index then zIndex
    const items = [...s.elements].sort((a, b) =>
      (LAYER_INDEX[a.layer] - LAYER_INDEX[b.layer]) || (a.zIndex - b.zIndex)
    );
    for (const el of items) this.drawElement(ctx, el);

    // 3) draw text (auto-fit)
    this.drawTexts(ctx, theme, font);

    ctx.restore();

    // update handles overlay if rendering to main canvas
    if (!targetCtx) this.updateHandles();
  }

  drawThemeDetails(ctx, theme) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    if (this.state.themeId === 'celebration-blue') {
      ctx.fillStyle = theme.accent;
      for (let i = 0; i < 42; i++) {
        const x = (i * 83) % CANVAS_W;
        const y = 90 + ((i * 137) % 500);
        ctx.save(); ctx.translate(x, y); ctx.rotate((i % 7) * 0.3);
        ctx.fillRect(-2, -5, 4, 10); ctx.restore();
      }
    } else {
      const bloom = ctx.createRadialGradient(70, 80, 5, 70, 80, 170);
      bloom.addColorStop(0, theme.accent2 + 'aa');
      bloom.addColorStop(1, theme.accent2 + '00');
      ctx.fillStyle = bloom; ctx.fillRect(0, 0, 250, 260);
      const bloom2 = ctx.createRadialGradient(440, 620, 5, 440, 620, 190);
      bloom2.addColorStop(0, theme.accent + '88');
      bloom2.addColorStop(1, theme.accent + '00');
      ctx.fillStyle = bloom2; ctx.fillRect(230, 400, 270, 300);
    }
    ctx.restore();
  }

  drawEmptyPhotoSlots(ctx, theme) {
    const photos = this.state.elements.filter(e => e.type === 'photo' && !e.hidden);
    const slots = PHOTO_SLOTS[this.state.layout] || PHOTO_SLOTS['center-focus'];
    const needed = this.state.layout === 'collage' ? slots.length : 1;
    for (let i = photos.length; i < needed; i++) {
      const base = slots[i];
      const override = this.state.composition?.photoSlots?.[i] || (i === 0 ? this.state.composition?.photoSlot : null) || {};
      const slot = { ...base, ...override, shape: this.state.composition?.photoShape || override.shape || base.shape };
      ctx.save(); ctx.translate(slot.x, slot.y); ctx.rotate(slot.rotation * Math.PI / 180);
      ctx.setLineDash([7, 6]); ctx.lineWidth = 2;
      ctx.strokeStyle = theme.accent + 'aa';
      ctx.fillStyle = theme.bg + 'aa';
      if (slot.shape === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, slot.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(-slot.w / 2, -slot.h / 2, slot.w, slot.h);
        ctx.strokeRect(-slot.w / 2, -slot.h / 2, slot.w, slot.h);
      }
      ctx.setLineDash([]); ctx.fillStyle = theme.ink; ctx.globalAlpha = 0.7;
      ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.state.layout === 'collage' ? `Photo ${i + 1}` : 'Add a photo', 0, 0);
      ctx.restore();
    }
  }

  drawElement(ctx, el) {
    if (el.hidden) return;
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.translate(el.x, el.y);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);

    if (el.type === 'decoration' || el.type === 'bg-decoration') {
      const img = this.assetCache.get(el.path);
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, -el.w / 2, -el.h / 2, el.w, el.h);
      } else {
        // Placeholder outline while loading
        ctx.strokeStyle = 'rgba(200,164,94,.5)';
        ctx.strokeRect(-el.w / 2, -el.h / 2, el.w, el.h);
      }
    } else if (el.type === 'photo') {
      this.drawPhotoElement(ctx, el);
    }
    ctx.restore();
  }

  drawPhotoElement(ctx, el) {
    const img = this.photoCache.get(el.photoId);
    if (el.shape === 'circle') {
      this.drawCircularPhoto(ctx, el, img);
      return;
    }
    // Polaroid frame: white padding around image
    const framePad = 14;
    const bottomPad = 26;
    const w = el.w, h = el.h;
    ctx.save();
    // outer frame shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fff';
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(-w/2 + r, -h/2);
    ctx.arcTo(w/2, -h/2, w/2, h/2, r);
    ctx.arcTo(w/2, h/2, -w/2, h/2, r);
    ctx.arcTo(-w/2, h/2, -w/2, -h/2, r);
    ctx.arcTo(-w/2, -h/2, w/2, -h/2, r);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Inner image area (photo rect)
    const iw = w - framePad * 2;
    const ih = h - framePad - bottomPad;
    const ix = -w/2 + framePad;
    const iy = -h/2 + framePad;

    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    // Background inside photo area
    ctx.fillStyle = '#efe6d9';
    ctx.fillRect(ix, iy, iw, ih);

    if (img && img.complete && img.naturalWidth) {
      const adj = el.adj || {};
      const filter = [
        `brightness(${adj.brightness ?? 1})`,
        `contrast(${adj.contrast ?? 1})`,
        `saturate(${adj.saturation ?? 1})`,
        `sepia(${(adj.warmth ?? 0)})`,
        `blur(${adj.blur ?? 0}px)`,
      ].join(' ');
      ctx.filter = filter;
      ctx.globalAlpha = (ctx.globalAlpha) * (adj.opacity ?? 1);
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const mode = adj.fitMode || 'fill';
      const scale = (adj.zoom ?? 1) * (mode === 'fill'
        ? Math.max(iw / nw, ih / nh)
        : Math.min(iw / nw, ih / nh));
      const dw = nw * scale, dh = nh * scale;
      const flipX = adj.flipX ? -1 : 1, flipY = adj.flipY ? -1 : 1;
      ctx.translate(ix + iw/2, iy + ih/2);
      ctx.translate((adj.offsetX ?? 0), (adj.offsetY ?? 0));
      ctx.rotate(((adj.rotation ?? 0) * Math.PI) / 180);
      ctx.scale(flipX, flipY);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#8e8272';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add a photo', ix + iw/2, iy + ih/2 + 6);
    }
    ctx.restore();

    // Frame outline
    ctx.strokeStyle = 'rgba(0,0,0,.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w/2, -h/2, w, h);
    ctx.restore();
  }

  drawCircularPhoto(ctx, el, img) {
    const radius = Math.min(el.w, el.h) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    const inner = radius - 10;
    ctx.beginPath(); ctx.arc(0, 0, inner, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#efe6d9'; ctx.fillRect(-inner, -inner, inner * 2, inner * 2);
    if (img && img.complete && img.naturalWidth) {
      const adj = el.adj || {};
      ctx.filter = `brightness(${adj.brightness ?? 1}) contrast(${adj.contrast ?? 1}) saturate(${adj.saturation ?? 1}) sepia(${adj.warmth ?? 0}) blur(${adj.blur ?? 0}px)`;
      ctx.globalAlpha *= adj.opacity ?? 1;
      const diameter = inner * 2;
      const scale = (adj.zoom ?? 1) * ((adj.fitMode || 'fill') === 'fill'
        ? Math.max(diameter / img.naturalWidth, diameter / img.naturalHeight)
        : Math.min(diameter / img.naturalWidth, diameter / img.naturalHeight));
      ctx.translate(adj.offsetX ?? 0, adj.offsetY ?? 0);
      ctx.rotate(((adj.rotation ?? 0) * Math.PI) / 180);
      ctx.scale(adj.flipX ? -1 : 1, adj.flipY ? -1 : 1);
      ctx.drawImage(img, -img.naturalWidth * scale / 2, -img.naturalHeight * scale / 2,
        img.naturalWidth * scale, img.naturalHeight * scale);
    }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = THEMES[this.state.themeId].accent; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, radius - 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  drawTexts(ctx, theme, font) {
    const s = this.state;
    const comp = s.composition || {};
    const layouts = {
      'center-focus': { titleY: 38, x: 250, width: 370, align: 'center', nameY: 372, bodyY: 430, bodyBottom: 584, footerY: 646 },
      'left-aligned': { titleY: 38, x: 278, width: 168, align: 'left', nameY: 178, bodyY: 242, bodyBottom: 510, footerY: 610 },
      'right-aligned': { titleY: 38, x: 222, width: 168, align: 'right', nameY: 178, bodyY: 242, bodyBottom: 510, footerY: 610 },
      collage: { titleY: 36, x: 250, width: 390, align: 'center', nameY: 405, bodyY: 458, bodyBottom: 580, footerY: 646 },
    };
    const box = { ...(layouts[s.layout] || layouts['center-focus']), ...(comp.text || {}) };
    const titleFont = (FONTS[comp.titleFontId] || font).family;
    const nameFont = (FONTS[comp.nameFontId] || font).family;
    const bodyFont = comp.bodyFont || "'Cormorant Garamond',Georgia,serif";
    ctx.textBaseline = 'top';

    const fitSingle = (text, family, weight, style, start, min, width = box.width) => {
      let size = start;
      do {
        ctx.font = `${style} ${weight} ${size}px ${family}`;
        if (ctx.measureText(text).width <= width) return size;
        size -= 1;
      } while (size >= min);
      return min;
    };
    const drawWrapped = (text, y, bottom, startSize = 20) => {
      let size = startSize, lines = [], lineH = 0;
      while (size >= 12) {
        ctx.font = `500 ${size}px ${bodyFont}`;
        lines = wrapLines(ctx, text, box.width);
        lineH = size * 1.25;
        if (lines.length * lineH <= bottom - y) break;
        size -= 1;
      }
      ctx.font = `500 ${size}px ${bodyFont}`; ctx.fillStyle = theme.ink;
      lines.forEach((line, i) => ctx.fillText(line, box.x, y + i * lineH));
    };

    ctx.textAlign = 'center';
    const titleSize = fitSingle('Happy Birthday', titleFont, '700', 'normal', comp.titleSize || 55, 30, 410);
    ctx.font = `normal 700 ${titleSize}px ${titleFont}`; ctx.fillStyle = theme.accent;
    ctx.fillText('Happy Birthday', 250, box.titleY);

    ctx.textAlign = box.align;
    let nameBottom = box.nameY;
    if (s.content.name) {
      const text = `Dear ${s.content.name}`;
      const size = fitSingle(text, nameFont, '700', 'italic', comp.nameSize || 31, 17);
      ctx.font = `italic 700 ${size}px ${nameFont}`; ctx.fillStyle = theme.accent;
      ctx.fillText(text, box.x, box.nameY); nameBottom = box.nameY + size + 7;
    }
    if (s.content.age) {
      const text = `Turning ${s.content.age}`;
      const size = fitSingle(text, bodyFont, '600', 'normal', 18, 12);
      ctx.font = `normal 600 ${size}px ${bodyFont}`; ctx.fillStyle = theme.ink; ctx.globalAlpha = 0.78;
      ctx.fillText(text, box.x, nameBottom); ctx.globalAlpha = 1; nameBottom += size + 6;
    }
    if (s.content.message) drawWrapped(s.content.message, Math.max(box.bodyY, nameBottom + 6), box.bodyBottom, comp.bodySize || 19);

    let footerY = box.footerY;
    if (s.content.secondary) {
      const size = fitSingle(s.content.secondary, bodyFont, '500', 'italic', 15, 11);
      ctx.font = `italic 500 ${size}px ${bodyFont}`; ctx.fillStyle = theme.ink; ctx.globalAlpha = 0.78;
      ctx.fillText(s.content.secondary, box.x, footerY - 42); ctx.globalAlpha = 1;
    }
    if (s.content.sender) {
      const size = fitSingle(s.content.sender, nameFont, '600', 'italic', 20, 12);
      ctx.font = `italic 600 ${size}px ${nameFont}`; ctx.fillStyle = theme.accent;
      ctx.fillText(s.content.sender, box.x, footerY);
    }
  }

  // Render an arbitrary state (e.g. a preset) into a target context without touching the live canvas.
  renderState(state, targetCtx, targetW, targetH) {
    const live = this.state;
    this.state = state;
    try { this.render(targetCtx, targetW, targetH); } finally { this.state = live; }
  }

  // Resolve when every asset path is loaded (or failed) so previews can be drawn once.
  assetsReady(paths) {
    return Promise.all(paths.map(p => new Promise(res => {
      const img = this.loadAsset(p);
      if (img.complete) return res();
      img.addEventListener('load', () => res(), { once: true });
      img.addEventListener('error', () => res(), { once: true });
    })));
  }

  /* -------- Elements -------- */
  makeDecorationElement(dec) {
    const el = {
      id: 'e_' + Math.random().toString(36).slice(2, 9),
      type: 'decoration',
      layer: 'decoration',
      path: dec.path,
      name: dec.name,
      x: 0, y: 0,
      w: dec.width, h: dec.height,
      rotation: 0, opacity: 1, hidden: false, locked: false,
      zIndex: this.state.nextZ++,
    };
    // Place at semantic anchor, inset so element stays fully inside the canvas + safe margin.
    const pos = placeAtAnchor(dec.preferredAnchor, el.w, el.h);
    el.x = pos.x; el.y = pos.y;
    this.loadAsset(dec.path);
    this.resolveCollisions(el);
    return el;
  }

  addDecoration(dec) {
    const el = this.makeDecorationElement(dec);
    this.state.elements.push(el);
    this.state.selectedId = el.id;
    if (this.onSelect) this.onSelect(el.id);
    this.onChange && this.onChange();
    this.requestRender();
    return el;
  }

  addPhoto(photoId, { layout } = {}) {
    const l = layout || this.state.layout;
    const existing = this.state.elements.filter(e => e.type === 'photo');
    const slots = PHOTO_SLOTS[l] || PHOTO_SLOTS['center-focus'];
    let slotIndex = 0;
    if (l === 'collage') {
      slotIndex = Math.min(existing.length, slots.length - 1);
      if (existing.length >= slots.length) {
        const selected = existing.find(e => e.id === this.state.selectedId) || existing[0];
        selected.photoId = photoId; selected.adj = defaultAdj();
        this.state.selectedId = selected.id;
        this.onSelect && this.onSelect(selected.id); this.onChange && this.onChange(); this.requestRender();
        return selected;
      }
    } else if (existing.length) {
      const keep = existing.find(e => e.id === this.state.selectedId) || existing[0];
      keep.photoId = photoId; keep.adj = defaultAdj();
      this.state.elements = this.state.elements.filter(e => e.type !== 'photo' || e.id === keep.id);
      this.applyPhotoSlot(keep, slots[0], 0);
      this.state.selectedId = keep.id;
      this.onSelect && this.onSelect(keep.id); this.onChange && this.onChange(); this.requestRender();
      return keep;
    }
    const el = {
      id: 'p_' + Math.random().toString(36).slice(2, 9),
      type: 'photo', layer: 'photo', photoId,
      adj: defaultAdj(), zIndex: this.state.nextZ++,
      opacity: 1, hidden: false, locked: false,
    };
    this.applyPhotoSlot(el, slots[slotIndex], slotIndex);
    this.state.elements.push(el);
    this.state.selectedId = el.id;
    if (this.onSelect) this.onSelect(el.id);
    this.onChange && this.onChange();
    this.requestRender();
    return el;
  }

  applyPhotoSlot(el, slot, index) {
    const override = this.state.composition?.photoSlots?.[index] || (index === 0 ? this.state.composition?.photoSlot : null) || {};
    const resolved = { ...slot, ...override };
    Object.assign(el, {
      x: resolved.x, y: resolved.y, w: resolved.w, h: resolved.h,
      rotation: resolved.rotation || 0,
      shape: this.state.composition?.photoShape || resolved.shape || 'polaroid',
      collageIndex: index,
    });
  }

  setPhotoLayout(layout) {
    const photos = this.state.elements.filter(e => e.type === 'photo');
    const other = this.state.elements.filter(e => e.type !== 'photo');
    this.state.layout = layout;
    this.state.composition = { ...(this.state.composition || {}) };
    delete this.state.composition.photoSlot;
    delete this.state.composition.photoSlots;
    delete this.state.composition.photoShape;
    delete this.state.composition.text;
    const slots = PHOTO_SLOTS[layout] || PHOTO_SLOTS['center-focus'];
    const kept = layout === 'collage' ? photos.slice(0, slots.length) : photos.slice(0, 1);
    kept.forEach((el, index) => this.applyPhotoSlot(el, slots[index], index));
    this.state.elements = [...other, ...kept];
    this.reflowDecorations(layout);
    if (!kept.some(e => e.id === this.state.selectedId)) this.state.selectedId = kept[0]?.id || null;
    this.onSelect && this.onSelect(this.state.selectedId);
    this.onChange && this.onChange();
    this.requestRender();
  }

  reflowDecorations(layout) {
    const zones = {
      'center-focus': [{ x: 95, y: 345, w: 310, h: 245 }],
      collage: [{ x: 90, y: 392, w: 320, h: 278 }],
      'left-aligned': [{ x: 250, y: 145, w: 215, h: 520 }],
      'right-aligned': [{ x: 35, y: 145, w: 215, h: 520 }],
    };
    const intersects = (el, zone) => {
      const left = el.x - el.w / 2, top = el.y - el.h / 2;
      return left < zone.x + zone.w && left + el.w > zone.x && top < zone.y + zone.h && top + el.h > zone.y;
    };
    const candidates = layout === 'left-aligned'
      ? [{ x: 58, y: 155 }, { x: 60, y: 500 }, { x: 145, y: 610 }, { x: 55, y: 630 }]
      : layout === 'right-aligned'
        ? [{ x: 442, y: 155 }, { x: 440, y: 500 }, { x: 355, y: 610 }, { x: 445, y: 630 }]
        : [{ x: 42, y: 165 }, { x: 458, y: 170 }, { x: 42, y: 315 }, { x: 458, y: 315 }, { x: 42, y: 635 }, { x: 458, y: 635 }];
    let cursor = 0;
    for (const el of this.state.elements.filter(e => e.type === 'decoration')) {
      if (!(zones[layout] || []).some(zone => intersects(el, zone))) continue;
      const target = candidates[cursor++ % candidates.length];
      const scale = Math.min(1, 94 / Math.max(el.w, el.h));
      el.w = Math.round(el.w * scale); el.h = Math.round(el.h * scale);
      el.x = target.x; el.y = target.y;
    }
  }

  removeSelected() {
    const id = this.state.selectedId;
    if (!id) return;
    this.state.elements = this.state.elements.filter(e => e.id !== id);
    this.state.selectedId = null;
    if (this.onSelect) this.onSelect(null);
    this.onChange && this.onChange();
    this.requestRender();
  }

  duplicateSelected() {
    const id = this.state.selectedId;
    const el = this.state.elements.find(e => e.id === id);
    if (!el) return;
    const copy = { ...el, id: 'e_' + Math.random().toString(36).slice(2, 9),
                   x: el.x + 20, y: el.y + 20, zIndex: this.state.nextZ++ };
    this.state.elements.push(copy);
    this.state.selectedId = copy.id;
    if (this.onSelect) this.onSelect(copy.id);
    this.onChange && this.onChange();
    this.requestRender();
  }

  bringForward(delta = 1) {
    const el = this.getSelected();
    if (!el) return;
    el.zIndex += delta;
    this.onChange && this.onChange();
    this.requestRender();
  }

  setSelectedProp(patch) {
    const el = this.getSelected();
    if (!el) return;
    Object.assign(el, patch);
    if (patch.adj) el.adj = { ...(el.adj || defaultAdj()), ...patch.adj };
    this.onChange && this.onChange();
    this.requestRender();
  }

  getSelected() {
    return this.state.elements.find(e => e.id === this.state.selectedId) || null;
  }

  select(id) {
    this.state.selectedId = id;
    if (this.onSelect) this.onSelect(id);
    this.requestRender();
  }

  resolveCollisions(el) {
    // Simple heuristic: if el would overlap a photo or text zones, try alternate anchors then scale down.
    const anchors = ['top-right','top-left','top-center','bottom-right','bottom-left','bottom-center','center-left','center-right'];
    const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 8 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 8;
    const photos = this.state.elements.filter(e => e.type === 'photo');
    for (let i = 0; i < anchors.length; i++) {
      let bad = false;
      for (const p of photos) if (overlaps(el, p)) { bad = true; break; }
      if (!bad) return;
      const pos = placeAtAnchor(anchors[i], el.w, el.h);
      el.x = pos.x; el.y = pos.y;
    }
    // Still colliding: scale down to 70% and re-inset
    el.w = Math.max(40, el.w * 0.7);
    el.h = Math.max(40, el.h * 0.7);
    const pos = placeAtAnchor('bottom-right', el.w, el.h);
    el.x = pos.x; el.y = pos.y;
  }

  loadAsset(path) {
    if (this.assetCache.has(path)) return this.assetCache.get(path);
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.onload = () => this.requestRender();
    img.onerror = () => {/* keep placeholder */};
    img.src = path;
    this.assetCache.set(path, img);
    return img;
  }

  attachPhoto(photoId, url) {
    // revoke previous
    if (this.photoURLs.has(photoId)) {
      try { URL.revokeObjectURL(this.photoURLs.get(photoId)); } catch {}
    }
    this.photoURLs.set(photoId, url);
    const img = new Image();
    img.onload = () => this.requestRender();
    img.src = url;
    this.photoCache.set(photoId, img);
  }

  /* -------- Interactions -------- */
  installInteractions() {
    const canvas = this.canvas;
    let dragging = null;
    let pointerId = null;
    canvas.style.touchAction = 'none';

    const toLogical = (evt) => {
      const rect = canvas.getBoundingClientRect();
      const sx = CANVAS_W / rect.width;
      const sy = CANVAS_H / rect.height;
      return { x: (evt.clientX - rect.left) * sx, y: (evt.clientY - rect.top) * sy };
    };

    let lastTap = { id: null, t: 0 };
    const activatePhoto = (el) => {
      if (el && el.type === 'photo' && this.onPhotoActivate) this.onPhotoActivate(el);
    };

    canvas.addEventListener('pointerdown', (e) => {
      const p = toLogical(e);
      const el = this.hitTest(p.x, p.y);
      pointerId = e.pointerId;
      canvas.setPointerCapture(pointerId);
      if (el) {
        this.select(el.id);
        dragging = { kind: 'move', el, startX: p.x, startY: p.y, ox: el.x, oy: el.y, moved: false };
        // Double-tap detection (works for mouse, pen and touch)
        const now = performance.now();
        if (lastTap.id === el.id && now - lastTap.t < 320) {
          lastTap = { id: null, t: 0 };
          dragging = null;
          activatePhoto(el);
        } else {
          lastTap = { id: el.id, t: now };
        }
      } else {
        this.select(null);
        dragging = null;
        lastTap = { id: null, t: 0 };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) {
        if (e.pointerType === 'mouse') {
          const p = toLogical(e);
          const hit = this.hitTest(p.x, p.y);
          const hoverId = hit && hit.type === 'photo' ? hit.id : null;
          if (hoverId !== this.hoverPhotoId) {
            this.hoverPhotoId = hoverId;
            canvas.style.cursor = hoverId ? 'pointer' : (hit ? 'move' : 'default');
            this.updateHandles();
          }
        }
        return;
      }
      const p = toLogical(e);
      if (dragging.kind === 'move' && !dragging.el.locked) {
        const dx = p.x - dragging.startX, dy = p.y - dragging.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragging.moved = true;
        dragging.el.x = dragging.ox + dx;
        dragging.el.y = dragging.oy + dy;
        this.requestRender();
      }
    });
    canvas.addEventListener('pointerleave', () => {
      if (this.hoverPhotoId) { this.hoverPhotoId = null; canvas.style.cursor = 'default'; this.updateHandles(); }
    });
    const end = () => {
      if (dragging) {
        if (dragging.moved) lastTap = { id: null, t: 0 };
        this.onChange && this.onChange(); dragging = null;
        this.updateHandles();
      }
      if (pointerId != null) { try { canvas.releasePointerCapture(pointerId); } catch {} pointerId = null; }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // Handle events on handles overlay
    this.handles.addEventListener('pointerdown', (e) => {
      const kind = e.target?.dataset?.handle;
      if (!kind) return;
      e.stopPropagation();
      const el = this.getSelected();
      if (!el || el.locked) return;
      pointerId = e.pointerId;
      this.handles.setPointerCapture(pointerId);
      const start = toLogical(e);
      if (kind === 'rot') {
        dragging = { kind: 'rot', el, cx: el.x, cy: el.y, startAng: Math.atan2(start.y - el.y, start.x - el.x), startRot: el.rotation || 0 };
      } else {
        dragging = { kind: 'resize', corner: kind, el, sx: start.x, sy: start.y, w: el.w, h: el.h, ox: el.x, oy: el.y };
      }
    });
    this.handles.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = toLogical(e);
      if (dragging.kind === 'rot') {
        const ang = Math.atan2(p.y - dragging.cy, p.x - dragging.cx);
        const delta = ang - dragging.startAng;
        dragging.el.rotation = dragging.startRot + (delta * 180) / Math.PI;
        this.requestRender();
      } else if (dragging.kind === 'resize') {
        // Compute anchor (opposite corner) fixed
        const el = dragging.el;
        const factorX = dragging.corner.includes('r') ? 1 : -1;
        const factorY = dragging.corner.includes('b') ? 1 : -1;
        const dx = (p.x - dragging.sx) * factorX;
        const dy = (p.y - dragging.sy) * factorY;
        const nw = Math.max(40, dragging.w + dx * 2);
        const nh = Math.max(40, dragging.h + dy * 2);
        el.w = nw; el.h = nh;
        this.requestRender();
      }
    });
    this.handles.addEventListener('pointerup', end);
    this.handles.addEventListener('pointercancel', end);
  }

  hitTest(px, py) {
    const items = [...this.state.elements].sort((a, b) =>
      (LAYER_INDEX[b.layer] - LAYER_INDEX[a.layer]) || (b.zIndex - a.zIndex)
    );
    for (const el of items) {
      if (el.hidden || el.locked) continue;
      if (pointInRotatedRect(px, py, el.x, el.y, el.w, el.h, el.rotation || 0)) return el;
    }
    return null;
  }

  updateHandles() {
    const el = this.getSelected();
    this.handles.innerHTML = '';
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width / CANVAS_W;
    const sy = rect.height / CANVAS_H;
    this.drawPhotoCue(sx, sy, el);
    if (!el) return;

    const cx = el.x * sx, cy = el.y * sy;
    const w = el.w * sx, h = el.h * sy;
    const box = document.createElement('div');
    box.className = 'box';
    box.style.left = (cx - w / 2) + 'px';
    box.style.top = (cy - h / 2) + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    box.style.transformOrigin = 'center center';
    box.style.transform = `rotate(${el.rotation || 0}deg)`;
    this.handles.appendChild(box);

    // corners: relative to box (rotated)
    const corners = [
      { key: 'tl', x: 0, y: 0 },
      { key: 'tr', x: w, y: 0 },
      { key: 'bl', x: 0, y: h },
      { key: 'br', x: w, y: h },
    ];
    for (const c of corners) {
      const dot = document.createElement('div');
      dot.className = 'handle';
      dot.dataset.handle = c.key;
      // Position relative to box (unrotated) then rotate box container
      const boxInner = document.createElement('div');
      // Instead we position dots absolutely on rotated box container:
      dot.style.left = c.x + 'px';
      dot.style.top = c.y + 'px';
      box.appendChild(dot);
      // no-op boxInner
      void boxInner;
    }
    // rotation handle: default above the top-center. If element is near top edge, place below.
    const nearTop = (cy - h / 2) < 40;
    const rot = document.createElement('div');
    rot.className = 'handle rot';
    rot.dataset.handle = 'rot';
    rot.style.left = (w / 2) + 'px';
    rot.style.top = (nearTop ? h + 26 : -26) + 'px';
    box.appendChild(rot);
  }

  // Subtle "double-click to adjust" hint over a hovered or selected polaroid.
  drawPhotoCue(sx, sy, selected) {
    const target = this.state.elements.find(e => e.id === this.hoverPhotoId && e.type === 'photo')
      || (selected && selected.type === 'photo' ? selected : null);
    if (!target || target.hidden) return;
    const cue = document.createElement('div');
    cue.className = 'photo-cue';
    cue.dataset.testid = 'photo-adjust-cue';
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    cue.textContent = coarse ? 'Double-tap to adjust' : 'Double-click to adjust';
    cue.style.left = (target.x * sx) + 'px';
    cue.style.top = (target.y * sy) + 'px';
    this.handles.appendChild(cue);
  }
}

export function defaultAdj() {
  return {
    offsetX: 0, offsetY: 0, zoom: 1, rotation: 0,
    brightness: 1, contrast: 1, saturation: 1,
    warmth: 0, opacity: 1, blur: 0,
    flipX: false, flipY: false, fitMode: 'fill',
  };
}
