import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';

// Three.js セチE��アチE�E
export const canvas = document.querySelector('#gl-canvas');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f2f5);
scene.fog = new THREE.Fog(0xf0f2f5, 200, 600);

// グリチE��と影受け平面 (Z軸が上を向くよう X回転)
export const gridHelper = new THREE.GridHelper(200, 20, 0xcccccc, 0xe5e5e5);
gridHelper.rotation.x = Math.PI / 2;
gridHelper.position.z = -0.1;
scene.add(gridHelper);

export const planeGeometry = new THREE.PlaneGeometry(500, 500);
export const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
export const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.position.z = -0.2;
plane.receiveShadow = true;
scene.add(plane);

// カメラ (Z軸を上に設定してモチE��を正面から見る)
export const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, -60, 80);
camera.lookAt(0, 0, 0);
camera.up.set(0, 0, 1);

export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ライチE��ング
export const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemiLight.position.set(0, 0, 50);
scene.add(hemiLight);

export const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(50, -50, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// マテリアル (メインモチE�� / 土台 / リング)
export const materialMain = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, side: THREE.DoubleSide });
export const materialBase = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.4, side: THREE.DoubleSide });
export const materialRing = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, side: THREE.DoubleSide });

// シーングラチE(rootGroup 以下に全メチE��ュをまとめ、STL エクスポ�Eト時に一括処琁E
export const groupMain = new THREE.Group();
export const groupBase = new THREE.Group();
export const groupRing = new THREE.Group();
export const rootGroup = new THREE.Group();

rootGroup.add(groupMain);
rootGroup.add(groupBase);
rootGroup.add(groupRing);
scene.add(rootGroup);
export function animate() {
    requestAnimationFrame(animate);
    updateCameraAnimation();
    controls.update();
    renderer.render(scene, camera);
    updateGizmo();
}

// ナビゲーションギズモ (右上固定�E別レンダラー描画ウィジェチE��)
export const GIZMO_SIZE = 120;
export const gizmoCanvas = document.getElementById('gizmo-canvas');
export const gizmoContainer = document.getElementById('gizmo-container');

export const gizmoRenderer = new THREE.WebGLRenderer({ canvas: gizmoCanvas, alpha: true, antialias: true });
gizmoRenderer.setSize(GIZMO_SIZE, GIZMO_SIZE);
gizmoRenderer.setPixelRatio(window.devicePixelRatio);

export const gizmoScene = new THREE.Scene();
export const gizmoCamera = new THREE.OrthographicCamera(-1.7, 1.7, 1.7, -1.7, 0.1, 20);
gizmoCamera.position.set(0, 0, 8);
gizmoCamera.lookAt(0, 0, 0);

// 3色の環を生成すめE(X=赤 YZ平面, Y=緁EXZ平面, Z=靁EXY平面)
(function buildRings() {
    const rings = [
        { color: 0xff3b3b, rx: 0, ry: Math.PI / 2, rz: 0 },
        { color: 0x3bdd5a, rx: Math.PI / 2, ry: 0, rz: 0 },
        { color: 0x4b9eff, rx: 0, ry: 0, rz: 0 },
    ];
    rings.forEach(r => {
        const geo = new THREE.TorusGeometry(1, 0.04, 16, 80);
        const mat = new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.set(r.rx, r.ry, r.rz);
        gizmoScene.add(mesh);
    });
})();

// 6軸ラベル定義 (方向�Eクトルとカメラスナップ�E up を持つ)
export const GIZMO_AXES = [
    { id: 'gx+', txt: 'X',  pos3: new THREE.Vector3(1.3, 0, 0),    color: '#ff4444', dir: new THREE.Vector3(1, 0, 0),  up: new THREE.Vector3(0, 0, 1) },
    { id: 'gy+', txt: 'Y',  pos3: new THREE.Vector3(0, 1.3, 0),    color: '#3bdd5a', dir: new THREE.Vector3(0, 1, 0),  up: new THREE.Vector3(0, 0, 1) },
    { id: 'gz+', txt: 'Z',  pos3: new THREE.Vector3(0, 0, 1.3),    color: '#4b9eff', dir: new THREE.Vector3(0, 0, 1),  up: new THREE.Vector3(0, 1, 0) },
    { id: 'gx-', txt: '-X', pos3: new THREE.Vector3(-1.3, 0, 0),   color: '#aa2222', dir: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 0, 1) },
    { id: 'gy-', txt: '-Y', pos3: new THREE.Vector3(0, -1.3, 0),   color: '#229944', dir: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
    { id: 'gz-', txt: '-Z', pos3: new THREE.Vector3(0, 0, -1.3),   color: '#2255aa', dir: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
];

// Div ラベルめEDOM に追加し、クリチE��時にカメラアニメーションを起動すめE
export const labelEls = {};
GIZMO_AXES.forEach(ax => {
    const el = document.createElement('div');
    el.className = 'gizmo-label';
    el.id = ax.id;
    el.textContent = ax.txt;
    el.style.color = ax.color;
    el.addEventListener('click', () => startCamAnim(ax.dir, ax.up));
    gizmoContainer.appendChild(el);
    labelEls[ax.id] = el;
});

// カメラアニメーション (smooth step で ease in-out)
export let camAnim = null;
export const CAM_ANIM_MS = 550;

export function startCamAnim(dirUnit, upVec) {
    const dist = camera.position.distanceTo(controls.target);
    const targetPos = controls.target.clone().add(dirUnit.clone().multiplyScalar(dist));
    camAnim = {
        fromPos: camera.position.clone(),
        toPos:   targetPos,
        fromUp:  camera.up.clone(),
        toUp:    upVec.clone(),
        t0: null
    };
}

export function updateCameraAnimation() {
    if (!camAnim) return;
    const now = performance.now();
    if (!camAnim.t0) camAnim.t0 = now;
    let t = Math.min((now - camAnim.t0) / CAM_ANIM_MS, 1);
    t = t * t * (3 - 2 * t); // smooth step (ease in-out)

    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, t);
    camera.up.lerpVectors(camAnim.fromUp, camAnim.toUp, t).normalize();
    camera.lookAt(controls.target);
    if (t >= 1) camAnim = null;
}

// ギズモ描画: 毎フレーム呼び出してカメラ同期とラベル位置更新を行う
const _gv = new THREE.Vector3();
export function updateGizmo() {
    // メインカメラと同じ向きをギズモカメラに反映する
    const dir = camera.position.clone().sub(controls.target).normalize();
    gizmoCamera.position.copy(dir.multiplyScalar(8));
    gizmoCamera.up.copy(camera.up);
    gizmoCamera.lookAt(0, 0, 0);

    // 吁E��ベルめE3D -> 2D に投影して DOM 位置を更新する、E
    // カメラ側を向ぁE��ぁE��ぁE(奥面の) ラベルは薁E��表示する、E
    GIZMO_AXES.forEach(ax => {
        _gv.copy(ax.pos3).project(gizmoCamera);
        const x = (_gv.x + 1) / 2 * GIZMO_SIZE;
        const y = (-_gv.y + 1) / 2 * GIZMO_SIZE;
        const el = labelEls[ax.id];
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
        const dot = ax.pos3.clone().normalize().dot(dir);
        el.style.opacity = dot >= 0 ? '1' : '0.28';
    });

    gizmoRenderer.render(gizmoScene, gizmoCamera);
}
