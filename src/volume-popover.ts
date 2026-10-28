// Called by the game's existing animation loop, using the live physics state.
export function createVolumePopover(canvas: HTMLCanvasElement) {
  const popover = document.createElement('div');
  popover.className = 'ball-volume';
  popover.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = 'VOLUME';
  const value = document.createElement('strong');
  popover.append(label, value);
  canvas.parentElement!.append(popover);

  const guide = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  guide.classList.add('ball-distance-guide');
  guide.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  guide.append(line);
  const distanceLabel = document.createElement('div');
  distanceLabel.className = 'ball-distance-label';
  distanceLabel.setAttribute('aria-hidden', 'true');
  canvas.parentElement!.append(guide, distanceLabel);
  let visible = false;

  return {
    update({ active, point, groundPoint, targetPoint, distance, velocity, height, volume }: {
      active: boolean; point: { x: number; y: number }; groundPoint: { x: number; y: number };
      targetPoint: { x: number; y: number }; distance: number;
      velocity: { x: number; y: number; z: number }; height: number; volume: number;
    }) {
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      // Separate thresholds keep the label steady through the last small bounces.
      visible = active && height < (visible ? 1.1 : 0.85)
        && speed < (visible ? 2.4 : 1.8);
      popover.classList.toggle('is-visible', visible);
      guide.classList.toggle('is-visible', visible);
      distanceLabel.classList.toggle('is-visible', visible);
      if (!visible) return;

      value.textContent = `${volume.toFixed(1)}%`;
      const halfWidth = popover.offsetWidth / 2 + 8;
      popover.style.left = `${Math.max(halfWidth, Math.min(canvas.clientWidth - halfWidth, point.x))}px`;
      popover.style.top = `${Math.max(popover.offsetHeight + 18, point.y - 18)}px`;

      // Project both endpoints onto the turf; height should not inflate the distance.
      line.setAttribute('x1', String(groundPoint.x));
      line.setAttribute('y1', String(groundPoint.y));
      line.setAttribute('x2', String(targetPoint.x));
      line.setAttribute('y2', String(targetPoint.y));
      distanceLabel.textContent = `≈ ${distance.toFixed(1)} m`;
      const shortLine = Math.hypot(targetPoint.x - groundPoint.x, targetPoint.y - groundPoint.y) < 64;
      const labelX = (groundPoint.x + targetPoint.x) / 2;
      const labelY = shortLine ? groundPoint.y + 26 : (groundPoint.y + targetPoint.y) / 2 + 12;
      const labelHalfWidth = distanceLabel.offsetWidth / 2 + 8;
      const labelHalfHeight = distanceLabel.offsetHeight / 2 + 8;
      distanceLabel.style.left = `${Math.max(labelHalfWidth, Math.min(canvas.clientWidth - labelHalfWidth, labelX))}px`;
      distanceLabel.style.top = `${Math.max(labelHalfHeight, Math.min(canvas.clientHeight - labelHalfHeight, labelY))}px`;
    },
  };
}
