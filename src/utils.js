import * as THREE from 'three';
import { Clipper, Paths64, FillRule } from 'clipper2-js';

// スケールで Y 反転しつつ法線を正しく保つ。
// Three.js の ExtrudeGeometry は opentype / SVG の Y軸と向きが逆になるため、
// scaleY=-1 を使って上下を反転する。負のスケールは面の裏表を逆にするので
// 頂点インデックスの順番を入れ替えて法線の向きを戻す。
export function flipYCorrectly(geometry, scaleX = 1, scaleY = -1, scaleZ = 1) {
    geometry.scale(scaleX, scaleY, scaleZ);

    if (scaleX * scaleY * scaleZ < 0) {
        const index = geometry.index;
        if (index) {
            // インデックス付きジオメトリ
            const array = index.array;
            for (let i = 0; i < array.length; i += 3) {
                const temp = array[i];
                array[i] = array[i + 2];
                array[i + 2] = temp;
            }
        } else {
            // 非インデックスジオメトリ (ExtrudeGeometry のデフォルト)
            const pos = geometry.attributes.position;
            const array = pos.array;
            for (let i = 0; i < array.length; i += 9) {
                for (let j = 0; j < 3; j++) {
                    const temp = array[i + j];
                    array[i + j] = array[i + 6 + j];
                    array[i + 6 + j] = temp;
                }
            }
            if (geometry.attributes.uv) {
                const uv = geometry.attributes.uv.array;
                for (let i = 0; i < uv.length; i += 6) {
                    for (let j = 0; j < 2; j++) {
                        const temp = uv[i + j];
                        uv[i + j] = uv[i + 4 + j];
                        uv[i + 4 + j] = temp;
                    }
                }
            }
        }
        geometry.computeVertexNormals();
    }
}

// Clipper2 ユーティリティ
// clipper2-js は整数座標で動作するため、浮動小数点座標を整数にスケールして渡す
export const CLIPPER_SCALE = 1e6;

// THREE.Shape の点列を Clipper 用の整数座標 Path64 に変換する。
// offsetX / offsetY を指定すると座標をシフトしてから変換する（文字カーソル位置の適用に使用）。
export function threeShapeToPath64(shape, curveSegments = 12, offsetX = 0, offsetY = 0) {
    const pts = shape.getPoints(curveSegments);
    return pts.map(p => ({
        x: Math.round((p.x + offsetX) * CLIPPER_SCALE),
        y: Math.round((p.y + offsetY) * CLIPPER_SCALE)
    }));
}

// Clipper の Paths64 結果を THREE.Shape[] に変換する。
// NonZero Union 後のリングを面積の符号でソリッド/ホールに振り分ける。
// 複数文字を一括 Union した場合の複数ソリッド・複数ホールにも対応するため、
// 各ホールをその bbox 重心を内包する最小のソリッドに割り当てる。
export function paths64ToThreeShapes(paths64) {
    if (!paths64 || paths64.length === 0) return [];

    const shapeItems = paths64.map(path => {
        if (path.length < 3) return null;
        const pts = path.map(p => new THREE.Vector2(
            p.x / CLIPPER_SCALE,
            p.y / CLIPPER_SCALE
        ));
        const s = new THREE.Shape(pts);
        const area = THREE.ShapeUtils.area(pts);
        // bbox を計算してホール割り当てに使用する
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });
        return { shape: s, area, absArea: Math.abs(area), pts, minX, maxX, minY, maxY };
    }).filter(Boolean);

    if (shapeItems.length === 0) return [];

    shapeItems.sort((a, b) => b.absArea - a.absArea);

    const primarySign = Math.sign(shapeItems[0].area);
    const solids = shapeItems.filter(item => Math.sign(item.area) === primarySign);
    const holes  = shapeItems.filter(item => Math.sign(item.area) !== primarySign);

    // 各ホールを、その bbox 重心を含む最小面積のソリッドに割り当てる。
    // Clipper Union の結果は各ホールが必ず 1 つのソリッド内に収まるため bbox で十分。
    holes.forEach(hole => {
        const cx = (hole.minX + hole.maxX) / 2;
        const cy = (hole.minY + hole.maxY) / 2;
        let best = null;
        solids.forEach(solid => {
            if (cx >= solid.minX && cx <= solid.maxX && cy >= solid.minY && cy <= solid.maxY) {
                if (!best || solid.absArea < best.absArea) best = solid;
            }
        });
        (best ?? solids[0]).shape.holes.push(hole.shape);
    });

    return solids.map(item => item.shape);
}

// opentype のコマンド列を THREE.Shape の配列として返す（Clipper Union なし）。
// 複数文字を一括 Union するために commandsToShapes から分離したヘルパー。
export function parseCommandsToRawShapes(commands) {
    const shapes = [];
    let currentShape = new THREE.Shape();
    commands.forEach(cmd => {
        switch(cmd.type) {
            case 'M':
                if (currentShape.curves.length > 0) shapes.push(currentShape);
                currentShape = new THREE.Shape();
                currentShape.moveTo(cmd.x, cmd.y);
                break;
            case 'L': currentShape.lineTo(cmd.x, cmd.y); break;
            case 'Q': currentShape.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y); break;
            case 'C': currentShape.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y); break;
            case 'Z': currentShape.closePath(); break;
        }
    });
    if (currentShape.curves.length > 0) shapes.push(currentShape);
    return shapes;
}

// opentype のコマンド列を clipper2-js で Boolean Union し、自己交差のないクリーンな
// THREE.Shape[] を返す。Union することで 'X' のような交差フォントパスでも
// スライサーが非多様体エラーを起こさない STL を生成できる。
export function commandsToShapes(commands) {
    // M コマンドごとに subpath に分割して THREE.Shape の点列を作る
    const rawShapes = [];
    let currentShape = new THREE.Shape();

    commands.forEach(cmd => {
        switch(cmd.type) {
            case 'M':
                if (currentShape.curves.length > 0) rawShapes.push(currentShape);
                currentShape = new THREE.Shape();
                currentShape.moveTo(cmd.x, cmd.y);
                break;
            case 'L':
                currentShape.lineTo(cmd.x, cmd.y);
                break;
            case 'Q':
                currentShape.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                break;
            case 'C':
                currentShape.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                break;
            case 'Z':
                currentShape.closePath();
                break;
        }
    });
    if (currentShape.curves.length > 0) rawShapes.push(currentShape);
    if (rawShapes.length === 0) return [];

    // 各 subpath を Clipper の Path64 に変換
    const paths = new Paths64();
    rawShapes.forEach(shape => {
        const path64 = threeShapeToPath64(shape, 12);
        if (path64.length >= 3) paths.push(path64);
    });

    if (paths.length === 0) return [];

    // Clipper Union で自己交差を解消 (NonZero ルール)
    let unified;
    try {
        unified = Clipper.Union(paths, undefined, FillRule.NonZero);
    } catch (e) {
        console.warn('Clipper Union failed, falling back to raw shapes:', e);
        return rawShapesFallback(commands);
    }

    if (!unified || unified.length === 0) return [];

    return paths64ToThreeShapes(unified);
}

// Clipper Union が失敗した場合のフォールバック。面積の符号でホールを判別し
// THREE.Shape[] を返す (Union なしなので自己交差パスは残ることがある)。
export function rawShapesFallback(commands) {
    const shapes = [];
    let currentShape = new THREE.Shape();

    commands.forEach(cmd => {
        switch(cmd.type) {
            case 'M':
                if (currentShape.curves.length > 0) shapes.push(currentShape);
                currentShape = new THREE.Shape();
                currentShape.moveTo(cmd.x, cmd.y);
                break;
            case 'L': currentShape.lineTo(cmd.x, cmd.y); break;
            case 'Q': currentShape.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y); break;
            case 'C': currentShape.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y); break;
            case 'Z': currentShape.closePath(); break;
        }
    });
    if (currentShape.curves.length > 0) shapes.push(currentShape);

    const shapesWithArea = shapes.map(s => {
        const area = THREE.ShapeUtils.area(s.getPoints());
        return { shape: s, area, absArea: Math.abs(area) };
    });
    shapesWithArea.sort((a, b) => b.absArea - a.absArea);
    const finalSolids = [];
    if (shapesWithArea.length === 0) return [];
    const primarySign = Math.sign(shapesWithArea[0].area);
    shapesWithArea.forEach(item => {
        if (Math.sign(item.area) === primarySign) {
            finalSolids.push(item.shape);
        } else {
            if (finalSolids.length > 0) finalSolids[0].holes.push(item.shape);
        }
    });
    return finalSolids;
}
// Clipper Paths64 の全頂点に整数シフトを適用した新しい Paths64 を返す。
export function shiftPaths64(paths, dx, dy) {
    const result = new Paths64();
    paths.forEach(path => {
        result.push(path.map(pt => ({ x: pt.x + Math.round(dx), y: pt.y + Math.round(dy) })));
    });
    return result;
}

// 中央対称の角丸矩形 Path64 を Clipper 座標系（フォント Y-up 空間）で生成する。
export function createRoundedRectPaths64(halfW, halfH, radius) {
    const r = Math.min(radius, halfW, halfH);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW + r, -halfH);
    shape.lineTo( halfW - r, -halfH);
    shape.quadraticCurveTo( halfW, -halfH,  halfW, -halfH + r);
    shape.lineTo( halfW,  halfH - r);
    shape.quadraticCurveTo( halfW,  halfH,  halfW - r,  halfH);
    shape.lineTo(-halfW + r,  halfH);
    shape.quadraticCurveTo(-halfW,  halfH, -halfW,  halfH - r);
    shape.lineTo(-halfW, -halfH + r);
    shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
    const paths = new Paths64();
    const p64 = threeShapeToPath64(shape, 16);
    if (p64.length >= 3) paths.push(p64);
    return paths;
}
