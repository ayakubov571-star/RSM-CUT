/**
 * Automatic White & Beige Studio Background Removal
 * (Corner-Sampled Perimeter Flood-Fill + Fringe Despill)
 * Completely removes exterior white/cream/beige studio backgrounds and soft floor halos
 * so only the exact 100% opaque furniture silhouette remains, while preserving interior
 * white/beige furniture surfaces (doors, quartz countertops, shelves).
 */

const processedCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

function sampleCornerBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { r: number; g: number; b: number } {
  const patch = 4;
  const corners = [
    [0, 0],
    [Math.max(0, w - patch), 0],
    [0, Math.max(0, h - patch)],
    [Math.max(0, w - patch), Math.max(0, h - patch)],
  ];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < patch && cy + dy < h; dy++) {
      for (let dx = 0; dx < patch && cx + dx < w; dx++) {
        const p = ((cy + dy) * w + (cx + dx)) * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum >= 180) {
          sumR += r;
          sumG += g;
          sumB += b;
          count++;
        }
      }
    }
  }

  if (count === 0) {
    return { r: 248, g: 248, b: 246 };
  }
  return {
    r: sumR / count,
    g: sumG / count,
    b: sumB / count,
  };
}

function colorDist(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isStudioBackgroundPixel(
  r: number,
  g: number,
  b: number,
  bg: { r: number; g: number; b: number },
): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const dist = colorDist(r, g, b, bg.r, bg.g, bg.b);

  // Matches sampled studio wall/floor color (white, off-white, warm cream/beige)
  if (dist <= 44 && luminance >= 188) return true;
  // Matches soft neutral/warm studio shadows near perimeter
  if (luminance >= 205 && saturation <= 40) return true;
  return false;
}

export async function removeWhiteBackground(src: string): Promise<string> {
  if (!src) return src;
  const cached = processedCache.get(src);
  if (cached) return cached;

  const existing = inflightRequests.get(src);
  if (existing) return existing;

  const task = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const bg = sampleCornerBackground(data, w, h);
        const total = w * h;
        const visited = new Uint8Array(total);
        const bgMask = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const trySeed = (x: number, y: number) => {
          const idx = y * w + x;
          if (visited[idx]) return;
          const p = idx * 4;
          if (isStudioBackgroundPixel(data[p], data[p + 1], data[p + 2], bg)) {
            visited[idx] = 1;
            bgMask[idx] = 1;
            queue[tail++] = idx;
          }
        };

        // Seed from all 4 outer edges
        for (let x = 0; x < w; x++) {
          trySeed(x, 0);
          trySeed(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          trySeed(0, y);
          trySeed(w - 1, y);
        }

        // 8-connected BFS flood-fill across exterior white/beige studio backdrop
        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % w;
          const cy = (curr - cx) / w;

          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              if (nx < 0 || nx >= w) continue;
              trySeed(nx, ny);
            }
          }
        }

        // 2-pass clean fringe erosion: completely strip residual light/beige edge halo pixels
        // without leaving semi-transparent milky rings around the furniture silhouette
        let currentMask = bgMask;
        for (let pass = 0; pass < 2; pass++) {
          const nextMask = new Uint8Array(currentMask);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = y * w + x;
              if (currentMask[i]) continue;

              let touchesBg = false;
              for (let dy = -1; dy <= 1 && !touchesBg; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= h) continue;
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = x + dx;
                  if (nx < 0 || nx >= w) continue;
                  if (currentMask[ny * w + nx]) {
                    touchesBg = true;
                    break;
                  }
                }
              }

              if (!touchesBg) continue;
              const p = i * 4;
              const r = data[p];
              const g = data[p + 1];
              const b = data[p + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              const sat = Math.max(r, g, b) - Math.min(r, g, b);
              const dist = colorDist(r, g, b, bg.r, bg.g, bg.b);

              if ((dist <= 62 && lum >= 175) || (lum >= 195 && sat <= 46)) {
                nextMask[i] = 1;
              }
            }
          }
          currentMask = nextMask;
        }

        // Apply crisp 100% transparency to background & cleaned outer fringe
        for (let i = 0; i < total; i++) {
          if (currentMask[i]) {
            data[i * 4 + 3] = 0;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const resultUrl = canvas.toDataURL('image/png');
        processedCache.set(src, resultUrl);
        resolve(resultUrl);
      } catch {
        resolve(src);
      }
    };

    img.onerror = () => resolve(src);
    img.src = src;
  });

  inflightRequests.set(src, task);
  const out = await task;
  inflightRequests.delete(src);
  return out;
}
