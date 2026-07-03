import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { state } from './state.js';
import { loadFont, updateGeometry } from './geometry.js';
import { rootGroup, camera, renderer, controls } from './scene.js';

export function updateDimensionsInfo() {
    rootGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rootGroup);
    if (box.isEmpty()) {
        const dimInfo = document.getElementById('dimensions-info');
        if (dimInfo) dimInfo.innerHTML = 'W: 0 mm<br>H: 0 mm<br>D: 0 mm';
        return;
    }
    const w = (box.max.x - box.min.x).toFixed(1);
    const h = (box.max.y - box.min.y).toFixed(1);
    const d = (box.max.z - box.min.z).toFixed(1);
    const dimInfo = document.getElementById('dimensions-info');
    if (dimInfo) dimInfo.innerHTML = `W: ${w} mm<br>H: ${h} mm<br>D: ${d} mm`;
}

export function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'block' : 'none';
}
export function initEvents() {
const btnText = document.getElementById('mode-text');
const btnSvg = document.getElementById('mode-svg');
function setMode(m) {
    const btnText = document.getElementById('mode-text');
    const btnSvg = document.getElementById('mode-svg');
    state.mode = m;
    if (m === 'text') {
        if (btnText) btnText.className = 'flex-1 py-1 px-2 btn-mode-active rounded text-sm transition';
        if (btnSvg) btnSvg.className = 'flex-1 py-1 px-2 btn-mode-inactive rounded text-sm transition';
        const ctrlText = document.getElementById('controls-text');
        if (ctrlText) ctrlText.style.display = 'block';
        const ctrlSvg = document.getElementById('controls-svg');
        if (ctrlSvg) ctrlSvg.style.display = 'none';
    } else {
        if (btnSvg) btnSvg.className = 'flex-1 py-1 px-2 btn-mode-active rounded text-sm transition';
        if (btnText) btnText.className = 'flex-1 py-1 px-2 btn-mode-inactive rounded text-sm transition';
        const ctrlText = document.getElementById('controls-text');
        if (ctrlText) ctrlText.style.display = 'none';
        const ctrlSvg = document.getElementById('controls-svg');
        if (ctrlSvg) ctrlSvg.style.display = 'block';
    }
    updateGeometry();
}
if (btnText) btnText.onclick = () => setMode('text');
if (btnSvg) btnSvg.onclick = () => setMode('svg');

const inputText = document.getElementById('input-text');
if (inputText) {
    inputText.addEventListener('input', (e) => {
        const val = e.target.value;
        state.text = val;
        if (val.length > 1 && !state.baseEnabled) {
            state.baseEnabled = true;
            const baseEnable = document.getElementById('base-enable');
            if (baseEnable) baseEnable.checked = true;
            const c = document.getElementById('controls-base');
            if (c) {
                c.style.opacity = '1'; c.style.pointerEvents = 'auto';
            }
        }
        updateGeometry();
    });
}

const textSizeSlider = document.getElementById('text-size');
if (textSizeSlider) {
    textSizeSlider.addEventListener('input', (e) => {
        state.textSize = parseFloat(e.target.value);
        updateGeometry();
    });
}

const textSpacingSlider = document.getElementById('text-spacing');
if (textSpacingSlider) {
    textSpacingSlider.addEventListener('input', (e) => {
        state.textSpacing = parseFloat(e.target.value);
        updateGeometry();
    });
}

const fontSelect = document.getElementById('font-select');
if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
        state.fontKey = e.target.value;
        loadFont(state.fontKey);
    });
}

const thicknessSlider = document.getElementById('model-thickness');
if (thicknessSlider) {
    thicknessSlider.addEventListener('input', (e) => {
        state.modelThickness = parseFloat(e.target.value);
        const valThick = document.getElementById('val-thickness');
        if (valThick) valThick.textContent = state.modelThickness + 'mm';
        updateGeometry();
    });
}

const fileInput = document.getElementById('input-file');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => { state.svgContent = evt.target.result; updateGeometry(); };
        reader.readAsText(file);
    });
}

const svgScaleSlider = document.getElementById('svg-scale');
if (svgScaleSlider) {
    svgScaleSlider.addEventListener('input', (e) => {
        state.svgScale = parseFloat(e.target.value);
        updateGeometry();
    });
}

const baseEnableCheck = document.getElementById('base-enable');
if (baseEnableCheck) {
    baseEnableCheck.addEventListener('change', (e) => {
        state.baseEnabled = e.target.checked;
        const c = document.getElementById('controls-base');
        if (c) {
            c.style.opacity = state.baseEnabled ? '1' : '0.5';
            c.style.pointerEvents = state.baseEnabled ? 'auto' : 'none';
        }
        updateGeometry();
    });
}

['base-padding', 'base-thickness', 'base-radius'].forEach(id => {
    const slider = document.getElementById(id);
    if (slider) {
        slider.addEventListener('input', (e) => {
            const prop = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase()).replace('base', 'base');
            state[prop] = parseFloat(e.target.value);
            updateGeometry();
        });
    }
});

const ringEnableCheck = document.getElementById('ring-enable');
if (ringEnableCheck) {
    ringEnableCheck.addEventListener('change', (e) => {
        state.ringEnabled = e.target.checked;
        const c = document.getElementById('controls-ring');
        if (c) {
            c.style.opacity = state.ringEnabled ? '1' : '0.5';
            c.style.pointerEvents = state.ringEnabled ? 'auto' : 'none';
        }
        updateGeometry();
    });
}

const ringAutoYCheck = document.getElementById('ring-auto-y');
if (ringAutoYCheck) {
    ringAutoYCheck.addEventListener('change', (e) => {
        state.ringAutoY = e.target.checked;
        updateGeometry();
    });
}

// リングスライダー: range と number 入力を双方向でバインドする
['ring-x', 'ring-y', 'ring-size', 'ring-tube', 'ring-rot'].forEach(id => {
    const slider = document.getElementById(id);
    const numInput = document.getElementById('val-' + id);
    const prop = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

    if (slider) {
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state[prop] = val;
            if (numInput) numInput.value = val;
            updateGeometry();
        });
    }
    if (numInput) {
        numInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) return;
            if (slider) {
                val = Math.min(parseFloat(slider.max), Math.max(parseFloat(slider.min), val));
                slider.value = val;
            }
            state[prop] = val;
            updateGeometry();
        });
    }
});

// リング形状セレクト。真円(32)選択時のみ補強板チェックボックスを表示する。
function updateReinforceVisibility() {
    const ctrl = document.getElementById('ctrl-ring-reinforce');
    if (ctrl) ctrl.style.display = parseInt(state.ringShape) === 32 ? 'flex' : 'none';
}
const ringShapeEl = document.getElementById('ring-shape');
if (ringShapeEl) {
    ringShapeEl.addEventListener('input', (e) => {
        state.ringShape = parseFloat(e.target.value);
        updateReinforceVisibility();
        updateGeometry();
    });
}

const ringReinforceCheck = document.getElementById('ring-reinforce');
if (ringReinforceCheck) {
    ringReinforceCheck.addEventListener('change', (e) => {
        state.ringReinforce = e.target.checked;
        updateGeometry();
    });
}

const exportBtn = document.getElementById('btn-export');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Processing...';

        // UI 更新を描画サイクルに乗せてからエクスポート処理を開始する
        setTimeout(() => {
            try {
                const exporter = new STLExporter();

                rootGroup.updateMatrixWorld(true);
                const exportTarget = rootGroup;

                const result = exporter.parse(exportTarget, { binary: true });
                const blob = new Blob([result], { type: 'application/octet-stream' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `keychain_v3.5_${Date.now()}.stl`;
                link.click();
            } catch (err) {
                console.error('Export error:', err);
                alert('エクスポートに失敗しました: ' + err.message);
            } finally {
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export STL';
            }
        }, 50);
    });
}

const mirrorCheck = document.getElementById('mirror-x');
if (mirrorCheck) {
    mirrorCheck.addEventListener('change', (e) => {
        state.mirrorX = e.target.checked;
        updateGeometry();
    });
}

const uiPanel = document.getElementById('ui-panel');
const btnToggle = document.getElementById('toggle-ui');
if (btnToggle && uiPanel) {
    btnToggle.addEventListener('click', () => {
        uiPanel.classList.toggle('collapsed');
        btnToggle.textContent = uiPanel.classList.contains('collapsed') ? 'UIを表示' : 'UIを隠す';
    });
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
}
// UI 初期化: state -> DOM への一方向同期。
// 初期値は state オブジェクトのみで管理し、HTML 側には value/checked 属性を書かない。
export function initUIFromState() {
    const set   = (id, val) => { const el = document.getElementById(id); if (el) el.value   = val; };
    const check = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    const enable = (id, on) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !on;
        el.style.opacity = on ? '1' : '0.5';
    };
    const panelOpacity = (id, on) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.opacity = on ? '1' : '0.5';
        el.style.pointerEvents = on ? 'auto' : 'none';
    };

    // テキスト
    set('input-text', state.text);
    set('font-select', state.fontKey);
    set('text-size', state.textSize);
    set('text-spacing', state.textSpacing);
    set('svg-scale', state.svgScale);
    set('model-thickness', state.modelThickness);
    check('mirror-x', state.mirrorX);
    const valThick = document.getElementById('val-thickness');
    if (valThick) valThick.textContent = state.modelThickness + 'mm';

    // 土台
    check('base-enable', state.baseEnabled);
    panelOpacity('controls-base', state.baseEnabled);
    set('base-padding', state.basePadding);
    set('base-thickness', state.baseThickness);
    set('base-radius', state.baseRadius);

    // ストラップリング
    check('ring-enable', state.ringEnabled);
    set('ring-shape', state.ringShape);
    check('ring-reinforce', state.ringReinforce);
    check('ring-auto-y', state.ringAutoY);

    [['ring-x','val-ring-x','ringX'], ['ring-y','val-ring-y','ringY'],
     ['ring-size','val-ring-size','ringSize'], ['ring-tube','val-ring-tube','ringTube'],
     ['ring-rot','val-ring-rot','ringRot']
    ].forEach(([sid, nid, prop]) => { set(sid, state[prop]); set(nid, state[prop]); });

    // Auto Top Align 時は ring-y を無効化
    enable('ring-y', !state.ringAutoY);
    enable('val-ring-y', !state.ringAutoY);

    // 補強板の表示制御
    updateReinforceVisibility();
}
