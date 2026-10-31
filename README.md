# Outside

**https://ariamokr.github.io/outside/**

A small garden outside one of the [Hallway](https://ariamokr.github.io/hallway/)'s doors, in a late
afternoon: a lawn closed in by hedges and a dry-stone wall, a stream that runs under a little
wooden foot bridge into a pond with lily pads and a willow over it, a foot trail from the door
over the bridge to a bench by the pond, and on the bench a book to read. Walk it in VR on a Meta
Quest, on a desktop or on a phone, as you walk the hallway, or on an Android TV with its remote, in
[the hallway's TV app](#the-tv-app). There is nothing to install.

![The garden as one comes out of the door](public/hallway-preview.jpg)

Behind you as you come out is the hallway's building: its brick wall, its windows warm with the
hall's lamps, and the door you came out of, glowing, the hall seen through it. Walk back through it
(or click or tap it, or point at it in VR and pull the trigger) and you are back in the hallway,
in front of that door.

## Moving about

As in the hallway:

| | Look | Walk | Go back in | Wave (in a shared session) |
|---|---|---|---|---|
| Desktop | drag | WASD or arrows (Shift runs), Q/E or ←/→ turn, click the ground | click the door, or walk into it | the **Wave** button |
| Phone | drag | tap the ground | tap the door | the **Wave** button |
| Headset | your head | left stick walks (or aims a teleport), right stick turns, trigger at the ground teleports | trigger (or pinch) at the door, or step through it | squeeze a grip (with the book open, a grip moves it instead) |
| Gamepad | right stick | left stick (click it in to hurry) | aim the dot at the door and press A, or walk into it | the **Wave** button |
| TV remote | ← and → turn | ↑ and ↓ | aim the dot at the door and press OK, or walk into it | the **Wave** button, from the card (Menu) |

A walk to somewhere across the water goes over the bridge, and round the pond. You can't walk
into the water, or through the hedges, the trees or the bench. The ground rises and falls a
little, and the bridge arches: you go up and down with it.

**Fullscreen**, the **control panel** on the wall beside the door (Enter or exit VR, how to move
and turn in VR: Smooth or Teleport, Snap or Smooth, and the settings below), and **Together** work
as they do in the hallway. The VR choices are the hallway's own: both read and keep them in
`localStorage` under `hallway.nav` ([AriaMoKr/common](https://github.com/AriaMoKr/common)'s
`nav.js`), so a choice made on either side of the door holds on the other.

### Settings for comfort

Three more settings, on the panel and in the card's **Settings**, are shared the same way, under
`hallway.access` (common's `access.js`): set them anywhere on the site and they hold behind every
door, and a page still open elsewhere takes the change at once.

| Setting | What it does here |
|---|---|
| **Motion**: System, Less or Full | With less motion (System follows the device's own setting) nothing glides: a click on the ground, the way over the bridge, the bench and the door are a jump, not a walk; the fades are blinks; a page of the book turns at once; and the garden holds still: the water, the grass and the willow, the doorway's veil, and a waving visitor's bob. |
| **Vignette**: On or Off | In VR, while you glide or turn smoothly with the sticks, the edge of the view darkens and closes in, and opens when you stop. It is on unless you turn it off. Snap turns and teleports blink instead. |
| **Seated**: On or Off | In VR, your view is raised 0.45 m, so sitting down you see the garden from about standing height. Sitting on the bench brings your eyes to a seated height on it, from wherever your headset is, so a visitor already sitting stays put, and getting up raises you again. |

## The bench, and the book

Choose the bench (click or tap it, A on a gamepad, or the trigger in VR) to sit on it, facing the
pond and the house. On a screen you walk there first; in VR you are on it at once. Beside you lies
a book. Choose it, or **Read the book**, and it opens in front of you.

The open book reads as a book does in [vrlbry](https://github.com/AriaMoKr/vrlbry), with its
controls. Under the pages is vrlbry's toolbar: where you are and a slider to go anywhere in the
book, ◀ ▶, **Contents** (beside the pages, or over them when there is no room), **A−** and
**A+** (the text is set in pages again at the new size, and you stay at the same words), **1 page**
or **2 pages**, **Theme** (paper, sepia or night), ✕ to put the book down, and **↩ Back** once
you have followed a link. The entries on the book's contents page are links: choose one and you go
to its piece, and Back (the toolbar's, Backspace, B, or the browser's own) brings you back along
them before it puts the book down. You can bring the book nearer or take it farther, make it
larger or smaller in VR, and move it with a grip there. If it gets out of sight, bring it back in
front of you. Its text size, theme, one page or two, its size (and, in VR, its distance), and where
you were reading are kept in this browser (`localStorage`, `outside.book`), so it opens where you
left it.

| | Desktop | Phone | Headset | Gamepad |
|---|---|---|---|---|
| Turn a page | click the page, or ← → Space Page Up/Down | tap the page, or swipe it quickly | trigger at the page, or push the right stick left or right | A on the page, LB RB, or the D-pad ← → |
| Text size, theme, contents | + − · N · C, or the toolbar | the toolbar | the toolbar | D-pad ↑ ↓ · Y · X |
| Go to a piece | click it in the contents (↑ ↓ Enter in it) or on the contents page | tap it | trigger on it | A on it |
| One page or two | P, or the toolbar | the toolbar (one page while the phone is upright) | the toolbar | the toolbar |
| Read as text | T, or **Text view** | **Text view** | | |
| Book distance / size | the mouse wheel | pinch | right stick up/down · left stick up/down · grip to move it | the triggers |
| Back (along the links, then put down) | Backspace, ↩ Back, or the browser's Back | ↩ Back, or the back gesture | B or Y | B |
| Put the book down | Esc, ✕, or click off the book | ✕, or tap off the book | ✕, or B or Y | ✕, or B |
| Book out of sight | F, or **In front of me** in the card | drag back to it, or tap off it and read it again | press a thumbstick | press the right stick |
| Back to the start | Home, or **Reset view** (in Settings) | **Reset view** (in Settings) | | |
| Get up | WASD | tap the ground | left stick, once the book is down | left stick |

**Text view** (or T) shows the part of the book you are reading (the title page with the contents,
a piece, or the sources) as an ordinary page of text over the garden, as vrlbry's does: for a
screen reader, the keyboard, the browser's zoom or a small phone. Its toolbar has the parts before
and after, the contents, the text size and theme, a slider for where you are, Back, and **Put the
book down**, and its contents' links work as in the book. It keeps your place with the 3D book, to
the word: close it (T, Esc or **Close**) and the book is open where you were reading. **Open it as
text**, in Settings, opens the book this way every time.

On a screen, the card at the top left has the garden's 3D choices as buttons too, for a keyboard
or a screen reader: **Sit on the bench** (or **Get up**), **Read the book** (from anywhere: you
walk to the bench first, as when you choose the book in 3D), **Start shared session** (or
**Leave shared session**), and **Settings**: motion, how to move and turn in VR, the vignette and
seated, as on the panel by the door; for the book, **Open it as text**, and **Reset view** (as
Home: the book put down, its size and distance as they were at first, and you at the door). While the book is open the card goes out of its way, as
vrlbry's does, and comes back when the keyboard goes into it; **Text view** is by the buttons at
the foot. The view itself is a picture to a screen reader, named for what is in it. With the book
open, its words are there too, out of sight: a region named for the book holds the pages open (the
one in view, on a narrow screen), headed with where you are (*Pages 4 and 5*), with the book's
titles as headings, its paragraphs and stanzas whole even where they run over a page, and the
contents as a list. Each turn of a page replaces it and is read out.

While the book is open the card has its keys as buttons as well: **Contents** (C), **A−** and
**A+** (− and +), **One page** or **Two pages** (P), **Theme** (N), **Text view** (T) and **In
front of me** (F), so a remote, which has no letters, or whoever is in the card can reach them.

The book is *By the Water*, a little anthology: Thoreau on the pond in *Walden*'s "The Ponds"
(1854); Tennyson's "The Brook" (1855); Stevenson's "Where Go the Boats?" (1885); Hopkins's
"Inversnaid" (written 1881); Wordsworth's "I wandered lonely as a Cloud" (1815); Keats's "To
Autumn" (1820); and, to close it, Wordsworth's "The Tables Turned" ("Up! up! my Friend, and quit
your books"). All are in the public domain. Thoreau's passage is Project Gutenberg's text of
*Walden*; the poems are as Wikisource has them from the editions named in the book.

## The TV app

On an Android TV the garden runs in the hallway's app,
[AriaMoKr/HallwayApp](https://github.com/AriaMoKr/HallwayApp), through the hallway's door: the site
in a full-screen WebView that ends its user agent with ` HallwayTV/<version>`. The page then shows
the 10-foot view, as the hallway does: larger text in the card, the hint and the text view, a thick
focus ring on a dark halo, to be seen across the room, and no Enter VR or Fullscreen. The hint at
the foot of the screen says what the keys do: walking, sitting, reading, in the text view and in the
card.

- **Walking**, ↑ and ↓ walk and ← and → turn, the view tipped a little down so that the dot in its
  middle can come to rest on the bench. **OK** uses what the dot is on, as a gamepad's A does: the
  bench (you walk there and sit), the book beside you, the door back, a spot on the ground.
- **Sitting**, OK opens the book, and Back stands up (as ↑ and ↓ do, walking off).
- **Reading**, ← and → turn the pages. OK opens the contents beside them, ↑ and ↓ go through it,
  and OK goes to that piece.
- **Menu**, or holding **Back**, moves the focus into the card: Sit on the bench, Read the book,
  Start shared session and Settings; and while reading, the book's keys as buttons (above), Get up
  and Put the book down. There ↑ and ↓ go from control to control (a choice, such as Motion, is one
  stop), ← and → change a choice, OK presses or ticks, and Back or Menu walks, or reads, again.
  Menu goes back to the control last left in the card, but once the book is open it goes to the
  book's buttons, Contents first. Sit on the bench and Read the book give the focus back to the
  garden, so the arrows walk, or turn the pages, at once.
- **Text view**, from the card, keeps the remote's keys on the page: ↑ and ↓ read on and back, ← and
  → go a page, and Menu reaches its toolbar.
- **Back** takes one step back at a time: out of the card; the text view's contents, then the text
  view; the book's contents; back along a link followed in the book; the book put down; up from the
  bench; then back a page, to the hallway's door. The book, and each link followed in it, are
  entries in the page's history (common's `back-history.js`, as a browser's Back goes back through
  them), so those steps are the app's own Back, through the history; the rest are the page's
  (`backStep`, in `public/js/remote.js`). A book taken out with a gamepad alone, on a page nobody
  has pressed a key on, may have no entry (Chromium leaves those out of Back's history): then the
  page puts it down itself.
- **Together.** A TV can't copy a link, so the card shows the invite link to open on a phone or a
  computer.

With TalkBack on, the remote's arrows are TalkBack's (the hallway's README says why): **channel up
and down** stand for ↑ and ↓, and **rewind and fast-forward** for ← and →, walking and in the book,
as the hint says.

The TV's GPU is a phone's (a Mali-G52), and at the TV's pixel ratio of 2 (1920 × 1080) the garden
drew 31 frames a second there at the way in, and 23 by the pond. A pixel ratio of 1 alone held 60 at
the way in and reading on the bench, with almost nothing to spare by the pond. So on a TV the garden
is drawn lighter, in five ways (`public/js/lite.js`):

- **ratio**: at a pixel ratio of 1 (960 × 540, the page's own size), a quarter of the pixels.
- **ground**: the lawn's shader reads the trail's gravel and the banks' mud only where they are, and
  the grass's large-scale variation once a vertex rather than at every pixel.
- **filter**: the textures filtered at 2× anisotropy rather than 8×.
- **water**: the ripples read from a picture of their noise and its slope rather than worked out at
  every pixel, which costs the water four or five times as much.
- **card**: no blur behind the card.

`?lite=` turns any of them on in any browser, to see that the garden still looks as it should:
`?lite=water,ground`, or `?lite=all` (`?tv=emulate` has them all). On every screen the ground, the
water and then the sky are drawn after everything in front of them, so the GPU skips their pixels
where something hides them: the same picture, with less work.

What each part cost was measured on this project's computer (a laptop's RTX 4090, through ANGLE's
Direct3D 11) with the GPU's own timer (`EXT_disjoint_timer_query_webgl2`), drawing the frame into a
960 × 540 target over and over and taking the fastest of fifteen rounds. Of a frame at a pixel ratio
of 2 (about 0.25 ms), the ground took most, 0.04 to 0.08 ms (what hiding it saved, and what drawing
it alone cost), then the water, 0.02 to 0.07; the trees and hedges, the grass and the sky took at
most three hundredths of a millisecond each, and there are no shadow maps (the sun's shadows are
baked into the vertices' colours). The card's blur is
the compositor's work, which that timer doesn't see. The GPU's time per frame, in milliseconds:

| On this computer        | At the way in | By the pond  | Reading on the bench |
| ----------------------- | ------------- | ------------ | -------------------- |
| Before (pixel ratio 2)  | 0.255         | 0.232–0.267  | 0.201                |
| A TV now                | 0.073         | 0.058–0.067  | 0.048                |
| A TV now, at ratio 2    | 0.189         | 0.161–0.184  | 0.147                |

That is 71% to 76% less than before; at the same pixel ratio, the lighter ground, filtering and
water with the drawing order take off 26% to 31%. A TV's GPU (tiled, and far slower) need not share
these proportions: its own frame rate is HallwayApp's `tools/tv-check.mjs`'s to measure.

The TV mode is [AriaMoKr/common](https://github.com/AriaMoKr/common)'s `tv.js` (its README's "The
TV app" is the checklist this follows). `?tv=emulate` shows the TV's page in any browser, with the
arrows, Enter for OK and Escape for Back in the card. Menu and Back are the app's: there
`hallwayTV.menu()` and `hallwayTV.back()` stand in for them (when `back()` returns false, the app
would go back a page: `history.back()`). HallwayApp's `tools/tv-check.mjs --url` measures the frame
rate on the TV, of the live site or of a dev server over adb reverse (`npm start -- --host
127.0.0.1`).

## Coming out of the hallway's door

The hallway opens a door's environment with the visit added to its address: the door contract,
in [AriaMoKr/common](https://github.com/AriaMoKr/common)'s README ("Going in", "Linking back"),
whose `door.js` the garden reads it with. It reads it once and takes it off the address, so a
reload, Back or a shared link doesn't arrive again; `room` stays.

| Parameter | What the garden does with it |
|---|---|
| `from=hallway`, `back`, `backname` | The door back leads to `back`, called the Hallway when it is the hallway's own page (or, developing, when both are on this machine). Any other address is named by its host, or by the name another hall gives itself with `backname`, cut to 24 characters on the button, the sign and the plaque. Without `back`, the door leads to the hallway anyway, at `?from=outside`: this garden is outside its door, however one got here. The way back lasts the tab (`sessionStorage`). |
| `dx`, `yaw`, `pitch` | You come out where you went in (`dx` across the doorway), turned and looking as you were. Facing straight in, through the hallway's doorway, you see the garden's picture; coming out, you see the garden from where that picture was taken. |
| `dw`, `dh`, `glow` | The door back is that wide and high, and glows in that colour. |
| `room` | You stay in the shared session (below); the door back carries it on. |

Walking out of the hallway's VR, Quest Browser can hand this page the immersive session without a
click (`sessiongranted`): the garden listens for it from the first script on the page and takes
it at once, so you stay in VR, as long as both are on `ariamokr.github.io`.

Through the door back you see the hall: the view the hallway publishes out of its door to here
(`views/views.json` beside the hallway, under this garden's id, `outside`; common's README, "The
view from your door"). When that can't be had, the doorway shows this site's own copy, rendered
from the hallway (`public/views/`, below). When the way back is not the hallway, the doorway shows
its glow and the place's name.

## The door in the hallway

The hallway's fourth door, on the right across from the Music Room under a "Garden" sign, opens
here. Its entry in the hallway's
[`public/js/environments.js`](https://github.com/AriaMoKr/hallway/blob/main/public/js/environments.js)
is the same as `HALLWAY_DOOR` in [`public/js/way.js`](public/js/way.js):

```js
{
  id: 'outside',
  title: 'outside',
  subtitle: "A small garden outside one of the hallway's doors: a lawn, a stream and a pond, a foot bridge, and a bench to sit and read on. Walk it in VR on a Meta Quest, on a desktop or on a phone.",
  sign: 'Garden',
  url: 'https://ariamokr.github.io/outside/',
  preview: 'https://ariamokr.github.io/outside/hallway-preview.jpg',
  color: '#9fd07a',
},
```

As the hallway's README asks ("Adding a door"), the title on the plaque beside the door is this
repository's name, and the subtitle under it is this page's description (its `<meta
name="description">`) word for word; a test checks that they match. When the description changes,
change the subtitle with it, here and in the hallway. The hallway's `views.json` has `outside`, so
the door back here shows the hall from the hallway's own picture.

## Together

The hallway's shared session ([AriaMoKr/layersharedsession](https://github.com/AriaMoKr/layersharedsession),
peer to peer over WebRTC) comes out here too: this is the first place behind a door to take part.
Come out of the hallway in a session and you join the same room here, as `outside`. The others
out here are drawn by the layer's `avatars.js`, as in the hallway: a head with a visor, their hands
in VR, a ring on the ground (on the water, where they stand at its very edge) and their name.
Waving is as in the hallway. The **Wave** button at the bottom right, or a controller's grip in VR
(it pulses, so you feel it go out), waves to everyone in the session: they get a toast saying you
waved, and those out here see your avatar bob. A wave from anyone else, here or in the hallway, is
a toast here too, and bobs their avatar when they are out here. **Start shared session**, on the
panel or in the card, starts one here, and **Copy invite link** copies its address (on a TV, the
card shows it). The door back carries the room into the hallway. In the hallway, those out here count as elsewhere.

## Running it

You need Node.js 22 or newer.

```bash
npm install     # three.js, common (the door contract, the sky, the comfort settings, the book's Back, and the walking, doorway, fade and gamepad code the hallway shares), the shared-session layer and Trystero (and IWER, for emulating a headset), copied into public/vendor/ by common's tools/vendor.mjs from vendor.json
npm start       # http://localhost:8090/
npm test        # node --test: the garden, the book's pages and reader, the text view, the way back, the session's words, the TV's remote and the lighter versions, the water, the page, and tsc's checks of public/js/
npm run types   # tsc's checks alone
```

`npm test` type-checks `public/js/` with TypeScript, from the modules' JSDoc (`tsconfig.json`:
`allowJs`, `checkJs`, `noEmit`), against three.js's types and common's and the shared session's.
Nothing is built: the page is served as it is, and the import map stays. What TypeScript's DOM
library leaves out is in `types/globals.d.ts`. `strict` comes a file at a time:
`tsconfig.strict.json` checks only the files that pass it (so far `garden.js`, `lite.js`,
`preview.js`, `reading.js`, `remote.js`, `together.js` and `way.js`), and `npm test` runs it too. A file joins its `include` when a change
makes it pass. `tools/` and `test/` come later.

`public/` is the whole site: any static server can serve it once `npm install` has filled
`public/vendor/`. `?xr=emulate` installs Meta's IWER emulator (a virtual Quest 3). For a Quest over
adb, `adb reverse tcp:8090 tcp:8090` and start the server on IPv4 (`npm start -- --host 127.0.0.1`),
as for the hallway.

To try the way in and out locally, serve the hallway's checkout as well (on 8088), and open the
garden as its door would:

```
http://localhost:8090/?from=hallway&back=http%3A%2F%2Flocalhost%3A8088%2F%3Ffrom%3Doutside&dx=0.2&yaw=-15&pitch=-5&dw=1.1&dh=2.25&glow=9fd07a
```

The hallway's dev server sends no CORS headers (GitHub Pages does), so locally the door back shows
this site's copy of the view rather than the hallway's.

## The pictures either side of the door

Two pictures are rendered in headless Chrome and committed:

```bash
node tools/preview.mjs        # public/hallway-preview.jpg: the garden, for the hallway's doorway here and a shared link's preview
node tools/hallway-view.mjs   # public/views/: the hall, for the doorway back (needs an installed hallway checkout; --hallway <path>, default ../hallway)
```

Render the first again after changing the garden, and the second after the hallway changes. The
hallway checkout is copied, never changed. Each run starts Chrome on a new profile that is first
told the Windows password is not blank (common's `tools/chrome.mjs` does this for every site), so
Chrome never tries a logon to find out.

## Publishing

`.github/workflows/pages.yml` publishes `public/` to GitHub Pages
(https://ariamokr.github.io/outside/, from AriaMoKr/outside) on every push to `main`, after the
tests (tsc's check among them), through the sites' workflow in [AriaMoKr/common](https://github.com/AriaMoKr/common) (on
Node 24). In the repository's Settings → Pages, the source must be "GitHub Actions". Every URL in the
page is relative.
