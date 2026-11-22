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

const animeFaceTextureCache = new Map<string, THREE.CanvasTexture>();

function getAnimeFaceTexture(
  charId: CharacterDef['id'],
  skinHex: string,
  eyeMainHex: string,
  eyeDeepHex: string,
  hairHex: string,
): THREE.CanvasTexture {
  const cached = animeFaceTextureCache.get(charId);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base warm anime skin fill
  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 512, 512);

  // Soft vertical studio face shading (subtle forehead warmth + gentle chin shadow)
  const faceShade = ctx.createRadialGradient(256, 252, 24, 256, 265, 160);
  faceShade.addColorStop(0, 'rgba(255, 250, 245, 0.24)');
  faceShade.addColorStop(0.68, 'rgba(255, 232, 220, 0.0)');
  faceShade.addColorStop(1, 'rgba(180, 120, 102, 0.16)');
  ctx.fillStyle = faceShade;
  ctx.fillRect(0, 0, 512, 512);

  // Soft rosy anime cheek blush
  for (const side of [-1, 1]) {
    const bx = 256 + side * 38;
    const by = 294;
    const blush = ctx.createRadialGradient(bx, by, 1, bx, by, 18);
    blush.addColorStop(0, 'rgba(244, 114, 132, 0.34)');
    blush.addColorStop(1, 'rgba(244, 114, 132, 0)');
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.ellipse(bx, by, 16, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const isMale = charId === 'qiuyuan';
  const eyeY = isMale ? 264 : 268;
  const eyeRx = isMale ? 13.5 : 14.5;
  const eyeRy = isMale ? 17.5 : 24.0;
  const eyeSpacing = isMale ? 27 : 26;

  // Draw crisp, high-art anime eyes (remember: equirectangular sphere compresses X by 2x vs Y!)
  for (const side of [-1, 1]) {
    const cx = 256 + side * eyeSpacing;

    // Phrolova's crisp diagonal white eyepatch covers her right eye (side === -1, viewer's left)
    if (charId === 'phrolova' && side === -1) {
      // Subtle eyepatch bandage ribbon running diagonally across temple to nose bridge
      ctx.save();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(155, 215);
      ctx.lineTo(252, 285);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(155, 290);
      ctx.lineTo(248, 250);
      ctx.stroke();

      // Main white sculpted eyepatch pad with subtle cloth shading
      ctx.translate(cx - 2, eyeY + 2);
      ctx.rotate(0.18);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 21, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      continue;
    }

    // Eyebrow
    ctx.save();
    ctx.strokeStyle = hairHex;
    ctx.lineWidth = isMale ? 5 : 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - side * 14, eyeY - eyeRy - 12);
    ctx.quadraticCurveTo(cx, eyeY - eyeRy - 17, cx + side * 14, eyeY - eyeRy - 10);
    ctx.stroke();
    ctx.restore();

    // White sclera with soft upper eyelid shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();

    // Upper sclera soft shadow
    const scleraGrad = ctx.createLinearGradient(cx, eyeY - eyeRy, cx, eyeY + eyeRy);
    scleraGrad.addColorStop(0, 'rgba(130, 140, 175, 0.35)');
    scleraGrad.addColorStop(0.32, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = scleraGrad;
    ctx.fillRect(cx - eyeRx, eyeY - eyeRy, eyeRx * 2, eyeRy * 2);

    // Shimmering layered anime iris
    const irisRx = eyeRx * 0.72;
    const irisRy = eyeRy * 0.84;
    const irisGrad = ctx.createLinearGradient(cx, eyeY - irisRy, cx, eyeY + irisRy);
    irisGrad.addColorStop(0, eyeDeepHex);
    irisGrad.addColorStop(0.45, eyeMainHex);
    irisGrad.addColorStop(0.85, '#fff5fa');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(cx - side * 1, eyeY + 2, irisRx, irisRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep pupil
    ctx.fillStyle = '#18131d';
    ctx.beginPath();
    ctx.ellipse(cx - side * 1, eyeY + 1, irisRx * 0.48, irisRy * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twin bright anime star catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx + 4, eyeY - 8, 3.6, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - 4.5, eyeY + 9, 2.0, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bold sweeping upper anime eyelash wing
    ctx.save();
    ctx.strokeStyle = '#14101a';
    ctx.lineWidth = isMale ? 5.5 : 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - side * (eyeRx + 1), eyeY - eyeRy * 0.25);
    ctx.quadraticCurveTo(cx, eyeY - eyeRy - 5, cx + side * (eyeRx + 3.5), eyeY - eyeRy * 0.15);
    ctx.stroke();

    // Delicate lower lash accent
    ctx.strokeStyle = 'rgba(30, 22, 34, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - eyeRx * 0.55, eyeY + eyeRy - 1);
    ctx.quadraticCurveTo(cx, eyeY + eyeRy + 2, cx + eyeRx * 0.55, eyeY + eyeRy - 1);
    ctx.stroke();
    ctx.restore();
  }

  // Subtle anime nose shadow accent
  ctx.fillStyle = 'rgba(175, 118, 102, 0.45)';
  ctx.beginPath();
  ctx.ellipse(257, 304, 1.8, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Refined character-matched anime mouth (graceful, poised — never cartoonish!)
  ctx.save();
  ctx.strokeStyle = isMale ? '#8b5e58' : '#b85d66';
  ctx.lineWidth = 3.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (charId === 'iuno') {
    // Bright cheerful confident smile
    ctx.moveTo(247, 325);
    ctx.quadraticCurveTo(256, 333, 265, 324);
  } else if (charId === 'augusta' || charId === 'galbrena' || charId === 'qiuyuan') {
    // Cool, composed warrior smirk
    ctx.moveTo(248, 327);
    ctx.quadraticCurveTo(257, 329, 265, 324);
  } else {
    // Poised serene anime mouth (Chisa & Phrolova)
    ctx.moveTo(249, 327);
    ctx.quadraticCurveTo(256, 330, 263, 327);
  }
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  animeFaceTextureCache.set(charId, tex);
  return tex;
}

/**
 * Builds 6 custom articulated 3D anime-stylized humanoid character models modeled after
 * Chisa, Galbrena, Augusta, Iuno, Phrolova, and Qiuyuan — complete with sculpted anime heads,
 * high-resolution painted anime faces, non-masking layered 3D hairstyles, contoured outfits,
 * flowing hair/capes/twin-tails, running/jump kinetics, pedestal spin-jump, and 3D Victory Dance!
 */
export function buildRunnerRig(
  charDef: CharacterDef,
  textures: ProceduralTexturePack,
): AnimatedRunnerRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const isMale = charDef.id === 'qiuyuan';
  if (isMale) {
    bodyPivot.scale.set(1.04, 1.05, 1.04);
  }

  // Per-character bespoke palette & materials
  const paletteMap: Record<
    CharacterDef['id'],
    {
      hair: number;
      hairHex: string;
      hairAccent: number;
      eye: number;
      eyeMainHex: string;
      eyeDeepHex: string;
      top: number;
      topTrim: number;
      bottom: number;
      legLower: number;
      boot: number;
      sleeve: number;
      glove: number;
      metal: number;
      skin: number;
      skinHex: string;
    }
  > = {
    chisa: {
      hair: 0x181820,
      hairHex: '#181820',
      hairAccent: 0xdc2626,
      eye: 0xe11d48,
      eyeMainHex: '#f43f5e',
      eyeDeepHex: '#881337',
      top: 0x22232c,
      topTrim: 0xf4f4f6,
      bottom: 0x1b1c24,
      legLower: 0x18181f,
      boot: 0x111116,
      sleeve: 0x22232c,
      glove: 0xfbe5db,
      metal: 0xdc2626,
      skin: 0xfbe5db,
      skinHex: '#fbe5db',
    },
    galbrena: {
      hair: 0xe8eff8,
      hairHex: '#94a3b8',
      hairAccent: 0x94a3b8,
      eye: 0x8b5cf6,
      eyeMainHex: '#a78bfa',
      eyeDeepHex: '#4c1d95',
      top: 0x1d4ed8,
      topTrim: 0x1b1d24,
      bottom: 0x181a22,
      legLower: 0x1c202a,
      boot: 0x11131a,
      sleeve: 0x191b22,
      glove: 0x181a22,
      metal: 0xcbd5e1,
      skin: 0xfae3da,
      skinHex: '#fae3da',
    },
    augusta: {
      hair: 0xe64310,
      hairHex: '#b92e0a',
      hairAccent: 0xf97316,
      eye: 0xea580c,
      eyeMainHex: '#fb923c',
      eyeDeepHex: '#9a3412',
      top: 0xf7f2e8,
      topTrim: 0xe6b43c,
      bottom: 0xf4efe4,
      legLower: 0xf7dbc9,
      boot: 0xd9a432,
      sleeve: 0xf7dbc9,
      glove: 0xd9a432,
      metal: 0xf2c249,
      skin: 0xf7dbc9,
      skinHex: '#f7dbc9',
    },
    iuno: {
      hair: 0x1d47b8,
      hairHex: '#1e3a8a',
      hairAccent: 0x38bdf8,
      eye: 0x38bdf8,
      eyeMainHex: '#38bdf8',
      eyeDeepHex: '#1d4ed8',
      top: 0xfafbfd,
      topTrim: 0xe2b243,
      bottom: 0xf8fafc,
      legLower: 0xfbe4dc,
      boot: 0x1e40af,
      sleeve: 0xfbe4dc,
      glove: 0xe2b243,
      metal: 0xebc252,
      skin: 0xfbe4dc,
      skinHex: '#fbe4dc',
    },
    phrolova: {
      hair: 0xbdccc3,
      hairHex: '#64746b',
      hairAccent: 0x94a89d,
      eye: 0xe11d48,
      eyeMainHex: '#fb7185',
      eyeDeepHex: '#9f1239',
      top: 0x1c171b,
      topTrim: 0xdc2626,
      bottom: 0xb91c1c,
      legLower: 0x1a1519,
      boot: 0x141013,
      sleeve: 0xdc2626,
      glove: 0xb91c1c,
      metal: 0xef4444,
      skin: 0xfce9e4,
      skinHex: '#fce9e4',
    },
    qiuyuan: {
      hair: 0x16241f,
      hairHex: '#16241f',
      hairAccent: 0x10b981,
      eye: 0x10b981,
      eyeMainHex: '#34d399',
      eyeDeepHex: '#065f46',
      top: 0x1d2422,
      topTrim: 0x059669,
      bottom: 0x161b1a,
      legLower: 0x141918,
      boot: 0x0e1211,
      sleeve: 0x1d2422,
      glove: 0x2a3330,
      metal: 0x34d399,
      skin: 0xf6e0d2,
      skinHex: '#f6e0d2',
    },
  };

  const p = paletteMap[charDef.id];
  const mat = (
    color: number,
    roughness = 0.58,
    metalness = 0.08,
    emissive = 0x000000,
    ei = 0,
    doubleSide = false,
  ) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity: ei,
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });

  const skinMat = mat(p.skin, 0.65, 0.02);
  const hairMat = mat(p.hair, 0.42, 0.14, 0x000000, 0, true);
  const hairAccentMat = mat(p.hairAccent, 0.38, 0.18, 0x000000, 0, true);
  const topMat = mat(p.top, 0.52, 0.12);
  const trimMat = mat(p.topTrim, 0.4, 0.24, 0x000000, 0, true);
  const bottomMat = mat(p.bottom, 0.55, 0.1, 0x000000, 0, true);
  const legLowerMat = mat(p.legLower, 0.54, 0.08);
  const bootMat = mat(p.boot, 0.4, 0.22);
  const sleeveMat = mat(p.sleeve, 0.52, 0.12);
  const gloveMat = mat(p.glove, 0.46, 0.16);
  const metalMat = mat(p.metal, 0.22, 0.85);
  const whiteMat = mat(0xffffff, 0.24, 0.04, 0x000000, 0, true);
  const darkMat = mat(0x141218, 0.28, 0.1);
  const eyeIrisMat = mat(p.eye, 0.18, 0.15, p.eye, 0.45);
  const glowMat = mat(charDef.primaryColor, 0.2, 0.2, charDef.primaryColor, 0.72);

  const faceTex = getAnimeFaceTexture(charDef.id, p.skinHex, p.eyeMainHex, p.eyeDeepHex, p.hairHex);
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    roughness: 0.62,
    metalness: 0.02,
  });

  const hitFlashMaterials = [topMat, trimMat, hairMat, skinMat, faceMat, bottomMat];
  const flowingParts: { obj: THREE.Object3D; baseX: number; baseZ: number; phase: number; amp: number }[] = [];
  let spinAccessory: THREE.Object3D | null = null;

  // ── 1. SLEEK ARTICULATED ANIME LEGS (Hip pivot at y = 0.86) ──
  const makeLeg = (xOffset: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.86, 0);

    const upperLegMat =
      charDef.id === 'chisa' || charDef.id === 'iuno' || charDef.id === 'augusta'
        ? skinMat
        : bottomMat;
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.1 : 0.086, isMale ? 0.082 : 0.068, 0.39, 12),
      upperLegMat,
    );
    thigh.position.y = -0.19;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.08 : 0.066, isMale ? 0.062 : 0.052, 0.35, 12),
      legLowerMat,
    );
    calf.position.y = -0.52;
    calf.castShadow = true;
    legGroup.add(calf);

    const bootShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.076 : 0.066, isMale ? 0.068 : 0.058, 0.22, 12),
      bootMat,
    );
    bootShaft.position.y = -0.68;
    const bootCuff = new THREE.Mesh(
      new THREE.TorusGeometry(isMale ? 0.074 : 0.064, 0.014, 6, 14),
      metalMat,
    );
    bootCuff.rotation.x = Math.PI / 2;
    bootCuff.position.y = -0.58;

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(isMale ? 0.145 : 0.125, 0.095, isMale ? 0.25 : 0.21),
      bootMat,
    );
    foot.position.set(0, -0.805, 0.042);
    foot.castShadow = true;
    legGroup.add(bootShaft, bootCuff, foot);

    return legGroup;
  };

  const leftLeg = makeLeg(isMale ? -0.13 : -0.11);
  const rightLeg = makeLeg(isMale ? 0.13 : 0.11);
  bodyPivot.add(leftLeg, rightLeg);

  // ── 2. CONTOURED ANIME TORSO, WAIST, SKIRT / COAT TAIL & OUTFIT DETAILS ──
  const torsoPts = isMale
    ? [
        new THREE.Vector2(0.165, 0.0),
        new THREE.Vector2(0.155, 0.14),
        new THREE.Vector2(0.19, 0.36),
        new THREE.Vector2(0.225, 0.54),
        new THREE.Vector2(0.12, 0.6),
      ]
    : [
        new THREE.Vector2(0.14, 0.0),
        new THREE.Vector2(0.122, 0.14),
        new THREE.Vector2(0.168, 0.34),
        new THREE.Vector2(0.172, 0.5),
        new THREE.Vector2(0.095, 0.57),
      ];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 18), topMat);
  torso.position.y = 0.94;
  torso.scale.set(1.1, 1, 0.72);
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Exposed slender midriff for Galbrena
  if (charDef.id === 'galbrena') {
    const midriff = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.145, 0.15, 16), skinMat);
    midriff.position.y = 1.01;
    midriff.scale.set(1.08, 1, 0.72);
    bodyPivot.add(midriff);
  }

  // Graceful flared skirt / dress / martial tunic hem
  if (charDef.id === 'chisa' || charDef.id === 'augusta' || charDef.id === 'iuno' || charDef.id === 'phrolova') {
    const skirtH = charDef.id === 'augusta' ? 0.44 : 0.37;
    const skirtBottom = charDef.id === 'iuno' || charDef.id === 'augusta' ? 0.31 : 0.29;
    const skirtPts = [
      new THREE.Vector2(skirtBottom, 0.0),
      new THREE.Vector2(skirtBottom * 0.82, skirtH * 0.48),
      new THREE.Vector2(0.148, skirtH),
    ];
    const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtPts, 20), bottomMat);
    skirt.position.y = 0.96 - skirtH;
    skirt.scale.set(1.06, 1, 0.84);
    skirt.castShadow = true;
    bodyPivot.add(skirt);

    const hemTrim = new THREE.Mesh(
      new THREE.TorusGeometry(skirtBottom * 0.99, 0.015, 6, 20),
      trimMat,
    );
    hemTrim.rotation.x = Math.PI / 2;
    hemTrim.scale.set(1.06, 0.84, 1);
    hemTrim.position.y = 0.96 - skirtH + 0.01;
    bodyPivot.add(hemTrim);
  } else {
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.185, 0.2, 16), bottomMat);
    pelvis.position.y = 0.88;
    pelvis.scale.set(1.12, 1, 0.78);
    bodyPivot.add(pelvis);
  }

  // Waist belt / celestial sash
  const waistW = isMale ? 0.165 : 0.132;
  const waistBelt = new THREE.Mesh(new THREE.TorusGeometry(waistW * 1.08, 0.025, 8, 20), trimMat);
  waistBelt.rotation.x = Math.PI / 2;
  waistBelt.scale.set(1.08, 0.74, 1);
  waistBelt.position.y = 0.96;
  bodyPivot.add(waistBelt);

  // Slender neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.068, 0.15, 12), skinMat);
  neck.position.y = 1.54;
  bodyPivot.add(neck);

  // Character-specific iconic outfit overlays (readable from BOTH front & back!)
  if (charDef.id === 'chisa') {
    const choker = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.014, 6, 14), darkMat);
    choker.rotation.x = Math.PI / 2;
    choker.position.y = 1.53;
    const sailorCollar = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.036, 6, 18), whiteMat);
    sailorCollar.rotation.x = Math.PI / 2;
    sailorCollar.scale.set(1.18, 0.84, 1);
    sailorCollar.position.y = 1.47;
    const backFlap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.035), whiteMat);
    backFlap.position.set(0, 1.38, -0.13);
    backFlap.rotation.x = 0.12;
    const redTie = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.2, 4), hairAccentMat);
    redTie.position.set(0, 1.35, 0.135);
    redTie.rotation.x = Math.PI;
    bodyPivot.add(choker, sailorCollar, backFlap, redTie);
  } else if (charDef.id === 'galbrena') {
    const choker = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.016, 6, 14), darkMat);
    choker.rotation.x = Math.PI / 2;
    choker.position.y = 1.53;
    const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.08), trimMat);
    jacketBack.position.set(0, 1.34, -0.095);
    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.08), trimMat);
    lapelL.position.set(-0.135, 1.34, 0.08);
    const lapelR = lapelL.clone();
    lapelR.position.x = 0.135;
    for (let i = -2; i <= 2; i++) {
      const stud = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.038), metalMat);
      stud.position.set(i * 0.068, 0.94, 0.13);
      bodyPivot.add(stud);
    }
    const hipSash = new THREE.Group();
    hipSash.position.set(-0.15, 0.9, -0.11);
    const feather1 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 5), darkMat);
    feather1.position.set(0, -0.2, 0);
    feather1.rotation.x = Math.PI + 0.18;
    const feather2 = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.36, 5), topMat);
    feather2.position.set(0.07, -0.18, -0.02);
    feather2.rotation.x = Math.PI + 0.22;
    hipSash.add(feather1, feather2);
    flowingParts.push({ obj: hipSash, baseX: 0.22, baseZ: 0.12, phase: 0.5, amp: 0.18 });
    bodyPivot.add(choker, jacketBack, lapelL, lapelR, hipSash);
  } else if (charDef.id === 'augusta') {
    const highCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.086, 0.12, 14), darkMat);
    highCollar.position.y = 1.52;
    const goldBreastplate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.122, 0.34, 14), metalMat);
    goldBreastplate.position.set(0, 1.2, 0.025);
    goldBreastplate.scale.set(1.06, 1, 0.72);
    const sunEmblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glowMat);
    sunEmblem.position.set(0, 1.4, 0.145);
    const capeGroup = new THREE.Group();
    capeGroup.position.set(0, 1.45, -0.13);
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.035), topMat);
    cape.position.y = -0.44;
    cape.castShadow = true;
    const capeGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.07, 0.04), metalMat);
    capeGoldTrim.position.y = -0.87;
    capeGroup.add(cape, capeGoldTrim);
    flowingParts.push({ obj: capeGroup, baseX: 0.18, baseZ: 0, phase: 0, amp: 0.2 });
    bodyPivot.add(highCollar, goldBreastplate, sunEmblem, capeGroup);
  } else if (charDef.id === 'iuno') {
    const goldNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.09, 14), metalMat);
    goldNeck.position.y = 1.52;
    // Celestial golden shoulder ribbon trim
    const chestGold = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.015, 6, 16), metalMat);
    chestGold.rotation.x = Math.PI / 2;
    chestGold.scale.set(1.08, 0.74, 1);
    chestGold.position.y = 1.28;
    for (let i = -2; i <= 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 12), metalMat);
      ring.position.set(i * 0.074, 0.97, 0.128);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 8), eyeIrisMat);
      gem.position.set(i * 0.074, 0.97, 0.132);
      bodyPivot.add(ring, gem);
    }
    const ribbonGroup = new THREE.Group();
    ribbonGroup.position.set(0, 0.96, -0.15);
    const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), whiteMat);
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.66, 0.025), whiteMat);
    tailL.position.set(-0.09, -0.33, 0);
    tailL.rotation.z = -0.14;
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.66, 0.025), hairMat);
    tailR.position.set(0.09, -0.33, 0);
    tailR.rotation.z = 0.14;
    ribbonGroup.add(bowCenter, tailL, tailR);
    flowingParts.push({ obj: ribbonGroup, baseX: 0.22, baseZ: 0, phase: 1.1, amp: 0.22 });
    bodyPivot.add(goldNeck, chestGold, ribbonGroup);
  } else if (charDef.id === 'phrolova') {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.084, 0.11, 14), darkMat);
    collar.position.y = 1.52;
    const whiteInsert = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.24, 10), whiteMat);
    whiteInsert.position.set(0, 1.26, 0.08);
    whiteInsert.scale.set(1, 1, 0.6);
    const coatGroup = new THREE.Group();
    coatGroup.position.set(0, 1.0, -0.13);
    const coatL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.032), trimMat);
    coatL.position.set(-0.11, -0.32, 0);
    coatL.rotation.z = -0.12;
    const coatR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.032), trimMat);
    coatR.position.set(0.11, -0.32, 0);
    coatR.rotation.z = 0.12;
    coatGroup.add(coatL, coatR);
    flowingParts.push({ obj: coatGroup, baseX: 0.2, baseZ: 0, phase: 0.6, amp: 0.22 });

    // Sculpted 3D Crimson Spider Lily orbiting beside her shoulder
    const lilyGroup = new THREE.Group();
    lilyGroup.position.set(-0.36, 1.46, 0.16);
    const lilyCenter = new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 8), glowMat);
    lilyGroup.add(lilyCenter);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.17, 5), trimMat);
      petal.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.015);
      petal.rotation.z = a - Math.PI / 2;
      lilyGroup.add(petal);
    }
    spinAccessory = lilyGroup;
    bodyPivot.add(collar, whiteInsert, coatGroup, lilyGroup);
  } else {
    // Qiuyuan — Sleek dark martial turtleneck, crisp white cross-collar, jade trim & flowing martial coat
    const turtle = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.095, 0.13, 14), darkMat);
    turtle.position.y = 1.53;
    const whiteSash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.06), whiteMat);
    whiteSash.position.set(0, 1.24, 0.12);
    const jadeTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.07), trimMat);
    jadeTrimL.position.set(-0.11, 1.24, 0.125);
    const jadeTrimR = jadeTrimL.clone();
    jadeTrimR.position.x = 0.11;
    const coatGroup = new THREE.Group();
    coatGroup.position.set(0, 1.0, -0.14);
    const coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.76, 0.042), topMat);
    coatTail.position.y = -0.38;
    const coatJadeHem = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.065, 0.046), trimMat);
    coatJadeHem.position.y = -0.73;
    coatGroup.add(coatTail, coatJadeHem);
    flowingParts.push({ obj: coatGroup, baseX: 0.16, baseZ: 0, phase: 0.4, amp: 0.18 });
    bodyPivot.add(turtle, whiteSash, jadeTrimL, jadeTrimR, coatGroup);
  }

  // ── 3. SLEEK ARTICULATED ARMS (Natural shoulder tuck, no oversized toy balls) ──
  const makeArm = (xOffset: number) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(xOffset, 1.43, 0);

    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(isMale ? 0.072 : 0.058, 12, 10),
      sleeveMat,
    );
    shoulder.scale.set(0.95, 1.0, 0.88);
    armGroup.add(shoulder);

    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.062 : 0.05, isMale ? 0.052 : 0.042, 0.27, 10),
      sleeveMat,
    );
    upper.position.y = -0.14;
    upper.castShadow = true;
    armGroup.add(upper);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.054 : 0.044, isMale ? 0.046 : 0.038, 0.24, 10),
      charDef.id === 'phrolova' || charDef.id === 'galbrena' || charDef.id === 'qiuyuan'
        ? gloveMat
        : sleeveMat,
    );
    forearm.position.y = -0.38;
    armGroup.add(forearm);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.011, 6, 12), metalMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.46;
    armGroup.add(cuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), gloveMat);
    hand.scale.set(0.85, 1.1, 0.78);
    hand.position.y = -0.52;
    armGroup.add(hand);

    return armGroup;
  };

  const leftArm = makeArm(isMale ? -0.255 : -0.215);
  const rightArm = makeArm(isMale ? 0.255 : 0.215);
  bodyPivot.add(leftArm, rightArm);

  // ── 4. SCULPTED 3D ANIME HEAD + HIGH-RES PAINTED ANIME FACE + LAYERED 3D HAIRSTYLE ──
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.75, 0);
  bodyPivot.add(headGroup);

  // Smoothly tapered anime head geometry with +Z facing front & u=0.5 centered on nose
  const headGeom = new THREE.SphereGeometry(0.228, 28, 22);
  headGeom.rotateY(-Math.PI / 2);
  const posAttr = headGeom.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    let vx = posAttr.getX(i);
    let vy = posAttr.getY(i);
    let vz = posAttr.getZ(i);
    // Subtle anime vertical oval & jaw taper toward delicate chin
    vy *= 1.06;
    vz *= 0.94;
    if (vy < -0.02) {
      const t = Math.min(1, (-vy - 0.02) / 0.22);
      vx *= 1 - 0.26 * t * t;
      if (vz > 0) {
        vz += 0.018 * t * (1 - Math.min(1, Math.abs(vx) / 0.18));
      }
    }
    posAttr.setXYZ(i, vx, vy, vz);
  }
  headGeom.computeVertexNormals();

  const head = new THREE.Mesh(headGeom, faceMat);
  head.castShadow = true;
  headGroup.add(head);

  // Subtle ears tucked under side hair
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), skinMat);
    ear.scale.set(0.55, 1.15, 0.75);
    ear.position.set(side * 0.215, -0.025, 0.0);
    headGroup.add(ear);
  }

  // Crown hair cap — tilted BACKWARD so the hairline sits cleanly on the upper forehead & NEVER masks the eyes!
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.246, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.45),
    hairMat,
  );
  hairCap.position.set(0, 0.032, -0.022);
  hairCap.rotation.x = -0.34;
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  // Back-of-head sculpted hair shell (strictly behind the ears, z <= 0.01, never overlaps the face!)
  const backShellGeom = new THREE.SphereGeometry(
    0.248,
    20,
    16,
    Math.PI * 0.04,
    Math.PI * 0.92,
    Math.PI * 0.22,
    Math.PI * 0.64,
  );
  // Rotate so the shell covers -Z (back of skull) cleanly
  backShellGeom.rotateY(Math.PI);
  const backShell = new THREE.Mesh(backShellGeom, hairMat);
  backShell.position.set(0, 0.015, -0.012);
  backShell.castShadow = true;
  headGroup.add(backShell);

  // Sculpted layered forehead bangs (curved locks arching from hairline down to brow line — never covering eyes!)
  const bangCount = charDef.id === 'chisa' ? 5 : 4;
  for (let i = 0; i < bangCount; i++) {
    const t = i / (bangCount - 1) - 0.5;
    const isPhrolovaCover = charDef.id === 'phrolova' && i === 0;
    const bangLen = isPhrolovaCover ? 0.22 : charDef.id === 'chisa' ? 0.145 : 0.16;
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.048, bangLen, 6), hairMat);
    bang.scale.set(1.0, 1.0, 0.42);
    bang.rotation.x = Math.PI - 0.28;
    bang.rotation.z = t * (charDef.id === 'galbrena' ? 0.42 : 0.24);
    bang.position.set(
      t * 0.22,
      isPhrolovaCover ? 0.12 : 0.165 - Math.abs(t) * 0.02,
      0.205 - Math.abs(t) * 0.065,
    );
    headGroup.add(bang);
  }

  // Graceful side cheek-framing hair strands
  for (const side of [-1, 1]) {
    const sideLock = new THREE.Mesh(
      new THREE.ConeGeometry(0.048, charDef.id === 'phrolova' ? 0.32 : 0.44, 7),
      hairMat,
    );
    sideLock.scale.set(0.75, 1, 0.42);
    sideLock.rotation.x = Math.PI;
    sideLock.rotation.z = side * 0.1;
    sideLock.position.set(side * 0.22, -0.04, 0.065);
    headGroup.add(sideLock);
  }

  // Iconic Character-Specific 3D Hair & Headpieces (super distinctive from BOTH front & behind!)
  if (charDef.id === 'chisa') {
    const backHair = new THREE.Group();
    backHair.position.set(0, 0.06, -0.19);
    const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.84, 0.09), hairMat);
    curtain.position.y = -0.4;
    curtain.castShadow = true;
    backHair.add(curtain);
    flowingParts.push({ obj: backHair, baseX: 0.12, baseZ: 0, phase: 0, amp: 0.18 });
    headGroup.add(backHair);

    const ribbonGroup = new THREE.Group();
    ribbonGroup.position.set(-0.23, 0.05, -0.03);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), hairAccentMat);
    const loop1 = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, 5), hairAccentMat);
    loop1.position.set(-0.055, 0.04, 0);
    loop1.rotation.z = 1.1;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.25, 0.018), hairAccentMat);
    tail.position.set(-0.04, -0.13, -0.02);
    tail.rotation.z = -0.22;
    ribbonGroup.add(knot, loop1, tail);
    headGroup.add(ribbonGroup);
  } else if (charDef.id === 'galbrena') {
    const backHair = new THREE.Group();
    backHair.position.set(0, 0.06, -0.18);
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.66 - Math.abs(i) * 0.06, 6), hairMat);
      spike.rotation.x = Math.PI + 0.14;
      spike.rotation.z = i * 0.18;
      spike.position.set(i * 0.08, -0.3, -Math.abs(i) * 0.015);
      backHair.add(spike);
    }
    flowingParts.push({ obj: backHair, baseX: 0.16, baseZ: 0, phase: 0.4, amp: 0.2 });
    headGroup.add(backHair);
  } else if (charDef.id === 'augusta') {
    // Blazing flame-red cascading hair + seated 3D Golden Sunburst Crown + sun earrings
    const backHair = new THREE.Group();
    backHair.position.set(0, 0.07, -0.19);
    const flameMain = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.86, 12), hairMat);
    flameMain.position.y = -0.4;
    flameMain.scale.set(1.15, 1, 0.52);
    const flameTips = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.34, 8), hairAccentMat);
    flameTips.rotation.x = Math.PI;
    flameTips.position.y = -0.9;
    backHair.add(flameMain, flameTips);
    flowingParts.push({ obj: backHair, baseX: 0.16, baseZ: 0, phase: 0.2, amp: 0.22 });
    headGroup.add(backHair);

    // Ornate 3D Golden Sunburst Crown seated gracefully on her forehead hairline
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.175, 0.045);
    const crownBand = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.018, 6, 20), metalMat);
    crownBand.rotation.x = Math.PI / 2 - 0.15;
    const sunDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.028, 12), metalMat);
    sunDisc.rotation.x = Math.PI / 2;
    sunDisc.position.set(0, 0.085, 0.175);
    const sunCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), glowMat);
    sunCore.position.set(0, 0.085, 0.195);
    crownGroup.add(crownBand, sunDisc, sunCore);
    for (let i = -3; i <= 3; i++) {
      const ray = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, i === 0 ? 0.21 : 0.16 - Math.abs(i) * 0.018, 4),
        metalMat,
      );
      const a = i * 0.35;
      ray.position.set(Math.sin(a) * 0.13, 0.1 + Math.cos(a) * 0.09, 0.155);
      ray.rotation.z = -a;
      crownGroup.add(ray);
    }
    for (const side of [-1, 1]) {
      const earSun = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), metalMat);
      earSun.position.set(side * 0.23, -0.1, 0.05);
      headGroup.add(earSun);
    }
    headGroup.add(crownGroup);
  } else if (charDef.id === 'iuno') {
    const highlight = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 5), hairAccentMat);
    highlight.scale.set(0.9, 1, 0.4);
    highlight.rotation.x = Math.PI - 0.28;
    highlight.position.set(-0.045, 0.16, 0.215);
    headGroup.add(highlight);

    // Delicate golden laurel wreath hugging the crown
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.242, 0.016, 6, 22), metalMat);
    wreath.rotation.x = Math.PI / 2 - 0.22;
    wreath.position.set(0, 0.165, 0.01);
    headGroup.add(wreath);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.075, 4), metalMat);
      leaf.position.set(Math.cos(a) * 0.238, 0.18, Math.sin(a) * 0.238);
      leaf.rotation.z = Math.cos(a) * 0.5;
      headGroup.add(leaf);
    }

    // Twin high sapphire ponytails
    for (const side of [-1, 1]) {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(side * 0.23, 0.15, -0.09);
      const tieRing = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 6, 12), metalMat);
      const upperTail = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.095, 0.5, 10), hairMat);
      upperTail.position.set(side * 0.09, -0.24, -0.06);
      upperTail.rotation.z = side * 0.22;
      const lowerTip = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.4, 8), hairAccentMat);
      lowerTip.rotation.x = Math.PI;
      lowerTip.position.set(side * 0.15, -0.66, -0.1);
      tailPivot.add(tieRing, upperTail, lowerTip);
      flowingParts.push({
        obj: tailPivot,
        baseX: 0.22,
        baseZ: side * 0.12,
        phase: side === -1 ? 0 : Math.PI * 0.65,
        amp: 0.26,
      });
      headGroup.add(tailPivot);
    }
  } else if (charDef.id === 'phrolova') {
    // Back-and-sides-only curved silver-sage bob shell (NEVER pokes through her front face!)
    const bobGeom = new THREE.CylinderGeometry(
      0.245,
      0.275,
      0.34,
      18,
      1,
      true,
      Math.PI * 0.48,
      Math.PI * 1.04,
    );
    const bobBack = new THREE.Mesh(bobGeom, hairMat);
    bobBack.position.set(0, -0.08, -0.015);
    bobBack.castShadow = true;
    headGroup.add(bobBack);
  } else {
    // Qiuyuan — Tousled dark emerald-black martial hair + high flowing ponytail tied with bright Jade Ribbon
    const ponyPivot = new THREE.Group();
    ponyPivot.position.set(0, 0.12, -0.21);
    const jadeTie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 14), hairAccentMat);
    const jadeRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.45, 0.018), hairAccentMat);
    jadeRibbon.position.set(0.055, -0.22, -0.04);
    jadeRibbon.rotation.z = -0.18;
    const ponyTail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.76, 8), hairMat);
    ponyTail.rotation.x = Math.PI + 0.16;
    ponyTail.position.set(0, -0.36, -0.06);
    ponyPivot.add(jadeTie, jadeRibbon, ponyTail);
    flowingParts.push({ obj: ponyPivot, baseX: 0.18, baseZ: 0, phase: 0.2, amp: 0.22 });
    headGroup.add(ponyPivot);
  }

  // Soft radial contact shadow grounded at y = 0.02
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 20),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.58,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

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
      spinAccessory.rotation.z += dt * (celebrating ? 5.5 : 2.2);
      spinAccessory.position.y = 1.48 + Math.sin(time * 3.2) * 0.06;
    }

    const previewJumpHeight =
      previewJumpProgress > 0 ? Math.sin(previewJumpProgress * Math.PI) * 1.1 : 0;
    const totalY = y + previewJumpHeight;

    const shadowScale = Math.max(0.38, 1 - totalY * 0.2);
    shadowDisc.scale.setScalar(shadowScale);
    (shadowDisc.material as THREE.MeshBasicMaterial).opacity = 0.58 * shadowScale;

    // Animate flowing hair, twin-tails, capes & ribbons smoothly
    const windSpeed = celebrating ? 11 : speed > 1 ? 15 : 3.2;
    const windLift = speed > 1 ? Math.min(0.45, speed * 0.045) : 0;
    for (const fp of flowingParts) {
      fp.obj.rotation.x = fp.baseX + windLift + Math.sin(time * windSpeed + fp.phase) * fp.amp;
      fp.obj.rotation.z = fp.baseZ + Math.cos(time * (windSpeed * 0.65) + fp.phase) * (fp.amp * 0.45);
    }

    if (celebrating) {
      // Choreographed multi-move 3D Victory Dance!
      const beat = time * 6.8;
      const dancePhase = Math.floor((time % 4.8) / 1.2);
      if (dancePhase === 0) {
        const hop = Math.abs(Math.sin(beat)) * 0.52;
        bodyPivot.position.y = hop;
        bodyPivot.rotation.set(0, time * 5.0, Math.sin(beat) * 0.14);
        bodyPivot.scale.set(isMale ? 1.04 : 1, (isMale ? 1.05 : 1) * (1 + hop * 0.12), isMale ? 1.04 : 1);
        leftArm.rotation.set(-Math.PI * 0.88, 0, -0.35);
        rightArm.rotation.set(-Math.PI * 0.88, 0, 0.35);
        leftLeg.rotation.set(Math.sin(beat) * 0.42, 0, 0);
        rightLeg.rotation.set(-Math.sin(beat) * 0.42, 0, 0);
      } else if (dancePhase === 1) {
        const groove = Math.sin(beat * 1.25);
        bodyPivot.position.y = Math.abs(groove) * 0.18;
        bodyPivot.rotation.set(0, groove * 0.38, groove * 0.14);
        leftArm.rotation.set(-Math.PI * 0.55 + groove * 0.8, 0, -0.4);
        rightArm.rotation.set(-Math.PI * 0.55 - groove * 0.8, 0, 0.4);
        leftLeg.rotation.set(groove * 0.32, 0, 0);
        rightLeg.rotation.set(-groove * 0.32, 0, 0);
      } else if (dancePhase === 2) {
        const jump = Math.abs(Math.sin(beat * 0.9)) * 0.62;
        bodyPivot.position.y = jump;
        bodyPivot.rotation.set(0, Math.sin(beat * 0.45) * 0.25, 0);
        leftArm.rotation.set(-Math.PI * 0.82, 0, -0.75 * Math.min(1, jump * 2.2));
        rightArm.rotation.set(-Math.PI * 0.82, 0, 0.75 * Math.min(1, jump * 2.2));
        leftLeg.rotation.set(-0.22, 0, -0.35 * Math.min(1, jump * 2.2));
        rightLeg.rotation.set(-0.22, 0, 0.35 * Math.min(1, jump * 2.2));
      } else {
        const wave = Math.sin(beat * 1.6);
        bodyPivot.position.y = Math.abs(Math.sin(beat)) * 0.24;
        bodyPivot.rotation.set(0.06, wave * 0.4, -wave * 0.12);
        leftArm.rotation.set(-Math.PI * 0.9, 0, -0.25 + wave * 0.32);
        rightArm.rotation.set(-Math.PI * 0.9, 0, 0.25 + wave * 0.32);
        leftLeg.rotation.set(0, 0, 0);
        rightLeg.rotation.set(0, 0, 0);
      }
      headGroup.rotation.y = Math.sin(beat * 0.8) * 0.26;
      return;
    }

    // Reset celebration Z/Y rotations smoothly when not dancing
    bodyPivot.rotation.z = 0;
    leftArm.rotation.z = 0;
    rightArm.rotation.z = 0;
    leftLeg.rotation.z = 0;
    rightLeg.rotation.z = 0;

    if (idleMode) {
      const baseScaleX = isMale ? 1.04 : 1;
      const baseScaleY = isMale ? 1.05 : 1;
      bodyPivot.scale.set(baseScaleX, baseScaleY, baseScaleX);

      if (previewJumpProgress > 0) {
        // Athletic 360° spin-jump right on the Character Select pedestal!
        bodyPivot.position.y = previewJumpHeight;
        bodyPivot.rotation.y = previewJumpProgress * Math.PI * 2;
        bodyPivot.rotation.x = 0.12;
        leftArm.rotation.set(-Math.PI * 0.82, 0, -0.28);
        rightArm.rotation.set(-Math.PI * 0.82, 0, 0.28);
        leftLeg.rotation.x = -0.58;
        rightLeg.rotation.x = 0.45;
        headGroup.rotation.y = 0;
        return;
      }

      bodyPivot.rotation.y = Math.sin(time * 0.9) * 0.14;
      bodyPivot.rotation.x = 0;
      bodyPivot.position.y = lockedPose
        ? Math.abs(Math.sin(time * 5.6)) * 0.14
        : Math.sin(time * 2.4) * 0.025;
      leftArm.rotation.set(
        lockedPose ? -Math.PI * 0.78 : Math.sin(time * 2.4) * 0.08,
        0,
        lockedPose ? -0.22 : -0.11,
      );
      rightArm.rotation.set(
        lockedPose ? -Math.PI * 0.78 : -Math.sin(time * 2.4) * 0.08,
        0,
        lockedPose ? 0.22 : 0.11,
      );
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      headGroup.rotation.y = Math.sin(time * 1.4) * 0.12;
      return;
    }

    bodyPivot.rotation.y = 0;
    const baseScaleX = isMale ? 1.04 : 1;
    const baseScaleY = isMale ? 1.05 : 1;
    bodyPivot.scale.set(squashX * baseScaleX, squashY * baseScaleY, squashX * baseScaleX);
    bodyPivot.position.y = y;

    if (!grounded) {
      bodyPivot.rotation.x = 0.2;
      leftLeg.rotation.x = -0.72;
      rightLeg.rotation.x = 0.56;
      leftArm.rotation.x = -1.25;
      rightArm.rotation.x = -0.9;
      headGroup.rotation.y = 0;
    } else {
      const strideAmp = Math.min(1.22, speed / 7.5);
      const swing = Math.sin(stridePhase) * 0.96 * strideAmp;
      const bob = Math.abs(Math.cos(stridePhase)) * 0.14 * strideAmp;
      bodyPivot.position.y = y + bob;
      bodyPivot.rotation.x = 0.2 * strideAmp;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.92;
      rightArm.rotation.x = swing * 0.92;
      headGroup.rotation.y = Math.sin(stridePhase * 0.5) * 0.06;
    }
  };

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
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
