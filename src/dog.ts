import * as THREE from 'three';
import { RigidBodyType, type RigidBody } from '@dimforge/rapier3d-compat';
import type { Vector3 } from './input';
import { seededRandom } from './random';

const PLAY_TIME = 4;
const DOG_SCALE = 1.1;
const CONTACT_RADIUS = .45 + .6 * DOG_SCALE;
const REACTION_TIME = 1;
// Keep the owner above the centered result card in the field overview.
const HOME = new THREE.Vector3(0, 0, -19);
export type DogPose = {
  time: number; enabled: boolean; active: boolean; sitting?: boolean; carrying?: boolean; position: Vector3;
  lift: number; heading: number; tilt: number; scale: Vector3; headTilt: number;
  ears: number[]; legs: number[]; tail: number; shadowScale: number; shadowOpacity: number;
};
export function createDog(scene: THREE.Scene, canvas?: HTMLCanvasElement) {
  let random = seededRandom(1);
  let replayCarrying: boolean | null = null;
  const root = new THREE.Group(); scene.add(root);
  const pup = new THREE.Group(); root.add(pup);
  const cream = new THREE.MeshStandardMaterial({ color: '#f7d9a0', roughness: 1 });
  const brown = new THREE.MeshStandardMaterial({ color: '#9a6038', roughness: 1 });
  const dark = new THREE.MeshBasicMaterial({ color: '#302c29' });
  function oval(parent: THREE.Object3D, material: THREE.Material, size: number[], position: number[]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    mesh.scale.set(size[0], size[1], size[2]); mesh.position.set(position[0], position[1], position[2]); parent.add(mesh); return mesh;
  }
  oval(pup, cream, [.6, .33, .3], [0, .55, 0]);
  const head = new THREE.Group(); head.position.set(.43, .87, 0); pup.add(head);
  oval(head, cream, [.34, .34, .32], [0, 0, 0]);
  oval(head, cream, [.23, .15, .23], [.26, -.12, 0]);
  oval(head, dark, [.07, .07, .1], [.44, -.08, 0]);
  const ears = [-1, 1].map(side => oval(head, brown, [.15, .3, .09], [-.08, -.06, side * .29]));
  for (const side of [-1, 1]) {
    oval(head, dark, [.055, .065, .04], [.18, .05, side * .255]);
    oval(head, new THREE.MeshBasicMaterial({ color: '#ffffff' }), [.017, .02, .012], [.2, .07, side * .29]);
  }
  oval(head, new THREE.MeshBasicMaterial({ color: '#ed8b8b' }), [.08, .11, .06], [.3, -.25, 0]);
  const legs = [-.36, .36].flatMap(x => [-.22, .22].map(z => oval(pup, cream, [.12, .25, .12], [x, .25, z])));
  const tail = oval(pup, brown, [.3, .11, .11], [-.65, .75, 0]); tail.rotation.z = -.6;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.27, .045, 8, 20), new THREE.MeshBasicMaterial({ color: '#e66c4e' }));
  collar.rotation.y = Math.PI / 2; collar.position.set(.35, .7, 0); pup.add(collar);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.65, 24), new THREE.MeshBasicMaterial({ color: '#334d2d', transparent: true, opacity: .18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .025; root.add(shadow);
  const owner = new THREE.Group(); owner.position.copy(HOME); scene.add(owner);
  const shirt = new THREE.MeshStandardMaterial({ color: '#688b9d' });
  oval(owner, shirt, [.35, .55, .23], [0, 1.1, 0]);
  oval(owner, cream, [.26, .28, .25], [0, 1.92, 0]);
  for (const side of [-1, 1]) {
    oval(owner, dark, [.12, .4, .13], [side * .18, .4, 0]);
    oval(owner, cream, [.1, .4, .1], [side * .43, 1.2, 0]);
  }
  // Workers share the original behavior without creating DOM labels.
  const countdown = canvas ? document.createElement('span') : null;
  const call = canvas ? document.createElement('span') : null;
  if (countdown && call) {
    countdown.className = 'dog-countdown'; call.className = 'dog-call'; call.textContent = 'Come back!';
    countdown.setAttribute('aria-hidden', 'true'); call.setAttribute('aria-hidden', 'true');
    canvas!.parentElement!.append(countdown, call);
  }
  let time = 0; let enabled = false; let active = false; let sitting = false; let fetchAfterBounce = false; let bounced = false; let contactCooldown = 0; let carriedBall: RigidBody | null = null; let heading = 0;
  let jumpHeight = 0; let jumpVelocity = 0; let nextJump = 0;
  const previousCenter = new THREE.Vector3();
  function releaseBall() {
    if (!carriedBall) return;
    carriedBall.setBodyType(RigidBodyType.Dynamic, true);
    carriedBall.setLinvel({ x: 0, y: 0, z: 0 }, true);
    carriedBall.setAngvel({ x: 0, y: 0, z: 0 }, true);
    carriedBall = null;
  }
  function reset() {
    replayCarrying = null;
    releaseBall();
    time = 0; enabled = false; active = false; sitting = false; fetchAfterBounce = random() < .5; bounced = false; contactCooldown = 0; heading = Math.PI / 2;
    jumpHeight = 0; jumpVelocity = 0; nextJump = REACTION_TIME + .2 + random() * .4;
    pup.position.y = 0; pup.rotation.set(0, heading, 0); pup.scale.setScalar(DOG_SCALE);
    legs.forEach(leg => { leg.rotation.set(0, 0, 0); leg.position.y = .25; leg.scale.set(.12, .25, .12); });
    head.rotation.set(0, 0, 0); tail.rotation.set(0, 0, -.6);
    root.position.copy(HOME).add(new THREE.Vector3(0, 0, 1.4)); root.visible = false; owner.visible = false;
    if (countdown) countdown.hidden = true;
    if (call) call.hidden = true;
  }
  function start(seed = 1) { random = seededRandom(seed); reset(); enabled = true; active = true; root.visible = true; owner.visible = true; }
  function update(dt: number, ball: RigidBody, flying: boolean) {
    if (sitting) {
      time += dt;
      tail.rotation.y = Math.sin(time * 18) * .85;
      head.rotation.z = .12 + Math.sin(time * 3) * .025;
      return;
    }
    if (!active) return;
    time += dt;
    const playElapsed = Math.max(0, time - REACTION_TIME);
    if (time < REACTION_TIME) {
      // Look at the owner first, then notice the ball and turn before running.
      const turn = THREE.MathUtils.smoothstep(time, .6, REACTION_TIME);
      const p = ball.translation();
      const direction = Math.atan2(-(p.z - root.position.z), p.x - root.position.x);
      const from = Math.PI / 2;
      heading = from + Math.atan2(Math.sin(direction - from), Math.cos(direction - from)) * turn;
      pup.rotation.y = heading;
      head.rotation.z = .15 + turn * .2;
      ears.forEach((ear, i) => { ear.rotation.x = (i ? 1 : -1) * turn * .8; });
      legs.forEach(leg => { leg.rotation.z = 0; });
      tail.rotation.y = Math.sin(time * 14) * .45;
      return;
    }
    contactCooldown = Math.max(0, contactCooldown - dt);
    previousCenter.copy(root.position).add(new THREE.Vector3(0, .55 * DOG_SCALE + pup.position.y, 0));
    const chasing = playElapsed < PLAY_TIME && !carriedBall;
    const reacting = !carriedBall && playElapsed >= PLAY_TIME && playElapsed < PLAY_TIME + .45;
    const p = ball.translation();
    const target = chasing ? new THREE.Vector3(THREE.MathUtils.clamp(p.x, -22, 22), 0, THREE.MathUtils.clamp(p.z, -11, 11)) : HOME.clone().add(new THREE.Vector3(0, 0, 1.4));
    const dx = target.x - root.position.x; const dz = target.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    const moving = !reacting && distance > (chasing ? .55 : .2);
    const desired = Math.atan2(-dz, dx);
    heading += Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading)) * Math.min(1, dt * (reacting ? 14 : 10));
    pup.rotation.y = heading;
    if (moving) {
      const step = Math.min(distance, (chasing ? 9.5 + Math.sin(time * 9) * .8 : 10.5) * dt);
      root.position.x += Math.cos(heading) * step; root.position.z -= Math.sin(heading) * step;
    }
    const gait = time * (chasing ? 25 : 27);
    const lookingUp = chasing && p.y > 1.3;
    // Schedule jumps rather than sampling randomness every animation frame.
    if (lookingUp && jumpHeight === 0 && time >= nextJump) {
      jumpVelocity = (2.2 + random() * 1.6) * 1.12;
      nextJump = time + .65 + random() * .8;
    }
    if (jumpVelocity !== 0 || jumpHeight > 0) {
      jumpVelocity -= 15 * dt;
      jumpHeight = Math.max(0, jumpHeight + jumpVelocity * dt);
      if (jumpHeight === 0) jumpVelocity = 0;
    }
    pup.position.y = jumpHeight + (moving ? Math.abs(Math.sin(gait)) * .19 : 0);
    pup.rotation.z = moving ? Math.sin(gait) * .07 : 0;
    pup.scale.set(1 + Math.sin(gait) * (moving ? .035 : 0), 1 - Math.sin(gait) * (moving ? .045 : 0), 1).multiplyScalar(DOG_SCALE);
    head.rotation.z = lookingUp ? .35 : reacting ? .2 : Math.sin(gait - .3) * .06;
    legs.forEach((leg, i) => { leg.rotation.z = jumpHeight > .08 ? (i < 2 ? -.65 : .65) : moving ? Math.sin(gait + (i === 0 || i === 3 ? 0 : Math.PI)) * .9 : 0; });
    ears.forEach((ear, i) => { ear.rotation.x = (i ? 1 : -1) * (reacting ? .8 : Math.sin(gait - .7) * .38); });
    tail.rotation.y = Math.sin(time * 30) * .85;
    shadow.scale.setScalar(DOG_SCALE * (1 + jumpHeight * .3));
    shadow.material.opacity = .18 / (1 + jumpHeight);

    const center = root.position.clone().add(new THREE.Vector3(0, .55 * DOG_SCALE + pup.position.y, 0));
    const dogVelocity = center.clone().sub(previousCenter).divideScalar(dt);
    const velocity = new THREE.Vector3().copy(ball.linvel());
    const relativeVelocity = velocity.clone().sub(dogVelocity);
    const offset = new THREE.Vector3().copy(p).sub(center);
    // Sweep one physics step so fast balls cannot skip the contact region.
    const speedSquared = relativeVelocity.lengthSq();
    const closestTime = speedSquared > .0001 ? THREE.MathUtils.clamp(-offset.dot(relativeVelocity) / speedSquared, 0, dt) : 0;
    const closest = offset.clone().addScaledVector(relativeVelocity, closestTime);
    const touching = closest.lengthSq() < CONTACT_RADIUS ** 2;
    if (chasing && flying && touching && contactCooldown === 0) {
      // Evaluate the normal at first impact, not closest approach (where
      // the relative velocity would be tangent and lose its rebound).
      const projection = offset.dot(relativeVelocity);
      const discriminant = projection ** 2 - speedSquared * (offset.lengthSq() - CONTACT_RADIUS ** 2);
      const impactTime = offset.lengthSq() > CONTACT_RADIUS ** 2 && speedSquared > .0001
        ? THREE.MathUtils.clamp((-projection - Math.sqrt(Math.max(0, discriminant))) / speedSquared, 0, dt) : 0;
      const contactOffset = offset.clone().addScaledVector(relativeVelocity, impactTime);
      const normal = contactOffset.lengthSq() > .0001 ? contactOffset.normalize() : new THREE.Vector3(Math.cos(heading), .2, -Math.sin(heading)).normalize();
      const approachSpeed = relativeVelocity.dot(normal);
      // A slow ball can be fetched on a later encounter, never on its first hit.
      if (bounced && fetchAfterBounce && velocity.length() < 3 && offset.length() < .45 + .5 * DOG_SCALE) {
        carriedBall = ball;
        ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
        ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
        ball.setBodyType(RigidBodyType.KinematicPositionBased, true);
      } else if (approachSpeed < -.1) {
        // Reflect relative motion along the contact normal: grazing hits skim,
        // head-on hits rebound. The puppy's running/jumping speed contributes.
        const impulse = normal.multiplyScalar(-(1 + .8) * approachSpeed * ball.mass());
        ball.applyImpulse(impulse, true);
        bounced = true;
      }
      contactCooldown = .18;
    }
    if (carriedBall) {
      // Use the animated muzzle transform so the ball follows turns and hops.
      root.updateMatrixWorld(true);
      const mouth = head.localToWorld(new THREE.Vector3(.55, -.18, 0));
      carriedBall.setNextKinematicTranslation(mouth);
      carriedBall.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading + Math.PI / 2));
    }
    if (!chasing && !reacting && distance < .3) {
      // Drop at the owner's feet and resume ordinary ball physics before scoring.
      if (carriedBall) carriedBall.setTranslation({ x: HOME.x, y: .5, z: HOME.z + .7 }, true);
      releaseBall();
      active = false; sitting = true;
      root.position.copy(HOME).add(new THREE.Vector3(0, 0, 1.4));
      pup.position.y = 0; pup.rotation.set(0, Math.PI / 2, .25); pup.scale.setScalar(DOG_SCALE);
      legs.forEach((leg, index) => {
        leg.rotation.z = index < 2 ? -1.1 : -.25;
        leg.position.y = index < 2 ? .15 : .25;
        if (index < 2) leg.scale.set(.17, .2, .14);
      });
      shadow.scale.setScalar(DOG_SCALE); shadow.material.opacity = .18;
    }
  }
  function draw(screenPoint: (p: Vector3) => { x: number; y: number }, visible: boolean) {
    root.visible = enabled && (active || sitting) && visible; owner.visible = enabled && visible;
    if (!canvas || !countdown || !call) return;
    const carrying = replayCarrying ?? carriedBall !== null;
    const playElapsed = Math.max(0, time - REACTION_TIME);
    countdown.hidden = !visible || !active || time < .6 || playElapsed >= PLAY_TIME || carrying;
    call.hidden = !visible || (!active && !sitting) || (!sitting && playElapsed < PLAY_TIME && !carrying);
    call.textContent = (sitting || carrying) ? 'Good puppy!' : 'Come back!';
    countdown.textContent = time < REACTION_TIME ? '🏉'
      : playElapsed < 1 ? '🏉!!'
      : Math.max(0, PLAY_TIME - playElapsed).toFixed(1);
    countdown.lang = 'en';
    for (const [label, point] of [[countdown, root.position.clone().add(new THREE.Vector3(0, 1.8 * DOG_SCALE + pup.position.y, 0))], [call, HOME.clone().add(new THREE.Vector3(0, 2.6, 0))]] as const) {
      const p = screenPoint(point);
      label.style.left = `${THREE.MathUtils.clamp(p.x, 55, Math.max(55, canvas.clientWidth - 55))}px`;
      label.style.top = `${THREE.MathUtils.clamp(p.y, 24, Math.max(24, canvas.clientHeight - 24))}px`;
    }
  }
  function capture(): DogPose {
    return { time, enabled, active, sitting, carrying: carriedBall !== null, position: { x: root.position.x, y: root.position.y, z: root.position.z },
      lift: pup.position.y, heading: pup.rotation.y, tilt: pup.rotation.z,
      scale: { x: pup.scale.x, y: pup.scale.y, z: pup.scale.z }, headTilt: head.rotation.z,
      ears: ears.map(ear => ear.rotation.x), legs: legs.map(leg => leg.rotation.z), tail: tail.rotation.y,
      shadowScale: shadow.scale.x, shadowOpacity: shadow.material.opacity };
  }
  // Restore recorded visuals only. Replay never applies another impulse to the ball.
  function restore(pose?: DogPose) {
    if (!pose) {
      replayCarrying = false; enabled = active = sitting = false; root.visible = owner.visible = false;
      if (countdown) countdown.hidden = true;
      if (call) call.hidden = true;
      return;
    }
    replayCarrying = pose.carrying ?? false; time = pose.time; enabled = pose.enabled; active = pose.active; sitting = pose.sitting ?? false;
    root.position.copy(pose.position); pup.position.y = pose.lift;
    pup.rotation.set(0, pose.heading, pose.tilt); pup.scale.copy(pose.scale); head.rotation.z = pose.headTilt;
    ears.forEach((ear, i) => { ear.rotation.x = pose.ears[i]; });
    legs.forEach((leg, i) => {
      leg.rotation.set(0, 0, pose.legs[i]);
      leg.position.y = sitting && i < 2 ? .15 : .25;
      if (sitting && i < 2) leg.scale.set(.17, .2, .14);
      else leg.scale.set(.12, .25, .12);
    });
    tail.rotation.y = pose.tail; shadow.scale.setScalar(pose.shadowScale); shadow.material.opacity = pose.shadowOpacity;
  }
  reset();
  return { start, reset, update, draw, capture, restore, get playFinished() { return time >= REACTION_TIME + PLAY_TIME; }, get carrying() { return replayCarrying ?? carriedBall !== null; } };
}
