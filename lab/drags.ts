import { dragEnd, dragShot } from '../src/input';
import type { SearchRequest, Sample } from './types';

export function* sampleDrags(sample: Sample, request: Pick<SearchRequest, 'width' | 'height' | 'powerStep' | 'headingStep'>) {
  const { width, height, powerStep, headingStep } = request;
  const powers = Array.from({ length: Math.floor(95 / powerStep) + 1 }, (_, i) => 5 + i * powerStep);
  if (powers.at(-1) !== 100) powers.push(100);
  for (const angle of [40, -65]) for (const power of powers) for (let heading = -30; heading <= 30; heading += headingStep) {
    const end = dragEnd(sample.start, height, power, heading, angle);
    if (end.x < 0 || end.x > width || end.y < 0 || end.y > height) continue;
    const shot = dragShot(sample.start, end, height, sample.contact);
    if (shot.power < 5) continue;
    yield { power, heading, angle, start: sample.start, end, shot };
  }
}
