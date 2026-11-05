/* =========================================================================
   PDF Workspace — 100% client-side. pdf-lib mutates/exports documents,
   pdf.js renders thumbnails & previews. Nothing is uploaded, ever.

   Libraries are pulled as ESM from jsdelivr. The pdf.js worker MUST match the
   library version exactly — both are pinned to the same PDFJS_VERSION below.
   ========================================================================= */

const PDFJS_VERSION = '6.1.200';
const PDFLIB_VERSION = '1.17.1';

const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
const PDFLIB_URL = `https://cdn.jsdelivr.net/npm/pdf-lib@${PDFLIB_VERSION}/dist/pdf-lib.esm.js`;

let pdfjsLib, PDFLib;
try {
  [pdfjsLib, PDFLib] = await Promise.all([import(PDFJS_URL), import(PDFLIB_URL)]);
  // Worker version is pinned to the exact same release as the main library.
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
} catch (err) {
  const fatal = document.getElementById('fatal');
  document.getElementById('fatal-msg').textContent = String(err && err.message ? err.message : err);
  fatal.hidden = false;
  throw err;
}

const { PDFDocument, degrees } = PDFLib;

/* ========================= Small helpers ========================= */
const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = (() => {
  let n = 0;
  return (p = 'id') => `${p}_${(++n).toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
})();

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Distinct, readable hues for the per-file color dot / thumbnail edge accent.
const FILE_COLORS = [
  '#2563eb', '#e8590c', '#2f9e44', '#9c36b5', '#c2255c',
  '#0c8599', '#f08c00', '#5f3dc4', '#e03131', '#087f5b',
  '#d6336c', '#1c7ed6', '#f76707', '#37b24d', '#7048e8',
];
let colorCursor = 0;
const nextColor = () => FILE_COLORS[colorCursor++ % FILE_COLORS.length];

const LARGE_FILE_BYTES = 60 * 1024 * 1024; // warn beyond this

/* ========================= App state ========================= */
const state = {
  sources: [], // { id, name, size, color, kind:'pdf'|'image', pageCount,
  //                bytes:Uint8Array, libDoc, pdfjsDoc, imgBitmap, error }
  pages: [], // ordered: { id, sourceId, srcIndex, rotation, _thumb }
  selection: new Set(), // page ids
  focusId: null,
  anchorId: null, // for shift-range selection
  undoStack: [],
  redoStack: [],
  thumbW: 170,
  dirty: false, // has exportable, user-arranged work
};

const sourceById = (id) => state.sources.find((s) => s.id === id);

// Short spreadsheet-style letter label per source: 0->A, 25->Z, 26->AA …
function letterLabel(i) {
  let s = '';
  i += 1;
  while (i > 0) {
    i -= 1;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}
// A source's label is its position in the (sidebar) source list — always in
// sync with what the user sees, and recomputed if a file is removed.
const sourceLabel = (src) => letterLabel(state.sources.indexOf(src));
// letter (upper) -> source, for parsing order expressions.
function labelMap() {
  const m = new Map();
  state.sources.forEach((s, i) => m.set(letterLabel(i), s));
  return m;
}

/* ========================= History (undo / redo) ========================= */
// A snapshot captures the page order + rotations and the live source list.
// Source *objects* are shared by reference across snapshots, so restoring a
// removed file is just putting its object back — heavy bytes aren't cloned.
function snapshot() {
  return {
    pages: state.pages.map((p) => ({ ...p, _thumb: p._thumb })),
    sources: state.sources.slice(),
    outputName: $('output-name').value,
  };
}
function pushHistory() {
  state.undoStack.push(snapshot());
  if (state.undoStack.length > 80) state.undoStack.shift();
  state.redoStack.length = 0;
  state.dirty = true;
}
function restore(snap) {
  state.pages = snap.pages.map((p) => ({ ...p }));
  state.sources = snap.sources.slice();
  $('output-name').value = snap.outputName;
  // Drop selection entries that no longer exist.
  const ids = new Set(state.pages.map((p) => p.id));
  state.selection = new Set([...state.selection].filter((x) => ids.has(x)));
  if (state.focusId && !ids.has(state.focusId)) state.focusId = null;
}
function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(snapshot());
  restore(state.undoStack.pop());
  renderAll();
}
function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(snapshot());
  restore(state.redoStack.pop());
  renderAll();
}

/* ========================= File parsing ========================= */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function fileKind(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)) return 'image';
  return 'unknown';
}

const progressEl = $('progress');
function showProgress(label, pct) {
  progressEl.hidden = false;
  $('progress-fill').style.width = `${clamp(pct, 0, 100)}%`;
  $('progress-label').textContent = label;
}
function hideProgress() {
  progressEl.hidden = true;
}

async function addFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;

  pushHistory();
  let added = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    showProgress(`Reading ${file.name}…`, ((i + 0.2) / files.length) * 100);
    const kind = fileKind(file);
    try {
      if (kind === 'image') {
        await addImageSource(file);
        added++;
      } else if (kind === 'pdf') {
        showProgress(`Parsing ${file.name}…`, ((i + 0.5) / files.length) * 100);
        const ok = await addPdfSource(file, (p) =>
          showProgress(`Parsing ${file.name}…`, ((i + 0.5 + p * 0.5) / files.length) * 100)
        );
        if (ok) added++;
      } else {
        toast('error', 'Unsupported file', `"${file.name}" isn't a PDF or image, so it was skipped.`);
      }
    } catch (err) {
      if (err === SKIP_FILE) {
        // user chose to skip a password-protected file — not an error
      } else {
        console.warn('Failed to load', file.name, err);
        toast('error', "Couldn't open file", `"${file.name}" appears corrupt or unsupported. Everything else stayed loaded.`);
      }
    }
    // Yield to the event loop so the UI stays responsive between files.
    await new Promise((r) => setTimeout(r, 0));
  }

  hideProgress();
  if (!added) {
    // Nothing landed — the pushed history entry is noise, drop it.
    state.undoStack.pop();
    if (!state.pages.length) state.dirty = false;
  }
  renderAll();
}

async function addImageSource(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: file.type || 'image/png' }));
  } catch {
    throw new Error('image decode failed');
  }
  const source = {
    id: uid('src'),
    name: file.name,
    size: file.size,
    color: nextColor(),
    kind: 'image',
    pageCount: 1,
    bytes,
    mime: file.type || guessMime(file.name),
    imgBitmap: bitmap,
    libDoc: null, // built lazily at export time
  };
  state.sources.push(source);
  state.pages.push(makePage(source, 0));
}

function guessMime(name) {
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return 'image/jpeg';
}

const SKIP_FILE = Symbol('skip-file');

async function addPdfSource(file, onProgress) {
  if (file.size > LARGE_FILE_BYTES) {
    toast('warn', 'Large file', `"${file.name}" is ${fmtBytes(file.size)}. It's processed on your device, so it may take a moment and use memory accordingly.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());

  // --- Render side: open with pdf.js, prompting for a password if needed. ---
  let password;
  let userSkipped = false;
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(0), // pdf.js takes ownership of its buffer
    // Keeping fonts/CMaps embedded-only avoids any network fetches.
  });
  loadingTask.onPassword = (updatePassword, reason) => {
    const incorrect = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
    requestPassword(file.name, incorrect)
      .then((pw) => {
        password = pw;
        updatePassword(pw);
      })
      .catch(() => {
        // User dismissed the prompt — abort the load so we can skip the file.
        userSkipped = true;
        loadingTask.destroy();
      });
  };

  let pdfjsDoc;
  try {
    pdfjsDoc = await loadingTask.promise;
  } catch (err) {
    if (userSkipped || (err && (err.name === 'PasswordException' || /password/i.test(err.message || '')))) {
      throw SKIP_FILE; // user skipped, or couldn't provide the password
    }
    throw err;
  }

  // --- Export side: try to get a pdf-lib document for lossless copying. ---
  let libDoc = null;
  try {
    libDoc = await PDFDocument.load(bytes.slice(0), { updateMetadata: false });
  } catch (err) {
    if (isEncryptedError(err)) {
      // pdf-lib can't decrypt. Ask pdf.js for a decrypted serialization and
      // try again; if that still fails, the export path rasterizes per-page.
      try {
        const saved = await pdfjsDoc.saveDocument();
        libDoc = await PDFDocument.load(saved, { updateMetadata: false });
      } catch {
        libDoc = null; // rasterize fallback at export
      }
    } else {
      throw err; // genuinely corrupt
    }
  }

  const source = {
    id: uid('src'),
    name: file.name,
    size: file.size,
    color: nextColor(),
    kind: 'pdf',
    pageCount: pdfjsDoc.numPages,
    bytes,
    password,
    pdfjsDoc,
    libDoc,
    encrypted: !!password || libDoc === null,
  };
  state.sources.push(source);
  for (let i = 0; i < pdfjsDoc.numPages; i++) {
    state.pages.push(makePage(source, i));
    if (onProgress && i % 8 === 0) onProgress(i / pdfjsDoc.numPages);
  }
  return true;
}

function isEncryptedError(err) {
  const m = `${err && err.name} ${err && err.message}`.toLowerCase();
  return m.includes('encrypt');
}

function makePage(source, srcIndex) {
  return {
    id: uid('pg'),
    sourceId: source.id,
    srcIndex,
    rotation: 0, // extra rotation the user applies, added to the page's own
    _thumb: null, // { key, node } cached rendered thumbnail
  };
}

/* ========================= Password modal ========================= */
let pwResolve = null;
let pwReject = null;
function requestPassword(fileName, incorrect) {
  return new Promise((resolve, reject) => {
    pwResolve = resolve;
    pwReject = reject;
    $('pw-file').textContent = fileName;
    $('pw-error').hidden = !incorrect;
    $('pw-input').value = '';
    $('password-modal').hidden = false;
    setTimeout(() => $('pw-input').focus(), 30);
  });
}
$('pw-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const val = $('pw-input').value;
  $('password-modal').hidden = true;
  if (pwResolve) pwResolve(val);
  pwResolve = pwReject = null;
});
$('pw-cancel').addEventListener('click', () => {
  $('password-modal').hidden = true;
  if (pwReject) pwReject(new Error('cancelled'));
  pwResolve = pwReject = null;
});

/* ========================= Thumbnail rendering (lazy) ========================= */
// Render a page to a canvas at the given CSS width. Returns the canvas.
// pdf.js applies each page's own /Rotate for us; page.rotation is the extra
// delta the user has dialed in. Base + delta both flow through the viewport.
async function renderThumb(page, cssW) {
  const src = sourceById(page.sourceId);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rot = page.rotation % 360; // pdf.js applies the page's own rotate itself

  if (src.kind === 'image') {
    const bmp = src.imgBitmap;
    const swap = rot === 90 || rot === 270;
    const iw = swap ? bmp.height : bmp.width;
    const ih = swap ? bmp.width : bmp.height;
    const scale = (cssW * dpr) / iw;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(iw * scale));
    canvas.height = Math.max(1, Math.round(ih * scale));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${Math.round(ih * scale) / dpr}px`;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    const dw = swap ? canvas.height : canvas.width;
    const dh = swap ? canvas.width : canvas.height;
    ctx.drawImage(bmp, -dw / 2, -dh / 2, dw, dh);
    return canvas;
  }

  const pdfPage = await src.pdfjsDoc.getPage(page.srcIndex + 1);
  const baseVp = pdfPage.getViewport({ scale: 1, rotation: (pdfPage.rotate + rot) % 360 });
  const scale = (cssW * dpr) / baseVp.width;
  const viewport = pdfPage.getViewport({ scale, rotation: (pdfPage.rotate + rot) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${Math.round(viewport.height) / dpr}px`;
  // pdf.js v6 prefers a `canvas` field; it grabs its own 2d context.
  await pdfPage.render({ canvas, viewport }).promise;
  return canvas;
}

// IntersectionObserver drives lazy rendering — only visible pages get drawn.
const visiblePages = new Set();
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const id = entry.target.dataset.pageId;
      if (entry.isIntersecting) {
        visiblePages.add(id);
        ensureThumb(id);
      } else {
        visiblePages.delete(id);
      }
    }
  },
  { root: $('workspace'), rootMargin: '400px 0px' }
);

const thumbKey = (page) => `${page.rotation}@${state.thumbW}`;

async function ensureThumb(pageId) {
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return;
  const el = document.querySelector(`.thumb[data-page-id="${pageId}"] .thumb-frame`);
  if (!el) return;
  const key = thumbKey(page);
  if (page._thumb && page._thumb.key === key) return; // up to date

  try {
    const canvas = await renderThumb(page, state.thumbW);
    // The page may have been removed while we were rendering.
    if (!state.pages.some((p) => p.id === pageId)) return;
    const src = sourceById(page.sourceId);
    const wrap = document.createElement('div');
    wrap.className = 'thumb-page';
    if (src) wrap.style.setProperty('--file-color', src.color);
    wrap.appendChild(canvas);
    page._thumb = { key, node: wrap };
    const current = document.querySelector(`.thumb[data-page-id="${pageId}"] .thumb-frame`);
    if (current) {
      // Replace only the page/skeleton; leave the .thumb-tag badge untouched.
      current.querySelectorAll('.thumb-page, .thumb-skeleton').forEach((n) => n.remove());
      current.insertBefore(wrap, current.firstChild);
    }
  } catch (err) {
    console.warn('thumb render failed', err);
  }
}

/* ========================= Rendering the UI ========================= */
function renderAll() {
  renderFileList();
  renderGrid();
  renderActionBar();
  renderHistoryButtons();
  updateOrderbar();
  updateEmptyState();
}

function updateEmptyState() {
  const empty = !state.pages.length;
  $('empty-state').classList.toggle('hidden', !empty);
  $('grid').style.display = empty ? 'none' : 'grid';
  $('app').classList.toggle('no-pages', empty);
}

function renderFileList() {
  const list = $('file-list');
  list.innerHTML = '';
  for (const src of state.sources) {
    const li = document.createElement('li');
    li.className = 'file-row';
    const kindLabel = src.kind === 'image' ? 'image' : `${src.pageCount} page${src.pageCount === 1 ? '' : 's'}`;
    const lock = src.encrypted ? ' · unlocked' : '';
    li.innerHTML = `
      <span class="file-label" style="background:${src.color}">${sourceLabel(src)}</span>
      <span class="file-meta">
        <span class="file-name" title="${escapeHtml(src.name)}">${escapeHtml(src.name)}</span>
        <span class="file-sub">${kindLabel} · ${fmtBytes(src.size)}${lock}</span>
      </span>
      <button class="file-remove" title="Remove this file and its pages" aria-label="Remove ${escapeHtml(src.name)}">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>
      </button>`;
    li.querySelector('.file-remove').addEventListener('click', () => removeSource(src.id));
    list.appendChild(li);
  }
  const totalPages = state.pages.length;
  $('file-summary').textContent = state.sources.length
    ? `${state.sources.length} file${state.sources.length === 1 ? '' : 's'} · ${totalPages} pg`
    : '';
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function removeSource(sourceId) {
  pushHistory();
  const removedName = (sourceById(sourceId) || {}).name || 'file';
  state.sources = state.sources.filter((s) => s.id !== sourceId);
  const removedPageIds = state.pages.filter((p) => p.sourceId === sourceId).map((p) => p.id);
  state.pages = state.pages.filter((p) => p.sourceId !== sourceId);
  removedPageIds.forEach((id) => state.selection.delete(id));
  renderAll();
  toast('success', 'File removed', `Removed "${removedName}".`, { undo: true });
}

const grid = $('grid');

function renderGrid() {
  grid.innerHTML = '';
  io.disconnect();
  visiblePages.clear();

  state.pages.forEach((page, index) => {
    const src = sourceById(page.sourceId);
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.dataset.pageId = page.id;
    thumb.setAttribute('role', 'option');
    thumb.setAttribute('aria-selected', state.selection.has(page.id) ? 'true' : 'false');
    thumb.tabIndex = -1;
    thumb.draggable = true;
    if (state.selection.has(page.id)) thumb.classList.add('selected');
    if (state.focusId === page.id) thumb.classList.add('focused');

    const origin = src ? `${src.name} · p.${page.srcIndex + 1}` : '';
    const tag = src ? `${sourceLabel(src)}${page.srcIndex + 1}` : '';

    thumb.innerHTML = `
      <div class="thumb-origin">${escapeHtml(origin)}</div>
      <div class="thumb-frame">
        <div class="thumb-skeleton" style="--file-color:${src ? src.color : 'transparent'}"></div>
        <span class="thumb-tag" style="background:${src ? src.color : 'transparent'}">${escapeHtml(tag)}</span>
      </div>
      <div class="thumb-badge"><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="thumb-tools">
        <button class="thumb-tool" data-act="rot-l" title="Rotate left" aria-label="Rotate left"><svg viewBox="0 0 24 24"><path d="M4 9a8 8 0 108-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 4v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="thumb-tool" data-act="rot-r" title="Rotate right" aria-label="Rotate right"><svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M4 9a8 8 0 108-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 4v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="thumb-tool" data-act="preview" title="Preview" aria-label="Preview page"><svg viewBox="0 0 24 24"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg></button>
        <button class="thumb-tool del" data-act="delete" title="Delete page" aria-label="Delete page"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="thumb-pos">${index + 1}</div>`;

    // Re-attach a cached thumbnail if it still matches the current zoom/rotation.
    // Keep the .thumb-tag in place — only swap the page/skeleton.
    if (page._thumb && page._thumb.key === thumbKey(page)) {
      const frame = thumb.querySelector('.thumb-frame');
      const sk = frame.querySelector('.thumb-skeleton');
      if (sk) sk.remove();
      frame.insertBefore(page._thumb.node, frame.firstChild);
    }

    wireThumb(thumb, page);
    grid.appendChild(thumb);
    io.observe(thumb);
  });
}

/* ========================= Selection ========================= */
function selectionIds() {
  // Selection in page order.
  return state.pages.filter((p) => state.selection.has(p.id)).map((p) => p.id);
}

function clickSelect(page, e) {
  const id = page.id;
  if (e.shiftKey && state.anchorId) {
    const ids = state.pages.map((p) => p.id);
    const a = ids.indexOf(state.anchorId);
    const b = ids.indexOf(id);
    if (a !== -1 && b !== -1) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      if (!(e.ctrlKey || e.metaKey)) state.selection.clear();
      for (let i = lo; i <= hi; i++) state.selection.add(ids[i]);
    }
  } else if (e.ctrlKey || e.metaKey) {
    if (state.selection.has(id)) state.selection.delete(id);
    else state.selection.add(id);
    state.anchorId = id;
  } else {
    state.selection.clear();
    state.selection.add(id);
    state.anchorId = id;
  }
  state.focusId = id;
  syncSelectionDom();
  renderActionBar();
}

// Update only the DOM bits affected by selection (cheap; no re-render).
function syncSelectionDom() {
  document.querySelectorAll('.thumb').forEach((el) => {
    const sel = state.selection.has(el.dataset.pageId);
    el.classList.toggle('selected', sel);
    el.classList.toggle('focused', state.focusId === el.dataset.pageId);
    el.setAttribute('aria-selected', sel ? 'true' : 'false');
  });
}

function selectAll() {
  state.pages.forEach((p) => state.selection.add(p.id));
  syncSelectionDom();
  renderActionBar();
}
function deselectAll() {
  state.selection.clear();
  syncSelectionDom();
  renderActionBar();
}

/* ========================= Thumbnail interactions ========================= */
function wireThumb(thumb, page) {
  thumb.addEventListener('click', (e) => {
    if (e.target.closest('.thumb-tool')) return; // tool buttons handle themselves
    clickSelect(page, e);
  });
  thumb.addEventListener('dblclick', (e) => {
    if (e.target.closest('.thumb-tool')) return;
    openPreview(page.id);
  });

  thumb.querySelectorAll('.thumb-tool').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act === 'rot-l') rotatePages([page.id], -90);
      else if (act === 'rot-r') rotatePages([page.id], 90);
      else if (act === 'delete') deletePages([page.id]);
      else if (act === 'preview') openPreview(page.id);
    });
  });

  // Click the position number to type an exact new position.
  const posEl = thumb.querySelector('.thumb-pos');
  posEl.addEventListener('click', (e) => {
    e.stopPropagation();
    startPositionEdit(thumb, page, posEl);
  });

  // Drag to reorder
  thumb.addEventListener('dragstart', (e) => onDragStart(e, page));
  thumb.addEventListener('dragend', onDragEnd);
  thumb.addEventListener('dragover', (e) => onDragOver(e, thumb));
  thumb.addEventListener('drop', (e) => onDrop(e, page));
}

/* ========================= Operations ========================= */
function rotatePages(ids, delta) {
  if (!ids.length) return;
  pushHistory();
  for (const id of ids) {
    const page = state.pages.find((p) => p.id === id);
    if (page) page.rotation = (page.rotation + delta + 360) % 360;
  }
  // Re-render just the affected thumbnails.
  ids.forEach((id) => {
    if (visiblePages.has(id)) ensureThumb(id);
  });
  renderHistoryButtons();
}

function deletePages(ids) {
  if (!ids.length) return;
  pushHistory();
  const set = new Set(ids);
  const deletedCount = ids.length;
  state.pages = state.pages.filter((p) => !set.has(p.id));
  ids.forEach((id) => state.selection.delete(id));
  if (set.has(state.focusId)) state.focusId = null;
  renderAll();
  toast('success', `Deleted ${deletedCount} page${deletedCount === 1 ? '' : 's'}`, 'You can bring them back.', { undo: true });
}

/* ========================= Drag & drop reorder ========================= */
let dragState = null; // { ids:Set, indicatorThumb, before }

function onDragStart(e, page) {
  // If dragging an unselected page, it becomes the selection.
  let ids;
  if (state.selection.has(page.id)) {
    ids = selectionIds();
  } else {
    state.selection.clear();
    state.selection.add(page.id);
    state.focusId = page.id;
    syncSelectionDom();
    renderActionBar();
    ids = [page.id];
  }
  dragState = { ids: new Set(ids), indicatorThumb: null, before: true };
  e.dataTransfer.effectAllowed = 'move';
  try {
    e.dataTransfer.setData('text/plain', 'reorder');
  } catch {
    /* some browsers require data to be set */
  }
  // Dim the pages being moved.
  requestAnimationFrame(() => {
    ids.forEach((id) => {
      const el = document.querySelector(`.thumb[data-page-id="${id}"]`);
      if (el) el.classList.add('dragging');
    });
  });
}

function clearDropIndicators() {
  document.querySelectorAll('.thumb.drop-before, .thumb.drop-after').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after');
  });
}

function onDragOver(e, thumb) {
  if (!dragState) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const rect = thumb.getBoundingClientRect();
  const before = e.clientX < rect.left + rect.width / 2;
  clearDropIndicators();
  thumb.classList.add(before ? 'drop-before' : 'drop-after');
  dragState.indicatorThumb = thumb;
  dragState.before = before;
}

function onDrop(e, page) {
  if (!dragState) return;
  e.preventDefault();
  performReorder(page.id, dragState.before);
}

function onDragEnd() {
  document.querySelectorAll('.thumb.dragging').forEach((el) => el.classList.remove('dragging'));
  clearDropIndicators();
  dragState = null;
}

function performReorder(targetId, before) {
  const movingIds = dragState.ids;
  if (movingIds.has(targetId)) {
    // Dropped onto one of the moved pages — treat target as the nearest
    // non-moving neighbor to avoid a no-op that feels broken.
  }
  pushHistory();
  const moving = state.pages.filter((p) => movingIds.has(p.id));
  const rest = state.pages.filter((p) => !movingIds.has(p.id));
  let idx = rest.findIndex((p) => p.id === targetId);
  if (idx === -1) {
    // Target was part of the moving set; drop at original neighborhood end.
    state.pages = [...rest, ...moving];
  } else {
    if (!before) idx += 1;
    state.pages = [...rest.slice(0, idx), ...moving, ...rest.slice(idx)];
  }
  onDragEnd();
  renderGrid();
  renderActionBar();
  renderHistoryButtons();
}

// Allow dropping into the empty tail of the grid.
grid.addEventListener('dragover', (e) => {
  if (!dragState) return;
  if (e.target === grid) {
    e.preventDefault();
    clearDropIndicators();
  }
});
grid.addEventListener('drop', (e) => {
  if (!dragState) return;
  if (e.target === grid) {
    e.preventDefault();
    pushHistory();
    const moving = state.pages.filter((p) => dragState.ids.has(p.id));
    const rest = state.pages.filter((p) => !dragState.ids.has(p.id));
    state.pages = [...rest, ...moving];
    onDragEnd();
    renderGrid();
    renderActionBar();
    renderHistoryButtons();
  }
});

/* ========================= Precise ordering ========================= */
function cleanupSelection() {
  const ids = new Set(state.pages.map((p) => p.id));
  state.selection = new Set([...state.selection].filter((x) => ids.has(x)));
  if (state.focusId && !ids.has(state.focusId)) state.focusId = null;
}

// Build a fresh pages array from (source, originalIndex) terms. Existing page
// objects are reused (preserving rotation & thumbnail cache); references to
// deleted or duplicated pages get brand-new page objects.
function rebuildFromTerms(terms) {
  const pool = new Map();
  for (const p of state.pages) {
    const k = `${p.sourceId}:${p.srcIndex}`;
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(p);
  }
  return terms.map((t) => {
    const k = `${t.src.id}:${t.idx}`;
    const arr = pool.get(k);
    return arr && arr.length ? arr.shift() : makePage(t.src, t.idx);
  });
}

/* --- Direct position editing --- */
function startPositionEdit(thumb, page, posEl) {
  const cur = state.pages.findIndex((p) => p.id === page.id) + 1;
  const input = document.createElement('input');
  input.className = 'pos-edit';
  input.value = String(cur);
  input.setAttribute('aria-label', 'New position');
  input.inputMode = 'numeric';
  let done = false;
  const cancel = () => {
    if (done) return;
    done = true;
    input.replaceWith(posEl);
  };
  const commit = () => {
    if (done) return;
    done = true;
    const v = parseInt(input.value, 10);
    if (!Number.isNaN(v)) moveToPosition(page.id, v);
    else input.replaceWith(posEl);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  });
  input.addEventListener('blur', cancel);
  posEl.replaceWith(input);
  input.focus();
  input.select();
}

function moveToPosition(pageId, pos1) {
  const idx = state.pages.findIndex((p) => p.id === pageId);
  if (idx === -1) return;
  const target = clamp(pos1 - 1, 0, state.pages.length - 1);
  if (target === idx) {
    renderGrid();
    return;
  }
  pushHistory();
  const [pg] = state.pages.splice(idx, 1);
  state.pages.splice(target, 0, pg);
  renderAll();
}

// Alt+Arrow: nudge the whole selection one slot; Alt+Shift+Arrow: to an end.
function moveSelectionBy(delta, toExtreme) {
  const sel = selectionIds();
  if (!sel.length) return;
  const order = state.pages;
  const selSet = new Set(sel);
  const block = order.filter((p) => selSet.has(p.id));
  const rest = order.filter((p) => !selSet.has(p.id));
  const firstIdx = order.findIndex((p) => selSet.has(p.id));
  let restPos = 0;
  for (let i = 0; i < firstIdx; i++) if (!selSet.has(order[i].id)) restPos++;
  const target = toExtreme ? (delta < 0 ? 0 : rest.length) : clamp(restPos + delta, 0, rest.length);
  const candidate = rest.slice();
  candidate.splice(target, 0, ...block);
  if (candidate.length === order.length && candidate.every((p, i) => p.id === order[i].id)) return;
  pushHistory();
  state.pages = candidate;
  renderAll();
  const el = document.querySelector(`.thumb[data-page-id="${state.focusId}"]`);
  if (el) el.scrollIntoView({ block: 'nearest' });
}

/* --- Order expression --- */
function parseOrderExpression(text) {
  const map = labelMap();
  const raw = text.split(',').map((t) => t.trim()).filter(Boolean);
  if (!raw.length) return { ok: false, error: 'Type an order like A1-3, B1' };
  const terms = [];
  for (const term of raw) {
    const m = term.match(/^([A-Za-z]+)(?:\s*(\d+)(?:\s*-\s*(\d+))?)?$/);
    if (!m) return { ok: false, error: `"${term}" isn't valid` };
    const letter = m[1].toUpperCase();
    const src = map.get(letter);
    if (!src) return { ok: false, error: `No file "${letter}"` };
    const n = src.pageCount;
    if (m[2] === undefined) {
      for (let k = 0; k < n; k++) terms.push({ src, idx: k });
    } else {
      const a = parseInt(m[2], 10);
      const b = m[3] !== undefined ? parseInt(m[3], 10) : a;
      if (a < 1 || a > n || b < 1 || b > n) {
        return { ok: false, error: `${letter} has ${n} page${n === 1 ? '' : 's'} — ${term} is out of range` };
      }
      if (a <= b) for (let k = a; k <= b; k++) terms.push({ src, idx: k - 1 });
      else for (let k = a; k >= b; k--) terms.push({ src, idx: k - 1 });
    }
  }
  return { ok: true, terms, count: terms.length };
}

// Serialize the current grid back into the expression syntax, collapsing
// consecutive same-source runs into ranges (and whole files into just "A").
function serializeOrder() {
  const pages = state.pages;
  const parts = [];
  let i = 0;
  while (i < pages.length) {
    const srcId = pages[i].sourceId;
    const src = sourceById(srcId);
    const label = sourceLabel(src);
    let j = i + 1;
    let dir = 0;
    while (j < pages.length && pages[j].sourceId === srcId) {
      const d = pages[j].srcIndex - pages[j - 1].srcIndex;
      if (d !== 1 && d !== -1) break;
      if (dir === 0) dir = d;
      else if (d !== dir) break;
      j++;
    }
    const start = pages[i].srcIndex;
    const end = pages[j - 1].srcIndex;
    if (start === end) parts.push(`${label}${start + 1}`);
    else if (dir > 0 && start === 0 && end === src.pageCount - 1) parts.push(label);
    else parts.push(`${label}${start + 1}-${end + 1}`);
    i = j;
  }
  return parts.join(', ');
}

function liveValidateOrder() {
  const input = $('order-input');
  const status = $('order-status');
  const apply = $('order-apply');
  const text = input.value.trim();
  if (!text || !state.sources.length) {
    status.textContent = '';
    status.className = 'order-status';
    apply.disabled = true;
    return;
  }
  const res = parseOrderExpression(text);
  if (res.ok) {
    status.textContent = `= ${res.count} page${res.count === 1 ? '' : 's'}`;
    status.className = 'order-status ok';
    apply.disabled = false;
  } else {
    status.textContent = `✕ ${res.error}`;
    status.className = 'order-status err';
    apply.disabled = true;
  }
}

function applyOrderFromInput() {
  const res = parseOrderExpression($('order-input').value.trim());
  if (!res.ok) return;
  pushHistory();
  state.pages = rebuildFromTerms(res.terms);
  cleanupSelection();
  renderAll();
  toast('success', 'Order applied', `${res.count} page${res.count === 1 ? '' : 's'} arranged from your expression.`);
}

/* --- Interleave / zip --- */
function interleaveTerms(a, b, reverseB) {
  const na = a.pageCount;
  const nb = b.pageCount;
  const terms = [];
  const max = Math.max(na, nb);
  for (let i = 0; i < max; i++) {
    if (i < na) terms.push({ src: a, idx: i });
    if (i < nb) terms.push({ src: b, idx: reverseB ? nb - 1 - i : i });
  }
  return terms;
}

function fillInterleaveSelects() {
  const opts = state.sources
    .map((s, i) => `<option value="${s.id}">${letterLabel(i)} · ${escapeHtml(s.name)}</option>`)
    .join('');
  const a = $('il-a');
  const b = $('il-b');
  a.innerHTML = opts;
  b.innerHTML = opts;
  if (state.sources[0]) a.value = state.sources[0].id;
  if (state.sources[1]) b.value = state.sources[1].id;
}

function interleavePreview() {
  const a = sourceById($('il-a').value);
  const b = sourceById($('il-b').value);
  const prev = $('il-preview');
  if (!a || !b || a === b) {
    prev.innerHTML = '<span class="note">Pick two different files.</span>';
    $('il-apply').disabled = true;
    return;
  }
  $('il-apply').disabled = false;
  const rev = $('il-rev').checked;
  const terms = interleaveTerms(a, b, rev);
  const first = terms.slice(0, 6).map((t) => `${sourceLabel(t.src)}${t.idx + 1}`).join(', ');
  let note = '';
  if (a.pageCount !== b.pageCount) {
    const longer = a.pageCount > b.pageCount ? sourceLabel(a) : sourceLabel(b);
    note = `<span class="note">Files differ in length — the leftover ${longer} pages are appended at the end.</span>`;
  }
  prev.innerHTML = `${escapeHtml(first)}${terms.length > 6 ? ' …' : ''} <span class="note">= ${terms.length} pages</span>${note}`;
}

function applyInterleave() {
  const a = sourceById($('il-a').value);
  const b = sourceById($('il-b').value);
  if (!a || !b || a === b) return;
  const rev = $('il-rev').checked;
  pushHistory();
  state.pages = rebuildFromTerms(interleaveTerms(a, b, rev));
  cleanupSelection();
  closeMenus();
  renderAll();
  const note = a.pageCount !== b.pageCount ? ' Leftover pages were appended at the end.' : '';
  toast('success', 'Interleaved', `${sourceLabel(a)} + ${sourceLabel(b)}${rev ? ' (reversed)' : ''} → ${state.pages.length} pages.${note}`);
}

/* --- Sort presets --- */
function orderIndexMap(list) {
  const m = new Map();
  list.forEach((s, i) => m.set(s.id, i));
  return m;
}
function applyPermutation(arr, label) {
  pushHistory();
  state.pages = arr;
  cleanupSelection();
  renderAll();
  if (label) toast('success', label, `${state.pages.length} pages reordered.`);
}
function runSort(kind) {
  const arr = state.pages.slice();
  if (kind === 'reverse') {
    applyPermutation(arr.reverse(), 'Reversed');
  } else if (kind === 'group') {
    const m = orderIndexMap(state.sources);
    arr.sort((x, y) => m.get(x.sourceId) - m.get(y.sourceId)); // stable within a file
    applyPermutation(arr, 'Grouped by file');
  } else if (kind === 'original') {
    const m = orderIndexMap(state.sources);
    arr.sort((x, y) => m.get(x.sourceId) - m.get(y.sourceId) || x.srcIndex - y.srcIndex);
    applyPermutation(arr, 'Restored original order');
  } else if (kind === 'filename') {
    const sorted = [...state.sources].sort((p, q) => p.name.localeCompare(q.name, undefined, { numeric: true }));
    const m = orderIndexMap(sorted);
    arr.sort((x, y) => m.get(x.sourceId) - m.get(y.sourceId));
    applyPermutation(arr, 'Sorted by filename');
  }
  closeMenus();
}

/* --- Menus --- */
function closeMenus() {
  $('interleave-pop').hidden = true;
  $('sort-pop').hidden = true;
  $('btn-interleave').setAttribute('aria-expanded', 'false');
  $('btn-sort').setAttribute('aria-expanded', 'false');
}

function updateOrderbar() {
  const has = state.pages.length > 0;
  const multi = state.sources.length >= 2;
  $('order-input').disabled = !has;
  $('order-copy').disabled = !has;
  $('btn-sort').disabled = !has;
  $('btn-interleave').disabled = !multi;
  liveValidateOrder();
}

// Wire ordering controls
$('order-input').addEventListener('input', liveValidateOrder);
$('order-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!$('order-apply').disabled) applyOrderFromInput();
  }
});
$('order-apply').addEventListener('click', applyOrderFromInput);
$('order-copy').addEventListener('click', () => {
  const expr = serializeOrder();
  $('order-input').value = expr;
  liveValidateOrder();
  if (navigator.clipboard) navigator.clipboard.writeText(expr).catch(() => {});
  toast('success', 'Order copied', 'Current order written into the box (and your clipboard).');
});

$('btn-interleave').addEventListener('click', (e) => {
  e.stopPropagation();
  const pop = $('interleave-pop');
  const opening = pop.hidden;
  closeMenus();
  if (opening) {
    fillInterleaveSelects();
    interleavePreview();
    pop.hidden = false;
    $('btn-interleave').setAttribute('aria-expanded', 'true');
  }
});
['il-a', 'il-b', 'il-rev'].forEach((id) => $(id).addEventListener('change', interleavePreview));
$('il-cancel').addEventListener('click', closeMenus);
$('il-apply').addEventListener('click', applyInterleave);

$('btn-sort').addEventListener('click', (e) => {
  e.stopPropagation();
  const pop = $('sort-pop');
  const opening = pop.hidden;
  closeMenus();
  if (opening) {
    pop.hidden = false;
    $('btn-sort').setAttribute('aria-expanded', 'true');
  }
});
$('sort-pop').querySelectorAll('.menu-item').forEach((btn) => {
  btn.addEventListener('click', () => runSort(btn.dataset.sort));
});
// Close menus on outside click.
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) closeMenus();
});

/* ========================= Action bar / history buttons ========================= */
function renderActionBar() {
  const n = state.selection.size;
  const total = state.pages.length;
  const has = total > 0;
  $('sel-count').textContent = !has
    ? 'No pages yet'
    : n === 0
    ? `${total} page${total === 1 ? '' : 's'}`
    : `${n} page${n === 1 ? '' : 's'} selected`;
  $('sel-hint').textContent = n > 0 ? 'Actions apply to the selection' : has ? 'Click to select · drag to reorder' : '';

  const selDisabled = n === 0;
  $('act-rotate-l').disabled = selDisabled;
  $('act-rotate-r').disabled = selDisabled;
  $('act-delete').disabled = selDisabled;
  $('act-export-selected').disabled = selDisabled;
  $('act-export-all').disabled = !has;
  $('select-all').disabled = !has;
  $('deselect').disabled = selDisabled;
}

function renderHistoryButtons() {
  $('undo').disabled = state.undoStack.length === 0;
  $('redo').disabled = state.redoStack.length === 0;
}

/* ========================= Preview ========================= */
let previewId = null;
async function openPreview(pageId) {
  previewId = pageId;
  $('preview-modal').hidden = false;
  await drawPreview();
}
async function drawPreview() {
  const page = state.pages.find((p) => p.id === previewId);
  if (!page) return closePreview();
  const src = sourceById(page.sourceId);
  const canvas = $('preview-canvas');
  const maxW = Math.min(window.innerWidth * 0.86, 1400);
  try {
    const rendered = await renderThumb(page, maxW);
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.getContext('2d').drawImage(rendered, 0, 0);
  } catch (e) {
    console.warn(e);
  }
  const index = state.pages.findIndex((p) => p.id === previewId);
  $('preview-caption').textContent = `${src ? src.name : ''} · page ${page.srcIndex + 1}  —  position ${index + 1} of ${state.pages.length}`;
}
function closePreview() {
  $('preview-modal').hidden = true;
  previewId = null;
}
function previewStep(dir) {
  const idx = state.pages.findIndex((p) => p.id === previewId);
  const next = clamp(idx + dir, 0, state.pages.length - 1);
  previewId = state.pages[next].id;
  drawPreview();
}
$('preview-close').addEventListener('click', closePreview);
$('preview-prev').addEventListener('click', () => previewStep(-1));
$('preview-next').addEventListener('click', () => previewStep(1));
$('preview-modal').addEventListener('click', (e) => {
  if (e.target === $('preview-modal')) closePreview();
});

/* ========================= Export ========================= */
let exporting = false;

async function exportPages(pages, filenameHint) {
  if (exporting || !pages.length) return;
  exporting = true;
  try {
    const out = await PDFDocument.create();
    // Cache pdf-lib docs per source (images build one lazily).
    const total = pages.length;
    let done = 0;

    // Group copies by source to reuse copyPages efficiently while preserving
    // the exact on-screen order.
    for (const page of pages) {
      const src = sourceById(page.sourceId);
      showProgress(`Building PDF… ${done + 1}/${total}`, (done / total) * 100);

      let placed = false;
      if (src.kind === 'image') {
        await appendImagePage(out, src, page);
        placed = true;
      } else if (src.libDoc) {
        try {
          const [copied] = await out.copyPages(src.libDoc, [page.srcIndex]);
          // The copied page keeps its own /Rotate; add the user's delta on top.
          const base = copied.getRotation().angle || 0;
          copied.setRotation(degrees(((base + page.rotation) % 360 + 360) % 360));
          out.addPage(copied);
          placed = true;
        } catch (err) {
          console.warn('copyPages failed, rasterizing', err);
        }
      }
      if (!placed) {
        // Encrypted/corrupt page we couldn't copy losslessly — rasterize it so
        // the export never silently drops a page.
        await appendRasterPage(out, page);
      }
      done++;
      // Keep the UI breathing on big exports.
      if (done % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    showProgress('Saving…', 99);
    const bytes = await out.save();
    hideProgress();
    downloadBytes(bytes, sanitizeFilename(filenameHint));
    state.dirty = false;
    toast('success', 'Exported', `${total} page${total === 1 ? '' : 's'} saved to your device.`);
  } catch (err) {
    hideProgress();
    console.error(err);
    toast('error', 'Export failed', err.message || 'Something went wrong while building the PDF.');
  } finally {
    exporting = false;
  }
}

async function appendImagePage(out, src, page) {
  const rot = ((page.rotation % 360) + 360) % 360;
  const mime = src.mime || 'image/png';

  // Unrotated: embed the ORIGINAL bytes losslessly. Rotated: bake the rotation
  // into a canvas so page placement is always trivial (draw at 0,0 full-bleed).
  let img;
  if (rot === 0 && (mime === 'image/png' || mime === 'image/jpeg')) {
    img = mime === 'image/png' ? await out.embedPng(src.bytes) : await out.embedJpg(src.bytes);
    const p = out.addPage([img.width, img.height]);
    p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    return;
  }

  const bmp = src.imgBitmap;
  const swap = rot === 90 || rot === 270;
  const cw = swap ? bmp.height : bmp.width;
  const ch = swap ? bmp.width : bmp.height;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  const isJpg = mime === 'image/jpeg';
  const blob = await new Promise((res) => canvas.toBlob(res, isJpg ? 'image/jpeg' : 'image/png', 0.95));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  img = isJpg ? await out.embedJpg(bytes) : await out.embedPng(bytes);
  const p = out.addPage([cw, ch]);
  p.drawImage(img, { x: 0, y: 0, width: cw, height: ch });
}

// Rasterize a page with pdf.js at print-ish resolution and embed as JPEG.
async function appendRasterPage(out, page) {
  const src = sourceById(page.sourceId);
  const pdfPage = await src.pdfjsDoc.getPage(page.srcIndex + 1);
  const rot = (pdfPage.rotate + (page.rotation % 360)) % 360;
  const scale = 2; // ~144 DPI
  const viewport = pdfPage.getViewport({ scale, rotation: rot });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await pdfPage.render({ canvas, viewport }).promise;
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
  const p = out.addPage([viewport.width / scale, viewport.height / scale]);
  p.drawImage(jpg, { x: 0, y: 0, width: viewport.width / scale, height: viewport.height / scale });
}

function sanitizeFilename(name) {
  let n = (name || 'workspace.pdf').trim();
  if (!/\.pdf$/i.test(n)) n += '.pdf';
  return n.replace(/[\\/:*?"<>|]/g, '_');
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ========================= Toasts ========================= */
function toast(type, title, body, opts = {}) {
  const region = $('toast-region');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="toast-body"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body || '')}</span></div>
    ${opts.undo ? '<button class="toast-undo">Undo</button>' : ''}
    <button class="toast-close" aria-label="Dismiss">&times;</button>`;
  const remove = () => {
    el.style.transition = 'opacity 150ms';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 160);
  };
  el.querySelector('.toast-close').addEventListener('click', remove);
  if (opts.undo) {
    el.querySelector('.toast-undo').addEventListener('click', () => {
      undo();
      remove();
    });
  }
  region.appendChild(el);
  setTimeout(remove, opts.undo ? 7000 : 4500);
}

/* ========================= Keyboard ========================= */
function gridColumns() {
  const first = grid.querySelector('.thumb');
  if (!first) return 1;
  const top = first.offsetTop;
  let cols = 0;
  for (const el of grid.children) {
    if (el.offsetTop === top) cols++;
    else break;
  }
  return Math.max(1, cols);
}

function moveFocus(delta, extend) {
  if (!state.pages.length) return;
  const ids = state.pages.map((p) => p.id);
  let idx = ids.indexOf(state.focusId);
  if (idx === -1) idx = 0;
  else idx = clamp(idx + delta, 0, ids.length - 1);
  const id = ids[idx];
  state.focusId = id;
  if (extend && state.anchorId) {
    const a = ids.indexOf(state.anchorId);
    const [lo, hi] = a < idx ? [a, idx] : [idx, a];
    state.selection.clear();
    for (let i = lo; i <= hi; i++) state.selection.add(ids[i]);
  } else {
    state.selection.clear();
    state.selection.add(id);
    state.anchorId = id;
  }
  syncSelectionDom();
  renderActionBar();
  const el = document.querySelector(`.thumb[data-page-id="${id}"]`);
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

document.addEventListener('keydown', (e) => {
  // Don't hijack typing in inputs. Guard against a non-Element target
  // (e.g. document) which has no matches() and would throw.
  const typing = e.target instanceof Element && e.target.matches('input, textarea');
  const mod = e.ctrlKey || e.metaKey;

  if (!$('preview-modal').hidden) {
    if (e.key === 'Escape') closePreview();
    else if (e.key === 'ArrowLeft') previewStep(-1);
    else if (e.key === 'ArrowRight') previewStep(1);
    return;
  }
  if (!$('password-modal').hidden) {
    if (e.key === 'Escape') $('pw-cancel').click();
    return;
  }
  // Escape closes an open ordering menu first.
  if (e.key === 'Escape' && (!$('interleave-pop').hidden || !$('sort-pop').hidden)) {
    closeMenus();
    return;
  }

  if (mod && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redo();
    return;
  }
  if (mod && (e.key === 'a' || e.key === 'A')) {
    if (typing) return;
    e.preventDefault();
    selectAll();
    return;
  }

  if (typing) return;

  // Alt+Arrow nudges the selection; Alt+Shift+Arrow sends it to an end.
  if (e.altKey && e.key.startsWith('Arrow')) {
    if (state.selection.size) {
      e.preventDefault();
      const toStart = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
      moveSelectionBy(toStart ? -1 : 1, e.shiftKey);
    }
    return;
  }

  if (e.key === 'Escape') {
    deselectAll();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selection.size) {
      e.preventDefault();
      deletePages(selectionIds());
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    moveFocus(1, e.shiftKey);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    moveFocus(-1, e.shiftKey);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveFocus(gridColumns(), e.shiftKey);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveFocus(-gridColumns(), e.shiftKey);
  } else if (e.key === 'Enter' && state.focusId) {
    openPreview(state.focusId);
  } else if ((e.key === '[' || e.key === ']') && state.selection.size) {
    rotatePages(selectionIds(), e.key === '[' ? -90 : 90);
  }
});

/* ========================= Global drag & drop ========================= */
let dragDepth = 0;
const overlay = $('drop-overlay');
function isFileDrag(e) {
  return e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
}
window.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth++;
  overlay.classList.add('active');
});
window.addEventListener('dragover', (e) => {
  if (isFileDrag(e)) e.preventDefault();
});
window.addEventListener('dragleave', (e) => {
  if (!isFileDrag(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) overlay.classList.remove('active');
});
window.addEventListener('drop', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth = 0;
  overlay.classList.remove('active');
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    addFiles(e.dataTransfer.files);
  }
});

/* ========================= Wiring: toolbar & buttons ========================= */
const fileInput = $('file-input');
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) addFiles(fileInput.files);
  fileInput.value = '';
});
const openPicker = () => fileInput.click();
$('add-files').addEventListener('click', openPicker);
$('empty-add').addEventListener('click', openPicker);

$('select-all').addEventListener('click', selectAll);
$('deselect').addEventListener('click', deselectAll);
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);

$('act-rotate-l').addEventListener('click', () => rotatePages(selectionIds(), -90));
$('act-rotate-r').addEventListener('click', () => rotatePages(selectionIds(), 90));
$('act-delete').addEventListener('click', () => deletePages(selectionIds()));
$('act-export-selected').addEventListener('click', () => {
  const pages = state.pages.filter((p) => state.selection.has(p.id));
  const base = ($('output-name').value || 'workspace.pdf').replace(/\.pdf$/i, '');
  exportPages(pages, `${base}-selection.pdf`);
});
$('act-export-all').addEventListener('click', () => {
  exportPages(state.pages.slice(), $('output-name').value);
});

// Sidebar collapse
const app = $('app');
function isMobile() {
  return window.matchMedia('(max-width: 760px)').matches;
}
if (isMobile()) app.classList.add('sidebar-collapsed');
$('sidebar-toggle').addEventListener('click', () => {
  const collapsed = app.classList.toggle('sidebar-collapsed');
  $('sidebar-toggle').setAttribute('aria-expanded', String(!collapsed));
});
$('sidebar-scrim').addEventListener('click', () => {
  app.classList.add('sidebar-collapsed');
});

// Zoom slider
const zoom = $('zoom');
let zoomTimer = null;
zoom.addEventListener('input', () => {
  state.thumbW = parseInt(zoom.value, 10);
  document.documentElement.style.setProperty('--thumb-w', `${state.thumbW}px`);
  // Debounce re-render of visible thumbnails at the new size.
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => {
    visiblePages.forEach((id) => ensureThumb(id));
  }, 140);
});

// Theme toggle (persisted)
const THEME_KEY = 'pdfws-theme';
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode / storage disabled — theme just won't persist */
  }
  $('theme-toggle').setAttribute('aria-pressed', String(t === 'dark'));
}
(function initTheme() {
  let t;
  try {
    t = localStorage.getItem(THEME_KEY);
  } catch {
    /* storage may be unavailable; fall back to the OS preference below */
  }
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(t);
})();
$('theme-toggle').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// Warn before leaving with unsaved work.
window.addEventListener('beforeunload', (e) => {
  if (state.dirty && state.pages.length) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Initialise thumbnail width var + first paint (shows the empty state).
document.documentElement.style.setProperty('--thumb-w', `${state.thumbW}px`);
renderAll();
