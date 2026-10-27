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
  let visible = false;

  return {
    update({ active, point, velocity, height, volume }: { active: boolean; point: { x: number; y: number }; velocity: { x: number; y: number; z: number }; height: number; volume: number }) {
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      // Separate thresholds keep the label steady through the last small bounces.
      visible = active && height < (visible ? 1.1 : 0.85)
        && speed < (visible ? 2.4 : 1.8);
      popover.classList.toggle('is-visible', visible);
      if (!visible) return;

      value.textContent = `${volume.toFixed(1)}%`;
      const halfWidth = popover.offsetWidth / 2 + 8;
      popover.style.left = `${Math.max(halfWidth, Math.min(canvas.clientWidth - halfWidth, point.x))}px`;
      popover.style.top = `${Math.max(popover.offsetHeight + 18, point.y - 18)}px`;
    },
  };
}
