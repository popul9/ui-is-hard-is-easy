import './style.css';
import './volume-popover.css';
import { createVolumePopover } from './volume-popover';
import { createPhysics, START, TARGET, kickDirection } from './physics';
import { createScene } from './scene';
import { bindInput } from './input';
import type { Contact, Shot } from './input';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('field');
const status = element('status');
const aim = element('aim');
const soloButton = element<HTMLButtonElement>('replay-solo');
const puppyButton = element<HTMLButtonElement>('replay-puppy');
let volume = 0;
let audio: AudioContext | undefined;
element('sound').addEventListener('click', async () => {
  try {
    audio ??= new AudioContext(); await audio.resume();
    const gain = audio.createGain(); gain.connect(audio.destination);
    const now = audio.currentTime;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume / 100 * 0.15, now + 0.03); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    const oscillator = audio.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(440, now); oscillator.frequency.setValueAtTime(660, now + 0.2); oscillator.connect(gain); oscillator.start(now); oscillator.stop(now + 0.75);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { status.classList.remove('sr-only'); status.textContent = 'Could not play audio. Press Test sound to try again.'; }
});
async function start() {
  soloButton.disabled = puppyButton.disabled = true; status.textContent = 'Preparing the field…';
  const physics = await createPhysics();
  const scene = createScene(canvas);
  const volumePopover = createVolumePopover(canvas);
  const result = element('result');
  const guide = element('pull-guide');
  let dogEnabled = false;
  let state: 'ready' | 'striking' | 'flying' | 'finished' = 'ready';
  let pendingShot: Shot | null = null;
  let strikeElapsed = 0;
  let launchNextFrame = false;
  let closeupFlight = false;
  const contactLabel = element('contact-label');
  let elapsed = 0; let settled = 0; let accumulator = 0; let previous = performance.now();
  const hideDrag = () => { aim.hidden = true; guide.setAttribute('hidden', ''); canvas.classList.remove('contact-grabbed'); };
  const cancel = () => {
    hideDrag(); scene.clearAim(); canvas.classList.remove('contact-hover'); contactLabel.hidden = true;
  };
  function labelContact(contact: Contact, locked: boolean) {
    const p = scene.screenPoint(contact.point);
    contactLabel.hidden = false;
    contactLabel.textContent = locked ? '↗ LOFT' : 'Kick here';
    delete contactLabel.dataset.kick;
    contactLabel.style.left = `${Math.max(8, Math.min(canvas.clientWidth - 120, p.x + 18))}px`;
    contactLabel.style.top = `${Math.max(38, p.y - 38)}px`;
  }
  const reset = (withPuppy = false) => {
    dogEnabled = withPuppy;
    input.reset(); physics.reset(true); scene.dog.reset(); scene.clearTrail(); state = 'ready'; elapsed = 0; settled = 0; accumulator = 0;
    pendingShot = null; strikeElapsed = 0; launchNextFrame = false; closeupFlight = false;
    scene.draw(physics.body.translation(), physics.body.rotation(), false);
    scene.setRearView(true);
    result.hidden = true;
    updateVolume();
    canvas.classList.add('contact-mode');
    soloButton.disabled = puppyButton.disabled = false;
    status.lang = 'en';
    status.textContent = 'Ready for a kick.';
  };
  soloButton.addEventListener('click', () => { reset(false); canvas.focus({ preventScroll: true }); });
  puppyButton.addEventListener('click', () => { reset(true); canvas.focus({ preventScroll: true }); });
  const input = bindInput(canvas, {
    canAim: () => state === 'ready', cancel,
    pickContact: scene.pickContact, defaultContact: scene.defaultContact,
    contactScreen: (contact) => scene.screenPoint(contact.point),
    hover(contact) {
      hideDrag(); scene.clearAim(); scene.hoverContact(contact);
      canvas.classList.toggle('contact-hover', contact !== null);
      if (contact) labelContact(contact, false); else contactLabel.hidden = true;
    },
    preview(shot, cursor) {
      aim.hidden = false; const p = scene.screenPoint(shot.contact?.point ?? scene.player.position);
      const anchor = cursor ? { x: cursor.x + 90, y: cursor.y - 55 } : { x: p.x, y: p.y - 75 };
      aim.style.left = `${Math.max(82, Math.min(canvas.clientWidth - 82, anchor.x))}px`;
      aim.style.top = `${Math.max(8, Math.min(canvas.clientHeight - 65, anchor.y))}px`;
      element('power').textContent = String(Math.round(shot.power));
      element('angle').textContent = `${shot.heading < -0.5 ? '←' : shot.heading > 0.5 ? '→' : ''}${Math.abs(Math.round(shot.heading))}`;
      element('power-bar').style.width = `${shot.power}%`;
      scene.previewStrike(shot);
      if (shot.contact) {
        labelContact(shot.contact, true);
        const direction = kickDirection(shot.angle, shot.heading, shot.contact);
        const kick = shot.angle < 0 ? 'spike' : direction.y > 0.15 ? 'loft' : 'drive';
        contactLabel.textContent = kick === 'spike' ? '↘ SPIKE' : kick === 'loft' ? '↗ LOFT' : '→ DRIVE';
        contactLabel.dataset.kick = kick;
        canvas.classList.add('contact-grabbed');
        guide.removeAttribute('hidden');
        const tip = scene.screenPoint({
          x: shot.contact.point.x + direction.x * 0.65,
          y: shot.contact.point.y + direction.y * 0.65,
          z: shot.contact.point.z + direction.z * 0.65,
        });
        const kickLine = element('kick-line');
        kickLine.setAttribute('x1', String(p.x)); kickLine.setAttribute('y1', String(p.y));
        kickLine.setAttribute('x2', String(tip.x)); kickLine.setAttribute('y2', String(tip.y));
        guide.dataset.kick = kick;
        const end = cursor ?? { x: p.x - Math.sin(shot.heading * Math.PI / 180) * shot.power, y: p.y + (shot.angle < 0 ? -1 : 1) * shot.power };
        const line = element('pull-line');
        line.setAttribute('x1', String(p.x)); line.setAttribute('y1', String(p.y));
        line.setAttribute('x2', String(end.x)); line.setAttribute('y2', String(end.y));
        line.setAttribute('stroke-width', String(2 + shot.power / 25));
        line.setAttribute('stroke', shot.power > 80 ? '#e5633d' : '#f8f5df');
        element('pull-cursor').setAttribute('cx', String(end.x)); element('pull-cursor').setAttribute('cy', String(end.y));
      }
    },
    release(shot) {
      hideDrag(); contactLabel.hidden = true; soloButton.disabled = puppyButton.disabled = true;
      canvas.classList.remove('contact-hover');
      if (shot.contact) {
        pendingShot = shot; strikeElapsed = 0; state = 'striking';
        scene.beginStrike(shot); status.textContent = 'Striking your chosen spot…';
      } else launch(shot);
    },
  });
  function launch(shot: Shot) {
    physics.kick(shot.power, shot.angle, shot.heading, shot.contact); state = 'flying';
    closeupFlight = true;
    if (dogEnabled) scene.dog.start();
    status.textContent = dogEnabled ? 'The puppy notices the ball, then chases for 4 seconds. Keep it up!' : 'In flight… Wait for the final bounce.';
  }
  function updateVolume() {
    const p = physics.body.translation();
    const distance = Math.hypot(p.x - TARGET.x, p.z - TARGET.z);
    const startingDistance = Math.hypot(START.x - TARGET.x, START.z - TARGET.z);
    // Ground-plane proximity: the target is 100%, the starting distance is 0%.
    const preciseVolume = Math.max(0, Math.min(100, (1 - distance / startingDistance) * 100));
    volume = Math.round(preciseVolume);
    element('volume').textContent = String(volume);
    return preciseVolume;
  }
  function finish() {
    state = 'finished';
    updateVolume();
    element('result-volume').textContent = String(volume);
    result.hidden = false;
    status.textContent = `Congratulations! Your volume is ${volume}%!`;
    status.lang = 'en';
    soloButton.disabled = puppyButton.disabled = false;
    if (document.activeElement === canvas) (dogEnabled ? puppyButton : soloButton).focus({ preventScroll: true });
  }
  function frame(now: number) {
    const delta = Math.min((now - previous) / 1000, 0.1); previous = now;
    if (launchNextFrame && pendingShot) { launchNextFrame = false; launch(pendingShot); pendingShot = null; }
    if (state === 'striking') {
      strikeElapsed += delta;
      const progress = Math.min(1, strikeElapsed / 0.22);
      scene.animateStrike(progress);
      if (progress === 1) launchNextFrame = true;
    }
    accumulator += delta;
    while (accumulator >= 1 / 60) {
      if (dogEnabled && (state === 'flying' || state === 'finished')) scene.dog.update(1 / 60, physics.body, state === 'flying');
      if (state === 'flying') {
        physics.world.step(); elapsed += 1 / 60;
        if (closeupFlight && elapsed >= 0.1) { scene.setRearView(false); closeupFlight = false; canvas.classList.remove('contact-mode'); }
        const v = physics.body.linvel(); const w = physics.body.angvel();
        const slow = Math.hypot(v.x, v.y, v.z) < 0.15 && Math.hypot(w.x, w.y, w.z) < 0.25;
        settled = slow ? settled + 1 / 60 : 0;
        const p = physics.body.translation();
        if (!scene.dog.carrying) {
          if ((dogEnabled ? scene.dog.playFinished : elapsed > 1) && (settled > 0.7 || physics.body.isSleeping())) finish();
          else if (elapsed > 18 || Math.abs(p.x) > 24 || Math.abs(p.z) > 13) finish();
        }
      }
      accumulator -= 1 / 60;
    }
    const liveVolume = state === 'flying' ? updateVolume() : volume;
    scene.draw(physics.body.translation(), physics.body.rotation(), state === 'flying');
    volumePopover.update({ active: state === 'flying' && !scene.dog.carrying && !closeupFlight && elapsed > .6, point: scene.screenPoint(physics.body.translation()), velocity: physics.body.linvel(), height: physics.body.translation().y, volume: liveVolume });
    requestAnimationFrame(frame);
  }
  reset(); requestAnimationFrame(frame);
}
void start().catch((error: unknown) => {
  console.error(error); status.classList.remove('sr-only'); status.textContent = 'Could not start the game. Reload in a browser that supports WebGL.';
});
