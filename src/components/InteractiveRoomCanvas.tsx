import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  FlipHorizontal2,
  Layers,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CanvasViewMode,
  CatalogItem,
  DimensionsCm,
  ExtraDetails,
  FurnitureSubPart,
  MaterialPricing,
  SubPartKind,
} from '../types.ts';
import {
  transformSubPartsToTargetBounds,
  WALL_HEIGHT_MM,
  WALL_WIDTH_MM,
} from '../utils/collisionAndParts.ts';
import { formatSom } from '../utils/furnitureCalculator.ts';
import { searchCatalogItems } from '../utils/furnitureCatalogFactory.ts';
import { tgHapticImpact, tgHapticSelection } from '../utils/telegram.ts';
import { Cabinet3DConstructor } from './Cabinet3DConstructor.tsx';
import { TransparentFurnitureImg } from './TransparentFurnitureImg.tsx';

interface InteractiveRoomCanvasProps {
  roomImage: string;
  selectedItem: CatalogItem | null;
  catalog: CatalogItem[];
  onQuickSelectCatalogItem: (item: CatalogItem) => void;
  subParts: FurnitureSubPart[];
  onSubPartsChange: (parts: FurnitureSubPart[], recordHistory?: boolean) => void;
  onCommitHistorySnapshot?: (prevParts: FurnitureSubPart[]) => void;
  canUndo?: boolean;
  onUndo?: () => void;
  isDockedMenuOpen?: boolean;
  selectedPartId: string | null;
  onSelectPartId: (id: string | null) => void;
  pricing: MaterialPricing;
  totalPrice: number;
  overallDimensions: DimensionsCm;
  extras: ExtraDetails;
  aiRenderImage: string | null;
  canvasViewMode: CanvasViewMode;
  onCanvasViewModeChange: (mode: CanvasViewMode) => void;
  onGenerateAIRender: () => void;
  isGeneratingAI: boolean;
  aiError: string | null;
  onDismissAiError: () => void;
  onAddFreeDetail: (kind: SubPartKind) => void;
  onDuplicatePart: (part: FurnitureSubPart) => void;
  onDeletePart: (partId: string) => void;
  onOpenEditDrawer: () => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

type DragAction =
  | {
      type: 'photo-move';
      startX: number;
      startY: number;
      hasMoved: boolean;
      initialBounds: { xMm: number; yMm: number; widthMm: number; heightMm: number };
      initialParts: FurnitureSubPart[];
    }
  | {
      type: 'photo-resize';
      handle: ResizeHandle;
      startX: number;
      startY: number;
      hasMoved: boolean;
      initialBounds: { xMm: number; yMm: number; widthMm: number; heightMm: number };
      initialParts: FurnitureSubPart[];
    };

interface PinchBaseline {
  initialDist: number;
  hasMoved: boolean;
  initialBounds: { xMm: number; yMm: number; widthMm: number; heightMm: number };
  initialParts: FurnitureSubPart[];
}

const DRAG_THRESHOLD_PX = 5;

const PHOTO_HANDLES: Array<{ key: ResizeHandle; cls: string }> = [
  { key: 'nw', cls: '-top-4 -left-4 cursor-nwse-resize' },
  { key: 'ne', cls: '-top-4 -right-4 cursor-nesw-resize' },
  { key: 'sw', cls: '-bottom-4 -left-4 cursor-nesw-resize' },
  { key: 'se', cls: '-bottom-4 -right-4 cursor-nwse-resize' },
  { key: 'n', cls: '-top-4 left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { key: 's', cls: '-bottom-4 left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { key: 'w', cls: 'top-1/2 -left-4 -translate-y-1/2 cursor-ew-resize' },
  { key: 'e', cls: 'top-1/2 -right-4 -translate-y-1/2 cursor-ew-resize' },
];

export const InteractiveRoomCanvas: React.FC<InteractiveRoomCanvasProps> = ({
  roomImage,
  selectedItem,
  catalog,
  onQuickSelectCatalogItem,
  subParts,
  onSubPartsChange,
  onCommitHistorySnapshot,
  canUndo = false,
  onUndo,
  selectedPartId,
  onSelectPartId,
  pricing,
  totalPrice,
  overallDimensions,
  extras,
  aiRenderImage,
  canvasViewMode,
  onCanvasViewModeChange,
  onGenerateAIRender,
  isGeneratingAI,
  aiError,
  onDismissAiError,
  onAddFreeDetail,
  onDuplicatePart,
  onDeletePart,
  onOpenEditDrawer,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const quickSearchInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragAction | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<PinchBaseline | null>(null);

  const [isPhotoSelected, setIsPhotoSelected] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  // Expanded "Haqiqiy ko'rinish" spatial alignment controls
  const [rotateDeg, setRotateDeg] = useState(0);
  const [perspYDeg, setPerspYDeg] = useState(0);
  const [perspXDeg, setPerspXDeg] = useState(0);
  const [flippedX, setFlippedX] = useState(false);
  const [shadowOpacity, setShadowOpacity] = useState(55);

  const quickSearchResults = useMemo(() => {
    const matches = quickSearchQuery.trim()
      ? searchCatalogItems(catalog, quickSearchQuery)
      : catalog;
    return matches.slice(0, 14);
  }, [catalog, quickSearchQuery]);

  useEffect(() => {
    if (isQuickSearchOpen) {
      const id = window.setTimeout(() => {
        quickSearchInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(id);
    }
  }, [isQuickSearchOpen]);

  const activeImage =
    canvasViewMode === 'ai-render' && aiRenderImage ? aiRenderImage : roomImage;

  useEffect(() => {
    setImgError(false);
  }, [activeImage]);

  useEffect(() => {
    setIsPhotoSelected(false);
  }, [selectedItem?.id, canvasViewMode]);

  useEffect(() => {
    setRotateDeg(0);
    setPerspYDeg(0);
    setPerspXDeg(0);
    setFlippedX(false);
    setShadowOpacity(55);
  }, [selectedItem?.id]);

  const coreBounds = useMemo(() => {
    const core = subParts.filter((p) => !p.isFreePlaced);
    const list = core.length > 0 ? core : subParts;
    if (list.length === 0) return null;
    const minX = Math.min(...list.map((p) => p.xMm));
    const minY = Math.min(...list.map((p) => p.yMm));
    const maxX = Math.max(...list.map((p) => p.xMm + p.widthMm));
    const maxY = Math.max(...list.map((p) => p.yMm + p.heightMm));
    return {
      xMm: minX,
      yMm: minY,
      widthMm: maxX - minX,
      heightMm: maxY - minY,
    };
  }, [subParts]);

  const clientDeltaToMm = (dxPx: number, dyPx: number): { dxMm: number; dyMm: number } => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return { dxMm: 0, dyMm: 0 };
    }
    return {
      dxMm: Math.round((dxPx / rect.width) * WALL_WIDTH_MM),
      dyMm: Math.round((dyPx / rect.height) * WALL_HEIGHT_MM),
    };
  };

  const handleStagePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && canvasViewMode === 'interactive' && coreBounds) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.max(24, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));

      pinchRef.current = {
        initialDist: dist,
        hasMoved: false,
        initialBounds: { ...coreBounds },
        initialParts: subParts.map((p) => ({ ...p })),
      };
      dragRef.current = null;
    }
  };

  const handleStagePointerDown = () => {
    if (pointersRef.current.size <= 1) {
      setIsPhotoSelected(false);
      onSelectPartId(null);
    }
  };

  const startPhotoDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (canvasViewMode !== 'interactive' || !coreBounds) return;
    e.stopPropagation();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    dragRef.current = {
      type: 'photo-move',
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      initialBounds: { ...coreBounds },
      initialParts: subParts.map((p) => ({ ...p })),
    };
  };

  const startPhotoResize = (
    handle: ResizeHandle,
    e: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (canvasViewMode !== 'interactive' || !coreBounds) return;
    e.stopPropagation();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsPhotoSelected(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = {
      type: 'photo-resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      initialBounds: { ...coreBounds },
      initialParts: subParts.map((p) => ({ ...p })),
    };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // 2-Finger Pinch-to-Scale in "Haqiqiy ko'rinish"
    if (pinchRef.current && pointersRef.current.size === 2) {
      const pinch = pinchRef.current;
      pinch.hasMoved = true;
      const pts = Array.from(pointersRef.current.values());
      const curDist = Math.max(24, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const scale = Math.max(0.45, Math.min(1.85, curDist / pinch.initialDist));
      const newW = Math.round(pinch.initialBounds.widthMm * scale);
      const newH = Math.round(pinch.initialBounds.heightMm * scale);
      const cx = pinch.initialBounds.xMm + pinch.initialBounds.widthMm / 2;
      const cy = pinch.initialBounds.yMm + pinch.initialBounds.heightMm / 2;

      onSubPartsChange(
        transformSubPartsToTargetBounds(pinch.initialParts, {
          xMm: cx - newW / 2,
          yMm: cy - newH / 2,
          widthMm: newW,
          heightMm: newH,
        }),
        false,
      );
      return;
    }

    const action = dragRef.current;
    if (!action) return;

    const dxPx = e.clientX - action.startX;
    const dyPx = e.clientY - action.startY;
    const { dxMm, dyMm } = clientDeltaToMm(dxPx, dyPx);

    if (action.type === 'photo-move') {
      if (!action.hasMoved && Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
      action.hasMoved = true;

      const b = action.initialBounds;
      const nextX = Math.max(0, Math.min(WALL_WIDTH_MM - b.widthMm, b.xMm + dxMm));
      const nextY = Math.max(0, Math.min(WALL_HEIGHT_MM - b.heightMm, b.yMm + dyMm));
      const shiftX = nextX - b.xMm;
      const shiftY = nextY - b.yMm;

      onSubPartsChange(
        action.initialParts.map((p) => ({
          ...p,
          xMm: p.xMm + shiftX,
          yMm: p.yMm + shiftY,
        })),
        false,
      );
      return;
    }

    if (action.type === 'photo-resize') {
      action.hasMoved = true;
      const b = action.initialBounds;
      let nextX = b.xMm;
      let nextY = b.yMm;
      let nextW = b.widthMm;
      let nextH = b.heightMm;

      if (action.handle.includes('e')) {
        nextW = Math.max(600, b.widthMm + dxMm);
      }
      if (action.handle.includes('w')) {
        const cDx = Math.min(dxMm, b.widthMm - 600);
        nextX = b.xMm + cDx;
        nextW = b.widthMm - cDx;
      }
      if (action.handle.includes('s')) {
        nextH = Math.max(600, b.heightMm + dyMm);
      }
      if (action.handle.includes('n')) {
        const cDy = Math.min(dyMm, b.heightMm - 600);
        nextY = b.yMm + cDy;
        nextH = b.heightMm - cDy;
      }

      onSubPartsChange(
        transformSubPartsToTargetBounds(action.initialParts, {
          xMm: nextX,
          yMm: nextY,
          widthMm: nextW,
          heightMm: nextH,
        }),
        false,
      );
    }
  };

  const handleStagePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const action = dragRef.current;
    if (action && e.type === 'pointerup' && pointersRef.current.size <= 1) {
      if (action.type === 'photo-move' && !action.hasMoved) {
        tgHapticSelection();
        setIsPhotoSelected((v) => !v);
      } else if (action.hasMoved) {
        onCommitHistorySnapshot?.(action.initialParts);
      }
    }
    if (pinchRef.current && pinchRef.current.hasMoved && pointersRef.current.size === 2) {
      onCommitHistorySnapshot?.(pinchRef.current.initialParts);
    }

    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
    }
  };

  const resetPlacementTransforms = () => {
    tgHapticImpact('light');
    setRotateDeg(0);
    setPerspYDeg(0);
    setPerspXDeg(0);
    setFlippedX(false);
    setShadowOpacity(55);
  };

  const hasCustomTransform =
    rotateDeg !== 0 ||
    perspYDeg !== 0 ||
    perspXDeg !== 0 ||
    flippedX ||
    shadowOpacity !== 55;

  return (
    <div className="bg-white rounded-3xl border border-[#C5A059]/60 shadow-sm overflow-hidden relative">
      {/* Compact Mode Switcher Bar + Circular Quick Search (🔍) */}
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 border-b border-[#C5A059]/25 bg-[#FAF8F5]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
          <div className="flex items-center bg-white border border-[#C5A059]/40 p-0.5 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => {
                tgHapticSelection();
                onCanvasViewModeChange('3d-cad');
              }}
              className={`min-h-[30px] px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap ${
                canvasViewMode === '3d-cad'
                  ? 'bg-[#0E3A2F] text-white border border-[#C5A059]/75 shadow-xs'
                  : 'text-[#0E3A2F] hover:bg-[#FAF8F5]'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>360° (7D)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                tgHapticSelection();
                onCanvasViewModeChange('interactive');
              }}
              className={`min-h-[30px] px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                canvasViewMode === 'interactive'
                  ? 'bg-[#0E3A2F] text-white border border-[#C5A059]/75 shadow-xs'
                  : 'text-[#1A2421]/75 hover:text-[#0E3A2F]'
              }`}
            >
              Haqiqiy
            </button>
            <button
              type="button"
              onClick={() => {
                tgHapticSelection();
                onCanvasViewModeChange('before');
              }}
              className={`min-h-[30px] px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                canvasViewMode === 'before'
                  ? 'bg-[#0E3A2F] text-white border border-[#C5A059]/75 shadow-xs'
                  : 'text-[#1A2421]/75 hover:text-[#0E3A2F]'
              }`}
            >
              Oldin
            </button>
            {aiRenderImage && (
              <button
                type="button"
                onClick={() => {
                  tgHapticSelection();
                  onCanvasViewModeChange('ai-render');
                }}
                className={`min-h-[30px] px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                  canvasViewMode === 'ai-render'
                    ? 'bg-[#0E3A2F] text-white border border-[#C5A059]/75 shadow-xs'
                    : 'text-[#1A2421]/75 hover:text-[#0E3A2F]'
                }`}
              >
                AI
              </button>
            )}
          </div>

          {selectedItem && (
            <button
              type="button"
              onClick={() => {
                tgHapticImpact('light');
                onGenerateAIRender();
              }}
              disabled={isGeneratingAI}
              className="min-h-[32px] px-2.5 py-1 rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] disabled:opacity-60 text-white border border-[#C5A059] text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              {isGeneratingAI ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C5A059]" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              )}
              <span>AI Real</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            tgHapticSelection();
            setIsQuickSearchOpen((v) => !v);
          }}
          title="Mebel raqami bo'yicha tezkor qidirish (masalan: 104)"
          aria-label="Mebel raqami bo'yicha qidirish"
          aria-expanded={isQuickSearchOpen}
          className={`w-9 h-9 rounded-full border flex items-center justify-center shadow-sm transition-transform active:scale-95 shrink-0 ${
            isQuickSearchOpen
              ? 'bg-[#C5A059] text-[#0E3A2F] border-[#0E3A2F]'
              : 'bg-[#0E3A2F] hover:bg-[#144D3E] text-[#C5A059] border-[#C5A059]'
          }`}
        >
          {isQuickSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating Quick Number Search Popover */}
      {isQuickSearchOpen && (
        <div
          onPointerDownCapture={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-[52px] left-2.5 right-2.5 z-40 bg-[#FAF8F5]/98 backdrop-blur-md rounded-2xl border border-[#C5A059] shadow-2xl p-3 space-y-2.5"
        >
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#C5A059] absolute left-3 pointer-events-none" />
            <input
              ref={quickSearchInputRef}
              type="search"
              inputMode="search"
              value={quickSearchQuery}
              onChange={(e) => setQuickSearchQuery(e.target.value)}
              placeholder="Mebel raqamini yozing (masalan: 104)..."
              className="w-full min-h-[42px] pl-9 pr-9 rounded-xl bg-white border border-[#C5A059]/60 text-xs font-semibold text-[#1A2421] placeholder:text-[#6B7A74] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50"
            />
            {quickSearchQuery && (
              <button
                type="button"
                onClick={() => setQuickSearchQuery('')}
                aria-label="Tozalash"
                className="w-7 h-7 rounded-full hover:bg-[#FAF8F5] text-[#6B7A74] flex items-center justify-center absolute right-1.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
            {quickSearchResults.length === 0 ? (
              <p className="text-center text-xs text-[#6B7A74] py-4">
                Raqam yoki nom bo&apos;yicha mebel topilmadi.
              </p>
            ) : (
              quickSearchResults.map((item) => {
                const isActive = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      tgHapticImpact('medium');
                      onQuickSelectCatalogItem(item);
                      setIsQuickSearchOpen(false);
                      setQuickSearchQuery('');
                    }}
                    className={`w-full p-2 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                      isActive
                        ? 'bg-white border-[#C5A059] ring-1 ring-[#C5A059]'
                        : 'bg-white hover:bg-[#F4EFE6] border-[#C5A059]/35'
                    }`}
                  >
                    <div className="w-12 h-10 rounded-lg bg-[#FAF8F5] border border-[#C5A059]/30 shrink-0 p-0.5 flex items-center justify-center">
                      <TransparentFurnitureImg
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.catalogNumber && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] font-mono-num text-[10px] font-bold leading-none shrink-0">
                            №{item.catalogNumber}
                          </span>
                        )}
                        <p className="text-xs font-bold text-[#1A2421] truncate">
                          {item.title}
                        </p>
                      </div>
                      <p className="text-[10px] font-mono-num text-[#6B7A74] mt-0.5">
                        {item.defaultDimensions.widthCm * 10}×{item.defaultDimensions.heightCm * 10}×
                        {item.defaultDimensions.depthCm * 10} mm ·{' '}
                        <span className="font-bold text-[#0E3A2F]">{formatSom(item.basePrice)}</span>
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Stage Area: Either 360° 3D WebGL CAD Constructor OR Room Photo Stage */}
      {canvasViewMode === '3d-cad' ? (
        <div className="relative w-full h-[calc(100dvh-14.5rem)] min-h-[410px]">
          <Cabinet3DConstructor
            roomImage={roomImage}
            subParts={subParts}
            onSubPartsChange={onSubPartsChange}
            onCommitHistorySnapshot={onCommitHistorySnapshot}
            canUndo={canUndo}
            onUndo={onUndo}
            selectedPartId={selectedPartId}
            onSelectPartId={onSelectPartId}
            pricing={pricing}
            totalPrice={totalPrice}
            overallDimensions={overallDimensions}
            catalogNumber={selectedItem?.catalogNumber}
            extras={extras}
            onAddFreeDetail={onAddFreeDetail}
            onDuplicatePart={onDuplicatePart}
            onDeletePart={onDeletePart}
            onOpenEditDrawer={onOpenEditDrawer}
          />
        </div>
      ) : (
        <div
          ref={stageRef}
          style={{ touchAction: 'none' }}
          onPointerDownCapture={handleStagePointerDownCapture}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerEnd}
          onPointerCancel={handleStagePointerEnd}
          className="relative w-full h-[calc(100dvh-14.5rem)] min-h-[410px] bg-[#FAF8F5] select-none overflow-hidden"
        >
          {selectedItem && (
            <div className="absolute top-2.5 left-2.5 right-2.5 z-20 pointer-events-none flex justify-start">
              <div className="px-2 py-1 rounded-full bg-white/95 border border-[#C5A059]/60 shadow-sm text-[11px] font-mono-num font-bold text-[#1A2421] flex items-center gap-1.5 max-w-full">
                {selectedItem.catalogNumber && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold leading-none shrink-0">
                    №{selectedItem.catalogNumber}
                  </span>
                )}
                <span className="truncate">
                  {overallDimensions.widthCm * 10} × {overallDimensions.heightCm * 10} ×{' '}
                  {overallDimensions.depthCm * 10} mm ·{' '}
                  <span className="text-[#0E3A2F]">{formatSom(totalPrice)}</span>
                </span>
              </div>
            </div>
          )}
          {!imgError ? (
            <img
              src={activeImage}
              alt="Xona maydoni"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#F8FAFC] text-slate-500">
              <Layers className="w-10 h-10 mb-2 text-[#0E3A2F]" />
              <p className="text-xs font-medium">Xona rasmi</p>
            </div>
          )}

          {/* "Haqiqiy ko'rinish": Clean Transparent Photorealistic Placement + 8 Handles & Perspective Controls on Tap */}
          {selectedItem && canvasViewMode === 'interactive' && coreBounds && (
            <div
              style={{
                touchAction: 'none',
                left: `${(coreBounds.xMm / WALL_WIDTH_MM) * 100}%`,
                top: `${(coreBounds.yMm / WALL_HEIGHT_MM) * 100}%`,
                width: `${(coreBounds.widthMm / WALL_WIDTH_MM) * 100}%`,
                height: `${(coreBounds.heightMm / WALL_HEIGHT_MM) * 100}%`,
              }}
              onPointerDown={startPhotoDrag}
              className={`absolute z-20 cursor-grab active:cursor-grabbing ${
                isPhotoSelected ? 'ring-2 ring-[#C5A059]' : ''
              }`}
            >
              {/* Adjustable Realistic Floor Contact Shadow */}
              {shadowOpacity > 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-[7%] left-[6%] right-[6%] h-[16%]"
                  style={{
                    transform: `rotate(${rotateDeg * 0.5}deg) skewX(${perspYDeg * 0.6}deg)`,
                    background: `radial-gradient(ellipse at center, rgba(15, 23, 42, ${(
                      (shadowOpacity / 100) *
                      0.72
                    ).toFixed(3)}) 0%, rgba(15, 23, 42, ${((shadowOpacity / 100) * 0.28).toFixed(
                      3,
                    )}) 52%, rgba(15, 23, 42, 0) 76%)`,
                    filter: 'blur(4px)',
                  }}
                />
              )}

              {/* 3D Perspective / Rotation / Flip Layer */}
              <div
                className="w-full h-full pointer-events-none"
                style={{
                  transform: `perspective(900px) rotateX(${perspXDeg}deg) rotateY(${perspYDeg}deg) rotateZ(${rotateDeg}deg) scaleX(${
                    flippedX ? -1 : 1
                  })`,
                  transformStyle: 'preserve-3d',
                  filter: extras.ledLighting
                    ? 'drop-shadow(0 0 18px rgba(197,160,89,0.68))'
                    : shadowOpacity > 0
                      ? `drop-shadow(0 12px 18px rgba(15,23,42,${((shadowOpacity / 100) * 0.42).toFixed(2)}))`
                      : 'none',
                }}
              >
                <TransparentFurnitureImg
                  src={selectedItem.image}
                  alt={selectedItem.title}
                  draggable={false}
                  className="w-full h-full object-fill pointer-events-none"
                />
              </div>

              {/* 8 Resize Handles + Live Dimension Pill ONLY when tapped */}
              {isPhotoSelected && (
                <>
                  <div
                    className={`absolute ${
                      coreBounds.yMm < 360 ? '-bottom-10' : '-top-10'
                    } left-1/2 -translate-x-1/2 z-40 pointer-events-none`}
                  >
                    <div className="px-2.5 py-1 rounded-full backdrop-blur-md bg-white/95 text-[#0F172A] shadow-lg border border-[#E2E8F0] flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
                      <span className="font-mono-num text-[#0E3A2F] font-bold">
                        {overallDimensions.widthCm} × {overallDimensions.heightCm} sm
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="font-mono-num">{formatSom(totalPrice)}</span>
                    </div>
                  </div>

                  {PHOTO_HANDLES.map(({ key, cls }) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={`${key} o'lcham`}
                      style={{ touchAction: 'none' }}
                      onPointerDown={(e) => startPhotoResize(key, e)}
                      className={`absolute w-9 h-9 flex items-center justify-center z-40 ${cls}`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 shadow-md ${
                          key === 'se'
                            ? 'bg-[#0E3A2F] border-[#C5A059]'
                            : 'bg-[#C5A059] border-white'
                        }`}
                      />
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Compact Floating Spatial Placement Toolbar (ONLY when furniture is tapped in Haqiqiy ko'rinish) */}
          {selectedItem && canvasViewMode === 'interactive' && isPhotoSelected && (
            <div
              onPointerDownCapture={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-2.5 right-2.5 bottom-2.5 z-40 backdrop-blur-md bg-white/90 text-[#0F172A] rounded-2xl border border-[#E2E8F0] shadow-xl px-3 py-2.5"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 items-center">
                {/* 1. Aylantirish (Rotate -45..+45) */}
                <label className="flex flex-col gap-0.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Aylantirish</span>
                    <span className="font-mono-num text-[#0E3A2F] font-semibold">
                      {rotateDeg > 0 ? `+${rotateDeg}` : rotateDeg}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={rotateDeg}
                    onChange={(e) => setRotateDeg(Number(e.target.value))}
                    className="w-full accent-[#0E3A2F] h-1.5 cursor-pointer"
                  />
                </label>

                {/* 2. Perspektiva Gorizontal (Wall Angle Y-Tilt) */}
                <label className="flex flex-col gap-0.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Perspektiva (yon)</span>
                    <span className="font-mono-num text-[#0E3A2F] font-semibold">
                      {perspYDeg > 0 ? `+${perspYDeg}` : perspYDeg}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={perspYDeg}
                    onChange={(e) => setPerspYDeg(Number(e.target.value))}
                    className="w-full accent-[#0E3A2F] h-1.5 cursor-pointer"
                  />
                </label>

                {/* 3. Perspektiva Vertikal (Floor Tilt X) */}
                <label className="flex flex-col gap-0.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Perspektiva (pol)</span>
                    <span className="font-mono-num text-[#0E3A2F] font-semibold">
                      {perspXDeg > 0 ? `+${perspXDeg}` : perspXDeg}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-25}
                    max={25}
                    step={1}
                    value={perspXDeg}
                    onChange={(e) => setPerspXDeg(Number(e.target.value))}
                    className="w-full accent-[#0E3A2F] h-1.5 cursor-pointer"
                  />
                </label>

                {/* 4. Soya (Floor Shadow 0..100%) + Ko'zgu (Flip H) + Reset */}
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex flex-col gap-0.5 text-[10px] min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Soya</span>
                      <span className="font-mono-num text-[#0E3A2F] font-semibold">
                        {shadowOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={shadowOpacity}
                      onChange={(e) => setShadowOpacity(Number(e.target.value))}
                      className="w-full accent-[#0E3A2F] h-1.5 cursor-pointer"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      tgHapticImpact('light');
                      setFlippedX((v) => !v);
                    }}
                    title="Ko'zgu (Gorizontal burish)"
                    className={`min-h-[32px] px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                      flippedX
                        ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                        : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border-[#E2E8F0]'
                    }`}
                  >
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                    <span>Ko&apos;zgu</span>
                  </button>

                  {hasCustomTransform && (
                    <button
                      type="button"
                      onClick={resetPlacementTransforms}
                      title="Tiklash"
                      className="w-8 h-8 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#0E3A2F] shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isGeneratingAI && (
            <div className="absolute inset-0 z-40 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-[#0F172A]">
              <Sparkles className="w-8 h-8 text-[#C5A059] animate-pulse mb-2.5" />
              <p className="text-sm font-semibold">
                RSM CUT AI mebelni xonaga real joylashtirmoqda...
              </p>
              <p className="text-xs text-slate-600 mt-1 max-w-xs">
                Devor yoritilishi, soya va {overallDimensions.widthCm}×{overallDimensions.heightCm}{' '}
                sm nisbatlar saqlanmoqda.
              </p>
            </div>
          )}
        </div>
      )}

      {aiError && (
        <div className="px-4 py-3 bg-rose-50 border-t border-rose-200 flex items-start justify-between gap-3">
          <p className="text-xs text-rose-800">{aiError}</p>
          <button
            type="button"
            onClick={onDismissAiError}
            className="text-xs font-semibold text-rose-700 hover:underline shrink-0"
          >
            Yopish
          </button>
        </div>
      )}
    </div>
  );
};
