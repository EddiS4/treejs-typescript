import "./style.css";
import * as THREE from "three";
//import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import Stats from "three/addons/libs/stats.module.js";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";
import { GUI } from "lil-gui";
import RAPIER from "@dimforge/rapier3d-compat";
import RapierDebugRenderer from "./RapierDebugRenderer.ts";
import Car from "./Car.ts";
import Box from "./Box.ts";

await RAPIER.init(); // This line is only needed if using the compat version
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
const world = new RAPIER.World(gravity);
const dynamicBodies: [THREE.Object3D, RAPIER.RigidBody][] = [];

const scene = new THREE.Scene();
const rapierDebugRenderer = new RapierDebugRenderer(scene, world);

const gridHelper = new THREE.GridHelper(200, 100, 0x222222, 0x222222);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

await new RGBELoader().loadAsync("images/venice_sunset_1k.hdr").then((texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.environmentIntensity = 0.1;
  scene.background = scene.environment;
  scene.backgroundIntensity = 0.25;
  scene.backgroundBlurriness = 0.3;
});

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 4);

const light = new THREE.DirectionalLight(0xebfeff, Math.PI);
light.castShadow = true;
light.shadow.camera.far = 250;
light.shadow.camera.left = -50;
light.shadow.camera.right = 50;
light.shadow.camera.top = 50;
light.shadow.camera.bottom = -50;
light.shadow.blurSamples = 10;
light.shadow.radius = 5;
light.target = camera;
scene.add(light);

const lightOffset = new THREE.Vector3(100, 30, 70);

const lightHelper = new THREE.CameraHelper(light.shadow.camera);
lightHelper.visible = false;
scene.add(lightHelper);

const textureLoader = new THREE.TextureLoader();
const textureFlare0 = textureLoader.load("images/lensflare0.png");
const textureFlare3 = textureLoader.load("images/lensflare3.png");

const lensflare = new Lensflare();
lensflare.addElement(new LensflareElement(textureFlare0, 1000, 0));
lensflare.addElement(new LensflareElement(textureFlare3, 500, 0.2));
lensflare.addElement(new LensflareElement(textureFlare3, 250, 0.8));
lensflare.addElement(new LensflareElement(textureFlare3, 125, 0.6));
lensflare.addElement(new LensflareElement(textureFlare3, 62.5, 0.4));
light.add(lensflare);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* 
A follow cam implementation. 
A followTarget is added to the car mesh. 
A reference to the pivot is given to the car. 
The cars update method lerps the pivot towards to followTarget.
*/

const pivot = new THREE.Object3D();
const yaw = new THREE.Object3D();
const pitch = new THREE.Object3D();

scene.add(pivot);
pivot.add(yaw);
yaw.add(pitch);
pitch.add(camera); // adding the perspective camera to the hierarchy

function onDocumentMouseMove(e: MouseEvent) {
  yaw.rotation.y -= e.movementX * 0.002;
  const v = pitch.rotation.x - e.movementY * 0.002;

  // limit range
  if (v > -1 && v < 0.1) {
    pitch.rotation.x = v;
  }
}

function onDocumentMouseWheel(e: WheelEvent) {
  e.preventDefault();
  const v = camera.position.z + e.deltaY * 0.005;

  // limit range
  if (v >= 1 && v <= 10) {
    camera.position.z = v;
  }
}
// end follow cam.

const keyMap: { [key: string]: boolean } = {};

const onDocumentKey = (e: KeyboardEvent) => {
  keyMap[e.code] = e.type === "keydown";
};

document.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === renderer.domElement) {
    document.addEventListener("keydown", onDocumentKey);
    document.addEventListener("keyup", onDocumentKey);

    renderer.domElement.addEventListener("mousemove", onDocumentMouseMove);
    renderer.domElement.addEventListener("wheel", onDocumentMouseWheel);
  } else {
    document.removeEventListener("keydown", onDocumentKey);
    document.removeEventListener("keyup", onDocumentKey);

    renderer.domElement.removeEventListener("mousemove", onDocumentMouseMove);
    renderer.domElement.removeEventListener("wheel", onDocumentMouseWheel);
  }
});

// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;
// controls.target.y = 1;

const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 200), new THREE.MeshPhongMaterial());
floorMesh.receiveShadow = true;
floorMesh.position.y = -1;
scene.add(floorMesh);
const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, 0));
const floorShape = RAPIER.ColliderDesc.cuboid(100, 0.5, 100); //.setCollisionGroups(65542)
world.createCollider(floorShape, floorBody);

const car = new Car(keyMap, pivot);
await car.init(scene, world, [0, 1, 0]);

const boxes: Box[] = [];
for (let x = 0; x < 8; x += 1) {
  for (let y = 0; y < 8; y += 1) {
    boxes.push(new Box(scene, world, [(x - 4) * 1.2, y + 1, -20]));
  }
}

const stats = new Stats();
document.body.appendChild(stats.dom);

const gui = new GUI();
gui.add(rapierDebugRenderer, "enabled").name("Rapier Degug Renderer");

const physicsFolder = gui.addFolder("Physics");
physicsFolder.add(world.gravity, "x", -10.0, 10.0, 0.1);
physicsFolder.add(world.gravity, "y", -10.0, 10.0, 0.1);
physicsFolder.add(world.gravity, "z", -10.0, 10.0, 0.1);

const rendererFolder = gui.addFolder("Renderer");
rendererFolder.add(renderer, "toneMappingExposure", 0, 2, 0.01);

const backgroundFolder = gui.addFolder("Background");
backgroundFolder.add(scene, "backgroundIntensity", 0, 2, 0.01);
backgroundFolder.add(scene, "backgroundBlurriness", 0, 2, 0.01);

const environmentFolder = gui.addFolder("Environnment");
environmentFolder.add(scene, "environmentIntensity", 0, 2, 0.01);

const lightFolder = gui.addFolder("Light Helper");
lightFolder.add(lightHelper, "visible");

const clock = new THREE.Clock();
let delta;

function animate() {
  requestAnimationFrame(animate);

  delta = clock.getDelta();
  world.timestep = Math.min(delta, 0.1);
  world.step();

  for (let i = 0, n = dynamicBodies.length; i < n; i++) {
    dynamicBodies[i][0].position.copy(dynamicBodies[i][1].translation());
    dynamicBodies[i][0].quaternion.copy(dynamicBodies[i][1].rotation());
  }

  car.update(delta);

  boxes.forEach((b) => b.update());

  rapierDebugRenderer.update();

  // controls.update();

  light.position.copy(camera.position).add(lightOffset);

  renderer.render(scene, camera);

  stats.update();
}

animate();
