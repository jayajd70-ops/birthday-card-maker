// Birthday Card Maker Premium — main app (UI wiring)
import { CardEngine, defaultAdj, LAYER_ORDER, PHOTO_SLOTS, makeInitialState } from './engine.js';
import { THEMES, FONTS, LAYOUTS, CANVAS_W, CANVAS_H } from './themes.js';
import { DECORATIONS, decorationsForTheme } from './data/decorations.js';
import { generateMessage } from './ai.js';
import * as store from './storage.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const canvas = $('#card-canvas');
const handles = $('#handles');
const engine = new CardEngine(canvas, handles);
window.__engine = engine;

let currentTemplateRecord = null;
let autosaveTimer = null;
let lastAiCandidates = [];

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---- Sidebar builders ---- */
function buildThemes() {
  const grid = $('#theme-grid');
  grid.innerHTML = '';
  Object.values(THEMES).forEach(t => {
    if (t.backgroundImage) engine.loadAsset(t.backgroundImage);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-swatch';
    b.dataset.testid = `theme-${t.id}`;
    b.dataset.themeId = t.id;
    b.style.background = t.swatch;
    b.setAttribute('role', 'option');
    b.setAttribute('aria-label', t.label);
    b.innerHTML = `<span>${t.label}</span>`;
    b.addEventListener('click', () => setTheme(t.id));
    grid.appendChild(b);
  });
  refreshThemeActive();
}

function refreshThemeActive() {
  $$('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.themeId === engine.state.themeId);
  });
}

function buildFonts() {
  const list = $('#font-list');
  list.innerHTML = '';
  Object.values(FONTS).forEach(f => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-item';
    b.dataset.testid = `font-${f.id}`;
    b.dataset.fontId = f.id;
    b.innerHTML = `<span>${f.label}</span><span class="preview" style="font-family:${f.family}">Aa</span>`;
    b.addEventListener('click', () => { engine.setState({ fontId: f.id }); refreshFontActive(); });
    list.appendChild(b);
  });
  refreshFontActive();
}

function refreshFontActive() {
  $$('.font-item').forEach(el => el.classList.toggle('active', el.dataset.fontId === engine.state.fontId));
}

function buildLayouts() {
  const list = $('#layout-list');
  list.innerHTML = '';
  Object.values(LAYOUTS).forEach(l => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'layout-item';
    b.dataset.testid = `layout-${l.id}`;
    b.dataset.layoutId = l.id;
    b.textContent = l.label;
    b.addEventListener('click', () => {
      engine.setPhotoLayout(l.id);
      refreshLayoutActive();
      refreshPhotoHelp();
      dismissWelcome();
    });
    list.appendChild(b);
  });
  refreshLayoutActive();
}
function refreshLayoutActive() {
  $$('.layout-item').forEach(el => el.classList.toggle('active', el.dataset.layoutId === engine.state.layout));
}

function refreshPhotoHelp() {
  const collage = engine.state.layout === 'collage';
  const count = engine.state.elements.filter(e => e.type === 'photo').length;
  const addLabel = collage ? 'Add Photos' : (count ? 'Replace Photo' : 'Add Photo');
  $('#photo-input-label').textContent = addLabel;
  $('#stage-add-photo').textContent = addLabel;
  $('#btn-adjust-photo').disabled = count === 0;
  $('#stage-image-settings').disabled = count === 0;
  $('#photo-help').textContent = collage
    ? `${count}/3 photos added. You can select up to three at once.`
    : 'Upload one photo; switching layouts keeps it in the design.';
}

let lastDecoClick = 0;
function buildDecorations() {
  const grid = $('#deco-grid');
  grid.innerHTML = '';
  const compat = decorationsForTheme(engine.state.themeId);
  DECORATIONS.forEach(d => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'deco-item';
    b.dataset.testid = `deco-${d.id}`;
    b.setAttribute('aria-label', d.name);
    b.style.backgroundImage = `url("${d.path}")`;
    if (!compat.includes(d)) { b.setAttribute('disabled', ''); b.title = 'Not recommended for this theme'; }
    b.addEventListener('click', () => {
      const now = performance.now();
      if (now - lastDecoClick < 350) return;
      lastDecoClick = now;
      dismissWelcome();
      engine.addDecoration(d);
    });
    grid.appendChild(b);
  });
}

function setTheme(id) {
  if (THEMES[id]?.backgroundImage) engine.loadAsset(THEMES[id].backgroundImage);
  engine.setState({ themeId: id });
  refreshThemeActive();
  buildDecorations();
  dismissWelcome();
}

/* ---- Text bindings ---- */
function bindText(inputId, key) {
  const el = document.getElementById(inputId);
  el.addEventListener('input', () => {
    engine.state.content[key] = el.value;
    dismissWelcome();
    engine.requestRender();
    scheduleAutosave();
  });
}

function readContentInto(state) {
  state.content.name = $('#in-name').value;
  state.content.age = $('#in-age').value;
  state.content.message = $('#in-message').value;
  state.content.sender = $('#in-sender').value;
  state.content.secondary = $('#in-secondary').value;
}
function pushContentFrom(state) {
  $('#in-name').value = state.content.name || '';
  $('#in-age').value = state.content.age || '';
  $('#in-message').value = state.content.message || '';
  $('#in-sender').value = state.content.sender || '';
  $('#in-secondary').value = state.content.secondary || '';
}

/* ---- Welcome overlay ---- */
function dismissWelcome() {
  $('#welcome').classList.add('hidden');
}

/* ---- Photo upload + adjust modal ---- */
async function handlePhotoUpload(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Please choose an image file'); return; }
  try {
    const id = 'ph_' + Math.random().toString(36).slice(2, 10);
    const url = URL.createObjectURL(file);
    engine.attachPhoto(id, url);
    const photo = engine.addPhoto(id);
    dismissWelcome();
    scheduleAutosave();
    store.savePhotoBlob(id, file).catch(error => console.warn('Photo persistence unavailable', error));
    return photo;
  } catch (e) {
    console.error(e);
    toast('Could not add photo');
  }
}

$('#photo-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  const existing = engine.state.elements.filter(el => el.type === 'photo').length;
  const maxFiles = engine.state.layout === 'collage' ? Math.max(1, 3 - existing) : 1;
  const selected = files.slice(0, maxFiles);
  const added = [];
  for (const file of selected) {
    const photo = await handlePhotoUpload(file);
    if (photo) added.push(photo);
  }
  if (added.length) {
    toast(added.length > 1 ? `${added.length} photos added` : 'Photo added');
    openPhotoAdjust(added[0]);
  }
  refreshPhotoHelp();
  e.target.value = '';
});

function openPhotoPicker() {
  const input = $('#photo-input');
  input.value = '';
  input.click();
}
$('#photo-input-label').addEventListener('click', openPhotoPicker);
$('#stage-add-photo').addEventListener('click', openPhotoPicker);
engine.onEmptyPhotoActivate = openPhotoPicker;

/* ---- Photo adjust workspace ---- */
const PHOTO_SLIDERS = [
  { key: 'offsetX',    label: 'Horizontal Position', min: -200, max: 200, step: 1,  init: 0 },
  { key: 'offsetY',    label: 'Vertical Position',   min: -200, max: 200, step: 1,  init: 0 },
  { key: 'zoom',       label: 'Zoom',                min: 0.5,  max: 3,   step: 0.01, init: 1 },
  { key: 'rotation',   label: 'Rotation',            min: -180, max: 180, step: 1,  init: 0 },
  { key: 'brightness', label: 'Brightness',          min: 0.3,  max: 2,   step: 0.01, init: 1 },
  { key: 'contrast',   label: 'Contrast',            min: 0.3,  max: 2,   step: 0.01, init: 1 },
  { key: 'saturation', label: 'Saturation',          min: 0,    max: 2,   step: 0.01, init: 1 },
  { key: 'warmth',     label: 'Warmth',              min: 0,    max: 1,   step: 0.01, init: 0 },
  { key: 'opacity',    label: 'Opacity',             min: 0.2,  max: 1,   step: 0.01, init: 1 },
  { key: 'blur',       label: 'Blur',                min: 0,    max: 20,  step: 0.5, init: 0 },
];

function buildPhotoControls(target) {
  const wrap = $('#photo-controls');
  wrap.innerHTML = '';
  const crop = document.createElement('div');
  crop.className = 'crop-tools';
  crop.innerHTML = `
    <div class="crop-copy"><strong>Crop & position</strong><span>Drag the crop preview to choose what stays inside the card frame.</span></div>
    <div class="crop-buttons">
      <button type="button" class="btn" data-testid="adj-crop-left">Focus Left</button>
      <button type="button" class="btn" data-testid="adj-crop-center">Focus Centre</button>
      <button type="button" class="btn" data-testid="adj-crop-right">Focus Right</button>
      <button type="button" class="btn" data-testid="adj-show-full">Show Full Photo</button>
      <button type="button" class="btn" data-testid="adj-crop-frame">Crop to Frame</button>
      <button type="button" class="btn ghost" data-testid="adj-reset-crop">Reset Crop</button>
    </div>
  `;
  wrap.appendChild(crop);
  const updateCrop = (patch, rebuild = false) => {
    target.adj = { ...(target.adj || defaultAdj()), ...patch };
    engine.requestRender();
    if (rebuild) buildPhotoControls(target);
    drawPhotoPreviews(target);
    scheduleAutosave();
  };
  crop.querySelector('[data-testid=adj-crop-left]').onclick = () => updateCrop({ fitMode: 'fill', offsetX: 90, offsetY: 0 });
  crop.querySelector('[data-testid=adj-crop-center]').onclick = () => updateCrop({ fitMode: 'fill', offsetX: 0, offsetY: 0 });
  crop.querySelector('[data-testid=adj-crop-right]').onclick = () => updateCrop({ fitMode: 'fill', offsetX: -90, offsetY: 0 });
  crop.querySelector('[data-testid=adj-show-full]').onclick = () => updateCrop({ fitMode: 'fit', offsetX: 0, offsetY: 0 }, true);
  crop.querySelector('[data-testid=adj-crop-frame]').onclick = () => updateCrop({ fitMode: 'fill' }, true);
  crop.querySelector('[data-testid=adj-reset-crop]').onclick = () => updateCrop({ offsetX: 0, offsetY: 0, zoom: 1, rotation: 0, fitMode: 'fill' }, true);
  PHOTO_SLIDERS.forEach(s => {
    const c = document.createElement('div');
    c.className = 'ctrl';
    c.innerHTML = `<label for="adj-${s.key}">${s.label}</label>
      <input id="adj-${s.key}" type="range" min="${s.min}" max="${s.max}" step="${s.step}"
        aria-label="${s.label}" data-testid="adj-${s.key}" />`;
    wrap.appendChild(c);
    const inp = c.querySelector('input');
    inp.value = target.adj?.[s.key] ?? s.init;
    inp.addEventListener('input', () => {
      target.adj = { ...(target.adj || defaultAdj()), [s.key]: parseFloat(inp.value) };
      engine.requestRender();
      drawPhotoPreviews(target);
      scheduleAutosave();
    });
  });
  // flip + fit buttons
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  row.innerHTML = `
    <button type="button" class="btn" data-testid="adj-flip-x">Flip Horizontal</button>
    <button type="button" class="btn" data-testid="adj-flip-y">Flip Vertical</button>
    <button type="button" class="btn" data-testid="adj-fit">Fit</button>
    <button type="button" class="btn" data-testid="adj-fill">Fill</button>
    <button type="button" class="btn ghost" data-testid="adj-reset">Reset</button>
  `;
  wrap.appendChild(row);
  row.querySelector('[data-testid=adj-flip-x]').addEventListener('click', () => { target.adj.flipX = !target.adj.flipX; engine.requestRender(); drawPhotoPreviews(target); });
  row.querySelector('[data-testid=adj-flip-y]').addEventListener('click', () => { target.adj.flipY = !target.adj.flipY; engine.requestRender(); drawPhotoPreviews(target); });
  row.querySelector('[data-testid=adj-fit]').addEventListener('click', () => { target.adj.fitMode = 'fit'; engine.requestRender(); drawPhotoPreviews(target); });
  row.querySelector('[data-testid=adj-fill]').addEventListener('click', () => { target.adj.fitMode = 'fill'; engine.requestRender(); drawPhotoPreviews(target); });
  row.querySelector('[data-testid=adj-reset]').addEventListener('click', () => {
    target.adj = defaultAdj();
    buildPhotoControls(target); engine.requestRender(); drawPhotoPreviews(target);
  });
}

function drawPhotoPreviews(el) {
  const orig = $('#preview-original').getContext('2d');
  const adj  = $('#preview-adjusted').getContext('2d');
  [orig, adj].forEach(c => { c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,360,360); c.fillStyle='#0f0c0a'; c.fillRect(0,0,360,360); });
  const img = engine.photoCache.get(el.photoId);
  if (!img || !img.complete) return;
  // original: contain-fit
  const s1 = Math.min(360 / img.naturalWidth, 360 / img.naturalHeight);
  orig.drawImage(img, (360 - img.naturalWidth*s1)/2, (360 - img.naturalHeight*s1)/2, img.naturalWidth*s1, img.naturalHeight*s1);
  // adjusted: preview via a temp element rendering
  const a = el.adj || defaultAdj();
  adj.save();
  adj.translate(180, 180);
  adj.filter = `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturation}) sepia(${a.warmth}) blur(${a.blur}px)`;
  adj.globalAlpha = a.opacity;
  const scale = a.zoom * (a.fitMode === 'fill'
    ? Math.max(360 / img.naturalWidth, 360 / img.naturalHeight)
    : Math.min(360 / img.naturalWidth, 360 / img.naturalHeight));
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  adj.translate(a.offsetX || 0, a.offsetY || 0);
  adj.rotate((a.rotation || 0) * Math.PI / 180);
  adj.scale(a.flipX ? -1 : 1, a.flipY ? -1 : 1);
  adj.drawImage(img, -dw/2, -dh/2, dw, dh);
  adj.restore();
  // The guide matches the card's actual circular or rectangular photo frame.
  adj.save();
  adj.strokeStyle = 'rgba(230,201,138,.92)'; adj.lineWidth = 4;
  adj.setLineDash([8, 6]);
  if (el.shape === 'circle') {
    adj.beginPath(); adj.arc(180, 180, 155, 0, Math.PI * 2); adj.stroke();
  } else {
    adj.strokeRect(28, 28, 304, 304);
  }
  adj.restore();
}

function installCropDrag(target) {
  const canvas = $('#preview-adjusted');
  let drag = null;
  canvas.onpointerdown = (event) => {
    const rect = canvas.getBoundingClientRect();
    drag = { x: event.clientX, y: event.clientY, scale: 360 / rect.width };
    canvas.setPointerCapture(event.pointerId);
  };
  canvas.onpointermove = (event) => {
    if (!drag) return;
    const dx = (event.clientX - drag.x) * drag.scale;
    const dy = (event.clientY - drag.y) * drag.scale;
    drag.x = event.clientX; drag.y = event.clientY;
    target.adj = { ...(target.adj || defaultAdj()), fitMode: 'fill', offsetX: Math.max(-200, Math.min(200, (target.adj?.offsetX || 0) + dx)), offsetY: Math.max(-200, Math.min(200, (target.adj?.offsetY || 0) + dy)) };
    engine.requestRender(); drawPhotoPreviews(target); scheduleAutosave();
  };
  const finish = () => { drag = null; };
  canvas.onpointerup = finish;
  canvas.onpointercancel = finish;
  canvas.onwheel = (event) => {
    event.preventDefault();
    const zoom = (target.adj?.zoom || 1) * (event.deltaY < 0 ? 1.08 : .92);
    target.adj = { ...(target.adj || defaultAdj()), fitMode: 'fill', zoom: Math.max(.5, Math.min(3, zoom)) };
    engine.requestRender(); drawPhotoPreviews(target); scheduleAutosave();
  };
}

function openPhotoAdjust(el) {
  engine.select(el.id);
  buildPhotoControls(el);
  drawPhotoPreviews(el);
  installCropDrag(el);
  const m = $('#modal-photo'); m.hidden = false; m.setAttribute('aria-hidden','false');
}

$('#btn-adjust-photo').addEventListener('click', () => {
  const el = engine.state.elements.find(e => e.type === 'photo' && (e.id === engine.state.selectedId)) ||
             engine.state.elements.find(e => e.type === 'photo');
  if (!el) { toast('Add a photo first'); return; }
  openPhotoAdjust(el);
});
$('#stage-image-settings').addEventListener('click', () => $('#btn-adjust-photo').click());
engine.onPhotoActivate = openPhotoAdjust;
$('#photo-close').addEventListener('click', () => {
  const m = $('#modal-photo'); m.hidden = true; m.setAttribute('aria-hidden','true');
});

/* ---- AI ---- */
function renderAiCandidates(cands) {
  const box = $('#ai-results');
  box.innerHTML = '';
  cands.forEach((text, i) => {
    const card = document.createElement('div');
    card.className = 'ai-card';
    card.dataset.testid = `ai-card-${i}`;
    card.innerHTML = `<div class="text">${text}</div>
      <div class="actions">
        <button type="button" class="btn" data-testid="ai-use-${i}">Use This</button>
        <button type="button" class="btn ghost" data-testid="ai-edit-${i}">Edit</button>
      </div>`;
    card.querySelector(`[data-testid=ai-use-${i}]`).addEventListener('click', () => {
      $('#in-message').value = text;
      engine.state.content.message = text;
      engine.requestRender();
      toast('Message applied');
      scheduleAutosave();
    });
    card.querySelector(`[data-testid=ai-edit-${i}]`).addEventListener('click', () => {
      const ta = $('#in-message');
      ta.value = text; ta.focus();
      engine.state.content.message = text; engine.requestRender();
    });
    box.appendChild(card);
  });
}

$('#ai-generate').addEventListener('click', () => {
  const mood = $('#ai-mood').value;
  const cands = generateMessage({ mood, name: $('#in-name').value, age: $('#in-age').value, sender: $('#in-sender').value });
  lastAiCandidates = cands;
  renderAiCandidates(cands);
});
$('#ai-regenerate').addEventListener('click', () => {
  const mood = $('#ai-mood').value;
  const cands = generateMessage({ mood, name: $('#in-name').value, age: $('#in-age').value, sender: $('#in-sender').value });
  lastAiCandidates = cands;
  renderAiCandidates(cands);
});

/* ---- Inspector ---- */
function renderInspector() {
  const el = engine.getSelected();
  const box = $('#selected-inspector');
  if (!el) { box.innerHTML = `<div class="empty">Select an element on the card to edit its properties.</div>`; return; }
  box.innerHTML = `
    ${el.type === 'photo' ? '<button class="btn primary block" data-testid="sel-image-settings" type="button">Image Settings</button>' : ''}
    <div class="row">
      <button class="btn" data-testid="sel-forward" type="button">Forward</button>
      <button class="btn" data-testid="sel-back" type="button">Back</button>
      <button class="btn" data-testid="sel-duplicate" type="button">Duplicate</button>
      <button class="btn ghost" data-testid="sel-delete" type="button">Delete</button>
    </div>
    <div class="slider"><label>Opacity <span>${(el.opacity ?? 1).toFixed(2)}</span></label>
      <input type="range" min="0.1" max="1" step="0.01" value="${el.opacity ?? 1}" data-testid="sel-opacity" aria-label="Opacity" />
    </div>
    <div class="slider"><label>Rotation <span>${Math.round(el.rotation||0)}°</span></label>
      <input type="range" min="-180" max="180" step="1" value="${el.rotation || 0}" data-testid="sel-rotation" aria-label="Rotation" />
    </div>
    <div class="grid2">
      <label class="field"><span>Width</span><input type="number" min="40" value="${Math.round(el.w)}" data-testid="sel-w"/></label>
      <label class="field"><span>Height</span><input type="number" min="40" value="${Math.round(el.h)}" data-testid="sel-h"/></label>
    </div>
    <div class="row">
      <button class="btn" data-testid="sel-lock" type="button">${el.locked ? 'Unlock' : 'Lock'}</button>
      <button class="btn" data-testid="sel-visibility" type="button">${el.hidden ? 'Show' : 'Hide'}</button>
    </div>
  `;
  box.querySelector('[data-testid=sel-forward]').onclick = () => engine.bringForward(1);
  const imageSettings = box.querySelector('[data-testid=sel-image-settings]');
  if (imageSettings) imageSettings.onclick = () => openPhotoAdjust(el);
  box.querySelector('[data-testid=sel-back]').onclick = () => engine.bringForward(-1);
  box.querySelector('[data-testid=sel-duplicate]').onclick = () => engine.duplicateSelected();
  box.querySelector('[data-testid=sel-delete]').onclick = () => engine.removeSelected();
  box.querySelector('[data-testid=sel-opacity]').oninput = (e) => engine.setSelectedProp({ opacity: parseFloat(e.target.value) });
  box.querySelector('[data-testid=sel-rotation]').oninput = (e) => engine.setSelectedProp({ rotation: parseFloat(e.target.value) });
  box.querySelector('[data-testid=sel-w]').oninput = (e) => engine.setSelectedProp({ w: Math.max(40, parseFloat(e.target.value) || 40) });
  box.querySelector('[data-testid=sel-h]').oninput = (e) => engine.setSelectedProp({ h: Math.max(40, parseFloat(e.target.value) || 40) });
  box.querySelector('[data-testid=sel-lock]').onclick = () => { engine.setSelectedProp({ locked: !el.locked }); renderInspector(); };
  box.querySelector('[data-testid=sel-visibility]').onclick = () => { engine.setSelectedProp({ hidden: !el.hidden }); renderInspector(); };
}

engine.onSelect = () => renderInspector();
engine.onChange = () => { scheduleAutosave(); refreshPhotoHelp(); };

/* ---- Save / Open / Templates ---- */
function stateSnapshot(id, name) {
  readContentInto(engine.state);
  return {
    id, name,
    createdAt: currentTemplateRecord?.createdAt || Date.now(),
    updatedAt: Date.now(),
    editor: JSON.parse(JSON.stringify(engine.state)),
  };
}

async function saveCurrent() {
  const id = currentTemplateRecord?.id || ('t_' + Math.random().toString(36).slice(2,10));
  const name = currentTemplateRecord?.name || `Card — ${new Date().toLocaleString()}`;
  const rec = stateSnapshot(id, name);
  await store.saveTemplate(rec);
  currentTemplateRecord = rec;
  toast('Saved');
}
async function saveAs() {
  const name = prompt('Save As — template name:', `Card — ${new Date().toLocaleString()}`);
  if (!name) return;
  const id = 't_' + Math.random().toString(36).slice(2,10);
  const rec = stateSnapshot(id, name);
  rec.createdAt = Date.now();
  await store.saveTemplate(rec);
  currentTemplateRecord = rec;
  toast('Saved As "' + name + '"');
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    if (currentTemplateRecord) {
      const rec = stateSnapshot(currentTemplateRecord.id, currentTemplateRecord.name);
      try { await store.saveTemplate(rec); currentTemplateRecord = rec; } catch {}
    }
  }, 1500);
}

async function openTemplate(id) {
  const rec = await store.getTemplate(id);
  if (!rec) { toast('Template not found'); return; }
  currentTemplateRecord = rec;
  engine.state = rec.editor;
  engine.state.composition ||= {};
  engine.state.elements ||= [];
  engine.state.nextZ ||= 100;
  // rehydrate photo blob(s)
  const photoIds = new Set();
  (engine.state.elements || []).forEach(e => { if (e.type === 'photo' && e.photoId) photoIds.add(e.photoId); });
  if (engine.state.photo?.id) photoIds.add(engine.state.photo.id);
  for (const pid of photoIds) {
    try {
      const blob = await store.getPhotoBlob(pid);
      if (blob) engine.attachPhoto(pid, URL.createObjectURL(blob));
    } catch {}
  }
  (engine.state.elements || []).forEach(e => { if (e.path) engine.loadAsset(e.path); });
  refreshThemeActive(); refreshFontActive(); refreshLayoutActive();
  buildDecorations();
  pushContentFrom(engine.state);
  dismissWelcome();
  engine.requestRender();
  toast('Opened "' + rec.name + '"');
}

async function renderTemplateList() {
  const list = $('#tpl-list');
  const recs = await store.listTemplates();
  if (!recs.length) { list.innerHTML = `<div class="empty" style="color:var(--muted);padding:12px">No saved templates yet.</div>`; return; }
  list.innerHTML = '';
  recs.forEach(r => {
    const row = document.createElement('div');
    row.className = 'tpl-item';
    row.innerHTML = `<div class="name">${r.name}</div>
      <div class="meta">${new Date(r.updatedAt).toLocaleString()}</div>
      <div class="row">
        <button class="btn" data-a="open" data-testid="tpl-open-${r.id}">Open</button>
        <button class="btn" data-a="dup"  data-testid="tpl-dup-${r.id}">Duplicate</button>
        <button class="btn ghost" data-a="del" data-testid="tpl-del-${r.id}">Delete</button>
      </div>`;
    row.querySelector('[data-a=open]').onclick = () => { closeTpl(); openTemplate(r.id); };
    row.querySelector('[data-a=dup]').onclick  = async () => {
      const copy = { ...r, id: 't_' + Math.random().toString(36).slice(2,10), name: r.name + ' (copy)', createdAt: Date.now(), updatedAt: Date.now() };
      await store.saveTemplate(copy);
      renderTemplateList();
      toast('Duplicated');
    };
    row.querySelector('[data-a=del]').onclick  = async () => {
      if (!confirm('Delete "' + r.name + '"?')) return;
      await store.deleteTemplate(r.id);
      renderTemplateList();
      toast('Deleted');
    };
    list.appendChild(row);
  });
}
function closeTpl() { const m = $('#modal-templates'); m.hidden = true; m.setAttribute('aria-hidden','true'); }

$('#btn-save').addEventListener('click', saveCurrent);
$('#btn-save-as').addEventListener('click', saveAs);
$('#btn-templates').addEventListener('click', async () => {
  await renderTemplateList();
  const m = $('#modal-templates'); m.hidden = false; m.setAttribute('aria-hidden','false');
});
$('#tpl-close').addEventListener('click', closeTpl);

/* ---- Export / Share ---- */
async function renderToBlob(mime = 'image/png', quality, W = 2000, H = 2800) {
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  engine.render(octx, W, H);
  return new Promise(res => off.toBlob(res, mime, quality));
}

const MIME_FOR = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const Q_FOR    = { png: undefined,   jpg: 0.95,         webp: 0.92 };
function fmtBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  if (n >= 1024)        return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

// Estimate export size by rendering a smaller sample and extrapolating.
async function estimateSize(fmt) {
  const SW = 500, SH = 700;
  const blob = await renderToBlob(MIME_FOR[fmt], Q_FOR[fmt], SW, SH);
  if (!blob) return NaN;
  // Roughly scale by pixel count ratio (2000x2800 vs 500x700 => 16x)
  const ratio = fmt === 'png' ? 14 : fmt === 'jpg' ? 9 : 11; // empirical: PNG compresses less well when scaled 4x
  return Math.round(blob.size * ratio);
}

async function exportCard(format = 'png') {
  toast('Rendering high-resolution export…');
  try {
    const blob = await renderToBlob(MIME_FOR[format], Q_FOR[format]);
    const name = ($('#in-name').value || 'Card').replace(/[^\w\-]+/g, '_') || 'Card';
    const filename = `Happy-Birthday-${name}.${format === 'jpg' ? 'jpg' : format}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Exported ' + filename);
  } catch (e) {
    console.error(e); toast('Export failed');
  }
}

// Format picker popover
const exportPopover = $('#export-popover');
const btnExport    = $('#btn-export');
let sizeEstimateSeq = 0;

async function refreshSizeEstimates() {
  const seq = ++sizeEstimateSeq;
  ['png','jpg','webp'].forEach(f => { const el = $(`[data-testid=ep-size-${f}]`); if (el) el.textContent = '…'; });
  for (const f of ['png','jpg','webp']) {
    try {
      const bytes = await estimateSize(f);
      if (seq !== sizeEstimateSeq) return;
      const el = $(`[data-testid=ep-size-${f}]`);
      if (el) el.textContent = '~' + fmtBytes(bytes);
    } catch { /* ignore */ }
  }
}

function openExportPopover() {
  exportPopover.hidden = false;
  refreshSizeEstimates();
}
function closeExportPopover() { exportPopover.hidden = true; }

btnExport.addEventListener('click', () => {
  if (exportPopover.hidden) openExportPopover(); else closeExportPopover();
});
$('#ep-close').addEventListener('click', closeExportPopover);
$('#ep-download').addEventListener('click', () => {
  const fmt = document.querySelector('input[name=ep-fmt]:checked')?.value || 'png';
  closeExportPopover();
  exportCard(fmt);
});
document.addEventListener('pointerdown', (e) => {
  if (exportPopover.hidden) return;
  if (exportPopover.contains(e.target) || btnExport.contains(e.target)) return;
  closeExportPopover();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !exportPopover.hidden) closeExportPopover();
});

async function shareCard() {
  try {
    const blob = await renderToBlob('image/png');
    const name = ($('#in-name').value || 'Card').replace(/[^\w\-]+/g, '_');
    const file = new File([blob], `Happy-Birthday-${name}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Birthday Card', text: 'A birthday card I made for you' });
      toast('Shared');
      return;
    }
    // Copy image fallback
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Copied image to clipboard');
        return;
      } catch {}
    }
    // Download fallback
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Downloaded (share not available)');
  } catch (e) { console.error(e); toast('Share failed'); }
}
$('#btn-share').addEventListener('click', shareCard);

/* ---- Bindings ---- */
bindText('in-name', 'name');
bindText('in-age', 'age');
bindText('in-message', 'message');
bindText('in-sender', 'sender');
bindText('in-secondary', 'secondary');

/* ---- Welcome start ---- */
$('#btn-start').addEventListener('click', () => {
  dismissWelcome();
  // Add a subtle default decoration to invite editing
  const dec = decorationsForTheme(engine.state.themeId)[0];
  if (dec) engine.addDecoration(dec);
  toast('Welcome — start designing');
});

/* ---- Keyboard shortcuts ---- */
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea,select')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { engine.removeSelected(); e.preventDefault(); }
  if (e.key === 'd' && (e.metaKey || e.ctrlKey)) { engine.duplicateSelected(); e.preventDefault(); }
});

/* ---- Card Presets ---- */
const PRESETS = [
  {
    id: 'p-elegant-gold', label: 'Elegant Gold', day: 'Monday',
    themeId: 'elegant-gold', fontId: 'script', layout: 'center-focus',
    content: { name: '', age: '', message: 'Wishing you a day filled with love, happiness and all the beautiful moments you deserve.', sender: '', secondary: '' },
    composition: {
      photoShape: 'circle', photoSlot: { x: 250, y: 250, w: 206, h: 206, rotation: 0 },
      titleX: 215, titleWidth: 330, titleSize: 53, bodySize: 18, senderSize: 23,
      text: { nameY: 382, bodyY: 428, bodyBottom: 520, footerY: 555 },
    },
    elements: [],
  },
  {
    id: 'p-romantic-pink', label: 'Romantic Pink', day: 'Tuesday',
    themeId: 'romantic-pink', fontId: 'script', layout: 'left-aligned',
    content: { name: '', age: '', message: 'May your special day be as beautiful, kind and amazing as you are. Stay happy, stay blessed, keep shining!', sender: '', secondary: '' },
    composition: {
      titleSize: 57, bodySize: 17,
      photoSlot: { x: 142, y: 286, w: 194, h: 232, rotation: -2 },
      text: { x: 135, width: 180, align: 'center', nameY: 425, bodyY: 470, bodyBottom: 580, footerY: 620 },
    },
    elements: [],
  },
  {
    id: 'p-celebration-blue', label: 'Celebration Blue', day: 'Wednesday',
    themeId: 'celebration-blue', fontId: 'bold', layout: 'center-focus',
    content: { name: '', age: '', message: 'Wishing you success, happiness, good health and countless joyful moments today and always!', sender: '', secondary: '' },
    composition: {
      titleLines: [
        { text: 'HAPPY', fontId: 'bold', size: 25, advance: 25 },
        { text: 'Birthday', fontId: 'script', size: 54, weight: '600' },
      ],
      bodyFont: "'Nunito',system-ui,sans-serif", bodySize: 16,
      photoShape: 'circle', photoSlot: { x: 250, y: 245, w: 188, h: 188 },
      text: { x: 250, width: 230, align: 'center', nameY: 355, bodyY: 395, bodyBottom: 465, footerWidth: 230, footerY: 480 },
    },
    elements: [],
  },
  {
    id: 'p-fresh-natural', label: 'Fresh & Natural', day: 'Thursday',
    themeId: 'fresh-natural', fontId: 'hand', layout: 'right-aligned',
    content: { name: '', age: '', message: 'May this new year of your life bring you fresh opportunities, brighter days and everything your heart desires.', sender: '', secondary: '' },
    composition: { titleSize: 54, bodyFont: "'Cormorant Garamond',Georgia,serif", bodySize: 18, text: { footerY: 500 } },
    elements: [],
  },
  {
    id: 'p-sunshine-yellow', label: 'Sunshine Joy', day: 'Friday',
    themeId: 'sunshine-yellow', fontId: 'hand', layout: 'left-aligned',
    content: { name: '', age: '', message: 'May your birthday glow with happiness, laughter and bright new memories from sunrise to sunset.', sender: '', secondary: '' },
    composition: {
      titleSize: 55, bodyFont: "'Cormorant Garamond',Georgia,serif", bodySize: 18,
      photoSlot: { x: 142, y: 292, w: 196, h: 242, rotation: -2 },
      text: { x: 278, width: 168, align: 'left', nameY: 174, bodyY: 230, bodyBottom: 390, footerX: 250, footerWidth: 210, footerAlign: 'center', footerY: 470 },
    },
    elements: [],
  },
  {
    id: 'p-lavender-dream', label: 'Lavender Dream', day: 'Saturday',
    themeId: 'lavender-dream', fontId: 'script', layout: 'center-focus',
    content: { name: '', age: '', message: 'Wishing you a beautiful birthday filled with peaceful moments, sweet surprises and dreams coming true.', sender: '', secondary: '' },
    composition: {
      titleSize: 56, bodySize: 18, photoShape: 'circle',
      photoSlot: { x: 250, y: 245, w: 190, h: 190 },
      text: { x: 270, width: 210, align: 'center', nameY: 352, bodyY: 400, bodyBottom: 490, footerX: 270, footerWidth: 200, footerAlign: 'center', footerY: 525 },
    },
    elements: [],
  },
  {
    id: 'p-midnight-silver', label: 'Midnight Silver', day: 'Sunday',
    themeId: 'midnight-silver', fontId: 'bold', layout: 'right-aligned',
    content: { name: '', age: '', message: 'Here’s to a brilliant birthday and a year filled with bold dreams, memorable nights and shining success.', sender: '', secondary: '' },
    composition: {
      titleSize: 42, bodyFont: "'Nunito',system-ui,sans-serif", bodySize: 16,
      photoSlot: { x: 362, y: 292, w: 194, h: 240, rotation: 2 },
      text: { x: 220, width: 170, align: 'right', nameY: 168, bodyY: 225, bodyBottom: 375, footerY: 440 },
    },
    elements: [],
  },
];

function composePresetState(preset) {
  const st = makeInitialState();
  st.themeId = preset.themeId; st.fontId = preset.fontId; st.layout = preset.layout;
  st.composition = JSON.parse(JSON.stringify(preset.composition || {}));
  st.content = { ...st.content, ...(preset.content || preset.previewContent || {}) };
  const live = engine.state;
  engine.state = st;
  try {
    if (preset.elements) {
      st.elements = preset.elements.map(e => ({ ...e, id: 'e_' + Math.random().toString(36).slice(2, 9), zIndex: st.nextZ++ }));
      st.elements.forEach(e => { if (e.path) engine.loadAsset(e.path); });
    } else {
      (preset.decorations || []).forEach(id => {
        const dec = DECORATIONS.find(d => d.id === id);
        if (dec) st.elements.push(engine.makeDecorationElement(dec));
      });
    }
  } finally { engine.state = live; }
  return st;
}

function applyPreset(preset) {
  const photos = engine.state.elements.filter(e => e.type === 'photo').map(e => ({ ...e, adj: { ...(e.adj || defaultAdj()) } }));
  const st = composePresetState(preset);
  if (preset.custom) { readContentInto(engine.state); st.content = { ...engine.state.content }; }
  engine.state = st;
  const slots = preset.layout === 'collage' ? photos.slice(0, 3) : photos.slice(0, 1);
  slots.forEach((photo, index) => {
    photo.zIndex = st.nextZ++;
    engine.applyPhotoSlot(photo, PHOTO_SLOTS[preset.layout][index], index);
    st.elements.push(photo);
  });
  pushContentFrom(engine.state);
  refreshThemeActive(); refreshFontActive(); refreshLayoutActive();
  buildDecorations();
  refreshPhotoHelp();
  engine.select(null);
  dismissWelcome();
  currentTemplateRecord = null;
  engine.requestRender();
  toast(`Applied preset "${preset.label}"`);
}

const THUMB_W = 200, THUMB_H = 280;
async function drawPresetThumb(preset, canvasEl) {
  const st = composePresetState(preset);
  const ctx = canvasEl.getContext('2d');
  engine.renderState(st, ctx, THUMB_W, THUMB_H);
  const paths = st.elements.filter(e => e.path).map(e => e.path);
  const background = THEMES[st.themeId]?.backgroundImage;
  if (background) paths.push(background);
  await engine.assetsReady(paths);
  if (document.fonts?.ready) await document.fonts.ready;
  engine.renderState(st, ctx, THUMB_W, THUMB_H);
}

function presetTile(p) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'preset-item' + (p.custom ? ' custom' : '') + (p.pinned ? ' pinned' : '');
  b.dataset.testid = `preset-${p.id}`;
  b.dataset.presetId = p.id;
  b.setAttribute('aria-label', `Preset ${p.label}${p.pinned ? ' (pinned)' : ''}`);
  b.title = p.label;
  const c = document.createElement('canvas');
  c.className = 'thumb'; c.width = THUMB_W; c.height = THUMB_H;
  c.dataset.testid = `preset-thumb-${p.id}`;
  b.appendChild(c);
  const lbl = document.createElement('div');
  lbl.className = 'lbl'; lbl.textContent = p.label;
  b.appendChild(lbl);
  if (p.day) {
    const day = document.createElement('div');
    day.className = 'day'; day.textContent = p.day;
    b.appendChild(day);
  }
  if (p.custom) {
    b.draggable = true;
    b.addEventListener('dragstart', (e) => onPresetDragStart(e, p));
    b.addEventListener('dragend',   onPresetDragEnd);
    b.addEventListener('dragover',  (e) => onPresetDragOver(e, b));
    b.addEventListener('dragleave', () => b.classList.remove('drop-before','drop-after'));
    b.addEventListener('drop',      (e) => onPresetDrop(e, p));

    const pin = document.createElement('span');
    pin.className = 'pin' + (p.pinned ? ' on' : '');
    pin.textContent = p.pinned ? '★' : '☆';
    pin.setAttribute('role', 'button');
    pin.setAttribute('aria-label', p.pinned ? `Unpin preset ${p.label}` : `Pin preset ${p.label}`);
    pin.title = p.pinned ? 'Unpin' : 'Pin to top';
    pin.dataset.testid = `preset-pin-${p.id}`;
    pin.addEventListener('click', async (e) => {
      e.stopPropagation();
      await togglePresetPin(p);
      await buildPresets();
      toast(p.pinned ? 'Preset unpinned' : 'Preset pinned to top');
    });
    b.appendChild(pin);

    const del = document.createElement('span');
    del.className = 'del'; del.textContent = '✕';
    del.setAttribute('role', 'button'); del.setAttribute('aria-label', `Delete preset ${p.label}`);
    del.dataset.testid = `preset-delete-${p.id}`;
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete preset "${p.label}"?`)) return;
      await store.deletePreset(p.id);
      buildPresets();
      toast('Preset deleted');
    });
    b.appendChild(del);
  }
  b.addEventListener('click', () => applyPreset(p));
  drawPresetThumb(p, c);
  return b;
}

async function togglePresetPin(preset) {
  // Toggle in place. Sorting handles keeping pinned above unpinned.
  const updated = { ...preset, pinned: !preset.pinned };
  // Give pinned a small order so it lands at the top of the pinned group.
  if (updated.pinned) {
    const list = await store.listPresets();
    const pinnedOrders = list.filter(p => p.pinned && p.id !== preset.id).map(p => p.order ?? 0);
    updated.order = (pinnedOrders.length ? Math.min(...pinnedOrders) : 10) - 10;
  }
  await store.savePreset(updated);
}

/* ---- Preset drag & drop reorder (custom presets only) ---- */
let dragPreset = null;
function onPresetDragStart(e, p) {
  dragPreset = p;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', p.id); } catch {}
  e.currentTarget.classList.add('dragging');
}
function onPresetDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  $$('.preset-item').forEach(el => el.classList.remove('drop-before','drop-after'));
  dragPreset = null;
}
function onPresetDragOver(e, tile) {
  if (!dragPreset) return;
  const targetId = tile.dataset.presetId;
  if (targetId === dragPreset.id) return;
  // Only reorder among custom tiles
  if (!tile.classList.contains('custom')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const rect = tile.getBoundingClientRect();
  const before = (e.clientX - rect.left) < rect.width / 2;
  tile.classList.toggle('drop-before', before);
  tile.classList.toggle('drop-after', !before);
}
async function onPresetDrop(e, targetPreset) {
  if (!dragPreset || dragPreset.id === targetPreset.id) return;
  e.preventDefault();
  const tile = e.currentTarget;
  const rect = tile.getBoundingClientRect();
  const before = (e.clientX - rect.left) < rect.width / 2;
  await reorderCustomPreset(dragPreset.id, targetPreset.id, before);
  await buildPresets();
  toast('Preset reordered');
}

async function reorderCustomPreset(sourceId, targetId, insertBefore) {
  const list = await store.listPresets();
  const idx = list.findIndex(p => p.id === sourceId);
  if (idx < 0) return;
  const [src] = list.splice(idx, 1);
  const tIdx = list.findIndex(p => p.id === targetId);
  if (tIdx < 0) { list.push(src); }
  else list.splice(insertBefore ? tIdx : tIdx + 1, 0, src);
  // Persist order via monotonic `order` field.
  await Promise.all(list.map((p, i) => store.savePreset({ ...p, order: (i + 1) * 10 })));
}

async function buildPresets() {
  const list = $('#preset-list');
  list.innerHTML = '';
  PRESETS.forEach(p => list.appendChild(presetTile(p)));
  let custom = [];
  try { custom = await store.listPresets(); } catch {}
  custom.forEach(p => list.appendChild(presetTile(p)));
}

async function saveAsPreset() {
  const decos = engine.state.elements.filter(e => e.type !== 'photo');
  if (!decos.length) { toast('Add at least one decoration first'); return; }
  const label = prompt('Preset name:', 'My Preset');
  if (!label || !label.trim()) return;
  readContentInto(engine.state);
  const existing = await store.listPresets().catch(() => []);
  const maxOrder = existing.reduce((m, p) => Math.max(m, p.order ?? 0), 0);
  const rec = {
    id: 'cp_' + Math.random().toString(36).slice(2, 10),
    label: label.trim(), custom: true, createdAt: Date.now(),
    order: maxOrder + 10,
    themeId: engine.state.themeId, fontId: engine.state.fontId, layout: engine.state.layout,
    composition: JSON.parse(JSON.stringify(engine.state.composition || {})),
    elements: decos.map(({ id, ...rest }) => JSON.parse(JSON.stringify(rest))),
    previewContent: { ...engine.state.content },
  };
  await store.savePreset(rec);
  await buildPresets();
  toast(`Preset "${rec.label}" saved`);
}
$('#btn-save-preset').addEventListener('click', saveAsPreset);

/* ---- Init ---- */
buildThemes();
buildFonts();
buildLayouts();
buildDecorations();
buildPresets();
renderInspector();
refreshPhotoHelp();
engine.requestRender();

/* ---- PWA ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
