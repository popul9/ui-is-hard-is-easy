import * as THREE from 'three';
import { createDog } from './dog';
import { START, TARGET, kickDirection } from './physics';
import type { Contact, PointerPosition, Shot, Vector3 } from './input';
export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor('#d9e6b8');
  const scene = new THREE.Scene();
  const dog = createDog(scene, canvas);
  const camera = new THREE.OrthographicCamera(-24, 24, 16, -16, 0.1, 200);
  camera.position.set(10, 26, 32); camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-10, 30, 10); scene.add(light);
  const flat = (color: string) => new THREE.MeshBasicMaterial({ color });
  for (let i = -4; i <= 4; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(6, 30), flat(i % 2 ? '#cedfa8' : '#d9e6b8'));
    stripe.rotation.x = -Math.PI / 2; stripe.position.set(i * 6, -0.005, 0); scene.add(stripe);
  }
  function groundLine(points: THREE.Vector3[], color = '#f7f8dc') {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color })); scene.add(line);
  }
  groundLine([new THREE.Vector3(-23, 0.02, -12), new THREE.Vector3(23, 0.02, -12), new THREE.Vector3(23, 0.02, 12), new THREE.Vector3(-23, 0.02, 12), new THREE.Vector3(-23, 0.02, -12)]);
  for (const x of [-18, -6, 6, 18]) groundLine([new THREE.Vector3(x, 0.02, -12), new THREE.Vector3(x, 0.02, 12)]);
  for (const radius of [1, 3, 5]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.045, radius, 80), flat('#f8fae9'));
    ring.rotation.x = -Math.PI / 2; ring.position.set(TARGET.x, 0.03, 0); scene.add(ring);
  }
  const marker = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), flat('#ed653a')); marker.rotation.x = -Math.PI / 2; marker.position.set(TARGET.x, 0.04, 0); scene.add(marker);
  const ball = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: '#be532e', roughness: 0.9 })); shell.scale.set(0.65, 0.34, 0.34); ball.add(shell);
  for (const x of [-0.33, 0.33]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.293, 0.024, 8, 32), flat('#fff2d7')); band.rotation.y = Math.PI / 2; band.position.x = x; ball.add(band);
  }
  scene.add(ball); ball.position.copy(START);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), new THREE.MeshBasicMaterial({ color: '#334d2d', transparent: true, opacity: 0.22, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  // A flat, camera-facing player, drawn without an external image asset.
  const art = document.createElement('canvas'); art.width = 180; art.height = 240;
  const ctx = art.getContext('2d')!;
  function paintClassic() {
    ctx.clearRect(0, 0, 180, 240);
    ctx.lineCap = 'round'; ctx.lineWidth = 17; ctx.strokeStyle = '#253c3a';
    ctx.beginPath(); ctx.moveTo(82, 157); ctx.lineTo(65, 208); ctx.lineTo(43, 208); ctx.moveTo(103, 157); ctx.lineTo(119, 201); ctx.lineTo(145, 201); ctx.stroke();
    ctx.strokeStyle = '#e8ad7c'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(64, 93); ctx.lineTo(42, 139); ctx.moveTo(113, 95); ctx.lineTo(142, 118); ctx.stroke();
    ctx.fillStyle = '#ef673e'; ctx.fillRect(62, 79, 55, 73); ctx.fillStyle = '#fff4dc'; ctx.font = 'bold 35px sans-serif'; ctx.fillText('7', 78, 123);
    ctx.fillStyle = '#253c3a'; ctx.fillRect(62, 145, 55, 22); ctx.fillStyle = '#e8ad7c'; ctx.beginPath(); ctx.arc(90, 53, 25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#253c3a'; ctx.beginPath(); ctx.arc(89, 46, 25, Math.PI, Math.PI * 2); ctx.fill();
  }
  paintClassic();
  const player = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(art), depthTest: false })); player.scale.set(3, 4, 1); player.position.set(START.x - 1.4, 1.8, 0); scene.add(player);
  let rearView = false;
  const raycaster = new THREE.Raycaster();
  const contactMark = new THREE.Group();
  const markMaterial = new THREE.MeshBasicMaterial({ color: '#fff8da', depthTest: false, depthWrite: false, transparent: true });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.075, 40), new THREE.MeshBasicMaterial({ color: '#253c3a', opacity: 0.45, transparent: true, depthTest: false, depthWrite: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.064, 48), markMaterial); ring.position.z = 0.001;
  const sole = new THREE.Mesh(new THREE.CircleGeometry(1, 24), markMaterial); sole.scale.set(0.017, 0.029, 1); sole.position.set(0, 0.013, 0.002);
  const heel = new THREE.Mesh(new THREE.CircleGeometry(0.013, 20), markMaterial); heel.position.set(0, -0.025, 0.002);
  contactMark.add(halo, ring, sole, heel); contactMark.renderOrder = 10; contactMark.visible = false; scene.add(contactMark);
  let contactLocked = false;
  let currentContact: Contact | null = null;
  // The boot's local origin is its toe: at animation completion it is exactly
  // the same world-space point passed to applyImpulseAtPoint.
  const boot = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#263b32', roughness: 0.85 });
  const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), leather);
  toe.scale.set(0.13, 0.085, 0.11); toe.position.x = -0.13;
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.2), leather); shoe.position.set(-0.28, 0, 0);
  boot.add(toe, shoe);
  for (let i = 0; i < 3; i++) {
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.14), flat('#ef673e')); lace.position.set(-0.18 - i * 0.04, 0.08, 0); boot.add(lace);
  }
  boot.visible = false; scene.add(boot);
  // First-person crop: only the foot and lower leg enter from below the frame.
  // There is no full-body sprite or visible knee to force into an impossible pose.
  const leg = new THREE.Group(); scene.add(leg); leg.visible = false;
  const trouserMaterial = new THREE.MeshBasicMaterial({ color: '#344940' });
  const sockMaterial = new THREE.MeshBasicMaterial({ color: '#fff2d7' });
  const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1, 16), trouserMaterial);
  const stocking = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 1, 16), sockMaterial);
  leg.add(calf, stocking);
  const ankleLocal = new THREE.Vector3(-0.31, 0.09, 0);
  const boneAxis = new THREE.Vector3(0, 1, 0);
  let strikeFrom = new THREE.Vector3();
  const strikeControl = new THREE.Vector3();
  const strikeRotationFrom = new THREE.Quaternion();
  const strikeRotationTo = new THREE.Quaternion();
  function placeBone(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
    const delta = to.clone().sub(from);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.y = delta.length();
    mesh.quaternion.setFromUnitVectors(boneAxis, delta.normalize());
  }
  function updateLeg() {
    const ankle = ankleLocal.clone().applyQuaternion(boot.quaternion).add(boot.position);
    const projected = ankle.clone().project(camera);
    // Continue the calf towards the viewer and out of the crop, never to a
    // sideways hip. Preserve the boot's ankle as the only visible joint.
    const offscreen = new THREE.Vector3(projected.x + 0.12, -1.35, projected.z).unproject(camera);
    const sockTop = ankle.clone().addScaledVector(offscreen.clone().sub(ankle).normalize(), 0.42);
    placeBone(stocking, sockTop, ankle); placeBone(calf, offscreen, sockTop);
    leg.visible = rearView;
  }
  let strikeTo = new THREE.Vector3();
  function pickContact(cursor: PointerPosition): Contact | null {
    camera.updateMatrixWorld(); ball.updateMatrixWorld(true);
    raycaster.setFromCamera(new THREE.Vector2(cursor.x / canvas.clientWidth * 2 - 1, 1 - cursor.y / canvas.clientHeight * 2), camera);
    const hit = raycaster.intersectObject(shell, false)[0];
    if (!hit?.face) return null;
    const normal = (hit.normal ?? hit.face.normal).clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(shell.matrixWorld));
    return { point: { x: hit.point.x, y: hit.point.y, z: hit.point.z }, normal: { x: normal.x, y: normal.y, z: normal.z } };
  }
  function defaultContact(): Contact {
    const p = screenPoint(ball.position);
    return pickContact({ x: p.x, y: p.y + 10 }) ?? { point: { x: ball.position.x - 0.34, y: ball.position.y, z: ball.position.z }, normal: { x: -1, y: 0, z: 0 } };
  }
  function showContact(contact: Contact, locked: boolean, hovered = false) {
    currentContact = contact; contactLocked = locked;
    contactMark.position.copy(contact.point).addScaledVector(new THREE.Vector3().copy(contact.normal), 0.008);
    contactMark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().copy(contact.normal));
    contactMark.visible = rearView; contactMark.scale.setScalar(1);
    markMaterial.color.set(locked ? '#ffb477' : '#fff8da');
    shell.material.emissive.set('#ef864b'); shell.material.emissiveIntensity = hovered || locked ? 0.17 : 0;
  }
  function hoverContact(contact: Contact | null) {
    if (!rearView) return;
    showContact(contact ?? defaultContact(), false, contact !== null);
  }
  function positionBoot(shot: Shot, distance: number) {
    const contact = shot.contact ?? defaultContact();
    const direction = new THREE.Vector3().copy(kickDirection(shot.angle, shot.heading, contact));
    const backswing = shot.power / 100;
    // Pull the foot away from the contact; straighten the ankle at impact.
    boot.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
    boot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (shot.angle < 0 ? 1 : -1) * backswing * 0.45));
    boot.position.copy(contact.point).addScaledVector(direction, -distance);
    boot.position.y = Math.max(0.15, boot.position.y + backswing * 0.12);
    boot.visible = rearView; updateLeg();
  }
  function previewStrike(shot: Shot) {
    if (!rearView) { player.material.rotation = shot.power / 100 * 0.3; return; }
    showContact(shot.contact ?? defaultContact(), true);
    positionBoot(shot, 0.25 + shot.power / 100 * 0.55);
  }
  function beginStrike(shot: Shot) {
    previewStrike(shot);
    strikeFrom = boot.position.clone();
    strikeTo = new THREE.Vector3().copy(shot.contact!.point);
    strikeControl.copy(strikeFrom).lerp(strikeTo, 0.5).add(new THREE.Vector3(0.08, shot.angle < 0 ? 0.25 : 0.1, 0));
    strikeRotationFrom.copy(boot.quaternion);
    strikeRotationTo.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3().copy(kickDirection(shot.angle, shot.heading, shot.contact)));
  }
  function animateStrike(progress: number) {
    const t = progress * progress;
    boot.position.copy(strikeFrom).multiplyScalar((1 - t) ** 2)
      .addScaledVector(strikeControl, 2 * (1 - t) * t).addScaledVector(strikeTo, t * t);
    boot.quaternion.slerpQuaternions(strikeRotationFrom, strikeRotationTo, t);
    updateLeg();
    // Keep the contact frame visible before launching the physics body.
    if (progress === 1) { markMaterial.color.set('#ffffff'); contactMark.scale.setScalar(1.4); }
  }
  function clearAim() {
    boot.visible = false; leg.visible = false; contactMark.visible = false; contactLocked = false; currentContact = null;
    shell.material.emissiveIntensity = 0; player.material.rotation = 0;
    if (rearView) hoverContact(null);
  }
  function setRearView(rear: boolean) {
    rearView = rear; player.visible = !rear;
    if (rear) {
      // First-person contact view: let the upright ball be the sole focus.
      camera.position.set(START.x - 6, 3.35, 0); camera.lookAt(START.x, 0.4, 0);
    } else {
      camera.position.set(10, 26, 32); camera.lookAt(0, 0, 0);
      player.scale.set(3, 4, 1); player.position.set(START.x - 1.4, 1.8, 0);
    }
    camera.updateMatrixWorld(); resize(); clearAim();
  }
  const trailGeometry = new THREE.BufferGeometry(); const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: '#f7faf0', transparent: true, opacity: 0.7 })); scene.add(trail);
  const trailPoints: THREE.Vector3[] = [];
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    const aspect = width / height;
    // Keep the overview fixed, with a modest 25% zoom on narrow screens.
    const halfWidth = rearView ? Math.max(0.9, 1.35 * aspect) : width <= 700 ? 20 : 25;
    const halfHeight = halfWidth / aspect;
    camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();
  function screenPoint(position: Vector3) {
    camera.updateMatrixWorld();
    const p = new THREE.Vector3().copy(position).project(camera); return { x: (p.x + 1) * canvas.clientWidth / 2, y: (1 - p.y) * canvas.clientHeight / 2 };
  }
  function draw(position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number; w: number }, flying: boolean) {
    ball.position.copy(position); ball.quaternion.copy(rotation);
    // Estimate the ellipsoid's bottom from its current orientation, so the
    // shadow responds to ground clearance rather than center height.
    const longAxisY = 2 * (rotation.x * rotation.y + rotation.w * rotation.z);
    const supportHeight = Math.sqrt(0.34 ** 2 + (0.65 ** 2 - 0.34 ** 2) * longAxisY ** 2);
    const clearance = Math.max(0, position.y - supportHeight);
    shadow.position.set(position.x, 0.006, position.z);
    shadow.scale.setScalar((0.2 + Math.min(clearance, 5) * 0.09) / 0.6);
    shadow.material.opacity = 0.32 / (1 + clearance * 0.6);
    if (flying) { trailPoints.push(ball.position.clone()); if (trailPoints.length > 100) trailPoints.shift(); trailGeometry.setFromPoints(trailPoints); }
    if (rearView && currentContact && !contactLocked) contactMark.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.08);
    dog.draw(screenPoint, !rearView);
    renderer.render(scene, camera);
  }
  return { dog, draw, screenPoint, player, pickContact, defaultContact, hoverContact, beginStrike, animateStrike, setRearView, previewStrike, clearAim, clearTrail() { trailPoints.length = 0; trailGeometry.setFromPoints([]); } };
}
