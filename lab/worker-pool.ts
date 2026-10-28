import type { Result, SearchMessage, SearchRequest, SearchReport, CellReport } from './types';
import { mergeStats } from './statistics';

export function createSearchPool(request: SearchRequest, count: number,
  onProgress: (completed: number, total: number, best: number) => void) {
  const workers: Worker[] = [];
  let rejectSearch: (reason: Error) => void = () => {};
  let ended = false;
  const close = () => { ended = true; workers.forEach(worker => worker.terminate()); };
  const promise = new Promise<{ results: Result[]; total: number; workers: number; seconds: number; report: SearchReport }>((resolve, reject) => {
    rejectSearch = reject;
    const started = performance.now();
    const total = request.samples.reduce((sum, sample) => sum + sample.trials, 0);
    const activeCount = Math.min(count, request.samples.length);
    const inFlight = new Map<Worker, number>();
    const winners: Result[] = [];
    const report: SearchReport = { version: 1, total, powers: [], headings: [], contacts: [], cells: [], distributions: [], mode: request.mode ?? 'solo', ...(request.mode === 'puppy' ? { seedMode: 'shot' as const } : {}) };
    const cells = new Map<string, CellReport>();
    let next = 0; let completed = 0; let finishedSamples = 0; let best = 0;
    const notifyProgress = () => onProgress(completed + [...inFlight.values()].reduce((sum, value) => sum + value, 0), total, best);
    const fail = (error: Error) => { if (!ended) { close(); reject(error); } };
    const assign = (worker: Worker) => {
      if (next >= request.samples.length) { inFlight.delete(worker); return; }
      inFlight.set(worker, 0);
      worker.postMessage({ ...request, samples: [request.samples[next++]] } satisfies SearchRequest);
    };
    try {
      for (let i = 0; i < activeCount; i++) {
        const worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
        workers.push(worker);
        worker.onerror = event => fail(new Error(event.message || 'Worker failed.'));
        worker.onmessageerror = () => fail(new Error('Could not read a worker result.'));
        worker.onmessage = (event: MessageEvent<SearchMessage>) => {
          if (ended) return;
          try {
            const message = event.data;
            if (message.type === 'error') { fail(new Error(message.message)); return; }
            if (message.type === 'progress') {
              inFlight.set(worker, message.completed); best = Math.max(best, message.best); notifyProgress();
              return;
            }
            completed += message.total; finishedSamples++; inFlight.delete(worker);
            report.powers = message.report.powers; report.headings = message.report.headings;
            report.contacts.push(...message.report.contacts);
            for (const cell of message.report.cells) {
              const key = `${cell.angle}/${cell.power}/${cell.heading}`;
              const existing = cells.get(key);
              if (existing) mergeStats(existing, cell); else cells.set(key, { ...cell });
            }
            for (const distribution of message.report.distributions) {
              const existing = report.distributions.find(d => d.angle === distribution.angle);
              if (existing) {
                distribution.bins.forEach((n, i) => { existing.bins[i] += n; });
                distribution.tail.forEach((n, i) => { existing.tail[i] += n; });
              } else report.distributions.push(distribution);
            }
            winners.push(...message.results);
            // Retain only candidates that can still enter the final top ten or win a kick type.
            // Statistics above still include every trial; this bounds replay memory on Ultra.
            winners.sort((a, b) => b.score - a.score || a.v - b.v || a.u - b.u || b.shot.angle - a.shot.angle);
            const retained = new Set(winners.slice(0, 10));
            for (const angle of [40, -65]) {
              const winner = winners.find(result => result.shot.angle === angle);
              if (winner) retained.add(winner);
            }
            const remaining = winners.filter(result => retained.has(result));
            winners.splice(0, winners.length, ...remaining);
            for (const result of message.results) best = Math.max(best, result.score);
            notifyProgress();
            if (finishedSamples === request.samples.length) {
              // Tie order follows the original grid order, regardless of worker completion order.
              winners.sort((a, b) => b.score - a.score || a.v - b.v || a.u - b.u || b.shot.angle - a.shot.angle);
              const selected = winners.slice(0, 10);
              for (const angle of [40, -65]) {
                const winner = winners.find(result => result.shot.angle === angle);
                if (winner && !selected.includes(winner)) selected.push(winner);
              }
              const seconds = (performance.now() - started) / 1000;
              report.cells = [...cells.values()].sort((a, b) => b.angle - a.angle || a.heading - b.heading || a.power - b.power);
              report.contacts.sort((a, b) => b.angle - a.angle || a.v - b.v || a.u - b.u);
              close(); resolve({ results: selected, total, workers: activeCount, seconds, report });
            } else assign(worker);
          } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
        };
        assign(worker);
      }
      if (!activeCount) fail(new Error('No contact points to search.'));
    } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  });
  return { promise, cancel() { if (!ended) { close(); rejectSearch(new DOMException('Search stopped.', 'AbortError')); } } };
}
