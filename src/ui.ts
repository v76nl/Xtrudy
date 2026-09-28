import { PanelLeftClose, PanelLeftOpen, createElement } from "lucide";
import * as THREE from "three";
import { exportSTL } from "./export.ts";
import { type FontKey, loadFont } from "./fonts.ts";
import { updateGeometry } from "./geometry.ts";
import { camera, renderer, rootGroup } from "./scene.ts";
import { state } from "./state.ts";

export function updateDimensionsInfo(): void {
  rootGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rootGroup);
  const dimW = document.getElementById("dim-w");
  const dimH = document.getElementById("dim-h");
  const dimD = document.getElementById("dim-d");
  if (!dimW || !dimH || !dimD) return;
  if (box.isEmpty()) {
    dimW.textContent = "0.0";
    dimH.textContent = "0.0";
    dimD.textContent = "0.0";
    return;
  }
  dimW.textContent = (box.max.x - box.min.x).toFixed(1);
  dimH.textContent = (box.max.y - box.min.y).toFixed(1);
  dimD.textContent = (box.max.z - box.min.z).toFixed(1);
}

export function showLoading(show: boolean): void {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = show ? "block" : "none";
}

export function updateReinforceVisibility(): void {
  const ctrl = document.getElementById("ctrl-ring-reinforce");
  const shape =
    typeof state.ringShape === "string"
      ? Number.parseInt(state.ringShape, 10)
      : state.ringShape;
  if (ctrl) ctrl.style.display = shape === 32 ? "flex" : "none";
}

export function initEvents(): void {
  function bindSliderWithNumber<K extends keyof typeof state>(
    sliderId: string,
    numId: string,
    key: K,
  ): void {
    const slider = document.getElementById(
      sliderId,
    ) as HTMLInputElement | null;
    const numInput = document.getElementById(
      numId,
    ) as HTMLInputElement | null;
    const handleWheel = (e: WheelEvent) => {
      if (!slider || slider.disabled) return;
      e.preventDefault();
      const step = Number.parseFloat(slider.step) || 1;
      const min =
        slider.min !== ""
          ? Number.parseFloat(slider.min)
          : Number.NEGATIVE_INFINITY;
      const max =
        slider.max !== ""
          ? Number.parseFloat(slider.max)
          : Number.POSITIVE_INFINITY;
      const currentVal = Number.parseFloat(slider.value) || 0;
      const dir = e.deltaY < 0 ? 1 : -1;
      let nextVal = currentVal + dir * step;
      const stepStr = String(slider.step);
      const decimals = stepStr.includes(".")
        ? stepStr.split(".")[1].length
        : 0;
      nextVal = Math.min(max, Math.max(min, nextVal));
      nextVal = Number.parseFloat(nextVal.toFixed(decimals));
      if (nextVal !== currentVal) {
        slider.value = String(nextVal);
        (state[key] as number) = nextVal;
        if (numInput) numInput.value = String(nextVal);
        updateGeometry();
      }
    };

    if (slider) {
      slider.addEventListener("input", () => {
        const val = Number.parseFloat(slider.value);
        (state[key] as number) = val;
        if (numInput) numInput.value = String(val);
        updateGeometry();
      });
      slider.addEventListener("wheel", handleWheel, { passive: false });
    }
    if (numInput) {
      numInput.addEventListener("input", () => {
        let val = Number.parseFloat(numInput.value);
        if (Number.isNaN(val)) return;
        if (slider) {
          val = Math.min(
            Number.parseFloat(slider.max),
            Math.max(Number.parseFloat(slider.min), val),
          );
          slider.value = String(val);
        }
        (state[key] as number) = val;
        updateGeometry();
      });
      numInput.addEventListener("wheel", handleWheel, { passive: false });
    }
  }

  function setMode(m: "text" | "svg") {
    state.mode = m;
    const isText = m === "text";
    const btnText = document.getElementById("mode-text");
    const btnSvg = document.getElementById("mode-svg");
    btnText?.classList.toggle("active", isText);
    btnText?.setAttribute("aria-selected", String(isText));
    btnSvg?.classList.toggle("active", !isText);
    btnSvg?.setAttribute("aria-selected", String(!isText));

    const ctrlText = document.getElementById("controls-text");
    if (ctrlText) ctrlText.style.display = isText ? "block" : "none";
    const ctrlSvg = document.getElementById("controls-svg");
    if (ctrlSvg) ctrlSvg.style.display = isText ? "none" : "block";
    updateGeometry();
  }

  const btnText = document.getElementById("mode-text");
  const btnSvg = document.getElementById("mode-svg");
  if (btnText) btnText.onclick = () => setMode("text");
  if (btnSvg) btnSvg.onclick = () => setMode("svg");
  setMode(state.mode);

  const inputText = document.getElementById(
    "input-text",
  ) as HTMLInputElement | null;
  if (inputText) {
    inputText.addEventListener("input", () => {
      const val = inputText.value;
      state.text = val;
      if (val.length > 1 && !state.baseEnabled) {
        state.baseEnabled = true;
        const baseEnable = document.getElementById(
          "base-enable",
        ) as HTMLInputElement | null;
        if (baseEnable) baseEnable.checked = true;
        const c = document.getElementById("controls-base");
        if (c) {
          c.style.opacity = "1";
          c.style.pointerEvents = "auto";
        }
      }
      updateGeometry();
    });
  }

  bindSliderWithNumber("text-size", "val-text-size", "textSize");
  bindSliderWithNumber("text-spacing", "val-text-spacing", "textSpacing");
  bindSliderWithNumber(
    "model-thickness",
    "val-model-thickness",
    "modelThickness",
  );

  const fontSelect = document.getElementById(
    "font-select",
  ) as HTMLSelectElement | null;
  if (fontSelect) {
    fontSelect.addEventListener("change", () => {
      state.fontKey = fontSelect.value;
      loadFont(state.fontKey as FontKey);
    });
  }

  const fileInput = document.getElementById(
    "input-file",
  ) as HTMLInputElement | null;
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const files = fileInput.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target && typeof evt.target.result === "string") {
          state.svgContent = evt.target.result;
          updateGeometry();
        }
      };
      reader.readAsText(file);
    });
  }

  bindSliderWithNumber("svg-scale", "val-svg-scale", "svgScale");

  const baseEnableCheck = document.getElementById(
    "base-enable",
  ) as HTMLInputElement | null;
  if (baseEnableCheck) {
    baseEnableCheck.addEventListener("change", () => {
      state.baseEnabled = baseEnableCheck.checked;
      const c = document.getElementById("controls-base");
      if (c) {
        c.style.opacity = state.baseEnabled ? "1" : "0.5";
        c.style.pointerEvents = state.baseEnabled ? "auto" : "none";
      }
      updateGeometry();
    });
  }

  bindSliderWithNumber("base-padding", "val-base-padding", "basePadding");
  bindSliderWithNumber(
    "base-thickness",
    "val-base-thickness",
    "baseThickness",
  );
  bindSliderWithNumber("base-radius", "val-base-radius", "baseRadius");

  const ringEnableCheck = document.getElementById(
    "ring-enable",
  ) as HTMLInputElement | null;
  if (ringEnableCheck) {
    ringEnableCheck.addEventListener("change", () => {
      state.ringEnabled = ringEnableCheck.checked;
      const c = document.getElementById("controls-ring");
      if (c) {
        c.style.opacity = state.ringEnabled ? "1" : "0.5";
        c.style.pointerEvents = state.ringEnabled ? "auto" : "none";
      }
      updateGeometry();
    });
  }

  const ringAutoYCheck = document.getElementById(
    "ring-auto-y",
  ) as HTMLInputElement | null;
  if (ringAutoYCheck) {
    ringAutoYCheck.addEventListener("change", () => {
      state.ringAutoY = ringAutoYCheck.checked;
      updateGeometry();
    });
  }

  // リングスライダー: range と number 入力を双方向でバインド
  bindSliderWithNumber("ring-x", "val-ring-x", "ringX");
  bindSliderWithNumber("ring-y", "val-ring-y", "ringY");
  bindSliderWithNumber("ring-size", "val-ring-size", "ringSize");
  bindSliderWithNumber("ring-tube", "val-ring-tube", "ringTube");
  bindSliderWithNumber("ring-rot", "val-ring-rot", "ringRot");

  const ringShapeEl = document.getElementById(
    "ring-shape",
  ) as HTMLSelectElement | null;
  if (ringShapeEl) {
    ringShapeEl.addEventListener("input", () => {
      state.ringShape = Number.parseFloat(ringShapeEl.value);
      updateReinforceVisibility();
      updateGeometry();
    });
  }

  const ringReinforceCheck = document.getElementById(
    "ring-reinforce",
  ) as HTMLInputElement | null;
  if (ringReinforceCheck) {
    ringReinforceCheck.addEventListener("change", () => {
      state.ringReinforce = ringReinforceCheck.checked;
      updateGeometry();
    });
  }

  const exportBtn = document.getElementById(
    "btn-export",
  ) as HTMLButtonElement | null;
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportSTL(exportBtn);
    });
  }

  const mirrorCheck = document.getElementById(
    "mirror-x",
  ) as HTMLInputElement | null;
  if (mirrorCheck) {
    mirrorCheck.addEventListener("change", () => {
      state.mirrorX = mirrorCheck.checked;
      updateGeometry();
    });
  }

  const uiPanel = document.getElementById("ui-panel");
  const btnToggle = document.getElementById("toggle-ui");
  const updateToggleIcon = () => {
    if (!btnToggle || !uiPanel) return;
    const isCollapsed = uiPanel.classList.contains("collapsed");
    btnToggle.innerHTML = "";
    const icon = createElement(
      isCollapsed ? PanelLeftOpen : PanelLeftClose,
    );
    btnToggle.appendChild(icon);
    const label = isCollapsed ? "UIを表示" : "UIを隠す";
    btnToggle.setAttribute("aria-label", label);
    btnToggle.setAttribute("title", label);
  };

  if (btnToggle && uiPanel) {
    updateToggleIcon();
    btnToggle.addEventListener("click", () => {
      uiPanel.classList.toggle("collapsed");
      updateToggleIcon();
    });
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer?.setSize(window.innerWidth, window.innerHeight);
  });
}

// UI 初期化: state -> DOM への一方向同期
// 初期値は state オブジェクトのみで管理し、HTML 側には value/checked 属性を書かない
export function initUIFromState(): void {
  const set = (id: string, val: any) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = String(val);
  };
  const check = (id: string, val: boolean) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = val;
  };
  const enable = (id: string, on: boolean) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.disabled = !on;
    el.style.opacity = on ? "1" : "0.5";
  };
  const panelOpacity = (id: string, on: boolean) => {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) return;
    el.style.opacity = on ? "1" : "0.5";
    el.style.pointerEvents = on ? "auto" : "none";
  };

  // 基本コントロール
  set("input-text", state.text);
  set("font-select", state.fontKey);
  check("mirror-x", state.mirrorX);

  // 土台 & リングのトグル・オプション
  check("base-enable", state.baseEnabled);
  panelOpacity("controls-base", state.baseEnabled);
  check("ring-enable", state.ringEnabled);
  panelOpacity("controls-ring", state.ringEnabled);
  set("ring-shape", state.ringShape);
  check("ring-reinforce", state.ringReinforce);
  check("ring-auto-y", state.ringAutoY);

  // 全スライダー & 数値入力ペアの一括反映
  const sliderProps: [string, string, keyof typeof state][] = [
    ["text-size", "val-text-size", "textSize"],
    ["text-spacing", "val-text-spacing", "textSpacing"],
    ["svg-scale", "val-svg-scale", "svgScale"],
    ["model-thickness", "val-model-thickness", "modelThickness"],
    ["base-padding", "val-base-padding", "basePadding"],
    ["base-thickness", "val-base-thickness", "baseThickness"],
    ["base-radius", "val-base-radius", "baseRadius"],
    ["ring-x", "val-ring-x", "ringX"],
    ["ring-y", "val-ring-y", "ringY"],
    ["ring-size", "val-ring-size", "ringSize"],
    ["ring-tube", "val-ring-tube", "ringTube"],
    ["ring-rot", "val-ring-rot", "ringRot"],
  ];
  sliderProps.forEach(([sid, nid, prop]) => {
    set(sid, state[prop]);
    set(nid, state[prop]);
  });

  // Auto Top Align 時は ring-y を無効化
  enable("ring-y", !state.ringAutoY);
  enable("val-ring-y", !state.ringAutoY);

  // 補強板の表示制御
  updateReinforceVisibility();
}
