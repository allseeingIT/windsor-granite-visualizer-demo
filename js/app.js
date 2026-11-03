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
  const fileInput = document.getElementById("file-input");

  /** @type {HTMLImageElement|null} */
  let baseImage = null;
  /** @type {{points: {x:number,y:number}[]}[]} */
  let polygons = [];
  /** @type {{x:number,y:number}[]} */
  let draft = [];
  /** @type {string|null} */
  let selectedSlabId = null;
  /** @type {Map<string, HTMLImageElement>} */
  const slabImages = new Map();
  /** @type {Array<{id:string,name:string,file:string,kind:string}>} */
  let slabs = [];
  let showBefore = false;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

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
    btnBeforeAfter.textContent = showBefore ? "Show after" : "Show before";
    btnBeforeAfter.classList.toggle("active", showBefore);
  }

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
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

  async function setBaseImage(img) {
    baseImage = img;
    polygons = [];
    draft = [];
    showBefore = false;
    stageWrap.classList.add("has-image");
    fitCanvasToImage(img);
    await render();
    setStatus("Tap the corners of each countertop area, then Done shape.");
    syncButtons();
  }

  async function useSample() {
    try {
      const img = await loadImageFromURL("assets/samples/sample-kitchen.png");
      await setBaseImage(img);
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
      await setBaseImage(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus("Could not open that photo.");
    };
    img.src = url;
  }

  function undo() {
    if (draft.length) draft.pop();
    else if (polygons.length) polygons.pop();
    render();
    syncButtons();
  }

  function clearAll() {
    polygons = [];
    draft = [];
    showBefore = false;
    render();
    setStatus("Shapes cleared. Tap corners to mark the countertop.");
    syncButtons();
  }

  function doneShape() {
    if (draft.length < 3) return;
    polygons.push({ points: draft.slice() });
    draft = [];
    render();
    setStatus(
      selectedSlabId
        ? "Shape added. Tap another area or pick a sample color."
        : "Shape added. Pick a sample color below."
    );
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
    const a = document.createElement("a");
    a.download = "windsor-granite-visualizer.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
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

    const den =
      s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
    if (Math.abs(den) < 1e-6) {
      destCtx.restore();
      return;
    }
    const m11 =
      (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
    const m12 =
      (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
    const m13 =
      (d0.x * (s1.x * s2.y - s2.x * s1.y) +
        d1.x * (s2.x * s0.y - s0.x * s2.y) +
        d2.x * (s0.x * s1.y - s1.x * s0.y)) /
      den;
    const m21 =
      (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
    const m22 =
      (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
    const m23 =
      (d0.y * (s1.x * s2.y - s2.x * s1.y) +
        d1.y * (s2.x * s0.y - s0.x * s2.y) +
        d2.y * (s0.x * s1.y - s1.x * s0.y)) /
      den;

    destCtx.setTransform(m11, m21, m12, m22, m13, m23);
    destCtx.drawImage(tex, 0, 0);
    destCtx.restore();
  }

  function drawTexturedQuad(destCtx, tex, quad) {
    const [p0, p1, p2, p3] = quad;
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const u0 = i / steps;
        const v0 = j / steps;
        const u1 = (i + 1) / steps;
        const v1 = (j + 1) / steps;
        const d00 = bilinear(p0, p1, p2, p3, u0, v0);
        const d10 = bilinear(p0, p1, p2, p3, u1, v0);
        const d11 = bilinear(p0, p1, p2, p3, u1, v1);
        const d01 = bilinear(p0, p1, p2, p3, u0, v1);
        const sx0 = u0 * tex.naturalWidth;
        const sy0 = v0 * tex.naturalHeight;
        const sx1 = u1 * tex.naturalWidth;
        const sy1 = v1 * tex.naturalHeight;
        drawTexturedTriangle(
          destCtx, tex,
          { x: sx0, y: sy0 }, { x: sx1, y: sy0 }, { x: sx1, y: sy1 },
          d00, d10, d11
        );
        drawTexturedTriangle(
          destCtx, tex,
          { x: sx0, y: sy0 }, { x: sx1, y: sy1 }, { x: sx0, y: sy1 },
          d00, d11, d01
        );
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

  function orderQuad(points) {
    if (points.length !== 4) return points;
    const cx = points.reduce((s, p) => s + p.x, 0) / 4;
    const cy = points.reduce((s, p) => s + p.y, 0) / 4;
    const sorted = points
      .slice()
      .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    let start = 0;
    let best = Infinity;
    for (let i = 0; i < 4; i++) {
      const score = sorted[i].x + sorted[i].y;
      if (score < best) {
        best = score;
        start = i;
      }
    }
    const ordered = [];
    for (let i = 0; i < 4; i++) ordered.push(sorted[(start + i) % 4]);
    return ordered;
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
    const scale = Math.max(b.w / tex.naturalWidth, b.h / tex.naturalHeight) * 1.15;
    const tw = tex.naturalWidth * scale;
    const th = tex.naturalHeight * scale;
    const ox = b.minX + (b.w - tw) / 2;
    const oy = b.minY + (b.h - th) / 2;
    destCtx.drawImage(tex, ox, oy, tw, th);
    destCtx.restore();
  }

  function applySlabToPolygon(workCtx, sourceCtx, tex, points) {
    const b = boundsOf(points);
    if (b.w < 2 || b.h < 2) return;

    const pad = 6;
    const x0 = Math.max(0, Math.floor(b.minX - pad));
    const y0 = Math.max(0, Math.floor(b.minY - pad));
    const x1 = Math.min(workCtx.canvas.width, Math.ceil(b.maxX + pad));
    const y1 = Math.min(workCtx.canvas.height, Math.ceil(b.maxY + pad));
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw < 1 || bh < 1) return;

    // Full-size temp so transforms use absolute canvas coords, then crop
    const full = document.createElement("canvas");
    full.width = workCtx.canvas.width;
    full.height = workCtx.canvas.height;
    const fctx = full.getContext("2d");

    if (points.length === 4) {
      drawTexturedQuad(fctx, tex, orderQuad(points));
    } else {
      drawPolygonFillPattern(fctx, tex, points);
    }

    // Hard mask
    const mask = document.createElement("canvas");
    mask.width = full.width;
    mask.height = full.height;
    const mctx = mask.getContext("2d");
    mctx.beginPath();
    mctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) mctx.lineTo(points[i].x, points[i].y);
    mctx.closePath();
    mctx.fillStyle = "#ffffff";
    mctx.fill();

    // Soft feather
    const soft = document.createElement("canvas");
    soft.width = full.width;
    soft.height = full.height;
    const sctx = soft.getContext("2d");
    sctx.filter = "blur(1.5px)";
    sctx.drawImage(mask, 0, 0);

    fctx.globalCompositeOperation = "destination-in";
    fctx.drawImage(soft, 0, 0);
    fctx.globalCompositeOperation = "source-over";

    // Luminance multiply with original photo
    const srcData = sourceCtx.getImageData(x0, y0, bw, bh);
    const layData = fctx.getImageData(x0, y0, bw, bh);
    const S = srcData.data;
    const L = layData.data;
    for (let i = 0; i < L.length; i += 4) {
      if (L[i + 3] < 3) continue;
      const lum = (0.2126 * S[i] + 0.7152 * S[i + 1] + 0.0722 * S[i + 2]) / 255;
      const m = 0.32 + 0.95 * lum;
      L[i] = Math.min(255, L[i] * m);
      L[i + 1] = Math.min(255, L[i + 1] * m);
      L[i + 2] = Math.min(255, L[i + 2] * m);
    }
    // Write blended region onto a small canvas then composite
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
    ctx.lineWidth = 2 * dpr;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (closed) ctx.closePath();
    ctx.stroke();
  }

  function drawOverlayGuides(faint) {
    ctx.save();
    if (faint) ctx.globalAlpha = 0.35;
    for (const poly of polygons) {
      strokePoly(poly.points, faint ? "rgba(255,255,255,0.9)" : "rgba(61,90,76,0.95)", true);
    }
    ctx.restore();
    if (draft.length) {
      strokePoly(draft, "rgba(255,220,100,0.95)", false);
      for (const p of draft) {
        ctx.beginPath();
        ctx.fillStyle = "#ffdc64";
        ctx.arc(p.x, p.y, 5 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
      for (const poly of polygons) {
        applySlabToPolygon(wctx, sctx, tex, poly.points);
      }
      ctx.drawImage(work, 0, 0);
      drawOverlayGuides(true);
    } else {
      drawOverlayGuides(false);
    }
  }

  function addPoint(x, y) {
    draft.push({ x, y });
    render();
    syncButtons();
    setStatus(
      draft.length < 3
        ? `Point ${draft.length} — need at least 3, then Done shape.`
        : `Point ${draft.length} — tap Done shape, or keep adding points.`
    );
  }

  let ignoreClickUntil = 0;
  canvas.addEventListener("click", (e) => {
    if (!baseImage) return;
    if (Date.now() < ignoreClickUntil) return;
    const p = canvasPointFromEvent(e);
    addPoint(p.x, p.y);
  });

  canvas.addEventListener(
    "touchend",
    (e) => {
      if (!baseImage) return;
      e.preventDefault();
      ignoreClickUntil = Date.now() + 500;
      if (!e.changedTouches || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const x = ((t.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((t.clientY - rect.top) / rect.height) * canvas.height;
      addPoint(x, y);
    },
    { passive: false }
  );

  btnUndo.addEventListener("click", undo);
  btnClear.addEventListener("click", clearAll);
  btnDone.addEventListener("click", doneShape);
  btnBeforeAfter.addEventListener("click", toggleBeforeAfter);
  btnDownload.addEventListener("click", downloadResult);
  btnSample.addEventListener("click", useSample);
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    onFile(f);
    fileInput.value = "";
  });

  window.addEventListener("resize", () => {
    if (!baseImage) return;
    const prevW = canvas.width;
    const prevH = canvas.height;
    fitCanvasToImage(baseImage);
    const sx = canvas.width / prevW;
    const sy = canvas.height / prevH;
    if (prevW && prevH && Number.isFinite(sx) && Number.isFinite(sy)) {
      for (const poly of polygons) {
        for (const p of poly.points) {
          p.x *= sx;
          p.y *= sy;
        }
      }
      for (const p of draft) {
        p.x *= sx;
        p.y *= sy;
      }
    }
    render();
  });

  // Expose for headless screenshot automation
  window.__viz = {
    useSample,
    doneShape,
    clearAll,
    selectSlab: (id) => {
      selectedSlabId = id;
      showBefore = false;
      for (const el of slabStrip.querySelectorAll(".slab-card")) {
        el.classList.toggle("selected", el.dataset.id === id);
      }
      const meta = slabs.find((s) => s.id === id);
      const name = meta ? meta.name : id;
      render();
      syncButtons();
      setStatus(
        polygons.length
          ? `Showing ${name}. Toggle Before/After or mark another area.`
          : `${name} selected. Mark the countertop first.`
      );
    },
    addPolygon: (pts) => {
      polygons.push({
        points: pts.map((p) => ({
          x: p.x * canvas.width,
          y: p.y * canvas.height,
        })),
      });
      draft = [];
      render();
      syncButtons();
      setStatus(
        selectedSlabId
          ? "Shape added. Tap another area or pick a sample color."
          : "Shape added. Pick a sample color below."
      );
    },
    getState: () => ({
      polygons: polygons.length,
      selectedSlabId,
      showBefore,
      w: canvas.width,
      h: canvas.height,
    }),
  };

  syncButtons();
  loadSlabs()
    .then(() => useSample())
    .catch(() => setStatus("Could not load sample colors."));

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
      btn.addEventListener("click", () => {
        selectedSlabId = s.id;
        showBefore = false;
        for (const el of slabStrip.querySelectorAll(".slab-card")) {
          el.classList.toggle("selected", el.dataset.id === s.id);
        }
        render();
        syncButtons();
        setStatus(
          polygons.length
            ? `Showing ${s.name}. Toggle Before/After or mark another area.`
            : `${s.name} selected. Mark the countertop first.`
        );
      });
      slabStrip.appendChild(btn);
    }
  }
})();
