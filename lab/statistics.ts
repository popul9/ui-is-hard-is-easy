import type { Stats, SearchReport } from './types';
import { validEnvironment } from './random';

export const emptyStats = (): Stats => ({ count: 0, sum: 0, best: 0, rounded100: 0, above999: 0, above9999: 0 });
export function addScore(stats: Stats, score: number) {
  stats.count++; stats.sum += score; stats.best = Math.max(stats.best, score);
  if (score >= 99.5) stats.rounded100++;
  if (score >= 99.9) stats.above999++;
  if (score >= 99.99) stats.above9999++;
}
export function mergeStats(target: Stats, source: Stats) {
  target.count += source.count; target.sum += source.sum; target.best = Math.max(target.best, source.best);
  target.rounded100 += source.rounded100; target.above999 += source.above999; target.above9999 += source.above9999;
  return target;
}
export function validReport(value: unknown): value is SearchReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as SearchReport;
  if (!validEnvironment(report.mode, report.seed, report.seedMode)) return false;
  const stats = (s: Stats) => s && Number.isSafeInteger(s.count) && s.count > 0 && Number.isFinite(s.sum)
    && s.sum >= 0 && s.sum <= s.count * 100 + .001 && Number.isFinite(s.best) && s.best >= 0 && s.best <= 100
    && [s.rounded100, s.above999, s.above9999].every(n => Number.isSafeInteger(n) && n >= 0 && n <= s.count)
    && s.above9999 <= s.above999 && s.above999 <= s.rounded100;
  const axis = (a: number[], min: number, max: number, limit: number) => Array.isArray(a) && a.length > 0 && a.length <= limit
    && a.every((n, i) => Number.isFinite(n) && n >= min && n <= max && (i === 0 || n > a[i - 1]));
  if (report.version !== 1 || !Number.isSafeInteger(report.total) || report.total < 1
    || !axis(report.powers, 5, 100, 96) || !axis(report.headings, -30, 30, 61)
    || !Array.isArray(report.contacts) || !report.contacts.length || report.contacts.length > 578
    || !Array.isArray(report.cells) || !report.cells.length || report.cells.length > 2 * report.powers.length * report.headings.length
    || !Array.isArray(report.distributions) || report.distributions.length !== 2) return false;
  const angle = (a: number) => a === 40 || a === -65;
  if (!report.contacts.every(c => stats(c) && angle(c.angle) && Number.isFinite(c.u) && c.u >= 0 && c.u <= 1 && Number.isFinite(c.v) && c.v >= 0 && c.v <= 1)
    || !report.cells.every(c => stats(c) && angle(c.angle) && report.powers.includes(c.power) && report.headings.includes(c.heading))) return false;
  const counts = (bins: number[], length: number) => Array.isArray(bins) && bins.length === length && bins.every(n => Number.isSafeInteger(n) && n >= 0 && n <= report.total);
  if (!report.distributions.every(d => d && angle(d.angle) && counts(d.bins, 1001) && counts(d.tail, 501))) return false;
  const sum = (a: number[]) => a.reduce((total, n) => total + n, 0);
  return sum(report.contacts.map(c => c.count)) === report.total
    && sum(report.cells.map(c => c.count)) === report.total
    && sum(report.distributions.flatMap(d => d.bins)) === report.total
    && sum(report.distributions.flatMap(d => d.tail)) === sum(report.contacts.map(c => c.rounded100))
    && new Set(report.distributions.map(d => d.angle)).size === 2
    && new Set(report.cells.map(c => `${c.angle}/${c.power}/${c.heading}`)).size === report.cells.length
    && new Set(report.contacts.map(c => `${c.angle}/${c.u}/${c.v}`)).size === report.contacts.length;
}
