import JSZip from "jszip";
import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils";
import { groupBase, groupMain, groupRing, rootGroup } from "./scene.ts";
import { state } from "./state.ts";

export type ExportMode = "single" | "multi";

/**
 * 指定したオブジェクト配下の全メッシュをワールド座標系でマージ・溶接し、
 * バイナリ STL の ArrayBuffer として出力する。メッシュが存在しない場合は null を返す。
 */
export function generateSTLFromObjects(
  objects: THREE.Object3D[],
): ArrayBuffer | null {
  rootGroup.updateMatrixWorld(true);
  const geometries: THREE.BufferGeometry[] = [];

  for (const obj of objects) {
    obj.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geom = child.geometry.clone();
      geom.applyMatrix4(child.matrixWorld);
      geom.deleteAttribute("uv");
      geometries.push(geom);
    });
  }

  if (geometries.length === 0) {
    return null;
  }

  const merged = mergeGeometries(geometries);
  if (!merged) {
    for (const g of geometries) {
      g.dispose();
    }
    throw new Error("ジオメトリのマージに失敗しました。");
  }

  const welded = mergeVertices(merged, 1e-4);
  welded.computeVertexNormals();
  for (const g of geometries) {
    g.dispose();
  }
  merged.dispose();

  const exporter = new STLExporter();
  const exportMesh = new THREE.Mesh(welded);
  const result = exporter.parse(exportMesh, { binary: true });
  welded.dispose();

  if (result instanceof DataView) {
    return result.buffer.slice(
      result.byteOffset,
      result.byteOffset + result.byteLength,
    );
  }
  return result as unknown as ArrayBuffer;
}

function formatDateTime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}${month}${day}_${hours}${mins}${secs}`;
}

export function getExportBaseName(): string {
  let label = "model";
  if (state.mode === "text") {
    const clean = state.text
      .trim()
      .replace(/[\r\n]+/g, "-")
      .replace(/[\\/:*?"<>|]/g, "_")
      .slice(0, 30);
    if (clean) label = clean;
  } else if (state.mode === "svg") {
    label = "svg";
  }
  const dateStr = formatDateTime();
  return `xtrudy-${label}-${dateStr}`;
}

/**
 * STL / ZIP エクスポートの実行
 * @param exportBtn UIのボタン要素（ローディング表示用）
 * @param mode "single" (単一STL) または "multi" (2色パーツ別ZIP)
 */
export async function exportSTL(
  exportBtn: HTMLButtonElement | null,
  mode: ExportMode = "single",
): Promise<void> {
  if (!exportBtn) return;
  const originalHTML = exportBtn.innerHTML;
  exportBtn.disabled = true;

  const btnText = exportBtn.querySelector<HTMLElement>(".btn-text");
  if (btnText) {
    btnText.textContent = "生成中...";
  } else {
    exportBtn.textContent = "生成中...";
  }

  // UI 更新を描画させるため少し待機
  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    const baseName = getExportBaseName();

    if (mode === "single") {
      // 1. 全パーツを1つの STL として出力
      const buffer = generateSTLFromObjects([rootGroup]);
      if (!buffer) {
        alert("エクスポートするメッシュがありません。");
        return;
      }
      const blob = new Blob([buffer], {
        type: "application/octet-stream",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${baseName}.stl`;
      link.click();
      URL.revokeObjectURL(link.href);
    } else {
      // 2. 2色用マルチパーツ (文字/SVG + 土台/リング) を ZIP で出力
      const mainBuffer = generateSTLFromObjects([groupMain]);
      const baseBuffer = generateSTLFromObjects([groupBase, groupRing]);

      if (!mainBuffer && !baseBuffer) {
        alert("エクスポートするメッシュがありません。");
        return;
      }

      const zip = new JSZip();
      if (mainBuffer) {
        zip.file("part_main.stl", mainBuffer);
      }
      if (baseBuffer) {
        zip.file("part_base.stl", baseBuffer);
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${baseName}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  } catch (err: unknown) {
    console.error("Export error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    alert(`エクスポートに失敗しました: ${msg}`);
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = originalHTML;
  }
}
