import * as THREE from 'three';

export interface RoomLightingProfile {
  topColor: THREE.Color;
  midColor: THREE.Color;
  floorColor: THREE.Color;
  avgLuminance: number;
}

export interface Room3DEnvironmentAssets {
  backWallTex: THREE.CanvasTexture;
  sideWallTex: THREE.CanvasTexture;
  floorTex: THREE.CanvasTexture;
  ceilingTex: THREE.CanvasTexture;
  panoEnvTex: THREE.CanvasTexture;
  lighting: RoomLightingProfile;
}

function rgbToHexCss(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function sampleRegionAverage(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  yStartRatio: number,
  yEndRatio: number,
): [number, number, number] {
  const y0 = Math.max(0, Math.floor(h * yStartRatio));
  const y1 = Math.min(h, Math.ceil(h * yEndRatio));
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }

  if (count === 0) return [236, 232, 224];
  return [rSum / count, gSum / count, bSum / count];
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  maxAniso: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

function buildAssetsFromDrawable(
  img: HTMLImageElement | null,
  maxAniso: number,
): Room3DEnvironmentAssets {
  // 1. Sample average room colors & luminance
  let topRgb: [number, number, number] = [244, 241, 236];
  let midRgb: [number, number, number] = [228, 222, 214];
  let floorRgb: [number, number, number] = [194, 178, 158];

  const iw = img?.naturalWidth || 0;
  const ih = img?.naturalHeight || 0;

  if (img && iw > 0 && ih > 0) {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 64;
    sampleCanvas.height = 64;
    const sCtx = sampleCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(img, 0, 0, 64, 64);
      const px = sCtx.getImageData(0, 0, 64, 64).data;
      topRgb = sampleRegionAverage(px, 64, 64, 0.0, 0.2);
      midRgb = sampleRegionAverage(px, 64, 64, 0.22, 0.68);
      floorRgb = sampleRegionAverage(px, 64, 64, 0.74, 0.98);
    }
  }

  const avgLuminance = Math.min(
    1,
    Math.max(
      0.08,
      (0.299 * (topRgb[0] * 0.35 + midRgb[0] * 0.45 + floorRgb[0] * 0.2) +
        0.587 * (topRgb[1] * 0.35 + midRgb[1] * 0.45 + floorRgb[1] * 0.2) +
        0.114 * (topRgb[2] * 0.35 + midRgb[2] * 0.45 + floorRgb[2] * 0.2)) /
        255,
    ),
  );

  const topCss = rgbToHexCss(topRgb[0], topRgb[1], topRgb[2]);
  const midCss = rgbToHexCss(midRgb[0], midRgb[1], midRgb[2]);
  const floorCss = rgbToHexCss(floorRgb[0], floorRgb[1], floorRgb[2]);

  // 2. Back Wall Texture (1024 x 512) — crisp room photo centered behind furniture + mirrored wall wings
  const backCanvas = document.createElement('canvas');
  backCanvas.width = 1024;
  backCanvas.height = 512;
  const bCtx = backCanvas.getContext('2d');
  if (bCtx) {
    const wallGrad = bCtx.createLinearGradient(0, 0, 0, 512);
    wallGrad.addColorStop(0, topCss);
    wallGrad.addColorStop(0.55, midCss);
    wallGrad.addColorStop(1, midCss);
    bCtx.fillStyle = wallGrad;
    bCtx.fillRect(0, 0, 1024, 512);

    if (img && iw > 0 && ih > 0) {
      const srcWallH = Math.max(1, Math.round(ih * 0.76));
      const aspect = iw / srcWallH;
      const centerW = Math.min(820, Math.max(460, Math.round(512 * aspect * 0.78)));
      const leftX = Math.round((1024 - centerW) / 2);
      const rightX = leftX + centerW;

      // Left mirrored wing (softly feathered)
      bCtx.save();
      bCtx.translate(leftX, 0);
      bCtx.scale(-1, 1);
      bCtx.globalAlpha = 0.82;
      bCtx.drawImage(img, 0, 0, iw, srcWallH, 0, 0, centerW, 512);
      bCtx.restore();

      // Right mirrored wing (softly feathered)
      bCtx.save();
      bCtx.translate(rightX + centerW, 0);
      bCtx.scale(-1, 1);
      bCtx.globalAlpha = 0.82;
      bCtx.drawImage(img, 0, 0, iw, srcWallH, 0, 0, centerW, 512);
      bCtx.restore();

      // Central crisp uploaded room photo
      bCtx.drawImage(img, 0, 0, iw, srcWallH, leftX, 0, centerW, 512);

      // Subtle corner depth shading on far left/right edges
      const sideShadeL = bCtx.createLinearGradient(0, 0, leftX + 24, 0);
      sideShadeL.addColorStop(0, 'rgba(15, 23, 42, 0.24)');
      sideShadeL.addColorStop(1, 'rgba(15, 23, 42, 0)');
      bCtx.fillStyle = sideShadeL;
      bCtx.fillRect(0, 0, leftX + 24, 512);

      const sideShadeR = bCtx.createLinearGradient(rightX - 24, 0, 1024, 0);
      sideShadeR.addColorStop(0, 'rgba(15, 23, 42, 0)');
      sideShadeR.addColorStop(1, 'rgba(15, 23, 42, 0.24)');
      bCtx.fillStyle = sideShadeR;
      bCtx.fillRect(rightX - 24, 0, 1024 - (rightX - 24), 512);
    }

    // Subtle baseboard AO shadow along floor seam
    const baseAo = bCtx.createLinearGradient(0, 446, 0, 512);
    baseAo.addColorStop(0, 'rgba(15, 23, 42, 0)');
    baseAo.addColorStop(1, 'rgba(15, 23, 42, 0.24)');
    bCtx.fillStyle = baseAo;
    bCtx.fillRect(0, 446, 1024, 66);
  }
  const backWallTex = configureColorTexture(backCanvas, maxAniso);

  // 3. Side / Front Interior Wall Texture (512 x 512) — matches wall paint/texture & corner AO
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 512;
  sideCanvas.height = 512;
  const sideCtx = sideCanvas.getContext('2d');
  if (sideCtx) {
    const sg = sideCtx.createLinearGradient(0, 0, 0, 512);
    sg.addColorStop(0, topCss);
    sg.addColorStop(0.35, midCss);
    sg.addColorStop(1, midCss);
    sideCtx.fillStyle = sg;
    sideCtx.fillRect(0, 0, 512, 512);

    if (img && iw > 0 && ih > 0) {
      // Sample left/right outer edge wall strip subtly so wall wallpaper/plaster grain carries onto side walls
      const edgeW = Math.max(12, Math.round(iw * 0.16));
      const srcWallH = Math.max(1, Math.round(ih * 0.74));
      sideCtx.save();
      sideCtx.globalAlpha = 0.26;
      sideCtx.drawImage(img, 0, 0, edgeW, srcWallH, 0, 0, 512, 512);
      sideCtx.restore();
    }

    // Corner & baseboard AO
    const topAo = sideCtx.createLinearGradient(0, 0, 0, 46);
    topAo.addColorStop(0, 'rgba(15, 23, 42, 0.16)');
    topAo.addColorStop(1, 'rgba(15, 23, 42, 0)');
    sideCtx.fillStyle = topAo;
    sideCtx.fillRect(0, 0, 512, 46);

    const botAo = sideCtx.createLinearGradient(0, 456, 0, 512);
    botAo.addColorStop(0, 'rgba(15, 23, 42, 0)');
    botAo.addColorStop(1, 'rgba(15, 23, 42, 0.26)');
    sideCtx.fillStyle = botAo;
    sideCtx.fillRect(0, 456, 512, 56);
  }
  const sideWallTex = configureColorTexture(sideCanvas, maxAniso);

  // 4. Perspective Floor Texture (1024 x 1024) — seamless 2x2 mirrored tile from bottom floor region of room photo
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024;
  floorCanvas.height = 1024;
  const fCtx = floorCanvas.getContext('2d');
  if (fCtx) {
    fCtx.fillStyle = floorCss;
    fCtx.fillRect(0, 0, 1024, 1024);

    if (img && iw > 0 && ih > 0) {
      const sy = Math.round(ih * 0.74);
      const sh = Math.max(16, ih - sy);
      const sx = Math.round(iw * 0.1);
      const sw = Math.max(32, Math.round(iw * 0.8));

      // Draw 2x2 mirrored floor tile so planks/tiles flow smoothly without visible seams
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          fCtx.save();
          fCtx.translate(col * 512 + (col % 2 === 1 ? 512 : 0), row * 512 + (row % 2 === 1 ? 512 : 0));
          fCtx.scale(col % 2 === 1 ? -1 : 1, row % 2 === 1 ? -1 : 1);
          fCtx.drawImage(img, sx, sy, sw, sh, 0, 0, 512, 512);
          fCtx.restore();
        }
      }

      // Soft radial vignette toward natural floor tone at far perimeter
      const rad = fCtx.createRadialGradient(512, 512, 220, 512, 512, 680);
      rad.addColorStop(0, 'rgba(0,0,0,0)');
      rad.addColorStop(1, floorCss);
      fCtx.globalAlpha = 0.35;
      fCtx.fillStyle = rad;
      fCtx.fillRect(0, 0, 1024, 1024);
      fCtx.globalAlpha = 1;
    }
  }
  const floorTex = configureColorTexture(floorCanvas, maxAniso);
  floorTex.wrapS = THREE.MirroredRepeatWrapping;
  floorTex.wrapT = THREE.MirroredRepeatWrapping;
  floorTex.repeat.set(2, 2);

  // 5. Ceiling Texture (256 x 256)
  const ceilCanvas = document.createElement('canvas');
  ceilCanvas.width = 256;
  ceilCanvas.height = 256;
  const cCtx = ceilCanvas.getContext('2d');
  if (cCtx) {
    cCtx.fillStyle = topCss;
    cCtx.fillRect(0, 0, 256, 256);
    const lightGlow = cCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
    lightGlow.addColorStop(0, 'rgba(255, 252, 245, 0.55)');
    lightGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    cCtx.fillStyle = lightGlow;
    cCtx.fillRect(0, 0, 256, 256);
  }
  const ceilingTex = configureColorTexture(ceilCanvas, maxAniso);

  // 6. 360° Equirectangular Panorama Texture (1024 x 512) for reflections + seamless outer surround
  const panoCanvas = document.createElement('canvas');
  panoCanvas.width = 1024;
  panoCanvas.height = 512;
  const pCtx = panoCanvas.getContext('2d');
  if (pCtx) {
    const bgGrad = pCtx.createLinearGradient(0, 0, 0, 512);
    bgGrad.addColorStop(0, '#fffdf9');
    bgGrad.addColorStop(0.24, topCss);
    bgGrad.addColorStop(0.55, midCss);
    bgGrad.addColorStop(0.76, floorCss);
    bgGrad.addColorStop(1, floorCss);
    pCtx.fillStyle = bgGrad;
    pCtx.fillRect(0, 0, 1024, 512);

    if (img && iw > 0 && ih > 0) {
      // Tile 2 mirrored copies across the equator so 0 and 1024 wrap seamlessly in 360°
      pCtx.save();
      pCtx.globalAlpha = 0.85;
      pCtx.drawImage(img, 0, 0, iw, ih, 0, 72, 512, 340);
      pCtx.translate(1024, 0);
      pCtx.scale(-1, 1);
      pCtx.drawImage(img, 0, 0, iw, ih, 0, 72, 512, 340);
      pCtx.restore();

      // Smooth zenith ceiling light band + nadir floor blend
      const zenith = pCtx.createLinearGradient(0, 0, 0, 120);
      zenith.addColorStop(0, 'rgba(255, 252, 246, 0.92)');
      zenith.addColorStop(0.65, topCss);
      zenith.addColorStop(1, 'rgba(255, 255, 255, 0)');
      pCtx.fillStyle = zenith;
      pCtx.fillRect(0, 0, 1024, 120);

      const nadir = pCtx.createLinearGradient(0, 355, 0, 512);
      nadir.addColorStop(0, 'rgba(0, 0, 0, 0)');
      nadir.addColorStop(0.5, floorCss);
      nadir.addColorStop(1, floorCss);
      pCtx.fillStyle = nadir;
      pCtx.fillRect(0, 355, 1024, 157);
    }
  }
  const panoEnvTex = configureColorTexture(panoCanvas, maxAniso);
  panoEnvTex.mapping = THREE.EquirectangularReflectionMapping;

  return {
    backWallTex,
    sideWallTex,
    floorTex,
    ceilingTex,
    panoEnvTex,
    lighting: {
      topColor: new THREE.Color(topRgb[0] / 255, topRgb[1] / 255, topRgb[2] / 255),
      midColor: new THREE.Color(midRgb[0] / 255, midRgb[1] / 255, midRgb[2] / 255),
      floorColor: new THREE.Color(floorRgb[0] / 255, floorRgb[1] / 255, floorRgb[2] / 255),
      avgLuminance,
    },
  };
}

export function createFallbackRoomEnvironmentAssets(maxAniso: number): Room3DEnvironmentAssets {
  return buildAssetsFromDrawable(null, maxAniso);
}

export function loadRoomEnvironmentAssets(
  imageUrl: string,
  maxAniso: number,
  onReady: (assets: Room3DEnvironmentAssets) => void,
): () => void {
  let cancelled = false;

  if (!imageUrl) {
    onReady(buildAssetsFromDrawable(null, maxAniso));
    return () => {
      cancelled = true;
    };
  }

  const img = new Image();
  if (/^https?:\/\//i.test(imageUrl)) {
    img.crossOrigin = 'anonymous';
  }

  img.onload = () => {
    if (cancelled) return;
    try {
      onReady(buildAssetsFromDrawable(img, maxAniso));
    } catch {
      if (!cancelled) {
        onReady(buildAssetsFromDrawable(null, maxAniso));
      }
    }
  };

  img.onerror = () => {
    if (!cancelled) {
      onReady(buildAssetsFromDrawable(null, maxAniso));
    }
  };

  img.src = imageUrl;

  return () => {
    cancelled = true;
  };
}
