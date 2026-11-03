(() => {
  "use strict";

  const sceneStrip = document.getElementById("scene-strip");
  const slabStrip = document.getElementById("slab-strip");
  const imgBase = document.getElementById("img-base");
  const imgVariant = document.getElementById("img-variant");
  const statusEl = document.getElementById("status");
  const btnBeforeAfter = document.getElementById("btn-before-after");
  const creditEl = document.getElementById("photo-credit");

  let scenes = [];
  let stones = [];
  let sceneId = null;
  let stoneId = null;
  let showBefore = false;
  const cache = new Map();

  function setStatus(msg) {
    statusEl.textContent = msg || "";
  }

  function loadImage(url) {
    if (cache.has(url)) return cache.get(url);
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("load failed: " + url));
      img.src = url;
    });
    cache.set(url, p);
    return p;
  }

  function sceneById(id) {
    return scenes.find((s) => s.id === id);
  }
  function stoneById(id) {
    return stones.find((s) => s.id === id);
  }

  function variantUrl(scene, stone) {
    return `assets/${scene.dir}/${stone.id}.png`;
  }
  function baseUrl(scene) {
    return `assets/${scene.dir}/base.png`;
  }

  function updateCredit() {
    const stone = stoneById(stoneId);
    if (!stone) {
      creditEl.textContent = "";
      return;
    }
    creditEl.textContent = `Stone swatch “${stone.name}”: ${stone.credit} (${stone.license}). Wikimedia Commons.`;
  }

  function syncButtons() {
    btnBeforeAfter.textContent = showBefore ? "Show after" : "Show before";
    btnBeforeAfter.classList.toggle("active", showBefore);
    imgVariant.classList.toggle("is-before", showBefore);
    for (const el of sceneStrip.querySelectorAll(".scene-card")) {
      el.classList.toggle("selected", el.dataset.id === sceneId);
    }
    for (const el of slabStrip.querySelectorAll(".slab-card")) {
      el.classList.toggle("selected", el.dataset.id === stoneId);
    }
  }

  async function applyView() {
    const scene = sceneById(sceneId);
    const stone = stoneById(stoneId);
    if (!scene || !stone) return;
    const bUrl = baseUrl(scene);
    const vUrl = variantUrl(scene, stone);
    setStatus("Loading…");
    try {
      await Promise.all([loadImage(bUrl), loadImage(vUrl)]);
      imgBase.src = bUrl;
      imgVariant.src = vUrl;
      imgBase.alt = `${scene.name} before`;
      imgVariant.alt = `${scene.name} with ${stone.name}`;
      updateCredit();
      syncButtons();
      setStatus(showBefore ? `Before — ${scene.name}.` : `Showing ${stone.name} on ${scene.name}.`);
    } catch (e) {
      setStatus("Could not load that room or color.");
    }
  }

  async function selectScene(id) {
    if (sceneId === id) return;
    sceneId = id;
    showBefore = false;
    await applyView();
  }

  async function selectStone(id) {
    if (stoneId === id && !showBefore) {
      syncButtons();
      return;
    }
    stoneId = id;
    showBefore = false;
    await applyView();
  }

  btnBeforeAfter.addEventListener("click", () => {
    showBefore = !showBefore;
    syncButtons();
    const scene = sceneById(sceneId);
    const stone = stoneById(stoneId);
    if (!scene || !stone) return;
    setStatus(showBefore ? `Before — ${scene.name}.` : `Showing ${stone.name} on ${scene.name}.`);
  });

  function buildSceneCards() {
    sceneStrip.innerHTML = "";
    for (const s of scenes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scene-card";
      btn.dataset.id = s.id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", s.name);
      const img = document.createElement("img");
      img.src = `assets/scenes/_thumbs/${s.id}.jpg`;
      img.alt = "";
      const label = document.createElement("span");
      label.textContent = s.name;
      btn.appendChild(img);
      btn.appendChild(label);
      btn.addEventListener("click", () => selectScene(s.id));
      sceneStrip.appendChild(btn);
    }
  }

  function buildStoneCards() {
    slabStrip.innerHTML = "";
    for (const s of stones) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slab-card";
      btn.dataset.id = s.id;
      btn.setAttribute("aria-label", s.name);
      const img = document.createElement("img");
      img.src = "assets/" + s.swatch;
      img.alt = "";
      const label = document.createElement("span");
      label.textContent = s.name;
      btn.appendChild(img);
      btn.appendChild(label);
      btn.addEventListener("click", () => selectStone(s.id));
      slabStrip.appendChild(btn);
    }
  }

  window.__viz = {
    selectScene: (id) => selectScene(id),
    selectStone: (id) => selectStone(id),
    toggleBefore: () => btnBeforeAfter.click(),
    getState: () => ({ sceneId, stoneId, showBefore }),
  };

  fetch("assets/scenes/scenes.json")
    .then((r) => r.json())
    .then(async (data) => {
      scenes = data.scenes || [];
      stones = data.stones || [];
      buildSceneCards();
      buildStoneCards();
      sceneId = scenes[0] && scenes[0].id;
      stoneId = stones[0] && stones[0].id;
      await applyView();
      // warm cache of remaining variants for current scene
      const scene = sceneById(sceneId);
      if (scene) {
        for (const st of stones) loadImage(variantUrl(scene, st)).catch(() => {});
      }
    })
    .catch(() => setStatus("Could not load example rooms."));
})();
