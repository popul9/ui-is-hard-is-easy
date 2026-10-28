import type { Contact, Shot, Vector3 } from '../src/input';
import type { DogPose } from '../src/dog';
export type GameMode = 'solo' | 'puppy';
export type Sample = { contact: Contact; u: number; v: number; start: { x: number; y: number }; trials: number };
export type Frame = { position: Vector3; rotation: Vector3 & { w: number }; velocity?: Vector3; dog?: DogPose };
export type Result = { shot: Shot; u: number; v: number; score: number; distance: number; duration: number; frames: Frame[]; mode?: GameMode; seed?: number; drag?: { start: { x: number; y: number }; end: { x: number; y: number }; width: number; height: number } };
export type SearchRequest = { samples: Sample[]; width: number; height: number; powerStep: number; headingStep: number; mode?: GameMode };
export type Stats = { count: number; sum: number; best: number; rounded100: number; above999: number; above9999: number };
export type ContactReport = Stats & { u: number; v: number; angle: number };
export type CellReport = Stats & { power: number; heading: number; angle: number };
export type Distribution = { angle: number; bins: number[]; tail: number[] };
export type SearchReport = {
  version: 1; total: number; powers: number[]; headings: number[];
  contacts: ContactReport[]; cells: CellReport[]; distributions: Distribution[];
  mode?: GameMode; seed?: number; seedMode?: 'shot';
};
export type RunReport = SearchReport & { preset: string; workers: number; seconds: number; createdAt: string };
export type SearchMessage = { type: 'progress'; completed: number; total: number; best: number }
  | { type: 'done'; results: Result[]; total: number; report: SearchReport }
  | { type: 'error'; message: string };
