# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A small WebXR garden outside one of the hallway's doors (three.js 0.186, plain ES modules, no
bundler or build step): a lawn, a stream under a foot bridge into a pond, a trail to a bench, and a
book on the bench to read. It is a place behind a door of the Hallway (https://ariamokr.github.io/hallway/,
AriaMoKr/hallway, a checkout at `../hallway`), whose conventions and controls it follows; much of
its code is the hallway's (said so at the top of each such file). `public/` is the whole site.
`README.md` covers using it, what it does with the hallway's door link, the door entry the hallway
would add, and the pictures either side of that door. The hallway has no door here yet: the user
asked for the hallway to be left alone, so change `../hallway` only when asked.

Meant to publish at https://ariamokr.github.io/outside/ from `main` of AriaMoKr/outside by
`.github/workflows/pages.yml` (same origin as the hallway, so the VR hand-over works).

## Commands

```bash
npm install                  # postinstall: tools/vendor.mjs copies three, layersharedsession, Trystero (and IWER) into public/vendor/ (gitignored)
npm start                    # tools/serve.mjs: public/ on http://localhost:8090/ (IPv6 only on Windows; for a Quest: npm start -- --host 127.0.0.1)
npm test                     # node --test "test/*.test.js"
node tools/preview.mjs       # public/hallway-preview.jpg, the garden for the hallway's doorway (headless Chrome)
node tools/hallway-view.mjs  # public/views/, the hall seen out of its door to here, from a copy of ../hallway with the door added
```

Node runs under MSYS2 UCRT64 here (`MSYSTEM=UCRT64 /c/msys64/usr/bin/bash -lc 'cd /c/git/my/claude/outside && …'`).

## Layout

- `garden.js`: pure (no three, tested in Node). Where everything is (`GARDEN`, `DOOR`, `HOUSE`, `PANEL`, `BENCH`, `SEAT`, `BOOK`, `BRIDGE`, `TRAIL`, `TREES`), the stream (`streamAt`, the widths, `waterLevel`), the ground (`terrain`, sampled once on `GRID` by `layoutGarden`; `groundAt` reads the grid, and the deck on the bridge), walking (`clampWalk`: hedges, wall, house but the doorway, trunks, bench, the bridge's rails, the water; `standable`), the way (`route`: straight when clear, else A* on the grid, corners cut), `doorCrossed`, `doorSpawn`, `castRay` (what a pointer meets: door, panel, wall, book, bench, tree, hedge, wall, water, ground; the ground by marching the grid). Coordinates: metres, the house's wall at z = 0, the garden along -z, the door at x = 0, yaw 0 faces -z.
- `way.js`: pure. The hallway's door link (`readVisit`), the way back (`wayBack`, `keptWay`, `leaveUrl`), the address cleaned (`withoutVisit`), where the hallway's view of its door to here is (`hallwayViews`, `viewParams`), and `HALLWAY_DOOR`, the hallway's door entry for here (kept in step with README's).
- `pages.js`: pure. The book set in pages (`paginate`, with a `measure` function), spreads. `reading.js`: the book's text (public domain, sources named; check a change against them).
- `scene.js` builds everything as a few merged meshes with light baked into vertex colours (`bake.js`: a low sun traced through the occluders it is given, crowns letting some through by the leaf crossed; sky light; point lights). It calls `plants.js` (trees, hedges, grass/flowers/reeds, the willow's strands), `features.js` (bridge, bench, dry-stone wall, rocks, lily pads, water-gates), `house.js` (the wall, windows, roof, doorcase, the sign and plaque, the panel, the portal), `water.js` (the stream and pond, one ribbon, its shader), `sky.js` (the sky painted once, equirectangular, looked up by direction; the water reflects it). `builder.js` is the hallway's Builder with cuboids, cylinders, lumpy spheres and triangles added. Grass and strands sway in a vertex shader (`sway` attribute).
- `portal.js`: the hallway's doorway shader, with `setView` for a picture hung by views.json's parameters. `textures.js`: canvas textures, seeded.
- `controls.js`: the hallway's controls, standing on the ground, routes round the water, sitting (`sit`, `stand`, `seated`), and while the book is open its pages take the arrows, the right stick and presses (`book.pick`). `gamepad.js`, `settings.js` (`hallway.nav`, shared with the hallway), `fade.js`: the hallway's.
- `book.js`: the book closed on the bench and open in front of the reader (pages painted when first needed, the leaf turning over, a page at a time on a narrow screen). `preview.js`: the picture for the hallway's doorway, as the hallway hangs it.
- `panel.js`, `overlay.js`, `together.js`: the hallway's, the panel on the house's wall, the overlay's card with the way back instead of doors (and Read the book while seated), the session as page `outside`.
- `main.js`: renderer, the visit and the way back, arrival, going back in (`go`: fade, then `location.assign`), the bench and the book, VR (`sessiongranted`, noted by the inline script in index.html), the panel, the session, the frame loop.

## Conventions

- Client URLs stay relative (tested). Quest 3 is the performance target: few draw calls (about 15), light baked, nothing allocated per frame in controls/castRay/the frame loop. Build time is ~350 ms; keep it well inside the ~5 s a VR grant lasts.
- Scripted testing: `window.__outside` (renderer, scene, camera, rig, garden, layout, controls, overlay, fade, book, way, visit, `go`, `enterVR`, `openBook`, `closeBook`, `preview()`, `tick(dt, n)`, `xrDevice`, together). A hidden browser pane gets no animation frames: drive it with `tick()`, and render one before a screenshot (otherwise it shows a stale frame). XR frames under `?xr=emulate` need the pane's tab in front (`tabs_select`); aim with `xrDevice.controllers.right.position/quaternion` (rig-local), `updateButtonValue('trigger', 1)`, `updateAxes('thumbstick', x, y)`. A gamepad: replace `navigator.getGamepads` and dispatch `gamepadconnected`, as in the hallway.
- `.claude/launch.json`: `outside` (8090), `outside-quest` (127.0.0.1:8091), and `hallway` (../hallway on 8088) for trying the door both ways.
- Headless Chrome (`tools/lib/chrome.mjs`, Breadboard's) writes the fresh profile's `Local State` first so Windows sees no failed logon; keep that if it changes.
