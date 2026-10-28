export type Vector3 = { x: number; y: number; z: number };
export type Contact = { point: Vector3; normal: Vector3 };
export type Shot = { power: number; angle: number; heading: number; contact?: Contact };
export type PointerPosition = { x: number; y: number };
// Canvas-local positions are shared by pointer input and the lab.
export function dragShot(start: PointerPosition, end: PointerPosition, height: number, contact: Contact): Shot {
  const dx = start.x - end.x; const dy = end.y - start.y;
  const downward = dy < 0;
  const room = downward ? start.y - 16 : height - start.y - 16;
  const travel = Math.max(45, Math.min(150, height * 0.34, room));
  return { contact, power: Math.min(100, Math.abs(dy) / travel * 100), angle: downward ? -65 : 40,
    heading: Math.max(-30, Math.min(30, Math.atan2(dx, Math.max(35, Math.abs(dy))) * 180 / Math.PI)) };
}

export function dragEnd(start: PointerPosition, height: number, power: number, heading: number, angle: number): PointerPosition {
  const room = angle < 0 ? start.y - 16 : height - start.y - 16;
  const travel = Math.max(45, Math.min(150, height * 0.34, room));
  const dy = power / 100 * travel * (angle < 0 ? -1 : 1);
  return { x: start.x - Math.tan(heading * Math.PI / 180) * Math.max(35, Math.abs(dy)), y: start.y + dy };
}

export function bindInput(canvas: HTMLCanvasElement, options: {
  canAim: () => boolean;
  pickContact: (cursor: PointerPosition) => Contact | null;
  defaultContact: () => Contact;
  contactScreen: (contact: Contact) => PointerPosition;
  hover: (contact: Contact | null) => void;
  preview: (shot: Shot, cursor?: PointerPosition) => void;
  release: (shot: Shot) => void;
  cancel: () => void;
}) {
  let pointer: number | null = null;
  let start = { x: 0, y: 0 };
  let shot: Shot = { power: 65, angle: 40, heading: 0 };
  const localPoint = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const cancel = () => {
    const captured = pointer; pointer = null;
    if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
    delete shot.contact;
    options.cancel();
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (!options.canAim() || pointer !== null || event.button !== 0) return;
    const local = localPoint(event);
    const contact = options.pickContact(local);
    if (!contact) return;
    event.preventDefault();
    start = local; pointer = event.pointerId;
    shot = { power: 0, angle: 40, heading: 0, contact };
    canvas.setPointerCapture(pointer); canvas.focus({ preventScroll: true }); options.preview(shot, local);
  });
  function updateDrag(event: PointerEvent) {
    shot = dragShot(start, localPoint(event), canvas.clientHeight, shot.contact!);
  }
  canvas.addEventListener('pointermove', (event) => {
    if (pointer === null) {
      if (options.canAim()) {
        const contact = options.pickContact(localPoint(event));
        shot.contact = contact ?? undefined;
        options.hover(contact);
      }
      return;
    }
    if (event.pointerId !== pointer) return;
    updateDrag(event); options.preview(shot, localPoint(event));
  });
  canvas.addEventListener('pointerleave', () => {
    if (pointer === null && options.canAim()) { delete shot.contact; options.hover(null); }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointer) return;
    updateDrag(event);
    pointer = null; canvas.releasePointerCapture(event.pointerId);
    if (shot.power < 5) cancel(); else options.release(shot);
  });
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', () => { if (pointer !== null) cancel(); });
  window.addEventListener('blur', () => { if (pointer !== null) cancel(); });
  canvas.addEventListener('keydown', (event) => {
    if (!options.canAim()) return;
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
    if (pointer !== null || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
    event.preventDefault();
    shot.contact ??= options.defaultContact();
    if (event.key === ' ') { options.release({ ...shot, power: Math.max(5, shot.power) }); return; }
    if (event.shiftKey) {
      const p = options.contactScreen(shot.contact!);
      p.x += event.key === 'ArrowLeft' ? -7 : event.key === 'ArrowRight' ? 7 : 0;
      p.y += event.key === 'ArrowUp' ? -7 : event.key === 'ArrowDown' ? 7 : 0;
      shot.contact = options.pickContact(p) ?? shot.contact;
    } else {
      if (event.key === 'ArrowLeft') shot.heading = Math.max(-30, shot.heading - 3);
      if (event.key === 'ArrowRight') shot.heading = Math.min(30, shot.heading + 3);
      if (event.key === 'ArrowUp') shot.power = Math.min(100, shot.power + 5);
      if (event.key === 'ArrowDown') shot.power = Math.max(5, shot.power - 5);
    }
    options.preview(shot);
  });
  return { reset() { cancel(); shot = { power: 65, angle: 40, heading: 0 }; } };
}
