import { Clipper, FillRule, Paths64 } from "clipper2-js";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader";
import { currentFont } from "./fonts.ts";
import {
  generateBase,
  generateRing,
  generateRingReinforcement,
} from "./parts.ts";
import {
  groupBase,
  groupMain,
  groupRing,
  materialBase,
  materialMain,
} from "./scene.ts";
import { state } from "./state.ts";
import { updateDimensionsInfo } from "./ui.ts";
import {
  CLIPPER_SCALE,
  VERTICAL_ROTATING_CHARS,
  createRoundedRectPaths64,
  flipYCorrectly,
  parseCommandsToRawShapes,
  paths64ToThreeShapes,
  shiftPaths64,
  threeShapeToPath64,
} from "./utils.ts";

export function updateGeometry(): void {
  requestAnimationFrame(_generate);
}

export function _generate(): void {
  clearGroup(groupMain);
  clearGroup(groupBase);
  clearGroup(groupRing);

  const mainBox = new THREE.Box3();

  if (state.mode === "text" && currentFont) {
    generateTextAndBase(mainBox);
  } else if (state.mode === "svg" && state.svgContent) {
    generateSVG(mainBox);
    if (state.baseEnabled && !mainBox.isEmpty()) {
      generateBase(mainBox);
    }
  }

  if (state.baseEnabled) {
    const height = mainBox.max.y - mainBox.min.y + state.basePadding * 2;
    const midY = (mainBox.max.y + mainBox.min.y) / 2;
    const baseTopY = midY + height / 2;

    if (state.ringEnabled) {
      if (state.ringAutoY) {
        const outerRadius = state.ringSize + state.ringTube;
        const overlap = state.ringTube * 1.5;
        state.ringY =
          Math.round((baseTopY + outerRadius - overlap) * 10) / 10;

        const sliderY = document.getElementById(
          "ring-y",
        ) as HTMLInputElement | null;
        if (sliderY) {
          sliderY.value = String(state.ringY);
          sliderY.disabled = true;
          sliderY.style.opacity = "0.5";
        }
        const valY = document.getElementById(
          "val-ring-y",
        ) as HTMLInputElement | null;
        if (valY) {
          valY.value = String(state.ringY);
          valY.disabled = true;
          valY.style.opacity = "0.5";
        }
      } else {
        const sliderY = document.getElementById(
          "ring-y",
        ) as HTMLInputElement | null;
        if (sliderY) {
          sliderY.disabled = false;
          sliderY.style.opacity = "1";
        }
        const valY = document.getElementById(
          "val-ring-y",
        ) as HTMLInputElement | null;
        if (valY) {
          valY.disabled = false;
          valY.style.opacity = "1";
        }
      }
      generateRing();
      const ringShapeInt =
        typeof state.ringShape === "string"
          ? Number.parseInt(state.ringShape, 10)
          : state.ringShape;
      if (ringShapeInt === 32 && state.ringReinforce) {
        generateRingReinforcement(baseTopY);
      }
    }
  } else {
    if (state.ringEnabled) {
      if (state.ringAutoY && !mainBox.isEmpty()) {
        const outerRadius = state.ringSize + state.ringTube;
        const overlap = state.ringTube * 1.5;
        state.ringY =
          Math.round((mainBox.max.y + outerRadius - overlap) * 10) / 10;

        const sliderY = document.getElementById(
          "ring-y",
        ) as HTMLInputElement | null;
        if (sliderY) {
          sliderY.value = String(state.ringY);
          sliderY.disabled = true;
          sliderY.style.opacity = "0.5";
        }
        const valY = document.getElementById(
          "val-ring-y",
        ) as HTMLInputElement | null;
        if (valY) {
          valY.value = String(state.ringY);
          valY.disabled = true;
          valY.style.opacity = "0.5";
        }
      }
      generateRing();
      const ringShapeInt =
        typeof state.ringShape === "string"
          ? Number.parseInt(state.ringShape, 10)
          : state.ringShape;
      if (ringShapeInt === 32 && state.ringReinforce) {
        const connY = !mainBox.isEmpty()
          ? mainBox.max.y
          : state.ringY - (state.ringSize + state.ringTube);
        generateRingReinforcement(connY);
      }
    }
  }

  // ハンコ用左右反転: groupMain の X スケールで鏡像化
  groupMain.scale.x = state.mirrorX ? -1 : 1;

  updateDimensionsInfo();
}

export function clearGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    const obj = group.children[0];
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry) obj.geometry.dispose();
    }
    group.remove(obj);
  }
}

export function generateTextAndBase(targetBox: THREE.Box3): void {
  if (!state.text) return;
  const size = state.textSize;
  const spacing = state.textSpacing;
  const isVertical = state.textDirection === "vertical";
  const lines = state.text.split("\n");

  // 1. 全文字のサブパスを計算して収集 (横書き: 行送り・中央揃え / 縦書き: 右から左へ列送り・軸中心揃え)
  const allRawPaths = new Paths64();

  if (!isVertical) {
    // 横書きモード: 複数行対応 (上から下へ行送り、各行中央揃え)
    const linePitch = size * 1.1 + state.lineSpacing;

    lines.forEach((line, lineIdx) => {
      const chars = Array.from(line);
      if (chars.length === 0) return;

      let lineWidth = 0;
      chars.forEach((c) => {
        lineWidth +=
          (currentFont.getAdvanceWidth(c, size) as number) + spacing;
      });
      lineWidth -= spacing;

      let cursorX = -lineWidth / 2;
      const lineY = lineIdx * linePitch;

      chars.forEach((char) => {
        const fontPath = currentFont.getPath(char, 0, 0, size);
        parseCommandsToRawShapes(fontPath.commands).forEach((shape) => {
          const p64 = threeShapeToPath64(shape, 12, cursorX, lineY);
          if (p64.length >= 3) allRawPaths.push(p64);
        });
        cursorX +=
          (currentFont.getAdvanceWidth(char, size) as number) + spacing;
      });
    });
  } else {
    // 縦書きモード: 複数列対応 (日本語縦組ルール: 右から左へ列送り、各文字の水平中心軸を厳密に一致)
    const colCount = lines.length;
    const colPitch = size * 1.1 + state.lineSpacing;
    const charPitch = size * 1.05 + spacing;

    lines.forEach((colText, colIdx) => {
      const chars = Array.from(colText);
      if (chars.length === 0) return;

      // 日本語の縦書きは右から左へ列が進む: 第0列が最も右側
      const colCenterX = ((colCount - 1) / 2 - colIdx) * colPitch;

      chars.forEach((char, rowIdx) => {
        const fontPath = currentFont.getPath(char, 0, 0, size);
        const rawShapes = parseCommandsToRawShapes(fontPath.commands);
        if (rawShapes.length === 0) return;

        // 文字のバウンディングボックスを計算して水平中心・垂直中心を求める
        let cMinX = Number.POSITIVE_INFINITY;
        let cMaxX = Number.NEGATIVE_INFINITY;
        let cMinY = Number.POSITIVE_INFINITY;
        let cMaxY = Number.NEGATIVE_INFINITY;

        rawShapes.forEach((s) => {
          s.getPoints(8).forEach((p) => {
            if (p.x < cMinX) cMinX = p.x;
            if (p.x > cMaxX) cMaxX = p.x;
            if (p.y < cMinY) cMinY = p.y;
            if (p.y > cMaxY) cMaxY = p.y;
          });
        });

        const charMidX = (cMinX + cMaxX) / 2;
        const charMidY = (cMinY + cMaxY) / 2;

        // 長音符「ー」やダッシュ・括弧等の回転判定
        const rotate = VERTICAL_ROTATING_CHARS.has(char);

        // 垂直軸合わせ: 文字の幾何学的中心 charMidX を列中心 colCenterX に一致させる (軸ブレ防止)
        const offsetX = colCenterX - charMidX;

        // 縦送り: 各文字のスロット中心へ配置 (flipYCorrectly 前の空間では +Y が画面下の方向)
        const slotCenterY = rowIdx * charPitch;
        const offsetY = slotCenterY - charMidY;

        rawShapes.forEach((shape) => {
          const p64 = threeShapeToPath64(
            shape,
            12,
            offsetX,
            offsetY,
            rotate,
            charMidX,
            charMidY,
          );
          if (p64.length >= 3) allRawPaths.push(p64);
        });
      });
    });
  }

  if (allRawPaths.length === 0) return;

  // 2. 全文字を一括 Union
  let unified: Paths64;
  try {
    unified = Clipper.Union(allRawPaths, undefined, FillRule.NonZero);
  } catch (e) {
    console.warn("Clipper Union failed:", e);
    return;
  }
  if (!unified || unified.length === 0) return;

  // 3. Clipper 空間で bbox を計算して中心を求める
  let clipMinX = Number.POSITIVE_INFINITY,
    clipMaxX = Number.NEGATIVE_INFINITY,
    clipMinY = Number.POSITIVE_INFINITY,
    clipMaxY = Number.NEGATIVE_INFINITY;
  unified.forEach((path) =>
    path.forEach((pt) => {
      if (pt.x < clipMinX) clipMinX = pt.x;
      if (pt.x > clipMaxX) clipMaxX = pt.x;
      if (pt.y < clipMinY) clipMinY = pt.y;
      if (pt.y > clipMaxY) clipMaxY = pt.y;
    }),
  );
  const fontMidX = Math.round((clipMinX + clipMaxX) / 2);
  const fontMidY = Math.round((clipMinY + clipMaxY) / 2);

  // 4. 中心対称にシフトした文字パスを作成
  const centeredTextPaths = shiftPaths64(unified, -fontMidX, -fontMidY);

  // 5. 文字シェイプを THREE.Shape[] に変換して押し出す
  const textShapes = paths64ToThreeShapes(centeredTextPaths);
  if (textShapes.length === 0) return;

  if (state.baseEnabled) {
    // 6a. 文字柱
    const TINY_GAP = 0.001;
    const textGeom = new THREE.ExtrudeGeometry(textShapes, {
      depth: state.modelThickness,
      bevelEnabled: false,
    });
    flipYCorrectly(textGeom);
    textGeom.translate(0, 0, TINY_GAP);

    const textMesh = new THREE.Mesh(textGeom, materialMain);
    textMesh.castShadow = true;
    textMesh.receiveShadow = true;
    groupMain.add(textMesh);

    // 6b. 土台プレート
    const textW = (clipMaxX - clipMinX) / CLIPPER_SCALE;
    const textH = (clipMaxY - clipMinY) / CLIPPER_SCALE;
    const halfW = textW / 2 + state.basePadding;
    const halfH = textH / 2 + state.basePadding;
    const r = Math.min(state.baseRadius, halfW, halfH);

    const baseOutlinePaths = createRoundedRectPaths64(halfW, halfH, r);
    const baseShapes = paths64ToThreeShapes(baseOutlinePaths);
    if (baseShapes.length > 0) {
      const baseGeom = new THREE.ExtrudeGeometry(baseShapes, {
        depth: state.baseThickness,
        bevelEnabled: false,
      });
      flipYCorrectly(baseGeom);
      baseGeom.translate(0, 0, -state.baseThickness);

      const baseMesh = new THREE.Mesh(baseGeom, materialBase);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      groupBase.add(baseMesh);
    }

    targetBox.setFromObject(groupMain);
  } else {
    // 6c. 土台なし
    const textGeom = new THREE.ExtrudeGeometry(textShapes, {
      depth: state.modelThickness,
      bevelEnabled: false,
    });
    flipYCorrectly(textGeom);

    const textMesh = new THREE.Mesh(textGeom, materialMain);
    textMesh.castShadow = true;
    textMesh.receiveShadow = true;
    groupMain.add(textMesh);

    targetBox.setFromObject(groupMain);
  }
}

export function generateSVG(targetBox: THREE.Box3): void {
  if (!state.svgContent) return;
  const loader = new SVGLoader();
  const svgData = loader.parse(state.svgContent);
  const shapes: THREE.Shape[] = [];
  svgData.paths.forEach((path) =>
    shapes.push(...(path as any).toShapes(true)),
  );

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: state.modelThickness,
    bevelEnabled: false,
  });

  flipYCorrectly(geometry, state.svgScale, -state.svgScale, 1);
  geometry.computeBoundingBox();

  if (geometry.boundingBox) {
    const midX =
      (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2;
    const midY =
      (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;
    geometry.translate(-midX, -midY, 0);
    targetBox.copy(geometry.boundingBox);
  }

  const mesh = new THREE.Mesh(geometry, materialMain);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  groupMain.add(mesh);
}
