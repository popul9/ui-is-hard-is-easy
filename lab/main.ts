import './style.css';
import '../src/kick-overlays.css';
import '../src/volume-popover.css';
import '../src/dog.css';
import { createScene } from '../src/scene';
import { createPhysics, kickDirection, TARGET } from '../src/physics';
import { createVolumePopover } from '../src/volume-popover';
import { scorePosition } from '../src/rules';
import type { Frame, Result, Sample, GameMode } from './types';
import type { DogPose } from '../src/dog';
import { validEnvironment } from './random';
import { sampleDrags } from './drags';
import { shotSeed } from '../src/random';
import { createSearchPool } from './worker-pool';
import { createReports } from './reports';
import type { Timing } from './reports';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('field');
const status = element('status');
const search = element<HTMLButtonElement>('search');
const stop = element<HTMLButtonElement>('stop');
const play = element<HTMLButtonElement>('play');
const restart = element<HTMLButtonElement>('restart');
const download = element<HTMLButtonElement>('download');
const timeline = element<HTMLInputElement>('timeline');
const speed = element<HTMLSelectElement>('speed');
const progress = element<HTMLProgressElement>('progress');
const density = element<HTMLSelectElement>('density');
const upload = element<HTMLInputElement>('upload');
const workerCount = element<HTMLSelectElement>('workers');
const workerCounts = [1, 2, 4, 6, 8, 10, 12];
const logicalCores = navigator.hardwareConcurrency;
if (Number.isInteger(logicalCores) && logicalCores > 0) {
  const budget = Math.max(1, logicalCores - 1);
  workerCount.value = String(workerCounts.filter(count => count <= budget).at(-1) ?? 1);
}
element('cpu-info').textContent = Number.isInteger(logicalCores) && logicalCores > 0
  ? `Browser-reported cores: ${logicalCores}`
  : 'Browser-reported cores: unavailable';
const gameMode = element<HTMLSelectElement>('game-mode');
const searchSettings: Record<string, { count: number; powerStep: number; headingStep: number }> = {
  quick: { count: 5, powerStep: 10, headingStep: 6 },
  fine: { count: 9, powerStep: 5, headingStep: 3 },
  ultra: { count: 17, powerStep: 1, headingStep: 1 },
};
function showSearchSize() {
  const { count, powerStep, headingStep } = searchSettings[density.value];
  const powers = Math.floor(95 / powerStep) + 1 + (95 % powerStep === 0 ? 0 : 1);
  const maximum = count * count * 2 * powers * (60 / headingStep + 1);
  element('search-size').textContent = `Up to ${maximum.toLocaleString('en-US')} trials`;
}
density.addEventListener('change', showSearchSize);
showSearchSize();

async function start() {
  search.disabled = true;
  const physics = await createPhysics();
  physics.reset(true);
  const initial: Frame = { position: { ...physics.body.translation() }, rotation: { ...physics.body.rotation() } };
  physics.world.free();
  const scene = createScene(canvas);
  const volumePopover = createVolumePopover(canvas);
  scene.draw(initial.position, initial.rotation, false);
  scene.setRearView(true);
  search.disabled = false;
  let pool: ReturnType<typeof createSearchPool> | undefined;
  let searchStopped = false;
  let results: Result[] = [];
  let selected: Result | undefined;
  let playing = false; let time = 0; let previous = performance.now();
  let rear = true; let lastIndex = -1;
  const setPlaying = (value: boolean) => { playing = value; play.textContent = value ? 'Pause' : 'Play'; };
  const reports = createReports(tab => {
    if (tab !== 'replay') setPlaying(false);
    else requestAnimationFrame(() => { if (canvas.clientWidth > 0) { scene.resize(); render(); } });
  });
  function hideOverlays(resetPopover = true) {
    element('aim').hidden = element('contact-label').hidden = true;
    element('pull-guide').setAttribute('hidden', '');
    element('replay-result').hidden = true;
    if (resetPopover) volumePopover.update({ active: false, point: { x: 0, y: 0 }, groundPoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 }, distance: 0, velocity: { x: 0, y: 0, z: 0 }, height: 0, volume: 0 });
  }
  function showKickGuide(result: Result) {
    const shot = result.shot; const contact = shot.contact;
    if (!contact) return;
    const p = scene.screenPoint(contact.point);
    const direction = kickDirection(shot.angle, shot.heading, contact);
    const kick = shot.angle < 0 ? 'spike' : direction.y > .15 ? 'loft' : 'drive';
    const label = element('contact-label');
    label.hidden = false; label.dataset.kick = kick;
    label.textContent = kick === 'spike' ? '↘ SPIKE' : kick === 'loft' ? '↗ LOFT' : '→ DRIVE';
    label.style.left = `${Math.max(8, Math.min(canvas.clientWidth - 120, p.x + 18))}px`;
    label.style.top = `${Math.max(38, p.y - 38)}px`;
    const aim = element('aim'); aim.hidden = false;
    aim.style.left = `${Math.max(82, Math.min(canvas.clientWidth - 82, p.x))}px`;
    aim.style.top = `${Math.max(8, Math.min(canvas.clientHeight - 65, p.y - 75))}px`;
    element('power').textContent = String(Math.round(shot.power));
    element('angle').textContent = `${shot.heading < -.5 ? '←' : shot.heading > .5 ? '→' : ''}${Math.abs(Math.round(shot.heading))}`;
    element('power-bar').style.width = `${shot.power}%`;
    const guide = element('pull-guide'); guide.removeAttribute('hidden'); guide.dataset.kick = kick;
    const tip = scene.screenPoint({ x: contact.point.x + direction.x * .65, y: contact.point.y + direction.y * .65, z: contact.point.z + direction.z * .65 });
    const kickLine = element('kick-line');
    kickLine.setAttribute('x1', String(p.x)); kickLine.setAttribute('y1', String(p.y));
    kickLine.setAttribute('x2', String(tip.x)); kickLine.setAttribute('y2', String(tip.y));
    // Match the game's parameter-only preview. Search results do not store a pointer gesture.
    const end = { x: p.x - Math.sin(shot.heading * Math.PI / 180) * shot.power, y: p.y + (shot.angle < 0 ? -1 : 1) * shot.power };
    const pullLine = element('pull-line');
    pullLine.setAttribute('x1', String(p.x)); pullLine.setAttribute('y1', String(p.y));
    pullLine.setAttribute('x2', String(end.x)); pullLine.setAttribute('y2', String(end.y));
    pullLine.setAttribute('stroke-width', String(2 + shot.power / 25));
    pullLine.setAttribute('stroke', shot.power > 80 ? '#e5633d' : '#f8f5df');
    element('pull-cursor').setAttribute('cx', String(end.x)); element('pull-cursor').setAttribute('cy', String(end.y));
  }
  function setRear(value: boolean) {
    if (rear !== value) { scene.setRearView(value); rear = value; }
  }
  function render() {
    if (!selected || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return;
    hideOverlays(time < 1);
    const index = time >= Number(timeline.max) ? selected.frames.length - 1
      : Math.min(selected.frames.length - 1, Math.max(0, Math.floor((time - 1) * 60)));
    setRear(time < 1.1);
    if (time < 1) {
      scene.dog.restore();
      scene.draw(initial.position, initial.rotation, false);
      if (time < .78) showKickGuide(selected);
      scene.beginStrike(selected.shot);
      if (time >= .78) scene.animateStrike(Math.min(1, (time - .78) / .22));
      scene.draw(initial.position, initial.rotation, false);
      element('phase').textContent = `${selected.mode === 'puppy' ? 'PUPPY' : 'SOLO'} / ${time < .78 ? 'CONTACT / WIND-UP' : 'CONTACT / STRIKE'}`;
      element('score').textContent = '0.000000%';
    } else {
      if (lastIndex < 0) scene.clearAim();
      const frame = selected.frames[index];
      scene.dog.restore(frame.dog);
      scene.draw(frame.position, frame.rotation, playing && index !== lastIndex);
      element('phase').textContent = `${selected.mode === 'puppy' ? 'PUPPY' : 'SOLO'} / ${Math.max(0, time - 1).toFixed(2)}s / ${selected.duration.toFixed(2)}s`;
      element('score').textContent = `${scorePosition(frame.position).toFixed(6)}%`;
      const prior = selected.frames[Math.max(0, index - 1)].position;
      const velocity = frame.velocity ?? { x: (frame.position.x - prior.x) * 60, y: (frame.position.y - prior.y) * 60, z: (frame.position.z - prior.z) * 60 };
      const finished = time >= Number(timeline.max);
      volumePopover.update({ active: !finished && !scene.dog.carrying && time - 1 > .6 && !rear, point: scene.screenPoint(frame.position),
        groundPoint: scene.screenPoint({ ...frame.position, y: .015 }), targetPoint: scene.screenPoint({ ...TARGET, y: .015 }),
        distance: Math.hypot(frame.position.x - TARGET.x, frame.position.z - TARGET.z), velocity,
        height: frame.position.y, volume: scorePosition(frame.position) });
      element('replay-result').hidden = !finished;
      element('result-volume').textContent = String(Math.round(selected.score));
    }
    lastIndex = time < 1 ? -1 : index;
    timeline.value = String(time);
  }
  function choose(result: Result, index: number) {
    selected = result; time = 0; lastIndex = -1; setPlaying(false);
    scene.clearTrail();
    timeline.max = String(1 + result.duration);
    play.disabled = restart.disabled = timeline.disabled = false;
    element('details').textContent = `${result.mode === 'puppy' ? `Puppy / seed ${result.seed}` : 'Solo'} · ${result.shot.angle < 0 ? 'Pull up to spike' : 'Pull down to loft'} · Power ${result.shot.power}% · Heading ${result.shot.heading}° · Contact X ${Math.round(result.u * 100)}% / Y ${Math.round(result.v * 100)}% (search grid) · Final ${result.score.toFixed(6)}% (game: ${Math.round(result.score)}%) · Distance ${result.distance.toFixed(6)}`;
    Array.from(element('results').children).forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    render();
  }
  function showResults(next: Result[]) {
    results = next;
    const list = element('results'); list.replaceChildren();
    results.forEach((result, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('aria-pressed', 'false');
      button.textContent = `${index + 1}. ${result.score.toFixed(6)}% · ${result.shot.angle < 0 ? 'Spike' : 'Loft'}`;
      const detail = document.createElement('small');
      detail.textContent = `Power ${result.shot.power} / Heading ${result.shot.heading}° / Distance ${result.distance.toFixed(3)}`;
      button.append(detail); button.addEventListener('click', () => { reports.showReplay(); choose(result, index); }); list.append(button);
    });
    download.disabled = results.length === 0;
    if (results[0]) choose(results[0], 0);
  }
  function finishSearch() {
    pool = undefined;
    search.disabled = false; stop.disabled = true;
    density.disabled = workerCount.disabled = upload.disabled = false;
    gameMode.disabled = false;
  }
  async function runSearch() {
    const requestedWorkers = Number(workerCount.value);
    const mode = gameMode.value as GameMode;
    // Contact sampling requires the visible aiming canvas.
    reports.showReplay();
    scene.resize();
    setPlaying(false);
    hideOverlays();
    scene.dog.restore();
    // Use the actual game mesh/raycaster, not an approximate analytic ellipsoid.
    setRear(true); scene.draw(initial.position, initial.rotation, false);
    const corners = [-.34, .34].flatMap(z => [0, 1.3].flatMap(y => [-.34, .34].map(x => scene.screenPoint({ x: initial.position.x + x, y, z }))));
    const minX = Math.min(...corners.map(p => p.x)); const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y)); const maxY = Math.max(...corners.map(p => p.y));
    const { count, powerStep, headingStep } = searchSettings[density.value];
    const samples: Sample[] = [];
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      const u = (col + .5) / count; const v = (row + .5) / count;
      const point = { x: minX + u * (maxX - minX), y: minY + v * (maxY - minY) };
      const contact = scene.pickContact(point);
      if (contact && point.x >= 0 && point.x <= canvas.clientWidth && point.y >= 0 && point.y <= canvas.clientHeight) {
        const sample: Sample = { contact, u, v, start: point, trials: 0 };
        const drags = sampleDrags(sample, { width: canvas.clientWidth, height: canvas.clientHeight, powerStep, headingStep });
        for (let next = drags.next(); !next.done; next = drags.next()) sample.trials++;
        if (sample.trials) samples.push(sample);
      }
    }
    if (!samples.length) { status.textContent = 'No contact points found. Check the viewer size and try again.'; render(); return; }
    search.disabled = true; stop.disabled = false;
    density.disabled = workerCount.disabled = upload.disabled = true;
    gameMode.disabled = true;
    searchStopped = false;
    progress.value = 0;
    reports.setTimings([]);
    const timingPanel = element('timings'); timingPanel.replaceChildren();
    const started = performance.now();
    try {
      status.textContent = `${mode === 'puppy' ? 'Puppy' : 'Solo'} · ${requestedWorkers} workers · ${samples.length} contact points · Preparing search…`;
      pool = createSearchPool({ samples, width: canvas.clientWidth, height: canvas.clientHeight, powerStep, headingStep, mode }, requestedWorkers,
        (completed, total, best) => {
          progress.value = completed / total;
          status.textContent = `${requestedWorkers} workers · ${completed.toLocaleString()} / ${total.toLocaleString()} trials · Best ${best.toFixed(6)}% · ${((performance.now() - started) / 1000).toFixed(1)}s elapsed`;
        });
      const completed = await pool.promise;
      pool = undefined;
      reports.setTimings([{ workers: completed.workers, requested: requestedWorkers, seconds: completed.seconds, preset: density.value, total: completed.total, mode, ...(mode === 'puppy' ? { seedMode: 'shot' as const } : {}) }]);
      reports.setReport({ ...completed.report, preset: density.value, workers: completed.workers, seconds: completed.seconds, createdAt: new Date().toISOString() });
      const row = document.createElement('p');
      row.textContent = `${completed.workers} workers · ${completed.seconds.toFixed(2)}s`;
      timingPanel.append(row);
      showResults(completed.results);
      progress.value = 1;
      status.textContent = `Completed · ${completed.seconds.toFixed(2)}s`;
    } catch (error) {
      status.textContent = searchStopped ? 'Stopped'
        : `Search failed: ${error instanceof Error ? error.message : String(error)}`;
      render();
    } finally { finishSearch(); }
  }
  search.addEventListener('click', () => { void runSearch(); });
  stop.addEventListener('click', () => { searchStopped = true; pool?.cancel(); });
  play.addEventListener('click', () => {
    if (time >= Number(timeline.max)) { time = 0; lastIndex = -1; scene.clearTrail(); }
    setPlaying(!playing); render();
  });
  restart.addEventListener('click', () => { time = 0; lastIndex = -1; scene.clearTrail(); setPlaying(true); render(); });
  element('replay-again').addEventListener('click', () => restart.click());
  timeline.addEventListener('input', () => { time = Number(timeline.value); lastIndex = -1; scene.clearTrail(); setPlaying(false); render(); });
  download.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ format: 'footy-lab-v2', results, report: reports.getReport(), timings: reports.getTimings() })], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'footy-lab-results.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  upload.addEventListener('change', async () => {
    const file = upload.files?.[0]; if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error('Files must be 20 MB or smaller.');
      const data = JSON.parse(await file.text()) as { format?: string; results?: unknown; report?: unknown; timings?: unknown };
      if (!['footy-lab-v1', 'footy-lab-v2'].includes(data.format ?? '') || !Array.isArray(data.results) || !data.results.length || data.results.length > 12) throw new Error('Choose a JSON file exported by this Lab.');
      const vector = (v: unknown): boolean => !!v && typeof v === 'object' && ['x', 'y', 'z'].every(key => Number.isFinite((v as Record<string, unknown>)[key]));
      const dogPose = (pose: DogPose | undefined): boolean => !!pose && typeof pose.enabled === 'boolean' && typeof pose.active === 'boolean'
        && (pose.carrying === undefined || typeof pose.carrying === 'boolean')
        && (pose.sitting === undefined || typeof pose.sitting === 'boolean')
        && vector(pose.position) && vector(pose.scale) && ['time', 'lift', 'heading', 'tilt', 'headTilt', 'tail', 'shadowScale', 'shadowOpacity'].every(key => Number.isFinite(pose[key as keyof DogPose]))
        && Array.isArray(pose.ears) && pose.ears.length === 2 && pose.ears.every(Number.isFinite)
        && Array.isArray(pose.legs) && pose.legs.length === 4 && pose.legs.every(Number.isFinite);
      const valid = data.results.every((r: Result) => r && r.shot && [40, -65].includes(r.shot.angle)
        && validEnvironment(r.mode, r.seed)
        && Number.isFinite(r.shot.power) && r.shot.power >= 5 && r.shot.power <= 100
        && Number.isFinite(r.shot.heading) && Math.abs(r.shot.heading) <= 30
        && vector(r.shot.contact?.point) && vector(r.shot.contact?.normal)
        && Number.isFinite(r.u) && r.u >= 0 && r.u <= 1 && Number.isFinite(r.v) && r.v >= 0 && r.v <= 1
        && Array.isArray(r.frames) && r.frames.length >= 2 && r.frames.length <= 1082
        && r.frames.every(f => f && vector(f.position) && vector(f.rotation) && Number.isFinite(f.rotation.w)
          && (f.velocity === undefined || vector(f.velocity)) && (r.mode === 'puppy' ? dogPose(f.dog) : f.dog === undefined)));
      if (!valid) throw new Error('Invalid replay data.');
      const importedReport = data.format === 'footy-lab-v2' && data.report !== undefined ? reports.restore(data.report) : undefined;
      const first = data.results[0] as Result;
      if (!(data.results as Result[]).every(r => (r.mode ?? 'solo') === (first.mode ?? 'solo'))
        || (importedReport && (importedReport.mode ?? 'solo') !== (first.mode ?? 'solo'))) throw new Error('Replay and report modes do not match.');
      if (importedReport?.mode === 'puppy' && !(data.results as Result[]).every(r => r.seed ===
        (importedReport.seedMode === 'shot' ? shotSeed(r.shot) : importedReport.seed))) throw new Error('Replay and report seeds do not match.');
      const importedTimings: Timing[] = [];
      if (data.format === 'footy-lab-v2' && data.timings !== undefined) {
        if (!Array.isArray(data.timings) || data.timings.length > workerCounts.length) throw new Error('Invalid timing data.');
        for (const t of data.timings as Timing[]) {
          if (!t || !Number.isInteger(t.workers) || t.workers < 1 || t.workers > 12 || !workerCounts.includes(t.requested)
            || !Number.isFinite(t.seconds) || t.seconds <= 0 || !Number.isSafeInteger(t.total) || t.total < 1 || typeof t.preset !== 'string' || !validEnvironment(t.mode, t.seed, t.seedMode)) throw new Error('Invalid timing data.');
          importedTimings.push(t);
        }
      }
      reports.setReport(importedReport); reports.setTimings(importedTimings);
      element('timings').replaceChildren();
      reports.showReplay();
      showResults((data.results as Result[]).map(r => {
        const p = r.frames[r.frames.length - 1].position;
        return { ...r, duration: (r.frames.length - 1) / 60, score: scorePosition(p), distance: Math.hypot(p.x - TARGET.x, p.z - TARGET.z) };
      }));
      status.textContent = 'Loaded';
    } catch (error) { status.textContent = `Import failed: ${error instanceof Error ? error.message : String(error)}`; }
    upload.value = '';
  });
  new ResizeObserver(() => { if (canvas.clientWidth > 0 && canvas.clientHeight > 0) { scene.clearTrail(); render(); } }).observe(canvas);
  function frame(now: number) {
    const dt = Math.min((now - previous) / 1000, .1); previous = now;
    if (playing && selected) {
      time = Math.min(Number(timeline.max), time + dt * Number(speed.value));
      if (time >= Number(timeline.max)) setPlaying(false);
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
void start().catch((error: unknown) => { status.textContent = `Could not prepare the Lab: ${String(error)}`; search.disabled = true; });
