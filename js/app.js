(() => {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const stageWrap = document.getElementById("stage-wrap");
  const statusEl = document.getElementById("status");
  const slabStrip = document.getElementById("slab-strip");
  const btnUndo = document.getElementById("btn-undo");
  const btnClear = document.getElementById("btn-clear");
  const btnDone = document.getElementById("btn-done-shape");
  const btnBeforeAfter = document.getElementById("btn-before-after");
  const btnDownload = document.getElementById("btn-download");
  const btnSample = document.getElementById("btn-sample");
  const btnApplyMask = document.getElementById("btn-apply-mask");
  const fileInput = document.getElementById("file-input");

  let baseImage = null;
  let usingSample = false;
  let polygons = [];
  let draft = [];
  let selectedSlabId = null;
  const slabImages = new Map();
  let slabs = [];
  let sampleMask = null; // {polygons:[{name,points:[{x,y}]}]}
  let sampleMaskImage = null; // HTMLImageElement alpha mask
  let showBefore = false;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let ignoreClickUntil = 0;
  let editingGuides = false; // show outlines only while actively editing

  function setStatus(msg) {
    statusEl.textContent = msg || "";
  }

  function syncButtons() {
    const hasImg = !!baseImage;
    const hasPoly = polygons.length > 0 || draft.length > 0;
    btnUndo.disabled = !hasImg || (!draft.length && !polygons.length);
    btnClear.disabled = !hasImg || !hasPoly;
    btnDone.disabled = !hasImg || draft.length < 3;
    btnBeforeAfter.disabled = !hasImg || polygons.length === 0 || !selectedSlabId;
    btnDownload.disabled = !hasImg;
    btnApplyMask.disabled = !hasImg || !usingSample || !sampleMask;
    btnBeforeAfter.textContent = showBefore ? "Show after" : "Show before";
    btnBeforeAfter.classList.toggle("active", showBefore);
  }

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function loadImageFromURL(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = url;
    });
  }

  function fitCanvasToImage(img) {
    const maxW = stageWrap.clientWidth || 360;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const cssW = Math.max(1, Math.floor(img.naturalWidth * scale));
    const cssH = Math.max(1, Math.floor(img.naturalHeight * scale));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }

  function normToCanvas(pts) {
    return pts.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height }));
  }

  function applySampleMaskPolygons() {
    if (!sampleMask || !sampleMask.polygons) return;
    polygons = sampleMask.polygons.map((poly) => ({
      points: normToCanvas(poly.points),
      name: poly.name || "",
    }));
    draft = [];
    editingGuides = false;
    showBefore = false;
  }

  async function setBaseImage(img, isSample) {
    baseImage = img;
    usingSample = !!isSample;
    polygons = [];
    draft = [];
    showBefore = false;
    editingGuides = !isSample;
    stageWrap.classList.add("has-image");
    fitCanvasToImage(img);
    if (isSample && sampleMask) {
      applySampleMaskPolygons();
      if (!selectedSlabId && slabs.length) {
        selectSlab(slabs[0].id, true);
      }
      setStatus("Sample kitchen ready — pick a stone color.");
    } else {
      await render();
      setStatus("Tap the corners of each countertop area, then Done shape.");
    }
    await render();
    syncButtons();
  }

  async function useSample() {
    try {
      const img = await loadImageFromURL("assets/samples/sample-kitchen.png");
      await setBaseImage(img, true);
    } catch (err) {
      setStatus("Could not load the sample kitchen.");
    }
  }

  function onFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("Please choose a photo (JPG or PNG).");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      await setBaseImage(img, false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus("Could not open that photo.");
    };
    img.src = url;
  }

  function undo() {
    editingGuides = true;
    if (draft.length) draft.pop();
    else if (polygons.length) polygons.pop();
    render();
    syncButtons();
  }

  function clearAll() {
    polygons = [];
    draft = [];
    showBefore = false;
    editingGuides = true;
    render();
    setStatus(usingSample ? "Mask cleared. Apply sample mask, or tap corners yourself." : "Shapes cleared. Tap corners to mark the countertop.");
    syncButtons();
  }

  function doneShape() {
    if (draft.length < 3) return;
    polygons.push({ points: draft.slice() });
    draft = [];
    editingGuides = true;
    render();
    setStatus(selectedSlabId ? "Area added. Pick a color or mark another area." : "Area added. Pick a sample color.");
    syncButtons();
  }

  function toggleBeforeAfter() {
    if (!polygons.length || !selectedSlabId) return;
    showBefore = !showBefore;
    render();
    syncButtons();
  }

  function downloadResult() {
    if (!baseImage) return;
    // Render without guides for download
    const prev = editingGuides;
    editingGuides = false;
    const wasBefore = showBefore;
    showBefore = false;
    render().then(() => {
      const a = document.createElement("a");
      a.download = "windsor-granite-visualizer.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      editingGuides = prev;
      showBefore = wasBefore;
      render();
    });
  }

  function selectSlab(id, quiet) {
    selectedSlabId = id;
    showBefore = false;
    for (const el of slabStrip.querySelectorAll(".slab-card")) {
      el.classList.toggle("selected", el.dataset.id === id);
    }
    const meta = slabs.find((s) => s.id === id);
    const name = meta ? meta.name : id;
    render();
    syncButtons();
    if (!quiet) {
      setStatus(polygons.length ? `Showing ${name}.` : `${name} selected — mark the countertop next.`);
    }
    if (meta && (meta.credit || meta.license)) {
      const credit = document.getElementById("photo-credit");
      if (credit) {
        credit.textContent =
          `Sample kitchen: Emerald Pearl Kitchen (CC BY 3.0). Stone swatch “${name}”: ${meta.credit || "Wikimedia Commons"} (${meta.license || "see LICENSES"}).`;
      }
    }
  }

  function orderQuad(points) {
    if (points.length !== 4) return points;
    const cx = points.reduce((s, p) => s + p.x, 0) / 4;
    const cy = points.reduce((s, p) => s + p.y, 0) / 4;
    const sorted = points.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    let start = 0, best = Infinity;
    for (let i = 0; i < 4; i++) {
      const score = sorted[i].x + sorted[i].y;
      if (score < best) { best = score; start = i; }
    }
    return [0,1,2,3].map((i) => sorted[(start + i) % 4]);
  }

  function bilinear(p0, p1, p2, p3, u, v) {
    const topX = p0.x + (p1.x - p0.x) * u;
    const topY = p0.y + (p1.y - p0.y) * u;
    const botX = p3.x + (p2.x - p3.x) * u;
    const botY = p3.y + (p2.y - p3.y) * u;
    return { x: topX + (botX - topX) * v, y: topY + (botY - topY) * v };
  }

  function drawTexturedTriangle(destCtx, tex, s0, s1, s2, d0, d1, d2) {
    destCtx.save();
    destCtx.beginPath();
    destCtx.moveTo(d0.x, d0.y);
    destCtx.lineTo(d1.x, d1.y);
    destCtx.lineTo(d2.x, d2.y);
    destCtx.closePath();
    destCtx.clip();
    const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
    if (Math.abs(den) < 1e-6) { destCtx.restore(); return; }
    const m11 = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
    const m12 = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
    const m13 = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / den;
    const m21 = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
    const m22 = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
    const m23 = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / den;
    destCtx.setTransform(m11, m21, m12, m22, m13, m23);
    destCtx.drawImage(tex, 0, 0);
    destCtx.restore();
  }

  function drawTexturedQuad(destCtx, tex, quad) {
    const [p0, p1, p2, p3] = quad;
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const u0 = i / steps, v0 = j / steps, u1 = (i + 1) / steps, v1 = (j + 1) / steps;
        const d00 = bilinear(p0, p1, p2, p3, u0, v0);
        const d10 = bilinear(p0, p1, p2, p3, u1, v0);
        const d11 = bilinear(p0, p1, p2, p3, u1, v1);
        const d01 = bilinear(p0, p1, p2, p3, u0, v1);
        const sx0 = u0 * tex.naturalWidth, sy0 = v0 * tex.naturalHeight;
        const sx1 = u1 * tex.naturalWidth, sy1 = v1 * tex.naturalHeight;
        drawTexturedTriangle(destCtx, tex, {x:sx0,y:sy0},{x:sx1,y:sy0},{x:sx1,y:sy1}, d00,d10,d11);
        drawTexturedTriangle(destCtx, tex, {x:sx0,y:sy0},{x:sx1,y:sy1},{x:sx0,y:sy1}, d00,d11,d01);
      }
    }
  }

  function boundsOf(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  function drawPolygonFillPattern(destCtx, tex, points) {
    const b = boundsOf(points);
    if (b.w < 2 || b.h < 2) return;
    destCtx.save();
    destCtx.beginPath();
    destCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) destCtx.lineTo(points[i].x, points[i].y);
    destCtx.closePath();
    destCtx.clip();
    // Scale texture to cover with natural grain size
    const cover = Math.max(b.w / tex.naturalWidth, b.h / tex.naturalHeight) * 1.05;
    const tw = tex.naturalWidth * cover;
    const th = tex.naturalHeight * cover;
    destCtx.drawImage(tex, b.minX + (b.w - tw) / 2, b.minY + (b.h - th) / 2, tw, th);
    destCtx.restore();
  }

  function orientedQuad(points) {
    // Fit a perspective quad from polygon extremes along dominant axes
    const b = boundsOf(points);
    // Find points nearest each corner of the bounding box
    const corners = [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ];
    return corners.map((c) => {
      let best = points[0], bestD = Infinity;
      for (const p of points) {
        const d = (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      return { x: best.x, y: best.y };
    });
  }

  function applySlabToPolygon(workCtx, sourceCtx, tex, points) {
    const b = boundsOf(points);
    if (b.w < 2 || b.h < 2) return;
    const pad = 4;
    const x0 = Math.max(0, Math.floor(b.minX - pad));
    const y0 = Math.max(0, Math.floor(b.minY - pad));
    const x1 = Math.min(workCtx.canvas.width, Math.ceil(b.maxX + pad));
    const y1 = Math.min(workCtx.canvas.height, Math.ceil(b.maxY + pad));
    const bw = x1 - x0, bh = y1 - y0;
    if (bw < 1 || bh < 1) return;

    const full = document.createElement("canvas");
    full.width = workCtx.canvas.width;
    full.height = workCtx.canvas.height;
    const fctx = full.getContext("2d");

    // Warp texture through an oriented quad, then clip to true polygon via mask
    const quad = points.length === 4 ? orderQuad(points) : orientedQuad(points);
    drawTexturedQuad(fctx, tex, quad);

    // Soft mask 1–2px feather
    const mask = document.createElement("canvas");
    mask.width = full.width;
    mask.height = full.height;
    const mctx = mask.getContext("2d");
    mctx.beginPath();
    mctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) mctx.lineTo(points[i].x, points[i].y);
    mctx.closePath();
    mctx.fillStyle = "#fff";
    mctx.fill();
    const soft = document.createElement("canvas");
    soft.width = full.width;
    soft.height = full.height;
    const sctx = soft.getContext("2d");
    sctx.filter = "blur(1.1px)";
    sctx.drawImage(mask, 0, 0);

    fctx.globalCompositeOperation = "destination-in";
    fctx.drawImage(soft, 0, 0);
    fctx.globalCompositeOperation = "source-over";

    // Luminance multiply — keep photo lighting & reflections
    const srcData = sourceCtx.getImageData(x0, y0, bw, bh);
    const layData = fctx.getImageData(x0, y0, bw, bh);
    const S = srcData.data, L = layData.data;
    for (let i = 0; i < L.length; i += 4) {
      if (L[i + 3] < 2) continue;
      const lum = (0.2126 * S[i] + 0.7152 * S[i + 1] + 0.0722 * S[i + 2]) / 255;
      // Stronger preservation of highlights (reflections) and shadows
      const m = 0.18 + 1.22 * lum;
      L[i] = Math.min(255, L[i] * m);
      L[i + 1] = Math.min(255, L[i + 1] * m);
      L[i + 2] = Math.min(255, L[i + 2] * m);
      // slight soft contrast toward photo
      const a = L[i + 3] / 255;
      L[i] = L[i] * a + S[i] * (1 - a);
      L[i + 1] = L[i + 1] * a + S[i + 1] * (1 - a);
      L[i + 2] = L[i + 2] * a + S[i + 2] * (1 - a);
    }
    const piece = document.createElement("canvas");
    piece.width = bw;
    piece.height = bh;
    piece.getContext("2d").putImageData(layData, 0, 0);
    workCtx.drawImage(piece, x0, y0);
  }

  function strokePoly(points, color, closed) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * dpr;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (closed) ctx.closePath();
    ctx.stroke();
  }

  async function render() {
    if (!baseImage) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    const apply =
      !showBefore && selectedSlabId && polygons.length > 0 && slabImages.has(selectedSlabId);

    if (apply) {
      const source = document.createElement("canvas");
      source.width = canvas.width;
      source.height = canvas.height;
      const sctx = source.getContext("2d", { willReadFrequently: true });
      sctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      const work = document.createElement("canvas");
      work.width = canvas.width;
      work.height = canvas.height;
      const wctx = work.getContext("2d");
      const tex = slabImages.get(selectedSlabId);
      if (usingSample && sampleMaskImage && !editingGuides) {
        applySlabWithBitmapMask(wctx, sctx, tex, sampleMaskImage);
      } else {
        for (const poly of polygons) {
          applySlabToPolygon(wctx, sctx, tex, poly.points);
        }
      }
      ctx.drawImage(work, 0, 0);
    }

    // Guides only while editing (manual tap mode / draft) — never on finished sample demo
    if (editingGuides || draft.length) {
      for (const poly of polygons) strokePoly(poly.points, "rgba(61,90,76,0.85)", true);
      if (draft.length) {
        strokePoly(draft, "rgba(255,220,100,0.95)", false);
        for (const p of draft) {
          ctx.beginPath();
          ctx.fillStyle = "#ffdc64";
          ctx.arc(p.x, p.y, 4 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function addPoint(x, y) {
    editingGuides = true;
    draft.push({ x, y });
    render();
    syncButtons();
    setStatus(draft.length < 3 ? "Keep tapping corners…" : "Tap Done shape when the area is closed.");
  }

  canvas.addEventListener("click", (e) => {
    if (!baseImage) return;
    if (Date.now() < ignoreClickUntil) return;
    const p = canvasPointFromEvent(e);
    addPoint(p.x, p.y);
  });
  canvas.addEventListener("touchend", (e) => {
    if (!baseImage) return;
    e.preventDefault();
    ignoreClickUntil = Date.now() + 500;
    if (!e.changedTouches || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    addPoint(((t.clientX - rect.left) / rect.width) * canvas.width, ((t.clientY - rect.top) / rect.height) * canvas.height);
  }, { passive: false });

  btnUndo.addEventListener("click", undo);
  btnClear.addEventListener("click", clearAll);
  btnDone.addEventListener("click", doneShape);
  btnBeforeAfter.addEventListener("click", toggleBeforeAfter);
  btnDownload.addEventListener("click", downloadResult);
  btnSample.addEventListener("click", useSample);
  btnApplyMask.addEventListener("click", () => {
    applySampleMaskPolygons();
    if (!selectedSlabId && slabs.length) selectSlab(slabs[0].id, true);
    render();
    syncButtons();
    setStatus("Sample mask applied — pick a stone color.");
  });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    onFile(f);
    fileInput.value = "";
  });

  window.addEventListener("resize", () => {
    if (!baseImage) return;
    const prevW = canvas.width, prevH = canvas.height;
    const wasSampleMask = usingSample && !editingGuides && sampleMask;
    fitCanvasToImage(baseImage);
    if (wasSampleMask) {
      applySampleMaskPolygons();
    } else {
      const sx = canvas.width / prevW, sy = canvas.height / prevH;
      if (prevW && prevH && Number.isFinite(sx) && Number.isFinite(sy)) {
        for (const poly of polygons) for (const p of poly.points) { p.x *= sx; p.y *= sy; }
        for (const p of draft) { p.x *= sx; p.y *= sy; }
      }
    }
    render();
  });

  window.__viz = {
    useSample,
    applySampleMask: () => { applySampleMaskPolygons(); render(); syncButtons(); },
    selectSlab: (id) => selectSlab(id),
    clearAll,
    getState: () => ({
      polygons: polygons.length,
      selectedSlabId,
      showBefore,
      usingSample,
      editingGuides,
      w: canvas.width,
      h: canvas.height,
      status: statusEl.textContent,
    }),
  };

  async function loadSlabs() {
    const res = await fetch("assets/slabs/slabs.json");
    const data = await res.json();
    slabs = data.slabs || [];
    slabStrip.innerHTML = "";
    for (const s of slabs) {
      const img = await loadImageFromURL("assets/slabs/" + s.file);
      slabImages.set(s.id, img);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slab-card";
      btn.setAttribute("aria-label", s.name);
      btn.dataset.id = s.id;
      const thumb = document.createElement("img");
      thumb.src = "assets/slabs/" + s.file;
      thumb.alt = "";
      const label = document.createElement("span");
      label.textContent = s.name;
      btn.appendChild(thumb);
      btn.appendChild(label);
      btn.addEventListener("click", () => selectSlab(s.id));
      slabStrip.appendChild(btn);
    }
  }

  async function loadSampleMask() {
    const res = await fetch("assets/samples/sample-mask.json");
    sampleMask = await res.json();
    try {
      sampleMaskImage = await loadImageFromURL("assets/samples/sample-mask-soft.png");
    } catch (e) {
      sampleMaskImage = await loadImageFromURL("assets/samples/sample-mask.png");
    }
  }

  syncButtons();
  Promise.all([loadSlabs(), loadSampleMask()])
    .then(() => useSample())
    .catch(() => setStatus("Could not load sample assets."));
})();
