import RAPIER from '@dimforge/rapier3d-compat';
import type { Contact } from './input';
// Shared by the game and the isolated lab worlds; keep the impulse identical.
export function kickBody(body: RAPIER.RigidBody, power: number, angle: number, heading = 0, contact?: Contact) {
  const speed = 5 + power * (angle < 0 ? 0.5 : 0.18);
  const direction = kickDirection(angle, heading, contact);
  if (contact) {
    const impulse = body.mass() * speed;
    body.applyImpulseAtPoint({ x: direction.x * impulse, y: direction.y * impulse, z: direction.z * impulse }, contact.point, true);
  } else {
    body.setLinvel({ x: direction.x * speed, y: direction.y * speed, z: direction.z * speed }, true);
    body.setAngvel({ x: 1 + Math.random() * 2, y: (Math.random() - 0.5) * 3, z: -6 - Math.random() * 5 }, true);
  }
}
export const START = { x: -12, y: 0.8, z: 0 };
export const TARGET = { x: 10, z: 0 };
// The close-up and physics share the same incoming direction. At grazing edges,
// remove the outward component so the foot approaches from outside the surface.
export function kickDirection(angle: number, heading: number, contact?: Contact) {
  const pitch = angle * Math.PI / 180; const yaw = heading * Math.PI / 180;
  const d = { x: Math.cos(pitch) * Math.cos(yaw), y: Math.sin(pitch), z: Math.cos(pitch) * Math.sin(yaw) };
  // Give the downward strike enough forward drive to carry through the bounce.
  // Keep this in the shared direction so the boot animation matches the impulse.
  if (angle < 0) { d.x *= 1.6; d.z *= 1.6; }
  // Downward strokes preserve their pitch even at a low contact point.
  if (contact && angle >= 0) {
    const n = contact.normal; const dot = d.x * n.x + d.y * n.y + d.z * n.z;
    if (dot > -0.15) { d.x -= n.x * (dot + 0.15); d.y -= n.y * (dot + 0.15); d.z -= n.z * (dot + 0.15); }
  }
  const length = Math.hypot(d.x, d.y, d.z);
  return { x: d.x / length, y: d.y / length, z: d.z / length };
}
export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.1, 200).setTranslation(0, -0.1, 0).setFriction(0.8));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(START.x, START.y, START.z).setCcdEnabled(true).setLinearDamping(0.12).setAngularDamping(0.35));
  const points: number[] = [];
  for (let lat = 0; lat <= 12; lat++) {
    const phi = lat * Math.PI / 12;
    for (let lon = 0; lon < 16; lon++) {
      const theta = lon * Math.PI * 2 / 16;
      points.push(0.65 * Math.cos(phi), 0.34 * Math.sin(phi) * Math.cos(theta), 0.34 * Math.sin(phi) * Math.sin(theta));
    }
  }
  const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
  if (!hull) throw new Error('Could not create the ball collider.');
  world.createCollider(hull.setRestitution(0.64).setFriction(0.65), body);
  function reset(rear = false) {
    // Upright half-length is 0.65: the lower tip rests on the ground at Y=0.
    body.setTranslation({ ...START, y: rear ? 0.65 : START.y }, true);
    // The ball's long local X axis stands along world Y in contact mode.
    body.setRotation({ x: 0, y: 0, z: rear ? Math.SQRT1_2 : 0, w: rear ? Math.SQRT1_2 : 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  function kick(power: number, angle: number, heading = 0, contact?: Contact) {
    kickBody(body, power, angle, heading, contact);
  }
  return { world, body, reset, kick };
}
