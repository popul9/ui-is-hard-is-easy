import type { Shot } from './input';

// Mulberry32: independent, repeatable random streams for puppy reactions.
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

// Hash the exact shot parameters, including contact geometry, in a fixed byte order.
export function shotSeed(shot: Shot) {
  const contact = shot.contact;
  const values = [shot.power, shot.angle, shot.heading, contact ? 1 : 0,
    ...(contact ? [contact.point.x, contact.point.y, contact.point.z,
      contact.normal.x, contact.normal.y, contact.normal.z] : [])];
  const bytes = new DataView(new ArrayBuffer(8));
  let hash = 2166136261;
  for (const value of values) {
    bytes.setFloat64(0, value === 0 ? 0 : value, true);
    for (let i = 0; i < 8; i++) hash = Math.imul(hash ^ bytes.getUint8(i), 16777619) >>> 0;
  }
  return hash;
}
