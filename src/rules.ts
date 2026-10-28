import { START, TARGET } from './physics';
import type { Vector3 } from './input';

export function scorePosition(p: Vector3) {
  const distance = Math.hypot(p.x - TARGET.x, p.z - TARGET.z);
  const startingDistance = Math.hypot(START.x - TARGET.x, START.z - TARGET.z);
  return Math.max(0, Math.min(100, (1 - distance / startingDistance) * 100));
}

export function flightFinished(p: Vector3, elapsed: number, settled: number, sleeping: boolean,
  dogEnabled = false, playFinished = false, carrying = false) {
  return !carrying && (((dogEnabled ? playFinished : elapsed > 1) && (settled > 0.7 || sleeping))
    || elapsed > 18 || Math.abs(p.x) > 24 || Math.abs(p.z) > 13);
}
