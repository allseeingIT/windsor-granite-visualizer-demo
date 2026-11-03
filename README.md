# Windsor Granite Co. Countertop Visualizer (demo)

Phone-first static web app. Customer photos never leave the device (no backend).

## Open locally

```bash
cd /workspace/clients/windsor-granite/visualizer
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

Or open `index.html` via any static host. A single-file bundle is not required; all assets are relative.

## How to use (demo script)

1. Tap **Use sample kitchen** (or **Upload photo**).
2. Tap the four corners of each countertop area (add more points for odd shapes). Tap **Done shape** when a region is closed.
3. Pick a **Sample color**. Toggle **Before / After**. Download the result.

## Adding the shop’s real slab photos

1. Drop JPEG/PNG files into `assets/slabs/` (square-ish, well-lit, straight-on crop of the slab face works best).
2. Edit `assets/slabs/slabs.json` — one object per slab:

```json
{ "id": "shop-u-bat", "name": "U Bat Green", "file": "u-bat-green.jpg", "kind": "shop" }
```

3. Reload the page. No code changes.

`kind: "shop"` is reserved for inventory; the UI still labels the strip **Sample colors** until you change that string in `index.html` when going live with real stock.

## Privacy

Canvas processing is entirely in-browser. Uploaded photos are not uploaded anywhere.
