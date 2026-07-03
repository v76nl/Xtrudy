import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader';
import { Clipper, Paths64, FillRule } from 'clipper2-js';
import { state } from './state.ts';
import { groupMain, groupBase, groupRing, materialMain, materialBase, materialRing, rootGroup } from './scene.ts';
import { updateDimensionsInfo, showLoading } from './ui.ts';
import { flipYCorrectly, parseCommandsToRawShapes, threeShapeToPath64, shiftPaths64, paths64ToThreeShapes, createRoundedRectPaths64, CLIPPER_SCALE, commandsToShapes, rawShapesFallback } from './utils.ts';

// フォントキー -> CDN上�E woff ファイル URL
export const FONT_URLS = {
    'sans':  'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5/files/noto-sans-jp-japanese-700-normal.woff',
    'serif': 'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-jp@5/files/noto-serif-jp-japanese-700-normal.woff',
    'dot':   'https://cdn.jsdelivr.net/npm/@fontsource/dotgothic16@5/files/dotgothic16-japanese-400-normal.woff',
    'ramp':  'https://cdn.jsdelivr.net/npm/@fontsource/rampart-one@5/files/rampart-one-japanese-400-normal.woff'
};
export let currentFont = null;
export function loadFont(key) {
    const url = FONT_URLS[key];
    if (!url) return;
    showLoading(true);
    opentype.load(url, (err, font) => {
        if (err) { console.error(err); showLoading(false); }
        else { currentFont = font; updateGeometry(); showLoading(false); }
    });
}

export function updateGeometry() {
    requestAnimationFrame(_generate);
}

export function _generate() {
    clearGroup(groupMain);
    clearGroup(groupBase);
    clearGroup(groupRing);

    let mainBox = new THREE.Box3();

    if (state.mode === 'text' && currentFont) {
        // generateTextAndBase の中で土台も一括生�Eするため、外�Eの generateBase は呼ばなぁE
        generateTextAndBase(mainBox);
    } else if (state.mode === 'svg' && state.svgContent) {
        generateSVG(mainBox);
        if (state.baseEnabled && !mainBox.isEmpty()) {
            generateBase(mainBox); // SVG モード�E引き続き従来の土台生�E
        }
    }

    if (state.baseEnabled) {
         const width = (mainBox.max.x - mainBox.min.x) + (state.basePadding * 2);
         const height = (mainBox.max.y - mainBox.min.y) + (state.basePadding * 2);
         const midY = (mainBox.max.y + mainBox.min.y) / 2;
         const baseTopY = midY + height/2;
         
         if (state.ringEnabled) {
                 if (state.ringAutoY) {
                 const outerRadius = state.ringSize + state.ringTube;
                 const overlap = state.ringTube * 1.5;
                 state.ringY = Math.round((baseTopY + outerRadius - overlap) * 10) / 10;
                 
                 const sliderY = document.getElementById('ring-y');
                 if (sliderY) {
                    sliderY.value = state.ringY;
                    sliderY.disabled = true;
                    sliderY.style.opacity = '0.5';
                 }
                 const valY = document.getElementById('val-ring-y');
                 if (valY) {
                    valY.value = state.ringY;
                    valY.disabled = true;
                    valY.style.opacity = '0.5';
                 }
              } else {
                 const sliderY = document.getElementById('ring-y');
                 if (sliderY) {
                    sliderY.disabled = false;
                    sliderY.style.opacity = '1';
                 }
                 const valY = document.getElementById('val-ring-y');
                 if (valY) {
                    valY.disabled = false;
                    valY.style.opacity = '1';
                 }
             }
             generateRing();
             if (parseInt(state.ringShape) === 32 && state.ringReinforce) {
                 generateRingReinforcement(baseTopY);
             }
         }
    } else {
        if (state.ringEnabled) {
            if (state.ringAutoY && !mainBox.isEmpty()) {
                const outerRadius = state.ringSize + state.ringTube;
                const overlap = state.ringTube * 1.5;
                state.ringY = Math.round((mainBox.max.y + outerRadius - overlap) * 10) / 10;
                
                const sliderY = document.getElementById('ring-y');
                if (sliderY) {
                    sliderY.value = state.ringY;
                    sliderY.disabled = true;
                    sliderY.style.opacity = '0.5';
                }
                const valY = document.getElementById('val-ring-y');
                if (valY) {
                    valY.value = state.ringY;
                    valY.disabled = true;
                    valY.style.opacity = '0.5';
                }
            }
            generateRing();
            if (parseInt(state.ringShape) === 32 && state.ringReinforce) {
                const connY = !mainBox.isEmpty() ? mainBox.max.y : (state.ringY - (state.ringSize + state.ringTube));
                generateRingReinforcement(connY);
            }
        }
    }
    // ハンコ用左右反転: groupMain の X スケールで鏡像化
    groupMain.scale.x = state.mirrorX ? -1 : 1;

    updateDimensionsInfo();
}

export function clearGroup(group) {
    while(group.children.length > 0){ 
        const obj = group.children[0];
        if(obj.geometry) obj.geometry.dispose();
        group.remove(obj); 
    }
}
// チE��ストモード用: 斁E��と土台を一括生�Eする、E
//
// 設計方釁E(Embed アプローチE:
//   斁E��柱: XY=斁E��輪郭, z=-EMBED 、E+modelThickness  (EMBED=0.1mm 土台に食い込む)
//   土台プレーチE XY=土台輪郭(穴なしソリチE��), z=-baseThickness 、E0
//   ↁE斁E��が土台に 0.1mm 埋め込まれることで coincident face を回避、E
//   ↁEideamaker の "Merge Internal Overlapping Parts" が�Eリューム重褁E�� Union する、E
export function generateTextAndBase(targetBox) {
    if (!state.text) return;
    const size = state.textSize;
    const spacing = state.textSpacing;
    const chars = Array.from(state.text);

    // 1. 全斁E���EサブパスめEX オフセチE��付きで Clipper Path64 に変換して収集
    const allRawPaths = new Paths64();
    let cursorX = 0;

    chars.forEach((char) => {
        const fontPath = currentFont.getPath(char, 0, 0, size);
        parseCommandsToRawShapes(fontPath.commands).forEach(shape => {
            const p64 = threeShapeToPath64(shape, 12, cursorX, 0);
            if (p64.length >= 3) allRawPaths.push(p64);
        });
        cursorX += currentFont.getAdvanceWidth(char, size) + spacing;
    });

    if (allRawPaths.length === 0) return;

    // 2. 全斁E��を一括 Union
    let unified;
    try {
        unified = Clipper.Union(allRawPaths, undefined, FillRule.NonZero);
    } catch (e) {
        console.warn('Clipper Union failed:', e);
        return;
    }
    if (!unified || unified.length === 0) return;

    // 3. Clipper 空間で bbox を計算して中忁E��求めめE
    let clipMinX = Infinity, clipMaxX = -Infinity, clipMinY = Infinity, clipMaxY = -Infinity;
    unified.forEach(path => path.forEach(pt => {
        if (pt.x < clipMinX) clipMinX = pt.x; if (pt.x > clipMaxX) clipMaxX = pt.x;
        if (pt.y < clipMinY) clipMinY = pt.y; if (pt.y > clipMaxY) clipMaxY = pt.y;
    }));
    const fontMidX = Math.round((clipMinX + clipMaxX) / 2);
    const fontMidY = Math.round((clipMinY + clipMaxY) / 2);

    // 4. 中忁E��称にシフトした斁E��パスを作�E
    const centeredTextPaths = shiftPaths64(unified, -fontMidX, -fontMidY);

    // 5. 斁E��シェイプを THREE.Shape[] に変換して押し�EぁE
    const textShapes = paths64ToThreeShapes(centeredTextPaths);
    if (textShapes.length === 0) return;

    if (state.baseEnabled) {
        // 6a. 「文字柱、E z=TINY_GAP 、E+modelThickness、E
        //     土台上面 (z=0) と斁E��底面の coincident face を回避するため
        //     1μm だけ上にオフセチE��する。層厚以下なので印刷に影響なし、E
        const TINY_GAP = 0.001;
        const textGeom = new THREE.ExtrudeGeometry(textShapes, {
            depth: state.modelThickness,
            bevelEnabled: false
        });
        flipYCorrectly(textGeom);
        textGeom.translate(0, 0, TINY_GAP); // 1μm 浮かせめE

        const textMesh = new THREE.Mesh(textGeom, materialMain);
        textMesh.castShadow = true;
        textMesh.receiveShadow = true;
        groupMain.add(textMesh);

        // 6b. 「土台プレート、E 穴なしソリチE��、E
        //     斁E��との共有面はエクスポ�Eト時に CSG Union で自動解沈、E
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
                bevelEnabled: false
            });
            flipYCorrectly(baseGeom);
            baseGeom.translate(0, 0, -state.baseThickness);

            const baseMesh = new THREE.Mesh(baseGeom, materialBase);
            baseMesh.castShadow = true;
            baseMesh.receiveShadow = true;
            groupBase.add(baseMesh);
        }

        // targetBox: XY = チE��スト視覚篁E��のみ�E�リング自動�E置の基準に使用�E�E
        // ※ 土台のバウンチE��ングボックスは含めなぁE��Egenerate() で basePadding を加算するため二重加算になる！E
        targetBox.setFromObject(groupMain);
    } else {
        // 6c. 土台なぁE 斁E���Eみ�E�従来通り�E�E
        const textGeom = new THREE.ExtrudeGeometry(textShapes, {
            depth: state.modelThickness,
            bevelEnabled: false
        });
        flipYCorrectly(textGeom);

        const textMesh = new THREE.Mesh(textGeom, materialMain);
        textMesh.castShadow = true;
        textMesh.receiveShadow = true;
        groupMain.add(textMesh);

        targetBox.setFromObject(groupMain);
    }
}

export function generateSVG(targetBox) {
    const loader = new SVGLoader();
    const svgData = loader.parse(state.svgContent);
    const shapes = [];
    svgData.paths.forEach((path) => shapes.push(...path.toShapes(true)));

    const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: state.modelThickness,
        bevelEnabled: false
    });

    flipYCorrectly(geometry, state.svgScale, -state.svgScale, 1);
    geometry.computeBoundingBox();

    const midX = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2;
    const midY = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;
    geometry.translate(-midX, -midY, 0);

    const mesh = new THREE.Mesh(geometry, materialMain);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    groupMain.add(mesh);
    targetBox.copy(geometry.boundingBox);
}

export function generateBase(targetBox) {
    const width = (targetBox.max.x - targetBox.min.x) + (state.basePadding * 2);
    const height = (targetBox.max.y - targetBox.min.y) + (state.basePadding * 2);
    const radius = state.baseRadius;

    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;

    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: state.baseThickness,
        bevelEnabled: false
    });

    const mesh = new THREE.Mesh(geometry, materialBase);
    // B桁E 土台めEz=-baseThickness、E に配置することで斁E��！E=0〜modelThickness�E�と
    // Z 方向�E重褁E��解消し、�E部面�E�Eon-manifold の原因�E�をなくす。背面はフラチE��に保たれる、E
    mesh.position.z = -state.baseThickness;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    groupBase.add(mesh);
}

export function generateRing() {
    const segs = parseInt(state.ringShape);
    let geometry;

    if (segs === 32) {
        // 真�E: アニュラス(外�E-冁E�E)の Shape めEZ 方向に押し�Eした中空冁E��
        const outerR = state.ringSize + state.ringTube;
        const innerR = Math.max(0.1, state.ringSize - state.ringTube);
        const cylHeight = state.ringTube * 2;

        const shape = new THREE.Shape();
        shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
        shape.holes.push(hole);

        geometry = new THREE.ExtrudeGeometry(shape, {
            depth: cylHeight,
            bevelEnabled: false,
            curveSegments: 32
        });
        geometry.translate(0, 0, -cylHeight / 2); // Z方向�E中忁E��原点に揁E��めE
    } else {
        // そ�E他�E形状: ト�Eラス
        geometry = new THREE.TorusGeometry(state.ringSize, state.ringTube, 16, segs);
    }

    const mesh = new THREE.Mesh(geometry, materialRing);
    // B案�E置: 土台は z=-baseThickness、E なので中忁E�E -baseThickness/2
    const ringZ = state.baseEnabled ? (-state.baseThickness / 2) : (state.modelThickness / 2);
    mesh.position.set(state.ringX, state.ringY, ringZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    let baseRotation = (state.ringRot * Math.PI) / 180;
    if (segs === 3) baseRotation += (Math.PI / 6); // 正三角形を頂点が上になるよぁE��正
    mesh.rotation.z = baseRotation;
    groupRing.add(mesh);
}

// 中空冁E��リングとベ�Eス板を繋ぐ補強板を生成する、E
// 形状: リング外周の下弧と、�Eース板上辺(冁E�E投影線�E)を結んだ2D Shape を押し�Eす、E
// ケースA: ベ�Eス上辺が外周冁E��交わる場吁E-> 弓形の断面
// ケースB: ベ�Eス上辺が�Eの下にある場吁E  -> U字をつぶしたような断面
export function generateRingReinforcement(baseTopY) {
    const outerR = state.ringSize + state.ringTube;
    const cylHeight = state.ringTube * 2;
    // B案�E置: 土台は z=-baseThickness、E なので中忁E�E -baseThickness/2
    const ringZ = state.baseEnabled ? (-state.baseThickness / 2) : (state.modelThickness / 2);

    // リング中忁E��原点とした相対 Y 座樁E(負値になる�EぁE
    const localBaseY = baseTopY - state.ringY;
    if (localBaseY >= 0) return; // ベ�Eスがリング中忁E��上�E位置なら補強不要E

    const shape = new THREE.Shape();

    if (localBaseY > -outerR) {
        // ケースA: ベ�Eス上辺が外周冁E��交差する
        const hw = Math.sqrt(outerR * outerR - localBaseY * localBaseY);
        const theta1 = Math.atan2(localBaseY, -hw);        // 左交点の角度
        let theta2   = Math.atan2(localBaseY,  hw);         // 右交点の角度
        if (theta2 < 0) theta2 += 2 * Math.PI;             // [0, 2pi] に正規化

        shape.moveTo(hw, localBaseY);                       // 右交点から開姁E
        shape.lineTo(-hw, localBaseY);                      // ベ�Eス上辺の線�E (右->左)
        shape.absarc(0, 0, outerR, theta1, theta2, false); // CCW弧: 左->右 (下�Eを経由)
    } else {
        // ケースB: ベ�Eス上辺が�E全体より下にある
        shape.moveTo( outerR, localBaseY);                  // 右丁E
        shape.lineTo(-outerR, localBaseY);                  // ベ�Eス上辺の線�E (右->左)
        shape.lineTo(-outerR, 0);                           // 左壁を上へ
        shape.absarc(0, 0, outerR, Math.PI, 2 * Math.PI, false); // CCW弧: 左->庁E>右
        // 右端 (outerR, 0) から (outerR, localBaseY) は closePath で自動補宁E
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: cylHeight,
        bevelEnabled: false,
        curveSegments: 32
    });
    geometry.translate(0, 0, -cylHeight / 2);

    const mesh = new THREE.Mesh(geometry, materialRing);
    mesh.position.set(state.ringX, state.ringY, ringZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    groupRing.add(mesh);
}
