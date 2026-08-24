import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeeee);

  const camera = new THREE.PerspectiveCamera(
    45,
    (window.innerWidth / 2) / window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(0, 1.5, 3);

  const renderer = new THREE.WebGLRenderer({
    antialias: true
  });

  renderer.setSize(
    window.innerWidth / 2,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.right = '0';
  renderer.domElement.style.top = '0';

  document.body.appendChild(
    renderer.domElement
  );

  const controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.target.set(0, 1, 0);
  controls.enableDamping = true;

  const hemisphereLight =
    new THREE.HemisphereLight(
      0xffffff,
      0x444444,
      3
    );

  scene.add(hemisphereLight);

  const directionalLight =
    new THREE.DirectionalLight(
      0xffffff,
      3
    );

  directionalLight.position.set(3, 5, 3);
  scene.add(directionalLight);

  scene.add(
    new THREE.GridHelper(10, 10)
  );

  function resize() {
    camera.aspect =
      (window.innerWidth / 2) /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth / 2,
      window.innerHeight
    );
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    resize
  };
}