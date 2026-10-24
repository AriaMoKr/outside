# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A small WebXR garden outside one of the hallway's doors (three.js 0.186, plain ES modules, no
bundler or build step): a lawn, a stream under a foot bridge into a pond, a trail to a bench, and a
book on the bench to read. It is a place behind a door of the Hallway (https://ariamokr.github.io/hallway/,
AriaMoKr/hallway, a checkout at `../hallway`), whose conventions and controls it follows; much of
its code is the hallway's (said so at the top of each such file). `public/` is the whole site.
`README.md` covers using it, what it does with the hallway's door link, the hallway's door entry for
here (its fourth door, since the hallway's `9dd2d5a`), and the pictures either side of that door.
The user asked for the hallway to be left alone, so change `../hallway` only when asked.

Meant to publish at https://ariamokr.github.io/outside/ from `main` of AriaMoKr/outside by
`.github/workflows/pages.yml` (same origin as the hallway, so the VR hand-over works).

## Commands

```bash
npm install                  # postinstall: tools/vendor.mjs copies three, common, layersharedsession, Trystero (and IWER) into public/vendor/ (gitignored)
npm start                    # tools/serve.mjs: public/ on http://localhost:8090/ (IPv6 only on Windows; for a Quest: npm start -- --host 127.0.0.1)
npm test                     # node --test "test/*.test.js"
node tools/preview.mjs       # public/hallway-preview.jpg, the garden for the hallway's doorway (headless Chrome)
node tools/hallway-view.mjs  # public/views/, the hall seen out of its door to here, from a copy of ../hallway (the door added if it has none)
```

Node 22 or newer (`engines`, and what CI uses; `tools/lib/chrome.mjs` needs its built-in WebSocket). It runs under MSYS2 UCRT64 here (`MSYSTEM=UCRT64 /c/msys64/usr/bin/bash -lc 'cd /c/git/my/claude/outside && …'`).

## Layout

- `garden.js`: pure (no three, tested in Node). Where everything is (`GARDEN`, `DOOR`, `HOUSE`, `PANEL`, `BENCH`, `SEAT`, `BOOK`, `BRIDGE`, `TRAIL`, `TREES`), the stream (`streamAt`, the widths, `waterLevel`), the ground (`terrain`, sampled once on `GRID` by `layoutGarden`; `groundAt` reads the grid, and the deck on the bridge), what is on top for a visitor's ring (`surfaceAt`: the ground, or the water over its very edge), walking (`clampWalk`: hedges, wall, house but the doorway, trunks, bench, the bridge's rails, the water; `standable`), the way (`route`: straight when clear, else A* on the grid, corners cut), `doorCrossed`, `doorSpawn`, `castRay` (what a pointer meets: door, panel, wall, book, bench, tree, hedge, wall, water, ground; the ground by marching the grid). Coordinates: metres, the house's wall at z = 0, the garden along -z, the door at x = 0, yaw 0 faces -z.
- The door contract is AriaMoKr/common's `door.js` (`common/door.js` in the import map and in Node): the hallway's door link (`readVisit`), the way back (`wayBack(search, OUTSIDE_ID, { origin })`, `keptWay`, `leaveUrl`), the address cleaned (`withoutVisit`), where the hallway's view of its door to here is (`hallwayViews(way, OUTSIDE_ID)`, `viewParams`). `way.js` keeps what is this garden's: `OUTSIDE_ID`, `DEFAULT_GLOW`, and `HALLWAY_DOOR`, the hallway's door entry for here (kept in step with README's).
- `pages.js`: pure. The book set in pages (`paginate`, with a `measure` function), spreads. `reading.js`: the book's text (public domain, sources named; check a change against them).
- `scene.js` builds everything as a few merged meshes with light baked into vertex colours (`bake.js`: a low sun traced through the occluders it is given, crowns letting some through by the leaf crossed; sky light; point lights). It calls `plants.js` (trees, hedges, grass/flowers/reeds, the willow's strands), `features.js` (bridge, bench, dry-stone wall, rocks, lily pads, water-gates), `house.js` (the wall, windows, roof, doorcase, the sign and plaque, the panel, the portal), `water.js` (the stream and pond, one ribbon, its shader), and common's `sky.js` (`skyTexture`: the sky painted once, equirectangular; `skyDome` looks it up by direction; the water reflects it through `SKY_UV`, and `bake.js` lights by its `SUN_DIR`). The garden's sky is common's: every window behind every door shows it, so a change to it is made in common (its `src/sky.js`, then a new tag here), never in a copy here. `builder.js` is the hallway's Builder with cuboids, cylinders, lumpy spheres and triangles added. Grass and strands sway in a vertex shader (`sway` attribute).
- The doorway's shader is common's `portal.js` (`portalMaterial`, `placePortal`, and `setView` for a picture hung by views.json's parameters), which `house.js` uses. `textures.js`: canvas textures, seeded.
- `controls.js`: the hallway's controls, standing on the ground, routes round the water, sitting (`sit`, `stand`, `seated`), and while the book is open its pages take the arrows, the right stick and presses (`book.pick`). A gamepad is read by common's `gamepad.js` (`firstPad`, `readPad`), and the fade is common's `fade.js` (`Fade`), as in the hallway. The VR movement choice is common's `nav.js` (`hallway.nav` in localStorage, shared with the hallway).
- Accessibility settings are common's `access.js` (`hallway.access`, shared with every site on the origin; `main.js` `applyAccess`, `setAccess`, re-read on a `storage` event and on `pageshow`): with less motion (`reduce`) `controls.reduceMotion` makes every walk a jump (`_jump`: a click, the bridge, the bench; the door is gone through at once), the fades blink (`blink`), `book.reduceMotion` cuts the leaf's turn and the narrow screen's slide, `together.reduceMotion` skips the wave's bob, the `reduce-motion` class on `<html>` stills the overlay, and the frame loop's `time` (the water, the grass's sway, the doorway's veil) stops. A `Vignette` sits beside the `Fade`, fed `controls.moveSpeed` and `turnRate` (the sticks' smooth movement and turning; 0 for snaps and teleports). `controls.setEyeLift(eyeLift(access))` raises the rig in VR only; on the bench its own lift (from the headset's height) holds, so seated mode and the bench agree.
- `book.js`: the book closed on the bench and open in front of the reader (pages painted when first needed, the leaf turning over, a page at a time on a narrow screen). `preview.js`: the picture for the hallway's doorway, as the hallway hangs it.
- `panel.js`, `overlay.js`, `together.js`: the hallway's, the panel on the house's wall, the overlay's card (the page's `<nav>`) with the way back instead of doors, and the garden's 3D choices as real controls for a keyboard and a screen reader (Sit on the bench / Get up, Read the book from anywhere, Start / Leave shared session, Settings: the panel's Motion, Move and Turn as radio buttons and its Vignette and Seated as checkboxes, kept in step with it by `showPanel`), the session as page `outside`. The view (the canvas, `role="img"` and named), its hint and buttons are the page's `<main>`; `controls.js` leaves a focused form control its keys, and a focused button its Space. The visitors are layersharedsession's `avatars.js` (`createAvatars` with `ground: surfaceAt`; `readPose`, `place`, `wave` on the session's `wave` channel, at most once a second each).
- `main.js`: renderer, the visit and the way back, arrival, going back in (`go`: fade, then `location.assign`), the bench and the book, VR (`sessiongranted`, noted by the inline script in index.html), the panel, the session, the frame loop.

## Conventions

- Client URLs stay relative (tested). Quest 3 is the performance target: few draw calls (about 15), light baked, nothing allocated per frame in controls/castRay/the frame loop. Build time is ~350 ms; keep it well inside the ~5 s a VR grant lasts.
- Scripted testing: `window.__outside` (renderer, scene, camera, rig, garden, layout, controls, overlay, fade, vignette, book, way, visit, `go`, `enterVR`, `openBook`, `closeBook`, `setAccess(change)`, `access` (the settings and `reduce`), `preview()`, `tick(dt, n)`, `xrDevice`, together). With no XR frames (the app's window not open), VR logic can still be driven while presenting: give `controls.hands[i].source` stand-ins `{ handedness, targetRayMode: 'tracked-pointer', gamepad: { axes, buttons } }`, and set `camera.position.y` (the headset's height) before each single `tick`, since a render puts the camera back to the XR pose. A hidden browser pane gets no animation frames: drive it with `tick()`, and render one before a screenshot (otherwise it shows a stale frame). XR frames under `?xr=emulate` need the pane's tab in front (`tabs_select`); aim with `xrDevice.controllers.right.position/quaternion` (rig-local), `updateButtonValue('trigger', 1)`, `updateAxes('thumbstick', x, y)`. A gamepad: replace `navigator.getGamepads` and dispatch `gamepadconnected`, as in the hallway.
- `.claude/launch.json`: `outside` (8090), `outside-quest` (127.0.0.1:8091), and `hallway` (../hallway on 8088) for trying the door both ways.
- Headless Chrome (`tools/lib/chrome.mjs`, Breadboard's) writes the fresh profile's `Local State` first so Windows sees no failed logon; keep that if it changes.
- Shared packages, pinned by tag in package.json: AriaMoKr/common (`v0.4.0`: the door contract, `hallway.nav`, the doorway's portal, the fade, the gamepad, the sky, and the accessibility settings with the vignette) and AriaMoKr/layersharedsession (`v0.2.0`: the session and the avatars). Change them there, then move the tag here and `npm install`; tests that belong to them live there.
- Code still copied from other repos, until it moves into a shared one: `tools/vendor.mjs` is the hallway's apart from a comment; `tools/lib/chrome.mjs` is Breadboard's `scripts/lib/chrome.mjs` apart from comments. A fix to one of them belongs in its original too, and one made there belongs here.
- Link previews: the `og:` and `twitter:` tags in `index.html` show `hallway-preview.jpg`, the picture the hallway's door uses (a test keeps them matching `HALLWAY_DOOR` and the picture's size), so render it again with `tools/preview.mjs` when the garden changes.
