# Independent ship-gate review — Windsor Granite visualizer (revision)

Date: 2026-11-02 America/Chicago  
Reviewer: fresh checklist pass (not builder self-grade)  
Crops inspected: `shots/inspect-390-edgeL.png`, `inspect-390-edgeR.png`, `inspect-390-sink.png`, `inspect-v6-edgeL-compare.png`, `inspect-v6-edgeR-compare.png`, `inspect-v6-sink-compare.png`, plus full `before/after-{390,360,1280}.png`.

| Item | Verdict | Note / crop |
|---|---|---|
| Static site, photos stay on device | **PASS** | objectURL uploads; no backend |
| Real Wikimedia stone swatches (not flat noise) | **PASS** | 8 Commons polished-stone photos; credited |
| Sample kitchen openly licensed + credited | **PASS** | Emerald Pearl Kitchen, CC BY 3.0 |
| Pre-traced sample mask present (one-tap) | **PASS** | `sample-mask.json` + soft PNG; Apply sample mask |
| Manual tap masking still available | **PASS** | Done shape / Undo / Clear |
| **Mask edges align with real counter at 100% zoom** | **FAIL** | `inspect-390-edgeL/R`, `inspect-v6-*-compare`: overlay misses bullnose, bleeds past front edge / into sink or cabinets |
| **Sink cutout respected** | **FAIL** | `inspect-390-sink`, `inspect-v6-sink-compare`: texture crosses basin / faucet deck incorrectly |
| Perspective matches counter plane | **FAIL** | After frames: slab reads as flat slanted bands, not seated on the plane |
| Luminance blend keeps photo lighting/reflections | **FAIL** | Crops show sticker-like / ghostly paste; highlights not convincingly carried |
| 1–2px feather, no visible outline | **PARTIAL** | Soft mask blur present; no edit outlines on sample after — still hard/jagged in places |
| Would a homeowner believe the counter was replaced? | **FAIL** | Core realism gate — no |
| Header / footer / call line / Sample colors disclaimer | **PASS** | Verified in after-390 DOM + screenshot |
| No pills/badges | **PASS** | |
| Status text not debug-like | **PASS** | e.g. “Showing Impala Black.” |
| Vertical spacing tighter on 390 | **PASS** | Photo higher; reduced gaps |
| Screenshots 390/360/1280 before+after | **PASS** | Present under `shots/` |
| Public https redeployed | **PASS** | same Pages URL |

**Summary:** 10 PASS, 1 PARTIAL, 4 FAIL (realism cluster).

## Overall
**FAIL — do not send to Scott / owner until mask + blend pass the 100% edge crops and the homeowner-belief test.**
