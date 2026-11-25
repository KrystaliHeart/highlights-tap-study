Highlights share – tap study prototype + live results

FILES
- index.html ............ Link A: taps other than the link do nothing
- b.html ................ Link B: realistic Instagram (left = previous story, right = next story)
- results.html .......... live results dashboard for Link A (for you)
- results-b.html ........ live results dashboard for Link B
- config.js ............. where the Google Sheet URL goes
- google-apps-script.gs . the code that saves taps to your Google Sheet
- assets/ ............... videos and images

ONE-TIME SETUP (about 10 minutes)
1. Make a new Google Sheet (use your work Google account if iHeart uses Google Workspace).
2. In the Sheet: Extensions > Apps Script. Delete the sample code, paste everything from google-apps-script.gs.
3. On the line  const DASHBOARD_KEY = 'change-me';  replace change-me with a password of your own. Save.
4. Click Deploy > New deployment > gear icon > Web app.
   Execute as: Me.  Who has access: Anyone.  Click Deploy, then approve the permission prompts
   (if Google warns the app isn't verified: Advanced > Go to project).
5. Copy the Web app URL (ends in /exec). Open config.js in a text editor and paste it between the quotes after sheetUrl. Save.
6. Upload the whole folder to Netlify (drag it onto your site's Deploys tab, or app.netlify.com/drop).

USING IT
- Link A for participants:      https://<your-site>.netlify.app/
- Link B for participants:      https://<your-site>.netlify.app/b.html
- Your dashboard:               https://<your-site>.netlify.app/results.html
  First time: click Settings, paste the same /exec URL and your dashboard key. It refreshes every 10 seconds.
- Without a key the dashboard shows only sample data; the key keeps the real data private.
- Each participant's start screen shows a session code: HA-… for Link A, HB-… for Link B. It appears in their UserTesting
  recording and matches the Session column in the dashboard.
- Your own test runs: open the test link with #debug at the end. Those sessions are tagged "test" and hidden
  from the dashboard unless you tick "Include my test sessions".

RESEARCHER VIEW ON THE TEST PAGE
- Add #debug to the test link to see taps live on that device, with red dots and CSV download.

WHAT IS LOGGED (per tap)
Only taps on the Instagram story are logged.
session, seq, screen (story), element, part, x, y (in the 375x812 Figma frame),
t_ms (since "Tap to start"), video_time, story_loop, pointer (touch/mouse), press_ms, long_press
Events: story_start, story_loop, link_tapped, splash_shown, app_opened, back_to_instagram, page_hidden/visible.

DASHBOARD BUTTONS
- Download CSV: one file, one row per story tap, with each participant's summary (found link, time, taps before) repeated on every row.
- Clear data: starts the dashboard from zero; old data is kept in "archive" tabs in the Google Sheet.
