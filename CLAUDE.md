# Highlights share – Instagram tap study

Unmoderated UserTesting study for iHeartRadio's "Highlights share to Instagram Stories" feature
(Genuin x iHeart). A shared Highlight appears in an Instagram Story as a 20-second video with a
sticker card, plus Instagram's app attribution link "Play on iHeartRadio" under the poster's name.
In Meta's setup, only that attribution link opens iHeartRadio; the sticker is just an image.

## Research questions
1. **Do viewers notice the attribution link** ("Play on iHeartRadio")?
2. **Where else do they expect to tap?** (sticker card, video, name, etc.)
3. **Does the link take them where they expect?** (the iHeart full screen player)

## Two test links
- **Link A – `index.html`**: taps anywhere except the link do nothing, so participants keep
  trying. Measures where people *expect* to tap. Session codes start with `HA-`.
- **Link B – `b.html`**: realistic Instagram. Left third of the story = previous story, anywhere
  else = next story, press and hold = pause, the 20 s story moves on by itself when it ends.
  There is one story before (HelloTester's earlier "sunday reset ☕️" text story, 5 s) and one
  after (another account, "nina.lee", "rainy day plans" text story, 5 s, with a "Send message"
  reply bar). Measures real-world first-try success. Session codes start with `HB-`.
- Old sessions starting `HL-` are Link A data from before the split.

**`b.html` is generated from `index.html`. Never edit `b.html` by hand.** After any change to
`index.html`, regenerate it:

```bash
python3 -c "p=open('index.html').read(); open('b.html','w').write(p.replace('<script src=\"config.js\"></script>','<script>window.STUDY_MODE = \"B\";</script>\n<script src=\"config.js\"></script>',1))"
```

The page picks its mode from `window.STUDY_MODE`, a path ending in `b` / `b.html`, or `B` in the URL hash.

## Participant flow (both links)
1. Start screen: "Tap to start / Turn your sound on" + session code at the bottom (needed so
   browsers allow sound; the code shows in the UserTesting recording).
2. Instagram story (Figma frame 19812:107191): status bar, story progress bars, avatar +
   "HelloTester 2m", "Play on iHeartRadio" link, sticker card (Option C), Instagram action bar.
   The story is the poster's own view (Activity / Highlight / Send / Mention / More).
3. Tapping "Play on iHeartRadio": link dims 0.14 s → story shrinks/darkens and the iHeart splash
   grows from the link position (0.5 s) → red iHeart splash (Figma 19692:104874) held 1.3 s →
   full screen player (Figma 19812:107338) fades in and plays the highlight with sound.
4. In the app, a "‹ Back to Instagram" button sits **outside** the phone frame, top left, and returns
   to the iHeart story. The page reserves a 56 px strip above the phone for it.
- **Task prompt** (`TASK_HTML` in `index.html`, one string used everywhere): shown on the start screen,
  and, on screens at least 760 px wide (`SIDE_MIN_W`), in a 320 px card 40 px to the left of the phone (card + phone centered together) for
  the whole session. On narrower screens a
  "Task" button in the top strip reopens it as a sheet (logs a `task_opened` event). Taps on the task
  panel, sheet and top strip are not logged.
- Taps are logged **only on Instagram story screens** (`story`, `story-prev`, `story-next`), not on
  the splash or player.
- The whole UI is a 375×812 frame scaled to fit the screen; all tap x/y are in that frame's coordinates.

## Data pipeline
prototype → Google Apps Script web app → Google Sheet "Highlights_Share_Tap study data"
(tabs `Taps` and `Events`) → dashboards poll every 10 s.

- `config.js` holds `sheetUrl`, the Apps Script `/exec` URL (general `script.google.com/macros/s/…`
  form, not the `/a/macros/iheart.com/` one). Used by the prototype and the dashboards.
- `google-apps-script.gs` is the script source. The real dashboard key is set in the deployed
  script only. **Never write the dashboard key into any file in this folder** (the folder can be public).
  The dashboards ask for it once in Settings and keep it in localStorage.
- The script: `doPost` appends rows; `doGet?key=…` returns `{taps, events}`;
  `doGet?key=…&action=clear` renames the tabs to "… archive <date>" (nothing is deleted).
- **Sheet columns are fixed in the script.** Adding a new field means editing `TAP_COLS` /
  `EVENT_COLS` in the script *and* redeploying; otherwise new fields are silently dropped.
  Prefer encoding new information in existing fields or event `type` names when possible.
- Redeploying the script: Apps Script → Deploy → **Manage deployments** → pencil → Version: New
  version → Deploy. **Never "New deployment"**: that creates a new URL and breaks `config.js`.
- Access must stay "Anyone" so participants (not logged in) can post data.

### Tap row (Taps tab)
`session, seq, screen, element, part, x, y, t_ms, video_time, story_loop, pointer, press_ms, long_press, received_at`
- `element` values come from `data-el` attributes: `attribution-link` (parts icon/text/chevron),
  `sticker-card` (show-art, content-type, iheart-logo, title), `background-video`
  (left-third / center / right-third), `avatar`, `username`, `timestamp`, `progress-bar`,
  `status-bar`, `action-activity|highlight|send|mention|more`, `action-bar-empty`, `home-indicator`,
  `story-empty`, `outside-phone-frame`, Link B only: `prev-story`, `next-story` (part left-third/right),
  `reply-bar`.
- `t_ms` = ms since "Tap to start". Taps are sent on pointerup (so press_ms is known).

### Event row (Events tab)
`session, type, t_ms, screen, loop, debug, viewport, user_agent, received_at`
- Types: `story_start` (carries debug, viewport, user_agent), `story_loop` (Link A only),
  `link_tapped`, `splash_shown`, `app_opened`, `back_to_instagram`, `page_hidden`, `page_visible`,
  `autoplay_muted`, `app_autoplay_muted`, `task_opened` (phone-size screens), Link B: `nav_next`, `nav_prev`, `nav_auto`
  (screen = the story it left), `long_press_pause`.
- Sessions opened with `#debug` in the URL have `debug=true` and are hidden in the dashboards
  unless "Include my test sessions" is ticked. `#debug` also shows a researcher panel on the test page.

## Dashboards
- **Study size: 9 different participants per link (18 in all).** The dashboards are built for that:
  one square / row / column per person, counts written as "4 of 9" (no percentages), and a note
  that a 1–2 person gap between A and B is noise. `Dash.TARGET = 9` in `dash.js` sets the number
  of planned slots.
- `dash.js` + `dash.css` – shared by both pages: top bar with Link A / Link B tabs, settings,
  Clear data, Download CSV (both links, one row per tap with participant columns), polling,
  session building, the A-vs-B comparison cards (9 outcome squares per link, empty dashed slots
  for sessions not run yet), "After the link opened iHeart" list, sample data (9 + 9).
  Outcomes are the same three on both links, same colors everywhere: link on the first tap/try
  (red), found it later (pink), never found it (gray).
- `results.html` – Link A, organised by the three research questions: headline + comparison cards,
  findings; 1) every participant's taps in order (numbered circles by area, ↻ = story looped);
  2) spot matrix (spots × people, ring = their first tap) and tap map with per-person replay;
  3) after the link; participants table.
- `results-b.html` – Link B: headline + comparison cards, findings; 1) per-session timelines
  (which story was on screen) and an end-card dot plot (link taps and wrong first taps by video
  second); 2) first-tap zone map with a list of first-tap spots, each with people squares;
  3) after the link; participants table with journeys.
- Selecting a person anywhere (square, name, matrix cell, table row, timeline) highlights them on
  the whole page. Links like `results-b.html#s=HB-1234A` open with that person selected.
- Both show clearly labeled sample data until Settings has the URL and key. Keep that behavior.
- No build step and no external JS libraries; plain HTML/CSS/JS, Inter from Google Fonts.
  Visual language: cool gray paper `#f3f4f6`, white panels, iHeart red `#c6002b` reserved for the
  link / success, colors defined as CSS variables at the top of `dash.css`.

## Assets (`assets/`)
- `story.mp4` (20 s, 1080×1920): 17 s trimmed from a screen recording of the iHeart app with the app
  UI removed (blurred soft fill top and bottom, captions kept), loudness raised to about −10 LUFS,
  then a 3 s end card animation ("Watch the full Highlight in iHeart", up arrow pointing at the link,
  phone mockup sliding up, iHeart logo) with the first 3 s of the iHeart sonic logo, lowered 3 dB.
- `app.mp4` (~103 s): the full highlight from a second app recording, UI removed the same way,
  stopped before an in-app "double tap to like" tip; about −11 LUFS.
- SVG icons exported from Figma; `showart.jpg` cropped from the recording; `story-bg.jpg` and
  `app-bg.jpg` are screenshots used as dashboard backgrounds.
- The source recordings are not in this folder. Figma file: UKZm9bBjHmtPZM3TcLfbkc
  ("[External] Genuin x iHeart – Highlights").

## Publishing
- Participant links are hosted on **GitHub Pages** from the personal public repo
  `KrystaliHeart/highlights-tap-study` (this folder is that repo's checkout, branch `main`).
  iHeart's GitHub org only allows private repos, so Pages can't serve public links from there.
  Link A: `https://krystaliheart.github.io/highlights-tap-study/`, Link B: `…/b.html`,
  dashboards at `…/results.html` and `…/results-b.html`. Pages rebuilds about a minute after a push.
- **While the project is running, push every change to the personal repo only** (commit in this
  folder, `git push` to `origin`). Do **not** push to `iheartradio/UXD` along the way.
- **When the project is finished**, copy the final folder into `iheartradio/UXD`
  (`~/UXD`, folder `prototypes/highlights-tap-study`) and update the pull request there
  (branch `add-highlights-tap-study`, PR #98, needs an approving review before it can merge).
  Only do this when the user says the project is done.
- Older Netlify links (`https://<site>.netlify.app/…`) may still exist from before the move.

## Before pushing or deploying, check
- `b.html` regenerated from `index.html`.
- Open `index.html#debug` and `b.html#debug`: tap around, open the app, go back; the researcher
  panel logs taps and there are no console errors.
- Dashboards load with sample data when no key is set, and with live data after Settings.
- `config.js` still points at the `/exec` URL; no dashboard key anywhere in the files.
