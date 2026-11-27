import type {
  CuttingPart,
  NestingResult,
  PackedPartRect,
  PackedSheet,
  SheetSizeKey,
} from '../types.ts';

export const SHEET_DIMENSIONS: Record<SheetSizeKey, { widthMm: number; heightMm: number; label: string }> = {
  '2750x1830': {
    widthMm: 2750,
    heightMm: 1830,
    label: '2750 × 1830 mm (Rossiya LDSP)',
  },
  '2800x2070': {
    widthMm: 2800,
    heightMm: 2070,
    label: '2800 × 2070 mm (Turkiya MDF / AGT)',
  },
};

const KERF_MM = 4;      // Saw blade kerf between pieces
const EDGE_TRIM_MM = 10; // Outer trim margin on sheet

interface ExpandedPiece {
  partId: string;
  name: string;
  w: number;
  h: number;
  material: string;
  edgeBandingSides: string;
  role: CuttingPart['role'];
  canRotate: boolean;
}

interface ShelfRow {
  yMm: number;
  heightMm: number;
  cursorXMm: number;
}

interface WorkingSheet {
  sheetIndex: number;
  shelves: ShelfRow[];
  parts: PackedPartRect[];
}

function estimateEdgeBandingMeters(parts: CuttingPart[]): number {
  let totalMm = 0;
  for (const p of parts) {
    const sides = p.edgeBandingSides.toLowerCase();
    let perPieceMm = 0;
    if (sides.includes('4')) {
      perPieceMm = 2 * (p.lengthMm + p.widthMm);
    } else if (sides.includes('3')) {
      perPieceMm = 2 * p.lengthMm + p.widthMm;
    } else if (sides.includes('2')) {
      perPieceMm = 2 * p.lengthMm;
    } else if (sides.includes('1') || sides.includes('old')) {
      perPieceMm = p.lengthMm;
    } else {
      perPieceMm = p.lengthMm;
    }
    totalMm += perPieceMm * Math.max(1, p.qty);
  }
  return Math.round(totalMm / 1000);
}

/**
 * 2D Shelf Guillotine Bin-Packing for furniture cutting sheets.
 * Automatically places rectangular panels onto standard 2750x1830 or 2800x2070 mm sheets
 * with saw kerf and optional 90-degree rotation.
 */
export function computeSheetNesting(
  cuttingParts: CuttingPart[],
  sheetSize: SheetSizeKey = '2800x2070',
): NestingResult {
  const { widthMm: sheetW, heightMm: sheetH } = SHEET_DIMENSIONS[sheetSize];
  const usableW = sheetW - EDGE_TRIM_MM * 2;
  const usableH = sheetH - EDGE_TRIM_MM * 2;

  const pieces: ExpandedPiece[] = [];
  for (const part of cuttingParts) {
    const qty = Math.max(1, Math.min(40, Math.round(part.qty)));
    // Clamp oversize parts cleanly into usable sheet bounds so diagram always stays valid
    const rawL = Math.max(80, Math.min(usableW, Math.round(part.lengthMm)));
    const rawW = Math.max(80, Math.min(usableH, Math.round(part.widthMm)));
    for (let i = 0; i < qty; i++) {
      pieces.push({
        partId: `${part.id}-${i + 1}`,
        name: part.name,
        w: rawL,
        h: rawW,
        material: part.material,
        edgeBandingSides: part.edgeBandingSides,
        role: part.role,
        canRotate: part.canRotate !== false,
      });
    }
  }

  // Sort tallest/largest area first for tighter shelf packing
  pieces.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);

  const workingSheets: WorkingSheet[] = [];

  const createSheet = (index: number): WorkingSheet => ({
    sheetIndex: index,
    shelves: [],
    parts: [],
  });

  const tryPlaceOnSheet = (sheet: WorkingSheet, piece: ExpandedPiece): boolean => {
    // Try fitting into existing shelves first (normal and rotated)
    for (const shelf of sheet.shelves) {
      const orientations: { pw: number; ph: number; rotated: boolean }[] = [
        { pw: piece.w, ph: piece.h, rotated: false },
      ];
      if (piece.canRotate && piece.w !== piece.h) {
        orientations.push({ pw: piece.h, ph: piece.w, rotated: true });
      }

      for (const ori of orientations) {
        if (
          ori.ph <= shelf.heightMm &&
          shelf.cursorXMm + ori.pw <= EDGE_TRIM_MM + usableW
        ) {
          sheet.parts.push({
            partId: piece.partId,
            name: piece.name,
            xMm: shelf.cursorXMm,
            yMm: shelf.yMm,
            widthMm: ori.pw,
            heightMm: ori.ph,
            rotated: ori.rotated,
            material: piece.material,
            edgeBandingSides: piece.edgeBandingSides,
            role: piece.role,
          });
          shelf.cursorXMm += ori.pw + KERF_MM;
          return true;
        }
      }
    }

    // Open a new shelf on this sheet
    const nextShelfY =
      sheet.shelves.length === 0
        ? EDGE_TRIM_MM
        : sheet.shelves[sheet.shelves.length - 1].yMm +
          sheet.shelves[sheet.shelves.length - 1].heightMm +
          KERF_MM;

    // Choose orientation that minimizes shelf height while fitting width
    const candidates: { pw: number; ph: number; rotated: boolean }[] = [];
    if (piece.w <= usableW && nextShelfY + piece.h <= EDGE_TRIM_MM + usableH) {
      candidates.push({ pw: piece.w, ph: piece.h, rotated: false });
    }
    if (
      piece.canRotate &&
      piece.h <= usableW &&
      nextShelfY + piece.w <= EDGE_TRIM_MM + usableH
    ) {
      candidates.push({ pw: piece.h, ph: piece.w, rotated: true });
    }

    if (candidates.length === 0) return false;

    candidates.sort((a, b) => a.ph - b.ph);
    const chosen = candidates[0];

    const newShelf: ShelfRow = {
      yMm: nextShelfY,
      heightMm: chosen.ph,
      cursorXMm: EDGE_TRIM_MM + chosen.pw + KERF_MM,
    };
    sheet.shelves.push(newShelf);
    sheet.parts.push({
      partId: piece.partId,
      name: piece.name,
      xMm: EDGE_TRIM_MM,
      yMm: nextShelfY,
      widthMm: chosen.pw,
      heightMm: chosen.ph,
      rotated: chosen.rotated,
      material: piece.material,
      edgeBandingSides: piece.edgeBandingSides,
      role: piece.role,
    });
    return true;
  };

  for (const piece of pieces) {
    let placed = false;
    for (const ws of workingSheets) {
      if (tryPlaceOnSheet(ws, piece)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const fresh = createSheet(workingSheets.length + 1);
      tryPlaceOnSheet(fresh, piece);
      workingSheets.push(fresh);
    }
  }

  if (workingSheets.length === 0) {
    workingSheets.push(createSheet(1));
  }

  const sheetAreaMm2 = sheetW * sheetH;
  const packedSheets: PackedSheet[] = workingSheets.map((ws) => {
    const usedAreaMm2 = ws.parts.reduce((acc, p) => acc + p.widthMm * p.heightMm, 0);
    const wastePercent = Math.max(
      0,
      Number((((sheetAreaMm2 - usedAreaMm2) / sheetAreaMm2) * 100).toFixed(1)),
    );
    return {
      sheetIndex: ws.sheetIndex,
      sheetWidthMm: sheetW,
      sheetHeightMm: sheetH,
      parts: ws.parts,
      usedAreaMm2,
      wastePercent,
    };
  });

  const totalUsedAreaMm2 = packedSheets.reduce((acc, s) => acc + s.usedAreaMm2, 0);
  const fullSheetsAreaMm2 = packedSheets.length * sheetAreaMm2;
  const totalSheetsFloat = Number((totalUsedAreaMm2 / (sheetAreaMm2 * 0.88)).toFixed(1));
  const overallWaste =
    fullSheetsAreaMm2 > 0
      ? Number((((fullSheetsAreaMm2 - totalUsedAreaMm2) / fullSheetsAreaMm2) * 100).toFixed(1))
      : 0;

  return {
    sheetSize,
    sheetWidthMm: sheetW,
    sheetHeightMm: sheetH,
    sheets: packedSheets,
    totalSheetsFloat: Math.max(0.5, totalSheetsFloat),
    totalSheetsCount: packedSheets.length,
    wastePercent: Math.max(0, overallWaste),
    totalEdgeBandingM: estimateEdgeBandingMeters(cuttingParts),
    totalPartsCount: pieces.length,
  };
}
