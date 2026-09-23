import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls";

// WebGL の利用可否チェック
export function isWebGLAvailable(): boolean {
  try {
    const testCanvas = document.createElement("canvas");
    return !!(
      (window.WebGL2RenderingContext && testCanvas.getContext("webgl2")) ||
      (window.WebGLRenderingContext &&
        (testCanvas.getContext("webgl") ||
          testCanvas.getContext("experimental-webgl")))
    );
  } catch {
    return false;
  }
}

// Three.js セットアップ
export const canvas = document.querySelector(
  "#gl-canvas",
) as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("Canvas #gl-canvas not found");
}

let mainRenderer: THREE.WebGLRenderer | null = null;
if (isWebGLAvailable()) {
  try {
    mainRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    mainRenderer.setSize(window.innerWidth, window.innerHeight);
    mainRenderer.setPixelRatio(window.devicePixelRatio);
    mainRenderer.shadowMap.enabled = true;
    mainRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (err) {
    console.warn("Main WebGLRenderer init failed:", err);
    mainRenderer = null;
  }
}

if (!mainRenderer) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      showWebGLDisabledWarning();
    });
  } else {
    showWebGLDisabledWarning();
  }
}

export const renderer: THREE.WebGLRenderer | null = mainRenderer;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f2f5);
scene.fog = new THREE.Fog(0xf0f2f5, 200, 600);

// グリッドと影受け平面 (Z軸が上を向くよう X回転)
export const gridHelper = new THREE.GridHelper(
  200,
  20,
  0xcccccc,
  0xe5e5e5,
);
gridHelper.rotation.x = Math.PI / 2;
gridHelper.position.z = -0.1;
scene.add(gridHelper);

export const planeGeometry = new THREE.PlaneGeometry(500, 500);
export const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
export const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.position.z = -0.2;
plane.receiveShadow = true;
scene.add(plane);

// カメラ (Z軸を上に設定してモデルを正面から見る)
export const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  1000,
);
camera.position.set(0, -60, 80);
camera.lookAt(0, 0, 0);
camera.up.set(0, 0, 1);

export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ライティング
export const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

export const hemiLight = new THREE.HemisphereLight(
  0xffffff,
  0x444444,
  0.6,
);
hemiLight.position.set(0, 0, 50);
scene.add(hemiLight);

export const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(50, -50, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// マテリアル (メインモデル / 土台 / リング)
export const materialMain = new THREE.MeshStandardMaterial({
  color: 0x3b82f6,
  roughness: 0.3,
  side: THREE.DoubleSide,
});
export const materialBase = new THREE.MeshStandardMaterial({
  color: 0x9ca3af,
  roughness: 0.4,
  side: THREE.DoubleSide,
});
export const materialRing = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  roughness: 0.3,
  side: THREE.DoubleSide,
});

// シーングラフ (rootGroup 以下に全メッシュをまとめ、STL エクスポート時に一括処理)
export const groupMain = new THREE.Group();
export const groupBase = new THREE.Group();
export const groupRing = new THREE.Group();
export const rootGroup = new THREE.Group();

rootGroup.add(groupMain);
rootGroup.add(groupBase);
rootGroup.add(groupRing);
scene.add(rootGroup);

export function animate(): void {
  requestAnimationFrame(animate);
  updateCameraAnimation();
  controls.update();
  if (renderer) {
    renderer.render(scene, camera);
  }
  if (gizmoRenderer) {
    updateGizmo();
  }
}

// ナビゲーションギズモ (右上固定の別レンダラー描画ウィジェット)
export const GIZMO_SIZE = 120;
export const gizmoCanvas = document.getElementById(
  "gizmo-canvas",
) as HTMLCanvasElement | null;
export const gizmoContainer = document.getElementById(
  "gizmo-container",
) as HTMLElement | null;

let _gizmoRenderer: THREE.WebGLRenderer | null = null;
if (mainRenderer && gizmoCanvas && isWebGLAvailable()) {
  try {
    _gizmoRenderer = new THREE.WebGLRenderer({
      canvas: gizmoCanvas,
      alpha: true,
      antialias: true,
    });
    _gizmoRenderer.setSize(GIZMO_SIZE, GIZMO_SIZE);
    _gizmoRenderer.setPixelRatio(window.devicePixelRatio);
  } catch (err) {
    console.warn("Gizmo WebGLRenderer init failed:", err);
    _gizmoRenderer = null;
  }
}

if (!_gizmoRenderer && gizmoContainer) {
  gizmoContainer.style.display = "none";
}

export const gizmoRenderer: THREE.WebGLRenderer | null = _gizmoRenderer;

export const gizmoScene = new THREE.Scene();
export const gizmoCamera = new THREE.OrthographicCamera(
  -1.7,
  1.7,
  1.7,
  -1.7,
  0.1,
  20,
);
gizmoCamera.position.set(0, 0, 8);
gizmoCamera.lookAt(0, 0, 0);

// 3色の環を生成する (X=赤 YZ平面, Y=緑 XZ平面, Z=青 XY平面)
(function buildRings(): void {
  const rings = [
    { color: 0xff3b3b, rx: 0, ry: Math.PI / 2, rz: 0 },
    { color: 0x3bdd5a, rx: Math.PI / 2, ry: 0, rz: 0 },
    { color: 0x4b9eff, rx: 0, ry: 0, rz: 0 },
  ];
  rings.forEach((r) => {
    const geo = new THREE.TorusGeometry(1, 0.04, 16, 80);
    const mat = new THREE.MeshBasicMaterial({
      color: r.color,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(r.rx, r.ry, r.rz);
    gizmoScene.add(mesh);
  });
})();

export interface GizmoAxis {
  id: string;
  txt: string;
  pos3: THREE.Vector3;
  color: string;
  dir: THREE.Vector3;
  up: THREE.Vector3;
}

// 6軸ラベル定義 (方向ベクトルとカメラスナップの up を持つ)
export const GIZMO_AXES: GizmoAxis[] = [
  {
    id: "gx+",
    txt: "X",
    pos3: new THREE.Vector3(1.3, 0, 0),
    color: "#ff4444",
    dir: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: "gy+",
    txt: "Y",
    pos3: new THREE.Vector3(0, 1.3, 0),
    color: "#3bdd5a",
    dir: new THREE.Vector3(0, 1, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: "gz+",
    txt: "Z",
    pos3: new THREE.Vector3(0, 0, 1.3),
    color: "#4b9eff",
    dir: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0),
  },
  {
    id: "gx-",
    txt: "-X",
    pos3: new THREE.Vector3(-1.3, 0, 0),
    color: "#aa2222",
    dir: new THREE.Vector3(-1, 0, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: "gy-",
    txt: "-Y",
    pos3: new THREE.Vector3(0, -1.3, 0),
    color: "#229944",
    dir: new THREE.Vector3(0, -1, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: "gz-",
    txt: "-Z",
    pos3: new THREE.Vector3(0, 0, -1.3),
    color: "#2255aa",
    dir: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
  },
];

// Div ラベルを DOM に追加し、クリック時にカメラアニメーションを起動する
export const labelEls: Record<string, HTMLDivElement> = {};
GIZMO_AXES.forEach((ax) => {
  const el = document.createElement("div");
  el.className = "gizmo-label";
  el.id = ax.id;
  el.textContent = ax.txt;
  el.style.color = ax.color;
  el.addEventListener("click", () => startCamAnim(ax.dir, ax.up));
  if (gizmoContainer) {
    gizmoContainer.appendChild(el);
  }
  labelEls[ax.id] = el;
});

export interface CamAnimState {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromUp: THREE.Vector3;
  toUp: THREE.Vector3;
  t0: number | null;
}

// カメラアニメーション (smooth step で ease in-out)
export let camAnim: CamAnimState | null = null;
export const CAM_ANIM_MS = 550;

export function startCamAnim(
  dirUnit: THREE.Vector3,
  upVec: THREE.Vector3,
): void {
  const dist = camera.position.distanceTo(controls.target);
  const targetPos = controls.target
    .clone()
    .add(dirUnit.clone().multiplyScalar(dist));
  camAnim = {
    fromPos: camera.position.clone(),
    toPos: targetPos,
    fromUp: camera.up.clone(),
    toUp: upVec.clone(),
    t0: null,
  };
}

export function updateCameraAnimation(): void {
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
export function updateGizmo(): void {
  if (!gizmoRenderer) return;

  // メインカメラと同じ向きをギズモカメラに反映する
  const dir = camera.position.clone().sub(controls.target).normalize();
  gizmoCamera.position.copy(dir.multiplyScalar(8));
  gizmoCamera.up.copy(camera.up);
  gizmoCamera.lookAt(0, 0, 0);

  // 各ラベルを 3D -> 2D に投影して DOM 位置を更新する。
  // カメラ側を向いていない (奥面の) ラベルは薄く表示する。
  GIZMO_AXES.forEach((ax) => {
    _gv.copy(ax.pos3).project(gizmoCamera);
    const x = ((_gv.x + 1) / 2) * GIZMO_SIZE;
    const y = ((-_gv.y + 1) / 2) * GIZMO_SIZE;
    const el = labelEls[ax.id];
    if (el) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      const dot = ax.pos3.clone().normalize().dot(dir);
      el.style.opacity = dot >= 0 ? "1" : "0.28";
    }
  });

  gizmoRenderer.render(gizmoScene, gizmoCamera);
}

// WebGL 無効時の案内モーダル表示
export function showWebGLDisabledWarning(): void {
  if (document.getElementById("webgl-warning-modal")) return;

  const modal = document.createElement("div");
  modal.id = "webgl-warning-modal";
  modal.className =
    "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50";

  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-gray-800 border border-gray-100">
      <div class="flex items-start gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-600 text-lg font-bold">
          !
        </div>
        <div>
          <h2 class="text-base font-bold text-gray-900 leading-tight">3Dプレビューを表示できません</h2>
          <p class="text-xs text-gray-500 mt-1">ブラウザのグラフィックアクセラレーション (WebGL) が無効になっています。</p>
        </div>
      </div>
      
      <div class="bg-gray-50 rounded-lg p-3.5 mb-4 text-xs space-y-3 border border-gray-200">
        <div>
          <p class="font-bold text-gray-700 mb-1">Google Chrome の場合</p>
          <ol class="list-decimal list-inside space-y-0.5 text-gray-600 pl-1">
            <li>アドレスバーに <code class="bg-gray-200 px-1 py-0.5 rounded text-[11px] font-mono text-blue-700 select-all">chrome://settings/system</code> を入力</li>
            <li><strong>「グラフィック アクセラレーションが使用可能な場合は使用する」</strong> をオン</li>
            <li>「再起動」をクリックしてブラウザを再起動</li>
          </ol>
        </div>
        <div class="border-t border-gray-200 pt-2">
          <p class="font-bold text-gray-700 mb-1">Microsoft Edge の場合</p>
          <ol class="list-decimal list-inside space-y-0.5 text-gray-600 pl-1">
            <li>アドレスバーに <code class="bg-gray-200 px-1 py-0.5 rounded text-[11px] font-mono text-blue-700 select-all">edge://settings/system</code> を入力</li>
            <li><strong>「使用可能な場合はグラフィックス アクセラレーションを使用する」</strong> をオン</li>
            <li>「再起動」をクリックしてブラウザを再起動</li>
          </ol>
        </div>
      </div>

      <div class="text-[11px] text-blue-800 bg-blue-50 p-2.5 rounded mb-5 leading-relaxed border border-blue-100">
        ※ 3D画面は表示されませんが、文字編集や <strong>STLファイルの出力はそのまま利用可能</strong> です。
      </div>

      <div class="flex gap-2 justify-end">
        <button id="btn-close-webgl-warning" class="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer">
          閉じて編集を続ける
        </button>
        <button id="btn-reload-webgl" class="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm cursor-pointer">
          再読み込み
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const btnReload = modal.querySelector("#btn-reload-webgl");
  btnReload?.addEventListener("click", () => {
    window.location.reload();
  });

  const btnClose = modal.querySelector("#btn-close-webgl-warning");
  btnClose?.addEventListener("click", () => {
    modal.remove();
    createWarningBadge();
  });
}

function createWarningBadge(): void {
  if (document.getElementById("webgl-warning-badge")) return;
  const badge = document.createElement("button");
  badge.id = "webgl-warning-badge";
  badge.className =
    "fixed top-3 right-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 z-40 transition cursor-pointer";
  badge.innerHTML = "<span>! 3D無効 (WebGL)</span>";
  badge.title = "WebGLが無効です。クリックして設定手順を表示";
  badge.addEventListener("click", () => {
    showWebGLDisabledWarning();
  });
  document.body.appendChild(badge);
}
