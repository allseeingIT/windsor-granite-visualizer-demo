# Independent ship-gate review — attempt 2 (SAM + easier photo + homography)

Date: 2026-11-02 America/Chicago  
Live URL: **not redeployed** (prior FAIL build still at https://allseeingit.github.io/windsor-granite-visualizer-demo/)  
Artifacts: `shots/attempt2/`

## What was attempted

1. **Sample photo swap** — evaluated openly licensed kitchens:
   - `white_ct` (near-frontal white marble island) — rejected: white-on-white defeated SAM
   - `wm04` / `wm05` (L-run speckled granite) — rejected: clutter + SAM grabbed cabinets
   - `efta3` (frontal granite + sink, Public Domain EFTA) — rejected: counter band ~60px deep; warp reads as a flat sticker bar; sink cutout messy
   - **`wm03` (elevated salt-and-pepper island, Public Domain EFTA00002083)** — chosen: largest readable plane, good contrast, near-top-down enough for affine/homography

2. **Machine mask** — Segment Anything `vit_b` on CPU (`sam_vit_b_01ec64.pth`):
   - Prompted `SamPredictor` (points + box)
   - `SamAutomaticMaskGenerator` (best hit: area≈70239, iou≈0.975 on island band)
   - Morph open/close, hole-fill, front-edge clip
   - GrabCut seeded from polys (failed: followed bad seeds into cabinets/waterfall)
   - Geometric clean quad snapped from SAM extrema / grid (covers full island top, no object holes)

3. **Render** — offline composite matching the brief:
   - Homography from 4-corner quad → slab texture at coarse grain (~70–85% of slab across the run)
   - Original luminance multiply (`0.30 + ~1.0·L`)
   - Specular screen pass from base highlights
   - Front-edge darken strip
   - Soft mask Gaussian σ≈1.2 (≈1–2px feather)

## Checklist

| Item | Verdict | Note / crop |
|---|---|---|
| Easier licensed kitchen chosen | **PASS** | wm03 Public Domain; also tried efta3/wm04/white_ct |
| Mask produced by machine (SAM / morph), not hand Bezier | **PARTIAL** | SAM auto mask real; final shippable edges still needed geometric snap; neither is edge-clean at 100% |
| Homography / coarse grain warp | **PARTIAL** | Wired offline; mid-surface grain OK; edges kill belief |
| Luminance multiply + specular screen + edge darken + feather | **PARTIAL** | Present in composite; mid crop shows some highlight carry; edges still sticker-like |
| **100% edge crops align with real counter** | **FAIL** | `crop-edgeL-compare.png`, `crop-edgeR-compare.png`: stops short of bullnose, bleeds onto wood panel / microwave, jagged |
| Sink / object boundaries believable | **FAIL** | No sink on wm03 island; objects (fruit, pitcher) either covered as flat stickers or punched with halos (`crop-mid-compare.png`, `crop-sam-mid-compare.png`) |
| Homeowner-believability (“was the counter replaced?”) | **FAIL** | Mid-island dark stone is the closest yet, but edges + object treatment break the illusion immediately |
| Would redeploy to same Pages URL? | **NO** | Gate requires PASS |

## Why it still fails (exact)

1. **SAM vit_b cannot lock a clean counter-plane silhouette** on the available Commons/EFTA kitchens. Best auto mask (wm03 #98) scores high on IoU but still misses the left island run, skips the bullnose, and spills toward the wood end panel. Prompted / GrabCut runs were worse (cabinets, floor, waterfall).
2. **Geometric quad fallback** (allowed when angled photos fail) gets full coverage but **corners are off by several pixels** at 100% zoom — enough that the front edge and side panel read as paste, not stone.
3. **Clutter on the best geometry photo** (fruit bowl, pitcher, cable) forces a lose-lose: cover them (stone “eats” objects) or punch them (halos). Either fails the homeowner test.
4. **Frontal shallow counters** (efta3) are easy to affine-warp but have too little surface depth; the result is a flat textured bar, not a slab.

## Best before / after (do not ship)

| File | What |
|---|---|
| `shots/attempt2/before-wm03.png` | Best sample kitchen (before) |
| `shots/attempt2/after-wm03-impala-sam.png` | Best SAM-mask composite (Impala Black) — mid-surface closest to real |
| `shots/attempt2/after-wm03-impala-quad.png` | Best full-coverage quad composite (Impala Black) |
| `shots/attempt2/after-390.png` / `before-390.png` | Phone-width pair |
| `shots/attempt2/crop-*-compare.png` | 100% edge / mid evidence of FAIL |

## Overall

**FAIL — stop. Do not redeploy.**

Next unlock (if Scott wants another pass): a **clean empty counter photo** (no clutter, clear bullnose, medium tone stone or wood against contrasting cabinets), shot near-frontal or slightly elevated, plus either SAM2 with a better checkpoint or a short human corner-click that *seeds* SAM rather than defining the final polygon. Until edges pass 100% crops, the demo stays offline.
