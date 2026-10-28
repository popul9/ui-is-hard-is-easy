export function validSeed(seed: unknown): seed is number {
  return typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed <= 4294967295;
}
export function validEnvironment(mode: unknown, seed: unknown, seedMode?: unknown) {
  if (mode === undefined || mode === 'solo') return seed === undefined && seedMode === undefined;
  return mode === 'puppy' && (seedMode === 'shot' ? seed === undefined : seedMode === undefined && validSeed(seed));
}
