# Footy Volume

All this, just to turn the volume up.

Kick a footy, watch where it lands, and live with the volume you get. Bring a puppy into the next round if that sounds too straightforward.

## From “UI is Hard” to this

I wrote a post called “UI is Hard.” A friend responded by showing me the Worst UI Challenge, where people invent deliberately terrible volume controls.

I usually think about how to make an interface more efficient. This was an excuse to send that instinct in the opposite direction. What if adjusting the volume required a well-placed kick?

The title [UI is Hard is Easy](https://heejun.net/developer/ui-is-hard-is-easy/) is a playful reply to that earlier post, with a nod to Richard P. Gabriel’s “Worse is Better is Worse.”

## A footy game that stayed with me

Earlier that year, I saw Pro Jank Footy at a game expo. Its odd ball movement caught my attention, so I asked the developer about it: a 3D engine underneath, presented through a 2D filter.

That idea stayed with me until this little experiment gave me somewhere to use it.

## Awkward, on purpose

Making something inefficient doesn't mean abandoning every UX value. I still wanted the player's actions to matter, even when the outcome was hard to predict.

And yes, there's a puppy. You can play solo, or invite a little more chaos.

## Give it a kick

Drag and release to kick. Try **Original** for power and elevation controls, or **Contact aim** to choose where your foot meets the ball. The final position sets the volume; the speaker button lets you hear it. Your device volume stays as it is.

The game is playable in the [original blog post](https://heejun.net/developer/ui-is-hard-is-easy/), alongside the full story.

## Run locally

With Node.js 22.12 or later:

```sh
npm install
npm run dev
```

Made with TypeScript, Vite, Three.js, and Rapier 3D.

## Shot Lab

No extra dependencies or Python installation are needed. After `npm run dev`, open
`http://localhost:5173/lab/` (use the port printed by Vite). The original game stays
at `/`. Production builds include both entry pages; the lab is under `lab/`.

1. Choose **Solo** or **Puppy**, the quick/fine/ultra grid, and 1, 2, 4, 6, 8, 10, or 12 workers. A worker pool evaluates
   actual visible contacts from the game mesh, powers from 5 to 100, headings from
   -30° to 30°, and the two pointer-input kick types (40° and -65°).
2. Select a result and press play. The first second shows contact and strike;
   the rest replays recorded 60Hz positions and rotations. Pause, scrub, change
   speed, or restart to inspect the shot.
   The English viewer includes the game's shared dashed kick guide, power and
   direction HUD, contact label, and floating volume popover with the same
   visibility thresholds. New exports record exact linear velocity; older JSON
   remains supported using velocity estimated from adjacent positions.
3. Download the JSON to keep results. Import it later in the same Lab version.
   Results otherwise live only in memory. Stopping a search discards that search;
   previously completed results remain available.

### Report tabs and decimal scores

The lab displays unrounded scores formatted to six decimal places in the replay
header, shot list, and reports. The in-game result card and floating popover keep
their original display format. Ranking and statistical thresholds always use the
underlying score, not its formatted text; extra displayed decimals do not imply
extra physical accuracy.

After a completed search, use the report tabs:

- **Overview:** trial count, best/mean score, threshold counts, search settings,
  and loft/spike comparison.
- **Contact map:** contact-point heatmap, with exact counts, mean/best scores,
  and threshold rates on hover, focus, or click.
- **Power & heading:** a parameter heatmap aggregated over all sampled contacts,
  with pointer/touch inspection, arrow-key navigation, and a top-cell table.
- **Score distribution:** all-score histogram (1-point display bins) and the
  99.5–100 tail (0.01-point display bins), threshold counts, and expandable bin
  tables. The vertical axis uses a square-root count scale.
- **Performance:** search duration, worker count, and throughput.
- **Replay:** the existing contact/strike and recorded trajectory viewer.

Filter reports by loft, spike, or both. Heatmaps switch between best score, mean
score, and rates at ≥99.5, ≥99.9, or ≥99.99. Their legends scale to the maximum in
the current view, so rare successes remain visible. The ≥99.5 threshold means the
game rounds to 100%; it is distinct from an exact score of 100. These rates describe
the finite search grid, not human success probabilities.

Workers aggregate **every trial**, using 0.1-point histogram bins for the full
range and 0.001-point bins for the high-score tail. The main thread merges
contact/parameter statistics and retains only representative replay candidates
to bound trajectory memory on Ultra. Whole-search reports become available on
completion; stopping keeps the previous completed report, not a partial report.

New `footy-lab-v2` JSON exports include aggregate statistics, settings, timings,
and replays. Replay-only `footy-lab-v1` exports still import, but require a new
search to obtain missing whole-search statistics. Reports describe the latest
completed search.

The lab reuses `src/physics.ts` and the extracted scoring/finish rules in
`src/rules.ts`. The game’s impulses, physics constants, scoring, and stop conditions
are unchanged. Each trial restores the same initial Rapier snapshot, including
solver state. The simulation uses the game's fixed 1/60-second steps and evaluates
the final position, including bounces and rolling, rather than first landing or
the highest score reached during flight.

This is a finite grid search for the selected mode, not a proof of the global optimum.
The quick grid uses 5×5 contact samples, power steps of 10 (plus 100), and heading
steps of 6°. The fine grid uses 9×9 samples, power steps of 5, and heading steps of
3°. Ultra uses 17×17 samples, power steps of 1, and heading steps of 1°:
up to 3,384,768 trials before excluding points outside the visible ball. The UI
shows the trial upper bound for each preset before starting. Samples that miss
the visible ball are excluded. The results include the top
10 contact/kick-type winners and the best of each kick type if missing (up to 12).
This provides some variation but does not guarantee distinct trajectory styles.
Scores are ranked before rounding; the game displays rounded percentages.

Replays show recorded trajectories rather than running physics again. No
reinforcement learning or automatic browser control is involved.

### Puppy behavior and reproducibility

The puppy chases and deflects the ball, then returns to the owner. The original
fetching behavior is enabled: a seeded 50% fetch tendency allows it to pick up a
slow ball on a later encounter after a rebound, carry it home, and drop it before
scoring. The original puppy update routine is retained, with only its random-number
calls substituted by the seeded stream.

In both the original game and the lab, the exact shot parameters (power, pitch,
heading, and contact point/normal) are hashed into a 32-bit seed. Starting a puppy
run resets its jump random stream from this seed. The same shot and initial
physics state therefore use the same reaction sequence; small input differences
can generate different seeds. There is no manually chosen scenario seed in the UI.

Puppy workers call the same behavior module as the game, before each 1/60-second
physics step, and use the same puppy-mode finish condition. This is still CPU
simulation without rendering: workers instantiate the shared Three.js dog model
but never create a renderer or DOM labels. Puppy search takes more work per shot
than Solo. Reports identify the mode and shot-derived seed policy; they are not
averages over multiple random reactions for each shot.

Puppy replays save each frame's dog position, posture, limb motion, and label
timing alongside the ball. Pausing and scrubbing restore these visuals without
rerunning collisions. Each selected shot's seed is shown in its details and saved
in JSON. Replay playback ends at the scoring frame. Older Solo exports remain
supported; their absent mode metadata is interpreted as Solo.

### Search workers

The default is the largest worker option below the browser-reported logical
processor count, capped at 12, with a minimum of 1. If the count is unavailable,
the default is 4. You can change it manually before starting a search. The browser-reported
logical processor count is shown as a hint; it does not identify idle cores or
distinguish performance and efficiency cores. Timings include worker/engine
startup, simulation, recording contact/type winners, and transferring results.

Each worker initializes its own Rapier engine once, then takes one contact-point
job at a time from a shared queue. Every trial restores the same initial snapshot.
All contact/type winners are merged before selecting the final replays, with a
fixed grid order to break ties independently of worker completion order. The pool
never starts more workers than there are contact-point jobs. Stop terminates the
whole pool; previous completed searches and timings remain available
until the page is reloaded or another search is started.
