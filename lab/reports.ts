import type { CellReport, ContactReport, RunReport, Stats } from './types';
import { emptyStats, mergeStats, validReport } from './statistics';

export type Timing = { workers: number; requested: number; seconds: number; preset: string; total: number; mode?: 'solo' | 'puppy'; seed?: number; seedMode?: 'shot' };
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const number = (n: number) => n.toLocaleString('en-US');
const score = (n: number) => n.toFixed(6);
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const item = document.createElement(tag); if (text !== undefined) item.textContent = text; return item;
};
const sumStats = (stats: Stats[]) => stats.reduce((total, stat) => mergeStats(total, stat), emptyStats());
const describe = (s: Stats) => `${number(s.count)} trials · best ${score(s.best)}% · mean ${score(s.sum / s.count)}% · ≥99.5: ${number(s.rounded100)} (${score(s.rounded100 / s.count * 100)}%) · ≥99.9: ${number(s.above999)} · ≥99.99: ${number(s.above9999)}`;

export function createReports(onTabChange: (tab: string) => void) {
  let report: RunReport | undefined;
  let timings: Timing[] = [];
  let tab = 'replay';
  const tabs = [...byId('report-tabs').querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const kick = byId<HTMLSelectElement>('report-kick');
  const metric = byId<HTMLSelectElement>('report-metric');
  const value = (s: Stats) => metric.value === 'best' ? s.best : metric.value === 'mean' ? s.sum / s.count
    : s[metric.value as 'rounded100' | 'above999' | 'above9999'] / s.count * 100;
  const color = (n: number, max: number) => {
    const intensity = max > 0 ? n / max * 100 : 0;
    return `hsl(${45 + intensity * .9} 48% ${94 - intensity * .55}%)`;
  };
  function select(next: string) {
    tab = next;
    tabs.forEach(button => {
      const active = button.id === `tab-${tab}`;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
      byId(button.getAttribute('aria-controls')!).hidden = !active;
    });
    byId('report-controls').hidden = !['overview', 'contacts', 'parameters', 'distribution'].includes(tab);
    metric.disabled = !['contacts', 'parameters'].includes(tab);
    draw(); onTabChange(tab);
  }
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => select(button.id.slice(4)));
    button.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); tabs[next].focus(); select(tabs[next].id.slice(4));
    });
  });
  kick.addEventListener('change', draw); metric.addEventListener('change', draw);
  function table(parent: HTMLElement, headers: string[], rows: string[][]) {
    const wrap = node('div'); wrap.className = 'report-table';
    const table = node('table'); const head = node('thead'); const tr = node('tr');
    headers.forEach(label => { const th = node('th', label); th.scope = 'col'; tr.append(th); });
    head.append(tr); table.append(head); const body = node('tbody');
    rows.forEach(values => { const row = node('tr'); values.forEach(value => row.append(node('td', value))); body.append(row); });
    table.append(body); wrap.append(table); parent.append(wrap);
  }
  function chart(parent: HTMLElement, label: string, width: number, height: number) {
    const canvas = node('canvas'); canvas.width = width; canvas.height = height;
    canvas.className = 'report-chart'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', label);
    parent.append(canvas); return canvas;
  }
  function draw() {
    if (tab === 'replay') return;
    const panel = byId(`panel-${tab}`); panel.replaceChildren();
    if (tab === 'performance') {
      table(panel, ['Mode', 'Grid', 'Workers', 'Trials', 'Seconds', 'Trials / second'], timings.map(t => {
        return [t.mode === 'puppy' ? (t.seedMode === 'shot' ? 'Puppy / shot-derived' : `Puppy / seed ${t.seed}`) : 'Solo', t.preset, String(t.workers), number(t.total), t.seconds.toFixed(2), number(Math.round(t.total / t.seconds))];
      }));
      if (!timings.length) panel.append(node('p', 'No timings'));
      return;
    }
    if (!report) { panel.append(node('p', 'No report')); return; }
    const matches = (item: { angle: number }) => kick.value === 'all' || item.angle === Number(kick.value);
    const contacts = report.contacts.filter(matches);
    const totals = sumStats(contacts);
    if (tab === 'overview') {
      const cards = node('div'); cards.className = 'report-cards';
      for (const [label, text] of [['Trials', number(totals.count)], ['Best score', `${score(totals.best)}%`], ['Mean score', `${score(totals.sum / totals.count)}%`], ['100% display rate (≥99.5)', `${score(totals.rounded100 / totals.count * 100)}%`]]) {
        const card = node('div'); card.append(node('span', label), node('strong', text)); cards.append(card);
      }
      panel.append(cards, node('p', `${report.mode === 'puppy' ? (report.seedMode === 'shot' ? 'Puppy / shot-derived seeds' : `Puppy / seed ${report.seed}`) : 'Solo'} · ${report.preset} · ${report.workers} workers · ${report.seconds.toFixed(2)}s · ${new Date(report.createdAt).toLocaleString()}`));
      panel.append(node('p', `${report.contacts.length / 2} sampled contacts · ${report.powers.length} powers · ${report.headings.length} headings · 2 kick types`));
      table(panel, ['Kick', 'Trials', 'Best %', 'Mean %', '≥99.5', '≥99.9', '≥99.99'], [40, -65].filter(angle => kick.value === 'all' || Number(kick.value) === angle).map(angle => {
        const s = sumStats(contacts.filter(c => c.angle === angle));
        return [angle === 40 ? 'Loft' : 'Spike', number(s.count), score(s.best), score(s.sum / s.count), number(s.rounded100), number(s.above999), number(s.above9999)];
      }));
    } else if (tab === 'contacts') {
      const merged = new Map<string, ContactReport>();
      for (const c of contacts) {
        const key = `${c.u}/${c.v}`; const existing = merged.get(key);
        if (existing) mergeStats(existing, c); else merged.set(key, { ...c });
      }
      const map = node('div'); map.className = 'contact-map'; map.setAttribute('aria-label', 'Ball contact heatmap');
      const peak = Math.max(0, ...[...merged.values()].map(value));
      const detail = node('p', 'Hover or tap to inspect'); detail.className = 'chart-detail'; detail.setAttribute('aria-live', 'polite');
      for (const c of merged.values()) {
        const button = node('button', ''); button.type = 'button';
        const label = `Contact X ${Math.round(c.u * 100)}%, Y ${Math.round(c.v * 100)}%: ${describe(c)}`;
        button.title = label; button.setAttribute('aria-label', label);
        button.style.left = `${c.u * 100}%`; button.style.top = `${c.v * 100}%`; button.style.background = color(value(c), peak);
        const inspect = () => { detail.textContent = label; };
        button.addEventListener('mouseenter', inspect); button.addEventListener('focus', inspect); button.addEventListener('click', inspect); map.append(button);
      }
      panel.append(map, node('p', `Light: 0% · Dark: ${score(peak)}%`), detail);
    } else if (tab === 'parameters') {
      const merged = new Map<string, CellReport>();
      for (const c of report.cells.filter(matches)) {
        const key = `${c.power}/${c.heading}`; const existing = merged.get(key);
        if (existing) mergeStats(existing, c); else merged.set(key, { ...c });
      }
      const canvas = chart(panel, 'Power on horizontal axis, heading in degrees on vertical axis. Cell color shows the selected score metric.', 1000, 640);
      const peak = Math.max(0, ...[...merged.values()].map(value));
      canvas.tabIndex = 0;
      const ctx = canvas.getContext('2d')!; const left = 65; const top = 25; const w = 900; const h = 550;
      const dx = w / report.powers.length; const dy = h / report.headings.length;
      for (const c of merged.values()) {
        ctx.fillStyle = color(value(c), peak); ctx.fillRect(left + report.powers.indexOf(c.power) * dx, top + report.headings.indexOf(c.heading) * dy, dx + .2, dy + .2);
      }
      ctx.fillStyle = '#253c3a'; ctx.font = '18px system-ui';
      ctx.fillText('Heading (°) ↓', left, 18);
      for (const i of [...new Set([0, Math.floor(report.powers.length / 2), report.powers.length - 1])]) ctx.fillText(String(report.powers[i]), left + i * dx, top + h + 25);
      for (const i of [...new Set([0, Math.floor(report.headings.length / 2), report.headings.length - 1])]) ctx.fillText(`${report.headings[i]}°`, 10, top + i * dy + 16);
      ctx.fillText('Power (%) →', left + w / 2 - 40, 625);
      const detail = node('p', 'Hover or tap to inspect'); detail.className = 'chart-detail'; detail.setAttribute('aria-live', 'polite'); panel.append(detail);
      let x = 0; let y = 0;
      const inspect = () => { const cell = merged.get(`${report!.powers[x]}/${report!.headings[y]}`); if (cell) detail.textContent = `Power ${cell.power}% · heading ${cell.heading}° · ${describe(cell)}`; };
      const point = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        x = Math.max(0, Math.min(report!.powers.length - 1, Math.floor(((event.clientX - rect.left) / rect.width * canvas.width - left) / dx)));
        y = Math.max(0, Math.min(report!.headings.length - 1, Math.floor(((event.clientY - rect.top) / rect.height * canvas.height - top) / dy))); inspect();
      };
      canvas.addEventListener('mousemove', point); canvas.addEventListener('click', point); canvas.addEventListener('focus', inspect);
      canvas.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); x = Math.max(0, Math.min(report!.powers.length - 1, x + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
        y = Math.max(0, Math.min(report!.headings.length - 1, y + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0))); inspect();
      });
      panel.append(node('p', `Light: 0% · Dark: ${score(peak)}%`));
      const topCells = [...merged.values()].sort((a, b) => value(b) - value(a) || b.best - a.best).slice(0, 10);
      table(panel, ['Top cells', 'Heading', 'Metric %', 'Trials', 'Best %'], topCells.map(c => [String(c.power), `${c.heading}°`, score(value(c)), number(c.count), score(c.best)]));
    } else if (tab === 'distribution') {
      const range = node('select'); range.setAttribute('aria-label', 'Score distribution range');
      for (const [value, label] of [['all', '0–100 · bins of 1 point'], ['tail', '99.5–100 · bins of 0.01 point']]) { const option = node('option', label); option.value = value; range.append(option); }
      panel.append(range);
      const holder = node('div'); panel.append(holder);
      const histogram = () => {
        holder.replaceChildren(); const tail = range.value === 'tail'; const size = tail ? 51 : 101;
        const bins = Array<number>(size).fill(0);
        for (const d of report!.distributions.filter(matches)) (tail ? d.tail : d.bins).forEach((n, i) => { bins[Math.min(size - 1, Math.floor(i / 10))] += n; });
        const canvas = chart(holder, 'Final score histogram. Horizontal axis is score percent; vertical axis is trial count with a square-root scale.', 1000, 440);
        const ctx = canvas.getContext('2d')!; const peak = Math.max(...bins); const max = Math.max(1, peak); const left = 85; const top = 25; const w = 870; const h = 340; const dx = w / bins.length;
        ctx.fillStyle = '#54745c'; bins.forEach((n, i) => { const height = Math.sqrt(n / max) * h; ctx.fillRect(left + i * dx, top + h - height, Math.max(1, dx - 1), height); });
        ctx.fillStyle = '#253c3a'; ctx.font = '17px system-ui';
        for (const fraction of [0, .5, 1]) { const y = top + h - fraction * h; ctx.fillText(number(Math.round(peak * fraction ** 2)), 3, y + 5); }
        for (const i of [0, Math.floor(bins.length / 2), bins.length - 1]) ctx.fillText(tail ? (99.5 + i * .01).toFixed(2) : String(i), left + i * dx - 10, top + h + 28);
        ctx.fillText('Final score (%) →', 440, 425);
        const detail = node('p', 'Hover or tap to inspect'); detail.className = 'chart-detail'; holder.append(detail);
        const inspect = (event: MouseEvent) => {
          const rect = canvas.getBoundingClientRect(); const i = Math.max(0, Math.min(bins.length - 1, Math.floor(((event.clientX - rect.left) / rect.width * canvas.width - left) / dx)));
          const low = tail ? 99.5 + i * .01 : i; const high = Math.min(100, low + (tail ? .01 : 1));
          detail.textContent = `${i === bins.length - 1 ? 'Exactly 100' : `[${low.toFixed(tail ? 2 : 0)}, ${high.toFixed(tail ? 2 : 0)})`}% · ${number(bins[i])} trials · ${score(bins[i] / totals.count * 100)}% of all filtered trials`;
        };
        canvas.addEventListener('mousemove', inspect); canvas.addEventListener('click', inspect);
        holder.append(node('p', 'Trials · square-root scale'));
        table(holder, ['Threshold', 'Trials', '% of all filtered trials'], [['≥99.5 (game displays 100%)', totals.rounded100], ['≥99.9', totals.above999], ['≥99.99', totals.above9999]].map(([label, n]) => [String(label), number(Number(n)), score(Number(n) / totals.count * 100)]));
        const details = node('details'); details.append(node('summary', 'Bin counts'));
        table(details, ['Score interval %', 'Trials'], bins.map((n, i) => {
          const low = tail ? 99.5 + i * .01 : i; const high = Math.min(100, low + (tail ? .01 : 1));
          return [i === bins.length - 1 ? 'Exactly 100' : `[${low.toFixed(tail ? 2 : 0)}, ${high.toFixed(tail ? 2 : 0)})`, number(n)];
        })); holder.append(details);
      };
      range.addEventListener('change', histogram); histogram();
    }
  }
  return {
    showReplay() { select('replay'); },
    setReport(next: RunReport | undefined) { report = next; draw(); },
    setTimings(next: Timing[]) { timings = next; draw(); },
    getReport() { return report; },
    getTimings() { return timings; },
    restore(value: unknown) {
      if (!validReport(value)) throw new Error('Invalid report statistics.');
      const run = value as RunReport;
      if (typeof run.preset !== 'string' || !Number.isInteger(run.workers) || run.workers < 1 || run.workers > 12 || !Number.isFinite(run.seconds) || run.seconds <= 0 || !Number.isFinite(Date.parse(run.createdAt))) throw new Error('Invalid report metadata.');
      return run;
    },
  };
}
