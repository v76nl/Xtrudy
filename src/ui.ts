import { PanelLeftClose, PanelLeftOpen, createElement } from "lucide";
import * as THREE from "three";
import { type ExportMode, exportSTL } from "./export.ts";
import { type FontKey, loadFont } from "./fonts.ts";
import { updateGeometry } from "./geometry.ts";
import { camera, renderer, rootGroup } from "./scene.ts";
import { SLIDER_CONFIGS, type SliderKey, state } from "./state.ts";

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

const EXPORT_MODE_STORAGE_KEY = "xtrudy_export_mode";
const EXPORT_REMEMBER_STORAGE_KEY = "xtrudy_export_remember";

function getSavedExportMode(): ExportMode {
  const saved = localStorage.getItem(EXPORT_MODE_STORAGE_KEY);
  return saved === "multi" ? "multi" : "single";
}

function getSavedExportRemember(): boolean {
  return localStorage.getItem(EXPORT_REMEMBER_STORAGE_KEY) === "true";
}

function updateExportBadge(mode: ExportMode): void {
  const badge = document.getElementById("export-mode-badge");
  if (!badge) return;
  if (mode === "multi") {
    badge.textContent = "2色印刷用 (パーツ別 ZIP)";
    badge.classList.add("multi-mode");
  } else {
    badge.textContent = "単一ファイル (一体型 STL)";
    badge.classList.remove("multi-mode");
  }
}

export function setTextDirection(dir: "horizontal" | "vertical"): void {
  state.textDirection = dir;
  const isHoriz = dir === "horizontal";
  const btnHoriz = document.getElementById("dir-horizontal");
  const btnVert = document.getElementById("dir-vertical");
  btnHoriz?.classList.toggle("active", isHoriz);
  btnHoriz?.setAttribute("aria-selected", String(isHoriz));
  btnVert?.classList.toggle("active", !isHoriz);
  btnVert?.setAttribute("aria-selected", String(!isHoriz));
  updateGeometry();
}

function setupExportUI(): void {
  const btnExport = document.getElementById(
    "btn-export",
  ) as HTMLButtonElement | null;
  const btnSettings = document.getElementById(
    "btn-export-settings",
  ) as HTMLButtonElement | null;
  const modal = document.getElementById("export-modal");
  const modalClose = document.getElementById("modal-close");
  const btnCancel = document.getElementById("btn-modal-cancel");
  const btnConfirm = document.getElementById("btn-modal-confirm");
  const optSingle = document.getElementById(
    "opt-single",
  ) as HTMLInputElement | null;
  const optMulti = document.getElementById(
    "opt-multi",
  ) as HTMLInputElement | null;
  const chkRemember = document.getElementById(
    "export-remember",
  ) as HTMLInputElement | null;

  const currentMode = getSavedExportMode();
  updateExportBadge(currentMode);

  const openModal = () => {
    if (!modal) return;
    const mode = getSavedExportMode();
    if (optSingle && optMulti) {
      if (mode === "multi") {
        optMulti.checked = true;
      } else {
        optSingle.checked = true;
      }
    }
    if (chkRemember) {
      chkRemember.checked = getSavedExportRemember();
    }
    modal.style.display = "flex";
  };

  const closeModal = () => {
    if (!modal) return;
    modal.style.display = "none";
  };

  btnExport?.addEventListener("click", () => {
    const isRemembered = getSavedExportRemember();
    if (isRemembered) {
      exportSTL(btnExport, getSavedExportMode());
    } else {
      openModal();
    }
  });

  btnSettings?.addEventListener("click", () => {
    openModal();
  });

  modalClose?.addEventListener("click", closeModal);
  btnCancel?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  btnConfirm?.addEventListener("click", () => {
    const selectedMode: ExportMode = optMulti?.checked
      ? "multi"
      : "single";
    const remember = chkRemember ? chkRemember.checked : false;

    localStorage.setItem(EXPORT_MODE_STORAGE_KEY, selectedMode);
    localStorage.setItem(
      EXPORT_REMEMBER_STORAGE_KEY,
      remember ? "true" : "false",
    );

    updateExportBadge(selectedMode);
    closeModal();
    exportSTL(btnExport, selectedMode);
  });
}

export function initEvents(): void {
  function bindSliderWithNumber(key: SliderKey): void {
    const cfg = SLIDER_CONFIGS[key];
    const slider = document.getElementById(
      cfg.sliderId,
    ) as HTMLInputElement | null;
    const numInput = document.getElementById(
      cfg.numId,
    ) as HTMLInputElement | null;

    if (!slider || !numInput) return;

    // DOM 属性 (min, max, step) を TS 側の設定から注入
    slider.min = String(cfg.min);
    slider.max = String(cfg.max);
    slider.step = String(cfg.step);
    numInput.min = String(cfg.min);
    numInput.max = String(cfg.max);
    numInput.step = String(cfg.step);

    const handleWheel = (e: WheelEvent) => {
      if (slider.disabled) return;
      e.preventDefault();
      const step = cfg.step;
      const min = cfg.min;
      const max = cfg.max;
      const currentVal = Number.parseFloat(slider.value) || 0;
      const dir = e.deltaY < 0 ? 1 : -1;
      let nextVal = currentVal + dir * step;
      const stepStr = String(step);
      const decimals = stepStr.includes(".")
        ? stepStr.split(".")[1].length
        : 0;
      nextVal = Math.min(max, Math.max(min, nextVal));
      nextVal = Number.parseFloat(nextVal.toFixed(decimals));
      if (nextVal !== currentVal) {
        slider.value = String(nextVal);
        (state[key] as number) = nextVal;
        numInput.value = String(nextVal);
        updateGeometry();
      }
    };

    slider.addEventListener("input", () => {
      const val = Number.parseFloat(slider.value);
      (state[key] as number) = val;
      numInput.value = String(val);
      updateGeometry();
    });
    slider.addEventListener("wheel", handleWheel, { passive: false });

    numInput.addEventListener("input", () => {
      let val = Number.parseFloat(numInput.value);
      if (Number.isNaN(val)) return;
      val = Math.min(cfg.max, Math.max(cfg.min, val));
      slider.value = String(val);
      (state[key] as number) = val;
      updateGeometry();
    });
    numInput.addEventListener("wheel", handleWheel, { passive: false });
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

  const btnDirHoriz = document.getElementById("dir-horizontal");
  const btnDirVert = document.getElementById("dir-vertical");
  if (btnDirHoriz) {
    btnDirHoriz.addEventListener("click", () =>
      setTextDirection("horizontal"),
    );
  }
  if (btnDirVert) {
    btnDirVert.addEventListener("click", () =>
      setTextDirection("vertical"),
    );
  }

  const inputText = document.getElementById(
    "input-text",
  ) as HTMLTextAreaElement | null;
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

  // 全スライダーの設定反映 & 双方向バインドを一括実行
  (Object.keys(SLIDER_CONFIGS) as SliderKey[]).forEach((key) => {
    bindSliderWithNumber(key);
  });

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

  // エクスポートボタングループおよびモーダル初期化
  setupExportUI();

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

  // 書字方向
  setTextDirection(state.textDirection);

  // 土台 & リングのトグル・オプション
  check("base-enable", state.baseEnabled);
  panelOpacity("controls-base", state.baseEnabled);
  check("ring-enable", state.ringEnabled);
  panelOpacity("controls-ring", state.ringEnabled);
  set("ring-shape", state.ringShape);
  check("ring-reinforce", state.ringReinforce);
  check("ring-auto-y", state.ringAutoY);

  // 全スライダー & 数値入力ペアの一括反映
  (Object.keys(SLIDER_CONFIGS) as SliderKey[]).forEach((key) => {
    const cfg = SLIDER_CONFIGS[key];
    set(cfg.sliderId, state[key]);
    set(cfg.numId, state[key]);
  });

  // Auto Top Align 時は ring-y を無効化
  enable("ring-y", !state.ringAutoY);
  enable("val-ring-y", !state.ringAutoY);

  // 補強板の表示制御
  updateReinforceVisibility();

  // エクスポート設定バッジ
  updateExportBadge(getSavedExportMode());
}
