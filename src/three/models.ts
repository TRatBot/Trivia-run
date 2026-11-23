import * as THREE from 'three';
import { CharacterDef, MonsterDef, ObstacleKind } from '../game/types';
import { ProceduralTexturePack } from './textures';

export interface AnimatedRunnerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  spinAccessory: THREE.Object3D | null;
  shadowDisc: THREE.Mesh;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  updateAnimation: (params: {
    dt: number;
    time: number;
    speed: number;
    stridePhase: number;
    y: number;
    grounded: boolean;
    hitFlash: boolean;
    squashX: number;
    squashY: number;
    celebrating: boolean;
    idleMode: boolean;
    lockedPose: boolean;
    previewJumpProgress?: number;
  }) => void;
}

export interface AnimatedMonsterRig {
  root: THREE.Group;
  body: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  update: (time: number, mood: 'idle' | 'asking' | 'happy' | 'grumpy') => void;
}

const adultFaceTextureCache = new Map<string, THREE.CanvasTexture>();
const fabricTextureCache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();
let sharedHairBumpTex: THREE.CanvasTexture | null = null;

function getSharedHairBumpTexture(): THREE.CanvasTexture {
  if (sharedHairBumpTex) return sharedHairBumpTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 2) {
    const shade = 95 + Math.floor(Math.sin(x * 0.75) * 32 + Math.cos(x * 1.9) * 24);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, 0, 2, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  sharedHairBumpTex = tex;
  return tex;
}

function getFabricTextures(
  key: string,
  baseHex: string,
  shadowHex: string,
  highlightHex: string,
  seamHex: string,
): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const cached = fabricTextureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = size;
  mapCanvas.height = size;
  const ctx = mapCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  // Base cloth tone with subtle top-to-bottom ambient occlusion
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, highlightHex);
  grad.addColorStop(0.45, baseHex);
  grad.addColorStop(1, shadowHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Subtle fine diagonal twill fabric grain (smooth tactical cloth, never plaid or checkered)
  for (let i = 0; i < 640; i++) {
    const px = (i * 53) % size;
    const py = (i * 97) % size;
    const isLight = i % 2 === 0;
    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.024)' : 'rgba(0,0,0,0.032)';
    ctx.fillRect(px, py, 3, 2);
    bctx.fillStyle = isLight ? '#878787' : '#797979';
    bctx.fillRect(px, py, 3, 2);
  }

  // Subtle vertical tailored seam shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  bctx.strokeStyle = '#626262';
  bctx.lineWidth = 3;
  for (const sx of [size * 0.5]) {
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, size);
    ctx.stroke();

    bctx.beginPath();
    bctx.moveTo(sx, 0);
    bctx.lineTo(sx, size);
    bctx.stroke();
  }

  // Soft natural garment drapery & tension fold shadows
  for (let i = 0; i < 5; i++) {
    const y0 = 42 + i * 42;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.085)' : 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(size * 0.5, y0 + (i % 2 === 0 ? 14 : -12), size, y0 + 5);
    ctx.stroke();

    bctx.strokeStyle = i % 2 === 0 ? '#6c6c6c' : '#949494';
    bctx.lineWidth = 7;
    bctx.beginPath();
    bctx.moveTo(0, y0);
    bctx.quadraticCurveTo(size * 0.5, y0 + (i % 2 === 0 ? 14 : -12), size, y0 + 5);
    bctx.stroke();
  }

  // Subtle solid accent piping tint near bottom edge
  ctx.fillStyle = seamHex;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(0, size - 6, size, 4);
  ctx.globalAlpha = 1.0;

  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  const res = { map, bump };
  fabricTextureCache.set(key, res);
  return res;
}

/**
 * Mature, realistic-stylized adult game character face texture (no oversized childish eyes or doll blush).
 * Mapped onto a vertex-sculpted adult head with u=0.5 centered on the nose bridge (+Z).
 */
function getAdultFaceTexture(
  charId: CharacterDef['id'],
  skinHex: string,
  eyeMainHex: string,
  eyeDeepHex: string,
  hairHex: string,
): THREE.CanvasTexture {
  const cached = adultFaceTextureCache.get(charId);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 512, 512);

  // Realistic sculptural skin shading: brow shadow, cheekbone highlight, jawline contour
  const browShade = ctx.createLinearGradient(0, 210, 0, 285);
  browShade.addColorStop(0, 'rgba(110, 68, 52, 0.22)');
  browShade.addColorStop(0.55, 'rgba(110, 68, 52, 0.0)');
  browShade.addColorStop(1, 'rgba(255, 240, 230, 0.08)');
  ctx.fillStyle = browShade;
  ctx.fillRect(170, 210, 172, 75);

  const jawShade = ctx.createRadialGradient(256, 265, 35, 256, 290, 145);
  jawShade.addColorStop(0, 'rgba(255, 244, 234, 0.14)');
  jawShade.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  jawShade.addColorStop(1, 'rgba(92, 54, 42, 0.28)');
  ctx.fillStyle = jawShade;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle cheekbone warmth (mature & athletic, never bright cartoon circles)
  for (const side of [-1, 1]) {
    const cx = 256 + side * 36;
    const cy = 286;
    const cheek = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
    cheek.addColorStop(0, 'rgba(196, 118, 102, 0.16)');
    cheek.addColorStop(1, 'rgba(196, 118, 102, 0)');
    ctx.fillStyle = cheek;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const isMale = charId === 'qiuyuan';
  const eyeY = 258;
  // Realistic adult eye proportions on equirectangular sphere (crisp, expressive almond eyes)
  const eyeRx = isMale ? 12.5 : 13.5;
  const eyeRy = isMale ? 12.5 : 16.0;
  const eyeSpacing = 27;

  for (const side of [-1, 1]) {
    const cx = 256 + side * eyeSpacing;

    // Phrolova's crisp diagonal tactical white eyepatch across her right eye
    if (charId === 'phrolova' && side === -1) {
      ctx.save();
      ctx.strokeStyle = '#eef2f6';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(155, 212);
      ctx.lineTo(254, 282);
      ctx.stroke();

      ctx.translate(cx - 1, eyeY + 1);
      ctx.rotate(0.16);
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 21, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      continue;
    }

    // Defined sculpted brow
    ctx.save();
    ctx.strokeStyle = hairHex;
    ctx.lineWidth = isMale ? 5.2 : 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - side * 12, eyeY - eyeRy - 10);
    ctx.quadraticCurveTo(cx + side * 2, eyeY - eyeRy - 15, cx + side * 13, eyeY - eyeRy - 8);
    ctx.stroke();
    ctx.restore();

    // Almond eye socket shadow
    ctx.fillStyle = 'rgba(85, 52, 44, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY - 2, eyeRx + 3, eyeRy + 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sclera & realistic focused iris
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f5f7';
    ctx.fill();
    ctx.clip();

    const irisR = eyeRx * 0.62;
    const irisRy = eyeRy * 0.78;
    const irisGrad = ctx.createLinearGradient(cx, eyeY - irisRy, cx, eyeY + irisRy);
    irisGrad.addColorStop(0, eyeDeepHex);
    irisGrad.addColorStop(0.55, eyeMainHex);
    irisGrad.addColorStop(1, '#e8eef5');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 1, irisR, irisRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#141118';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 1, irisR * 0.5, irisRy * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp subtle specular glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx + 2.5, eyeY - 3.5, 2.0, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sharp upper eyelid crease
    ctx.strokeStyle = '#1d161a';
    ctx.lineWidth = isMale ? 3.8 : 4.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - side * (eyeRx + 1), eyeY - eyeRy * 0.2);
    ctx.quadraticCurveTo(cx, eyeY - eyeRy - 3, cx + side * (eyeRx + 2.5), eyeY - eyeRy * 0.1);
    ctx.stroke();
  }

  // Sculpted nose bridge & nostril shading
  ctx.fillStyle = 'rgba(130, 82, 68, 0.34)';
  ctx.beginPath();
  ctx.moveTo(254, 260);
  ctx.lineTo(259, 260);
  ctx.lineTo(261, 300);
  ctx.lineTo(252, 300);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 245, 238, 0.32)';
  ctx.fillRect(255, 262, 2.5, 32);

  // Mature poised lips (subtle natural lip tone + defined crease)
  ctx.save();
  ctx.fillStyle = isMale ? 'rgba(155, 96, 86, 0.45)' : 'rgba(182, 92, 96, 0.55)';
  ctx.beginPath();
  ctx.ellipse(256, 326, 10, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isMale ? '#73453f' : '#8f4348';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(246, 326);
  ctx.quadraticCurveTo(256, charId === 'iuno' ? 329 : 327, 266, 325);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  adultFaceTextureCache.set(charId, tex);
  return tex;
}

/**
 * Helper: builds a smoothly tapered curved 3D hair lock along a 3D CatmullRom path.
 */
function buildCurvedHairLock(
  points: [number, number, number][],
  baseRadius: number,
  tipScale: number,
  material: THREE.Material,
  radialSegments = 7,
  tubularSegments = 12,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geom = new THREE.TubeGeometry(curve, tubularSegments, baseRadius, radialSegments, false);
  const pos = geom.attributes.position;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  const ringVerts = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, center);
    // Swell slightly near crown, taper cleanly to a sleek sharp point at tip
    const radiusFactor =
      t < 0.2
        ? 0.85 + t * 0.75
        : Math.max(tipScale, 1.0 - Math.pow((t - 0.2) / 0.8, 1.35) * (1.0 - tipScale));
    for (let j = 0; j < ringVerts; j++) {
      const idx = i * ringVerts + j;
      v.fromBufferAttribute(pos, idx).sub(center);
      // Slightly flatten strands for realistic layered ribbon hair volume
      v.x *= radiusFactor * 1.18;
      v.y *= radiusFactor;
      v.z *= radiusFactor * 0.78;
      v.add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Builds 6 professional, Temple-Run-grade articulated 3D adult athletic runners for
 * Chisa, Galbrena, Augusta, Iuno, Phrolova, and Qiuyuan:
 * - True 7.4-head adult athletic proportions (compact sculpted head, V-taper torso, long powerful legs)
 * - Full multi-joint skeleton: pelvis + counter-rotating spine/chest + shoulders/elbows/fists + hips/knees/ankles
 * - Procedural PBR woven cloth & oiled leather textures with seam creases, back harnesses, buckles & lugged boot soles
 * - Smooth sculpted TubeGeometry curved hair locks (zero spiky geometric cones)
 * - Fluid Temple-Run sprint cycle with deep 105° knee recovery kick, 95° pumping elbows, parkour jump & Victory Dance!
 */
export function buildRunnerRig(
  charDef: CharacterDef,
  textures: ProceduralTexturePack,
): AnimatedRunnerRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const isMale = charDef.id === 'qiuyuan';
  const hairBump = getSharedHairBumpTexture();

  // Bespoke mature adventurer palettes preserving all 6 character identities
  const paletteMap: Record<
    CharacterDef['id'],
    {
      hair: number;
      hairHex: string;
      hairAccent: number;
      eyeMainHex: string;
      eyeDeepHex: string;
      topHex: string;
      topShadowHex: string;
      topHiHex: string;
      seamHex: string;
      pantsHex: string;
      pantsShadowHex: string;
      leather: number;
      metal: number;
      boot: number;
      skin: number;
      skinHex: string;
      accent: number;
    }
  > = {
    chisa: {
      hair: 0x181922,
      hairHex: '#181922',
      hairAccent: 0xc81e32,
      eyeMainHex: '#e11d48',
      eyeDeepHex: '#7f1d1d',
      topHex: '#252732',
      topShadowHex: '#15161d',
      topHiHex: '#353848',
      seamHex: '#d4d4dc',
      pantsHex: '#1c1d26',
      pantsShadowHex: '#111218',
      leather: 0x2a1a1d,
      metal: 0xd9a84e,
      boot: 0x18161a,
      skin: 0xf0d2c2,
      skinHex: '#f0d2c2',
      accent: 0xc81e32,
    },
    galbrena: {
      hair: 0xdce4f0,
      hairHex: '#8a98ac',
      hairAccent: 0x94a3b8,
      eyeMainHex: '#8b5cf6',
      eyeDeepHex: '#3b0764',
      topHex: '#1e429f',
      topShadowHex: '#132864',
      topHiHex: '#2e5cc4',
      seamHex: '#cbd5e1',
      pantsHex: '#1e212b',
      pantsShadowHex: '#12141a',
      leather: 0x1b1d24,
      metal: 0xcbd5e1,
      boot: 0x16181f,
      skin: 0xefd0c0,
      skinHex: '#efd0c0',
      accent: 0x3b82f6,
    },
    augusta: {
      hair: 0xd14217,
      hairHex: '#9c2d0d',
      hairAccent: 0xea6a26,
      eyeMainHex: '#ea580c',
      eyeDeepHex: '#7c2d12',
      topHex: '#e8e0cf',
      topShadowHex: '#bfb39b',
      topHiHex: '#f5efe2',
      seamHex: '#c89b3c',
      pantsHex: '#d8ceb8',
      pantsShadowHex: '#aa9d83',
      leather: 0x6b3f22,
      metal: 0xd9a838,
      boot: 0x5c361d,
      skin: 0xecc6ae,
      skinHex: '#ecc6ae',
      accent: 0xe59c2e,
    },
    iuno: {
      hair: 0x1b3d9c,
      hairHex: '#172e73',
      hairAccent: 0x38bdf8,
      eyeMainHex: '#38bdf8',
      eyeDeepHex: '#1e3a8a',
      topHex: '#edf1f7',
      topShadowHex: '#c4cede',
      topHiHex: '#ffffff',
      seamHex: '#d4a63c',
      pantsHex: '#1d3269',
      pantsShadowHex: '#122047',
      leather: 0x5a4224,
      metal: 0xe2b74c,
      boot: 0x1a2d5e,
      skin: 0xf1d4c6,
      skinHex: '#f1d4c6',
      accent: 0x2563eb,
    },
    phrolova: {
      hair: 0xb2c2b9,
      hairHex: '#63756c',
      hairAccent: 0x8fa397,
      eyeMainHex: '#e11d48',
      eyeDeepHex: '#881337',
      topHex: '#23191e',
      topShadowHex: '#140e11',
      topHiHex: '#35262d',
      seamHex: '#dc2626',
      pantsHex: '#26181c',
      pantsShadowHex: '#160d10',
      leather: 0x451218,
      metal: 0xd69f48,
      boot: 0x1b1215,
      skin: 0xf3d7cf,
      skinHex: '#f3d7cf',
      accent: 0xb91c1c,
    },
    qiuyuan: {
      hair: 0x182621,
      hairHex: '#182621',
      hairAccent: 0x10b981,
      eyeMainHex: '#10b981',
      eyeDeepHex: '#064e3b',
      topHex: '#293731',
      topShadowHex: '#19231f',
      topHiHex: '#3b4e46',
      seamHex: '#10b981',
      pantsHex: '#222b26',
      pantsShadowHex: '#141a17',
      leather: 0x5c3a21,
      metal: 0xd4a446,
      boot: 0x3b2415,
      skin: 0xe8c7b2,
      skinHex: '#e8c7b2',
      accent: 0x10b981,
    },
  };

  const p = paletteMap[charDef.id];

  const topTex = getFabricTextures(
    `${charDef.id}-top`,
    p.topHex,
    p.topShadowHex,
    p.topHiHex,
    p.seamHex,
  );
  const pantsTex = getFabricTextures(
    `${charDef.id}-pants`,
    p.pantsHex,
    p.pantsShadowHex,
    p.pantsHex,
    p.seamHex,
  );

  const skinMat = new THREE.MeshStandardMaterial({
    color: p.skin,
    roughness: 0.64,
    metalness: 0.02,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: getAdultFaceTexture(charDef.id, p.skinHex, p.eyeMainHex, p.eyeDeepHex, p.hairHex),
    roughness: 0.6,
    metalness: 0.02,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: topTex.map,
    bumpMap: topTex.bump,
    bumpScale: 0.018,
    roughness: 0.78,
    metalness: 0.04,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: pantsTex.map,
    bumpMap: pantsTex.bump,
    bumpScale: 0.016,
    roughness: 0.82,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: p.leather,
    bumpMap: topTex.bump,
    bumpScale: 0.012,
    roughness: 0.44,
    metalness: 0.14,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: p.boot,
    roughness: 0.46,
    metalness: 0.15,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x121010,
    roughness: 0.92,
    metalness: 0.02,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: p.metal,
    roughness: 0.24,
    metalness: 0.88,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: p.accent,
    roughness: 0.56,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const whiteClothMat = new THREE.MeshStandardMaterial({
    color: 0xf1ece3,
    bumpMap: topTex.bump,
    bumpScale: 0.012,
    roughness: 0.76,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: p.hair,
    bumpMap: hairBump,
    bumpScale: 0.014,
    roughness: 0.38,
    metalness: 0.16,
    side: THREE.DoubleSide,
  });
  const hairAccentMat = new THREE.MeshStandardMaterial({
    color: p.hairAccent,
    bumpMap: hairBump,
    bumpScale: 0.012,
    roughness: 0.36,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });

  const hitFlashMaterials = [topMat, pantsMat, leatherMat, hairMat, skinMat, faceMat];
  const flowingParts: { obj: THREE.Object3D; baseX: number; baseZ: number; phase: number; amp: number }[] = [];
  let spinAccessory: THREE.Object3D | null = null;

  // ── SKELETAL HIERARCHY ROOT: PELVIS AT y = 0.99 ──
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.99, 0);
  bodyPivot.add(pelvisGroup);

  // Sculpted athletic pelvis / glutes / hips (no flat pipe!)
  const pelvisPts = isMale
    ? [
        new THREE.Vector2(0.145, -0.1),
        new THREE.Vector2(0.162, -0.02),
        new THREE.Vector2(0.155, 0.07),
        new THREE.Vector2(0.142, 0.12),
      ]
    : [
        new THREE.Vector2(0.145, -0.1),
        new THREE.Vector2(0.168, -0.02),
        new THREE.Vector2(0.152, 0.07),
        new THREE.Vector2(0.124, 0.12),
      ];
  const pelvisMesh = new THREE.Mesh(new THREE.LatheGeometry(pelvisPts, 18), pantsMat);
  pelvisMesh.scale.set(1.06, 1, 0.78);
  pelvisMesh.castShadow = true;
  pelvisGroup.add(pelvisMesh);

  // Temple-Run tactical leather utility belt + metallic front/back buckles + side explorer pouch + diagonal holster strap!
  const beltRadius = isMale ? 0.156 : 0.14;
  const utilityBelt = new THREE.Mesh(
    new THREE.TorusGeometry(beltRadius, 0.024, 8, 22),
    leatherMat,
  );
  utilityBelt.rotation.x = Math.PI / 2;
  utilityBelt.scale.set(1.06, 0.8, 1);
  utilityBelt.position.y = 0.08;
  pelvisGroup.add(utilityBelt);

  // Diagonal low-slung explorer thigh belt (signature Temple Run silhouette detail from behind!)
  const diagBelt = new THREE.Mesh(
    new THREE.TorusGeometry(beltRadius * 1.04, 0.017, 6, 20),
    leatherMat,
  );
  diagBelt.rotation.set(Math.PI / 2 + 0.24, 0.14, 0.12);
  diagBelt.scale.set(1.06, 0.82, 1);
  diagBelt.position.set(0.01, 0.03, 0);
  pelvisGroup.add(diagBelt);

  // Belt buckle front + brass clip rear + side leather pouch
  const frontBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.048, 0.026), metalMat);
  frontBuckle.position.set(0, 0.08, beltRadius * 0.84);
  const sidePouch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.095, 0.075), leatherMat);
  sidePouch.position.set(beltRadius * 1.06, 0.03, -0.02);
  const pouchClasp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.022, 0.022), metalMat);
  pouchClasp.position.set(beltRadius * 1.07, 0.05, -0.02);
  pelvisGroup.add(frontBuckle, sidePouch, pouchClasp);

  // Character-specific tactical skirt / hip coat panels (open-front/split so thighs pump freely without clipping!)
  if (charDef.id === 'chisa' || charDef.id === 'augusta' || charDef.id === 'iuno' || charDef.id === 'phrolova') {
    const flapColorMat =
      charDef.id === 'phrolova'
        ? accentMat
        : charDef.id === 'augusta' || charDef.id === 'iuno'
          ? whiteClothMat
          : pantsMat;
    // Sculpted back & side pleated battle-skirt / coat-tails (animated with stride wind!)
    const backFlapGroup = new THREE.Group();
    backFlapGroup.position.set(0, 0.06, -0.12);
    const flapGeom = new THREE.CylinderGeometry(
      0.16,
      0.24,
      charDef.id === 'phrolova' ? 0.56 : 0.36,
      14,
      1,
      true,
      Math.PI * 0.52,
      Math.PI * 0.96,
    );
    const flapMesh = new THREE.Mesh(flapGeom, flapColorMat);
    flapMesh.position.y = charDef.id === 'phrolova' ? -0.28 : -0.18;
    flapMesh.position.z = 0.08;
    flapMesh.castShadow = true;
    backFlapGroup.add(flapMesh);

    // Trim border along hem matching the exact open cylinder arc of flapMesh (zero overhang!)
    const trimRing = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.238,
        0.244,
        0.026,
        14,
        1,
        true,
        Math.PI * 0.52,
        Math.PI * 0.96,
      ),
      charDef.id === 'chisa' ? whiteClothMat : metalMat,
    );
    trimRing.position.set(0, charDef.id === 'phrolova' ? -0.55 : -0.35, 0.08);
    backFlapGroup.add(trimRing);

    flowingParts.push({ obj: backFlapGroup, baseX: 0.14, baseZ: 0, phase: 0.4, amp: 0.18 });
    pelvisGroup.add(backFlapGroup);
  }

  // ── 1. MULTI-JOINTED ATHLETIC LEGS: HIP → THIGH → KNEE → CALF + BOOT → ANKLE → RUGGED FOOT ──
  interface ArticulatedLeg {
    hip: THREE.Group;
    knee: THREE.Group;
    ankle: THREE.Group;
  }

  const makeArticulatedLeg = (xOffset: number): ArticulatedLeg => {
    const hip = new THREE.Group();
    hip.position.set(xOffset, -0.02, 0);

    // Sculpted athletic thigh (LatheGeometry with natural quad sweep & hamstring contour, length 0.45)
    const thighPts = isMale
      ? [
          new THREE.Vector2(0.058, -0.45),
          new THREE.Vector2(0.072, -0.3),
          new THREE.Vector2(0.088, -0.12),
          new THREE.Vector2(0.084, 0.02),
        ]
      : [
          new THREE.Vector2(0.052, -0.45),
          new THREE.Vector2(0.066, -0.3),
          new THREE.Vector2(0.082, -0.12),
          new THREE.Vector2(0.078, 0.02),
        ];
    const thighMat =
      charDef.id === 'augusta' || charDef.id === 'iuno' ? skinMat : pantsMat;
    const thigh = new THREE.Mesh(new THREE.LatheGeometry(thighPts, 14), thighMat);
    thigh.scale.set(0.96, 1, 1.06);
    thigh.castShadow = true;
    hip.add(thigh);

    // Tactical thigh strap on right leg (extra realistic explorer detail!)
    if (xOffset < 0) {
      const thighStrap = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.011, 6, 14), leatherMat);
      thighStrap.rotation.x = Math.PI / 2;
      thighStrap.position.y = -0.17;
      hip.add(thighStrap);
    }

    // KNEE JOINT (y = -0.45 relative to hip → world y = 0.52)
    const knee = new THREE.Group();
    knee.position.set(0, -0.45, 0);
    hip.add(knee);

    // Smooth knee cap sphere so deep 110° sprint flexion never splits or shows gaps
    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(isMale ? 0.06 : 0.054, 10, 8),
      thighMat,
    );
    knee.add(kneeCap);

    // Sculpted calf muscle (gastrocnemius taper) + rolled trouser cuff + laced leather adventure boot
    const upperShinMat =
      charDef.id === 'chisa'
        ? pantsMat
        : charDef.id === 'augusta' || charDef.id === 'iuno'
          ? skinMat
          : pantsMat;
    const calfPts = [
      new THREE.Vector2(0.048, -0.24),
      new THREE.Vector2(0.064, -0.14),
      new THREE.Vector2(0.062, -0.05),
      new THREE.Vector2(0.055, 0.0),
    ];
    const calf = new THREE.Mesh(new THREE.LatheGeometry(calfPts, 12), upperShinMat);
    calf.scale.set(0.94, 1, 1.04);
    calf.castShadow = true;
    knee.add(calf);

    // Rolled trouser cuff / boot collar (iconic Temple Run silhouette!)
    const cuff = new THREE.Mesh(
      new THREE.TorusGeometry(isMale ? 0.058 : 0.052, 0.014, 6, 14),
      charDef.id === 'chisa' || charDef.id === 'phrolova' ? accentMat : leatherMat,
    );
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.23;
    knee.add(cuff);

    // Laced adventure boot shaft (y = -0.23 to -0.43)
    const bootShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.056 : 0.05, isMale ? 0.048 : 0.044, 0.21, 12),
      bootMat,
    );
    bootShaft.position.y = -0.33;
    bootShaft.castShadow = true;
    knee.add(bootShaft);

    // Metallic boot buckle straps
    for (const sy of [-0.27, -0.36]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 5, 12), metalMat);
      strap.rotation.x = Math.PI / 2;
      strap.position.y = sy;
      knee.add(strap);
    }

    // ANKLE JOINT (y = -0.43 relative to knee → world y = 0.09)
    const ankle = new THREE.Group();
    ankle.position.set(0, -0.43, 0);
    knee.add(ankle);

    // Sculpted boot upper + dark rugged tread sole (clearly visible kicking up behind mid-sprint!)
    const bootUpper = new THREE.Mesh(
      new THREE.BoxGeometry(isMale ? 0.105 : 0.092, 0.068, isMale ? 0.215 : 0.19),
      bootMat,
    );
    bootUpper.position.set(0, -0.042, 0.045);
    bootUpper.castShadow = true;

    const toeCap = new THREE.Mesh(
      new THREE.SphereGeometry(isMale ? 0.052 : 0.046, 10, 8),
      bootMat,
    );
    toeCap.scale.set(1.0, 0.68, 1.15);
    toeCap.position.set(0, -0.048, isMale ? 0.14 : 0.125);

    const bootSole = new THREE.Mesh(
      new THREE.BoxGeometry(isMale ? 0.112 : 0.098, 0.026, isMale ? 0.235 : 0.21),
      soleMat,
    );
    bootSole.position.set(0, -0.082, 0.05);

    const bootHeel = new THREE.Mesh(
      new THREE.BoxGeometry(isMale ? 0.108 : 0.094, 0.024, 0.075),
      soleMat,
    );
    bootHeel.position.set(0, -0.088, -0.025);

    ankle.add(bootUpper, toeCap, bootSole, bootHeel);

    pelvisGroup.add(hip);
    return { hip, knee, ankle };
  };

  const legRight = makeArticulatedLeg(isMale ? -0.105 : -0.095);
  const legLeft = makeArticulatedLeg(isMale ? 0.105 : 0.095);

  // ── 2. ARTICULATED SPINE & ATHLETIC V-TAPER UPPER TORSO ──
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, 0.09, 0); // pivots naturally at waist (world y = 1.08)
  pelvisGroup.add(spineGroup);

  // Athletic V-taper sculpted torso (broad shoulder blades & chest tapering to trim waist!)
  const torsoPts = isMale
    ? [
        new THREE.Vector2(0.138, 0.0),
        new THREE.Vector2(0.145, 0.12),
        new THREE.Vector2(0.178, 0.28),
        new THREE.Vector2(0.205, 0.42),
        new THREE.Vector2(0.165, 0.48),
        new THREE.Vector2(0.072, 0.52),
      ]
    : [
        new THREE.Vector2(0.118, 0.0),
        new THREE.Vector2(0.126, 0.11),
        new THREE.Vector2(0.158, 0.27),
        new THREE.Vector2(0.172, 0.4),
        new THREE.Vector2(0.142, 0.46),
        new THREE.Vector2(0.062, 0.5),
      ];
  const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 20), topMat);
  torsoMesh.scale.set(1.12, 1.0, 0.7);
  torsoMesh.castShadow = true;
  spineGroup.add(torsoMesh);

  // Subtle sculpted upper-back shoulder-blade & collarbone yoke for muscular realism
  const yoke = new THREE.Mesh(
    new THREE.CylinderGeometry(isMale ? 0.195 : 0.162, isMale ? 0.18 : 0.15, 0.12, 16),
    topMat,
  );
  yoke.position.set(0, 0.41, 0);
  yoke.scale.set(1.16, 1, 0.68);
  spineGroup.add(yoke);

  // TEMPLE-RUN SIGNATURE LEATHER SHOULDER HARNESS & BACK BUCKLE STRAPS (looks super sharp from behind!)
  const addBackHarness = (strapMat: THREE.Material, buckleMat: THREE.Material) => {
    for (const side of [-1, 1]) {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (isMale ? 0.145 : 0.12), 0.47, 0.02),
        new THREE.Vector3(side * (isMale ? 0.14 : 0.115), 0.44, -0.115),
        new THREE.Vector3(side * (isMale ? 0.11 : 0.092), 0.26, -0.132),
        new THREE.Vector3(side * (isMale ? 0.095 : 0.08), 0.04, -0.112),
      ]);
      const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 12, 0.018, 6, false), strapMat);
      strap.scale.set(1.2, 1, 0.55);
      spineGroup.add(strap);

      // Front harness continuation
      const frontCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (isMale ? 0.145 : 0.12), 0.47, 0.02),
        new THREE.Vector3(side * (isMale ? 0.13 : 0.11), 0.36, 0.118),
        new THREE.Vector3(side * (isMale ? 0.1 : 0.085), 0.05, 0.105),
      ]);
      const fStrap = new THREE.Mesh(new THREE.TubeGeometry(frontCurve, 10, 0.017, 6, false), strapMat);
      fStrap.scale.set(1.2, 1, 0.55);
      spineGroup.add(fStrap);
    }
    // Horizontal cross-strap & brass buckle right across upper shoulder blades (exact Temple Run look!)
    const crossStrap = new THREE.Mesh(
      new THREE.BoxGeometry(isMale ? 0.28 : 0.23, 0.036, 0.02),
      strapMat,
    );
    crossStrap.position.set(0, 0.36, -0.132);
    const backBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.044, 0.026), buckleMat);
    backBuckle.position.set(0, 0.36, -0.136);
    spineGroup.add(crossStrap, backBuckle);
  };

  // Character-specific tailored upper-body adventurer details
  if (charDef.id === 'chisa') {
    addBackHarness(leatherMat, metalMat);
    // Crisp white sailor shawl collar & back flap with stitched crimson trim
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 6, 16), whiteClothMat);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.scale.set(1.2, 0.85, 1);
    collarRing.position.set(0, 0.46, 0);
    const backFlap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.19, 0.022), whiteClothMat);
    backFlap.position.set(0, 0.37, -0.135);
    backFlap.rotation.x = 0.1;
    const redTie = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.17, 4), accentMat);
    redTie.position.set(0, 0.34, 0.125);
    redTie.rotation.x = Math.PI;
    spineGroup.add(collarRing, backFlap, redTie);
  } else if (charDef.id === 'galbrena') {
    // Open matte-black cropped biker leather vest over cobalt athletic top + chrome back buckle
    addBackHarness(leatherMat, metalMat);
    const vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.03), leatherMat);
    vestBack.position.set(0, 0.33, -0.118);
    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.27, 0.032), leatherMat);
    lapelL.position.set(-0.115, 0.33, 0.105);
    const lapelR = lapelL.clone();
    lapelR.position.x = 0.115;
    spineGroup.add(vestBack, lapelL, lapelR);
  } else if (charDef.id === 'augusta') {
    // Leather adventurer cross-harness + brushed gold greco breastplate + flowing weathered ivory half-cape
    addBackHarness(leatherMat, metalMat);
    const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.115, 0.26, 14), metalMat);
    cuirass.position.set(0, 0.27, 0.025);
    cuirass.scale.set(1.06, 1, 0.68);
    const sunCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), metalMat);
    sunCrest.position.set(0, 0.4, 0.125);
    // Asymmetric warrior shoulder-cape (doesn't hide her dynamic arm pump!)
    const capeGroup = new THREE.Group();
    capeGroup.position.set(-0.08, 0.45, -0.13);
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.68, 0.022), whiteClothMat);
    cape.position.set(-0.02, -0.34, 0);
    cape.castShadow = true;
    const capeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.045, 0.026), metalMat);
    capeTrim.position.set(-0.02, -0.66, 0);
    capeGroup.add(cape, capeTrim);
    flowingParts.push({ obj: capeGroup, baseX: 0.16, baseZ: -0.05, phase: 0.1, amp: 0.2 });
    spineGroup.add(cuirass, sunCrest, capeGroup);
  } else if (charDef.id === 'iuno') {
    // Gilded leather oracle straps + golden neck gorget + flowing sapphire/ivory twin back sashes
    addBackHarness(metalMat, metalMat);
    const gorget = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 16), metalMat);
    gorget.rotation.x = Math.PI / 2;
    gorget.position.y = 0.48;
    const sashGroup = new THREE.Group();
    sashGroup.position.set(0, 0.08, -0.135);
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.56, 0.018), whiteClothMat);
    tailL.position.set(-0.075, -0.28, 0);
    tailL.rotation.z = -0.12;
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.56, 0.018), accentMat);
    tailR.position.set(0.075, -0.28, 0);
    tailR.rotation.z = 0.12;
    sashGroup.add(tailL, tailR);
    flowingParts.push({ obj: sashGroup, baseX: 0.2, baseZ: 0, phase: 1.0, amp: 0.22 });
    spineGroup.add(gorget, sashGroup);
  } else if (charDef.id === 'phrolova') {
    // Crimson-and-ebony explorer leather corset harness + metallic spider-lily shoulder crest
    addBackHarness(leatherMat, metalMat);
    const cravat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.025), whiteClothMat);
    cravat.position.set(0, 0.34, 0.115);
    // Subtle hovering crimson spider-lily emblem
    const lilyGroup = new THREE.Group();
    lilyGroup.position.set(-0.28, 0.44, 0.08);
    const lilyCore = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), accentMat);
    lilyGroup.add(lilyCore);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.11, 5), accentMat);
      petal.position.set(Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0);
      petal.rotation.z = a - Math.PI / 2;
      lilyGroup.add(petal);
    }
    spinAccessory = lilyGroup;
    spineGroup.add(cravat, lilyGroup);
  } else {
    // Qiuyuan — Classic Temple-Run adventurer back harness with brass buckle, rolled collar & jade inner lapel!
    addBackHarness(leatherMat, metalMat);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.022, 6, 16), topMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.49;
    const innerSash = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.32, 0.026), whiteClothMat);
    innerSash.position.set(0, 0.28, 0.13);
    const jadeEdgeL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.35, 0.03), accentMat);
    jadeEdgeL.position.set(-0.072, 0.28, 0.132);
    const jadeEdgeR = jadeEdgeL.clone();
    jadeEdgeR.position.x = 0.072;
    spineGroup.add(collar, innerSash, jadeEdgeL, jadeEdgeR);
  }

  // ── 3. MULTI-JOINTED ATHLETIC ARMS: SHOULDER → BICEP/SLEEVE → ELBOW → FOREARM/BRACER → FIST ──
  interface ArticulatedArm {
    shoulder: THREE.Group;
    elbow: THREE.Group;
  }

  const makeArticulatedArm = (xOffset: number): ArticulatedArm => {
    const shoulder = new THREE.Group();
    shoulder.position.set(xOffset, 0.415, 0); // integrated cleanly into broad deltoid line

    const upperArmMat =
      charDef.id === 'augusta' || charDef.id === 'iuno'
        ? skinMat
        : charDef.id === 'galbrena'
          ? leatherMat
          : topMat;

    // Deltoid shoulder cap (smoothly sloped into collarbone, never a bumpy toy ball)
    const deltoid = new THREE.Mesh(
      new THREE.SphereGeometry(isMale ? 0.068 : 0.055, 12, 10),
      upperArmMat,
    );
    deltoid.scale.set(0.95, 0.88, 0.9);
    shoulder.add(deltoid);

    // Sculpted upper arm / rolled-up explorer sleeve (length 0.28)
    const bicepPts = [
      new THREE.Vector2(isMale ? 0.048 : 0.039, -0.28),
      new THREE.Vector2(isMale ? 0.058 : 0.047, -0.14),
      new THREE.Vector2(isMale ? 0.06 : 0.049, 0.0),
    ];
    const upperArm = new THREE.Mesh(new THREE.LatheGeometry(bicepPts, 12), upperArmMat);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    // Rolled sleeve cuff right above the elbow (signature Temple Run adventurer look!)
    if (charDef.id === 'qiuyuan' || charDef.id === 'galbrena' || charDef.id === 'chisa') {
      const sleeveRoll = new THREE.Mesh(
        new THREE.TorusGeometry(isMale ? 0.052 : 0.043, 0.012, 6, 12),
        upperArmMat,
      );
      sleeveRoll.rotation.x = Math.PI / 2;
      sleeveRoll.position.y = -0.22;
      shoulder.add(sleeveRoll);
    }

    // ELBOW JOINT (y = -0.28 relative to shoulder)
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);

    const elbowSkinMat =
      charDef.id === 'phrolova' ? accentMat : skinMat;
    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(isMale ? 0.046 : 0.038, 10, 8),
      elbowSkinMat,
    );
    elbow.add(elbowCap);

    // Toned forearm (length 0.25) + leather explorer wrist bracer
    const forearmPts = [
      new THREE.Vector2(isMale ? 0.036 : 0.03, -0.25),
      new THREE.Vector2(isMale ? 0.047 : 0.039, -0.1),
      new THREE.Vector2(isMale ? 0.045 : 0.037, 0.0),
    ];
    const forearm = new THREE.Mesh(new THREE.LatheGeometry(forearmPts, 12), elbowSkinMat);
    forearm.castShadow = true;
    elbow.add(forearm);

    // Wrapped leather adventurer bracer / glove cuff
    const bracer = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.045 : 0.037, isMale ? 0.039 : 0.033, 0.11, 10),
      leatherMat,
    );
    bracer.position.y = -0.19;
    const bracerBuckle = new THREE.Mesh(
      new THREE.TorusGeometry(isMale ? 0.043 : 0.036, 0.006, 5, 10),
      metalMat,
    );
    bracerBuckle.rotation.x = Math.PI / 2;
    bracerBuckle.position.y = -0.15;
    elbow.add(bracer, bracerBuckle);

    // Clenched athletic runner fist (fingerless leather glove wrap + knuckles + thumb)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.265, 0);
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(isMale ? 0.056 : 0.046, 0.072, isMale ? 0.068 : 0.056),
      leatherMat,
    );
    const knuckles = new THREE.Mesh(
      new THREE.SphereGeometry(isMale ? 0.032 : 0.027, 8, 8),
      skinMat,
    );
    knuckles.scale.set(0.95, 1.0, 1.15);
    knuckles.position.set(0, -0.022, 0.02);
    handGroup.add(palm, knuckles);
    elbow.add(handGroup);

    spineGroup.add(shoulder);
    return { shoulder, elbow };
  };

  const armRight = makeArticulatedArm(isMale ? -0.24 : -0.198);
  const armLeft = makeArticulatedArm(isMale ? 0.24 : 0.198);

  // ── 4. ATHLETIC NECK & COMPACT 7.4-HEAD ADULT SCULPTED HEAD + CURVED SWEPT HAIR ──
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0.01); // world y ≈ 1.64, top of crown ≈ 1.92
  spineGroup.add(headGroup);

  // Athletic neck with trapezius collar transition
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(isMale ? 0.054 : 0.045, isMale ? 0.066 : 0.054, 0.12, 12),
    skinMat,
  );
  neck.position.set(0, -0.02, -0.005);
  headGroup.add(neck);

  // Compact sculpted adult cranium + refined jawline & cheekbones (radius 0.132 → 7.4 heads tall!)
  const headGeom = new THREE.SphereGeometry(0.132, 26, 20);
  headGeom.rotateY(-Math.PI / 2);
  const posAttr = headGeom.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    let vx = posAttr.getX(i);
    let vy = posAttr.getY(i);
    let vz = posAttr.getZ(i);
    // Realistic adult oval skull (slightly taller & deeper front-to-back)
    vx *= isMale ? 0.94 : 0.9;
    vy *= 1.12;
    vz *= 1.02;
    if (vy < -0.01) {
      const t = Math.min(1, (-vy - 0.01) / 0.14);
      vx *= 1 - (isMale ? 0.24 : 0.3) * t * t;
      if (vz > 0) {
        // Subtle sculpted adult chin prominence
        vz += 0.012 * t * (1 - Math.min(1, Math.abs(vx) / 0.11));
      }
    }
    posAttr.setXYZ(i, vx, vy, vz);
  }
  headGeom.computeVertexNormals();

  const headMesh = new THREE.Mesh(headGeom, faceMat);
  headMesh.position.y = 0.115;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Sculpted ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), skinMat);
    ear.scale.set(0.45, 1.15, 0.72);
    ear.position.set(side * (isMale ? 0.122 : 0.116), 0.105, -0.005);
    headGroup.add(ear);
  }

  // Sculpted Hair Volume: Fitted skull crown + back hair cap (tilted back so face is 100% crisp & unmasked)
  const hairBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.142, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
    hairMat,
  );
  hairBase.position.set(0, 0.135, -0.016);
  hairBase.rotation.x = -0.38;
  hairBase.scale.set(isMale ? 0.97 : 0.94, 1.06, 1.04);
  hairBase.castShadow = true;
  headGroup.add(hairBase);

  const hairNapeGeom = new THREE.SphereGeometry(
    0.142,
    20,
    14,
    Math.PI * 0.06,
    Math.PI * 0.88,
    Math.PI * 0.26,
    Math.PI * 0.62,
  );
  hairNapeGeom.rotateY(Math.PI);
  const hairNape = new THREE.Mesh(hairNapeGeom, hairMat);
  hairNape.position.set(0, 0.118, -0.012);
  hairNape.scale.set(isMale ? 0.97 : 0.94, 1.04, 1.02);
  headGroup.add(hairNape);

  // Smooth Curved TubeGeometry Swept Forehead Hair Locks (ZERO spiky geometric cones!)
  const sweepDir = charDef.id === 'galbrena' || charDef.id === 'qiuyuan' ? 1 : -1;
  for (let i = -2; i <= 2; i++) {
    const x0 = i * 0.036;
    const xMid = x0 + sweepDir * 0.022;
    const xTip = x0 + sweepDir * 0.048;
    const isPhrolovaCover = charDef.id === 'phrolova' && i <= -1;
    const tipY = isPhrolovaCover ? 0.095 : 0.165 - Math.abs(i) * 0.014;
    const lock = buildCurvedHairLock(
      [
        [x0 * 0.5, 0.255, -0.01],
        [xMid * 0.9, 0.238, 0.095 - Math.abs(i) * 0.016],
        [xTip, tipY, 0.128 - Math.abs(i) * 0.024],
      ],
      0.024,
      0.24,
      hairMat,
    );
    headGroup.add(lock);
  }

  // Swept temple/cheek framing locks curving naturally behind ears
  for (const side of [-1, 1]) {
    const sideStr = buildCurvedHairLock(
      [
        [side * 0.085, 0.225, 0.04],
        [side * 0.132, 0.14, 0.045],
        [side * 0.135, charDef.id === 'qiuyuan' ? 0.05 : -0.02, 0.015],
      ],
      0.022,
      0.22,
      hairMat,
    );
    headGroup.add(sideStr);
  }

  // Character-specific sculpted realistic 3D hairstyles & subtle metallic circlets
  if (charDef.id === 'chisa') {
    const backHair = new THREE.Group();
    backHair.position.set(0, 0.13, -0.115);
    for (let i = -2; i <= 2; i++) {
      const x = i * 0.044;
      const strand = buildCurvedHairLock(
        [
          [x * 0.75, 0.05, 0.0],
          [x * 1.0, -0.16, -0.035],
          [x * 1.12, -0.44 + Math.abs(i) * 0.03, -0.05],
        ],
        0.038,
        0.34,
        hairMat,
      );
      backHair.add(strand);
    }
    flowingParts.push({ obj: backHair, baseX: 0.1, baseZ: 0, phase: 0, amp: 0.16 });
    headGroup.add(backHair);

    // Silk crimson left ribbon bow
    const ribbon = new THREE.Group();
    ribbon.position.set(-0.14, 0.13, -0.04);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), hairAccentMat);
    const tail1 = buildCurvedHairLock(
      [
        [0, 0, 0],
        [-0.035, -0.08, -0.03],
        [-0.02, -0.18, -0.05],
      ],
      0.016,
      0.35,
      hairAccentMat,
    );
    ribbon.add(knot, tail1);
    headGroup.add(ribbon);
  } else if (charDef.id === 'galbrena') {
    const backHair = new THREE.Group();
    backHair.position.set(0, 0.14, -0.11);
    for (let i = -2; i <= 2; i++) {
      const x = i * 0.046;
      const strand = buildCurvedHairLock(
        [
          [x * 0.7, 0.06, 0.0],
          [x * 1.15, -0.12, -0.055],
          [x * 1.35, -0.34 + Math.abs(i) * 0.035, -0.09],
        ],
        0.036,
        0.18,
        hairMat,
      );
      backHair.add(strand);
    }
    flowingParts.push({ obj: backHair, baseX: 0.14, baseZ: 0, phase: 0.4, amp: 0.2 });
    headGroup.add(backHair);
  } else if (charDef.id === 'augusta') {
    const backHair = new THREE.Group();
    backHair.position.set(0, 0.14, -0.115);
    for (let i = -2; i <= 2; i++) {
      const x = i * 0.048;
      const strand = buildCurvedHairLock(
        [
          [x * 0.72, 0.05, 0.0],
          [x * 1.12, -0.18, -0.045],
          [x * 1.25, -0.46 + Math.abs(i) * 0.04, -0.07],
        ],
        0.04,
        0.24,
        i % 2 === 0 ? hairMat : hairAccentMat,
      );
      backHair.add(strand);
    }
    flowingParts.push({ obj: backHair, baseX: 0.14, baseZ: 0, phase: 0.2, amp: 0.2 });
    headGroup.add(backHair);

    // Refined metallic sunburst circlet seated neatly along hairline
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.225, 0.025);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.011, 6, 20), metalMat);
    band.rotation.x = Math.PI / 2 - 0.2;
    crownGroup.add(band);
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.34;
      const ray = new THREE.Mesh(
        new THREE.ConeGeometry(0.013, i === 0 ? 0.11 : 0.08 - Math.abs(i) * 0.01, 4),
        metalMat,
      );
      ray.position.set(Math.sin(a) * 0.075, 0.048 + Math.cos(a) * 0.04, 0.105);
      ray.rotation.z = -a;
      crownGroup.add(ray);
    }
    headGroup.add(crownGroup);
  } else if (charDef.id === 'iuno') {
    // Sleek antique gold laurel circlet + curved sculpted sapphire twin-tails
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.01, 6, 20), metalMat);
    wreath.rotation.x = Math.PI / 2 - 0.24;
    wreath.position.set(0, 0.215, 0.005);
    headGroup.add(wreath);

    for (const side of [-1, 1]) {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(side * 0.13, 0.19, -0.075);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 12), metalMat);
      const mainTail = buildCurvedHairLock(
        [
          [0, 0, 0],
          [side * 0.085, -0.16, -0.055],
          [side * 0.11, -0.44, -0.095],
        ],
        0.042,
        0.2,
        hairMat,
      );
      const cyanStreak = buildCurvedHairLock(
        [
          [side * 0.01, -0.02, 0.01],
          [side * 0.095, -0.18, -0.04],
          [side * 0.125, -0.46, -0.085],
        ],
        0.022,
        0.16,
        hairAccentMat,
      );
      tailPivot.add(tie, mainTail, cyanStreak);
      flowingParts.push({
        obj: tailPivot,
        baseX: 0.18,
        baseZ: side * 0.08,
        phase: side === -1 ? 0 : Math.PI * 0.65,
        amp: 0.24,
      });
      headGroup.add(tailPivot);
    }
  } else if (charDef.id === 'phrolova') {
    // Layered feathered silver-sage bob curving gracefully inward at the nape
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.34;
      const x0 = Math.sin(a) * 0.12;
      const z0 = -Math.cos(a) * 0.115;
      const bobLock = buildCurvedHairLock(
        [
          [x0 * 0.85, 0.19, z0 * 0.85],
          [x0 * 1.15, 0.08, z0 * 1.15],
          [x0 * 0.98, -0.02, z0 * 0.95],
        ],
        0.032,
        0.38,
        hairMat,
      );
      headGroup.add(bobLock);
    }
  } else {
    // Qiuyuan — Classic Temple-Run sculpted swept short-to-mid adventurer layers + sleek warrior ponytail with jade tie!
    for (let i = -2; i <= 2; i++) {
      const crownSweep = buildCurvedHairLock(
        [
          [i * 0.032, 0.255, 0.03],
          [i * 0.042, 0.245, -0.055],
          [i * 0.046, 0.155, -0.145],
        ],
        0.028,
        0.32,
        hairMat,
      );
      headGroup.add(crownSweep);
    }
    const ponyPivot = new THREE.Group();
    ponyPivot.position.set(0, 0.15, -0.142);
    const jadeTie = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.011, 6, 12), hairAccentMat);
    const ponyLock = buildCurvedHairLock(
      [
        [0, 0, 0],
        [0, -0.14, -0.06],
        [0.02, -0.34, -0.11],
      ],
      0.042,
      0.2,
      hairMat,
    );
    const jadeRibbon = buildCurvedHairLock(
      [
        [0.02, 0, -0.01],
        [0.055, -0.14, -0.065],
        [0.07, -0.3, -0.1],
      ],
      0.014,
      0.35,
      hairAccentMat,
    );
    ponyPivot.add(jadeTie, ponyLock, jadeRibbon);
    flowingParts.push({ obj: ponyPivot, baseX: 0.16, baseZ: 0, phase: 0.25, amp: 0.2 });
    headGroup.add(ponyPivot);
  }

  // Soft radial contact shadow grounded cleanly at y = 0.02
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 20),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // ── FLUID MULTI-JOINT TEMPLE-RUN KINEMATICS ──
  const updateAnimation: AnimatedRunnerRig['updateAnimation'] = ({
    dt,
    time,
    speed,
    stridePhase,
    y,
    grounded,
    hitFlash,
    squashX,
    squashY,
    celebrating,
    idleMode,
    lockedPose,
    previewJumpProgress = 0,
  }) => {
    for (const m of hitFlashMaterials) {
      if (hitFlash) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 0.55;
      } else {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }

    if (spinAccessory) {
      spinAccessory.rotation.z += dt * (celebrating ? 5.2 : 2.2);
      spinAccessory.position.y = 0.44 + Math.sin(time * 3.2) * 0.035;
    }

    const previewJumpHeight =
      previewJumpProgress > 0 ? Math.sin(previewJumpProgress * Math.PI) * 1.05 : 0;
    const totalY = y + previewJumpHeight;

    const shadowScale = Math.max(0.38, 1 - totalY * 0.2);
    shadowDisc.scale.setScalar(shadowScale);
    (shadowDisc.material as THREE.MeshBasicMaterial).opacity = 0.62 * shadowScale;

    // Flowing hair, capes, ribbons react dynamically to run speed
    const windSpeed = celebrating ? 10 : speed > 1 ? 15 : 2.6;
    const windLift = speed > 1 ? Math.min(0.42, speed * 0.044) : 0;
    for (const fp of flowingParts) {
      fp.obj.rotation.x = fp.baseX + windLift + Math.sin(time * windSpeed + fp.phase) * fp.amp;
      fp.obj.rotation.z =
        fp.baseZ + Math.cos(time * (windSpeed * 0.65) + fp.phase) * (fp.amp * 0.4);
    }

    if (celebrating) {
      // Multi-joint choreographed 3D Victory Dance!
      const beat = time * 6.8;
      const dancePhase = Math.floor((time % 4.8) / 1.2);
      bodyPivot.scale.set(1, 1, 1);
      if (dancePhase === 0) {
        const hop = Math.abs(Math.sin(beat)) * 0.48;
        bodyPivot.position.y = hop;
        bodyPivot.rotation.set(0, time * 5.0, Math.sin(beat) * 0.1);
        pelvisGroup.rotation.set(0, 0, Math.sin(beat) * 0.08);
        spineGroup.rotation.set(0.05, Math.sin(beat) * 0.25, 0);
        armRight.shoulder.rotation.set(-Math.PI * 0.78, 0, -0.35);
        armLeft.shoulder.rotation.set(-Math.PI * 0.78, 0, 0.35);
        armRight.elbow.rotation.set(-0.65, 0, 0);
        armLeft.elbow.rotation.set(-0.65, 0, 0);
        legRight.hip.rotation.set(-0.35 * Math.abs(Math.sin(beat)), 0, 0);
        legLeft.hip.rotation.set(-0.35 * Math.abs(Math.cos(beat)), 0, 0);
        legRight.knee.rotation.set(0.7 * Math.abs(Math.sin(beat)), 0, 0);
        legLeft.knee.rotation.set(0.7 * Math.abs(Math.cos(beat)), 0, 0);
        legRight.ankle.rotation.set(0.25, 0, 0);
        legLeft.ankle.rotation.set(0.25, 0, 0);
      } else if (dancePhase === 1) {
        const groove = Math.sin(beat * 1.25);
        bodyPivot.position.y = Math.abs(groove) * 0.15;
        bodyPivot.rotation.set(0, groove * 0.32, 0);
        pelvisGroup.rotation.set(0, -groove * 0.18, groove * 0.1);
        spineGroup.rotation.set(0.08, groove * 0.36, -groove * 0.06);
        armRight.shoulder.rotation.set(-1.1 + groove * 0.65, 0, -0.32);
        armLeft.shoulder.rotation.set(-1.1 - groove * 0.65, 0, 0.32);
        armRight.elbow.rotation.set(-1.35, 0, 0);
        armLeft.elbow.rotation.set(-1.35, 0, 0);
        legRight.hip.rotation.set(groove * 0.25 - 0.15, 0, 0);
        legLeft.hip.rotation.set(-groove * 0.25 - 0.15, 0, 0);
        legRight.knee.rotation.set(0.32 + Math.max(0, groove) * 0.35, 0, 0);
        legLeft.knee.rotation.set(0.32 + Math.max(0, -groove) * 0.35, 0, 0);
        legRight.ankle.rotation.set(0, 0, 0);
        legLeft.ankle.rotation.set(0, 0, 0);
      } else if (dancePhase === 2) {
        const jump = Math.abs(Math.sin(beat * 0.9)) * 0.56;
        bodyPivot.position.y = jump;
        bodyPivot.rotation.set(0, Math.sin(beat * 0.45) * 0.22, 0);
        pelvisGroup.rotation.set(0, 0, 0);
        spineGroup.rotation.set(-0.08, 0, 0);
        armRight.shoulder.rotation.set(-Math.PI * 0.82, 0, -0.65 * Math.min(1, jump * 2.2));
        armLeft.shoulder.rotation.set(-Math.PI * 0.82, 0, 0.65 * Math.min(1, jump * 2.2));
        armRight.elbow.rotation.set(-0.35, 0, 0);
        armLeft.elbow.rotation.set(-0.35, 0, 0);
        legRight.hip.rotation.set(-0.38, 0, -0.25 * Math.min(1, jump * 2.2));
        legLeft.hip.rotation.set(-0.38, 0, 0.25 * Math.min(1, jump * 2.2));
        legRight.knee.rotation.set(0.75, 0, 0);
        legLeft.knee.rotation.set(0.75, 0, 0);
        legRight.ankle.rotation.set(0.3, 0, 0);
        legLeft.ankle.rotation.set(0.3, 0, 0);
      } else {
        const wave = Math.sin(beat * 1.6);
        bodyPivot.position.y = Math.abs(Math.sin(beat)) * 0.2;
        bodyPivot.rotation.set(0, wave * 0.35, 0);
        pelvisGroup.rotation.set(0, -wave * 0.14, 0);
        spineGroup.rotation.set(0.06, wave * 0.28, -wave * 0.08);
        armRight.shoulder.rotation.set(-Math.PI * 0.85, 0, -0.22 + wave * 0.28);
        armLeft.shoulder.rotation.set(-Math.PI * 0.85, 0, 0.22 + wave * 0.28);
        armRight.elbow.rotation.set(-0.5, 0, 0);
        armLeft.elbow.rotation.set(-0.5, 0, 0);
        legRight.hip.rotation.set(-0.1, 0, 0);
        legLeft.hip.rotation.set(-0.1, 0, 0);
        legRight.knee.rotation.set(0.22, 0, 0);
        legLeft.knee.rotation.set(0.22, 0, 0);
        legRight.ankle.rotation.set(0, 0, 0);
        legLeft.ankle.rotation.set(0, 0, 0);
      }
      headGroup.rotation.set(-0.08, Math.sin(beat * 0.8) * 0.22, 0);
      return;
    }

    bodyPivot.rotation.z = 0;

    if (idleMode) {
      bodyPivot.scale.set(1, 1, 1);

      if (previewJumpProgress > 0) {
        // Athletic parkour 360° vault spin on Character Select pedestal!
        bodyPivot.position.y = previewJumpHeight;
        bodyPivot.rotation.set(0.12, previewJumpProgress * Math.PI * 2, 0);
        pelvisGroup.rotation.set(0, 0, 0);
        spineGroup.rotation.set(0.18, 0, 0);
        armRight.shoulder.rotation.set(-1.35, 0, -0.35);
        armLeft.shoulder.rotation.set(-0.55, 0, 0.38);
        armRight.elbow.rotation.set(-1.5, 0, 0);
        armLeft.elbow.rotation.set(-1.25, 0, 0);
        legRight.hip.rotation.set(-0.95, 0, 0);
        legRight.knee.rotation.set(1.35, 0, 0);
        legLeft.hip.rotation.set(0.35, 0, 0);
        legLeft.knee.rotation.set(0.95, 0, 0);
        legRight.ankle.rotation.set(0.35, 0, 0);
        legLeft.ankle.rotation.set(0.4, 0, 0);
        headGroup.rotation.set(-0.15, 0, 0);
        return;
      }

      // Heroic athletic contrapposto action-ready stance (NEVER stiff straight-down A-pose!)
      const breathe = Math.sin(time * 2.1);
      bodyPivot.rotation.set(0, -0.18 + Math.sin(time * 0.7) * 0.08, 0);
      bodyPivot.position.y = lockedPose
        ? Math.abs(Math.sin(time * 5.2)) * 0.12
        : -0.03 + breathe * 0.012;

      pelvisGroup.rotation.set(0, 0.14, -0.04);
      spineGroup.rotation.set(0.06 + breathe * 0.025, -0.18, 0.04);

      // Unlocked athletic stance legs (front foot planted, back knee subtly flexed)
      legRight.hip.rotation.set(-0.22, -0.08, -0.06);
      legRight.knee.rotation.set(0.34, 0, 0);
      legRight.ankle.rotation.set(-0.12, 0, 0);

      legLeft.hip.rotation.set(0.16, 0.12, 0.07);
      legLeft.knee.rotation.set(0.22, 0, 0);
      legLeft.ankle.rotation.set(-0.24, 0, 0);

      if (lockedPose) {
        // Confident fist-pump ready pose
        armRight.shoulder.rotation.set(-1.35, 0, -0.22);
        armRight.elbow.rotation.set(-1.55, 0, 0);
        armLeft.shoulder.rotation.set(-0.35, 0, 0.24);
        armLeft.elbow.rotation.set(-1.25, 0, 0);
      } else {
        // Bent-elbow athletic guard / runner ready pose
        armRight.shoulder.rotation.set(-0.28 + breathe * 0.05, 0.12, -0.18);
        armRight.elbow.rotation.set(-0.92 - breathe * 0.06, 0, 0.12);
        armLeft.shoulder.rotation.set(0.16 - breathe * 0.05, -0.1, 0.2);
        armLeft.elbow.rotation.set(-0.68 + breathe * 0.05, 0, -0.1);
      }

      headGroup.rotation.set(-0.04, 0.12 + Math.sin(time * 1.1) * 0.08, 0);
      return;
    }

    // ── HIGH-SPEED TEMPLE RUN PARKOUR SPRINT & VAULT JUMP ──
    bodyPivot.rotation.set(0, 0, 0);
    bodyPivot.scale.set(squashX, squashY, squashX);

    if (!grounded) {
      // Dynamic athletic hurdle vault pose mid-air (front knee tucked high, trailing leg swept back, arms driving!)
      bodyPivot.position.y = y;
      pelvisGroup.rotation.set(0.08, 0.18, 0);
      spineGroup.rotation.set(0.24, -0.22, 0);
      headGroup.rotation.set(-0.22, 0, 0);

      legRight.hip.rotation.set(-1.08, 0, -0.05);
      legRight.knee.rotation.set(1.25, 0, 0);
      legRight.ankle.rotation.set(0.28, 0, 0);

      legLeft.hip.rotation.set(0.48, 0, 0.05);
      legLeft.knee.rotation.set(1.18, 0, 0);
      legLeft.ankle.rotation.set(0.45, 0, 0);

      armRight.shoulder.rotation.set(0.65, 0, -0.34);
      armRight.elbow.rotation.set(-1.35, 0, 0);
      armLeft.shoulder.rotation.set(-1.22, 0, 0.28);
      armLeft.elbow.rotation.set(-1.55, 0, 0);
      return;
    }

    // Authentic multi-joint Temple Run sprint gait!
    const amp = Math.min(1.18, Math.max(0.25, speed / 7.8));
    const phase = stridePhase;
    const s = Math.sin(phase);
    const c = Math.cos(phase);

    // Double-frequency vertical flight bounce (peaks mid-stride when feet push off)
    const bounce = Math.abs(c) * 0.12 * amp - 0.06 * amp;
    bodyPivot.position.y = y + bounce;

    // Counter-rotating hips & broad upper shoulders + aggressive 20° forward sprint lean!
    const hipTwist = s * 0.2 * amp;
    pelvisGroup.rotation.set(0.08 * amp, hipTwist, -s * 0.075 * amp);
    spineGroup.rotation.set(0.28 * amp, -hipTwist * 1.95, s * 0.055 * amp);
    // Keep head steady & gazing down the temple track while torso leans forward
    headGroup.rotation.set(-0.24 * amp, hipTwist * 0.75, 0);

    // RIGHT LEG (-X): hip drives forward (-X rot) & pushes back (+X rot); knee bends up to 112° on recovery kick!
    const rHip = -s * 0.92 * amp - 0.08 * amp;
    // Knee flexion is ALWAYS >= 0: lowest near forward strike (c < 0, s > 0), highest on heel kick-up behind (s < 0, c > 0)
    const rKneeRecovery = Math.max(0, Math.sin(phase - 1.15));
    const rKneeStrike = Math.max(0, Math.sin(phase + 0.5)) * 0.35;
    const rKnee = (0.18 + rKneeRecovery * 1.72 + rKneeStrike) * amp;
    const rAnkle = (rKneeRecovery * 0.62 - Math.max(0, s) * 0.25) * amp;

    legRight.hip.rotation.set(rHip, 0, -0.03);
    legRight.knee.rotation.set(rKnee, 0, 0);
    legRight.ankle.rotation.set(rAnkle, 0, 0);

    // LEFT LEG (+X): 180° out of phase with right leg
    const lPhase = phase + Math.PI;
    const ls = Math.sin(lPhase);
    const lHip = -ls * 0.92 * amp - 0.08 * amp;
    const lKneeRecovery = Math.max(0, Math.sin(lPhase - 1.15));
    const lKneeStrike = Math.max(0, Math.sin(lPhase + 0.5)) * 0.35;
    const lKnee = (0.18 + lKneeRecovery * 1.72 + lKneeStrike) * amp;
    const lAnkle = (lKneeRecovery * 0.62 - Math.max(0, ls) * 0.25) * amp;

    legLeft.hip.rotation.set(lHip, 0, 0.03);
    legLeft.knee.rotation.set(lKnee, 0, 0);
    legLeft.ankle.rotation.set(lAnkle, 0, 0);

    // PUMPING SPRINTER ARMS (opposite to legs, bent elbows 85°-112° pumping briskly inward across ribs!)
    const rArmSwing = s * 0.96 * amp;
    const lArmSwing = -s * 0.96 * amp;

    // Right arm (-X): swings forward when left leg drives forward (rArmSwing < 0)
    armRight.shoulder.rotation.set(rArmSwing + 0.08, 0.14, -0.26 - Math.max(0, rArmSwing) * 0.14);
    armRight.elbow.rotation.set(-1.35 - Math.max(0, -rArmSwing) * 0.58, 0, 0.22);

    // Left arm (+X): swings forward when right leg drives forward (lArmSwing < 0)
    armLeft.shoulder.rotation.set(lArmSwing + 0.08, -0.14, 0.26 + Math.max(0, lArmSwing) * 0.14);
    armLeft.elbow.rotation.set(-1.35 - Math.max(0, -lArmSwing) * 0.58, 0, -0.22);
  };

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm: armLeft.shoulder,
    rightArm: armRight.shoulder,
    leftLeg: legLeft.hip,
    rightLeg: legRight.hip,
    spinAccessory,
    shadowDisc,
    hitFlashMaterials,
    updateAnimation,
  };
}

/**
 * Wraps a user-supplied picture (PNG/JPG/WebP) as a crisp 3D double-sided cutout runner standee
 * mounted on a carved golden sun-disc base, with full running bounce, jump, squash, and Victory Dance!
 */
export function buildCustomPictureRunnerRig(
  imageUrl: string,
  accentHex: number,
  textures: ProceduralTexturePack,
): AnimatedRunnerRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    roughness: 0.28,
    metalness: 0.8,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.4,
    metalness: 0.3,
  });

  // Carved golden runner stand base
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.6, 0.12, 16), goldMat);
  baseDisc.position.y = 0.06;
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.04, 8, 20), trimMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.12;
  bodyPivot.add(baseDisc, baseRing);

  const cardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
  });

  const cardPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.85), cardMat);
  cardPlane.position.y = 1.06;
  cardPlane.castShadow = true;
  bodyPivot.add(cardPlane);

  const loader = new THREE.TextureLoader();
  loader.load(imageUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    cardMat.map = tex;
    cardMat.needsUpdate = true;
    const img = tex.image as HTMLImageElement | undefined;
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const aspect = Math.min(1.8, Math.max(0.55, img.naturalWidth / img.naturalHeight));
      cardPlane.scale.set(aspect / (1.45 / 1.85), 1, 1);
    }
  });

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 18),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  const dummyGroup = new THREE.Group();
  const hitFlashMaterials = [cardMat, goldMat];

  const updateAnimation: AnimatedRunnerRig['updateAnimation'] = ({
    time,
    speed,
    stridePhase,
    y,
    grounded,
    hitFlash,
    squashX,
    squashY,
    celebrating,
    idleMode,
    lockedPose,
  }) => {
    cardMat.emissive.setHex(hitFlash ? 0xffffff : 0x000000);
    cardMat.emissiveIntensity = hitFlash ? 0.5 : 0;

    const shadowScale = Math.max(0.42, 1 - y * 0.22);
    shadowDisc.scale.setScalar(shadowScale);
    (shadowDisc.material as THREE.MeshBasicMaterial).opacity = 0.55 * shadowScale;

    if (celebrating) {
      const beat = time * 6.5;
      const hop = Math.abs(Math.sin(beat)) * 0.52;
      bodyPivot.position.y = hop;
      bodyPivot.rotation.set(0, time * 4.5, Math.sin(beat) * 0.22);
      bodyPivot.scale.set(1 - hop * 0.12, 1 + hop * 0.16, 1);
      return;
    }

    bodyPivot.rotation.y = 0;
    if (idleMode) {
      bodyPivot.position.y = lockedPose ? Math.abs(Math.sin(time * 6)) * 0.16 : Math.sin(time * 2.4) * 0.04;
      bodyPivot.rotation.set(0, 0, Math.sin(time * 2.4) * 0.04);
      bodyPivot.scale.set(1, 1, 1);
      return;
    }

    bodyPivot.scale.set(squashX, squashY, squashX);
    if (!grounded) {
      bodyPivot.position.y = y;
      bodyPivot.rotation.set(0.15, 0, 0);
    } else {
      const amp = Math.min(1, speed / 5.0);
      bodyPivot.position.y = y + Math.abs(Math.cos(stridePhase)) * 0.16 * amp;
      bodyPivot.rotation.set(0.08 * amp, 0, Math.sin(stridePhase) * 0.11 * amp);
    }
  };

  return {
    root,
    bodyPivot,
    headGroup: dummyGroup,
    leftArm: dummyGroup,
    rightArm: dummyGroup,
    leftLeg: dummyGroup,
    rightLeg: dummyGroup,
    spinAccessory: null,
    shadowDisc,
    hitFlashMaterials,
    updateAnimation,
  };
}

/**
 * Wraps an uploaded GLB/GLTF 3D model object as a playable Temple Runner rig
 * (auto-scaled to ~1.85m tall and grounded bottom-center!).
 */
export function buildCustomGltfRunnerRig(
  loadedModel: THREE.Object3D,
  textures: ProceduralTexturePack,
): AnimatedRunnerRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const clone = loadedModel.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 1.85 / maxDim;
  clone.scale.setScalar(scale);
  clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  bodyPivot.add(clone);

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 18),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  const dummy = new THREE.Group();
  const updateAnimation: AnimatedRunnerRig['updateAnimation'] = ({
    time,
    speed,
    stridePhase,
    y,
    grounded,
    squashX,
    squashY,
    celebrating,
    idleMode,
    lockedPose,
  }) => {
    const shadowScale = Math.max(0.42, 1 - y * 0.22);
    shadowDisc.scale.setScalar(shadowScale);
    (shadowDisc.material as THREE.MeshBasicMaterial).opacity = 0.55 * shadowScale;

    if (celebrating) {
      const beat = time * 6.5;
      const hop = Math.abs(Math.sin(beat)) * 0.5;
      bodyPivot.position.y = hop;
      bodyPivot.rotation.set(0, time * 4.8, Math.sin(beat) * 0.16);
      bodyPivot.scale.set(1 - hop * 0.1, 1 + hop * 0.14, 1 - hop * 0.1);
      return;
    }

    bodyPivot.rotation.y = 0;
    if (idleMode) {
      bodyPivot.position.y = lockedPose ? Math.abs(Math.sin(time * 6)) * 0.16 : Math.sin(time * 2.4) * 0.04;
      bodyPivot.rotation.set(0, 0, 0);
      bodyPivot.scale.set(1, 1, 1);
      return;
    }

    bodyPivot.scale.set(squashX, squashY, squashX);
    if (!grounded) {
      bodyPivot.position.y = y;
      bodyPivot.rotation.set(0.14, 0, 0);
    } else {
      const amp = Math.min(1, speed / 5.0);
      bodyPivot.position.y = y + Math.abs(Math.cos(stridePhase)) * 0.14 * amp;
      bodyPivot.rotation.set(0.1 * amp, 0, Math.sin(stridePhase) * 0.08 * amp);
    }
  };

  return {
    root,
    bodyPivot,
    headGroup: dummy,
    leftArm: dummy,
    rightArm: dummy,
    leftLeg: dummy,
    rightLeg: dummy,
    spinAccessory: null,
    shadowDisc,
    hitFlashMaterials: [],
    updateAnimation,
  };
}

/**
 * Builds composite 5-10 part 3D obstacle models with unmistakable visual reads
 */
export function buildObstacleMesh(
  kind: ObstacleKind,
  textures: ProceduralTexturePack,
): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stoneAlbedo,
    bumpMap: textures.stoneBump,
    bumpScale: 0.07,
    roughness: 0.82,
    metalness: 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    roughness: 0.3,
    metalness: 0.78,
  });
  const jadeMat = new THREE.MeshStandardMaterial({
    color: 0x15805d,
    roughness: 0.32,
    metalness: 0.25,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x2e6f40,
    roughness: 0.9,
    metalness: 0.0,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6b4322,
    roughness: 0.86,
    metalness: 0.04,
  });

  if (kind === 'low_pillar') {
    const cradleL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.92), stoneMat);
    cradleL.position.set(-0.72, 0.15, 0);
    const cradleR = cradleL.clone();
    cradleR.position.x = 0.72;
    group.add(cradleL, cradleR);

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.92, 14), stoneMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.y = 0.44;
    drum.castShadow = true;
    drum.receiveShadow = true;
    group.add(drum);

    const ringGeo = new THREE.TorusGeometry(0.4, 0.055, 8, 16);
    const ringL = new THREE.Mesh(ringGeo, goldMat);
    ringL.rotation.y = Math.PI / 2;
    ringL.position.set(-0.68, 0.44, 0);
    const ringR = ringL.clone();
    ringR.position.x = 0.68;
    group.add(ringL, ringR);

    const mossCap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.44), mossMat);
    mossCap.position.set(0.1, 0.82, 0);
    group.add(mossCap);
  } else if (kind === 'tall_totem') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.38, 1.28), stoneMat);
    base.position.y = 0.19;
    base.castShadow = true;
    base.receiveShadow = true;

    const mid = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.38, 0.98), stoneMat);
    mid.position.y = 1.05;
    mid.castShadow = true;

    const maskPlate = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.88, 0.2), jadeMat);
    maskPlate.position.set(0, 1.25, 0.47);
    const maskPlateBack = maskPlate.clone();
    maskPlateBack.position.z = -0.47;

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xea580c,
      emissiveIntensity: 0.9,
      roughness: 0.22,
    });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.08), eyeMat);
    eyeL.position.set(-0.22, 1.38, 0.57);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.22;
    const eyeLBack = eyeL.clone();
    eyeLBack.position.z = -0.57;
    const eyeRBack = eyeR.clone();
    eyeRBack.position.z = -0.57;

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.52, 0.48, 6), goldMat);
    crown.position.y = 1.98;
    crown.castShadow = true;

    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), jadeMat);
    finial.position.y = 2.38;

    group.add(base, mid, maskPlate, maskPlateBack, eyeL, eyeR, eyeLBack, eyeRBack, crown, finial);
  } else if (kind === 'vine_hurdle') {
    const postGeo = new THREE.BoxGeometry(0.48, 1.18, 0.48);
    const postL = new THREE.Mesh(postGeo, stoneMat);
    postL.position.set(-3.35, 0.59, 0);
    postL.castShadow = true;
    const postR = postL.clone();
    postR.position.x = 3.35;

    const capGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.22, 8);
    const capL = new THREE.Mesh(capGeo, goldMat);
    capL.position.set(-3.35, 1.24, 0);
    const capR = capL.clone();
    capR.position.x = 3.35;

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.7, 12), woodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.72;
    bar.castShadow = true;

    for (const lx of [-2.3, 0, 2.3]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.55, 12), goldMat);
      band.rotation.z = Math.PI / 2;
      band.position.set(lx, 0.72, 0);
      group.add(band);
    }

    const vine = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.2, 0.16), mossMat);
    vine.position.set(0, 0.54, 0.12);

    group.add(postL, postR, capL, capR, bar, vine);
  } else if (kind === 'broken_path_lane' || kind === 'broken_path_full') {
    const isFull = kind === 'broken_path_full';
    const pitWidth = isFull ? 7.5 : 2.15;
    const pitDepth = isFull ? 7.4 : 6.8;

    const abyssMat = new THREE.MeshBasicMaterial({ color: 0x071316 });
    const mistGlowMat = new THREE.MeshBasicMaterial({
      color: 0x0d7a74,
      transparent: true,
      opacity: 0.72,
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });

    // Deep canyon chasm void spanning the collapsed section of the stone causeway
    const chasm = new THREE.Mesh(new THREE.BoxGeometry(pitWidth, 0.08, pitDepth), abyssMat);
    chasm.position.y = 0.025;
    group.add(chasm);

    // Shimmering turquoise river-mist glow rising from the broken gorge below
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(pitWidth * 0.82, pitDepth * 0.62),
      mistGlowMat,
    );
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = 0.075;
    group.add(mist);

    // Jagged cracked stone lips & tilted collapsed slabs at front (+Z) and back (-Z) edges
    const slabCount = isFull ? 5 : 2;
    const spacing = pitWidth / slabCount;
    for (const edgeSign of [1, -1]) {
      const edgeZ = edgeSign * (pitDepth * 0.5);
      for (let i = 0; i < slabCount; i++) {
        const sx = -pitWidth * 0.5 + spacing * (i + 0.5);
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(spacing * 0.88, 0.24, 0.85),
          stoneMat,
        );
        slab.position.set(sx, 0.04, edgeZ - edgeSign * 0.24);
        slab.rotation.x = edgeSign * (0.28 + (i % 2) * 0.14);
        slab.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.08;
        group.add(slab);
      }

      // Bright amber-gold cracked-ledge hazard lip on front edge for instant high-speed readability
      if (edgeSign === 1) {
        const warnLip = new THREE.Mesh(
          new THREE.BoxGeometry(pitWidth * 0.96, 0.09, 0.24),
          hazardMat,
        );
        warnLip.position.set(0, 0.08, edgeZ + 0.18);
        group.add(warnLip);
      }
    }

    // Snapped wooden support beams jutting out over the broken gap
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 1.55), woodMat);
      beam.position.set(side * (pitWidth * 0.34), 0.09, pitDepth * 0.36);
      beam.rotation.x = 0.22;
      beam.rotation.y = side * 0.16;
      group.add(beam);
    }

    // Broken rubble boulders on left/right gap corners
    for (const side of [-1, 1]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), stoneMat);
      rock.position.set(side * (pitWidth * 0.44), 0.22, pitDepth * 0.48);
      group.add(rock);
    }
  }

  return group;
}

/**
 * Builds an imposing composite 11-part Ancient Trivia Guardian Monster with orbiting rune stones
 */
export function buildMonsterRig(
  monster: MonsterDef,
  textures: ProceduralTexturePack,
): AnimatedMonsterRig {
  const root = new THREE.Group();

  const runePlane = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 24),
    new THREE.MeshBasicMaterial({
      map: textures.runeDisc,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    }),
  );
  runePlane.rotation.x = -Math.PI / 2;
  runePlane.position.y = 0.03;
  root.add(runePlane);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: monster.primaryColor,
    map: textures.stoneAlbedo,
    bumpMap: textures.stoneBump,
    bumpScale: 0.06,
    roughness: 0.72,
    metalness: 0.14,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: monster.accentColor,
    roughness: 0.28,
    metalness: 0.78,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: monster.eyeColor,
    emissive: monster.eyeColor,
    emissiveIntensity: 1.15,
    roughness: 0.18,
  });

  const body = new THREE.Group();
  body.position.y = 0.35;
  root.add(body);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.42, 0.45, 8), primaryMat);
  plinth.position.y = 0.22;
  plinth.castShadow = true;
  body.add(plinth);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.68, 1.48, 1.22), primaryMat);
  torso.position.y = 1.25;
  torso.castShadow = true;
  body.add(torso);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.88, 0.36, 8), accentMat);
  collar.position.y = 2.02;
  body.add(collar);

  const head = new THREE.Mesh(new THREE.BoxGeometry(1.52, 1.16, 1.26), primaryMat);
  head.position.y = 2.75;
  head.castShadow = true;
  body.add(head);

  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.14), eyeMat);
  leftEye.position.set(-0.36, 2.86, 0.63);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.36;
  body.add(leftEye, rightEye);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.12), accentMat);
  mouth.position.set(0, 2.42, 0.62);
  body.add(mouth);

  // Orbiting glowing ancient rune stones
  const runeOrbit = new THREE.Group();
  runeOrbit.position.y = 1.95;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), eyeMat);
    stone.position.set(Math.cos(a) * 1.9, Math.sin(a * 2) * 0.25, Math.sin(a) * 1.9);
    runeOrbit.add(stone);
  }
  body.add(runeOrbit);

  if (monster.archetype === 'jaguar') {
    const earGeo = new THREE.ConeGeometry(0.28, 0.56, 6);
    const earL = new THREE.Mesh(earGeo, primaryMat);
    earL.position.set(-0.58, 3.55, 0.05);
    earL.rotation.z = 0.25;
    const earR = earL.clone();
    earR.position.x = 0.58;
    earR.rotation.z = -0.25;
    const sunCrest = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.09, 8, 16), accentMat);
    sunCrest.position.set(0, 3.65, -0.05);
    body.add(earL, earR, sunCrest);
  } else if (monster.archetype === 'owl') {
    const wingGeo = new THREE.BoxGeometry(0.95, 1.15, 0.22);
    const wingL = new THREE.Mesh(wingGeo, accentMat);
    wingL.position.set(-1.25, 1.45, 0);
    wingL.rotation.z = 0.3;
    const wingR = wingL.clone();
    wingR.position.x = 1.25;
    wingR.rotation.z = -0.3;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.44, 4), accentMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 2.66, 0.76);
    body.add(wingL, wingR, beak);
  } else {
    for (let i = -3; i <= 3; i++) {
      const plume = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.14), i % 2 === 0 ? accentMat : eyeMat);
      const a = i * 0.26;
      plume.position.set(Math.sin(a) * 1.15, 3.25 + Math.cos(a) * 0.55, -0.08);
      plume.rotation.z = -a;
      body.add(plume);
    }
  }

  const update: AnimatedMonsterRig['update'] = (time, mood) => {
    runePlane.rotation.z = time * 0.6;
    runeOrbit.rotation.y = time * 1.35;
    if (mood === 'happy') {
      body.position.x = THREE.MathUtils.lerp(body.position.x, 4.6, 0.08);
      body.position.y = 0.35 + Math.abs(Math.sin(time * 8)) * 0.35;
      body.rotation.y = Math.sin(time * 6) * 0.25;
    } else if (mood === 'grumpy') {
      body.position.x = THREE.MathUtils.lerp(body.position.x, 0, 0.12);
      body.position.y = 0.4 + Math.sin(time * 3) * 0.08;
      body.rotation.y = Math.sin(time * 14) * 0.22;
    } else {
      body.position.x = THREE.MathUtils.lerp(body.position.x, 0, 0.12);
      body.position.y = 0.35 + Math.sin(time * 2.8) * 0.14;
      body.rotation.y = Math.sin(time * 1.2) * 0.08;
    }
  };

  return { root, body, leftEye, rightEye, update };
}

/**
 * Builds a carved Temple Stone Archway with stepped capitals, hanging vines,
 * turquoise-and-gold sun keystone, and dual-layer flickering torch braziers.
 */
export function buildTempleArchway(textures: ProceduralTexturePack): {
  group: THREE.Group;
  flames: THREE.Mesh[];
} {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stoneAlbedo,
    bumpMap: textures.stoneBump,
    bumpScale: 0.07,
    roughness: 0.84,
    metalness: 0.04,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc28a26,
    roughness: 0.34,
    metalness: 0.74,
  });
  const jadeMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.36,
    metalness: 0.25,
  });
  const vineMat = new THREE.MeshStandardMaterial({
    color: 0x265e39,
    roughness: 0.86,
  });
  const outerFlameMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.85,
    roughness: 0.4,
  });
  const innerFlameMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
    roughness: 0.3,
  });

  const colGeo = new THREE.BoxGeometry(1.18, 6.2, 1.18);
  const colL = new THREE.Mesh(colGeo, stoneMat);
  colL.position.set(-4.5, 3.1, 0);
  const colR = colL.clone();
  colR.position.x = 4.5;

  // Stepped plinth bases & flared capitals
  const baseGeo = new THREE.BoxGeometry(1.62, 0.85, 1.62);
  const baseL = new THREE.Mesh(baseGeo, stoneMat);
  baseL.position.set(-4.5, 0.42, 0);
  const baseR = baseL.clone();
  baseR.position.x = 4.5;

  const capGeo = new THREE.BoxGeometry(1.58, 0.55, 1.58);
  const capL = new THREE.Mesh(capGeo, stoneMat);
  capL.position.set(-4.5, 5.7, 0);
  const capR = capL.clone();
  capR.position.x = 4.5;

  // Multi-tier carved lintel
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.8, 1.18, 1.45), stoneMat);
  lintel.position.set(0, 6.5, 0);
  const crownStep = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.52, 1.15), stoneMat);
  crownStep.position.set(0, 7.3, 0);

  const frieze = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.32, 1.54), goldMat);
  frieze.position.set(0, 6.5, 0);

  // Sun-disc keystone with turquoise inlaid heart
  const keystone = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.28, 16), goldMat);
  keystone.rotation.x = Math.PI / 2;
  keystone.position.set(0, 6.68, 0.72);
  const keystoneCore = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 14), jadeMat);
  keystoneCore.rotation.x = Math.PI / 2;
  keystoneCore.position.set(0, 6.68, 0.74);

  // Hanging jungle vines draped over the lintel corners
  for (const vx of [-3.2, -2.5, 2.7, 3.4]) {
    const vine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2 + (Math.abs(vx) % 1), 0.14), vineMat);
    vine.position.set(vx, 5.65, 0.74);
    group.add(vine);
  }

  // Twin torch braziers with inner/outer layered flames
  const flames: THREE.Mesh[] = [];
  for (const sx of [-3.75, 3.75]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4), stoneMat);
    bracket.position.set(sx + (sx < 0 ? -0.25 : 0.25), 2.15, 0.45);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.36, 10), goldMat);
    bowl.position.set(sx, 2.38, 0.45);
    const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.66, 8), outerFlameMat);
    outerFlame.position.set(sx, 2.84, 0.45);
    const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 7), innerFlameMat);
    innerFlame.position.set(sx, 2.74, 0.46);
    group.add(bracket, bowl, outerFlame, innerFlame);
    flames.push(outerFlame, innerFlame);
  }

  group.add(colL, colR, baseL, baseR, capL, capR, lintel, crownStep, frieze, keystone, keystoneCore);
  return { group, flames };
}

/** Builds a lush composite Jungle Palm Tree with curved segmented trunk, coconuts, and 8 arched multi-segment fronds */
export function buildJunglePalm(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4b32,
    roughness: 0.9,
    metalness: 0.02,
  });
  const barkRingMat = new THREE.MeshStandardMaterial({
    color: 0x4f3522,
    roughness: 0.92,
  });
  const leafDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1e563b,
    roughness: 0.68,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const leafLightMat = new THREE.MeshStandardMaterial({
    color: 0x347d4e,
    roughness: 0.62,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  // 5 gently curving trunk segments with bark collars
  let y = 0;
  let x = 0;
  for (let i = 0; i < 5; i++) {
    const rTop = 0.25 - i * 0.026;
    const rBot = 0.31 - i * 0.026;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1.38, 8), trunkMat);
    seg.position.set(x, y + 0.68, 0);
    seg.rotation.z = -0.055 * i;
    group.add(seg);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(rTop + 0.01, 0.03, 6, 10), barkRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x + 0.03 * i, y + 1.3, 0);
    group.add(ring);

    y += 1.32;
    x += 0.095 * i;
  }

  // Crown + coconut cluster + 8 curved arched fronds (2 segments each so they droop gracefully!)
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);

  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI * 2;
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), barkRingMat);
    nut.position.set(Math.cos(a) * 0.24, -0.15, Math.sin(a) * 0.24);
    crown.add(nut);
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.14;
    const mat = i % 2 === 0 ? leafLightMat : leafDarkMat;
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = a;

    // Inner rising frond segment
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.62), mat);
    inner.position.set(0.75, 0.28, 0);
    inner.rotation.z = 0.28;
    frondPivot.add(inner);

    // Outer gracefully drooping tip segment
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.85, 4), mat);
    tip.scale.set(1, 1, 0.2);
    tip.position.set(2.1, 0.1, 0);
    tip.rotation.z = -1.92;
    frondPivot.add(tip);

    crown.add(frondPivot);
  }
  group.add(crown);
  return group;
}

/** Lush tropical fern cluster flanking temple causeway parapets */
export function buildJungleFernCluster(): THREE.Group {
  const group = new THREE.Group();
  const fernMat = new THREE.MeshStandardMaterial({
    color: 0x2a6b43,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.35, 4), fernMat);
    leaf.scale.set(1, 1, 0.18);
    leaf.position.set(Math.cos(a) * 0.45, 0.42, Math.sin(a) * 0.45);
    leaf.rotation.y = -a + Math.PI / 2;
    leaf.rotation.x = 0.95;
    group.add(leaf);
  }
  return group;
}

/** Multi-tier Stepped Mayan Ziggurat Pyramid landmark for the jungle valley backdrop */
export function buildSteppedPyramid(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xc29e70,
    map: textures.stoneAlbedo,
    roughness: 0.88,
    metalness: 0.03,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x2e5e3b,
    roughness: 0.92,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9922c,
    roughness: 0.35,
    metalness: 0.75,
  });

  // 5 stepped stone terraces
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const w = 22 - i * 3.6;
    const h = 3.2;
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), stoneMat);
    tier.position.y = i * h + h * 0.5;
    group.add(tier);

    // Subtle moss trim strip on lower terraces
    if (i < 3) {
      const moss = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.35, w + 0.15), mossMat);
      moss.position.y = i * h + 0.35;
      group.add(moss);
    }
  }

  // Central stone staircase ramp
  const stair = new THREE.Mesh(new THREE.BoxGeometry(4.2, 16.2, 12), stoneMat);
  stair.position.set(0, 7.6, 5.5);
  stair.rotation.x = 0.48;
  group.add(stair);

  // Summit shrine sanctuary + golden sun roof ornament
  const shrine = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 4.8), stoneMat);
  shrine.position.y = tiers * 3.2 + 1.7;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.75, 5.4), goldMat);
  roof.position.y = tiers * 3.2 + 3.65;
  group.add(shrine, roof);

  return group;
}

/** Monumental Golden Sun Temple Finish Gate at 3,000 m */
export function buildFinishSunGate(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stoneAlbedo,
    bumpMap: textures.stoneBump,
    bumpScale: 0.06,
    roughness: 0.75,
    metalness: 0.08,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    emissive: 0x92400e,
    emissiveIntensity: 0.3,
    roughness: 0.24,
    metalness: 0.85,
  });
  const turquoiseMat = new THREE.MeshStandardMaterial({
    color: 0x14b8a6,
    emissive: 0x0f766e,
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.25,
  });

  for (const sx of [-4.6, 4.6]) {
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 1.9), stoneMat);
    pedestal.position.set(sx, 0.6, 0);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.96, 7.6, 4), stoneMat);
    tower.rotation.y = Math.PI / 4;
    tower.position.set(sx, 4.8, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.5, 4), goldMat);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(sx, 9.3, 0);
    group.add(pedestal, tower, cap);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.4, 1.6), goldMat);
  beam.position.set(0, 7.9, 0);
  const sunWheel = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.22, 10, 20), goldMat);
  sunWheel.position.set(0, 9.6, 0);
  const sunCore = new THREE.Mesh(new THREE.CircleGeometry(1.18, 20), turquoiseMat);
  sunCore.position.set(0, 9.6, 0.05);
  const sunCoreBack = sunCore.clone();
  sunCoreBack.rotation.y = Math.PI;
  sunCoreBack.position.z = -0.05;

  for (let i = -3; i <= 3; i++) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.06, 1.1),
      i % 2 === 0 ? goldMat : turquoiseMat,
    );
    tile.position.set(i * 1.05, 0.03, 0);
    group.add(tile);
  }

  group.add(beam, sunWheel, sunCore, sunCoreBack);
  return group;
}

/** Towering Emerald Jungle Cliff with Cascading Turquoise Waterfall & Frothy Mist Base */
export function buildJungleCliffWaterfall(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x5c513c,
    map: textures.stoneAlbedo,
    roughness: 0.92,
    metalness: 0.02,
  });
  const mossCapMat = new THREE.MeshStandardMaterial({
    color: 0x26633d,
    roughness: 0.88,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: 0x0f766e,
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88,
  });
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xe6fffa,
    emissive: 0x99f6e4,
    emissiveIntensity: 0.5,
    roughness: 0.4,
    transparent: true,
    opacity: 0.85,
  });

  // Layered canyon rock cliff body
  const cliffLower = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 13.5, 20, 7), cliffMat);
  cliffLower.position.y = 10;
  const cliffUpper = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 8.8, 12, 7), cliffMat);
  cliffUpper.position.set(-0.8, 25, -0.5);
  const mossTop = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.4, 1.4, 7), mossCapMat);
  mossTop.position.set(-0.8, 31.2, -0.5);
  group.add(cliffLower, cliffUpper, mossTop);

  // Cascading turquoise waterfall sheet + white foam splash plumes
  const cascade = new THREE.Mesh(new THREE.BoxGeometry(3.8, 29, 0.65), waterMat);
  cascade.position.set(0, 15.2, 7.6);
  cascade.rotation.x = -0.14;
  group.add(cascade);

  for (const fx of [-1.0, 0.2, 1.1]) {
    const streak = new THREE.Mesh(new THREE.BoxGeometry(0.42, 26, 0.72), foamMat);
    streak.position.set(fx, 14.8, 7.72);
    streak.rotation.x = -0.14;
    group.add(streak);
  }

  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + (i % 2) * 0.55, 1), foamMat);
    puff.position.set((i - 2) * 1.15, 0.8 + (i % 2) * 0.4, 9.6);
    group.add(puff);
  }

  return group;
}

/** Colossal Ancient Carved Temple Guardian Monolith overlooking the jungle canyon */
export function buildColossalTempleGuardian(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xa88a62,
    map: textures.stoneAlbedo,
    roughness: 0.86,
    metalness: 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    roughness: 0.3,
    metalness: 0.8,
  });
  const eyeGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });
  const jadeMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.35,
    metalness: 0.25,
  });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.5, 5, 8.5), stoneMat);
  plinth.position.y = 2.5;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(6.4, 11, 5.2), stoneMat);
  torso.position.y = 10.5;
  const chestDisk = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.6, 14), goldMat);
  chestDisk.rotation.x = Math.PI / 2;
  chestDisk.position.set(0, 11.5, 2.75);
  const head = new THREE.Mesh(new THREE.BoxGeometry(5.6, 5.8, 5.0), stoneMat);
  head.position.y = 19;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.4), eyeGlowMat);
  eyeL.position.set(-1.35, 19.6, 2.55);
  const eyeR = eyeL.clone();
  eyeR.position.x = 1.35;
  const crownBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.5, 4.6), goldMat);
  crownBase.position.y = 22.6;
  const crownGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), jadeMat);
  crownGem.position.set(0, 24.8, 0.6);
  group.add(plinth, torso, chestDisk, head, eyeL, eyeR, crownBase, crownGem);
  return group;
}

/** Weathered Ruined Jungle Aqueduct Arch bridging the valley sides */
export function buildRuinedAqueductArch(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xb39368,
    map: textures.stoneAlbedo,
    roughness: 0.88,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x2a613c,
    roughness: 0.92,
  });

  for (const px of [-9, 0, 9]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 22, 2.8), stoneMat);
    pillar.position.set(px, 11, 0);
    group.add(pillar);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(23, 2.4, 3.2), stoneMat);
  deck.position.y = 22.4;
  const mossDeck = new THREE.Mesh(new THREE.BoxGeometry(21, 0.55, 3.4), mossMat);
  mossDeck.position.y = 23.75;
  group.add(deck, mossDeck);
  return group;
}
