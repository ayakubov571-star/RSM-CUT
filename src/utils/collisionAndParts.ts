import type {
  CollisionEdge,
  CuttingPart,
  DimensionsCm,
  FurnitureFinishPalette,
  FurnitureLayoutVariant,
  FurnitureSubPart,
  MaterialPricing,
  PartMaterial,
  PlacedFurnitureBox,
  RoomCategory,
  SubPartKind,
} from '../types.ts';
import { detectCategoryArchetype } from './furnitureCalculator.ts';

export const WALL_WIDTH_MM = 4400;
export const WALL_HEIGHT_MM = 3300;
export const BOARD_THICK_MM = 18;
export const BACK_THICK_MM = 4;
export const MIN_PART_MM = 120;

export const PART_MATERIAL_OPTIONS: PartMaterial[] = ['LDSP', 'MDF', 'Akril', 'Shisha', 'DVP/HDF'];

export const SUBPART_TEMPLATES: Record<
  SubPartKind,
  { label: string; widthMm: number; heightMm: number; depthMm: number; material: PartMaterial }
> = {
  shelf: { label: 'Polka', widthMm: 620, heightMm: BOARD_THICK_MM, depthMm: 520, material: 'LDSP' },
  drawer: { label: 'Tortma', widthMm: 580, heightMm: 210, depthMm: 500, material: 'MDF' },
  door: { label: 'Eshik', widthMm: 450, heightMm: 760, depthMm: BOARD_THICK_MM, material: 'Akril' },
  side: { label: 'Yon devor', widthMm: BOARD_THICK_MM, heightMm: 820, depthMm: 580, material: 'LDSP' },
  divider: { label: "To'siq", widthMm: BOARD_THICK_MM, heightMm: 620, depthMm: 520, material: 'LDSP' },
  board: { label: 'Panel', widthMm: 800, heightMm: BOARD_THICK_MM, depthMm: 580, material: 'LDSP' },
  back: { label: 'Orqa devor (DVP/HDF)', widthMm: 800, heightMm: 800, depthMm: BACK_THICK_MM, material: 'DVP/HDF' },
};

export function boxToMmBounds(
  box: PlacedFurnitureBox,
  dims: DimensionsCm,
): { leftMm: number; topMm: number; widthMm: number; heightMm: number } {
  const widthMm = Math.max(600, Math.round(dims.widthCm * 10));
  const heightMm = Math.max(800, Math.round(dims.heightCm * 10));
  const centerXMm = (box.xPercent / 100) * WALL_WIDTH_MM;
  const centerYMm = (box.yPercent / 100) * WALL_HEIGHT_MM;

  const leftMm = Math.max(
    40,
    Math.min(WALL_WIDTH_MM - widthMm - 40, Math.round(centerXMm - widthMm / 2)),
  );
  const topMm = Math.max(
    40,
    Math.min(WALL_HEIGHT_MM - heightMm - 40, Math.round(centerYMm - heightMm / 2)),
  );
  return { leftMm, topMm, widthMm, heightMm };
}

/**
 * Decomposes every furniture category into full 3D structural CAD sub-parts
 * 100% visually & color-synced with the Realistic Catalog Photos:
 * - Oshxona: Matte Dark Charcoal (#2F3237) upper & lower + Warm Natural Oak (#A67B5B) open niche + White Quartz countertop
 * - Shkaf: Matte Black (#1F2226) frame + Smoked Glass (#2C2824) side doors + Matte Sand MDF (#C4B199) center doors + Oak interior
 * - TV-zona: Walnut slatted wall (#6E4A30) + Matte Slate (#52565B) 3-drawer console + Tall Glass Vitrine (#2A2D32)
 * - Yotoqxona: Matte Cashmere (#C9BFB4) 5-door wardrobe + Integrated 2-drawer side console + Brushed Brass handles (#C5A56A)
 */
export function decomposeFurnitureToSubParts(params: {
  category: RoomCategory;
  dimensions: DimensionsCm;
  placedBox: PlacedFurnitureBox;
  carcassMat: PartMaterial;
  facadeMat: PartMaterial;
  palette?: FurnitureFinishPalette;
  layoutVariant?: FurnitureLayoutVariant;
}): FurnitureSubPart[] {
  const { category, dimensions, placedBox, carcassMat, facadeMat, palette, layoutVariant } = params;
  const archetype = layoutVariant?.archetype ?? detectCategoryArchetype(category);
  const { leftMm, topMm, widthMm, heightMm } = boxToMmBounds(placedBox, dimensions);
  const depthMm = Math.max(350, Math.round(dimensions.depthCm * 10));

  const parts: FurnitureSubPart[] = [];
  const t = BOARD_THICK_MM;

  if (archetype === 'kitchen') {
    const carcassHex = palette?.carcassHex ?? '#2F3237';
    const facadeHex = palette?.facadeHex ?? '#2F3237';
    const oak = palette?.accentHex ?? '#A67B5B';
    const whiteQuartz = palette?.countertopHex ?? '#F4F6F8';
    const handleHex = palette?.handleHex ?? '#18191C';

    const upperH = Math.max(680, Math.round(heightMm * 0.42));
    const lowerH = Math.max(720, Math.round(heightMm * 0.36));
    const counterH = 38;
    const lowerTop = topMm + heightMm - lowerH;
    const counterTop = lowerTop - counterH;
    const innerW = Math.max(300, widthMm - t * 2);
    const upperDepth = 360;

    const upperCols = Math.max(4, Math.min(6, layoutVariant?.doorsCount ?? 6));
    const uColW = Math.floor(innerW / upperCols);
    const hasOpenNiche = layoutVariant?.hasOpenNiche !== false;
    const nicheH = hasOpenNiche ? Math.max(220, Math.round(upperH * 0.34)) : 0;
    const midDoorH = Math.max(240, upperH - t * 2 - nicheH);
    const nicheX = leftMm + t + uColW;
    const nicheW = Math.max(400, innerW - uColW * 2);
    const nicheTop = topMm + upperH - nicheH;

    parts.push(
      {
        id: 'part-upper-side-left',
        name: 'Yuqori chap yon devor',
        kind: 'side',
        xMm: leftMm,
        yMm: topMm,
        widthMm: t,
        heightMm: upperH,
        depthMm: upperDepth,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-upper-side-right',
        name: "Yuqori o'ng yon devor",
        kind: 'side',
        xMm: leftMm + widthMm - t,
        yMm: topMm,
        widthMm: t,
        heightMm: upperH,
        depthMm: upperDepth,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-upper-top',
        name: 'Yuqori qopqoq panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm,
        widthMm: innerW,
        heightMm: t,
        depthMm: upperDepth,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-upper-bottom',
        name: 'Yuqori pastki panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm + upperH - t,
        widthMm: innerW,
        heightMm: t,
        depthMm: upperDepth,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-upper-back',
        name: 'Yuqori orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm,
        yMm: topMm,
        widthMm,
        heightMm: upperH,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: carcassHex,
      },
      {
        id: 'part-upper-inner-shelf',
        name: 'Yuqori ichki polka',
        kind: 'shelf',
        xMm: leftMm + t,
        yMm: topMm + Math.round(midDoorH * 0.52),
        widthMm: innerW,
        heightMm: t,
        depthMm: upperDepth - 24,
        material: carcassMat,
        colorHex: '#D5C7B6',
      },
    );

    if (hasOpenNiche) {
      parts.push(
        {
          id: 'part-oak-niche-back',
          name: "Ochiq yog'och nisha (orqa)",
          kind: 'board',
          xMm: nicheX,
          yMm: nicheTop,
          widthMm: nicheW,
          heightMm: nicheH - t,
          depthMm: 22,
          material: 'LDSP',
          colorHex: oak,
        },
        {
          id: 'part-oak-niche-top',
          name: "Ochiq yog'och nisha (ustki)",
          kind: 'shelf',
          xMm: nicheX,
          yMm: nicheTop,
          widthMm: nicheW,
          heightMm: t,
          depthMm: upperDepth - 10,
          material: 'LDSP',
          colorHex: oak,
        },
        {
          id: 'part-oak-niche-bottom',
          name: "Ochiq yog'och nisha (pastki)",
          kind: 'shelf',
          xMm: nicheX,
          yMm: topMm + upperH - t,
          widthMm: nicheW,
          heightMm: t,
          depthMm: upperDepth - 10,
          material: 'LDSP',
          colorHex: oak,
        },
      );
    }

    for (let i = 0; i < upperCols; i++) {
      const isOuter = !hasOpenNiche || i === 0 || i === upperCols - 1;
      const colW = i === upperCols - 1 ? innerW - i * uColW : uColW;
      parts.push({
        id: `part-upper-door-${i + 1}`,
        name: `Yuqori eshik #${i + 1}`,
        kind: 'door',
        xMm: leftMm + t + i * uColW,
        yMm: topMm + t,
        widthMm: colW,
        heightMm: isOuter ? upperH - t * 2 : midDoorH,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      });
    }

    const gapH = Math.max(120, counterTop - (topMm + upperH));
    if (gapH >= 120) {
      parts.push({
        id: 'part-backsplash',
        name: 'Kvars devor paneli (Fartuk)',
        kind: 'board',
        xMm: leftMm,
        yMm: topMm + upperH,
        widthMm,
        heightMm: gapH,
        depthMm: 18,
        material: 'Akril',
        colorHex: whiteQuartz,
      });
    }

    parts.push({
      id: 'part-countertop',
      name: 'Kvars tosh stoleshnitsa',
      kind: 'board',
      xMm: leftMm,
      yMm: counterTop,
      widthMm,
      heightMm: counterH,
      depthMm: depthMm + 20,
      material: 'Akril',
      colorHex: whiteQuartz,
    });

    parts.push(
      {
        id: 'part-lower-side-left',
        name: 'Pastki chap yon devor',
        kind: 'side',
        xMm: leftMm,
        yMm: lowerTop,
        widthMm: t,
        heightMm: lowerH,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-lower-side-right',
        name: "Pastki o'ng yon devor",
        kind: 'side',
        xMm: leftMm + widthMm - t,
        yMm: lowerTop,
        widthMm: t,
        heightMm: lowerH,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-lower-bottom',
        name: 'Pastki taglik panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: lowerTop + lowerH - t,
        widthMm: innerW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-lower-back',
        name: 'Pastki orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm,
        yMm: lowerTop,
        widthMm,
        heightMm: lowerH,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: carcassHex,
      },
      {
        id: 'part-lower-inner-shelf',
        name: 'Pastki ichki polka',
        kind: 'shelf',
        xMm: leftMm + t,
        yMm: lowerTop + Math.round(lowerH * 0.44),
        widthMm: innerW,
        heightMm: t,
        depthMm: depthMm - 28,
        material: carcassMat,
        colorHex: '#43474E',
      },
    );

    const lowerCols = Math.max(3, Math.min(4, layoutVariant?.drawersCount ?? 3));
    const lColW = Math.floor(innerW / lowerCols);
    const topDrawerH = Math.round((lowerH - t) * 0.36);
    const botDoorH = lowerH - t - topDrawerH;

    for (let i = 0; i < lowerCols; i++) {
      const colW = i === lowerCols - 1 ? innerW - i * lColW : lColW;
      const colX = leftMm + t + i * lColW;
      parts.push(
        {
          id: `part-lower-drawer-${i + 1}`,
          name: `Pastki tortma #${i + 1}`,
          kind: 'drawer',
          xMm: colX,
          yMm: lowerTop,
          widthMm: colW,
          heightMm: topDrawerH,
          depthMm: t,
          material: facadeMat,
          colorHex: facadeHex,
          handleColorHex: handleHex,
        },
        {
          id: `part-lower-door-${i + 1}`,
          name: `Pastki eshik #${i + 1}`,
          kind: 'door',
          xMm: colX,
          yMm: lowerTop + topDrawerH,
          widthMm: colW,
          heightMm: botDoorH,
          depthMm: t,
          material: facadeMat,
          colorHex: facadeHex,
          handleColorHex: handleHex,
        },
      );
    }
    return parts;
  }

  if (archetype === 'tvzone') {
    const walnutSlat = palette?.accentHex ?? '#6E4A30';
    const slateConsole = palette?.facadeHex ?? '#52565B';
    const vitrineFrame = palette?.frameHex ?? palette?.carcassHex ?? '#2A2D32';
    const walnutBack = palette?.accentHex ?? '#8C5E3C';
    const glassHex = palette?.glassHex ?? '#1F242B';
    const handleHex = palette?.handleHex ?? '#1F2937';

    const consoleH = Math.max(320, Math.round(heightMm * 0.23));
    const consoleTop = topMm + heightMm - consoleH;
    const backW = Math.round(widthMm * 0.78);
    const vitrineW = Math.max(420, widthMm - backW);
    const backH = Math.max(400, consoleTop - topMm);
    const innerConsoleW = Math.max(200, backW - t * 2);
    const vitInnerW = Math.max(180, vitrineW - t * 2);

    parts.push(
      {
        id: 'part-tv-panel',
        name: "Reykali yong'oq orqa panel",
        kind: 'board',
        xMm: leftMm,
        yMm: topMm,
        widthMm: backW,
        heightMm: backH,
        depthMm: 40,
        material: 'MDF',
        colorHex: walnutSlat,
      },
      {
        id: 'part-side-left',
        name: 'Tumba chap yon devori',
        kind: 'side',
        xMm: leftMm,
        yMm: consoleTop,
        widthMm: t,
        heightMm: consoleH,
        depthMm,
        material: carcassMat,
        colorHex: slateConsole,
      },
      {
        id: 'part-vitrine-side-left',
        name: 'Vitrina chap devori',
        kind: 'side',
        xMm: leftMm + backW,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: vitrineFrame,
      },
      {
        id: 'part-side-right',
        name: "O'ng yon devor",
        kind: 'side',
        xMm: leftMm + widthMm - t,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: vitrineFrame,
      },
      {
        id: 'part-top-board',
        name: 'Tumba ustki panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: consoleTop,
        widthMm: innerConsoleW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: slateConsole,
      },
      {
        id: 'part-bottom-plinth',
        name: 'Pastki taglik panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm + heightMm - t,
        widthMm: innerConsoleW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: slateConsole,
      },
      {
        id: 'part-back-panel',
        name: 'Orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm,
        yMm: consoleTop,
        widthMm: backW,
        heightMm: consoleH,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: vitrineFrame,
      },
    );

    parts.push(
      {
        id: 'part-tv-vitrine-top',
        name: 'Vitrina ustki panel',
        kind: 'board',
        xMm: leftMm + backW + t,
        yMm: topMm,
        widthMm: vitInnerW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: vitrineFrame,
      },
      {
        id: 'part-tv-vitrine-bottom',
        name: 'Vitrina pastki panel',
        kind: 'board',
        xMm: leftMm + backW + t,
        yMm: topMm + heightMm - t,
        widthMm: vitInnerW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: vitrineFrame,
      },
      {
        id: 'part-tv-vitrine-back',
        name: 'Vitrina orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm + backW,
        yMm: topMm,
        widthMm: vitrineW,
        heightMm,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: walnutBack,
      },
      {
        id: 'part-tv-vitrine-shelf-1',
        name: 'Vitrina shisha polka #1',
        kind: 'shelf',
        xMm: leftMm + backW + t,
        yMm: topMm + Math.round(heightMm * 0.25),
        widthMm: vitInnerW,
        heightMm: t,
        depthMm: depthMm - 32,
        material: 'Shisha',
      },
      {
        id: 'part-tv-vitrine-shelf-2',
        name: 'Vitrina shisha polka #2',
        kind: 'shelf',
        xMm: leftMm + backW + t,
        yMm: topMm + Math.round(heightMm * 0.5),
        widthMm: vitInnerW,
        heightMm: t,
        depthMm: depthMm - 32,
        material: 'Shisha',
      },
      {
        id: 'part-tv-vitrine-shelf-3',
        name: 'Vitrina shisha polka #3',
        kind: 'shelf',
        xMm: leftMm + backW + t,
        yMm: topMm + Math.round(heightMm * 0.75),
        widthMm: vitInnerW,
        heightMm: t,
        depthMm: depthMm - 32,
        material: 'Shisha',
      },
      {
        id: 'part-tv-vitrine',
        name: 'Shisha vitrina eshigi',
        kind: 'door',
        xMm: leftMm + backW + t,
        yMm: topMm + t,
        widthMm: vitInnerW,
        heightMm: heightMm - t * 2,
        depthMm: t,
        material: 'Shisha',
        colorHex: glassHex,
        frameColorHex: vitrineFrame,
        handleColorHex: handleHex,
      },
    );

    const drawerCols = Math.max(3, Math.min(4, layoutVariant?.drawersCount ?? 3));
    const dW = Math.floor(innerConsoleW / drawerCols);
    for (let i = 0; i < drawerCols; i++) {
      parts.push({
        id: `part-tv-drawer-${i + 1}`,
        name: `Osma tortma #${i + 1}`,
        kind: 'drawer',
        xMm: leftMm + t + i * dW,
        yMm: consoleTop + t,
        widthMm: i === drawerCols - 1 ? innerConsoleW - i * dW : dW,
        heightMm: consoleH - t * 2,
        depthMm: t,
        material: facadeMat,
        colorHex: slateConsole,
        handleColorHex: handleHex,
      });
    }
    return parts;
  }

  if (archetype === 'bedroom') {
    const facadeHex = palette?.facadeHex ?? '#C9BFB4';
    const carcassHex = palette?.carcassHex ?? facadeHex;
    const interiorOak = palette?.accentHex ?? '#CBB9A4';
    const brassHandle = palette?.handleHex ?? '#C5A56A';

    const wardrobeW = Math.round(widthMm * 0.78);
    const consoleW = widthMm - wardrobeW;
    const innerWardrobeW = Math.max(300, wardrobeW - t * 2);
    const innerTop = topMm + t;
    const innerH = Math.max(400, heightMm - t * 2);
    const consoleH = Math.max(460, Math.round(heightMm * 0.25));
    const consoleTop = topMm + heightMm - consoleH;
    const innerConsoleW = Math.max(200, consoleW - t);

    parts.push(
      {
        id: 'part-side-left',
        name: 'Chap yon devor',
        kind: 'side',
        xMm: leftMm,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-mid-side-wall',
        name: "O'ng garderob devori",
        kind: 'side',
        xMm: leftMm + wardrobeW - t,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-side-right',
        name: "Tumba o'ng yon devori",
        kind: 'side',
        xMm: leftMm + widthMm - t,
        yMm: consoleTop,
        widthMm: t,
        heightMm: consoleH,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-top-board',
        name: 'Ustki qopqoq panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm,
        widthMm: innerWardrobeW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-bottom-plinth',
        name: 'Pastki taglik panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm + heightMm - t,
        widthMm: innerWardrobeW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-back-panel',
        name: 'Orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm,
        yMm: topMm,
        widthMm: wardrobeW,
        heightMm,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: carcassHex,
      },
      {
        id: 'part-vanity-back-wall',
        name: 'Konsol orqa paneli',
        kind: 'board',
        xMm: leftMm + wardrobeW,
        yMm: topMm + 40,
        widthMm: consoleW,
        heightMm: Math.max(400, consoleTop - (topMm + 40)),
        depthMm: 22,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-vanity-top',
        name: 'Konsol ustki panel',
        kind: 'board',
        xMm: leftMm + wardrobeW,
        yMm: consoleTop,
        widthMm: innerConsoleW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-vanity-bottom',
        name: 'Konsol pastki panel',
        kind: 'board',
        xMm: leftMm + wardrobeW,
        yMm: topMm + heightMm - t,
        widthMm: innerConsoleW,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
    );

    const divX = leftMm + t + Math.round(innerWardrobeW * 0.4) - Math.round(t / 2);
    parts.push(
      {
        id: 'part-inner-divider',
        name: "Ichki to'siq",
        kind: 'divider',
        xMm: divX,
        yMm: innerTop,
        widthMm: t,
        heightMm: innerH,
        depthMm: depthMm - 30,
        material: carcassMat,
        colorHex: interiorOak,
      },
      {
        id: 'part-inner-shelf-1',
        name: 'Ichki polka #1',
        kind: 'shelf',
        xMm: leftMm + t,
        yMm: innerTop + Math.round(innerH * 0.32),
        widthMm: divX - (leftMm + t),
        heightMm: t,
        depthMm: depthMm - 30,
        material: carcassMat,
        colorHex: interiorOak,
      },
      {
        id: 'part-inner-shelf-2',
        name: 'Ichki polka #2',
        kind: 'shelf',
        xMm: leftMm + t,
        yMm: innerTop + Math.round(innerH * 0.64),
        widthMm: divX - (leftMm + t),
        heightMm: t,
        depthMm: depthMm - 30,
        material: carcassMat,
        colorHex: interiorOak,
      },
    );

    const doorCount = Math.max(4, Math.min(5, layoutVariant?.doorsCount ?? 5));
    const doorW = Math.floor(innerWardrobeW / doorCount);
    for (let i = 0; i < doorCount; i++) {
      parts.push({
        id: `part-door-${i + 1}`,
        name: `Garderob eshik #${i + 1}`,
        kind: 'door',
        xMm: leftMm + t + i * doorW,
        yMm: innerTop,
        widthMm: i === doorCount - 1 ? innerWardrobeW - i * doorW : doorW,
        heightMm: innerH,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: brassHandle,
      });
    }

    const dInnerH = Math.max(160, consoleH - t * 2);
    const singleDH = Math.floor(dInnerH / 2);
    for (let i = 0; i < 2; i++) {
      parts.push({
        id: `part-vanity-drawer-${i + 1}`,
        name: `Tumba tortma #${i + 1}`,
        kind: 'drawer',
        xMm: leftMm + wardrobeW,
        yMm: consoleTop + t + i * singleDH,
        widthMm: innerConsoleW,
        heightMm: i === 1 ? dInnerH - singleDH : singleDH,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: brassHandle,
      });
    }

    return parts;
  }

  if (archetype === 'kids') {
    const carcassHex = palette?.carcassHex ?? '#E8DFD2';
    const facadeHex = palette?.facadeHex ?? '#F5F0E8';
    const accentHex = palette?.accentHex ?? '#B6895E';
    const handleHex = palette?.handleHex ?? '#8C6239';

    const leftWardrobeW = Math.round(widthMm * 0.32);
    const shelfTowerW = Math.round(widthMm * 0.30);
    const centerW = Math.max(500, widthMm - leftWardrobeW - shelfTowerW);
    const innerTop = topMm + t;
    const innerH = Math.max(400, heightMm - t * 2);
    const deskTopY = topMm + Math.round(heightMm * 0.65);
    const upperCabH = Math.round(heightMm * 0.32);

    parts.push(
      {
        id: 'part-side-left',
        name: 'Shkaf chap yon devor',
        kind: 'side',
        xMm: leftMm,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-kids-mid-left',
        name: "Shkaf o'ng devori",
        kind: 'side',
        xMm: leftMm + leftWardrobeW - t,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-kids-mid-right',
        name: 'Kitob javon chap devori',
        kind: 'side',
        xMm: leftMm + leftWardrobeW + centerW,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-side-right',
        name: "O'ng yon devor",
        kind: 'side',
        xMm: leftMm + widthMm - t,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-top-board',
        name: 'Ustki qopqoq panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm,
        widthMm: widthMm - t * 2,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-bottom-plinth',
        name: 'Pastki taglik panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm + heightMm - t,
        widthMm: leftWardrobeW - t * 2,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-back-panel',
        name: 'Orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm,
        yMm: topMm,
        widthMm,
        heightMm,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: carcassHex,
      },
      // Center Study Desk Board
      {
        id: 'part-kids-desk',
        name: "O'quv stoli ustki paneli",
        kind: 'board',
        xMm: leftMm + leftWardrobeW,
        yMm: deskTopY,
        widthMm: centerW,
        heightMm: t * 2,
        depthMm,
        material: carcassMat,
        colorHex: accentHex,
      },
      // Center upper cabinet shelf
      {
        id: 'part-kids-upper-shelf',
        name: 'Yuqori shkaf ostki panel',
        kind: 'shelf',
        xMm: leftMm + leftWardrobeW,
        yMm: topMm + upperCabH,
        widthMm: centerW,
        heightMm: t,
        depthMm: Math.max(280, depthMm - 140),
        material: carcassMat,
        colorHex: carcassHex,
      },
    );

    // Bookshelf shelves on right tower
    const towerX = leftMm + leftWardrobeW + centerW + t;
    const towerInnerW = Math.max(200, shelfTowerW - t * 2);
    for (let s = 1; s <= 3; s++) {
      parts.push({
        id: `part-kids-book-shelf-${s}`,
        name: `Kitob javon polkasi #${s}`,
        kind: 'shelf',
        xMm: towerX,
        yMm: innerTop + Math.round(innerH * (s * 0.24)),
        widthMm: towerInnerW,
        heightMm: t,
        depthMm: depthMm - 30,
        material: carcassMat,
        colorHex: accentHex,
      });
    }

    // 2 Tall Wardrobe Doors on Left
    const lwInnerW = Math.max(200, leftWardrobeW - t * 2);
    const lwDoorW = Math.floor(lwInnerW / 2);
    for (let i = 0; i < 2; i++) {
      parts.push({
        id: `part-door-${i + 1}`,
        name: `Bolalar shkaf eshigi #${i + 1}`,
        kind: 'door',
        xMm: leftMm + t + i * lwDoorW,
        yMm: innerTop,
        widthMm: i === 1 ? lwInnerW - lwDoorW : lwDoorW,
        heightMm: innerH,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      });
    }

    // 2 Upper Overhead Doors above Desk
    const cwDoorW = Math.floor(centerW / 2);
    for (let i = 0; i < 2; i++) {
      parts.push({
        id: `part-upper-door-${i + 1}`,
        name: `Yuqori javon eshigi #${i + 1}`,
        kind: 'door',
        xMm: leftMm + leftWardrobeW + i * cwDoorW,
        yMm: innerTop,
        widthMm: i === 1 ? centerW - cwDoorW : cwDoorW,
        heightMm: upperCabH - t,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      });
    }

    // 2 Desk Drawers
    const drawerW = Math.round(centerW * 0.42);
    for (let i = 0; i < 2; i++) {
      parts.push({
        id: `part-kids-drawer-${i + 1}`,
        name: `Stol tortmasi #${i + 1}`,
        kind: 'drawer',
        xMm: leftMm + leftWardrobeW + centerW - drawerW,
        yMm: deskTopY + t * 2 + i * 165,
        widthMm: drawerW,
        heightMm: 155,
        depthMm: t,
        material: facadeMat,
        colorHex: accentHex,
        handleColorHex: handleHex,
      });
    }

    return parts;
  }

  if (archetype === 'hallway') {
    const carcassHex = palette?.carcassHex ?? '#2F3237';
    const facadeHex = palette?.facadeHex ?? '#2F3237';
    const accentHex = palette?.accentHex ?? '#A67B5B';
    const benchHex = palette?.countertopHex ?? '#EFEAE2';
    const handleHex = palette?.handleHex ?? '#D4AF37';

    const coatW = Math.round(widthMm * 0.42);
    const benchW = widthMm - coatW;
    const innerTop = topMm + t;
    const innerH = Math.max(400, heightMm - t * 2);
    const benchH = Math.max(440, Math.round(heightMm * 0.25));
    const benchTopY = topMm + heightMm - benchH;

    parts.push(
      {
        id: 'part-side-left',
        name: 'Chap yon devor',
        kind: 'side',
        xMm: leftMm,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-mid-side-wall',
        name: "O'rta ajratuvchi devor",
        kind: 'side',
        xMm: leftMm + coatW - t,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-side-right',
        name: "O'ng tumba yon devori",
        kind: 'side',
        xMm: leftMm + widthMm - t,
        yMm: benchTopY,
        widthMm: t,
        heightMm: benchH,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-top-board',
        name: 'Ustki qopqoq panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm,
        widthMm: coatW - t * 2,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-bottom-plinth',
        name: 'Pastki taglik panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm + heightMm - t,
        widthMm: widthMm - t * 2,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: carcassHex,
      },
      {
        id: 'part-back-panel',
        name: 'Orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm,
        yMm: topMm,
        widthMm: coatW,
        heightMm,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: carcassHex,
      },
      {
        id: 'part-hallway-slats-wall',
        name: "Reykali ilish devori",
        kind: 'board',
        xMm: leftMm + coatW,
        yMm: topMm,
        widthMm: benchW,
        heightMm: benchTopY - topMm,
        depthMm: 28,
        material: 'MDF',
        colorHex: accentHex,
      },
      {
        id: 'part-hallway-bench-seat',
        name: "Yumshoq o'tirish paneli",
        kind: 'board',
        xMm: leftMm + coatW,
        yMm: benchTopY,
        widthMm: benchW - t,
        heightMm: 42,
        depthMm,
        material: 'Akril',
        colorHex: benchHex,
      },
    );

    const innerCoatW = Math.max(240, coatW - t * 2);
    const doorW = Math.floor(innerCoatW / 2);
    for (let i = 0; i < 2; i++) {
      parts.push({
        id: `part-door-${i + 1}`,
        name: `Kiyim shkaf eshigi #${i + 1}`,
        kind: 'door',
        xMm: leftMm + t + i * doorW,
        yMm: innerTop,
        widthMm: i === 1 ? innerCoatW - doorW : doorW,
        heightMm: innerH,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      });
    }

    const shoeAreaH = Math.max(180, benchH - 42 - t);
    const singleShoeH = Math.floor(shoeAreaH / 2);
    for (let i = 0; i < 2; i++) {
      parts.push({
        id: `part-shoe-drawer-${i + 1}`,
        name: `Poyabzal tortmasi #${i + 1}`,
        kind: 'drawer',
        xMm: leftMm + coatW,
        yMm: benchTopY + 42 + i * singleShoeH,
        widthMm: benchW - t,
        heightMm: i === 1 ? shoeAreaH - singleShoeH : singleShoeH,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      });
    }

    return parts;
  }

  if (archetype === 'office') {
    const carcassHex = palette?.carcassHex ?? '#0A2E25';
    const facadeHex = palette?.facadeHex ?? '#144D3E';
    const accentHex = palette?.accentHex ?? '#6E4A30';
    const glassHex = palette?.glassHex ?? '#152F28';
    const frameHex = palette?.frameHex ?? '#23150D';
    const handleHex = palette?.handleHex ?? '#D4AF37';

    const towerW = Math.round(widthMm * 0.25);
    const centerW = widthMm - towerW * 2;
    const innerTop = topMm + t;
    const innerH = Math.max(400, heightMm - t * 2);
    const lowerCabH = Math.round(heightMm * 0.34);
    const upperVitH = Math.round(heightMm * 0.36);
    const deskTopY = topMm + Math.round(heightMm * 0.66);

    parts.push(
      {
        id: 'part-side-left',
        name: 'Chap kutubxona yon devor',
        kind: 'side',
        xMm: leftMm,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: accentHex,
      },
      {
        id: 'part-office-mid-left',
        name: 'Chap ichki ajratuvchi',
        kind: 'side',
        xMm: leftMm + towerW - t,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: accentHex,
      },
      {
        id: 'part-office-mid-right',
        name: "O'ng ichki ajratuvchi",
        kind: 'side',
        xMm: leftMm + towerW + centerW,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: accentHex,
      },
      {
        id: 'part-side-right',
        name: "O'ng kutubxona yon devor",
        kind: 'side',
        xMm: leftMm + widthMm - t,
        yMm: topMm,
        widthMm: t,
        heightMm,
        depthMm,
        material: carcassMat,
        colorHex: accentHex,
      },
      {
        id: 'part-top-board',
        name: 'Ustki qopqoq panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm,
        widthMm: widthMm - t * 2,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: accentHex,
      },
      {
        id: 'part-bottom-plinth',
        name: 'Pastki taglik panel',
        kind: 'board',
        xMm: leftMm + t,
        yMm: topMm + heightMm - t,
        widthMm: widthMm - t * 2,
        heightMm: t,
        depthMm,
        material: carcassMat,
        colorHex: accentHex,
      },
      {
        id: 'part-back-panel',
        name: 'Orqa devor (DVP/HDF)',
        kind: 'back',
        xMm: leftMm,
        yMm: topMm,
        widthMm,
        heightMm,
        depthMm: BACK_THICK_MM,
        material: 'DVP/HDF',
        colorHex: carcassHex,
      },
      {
        id: 'part-office-desk-top',
        name: 'Rahbar ish stoli ustki panel',
        kind: 'board',
        xMm: leftMm + towerW,
        yMm: deskTopY,
        widthMm: centerW,
        heightMm: t * 2,
        depthMm: depthMm + 60,
        material: carcassMat,
        colorHex: accentHex,
      },
    );

    // Shelves in left & right bookcases
    const tInnerW = Math.max(200, towerW - t * 2);
    for (let s = 1; s <= 3; s++) {
      const sy = innerTop + Math.round(innerH * (s * 0.2));
      parts.push(
        {
          id: `part-office-left-shelf-${s}`,
          name: `Chap javon polkasi #${s}`,
          kind: 'shelf',
          xMm: leftMm + t,
          yMm: sy,
          widthMm: tInnerW,
          heightMm: t,
          depthMm: depthMm - 30,
          material: carcassMat,
          colorHex: carcassHex,
        },
        {
          id: `part-office-right-shelf-${s}`,
          name: `O'ng javon polkasi #${s}`,
          kind: 'shelf',
          xMm: leftMm + towerW + centerW + t,
          yMm: sy,
          widthMm: tInnerW,
          heightMm: t,
          depthMm: depthMm - 30,
          material: carcassMat,
          colorHex: carcassHex,
        },
      );
    }

    // Left & right lower cabinet doors + upper glass vitrine doors + desk drawers
    parts.push(
      {
        id: 'part-door-1',
        name: 'Chap pastki shkaf eshigi',
        kind: 'door',
        xMm: leftMm + t,
        yMm: topMm + heightMm - lowerCabH,
        widthMm: tInnerW,
        heightMm: lowerCabH - t,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      },
      {
        id: 'part-door-2',
        name: "O'ng pastki shkaf eshigi",
        kind: 'door',
        xMm: leftMm + towerW + centerW + t,
        yMm: topMm + heightMm - lowerCabH,
        widthMm: tInnerW,
        heightMm: lowerCabH - t,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      },
    );

    const vitDoorW = Math.floor(centerW / 2);
    for (let i = 0; i < 2; i++) {
      parts.push({
        id: `part-office-vitrine-${i + 1}`,
        name: `Yuqori shisha vitrina #${i + 1}`,
        kind: 'door',
        xMm: leftMm + towerW + i * vitDoorW,
        yMm: innerTop,
        widthMm: i === 1 ? centerW - vitDoorW : vitDoorW,
        heightMm: upperVitH,
        depthMm: t,
        material: 'Shisha',
        colorHex: glassHex,
        frameColorHex: frameHex,
        handleColorHex: handleHex,
      });
    }

    const pedW = Math.round(centerW * 0.28);
    parts.push(
      {
        id: 'part-office-drawer-1',
        name: 'Chap tumba tortmasi',
        kind: 'drawer',
        xMm: leftMm + towerW,
        yMm: deskTopY + t * 2,
        widthMm: pedW,
        heightMm: heightMm - (deskTopY - topMm) - t * 3,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      },
      {
        id: 'part-office-drawer-2',
        name: "O'ng tumba tortmasi",
        kind: 'drawer',
        xMm: leftMm + towerW + centerW - pedW,
        yMm: deskTopY + t * 2,
        widthMm: pedW,
        heightMm: heightMm - (deskTopY - topMm) - t * 3,
        depthMm: t,
        material: facadeMat,
        colorHex: facadeHex,
        handleColorHex: handleHex,
      },
    );

    return parts;
  }

  // Default: Shkaf / Wardrobe
  const blackFrame = palette?.frameHex ?? palette?.carcassHex ?? '#1F2226';
  const sandMdf = palette?.facadeHex ?? '#C4B199';
  const smokedGlass = palette?.glassHex ?? '#2C2824';
  const warmInterior = palette?.accentHex ?? '#A68868';
  const handleHex = palette?.handleHex ?? blackFrame;

  const innerLeft = leftMm + t;
  const innerW = Math.max(300, widthMm - t * 2);
  const innerTop = topMm + t;
  const innerH = Math.max(400, heightMm - t * 2);

  parts.push(
    {
      id: 'part-side-left',
      name: 'Chap yon devor',
      kind: 'side',
      xMm: leftMm,
      yMm: topMm,
      widthMm: t,
      heightMm,
      depthMm,
      material: carcassMat,
      colorHex: blackFrame,
    },
    {
      id: 'part-side-right',
      name: "O'ng yon devor",
      kind: 'side',
      xMm: leftMm + widthMm - t,
      yMm: topMm,
      widthMm: t,
      heightMm,
      depthMm,
      material: carcassMat,
      colorHex: blackFrame,
    },
    {
      id: 'part-top-board',
      name: 'Ustki qopqoq panel',
      kind: 'board',
      xMm: innerLeft,
      yMm: topMm,
      widthMm: innerW,
      heightMm: t,
      depthMm,
      material: carcassMat,
      colorHex: blackFrame,
    },
    {
      id: 'part-bottom-plinth',
      name: 'Pastki taglik panel',
      kind: 'board',
      xMm: innerLeft,
      yMm: topMm + heightMm - t,
      widthMm: innerW,
      heightMm: t,
      depthMm,
      material: carcassMat,
      colorHex: blackFrame,
    },
    {
      id: 'part-back-panel',
      name: 'Orqa devor (DVP/HDF)',
      kind: 'back',
      xMm: leftMm,
      yMm: topMm,
      widthMm,
      heightMm,
      depthMm: BACK_THICK_MM,
      material: 'DVP/HDF',
      colorHex: warmInterior,
    },
  );

  const divX = innerLeft + Math.round(innerW / 2) - Math.round(t / 2);
  parts.push(
    {
      id: 'part-inner-divider',
      name: "Ichki to'siq",
      kind: 'divider',
      xMm: divX,
      yMm: innerTop,
      widthMm: t,
      heightMm: innerH,
      depthMm: depthMm - 30,
      material: carcassMat,
      colorHex: warmInterior,
    },
    {
      id: 'part-inner-shelf-1',
      name: 'Chap polka #1',
      kind: 'shelf',
      xMm: innerLeft,
      yMm: innerTop + Math.round(innerH * 0.28),
      widthMm: divX - innerLeft,
      heightMm: t,
      depthMm: depthMm - 30,
      material: carcassMat,
      colorHex: warmInterior,
    },
    {
      id: 'part-inner-shelf-2',
      name: 'Chap polka #2',
      kind: 'shelf',
      xMm: innerLeft,
      yMm: innerTop + Math.round(innerH * 0.62),
      widthMm: divX - innerLeft,
      heightMm: t,
      depthMm: depthMm - 30,
      material: carcassMat,
      colorHex: warmInterior,
    },
    {
      id: 'part-inner-shelf-3',
      name: "O'ng polka #1",
      kind: 'shelf',
      xMm: divX + t,
      yMm: innerTop + Math.round(innerH * 0.34),
      widthMm: innerLeft + innerW - (divX + t),
      heightMm: t,
      depthMm: depthMm - 30,
      material: carcassMat,
      colorHex: warmInterior,
    },
    {
      id: 'part-inner-shelf-4',
      name: "O'ng polka #2",
      kind: 'shelf',
      xMm: divX + t,
      yMm: innerTop + Math.round(innerH * 0.68),
      widthMm: innerLeft + innerW - (divX + t),
      heightMm: t,
      depthMm: depthMm - 30,
      material: carcassMat,
      colorHex: warmInterior,
    },
  );

  const doorCount = Math.max(3, Math.min(5, layoutVariant?.doorsCount ?? 4));
  const doorW = Math.floor(innerW / doorCount);
  const hasVitrine = layoutVariant?.hasVitrine !== false;
  for (let i = 0; i < doorCount; i++) {
    const isGlass = hasVitrine && (i === 0 || i === doorCount - 1);
    parts.push({
      id: `part-door-${i + 1}`,
      name: isGlass ? `Shisha eshik #${i + 1}` : `Fasad eshik #${i + 1}`,
      kind: 'door',
      xMm: innerLeft + i * doorW,
      yMm: innerTop,
      widthMm: i === doorCount - 1 ? innerW - i * doorW : doorW,
      heightMm: innerH,
      depthMm: t,
      material: isGlass ? 'Shisha' : facadeMat,
      colorHex: isGlass ? smokedGlass : sandMdf,
      frameColorHex: blackFrame,
      handleColorHex: handleHex,
    });
  }

  return parts;
}

function getTierKey(part: FurnitureSubPart): 'upper' | 'lower' | 'vitrine' | 'main' {
  if (part.id.startsWith('part-upper-') || part.id.startsWith('part-oak-niche-')) return 'upper';
  if (part.id.startsWith('part-lower-')) return 'lower';
  if (part.id.startsWith('part-tv-vitrine') || part.id === 'part-vitrine-side-left') return 'vitrine';
  return 'main';
}

function getTierParts(allParts: FurnitureSubPart[], forPart?: FurnitureSubPart): FurnitureSubPart[] {
  if (!forPart || forPart.isFreePlaced) {
    return allParts.filter((p) => !p.isFreePlaced && p.kind !== 'back');
  }
  const tier = getTierKey(forPart);
  if (tier === 'upper') {
    const matched = allParts.filter((p) => getTierKey(p) === 'upper' && p.kind !== 'back');
    if (matched.length > 0) return matched;
  } else if (tier === 'lower') {
    const matched = allParts.filter((p) => getTierKey(p) === 'lower' && p.kind !== 'back');
    if (matched.length > 0) return matched;
  } else if (tier === 'vitrine') {
    const matched = allParts.filter(
      (p) => (getTierKey(p) === 'vitrine' || p.id === 'part-side-right') && p.kind !== 'back',
    );
    if (matched.length > 0) return matched;
  }
  const main = allParts.filter((p) => !p.isFreePlaced && p.kind !== 'back');
  return main.length > 0 ? main : allParts;
}

/**
 * Computes inner and outer structural cabinet limits (inside Left/Right sides and Top/Bottom boards)
 * so interior shelves, dividers, facades, and back panels can NEVER pass outside their cabinet enclosure.
 */
export function getCabinetEnclosureBounds(
  allParts: FurnitureSubPart[],
  forPart?: FurnitureSubPart,
): {
  outerMinX: number;
  outerMaxX: number;
  outerMinY: number;
  outerMaxY: number;
  innerMinX: number;
  innerMaxX: number;
  innerMinY: number;
  innerMaxY: number;
  maxDepthMm: number;
  upperDepthMm: number;
} {
  const core = allParts.filter((p) => !p.isFreePlaced && p.kind !== 'back');
  const allList = core.length > 0 ? core : allParts;
  const list = getTierParts(allParts, forPart);

  const mainCarcass = allList.filter(
    (p) =>
      getTierKey(p) !== 'upper' &&
      p.id !== 'part-countertop' &&
      p.id !== 'part-backsplash' &&
      p.id !== 'part-vanity-back-wall' &&
      p.id !== 'part-tv-panel' &&
      p.kind !== 'door' &&
      p.kind !== 'drawer',
  );
  const upperCarcass = allList.filter(
    (p) => getTierKey(p) === 'upper' && p.kind !== 'door' && p.kind !== 'drawer',
  );
  const maxDepthMm = Math.max(
    350,
    ...(mainCarcass.length > 0 ? mainCarcass : allList).map((p) => p.depthMm),
  );
  const upperDepthMm = Math.max(
    260,
    ...(upperCarcass.length > 0 ? upperCarcass : [{ depthMm: 360 }]).map((p) => p.depthMm),
  );

  if (list.length === 0) {
    return {
      outerMinX: 0,
      outerMaxX: WALL_WIDTH_MM,
      outerMinY: 0,
      outerMaxY: WALL_HEIGHT_MM,
      innerMinX: BOARD_THICK_MM,
      innerMaxX: WALL_WIDTH_MM - BOARD_THICK_MM,
      innerMinY: BOARD_THICK_MM,
      innerMaxY: WALL_HEIGHT_MM - BOARD_THICK_MM,
      maxDepthMm,
      upperDepthMm,
    };
  }

  const outerMinX = Math.min(...list.map((p) => p.xMm));
  const outerMaxX = Math.max(...list.map((p) => p.xMm + p.widthMm));
  const outerMinY = Math.min(...list.map((p) => p.yMm));
  const outerMaxY = Math.max(...list.map((p) => p.yMm + p.heightMm));

  const leftSides = list.filter((p) => p.kind === 'side' && p.xMm <= outerMinX + 40);
  const rightSides = list.filter(
    (p) => p.kind === 'side' && p.xMm + p.widthMm >= outerMaxX - 40,
  );
  const topBoards = list.filter(
    (p) => p.kind === 'board' && p.heightMm <= 60 && p.yMm <= outerMinY + 40,
  );
  const bottomBoards = list.filter(
    (p) => p.kind === 'board' && p.heightMm <= 60 && p.yMm + p.heightMm >= outerMaxY - 40,
  );

  const innerMinX = leftSides.length
    ? Math.max(...leftSides.map((s) => s.xMm + s.widthMm))
    : outerMinX + BOARD_THICK_MM;
  const innerMaxX = rightSides.length
    ? Math.min(...rightSides.map((s) => s.xMm))
    : outerMaxX - BOARD_THICK_MM;
  const innerMinY = topBoards.length
    ? Math.max(...topBoards.map((b) => b.yMm + b.heightMm))
    : outerMinY + BOARD_THICK_MM;
  const innerMaxY = bottomBoards.length
    ? Math.min(...bottomBoards.map((b) => b.yMm))
    : outerMaxY - BOARD_THICK_MM;

  return {
    outerMinX,
    outerMaxX,
    outerMinY,
    outerMaxY,
    innerMinX,
    innerMaxX,
    innerMinY,
    innerMaxY,
    maxDepthMm,
    upperDepthMm,
  };
}

function isInteriorPart(part: FurnitureSubPart): boolean {
  return part.kind === 'shelf' || part.kind === 'divider';
}

function isFacadePart(part: FurnitureSubPart): boolean {
  return part.kind === 'door' || part.kind === 'drawer';
}

/**
 * Exact 3D Z-axis interval [z1, z2] in mm matching the 3D CAD geometry in Cabinet3DConstructor.
 */
function getPartZBoundsMm(
  part: FurnitureSubPart,
  maxDepthMm: number,
  upperDepthMm: number,
): [number, number] {
  const isUpper = getTierKey(part) === 'upper';
  const effD = isUpper ? upperDepthMm : maxDepthMm;

  if (part.kind === 'back') {
    return [-Math.max(4, part.depthMm), 0];
  }
  if (part.kind === 'door' || part.kind === 'drawer') {
    return [effD + 1, effD + 23];
  }
  if (part.kind === 'board' && part.heightMm > 60) {
    const d = Math.max(16, Math.min(60, part.depthMm));
    return [2, 2 + d];
  }
  if (part.kind === 'shelf' || part.kind === 'divider') {
    const d = Math.max(120, Math.min(effD - BOARD_THICK_MM, part.depthMm));
    return [4, 4 + d];
  }
  if (part.id === 'part-countertop') {
    return [0, Math.max(300, part.depthMm)];
  }
  const d = Math.max(180, Math.min(effD, part.depthMm));
  return [0, d];
}

/**
 * Strict 3D AABB collision pairing across ALL furniture parts:
 * - Shelves, Dividers, Side Panels, Horizontal Boards, Doors, Drawers, and Back Panels (DVP/HDF).
 * Two parts collide in X/Y whenever their 3D Z intervals overlap (strict 3D AABB).
 */
function shouldCollideIn3D(
  a: FurnitureSubPart,
  b: FurnitureSubPart,
  maxDepthMm: number,
  upperDepthMm: number,
): boolean {
  if (a.id === b.id) return false;
  // Ignore intentional preset decorative backing overlap on open kitchen oak niche & TV wall panel
  if (
    (a.id === 'part-oak-niche-back' && b.id.startsWith('part-oak-niche-')) ||
    (b.id === 'part-oak-niche-back' && a.id.startsWith('part-oak-niche-'))
  ) {
    return false;
  }
  const [az1, az2] = getPartZBoundsMm(a, maxDepthMm, upperDepthMm);
  const [bz1, bz2] = getPartZBoundsMm(b, maxDepthMm, upperDepthMm);
  return Math.min(az2, bz2) > Math.max(az1, bz1);
}

/**
 * Computes strict X/Y containment bounds for a part:
 * - Shelves, dividers, doors, drawers -> strictly inside their cabinet tier's inner walls.
 * - Back Panel (DVP/HDF) -> strictly inside its cabinet tier's outer structural frame (or wall limits).
 * - Side Panels & Structural Boards -> strictly inside wall limits [0..WALL_WIDTH_MM, 0..WALL_HEIGHT_MM].
 */
function getPartBoundaryLimits(
  part: FurnitureSubPart,
  allParts: FurnitureSubPart[],
): { boundMinX: number; boundMaxX: number; boundMinY: number; boundMaxY: number } {
  const enclosure = getCabinetEnclosureBounds(allParts, part);

  if (isInteriorPart(part) || isFacadePart(part)) {
    return {
      boundMinX: enclosure.innerMinX,
      boundMaxX: enclosure.innerMaxX,
      boundMinY: enclosure.innerMinY,
      boundMaxY: enclosure.innerMaxY,
    };
  }

  if (part.kind === 'back') {
    const tierStructural = getTierParts(allParts, part).filter(
      (p) =>
        p.id !== part.id &&
        (p.kind === 'side' || (p.kind === 'board' && p.heightMm <= 60)),
    );
    if (tierStructural.length > 0) {
      let minX = Math.min(...tierStructural.map((p) => p.xMm));
      let maxX = Math.max(...tierStructural.map((p) => p.xMm + p.widthMm));
      let minY = Math.min(...tierStructural.map((p) => p.yMm));
      let maxY = Math.max(...tierStructural.map((p) => p.yMm + p.heightMm));

      // Handle partial-width back panels like TV console back or hallway coat back
      if (part.id === 'part-back-panel') {
        const tvPanel = allParts.find((p) => p.id === 'part-tv-panel');
        const midWall = allParts.find((p) => p.id === 'part-mid-side-wall');
        if (tvPanel) {
          maxX = Math.min(maxX, tvPanel.xMm + tvPanel.widthMm);
          const consoleTop = allParts.find((p) => p.id === 'part-top-board');
          if (consoleTop) minY = Math.max(minY, consoleTop.yMm);
        } else if (midWall) {
          maxX = Math.min(maxX, midWall.xMm + midWall.widthMm);
        }
      }

      return {
        boundMinX: Math.max(0, minX),
        boundMaxX: Math.min(WALL_WIDTH_MM, maxX),
        boundMinY: Math.max(0, minY),
        boundMaxY: Math.min(WALL_HEIGHT_MM, maxY),
      };
    }
    return {
      boundMinX: enclosure.outerMinX,
      boundMaxX: enclosure.outerMaxX,
      boundMinY: enclosure.outerMinY,
      boundMaxY: enclosure.outerMaxY,
    };
  }

  return {
    boundMinX: 0,
    boundMaxX: WALL_WIDTH_MM,
    boundMinY: 0,
    boundMaxY: WALL_HEIGHT_MM,
  };
}

export function getMinDimsForPart(part: FurnitureSubPart): { minW: number; minH: number } {
  if (part.kind === 'side' || part.kind === 'divider') {
    return { minW: BOARD_THICK_MM, minH: MIN_PART_MM };
  }
  if (part.kind === 'shelf' || (part.kind === 'board' && part.heightMm <= 60)) {
    return { minW: MIN_PART_MM, minH: BOARD_THICK_MM };
  }
  return { minW: MIN_PART_MM, minH: MIN_PART_MM };
}

/**
 * STRICT 3D AABB HARD COLLISION LOCK (0 mm Gap) for Dragging EVERY part
 * (Shelves, Dividers, Doors, Drawers, Left/Right Side Panels, Boards, and Back Panel).
 */
export function clampMoveWithStrictCollision(
  movingPart: FurnitureSubPart,
  targetXMm: number,
  targetYMm: number,
  allParts: FurnitureSubPart[],
): { xMm: number; yMm: number; hitEdges: CollisionEdge[] } {
  const globalEnc = getCabinetEnclosureBounds(allParts);
  const others = allParts.filter((p) =>
    shouldCollideIn3D(movingPart, p, globalEnc.maxDepthMm, globalEnc.upperDepthMm),
  );
  const hitEdges = new Set<CollisionEdge>();
  const { boundMinX, boundMaxX, boundMinY, boundMaxY } = getPartBoundaryLimits(
    movingPart,
    allParts,
  );

  let nextX = Math.round(targetXMm);
  if (nextX <= boundMinX) {
    if (nextX < boundMinX) hitEdges.add('left');
    nextX = boundMinX;
  }
  if (nextX + movingPart.widthMm >= boundMaxX) {
    if (nextX + movingPart.widthMm > boundMaxX) hitEdges.add('right');
    nextX = Math.max(boundMinX, boundMaxX - movingPart.widthMm);
  }

  const dx = nextX - movingPart.xMm;
  if (dx > 0) {
    let limitRight = nextX + movingPart.widthMm;
    for (const other of others) {
      const yOverlaps =
        movingPart.yMm < other.yMm + other.heightMm &&
        movingPart.yMm + movingPart.heightMm > other.yMm;
      if (!yOverlaps) continue;
      if (movingPart.xMm + movingPart.widthMm <= other.xMm && limitRight > other.xMm) {
        limitRight = other.xMm;
        hitEdges.add('right');
      }
    }
    nextX = limitRight - movingPart.widthMm;
  } else if (dx < 0) {
    let limitLeft = nextX;
    for (const other of others) {
      const yOverlaps =
        movingPart.yMm < other.yMm + other.heightMm &&
        movingPart.yMm + movingPart.heightMm > other.yMm;
      if (!yOverlaps) continue;
      const oRight = other.xMm + other.widthMm;
      if (movingPart.xMm >= oRight && limitLeft < oRight) {
        limitLeft = oRight;
        hitEdges.add('left');
      }
    }
    nextX = limitLeft;
  }

  nextX = Math.max(boundMinX, Math.min(Math.max(boundMinX, boundMaxX - movingPart.widthMm), nextX));

  let nextY = Math.round(targetYMm);
  if (nextY <= boundMinY) {
    if (nextY < boundMinY) hitEdges.add('top');
    nextY = boundMinY;
  }
  if (nextY + movingPart.heightMm >= boundMaxY) {
    if (nextY + movingPart.heightMm > boundMaxY) hitEdges.add('bottom');
    nextY = Math.max(boundMinY, boundMaxY - movingPart.heightMm);
  }

  const dy = nextY - movingPart.yMm;
  if (dy > 0) {
    let limitBottom = nextY + movingPart.heightMm;
    for (const other of others) {
      const xOverlaps = nextX < other.xMm + other.widthMm && nextX + movingPart.widthMm > other.xMm;
      if (!xOverlaps) continue;
      if (movingPart.yMm + movingPart.heightMm <= other.yMm && limitBottom > other.yMm) {
        limitBottom = other.yMm;
        hitEdges.add('bottom');
      }
    }
    nextY = limitBottom - movingPart.heightMm;
  } else if (dy < 0) {
    let limitTop = nextY;
    for (const other of others) {
      const xOverlaps = nextX < other.xMm + other.widthMm && nextX + movingPart.widthMm > other.xMm;
      if (!xOverlaps) continue;
      const oBottom = other.yMm + other.heightMm;
      if (movingPart.yMm >= oBottom && limitTop < oBottom) {
        limitTop = oBottom;
        hitEdges.add('top');
      }
    }
    nextY = limitTop;
  }

  nextY = Math.max(
    boundMinY,
    Math.min(Math.max(boundMinY, boundMaxY - movingPart.heightMm), nextY),
  );

  return {
    xMm: nextX,
    yMm: nextY,
    hitEdges: Array.from(hitEdges),
  };
}

/**
 * STRICT 3D AABB HARD COLLISION LOCK (0 mm Gap) for Resizing EVERY part
 * (Shelves, Dividers, Doors, Drawers, Left/Right Side Panels, Boards, and Back Panel).
 */
export function clampResizeWithStrictCollision(
  part: FurnitureSubPart,
  proposed: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  allParts: FurnitureSubPart[],
): { xMm: number; yMm: number; widthMm: number; heightMm: number; hitEdges: CollisionEdge[] } {
  const globalEnc = getCabinetEnclosureBounds(allParts);
  const others = allParts.filter((p) =>
    shouldCollideIn3D(part, p, globalEnc.maxDepthMm, globalEnc.upperDepthMm),
  );
  const hitEdges = new Set<CollisionEdge>();
  const { boundMinX, boundMaxX, boundMinY, boundMaxY } = getPartBoundaryLimits(part, allParts);
  const { minW, minH } = getMinDimsForPart(part);

  let left = Math.round(proposed.xMm);
  let right = Math.round(proposed.xMm + proposed.widthMm);
  let top = Math.round(proposed.yMm);
  let bottom = Math.round(proposed.yMm + proposed.heightMm);

  const origLeft = part.xMm;
  const origRight = part.xMm + part.widthMm;
  const origTop = part.yMm;
  const origBottom = part.yMm + part.heightMm;

  if (left < boundMinX) {
    left = boundMinX;
    hitEdges.add('left');
  }
  if (right > boundMaxX) {
    right = boundMaxX;
    hitEdges.add('right');
  }
  if (top < boundMinY) {
    top = boundMinY;
    hitEdges.add('top');
  }
  if (bottom > boundMaxY) {
    bottom = boundMaxY;
    hitEdges.add('bottom');
  }

  for (const other of others) {
    const oLeft = other.xMm;
    const oRight = other.xMm + other.widthMm;
    const oTop = other.yMm;
    const oBottom = other.yMm + other.heightMm;

    const yOverlap = Math.min(bottom, oBottom) > Math.max(top, oTop);
    if (yOverlap) {
      if (right > origRight && origRight <= oLeft && right > oLeft) {
        right = Math.min(right, oLeft);
        hitEdges.add('right');
      }
      if (left < origLeft && origLeft >= oRight && left < oRight) {
        left = Math.max(left, oRight);
        hitEdges.add('left');
      }
    }
  }

  for (const other of others) {
    const oLeft = other.xMm;
    const oRight = other.xMm + other.widthMm;
    const oTop = other.yMm;
    const oBottom = other.yMm + other.heightMm;

    const xOverlap = Math.min(right, oRight) > Math.max(left, oLeft);
    if (xOverlap) {
      if (bottom > origBottom && origBottom <= oTop && bottom > oTop) {
        bottom = Math.min(bottom, oTop);
        hitEdges.add('bottom');
      }
      if (top < origTop && origTop >= oBottom && top < oBottom) {
        top = Math.max(top, oBottom);
        hitEdges.add('top');
      }
    }
  }

  if (right - left < minW) {
    if (left > origLeft) {
      left = Math.max(origLeft, right - minW);
    } else if (right < origRight) {
      right = Math.min(origRight, left + minW);
    }
  }
  if (bottom - top < minH) {
    if (top > origTop) {
      top = Math.max(origTop, bottom - minH);
    } else if (bottom < origBottom) {
      bottom = Math.min(origBottom, top + minH);
    }
  }

  return {
    xMm: left,
    yMm: top,
    widthMm: Math.max(minW, right - left),
    heightMm: Math.max(minH, bottom - top),
    hitEdges: Array.from(hitEdges),
  };
}

/**
 * Spawns newly created Polka / To'siq / Tortma / Eshik strictly inside the cabinet carcass
 * in a collision-free compartment slot.
 */
export function findFreeSpawnPosition(
  kind: SubPartKind,
  widthMm: number,
  heightMm: number,
  existingParts: FurnitureSubPart[],
): { xMm: number; yMm: number; widthMm: number; heightMm: number; depthMm: number } {
  const enc = getCabinetEnclosureBounds(existingParts);
  const availW = Math.max(MIN_PART_MM, enc.innerMaxX - enc.innerMinX);
  const availH = Math.max(MIN_PART_MM, enc.innerMaxY - enc.innerMinY);

  const clampedW =
    kind === 'side' || kind === 'divider'
      ? BOARD_THICK_MM
      : Math.min(availW, Math.max(MIN_PART_MM, widthMm));
  const clampedH =
    kind === 'shelf' || kind === 'board'
      ? BOARD_THICK_MM
      : Math.min(availH, Math.max(MIN_PART_MM, heightMm));
  const clampedD =
    kind === 'door' || kind === 'drawer'
      ? BOARD_THICK_MM
      : Math.max(180, enc.maxDepthMm - 24);

  const probeDummy: FurnitureSubPart = {
    id: '__probe__',
    name: 'probe',
    kind,
    xMm: enc.innerMinX,
    yMm: enc.innerMinY,
    widthMm: clampedW,
    heightMm: clampedH,
    depthMm: clampedD,
    material: 'LDSP',
  };

  const overlapsAny = (x: number, y: number) => {
    for (const p of existingParts) {
      if (!shouldCollideIn3D(probeDummy, p, enc.maxDepthMm, enc.upperDepthMm)) continue;
      if (
        x < p.xMm + p.widthMm &&
        x + clampedW > p.xMm &&
        y < p.yMm + p.heightMm &&
        y + clampedH > p.yMm
      ) {
        return true;
      }
    }
    return false;
  };

  for (let y = enc.innerMinY + 60; y <= enc.innerMaxY - clampedH; y += 60) {
    for (let x = enc.innerMinX; x <= enc.innerMaxX - clampedW; x += 60) {
      if (!overlapsAny(x, y)) {
        return { xMm: x, yMm: y, widthMm: clampedW, heightMm: clampedH, depthMm: clampedD };
      }
    }
  }

  return {
    xMm: enc.innerMinX,
    yMm: Math.min(enc.innerMaxY - clampedH, enc.innerMinY + Math.round(availH * 0.4)),
    widthMm: clampedW,
    heightMm: clampedH,
    depthMm: clampedD,
  };
}

export function getPartRatePerSqm(mat: PartMaterial, pricing: MaterialPricing): number {
  switch (mat) {
    case 'LDSP':
      return pricing.ldspPerSqm;
    case 'MDF':
      return pricing.mdfPerSqm;
    case 'Akril':
      return pricing.acrylicPerSqm;
    case 'Shisha':
      return pricing.veneerPerSqm * 1.1;
    case 'DVP/HDF':
      return Math.round(pricing.ldspPerSqm * 0.42);
  }
}

export function getSubPartSurfaceAreaSqm(part: FurnitureSubPart): number {
  if (part.kind === 'side' || part.kind === 'divider') {
    return (part.heightMm / 1000) * (part.depthMm / 1000);
  }
  if (part.kind === 'shelf' || (part.kind === 'board' && part.heightMm <= 60)) {
    return (part.widthMm / 1000) * (part.depthMm / 1000);
  }
  return (part.widthMm / 1000) * (part.heightMm / 1000);
}

export function formatSubPartDimensionsMm(part: FurnitureSubPart): string {
  if (part.kind === 'side' || part.kind === 'divider') {
    return `${part.heightMm} × ${part.depthMm} × ${part.widthMm} mm`;
  }
  if (part.kind === 'shelf' || (part.kind === 'board' && part.heightMm <= 60)) {
    return `${part.widthMm} × ${part.depthMm} × ${part.heightMm} mm`;
  }
  if (part.kind === 'back') {
    return `${part.heightMm} × ${part.widthMm} × ${part.depthMm} mm`;
  }
  return `${part.widthMm} × ${part.heightMm} × ${part.depthMm} mm`;
}

export function calculateSingleSubPartPrice(
  part: FurnitureSubPart,
  pricing: MaterialPricing,
): number {
  const areaSqm = getSubPartSurfaceAreaSqm(part);
  const rate = getPartRatePerSqm(part.material, pricing);
  const perimeterM =
    part.kind === 'back'
      ? 0
      : (2 * (Math.max(part.widthMm, part.heightMm) + part.depthMm)) / 1000;
  const kindBonus =
    part.kind === 'drawer'
      ? pricing.extraDrawerPrice * 0.45
      : part.kind === 'door' && part.material === 'Shisha'
        ? pricing.extraGlassDoorPrice * 0.4
        : 0;

  const raw =
    (areaSqm * rate * 1.12 + perimeterM * pricing.edgeBandingPerM + kindBonus) *
    (1 + pricing.laborPercent / 100);
  return Math.max(40000, Math.round(raw / 10000) * 10000);
}

/**
 * Converts all 3D parts (including Side Panels, Top/Bottom Boards, and DVP/HDF Back Panels)
 * into cutting parts ready for the 2750x1830 mm 2D Raskroy layout.
 */
export function subPartsToCuttingParts(subParts: FurnitureSubPart[]): CuttingPart[] {
  const result: CuttingPart[] = [];

  for (const sp of subParts) {
    let dimA = sp.widthMm;
    let dimB = sp.heightMm;

    if (sp.kind === 'side' || sp.kind === 'divider') {
      dimA = sp.heightMm;
      dimB = sp.depthMm;
    } else if (sp.kind === 'shelf' || (sp.kind === 'board' && sp.heightMm <= 60)) {
      dimA = sp.widthMm;
      dimB = sp.depthMm;
    }

    const longMm = Math.max(dimA, dimB);
    const shortMm = Math.min(dimA, dimB);

    // Automatically split oversized panels (> 1810 mm width) into joinable halves so they pack onto 2750x1830 mm sheets
    if (shortMm > 1810) {
      const halfShort = Math.round(shortMm / 2);
      result.push({
        id: sp.id,
        name: `${sp.name} (2 qism)`,
        lengthMm: Math.min(2730, longMm),
        widthMm: halfShort,
        qty: 2,
        material: sp.material,
        edgeBandingSides: sp.kind === 'back' ? 'Kromkasiz (DVP)' : '1 uzun + 2 qisqa',
        role:
          sp.kind === 'door'
            ? 'facade'
            : sp.kind === 'drawer'
              ? 'drawer'
              : sp.kind === 'shelf'
                ? 'shelf'
                : 'carcass',
      });
    } else {
      result.push({
        id: sp.id,
        name: sp.name,
        lengthMm: Math.min(2730, longMm),
        widthMm: shortMm,
        qty: 1,
        material: sp.material,
        edgeBandingSides:
          sp.kind === 'back'
            ? 'Kromkasiz (DVP)'
            : sp.kind === 'door'
              ? '4 tomonlama'
              : '1 uzun + 2 qisqa',
        role:
          sp.kind === 'door'
            ? 'facade'
            : sp.kind === 'drawer'
              ? 'drawer'
              : sp.kind === 'shelf'
                ? 'shelf'
                : 'carcass',
      });
    }
  }

  return result;
}

/**
 * Proportionally scales & moves all subParts when dragging/resizing the photorealistic view,
 * keeping 18 mm structural board thicknesses exact and inner components flush.
 */
export function transformSubPartsToTargetBounds(
  initialParts: FurnitureSubPart[],
  targetBounds: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): FurnitureSubPart[] {
  if (initialParts.length === 0) return [];
  const initMinX = Math.min(...initialParts.map((p) => p.xMm));
  const initMinY = Math.min(...initialParts.map((p) => p.yMm));
  const initMaxX = Math.max(...initialParts.map((p) => p.xMm + p.widthMm));
  const initMaxY = Math.max(...initialParts.map((p) => p.yMm + p.heightMm));
  const initW = Math.max(1, initMaxX - initMinX);
  const initH = Math.max(1, initMaxY - initMinY);

  const clampedX = Math.max(0, Math.min(WALL_WIDTH_MM - 600, Math.round(targetBounds.xMm)));
  const clampedY = Math.max(0, Math.min(WALL_HEIGHT_MM - 600, Math.round(targetBounds.yMm)));
  const clampedW = Math.max(600, Math.min(WALL_WIDTH_MM - clampedX, Math.round(targetBounds.widthMm)));
  const clampedH = Math.max(600, Math.min(WALL_HEIGHT_MM - clampedY, Math.round(targetBounds.heightMm)));

  const scaleX = clampedW / initW;
  const scaleY = clampedH / initH;

  return initialParts.map((p) => {
    const x1 = clampedX + Math.round((p.xMm - initMinX) * scaleX);
    const x2 = clampedX + Math.round((p.xMm + p.widthMm - initMinX) * scaleX);
    const y1 = clampedY + Math.round((p.yMm - initMinY) * scaleY);
    const y2 = clampedY + Math.round((p.yMm + p.heightMm - initMinY) * scaleY);

    const { minW, minH } = getMinDimsForPart(p);
    const isFixedThinX = p.kind === 'side' || p.kind === 'divider';
    const isFixedThinY = p.kind === 'shelf' || (p.kind === 'board' && p.heightMm <= 60);

    return {
      ...p,
      xMm: isFixedThinX && p.xMm >= initMaxX - BOARD_THICK_MM - 5 ? clampedX + clampedW - p.widthMm : x1,
      yMm: isFixedThinY && p.yMm >= initMaxY - BOARD_THICK_MM - 5 ? clampedY + clampedH - p.heightMm : y1,
      widthMm: isFixedThinX ? p.widthMm : Math.max(minW, x2 - x1),
      heightMm: isFixedThinY ? p.heightMm : Math.max(minH, y2 - y1),
    };
  });
}
