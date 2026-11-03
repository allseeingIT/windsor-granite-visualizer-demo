# Independent ship-gate review — v3 pre-rendered scene swaps

Date: 2026-11-02 America/Chicago  
Approach: commercial-style pre-made rooms + AI-edited slab variants (no customer photo masking)  
Artifacts: `shots/v3/` · Drift: `assets/scenes/drift-report.json`

## Build summary
- 3 example rooms (AI-generated): farmhouse island, modern L-run, bathroom vanity
- 6 sample colors per room (Commons swatch–matched edits): Impala Black, Absolute Black, Tan Brown, Dakota Mahogany, Statuarietto, Polished Grey → **18 variants**
- App: scene picker + swatch buttons + crossfade before/after; **no photo upload**; no “coming soon”
- Labels: “Example rooms” / “Sample colors, not Windsor Granite Co. inventory”; AI rooms disclosed; Commons credits; quote `(660) 596-1704`; footer ALLSEEING RESEARCH SERVICES

## Rejected / regenerated
| Item | Count | Note |
|---|---:|---|
| Variants rejected for wrong stone color (visual) | **1** | `vanity/impala-black` v1 came out brown — regenerated to dark Impala |
| Variants rejected by pixel-diff drift (outside counter) | **0** | All 18 finals PASS (`mae_floor` ≤ 8.0, `mae_out` ≤ 15.1, `edge_diff` ≤ 14.8) |
| Failed GenerateImage calls (path constraint) | 4 | Retried with `/workspace` swatch paths — not counted as product rejects |

## Checklist

| Item | Verdict | Evidence |
|---|---|---|
| Phone-first UI, no pills/badges | **PASS** | `shots/v3/after-390.png` |
| Scene picker “Example rooms” | **PASS** | after-390 |
| Swatches “Sample colors, not Windsor inventory” | **PASS** | after-390 copy |
| AI rooms disclosed (not shop installs) | **PASS** | after-390 disclaimer |
| Commons swatch credit | **PASS** | after-390 / LICENSES.md |
| No customer upload / no coming-soon | **PASS** | index.html |
| Quote phone + footer | **PASS** | after-390 |
| Before/after crossfade toggle | **PASS** | before-390 / after-390 |
| Screenshots 390 / 360 / 1280 | **PASS** | `shots/v3/{before,after}-{390,360,1280}.png` |
| Drift check outside counter | **PASS** | drift-report.json — 0 rejects of 18 |
| 100% edge crops believable | **PASS** | `crop-*-edge.png` — eased edge + cabinet joint clean |
| 100% sink crops believable | **PASS** | `crop-*-sink.png` — undermount lip + faucet unchanged |
| Homeowner-believability (every spot-checked variant) | **PASS** | farmhouse Impala, modern-L Statuarietto/Tan Brown, vanity Absolute Black/Statuarietto — stone reads as installed slab, not paste |

## Overall
**PASS — redeploy allowed.**
