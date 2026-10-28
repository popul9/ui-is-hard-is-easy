import RAPIER from '@dimforge/rapier3d-compat';
import { Scene } from 'three';
import { createDog } from '../src/dog';
import { shotSeed } from '../src/random';
import { createPhysics, kickBody, TARGET } from '../src/physics';
import { flightFinished, scorePosition } from '../src/rules';
import type { Frame, Result, SearchMessage, SearchRequest } from './types';
import type { SearchReport } from './types';
import { sampleDrags } from './drags';
import { emptyStats, addScore } from './statistics';

const send = (message: SearchMessage) => postMessage(message);
// Reuse the engine and initial snapshot for successive contact-point jobs.
let setup: Promise<{ snapshot: Uint8Array; handle: number }> | undefined;
let dog: ReturnType<typeof createDog> | undefined;
async function prepare() {
  const initial = await createPhysics();
  try {
    initial.reset(true);
    return { snapshot: initial.world.takeSnapshot(), handle: initial.body.handle };
  } finally { initial.world.free(); }
}
onmessage = async (event: MessageEvent<SearchRequest>) => {
  try {
    const { samples, powerStep, headingStep, mode = 'solo' } = event.data;
    const withPuppy = mode === 'puppy';
    if (withPuppy && !dog) dog = createDog(new Scene());
    const { snapshot, handle } = await (setup ??= prepare());
    function simulate(result: Result, record = false): Result {
      // A fresh snapshot also resets contact caches, sleeping, and solver state.
      const world = RAPIER.World.restoreSnapshot(snapshot);
      try {
        const body = world.getRigidBody(handle);
        const seed = withPuppy ? shotSeed(result.shot) : undefined;
        if (withPuppy) dog!.start(seed);
        const frame = (): Frame => ({ position: { ...body.translation() }, rotation: { ...body.rotation() }, velocity: { ...body.linvel() }, ...(withPuppy ? { dog: dog!.capture() } : {}) });
        const frames: Frame[] = record ? [frame()] : [];
        const { power, angle, heading, contact } = result.shot;
        kickBody(body, power, angle, heading, contact);
        let elapsed = 0; let settled = 0;
        for (;;) {
          if (withPuppy) dog!.update(1 / 60, body, true);
          world.step(); elapsed += 1 / 60;
          const v = body.linvel(); const w = body.angvel();
          settled = Math.hypot(v.x, v.y, v.z) < .15 && Math.hypot(w.x, w.y, w.z) < .25 ? settled + 1 / 60 : 0;
          if (record) frames.push(frame());
          const p = body.translation();
          if (flightFinished(p, elapsed, settled, body.isSleeping(), withPuppy, dog?.playFinished, withPuppy && dog!.carrying)) {
            return { ...result, mode, ...(withPuppy ? { seed } : {}), score: scorePosition(p), distance: Math.hypot(p.x - TARGET.x, p.z - TARGET.z), duration: elapsed, frames };
          }
        }
      } finally { world.free(); }
    }
    const powers = Array.from({ length: Math.floor(95 / powerStep) + 1 }, (_, i) => 5 + i * powerStep);
    if (powers.at(-1) !== 100) powers.push(100);
    const headings = Array.from({ length: 60 / headingStep + 1 }, (_, i) => -30 + i * headingStep);
    const report: SearchReport = { version: 1, total: 0, powers, headings, contacts: [], cells: [], distributions: [], mode, ...(withPuppy ? { seedMode: 'shot' as const } : {}) };
    const total = samples.reduce((sum, sample) => sum + sample.trials, 0);
    let completed = 0; let best = 0;
    const winners: Result[] = [];
    // Keep a winner for each contact and kick type, then show the best of those.
    for (const sample of samples) for (const angle of [40, -65]) {
      const contactStats = { ...emptyStats(), u: sample.u, v: sample.v, angle };
      report.contacts.push(contactStats);
      let distribution = report.distributions.find(d => d.angle === angle);
      if (!distribution) {
        distribution = { angle, bins: Array<number>(1001).fill(0), tail: Array<number>(501).fill(0) };
        report.distributions.push(distribution);
      }
      let winner: Result | undefined;
      for (const drag of sampleDrags(sample, event.data)) {
        if (drag.angle !== angle) continue;
        const { power, heading, shot, start, end } = drag;
        const result = simulate({ shot, drag: { start, end, width: event.data.width, height: event.data.height }, u: sample.u, v: sample.v,
          score: 0, distance: 0, duration: 0, frames: [] });
        if (!winner || result.score > winner.score) winner = result;
        addScore(contactStats, result.score);
        // One job is one contact point; the pool merges matching power/heading cells.
        report.cells.push({ ...emptyStats(), count: 1, sum: result.score, best: result.score,
          rounded100: Number(result.score >= 99.5), above999: Number(result.score >= 99.9), above9999: Number(result.score >= 99.99), power, heading, angle });
        distribution.bins[Math.min(1000, Math.floor(result.score * 10))]++;
        if (result.score >= 99.5) distribution.tail[Math.min(500, Math.floor(result.score * 1000) - 99500)]++;
        best = Math.max(best, result.score); completed++;
        if (completed % 100 === 0) send({ type: 'progress', completed, total, best });
      }
      if (winner) winners.push(winner);
      else report.contacts.pop();
    }
    // Return every contact/type winner; the pool selects the global top results.
    report.total = total;
    send({ type: 'done', total, results: winners.map(result => simulate(result, true)), report });
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
