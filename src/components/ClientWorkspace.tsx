import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  Camera,
  Check,
  Home,
  Layers,
  Loader2,
  PackageCheck,
  PencilRuler,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { ROOM_PRESETS } from '../data/presets.ts';
import type {
  AIRoomAnalysisResponse,
  CanvasViewMode,
  CarcassMaterial,
  CatalogItem,
  DimensionsCm,
  ExtraDetails,
  FacadeMaterial,
  FurnitureOrder,
  FurnitureSubPart,
  HardwareBrand,
  MaterialPricing,
  PartMaterial,
  PlacedFurnitureBox,
  RoomCategory,
  SheetSizeKey,
  SubPartKind,
} from '../types.ts';
import {
  BOARD_THICK_MM,
  calculateSingleSubPartPrice,
  clampResizeWithStrictCollision,
  decomposeFurnitureToSubParts,
  findFreeSpawnPosition,
  getCabinetEnclosureBounds,
  getMinDimsForPart,
  SUBPART_TEMPLATES,
  subPartsToCuttingParts,
  WALL_HEIGHT_MM,
  WALL_WIDTH_MM,
} from '../utils/collisionAndParts.ts';
import {
  calculateFurnitureQuote,
  DEFAULT_EXTRAS,
  formatSom,
} from '../utils/furnitureCalculator.ts';
import {
  formatCatalogCode,
  searchCatalogItems,
} from '../utils/furnitureCatalogFactory.ts';
import { computeSheetNesting, SHEET_DIMENSIONS } from '../utils/sheetNesting.ts';
import {
  tgHapticImpact,
  tgHapticSelection,
  shareViaTelegramLink,
  type TelegramUserInfo,
} from '../utils/telegram.ts';
import { EditDetailsDrawer } from './EditDetailsDrawer.tsx';
import { InteractiveRoomCanvas } from './InteractiveRoomCanvas.tsx';
import { OrderSubmissionModal } from './OrderSubmissionModal.tsx';
import { SheetNestingVisualizer } from './SheetNestingVisualizer.tsx';
import { TransparentFurnitureImg } from './TransparentFurnitureImg.tsx';

interface ClientWorkspaceProps {
  pricing: MaterialPricing;
  catalog: CatalogItem[];
  categories: string[];
  telegramUser?: TelegramUserInfo;
  onOrderCreated: (order: FurnitureOrder) => void;
  onSwitchToWorkshop: () => void;
}

type ClientTab = 'asosiy' | 'konstruktor' | 'mebel' | 'buyurtmalar';

const MAX_HISTORY_STEPS = 50;

const SAMPLE_ROOMS_ORDERED: Array<{ presetId: string; shortLabel: string }> = [
  { presetId: 'room-tvzone', shortLabel: 'Mehmonxona' },
  { presetId: 'room-kitchen', shortLabel: 'Oshxona' },
  { presetId: 'room-wardrobe', shortLabel: 'Yotoqxona' },
];

function mapMaterialToPartMat(mat: CarcassMaterial | FacadeMaterial): PartMaterial {
  if (mat === 'AGT Akril') return 'Akril';
  if (mat === 'Turkiya MDF' || mat === 'Shpon') return 'MDF';
  return 'LDSP';
}

export const ClientWorkspace: React.FC<ClientWorkspaceProps> = ({
  pricing,
  catalog,
  categories,
  telegramUser,
  onOrderCreated,
  onSwitchToWorkshop,
}) => {
  const initialRoom = ROOM_PRESETS[0];
  const initialItem = catalog[0] ?? null;

  const initialBox: PlacedFurnitureBox = {
    xPercent: 50,
    yPercent: 52,
    widthPercent: 58,
    heightPercent: 54,
  };
  const initialDims: DimensionsCm =
    initialItem?.defaultDimensions ?? { widthCm: 280, heightCm: 240, depthCm: 60 };

  const [activeTab, setActiveTab] = useState<ClientTab>('asosiy');
  const [roomImage, setRoomImage] = useState<string>(initialRoom.image);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoom.id);

  const [catalogSource, setCatalogSource] = useState<'catalog' | 'ai'>('catalog');
  const [categoryFilter, setCategoryFilter] = useState<'Hammasi' | RoomCategory>('Hammasi');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(initialItem);
  const [carcassMaterial, setCarcassMaterial] = useState<CarcassMaterial>(
    initialItem?.carcassMaterial ?? 'Rossiya LDSP',
  );
  const [facadeMaterial, setFacadeMaterial] = useState<FacadeMaterial>(
    initialItem?.facadeMaterial ?? 'Turkiya MDF',
  );
  const [hardwareBrand, setHardwareBrand] = useState<HardwareBrand>(
    initialItem?.hardwareBrand ?? 'Boyard',
  );
  const [extras, setExtras] = useState<ExtraDetails>({ ...DEFAULT_EXTRAS });

  const [subParts, setSubParts] = useState<FurnitureSubPart[]>(() =>
    initialItem
      ? decomposeFurnitureToSubParts({
          category: initialItem.category,
          dimensions: initialDims,
          placedBox: initialBox,
          carcassMat: mapMaterialToPartMat(initialItem.carcassMaterial),
          facadeMat: mapMaterialToPartMat(initialItem.facadeMaterial),
          palette: initialItem.palette,
          layoutVariant: initialItem.layoutVariant,
        })
      : [],
  );
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [historyStack, setHistoryStack] = useState<FurnitureSubPart[][]>([]);

  const [aiRenderImage, setAiRenderImage] = useState<string | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>('3d-cad');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiRenderError, setAiRenderError] = useState<string | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<AIRoomAnalysisResponse | null>(null);
  const [isAnalyzingRoom, setIsAnalyzingRoom] = useState(false);
  const [aiRecommendError, setAiRecommendError] = useState<string | null>(null);

  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const subPartsRef = useRef<FurnitureSubPart[]>(subParts);
  subPartsRef.current = subParts;
  const historyStackRef = useRef<FurnitureSubPart[][]>(historyStack);
  historyStackRef.current = historyStack;

  const activeCategory: RoomCategory = selectedItem?.category ?? 'Oshxona';

  const pushHistorySnapshot = useCallback((snapshot: FurnitureSubPart[]) => {
    setHistoryStack((prev) => [...prev.slice(-(MAX_HISTORY_STEPS - 1)), snapshot]);
  }, []);

  const handleSubPartsChangeWithHistory = useCallback(
    (nextParts: FurnitureSubPart[], recordHistory = true) => {
      if (recordHistory) {
        setHistoryStack((prev) => [
          ...prev.slice(-(MAX_HISTORY_STEPS - 1)),
          subPartsRef.current,
        ]);
      }
      setSubParts(nextParts);
    },
    [],
  );

  const handleUndo = useCallback(() => {
    const stack = historyStackRef.current;
    if (stack.length === 0) return;
    const previousSnapshot = stack[stack.length - 1];
    const nextStack = stack.slice(0, -1);
    historyStackRef.current = nextStack;
    setHistoryStack(nextStack);
    setSubParts(previousSnapshot);
    setSelectedPartId((curId) =>
      curId && previousSnapshot.some((p) => p.id === curId) ? curId : null,
    );
    tgHapticImpact('light');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo]);

  const { overallDimensions, derivedBox } = useMemo(() => {
    if (subParts.length === 0) {
      return {
        overallDimensions: initialDims,
        derivedBox: initialBox,
      };
    }
    const minX = Math.min(...subParts.map((p) => p.xMm));
    const minY = Math.min(...subParts.map((p) => p.yMm));
    const maxX = Math.max(...subParts.map((p) => p.xMm + p.widthMm));
    const maxY = Math.max(...subParts.map((p) => p.yMm + p.heightMm));
    const maxD = Math.max(...subParts.map((p) => p.depthMm));

    return {
      overallDimensions: {
        widthCm: Math.max(60, Math.round((maxX - minX) / 10)),
        heightCm: Math.max(80, Math.round((maxY - minY) / 10)),
        depthCm: Math.max(30, Math.round(maxD / 10)),
      },
      derivedBox: {
        xPercent: Number((((minX + maxX) / 2 / WALL_WIDTH_MM) * 100).toFixed(1)),
        yPercent: Number((((minY + maxY) / 2 / WALL_HEIGHT_MM) * 100).toFixed(1)),
        widthPercent: Number((((maxX - minX) / WALL_WIDTH_MM) * 100).toFixed(1)),
        heightPercent: Number((((maxY - minY) / WALL_HEIGHT_MM) * 100).toFixed(1)),
      },
    };
  }, [subParts]);

  const quote = useMemo(
    () =>
      calculateFurnitureQuote({
        category: activeCategory,
        dimensions: overallDimensions,
        carcassMaterial,
        facadeMaterial,
        hardwareBrand,
        extras,
        pricing,
      }),
    [activeCategory, overallDimensions, carcassMaterial, facadeMaterial, hardwareBrand, extras, pricing],
  );

  const livePartsTotalPrice = useMemo(() => {
    if (subParts.length === 0) return quote.totalPrice;
    const partsSum = subParts.reduce(
      (acc, sp) => acc + calculateSingleSubPartPrice(sp, pricing),
      0,
    );
    const hardwareAdd =
      hardwareBrand === 'Blum'
        ? Math.round(pricing.hardwareBlum * 0.65)
        : Math.round(pricing.hardwareBoyard * 0.55);
    const extrasAdd =
      extras.extraShelves * pricing.extraShelfPrice +
      extras.drawers * pricing.extraDrawerPrice +
      extras.glassDoors * pricing.extraGlassDoorPrice +
      (extras.ledLighting ? pricing.extraLedPrice : 0);
    const raw = partsSum + hardwareAdd + extrasAdd;
    return Math.max(500000, Math.round(raw / 10000) * 10000);
  }, [subParts, pricing, hardwareBrand, extras, quote.totalPrice]);

  const customCuttingParts = useMemo(
    () => (subParts.length > 0 ? subPartsToCuttingParts(subParts) : quote.cuttingParts),
    [subParts, quote.cuttingParts],
  );

  const activeSheetSize: SheetSizeKey =
    facadeMaterial === 'Rossiya LDSP' || carcassMaterial === 'Rossiya LDSP'
      ? '2750x1830'
      : '2800x2070';

  const nestingSummary = useMemo(
    () => computeSheetNesting(customCuttingParts, activeSheetSize),
    [customCuttingParts, activeSheetSize],
  );

  const filterCategories = useMemo(() => ['Hammasi', ...categories], [categories]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of catalog) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const categoryMatched =
      categoryFilter === 'Hammasi'
        ? catalog
        : catalog.filter((item) => item.category === categoryFilter);

    if (searchQuery.trim()) {
      return searchCatalogItems(categoryMatched, searchQuery);
    }

    return [...categoryMatched].sort(
      (a, b) => (a.catalogNumber ?? 9999) - (b.catalogNumber ?? 9999),
    );
  }, [catalog, categoryFilter, searchQuery]);

  // 15+ AI furniture recommendations prioritized by room analysis match & №201+ AI models
  const aiCatalogItems = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredCatalog;
    }
    const recIds = new Set(aiAnalysis?.recommendations.map((r) => r.catalogItemId) ?? []);
    const matched = filteredCatalog.filter((c) => recIds.has(c.id));
    const aiGenerated = filteredCatalog.filter((c) => !recIds.has(c.id) && c.isAiGenerated);
    const others = filteredCatalog.filter((c) => !recIds.has(c.id) && !c.isAiGenerated);
    const combined = [...matched, ...aiGenerated, ...others];
    return combined.slice(0, Math.max(15, combined.length));
  }, [filteredCatalog, aiAnalysis, searchQuery]);

  const handlePlaceCatalogItem = (
    item: CatalogItem,
    customDims?: DimensionsCm,
    options?: { keepViewMode?: boolean },
  ) => {
    tgHapticImpact('medium');
    const dims = customDims ?? { ...item.defaultDimensions };
    const box: PlacedFurnitureBox = {
      xPercent: 50,
      yPercent: item.category === 'Shkaf' || item.category === 'Yotoqxona' ? 49 : 52,
      widthPercent: item.category === 'TV-zona' ? 60 : 54,
      heightPercent: item.category === 'Shkaf' || item.category === 'Yotoqxona' ? 62 : 52,
    };

    setSelectedItem(item);
    setCarcassMaterial(item.carcassMaterial);
    setFacadeMaterial(item.facadeMaterial);
    setHardwareBrand(item.hardwareBrand);
    setExtras({ ...DEFAULT_EXTRAS });
    setAiRenderImage(null);
    setSelectedPartId(null);
    setHistoryStack([]);

    setSubParts(
      decomposeFurnitureToSubParts({
        category: item.category,
        dimensions: dims,
        placedBox: box,
        carcassMat: mapMaterialToPartMat(item.carcassMaterial),
        facadeMat: mapMaterialToPartMat(item.facadeMaterial),
        palette: item.palette,
        layoutVariant: item.layoutVariant,
      }),
    );

    if (!options?.keepViewMode) {
      setCanvasViewMode('3d-cad');
    }
    setActiveTab('konstruktor');
  };

  const handleAddFreeDetail = (kind: SubPartKind) => {
    tgHapticImpact('light');
    const tpl = SUBPART_TEMPLATES[kind];
    const spawn = findFreeSpawnPosition(kind, tpl.widthMm, tpl.heightMm, subParts);
    const countSame = subParts.filter((p) => p.kind === kind).length + 1;
    const newPart: FurnitureSubPart = {
      id: `free-${kind}-${Date.now()}`,
      name: `${tpl.label} #${countSame}`,
      kind,
      xMm: spawn.xMm,
      yMm: spawn.yMm,
      widthMm: spawn.widthMm,
      heightMm: spawn.heightMm,
      depthMm: spawn.depthMm,
      material: tpl.material,
      isFreePlaced: true,
    };
    pushHistorySnapshot(subParts);
    setSubParts((prev) => [...prev, newPart]);
    setSelectedPartId(newPart.id);
    if (canvasViewMode !== '3d-cad') {
      setCanvasViewMode('3d-cad');
    }
  };

  const handleDuplicatePart = (part: FurnitureSubPart) => {
    tgHapticImpact('light');
    const spawn = findFreeSpawnPosition(part.kind, part.widthMm, part.heightMm, subParts);
    const cloned: FurnitureSubPart = {
      ...part,
      id: `dup-${part.kind}-${Date.now()}`,
      name: `${part.name} (nusxa)`,
      xMm: spawn.xMm,
      yMm: spawn.yMm,
      widthMm: spawn.widthMm,
      heightMm: spawn.heightMm,
      depthMm: part.depthMm,
      isFreePlaced: true,
    };
    pushHistorySnapshot(subParts);
    setSubParts((prev) => [...prev, cloned]);
    setSelectedPartId(cloned.id);
  };

  const handleDeletePartById = (partId: string) => {
    tgHapticImpact('light');
    if (subParts.length <= 1) return;
    pushHistorySnapshot(subParts);
    setSubParts((prev) => prev.filter((p) => p.id !== partId));
    if (selectedPartId === partId) {
      setSelectedPartId(null);
    }
  };

  const handleOverallDimensionsFromDrawer = (nextDims: DimensionsCm) => {
    if (!selectedItem) return;
    pushHistorySnapshot(subParts);
    setSubParts(
      decomposeFurnitureToSubParts({
        category: selectedItem.category,
        dimensions: nextDims,
        placedBox: derivedBox,
        carcassMat: mapMaterialToPartMat(carcassMaterial),
        facadeMat: mapMaterialToPartMat(facadeMaterial),
        palette: selectedItem.palette,
        layoutVariant: selectedItem.layoutVariant,
      }),
    );
  };

  const handleCarcassChange = (mat: CarcassMaterial) => {
    tgHapticImpact('light');
    setCarcassMaterial(mat);
    const nextPartMat = mapMaterialToPartMat(mat);
    pushHistorySnapshot(subParts);
    setSubParts((prev) =>
      prev.map((p) =>
        !p.isFreePlaced &&
        (p.kind === 'side' ||
          p.kind === 'shelf' ||
          p.kind === 'divider' ||
          (p.kind === 'board' && p.heightMm <= 60 && p.id !== 'part-countertop'))
          ? { ...p, material: nextPartMat, colorHex: undefined }
          : p,
      ),
    );
  };

  const handleFacadeChange = (mat: FacadeMaterial) => {
    tgHapticImpact('light');
    setFacadeMaterial(mat);
    const nextPartMat = mapMaterialToPartMat(mat);
    pushHistorySnapshot(subParts);
    setSubParts((prev) =>
      prev.map((p) =>
        !p.isFreePlaced &&
        p.material !== 'Shisha' &&
        (p.kind === 'door' || p.kind === 'drawer' || p.id === 'part-tv-panel')
          ? { ...p, material: nextPartMat, colorHex: undefined }
          : p,
      ),
    );
  };

  const handleRoomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    tgHapticImpact('light');
    const reader = new FileReader();
    reader.onload = () => {
      setRoomImage(reader.result as string);
      setSelectedRoomId(null);
      setAiRenderImage(null);
      setAiAnalysis(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAnalyzeRoomWithAI = async () => {
    tgHapticImpact('light');
    setIsAnalyzingRoom(true);
    setAiRecommendError(null);
    try {
      const res = await fetch('/api/ai/recommend-furniture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomImage }),
      });
      const raw = await res.text();
      const data = raw ? (JSON.parse(raw) as AIRoomAnalysisResponse & { error?: string }) : null;
      if (!res.ok || !data || !Array.isArray(data.recommendations)) {
        throw new Error(data?.error || "Xonani tahlil qilib bo'lmadi.");
      }
      setAiAnalysis(data);
    } catch (err: unknown) {
      setAiRecommendError(
        err instanceof Error ? err.message : "Server bilan bog'lanishda xatolik.",
      );
    } finally {
      setIsAnalyzingRoom(false);
    }
  };

  const handleGenerateAIRender = async () => {
    if (!selectedItem) return;
    tgHapticImpact('light');
    setIsGeneratingAI(true);
    setAiRenderError(null);
    try {
      const res = await fetch('/api/ai/generate-furniture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomImage,
          furnitureImage: selectedItem.image,
          furnitureTitle: selectedItem.title,
          category: selectedItem.category,
          dimensions: overallDimensions,
          carcassMaterial,
          facadeMaterial,
          extras,
          placedBox: derivedBox,
        }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok || !data.imageDataUrl) {
        throw new Error(data.error || 'AI real tasvir yaratishda xatolik.');
      }
      setAiRenderImage(data.imageDataUrl);
      setCanvasViewMode('ai-render');
    } catch (err: unknown) {
      setAiRenderError(
        err instanceof Error ? err.message : "AI xizmati vaqtincha band. Qayta urinib ko'ring.",
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleShareDesignInTelegram = () => {
    if (!selectedItem) return;
    tgHapticImpact('light');
    const code = formatCatalogCode(selectedItem.catalogNumber);
    const text = [
      `RSM CUT — Ravshan Samarqand Mebel`,
      `Model: ${code ? `${code} · ` : ''}${selectedItem.title}`,
      `O'lcham: ${overallDimensions.widthCm * 10} × ${overallDimensions.heightCm * 10} × ${overallDimensions.depthCm * 10} mm`,
      `Material: ${carcassMaterial} + ${facadeMaterial} (${hardwareBrand})`,
      `2D Raskroy: ${nestingSummary.totalSheetsFloat} varaq · ${nestingSummary.totalEdgeBandingM} m kromka`,
      `Umumiy narx: ${formatSom(livePartsTotalPrice)}`,
      `Muddat: ${quote.productionDaysLabel}`,
    ].join('\n');
    const result = shareViaTelegramLink(text);
    setShareNotice(result === 'telegram' ? 'Telegram ulashish ochildi!' : 'Narx hisobi nusxalandi!');
    window.setTimeout(() => setShareNotice(null), 2400);
  };

  const handleSwitchTab = (tab: ClientTab) => {
    tgHapticSelection();
    setActiveTab(tab);
    if (tab === 'konstruktor') {
      setCanvasViewMode('3d-cad');
    }
  };

  const renderFurnitureCard = (item: CatalogItem, isAiRecommended = false) => {
    const isSelected = selectedItem?.id === item.id;
    return (
      <div
        key={item.id}
        className={`bg-white rounded-2xl border p-2.5 flex flex-col justify-between shadow-xs transition-all ${
          isSelected
            ? 'border-[#C5A059] ring-2 ring-[#C5A059]/35'
            : 'border-[#C5A059]/45 hover:border-[#C5A059]'
        }`}
      >
        <div>
          <div className="aspect-[4/3] rounded-xl bg-[#FAF8F5] border border-[#C5A059]/25 p-1.5 flex items-center justify-center relative overflow-hidden">
            <TransparentFurnitureImg
              src={item.image}
              alt={item.title}
              className="w-full h-full object-contain"
            />
            {item.catalogNumber && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold font-mono-num shadow-xs">
                {formatCatalogCode(item.catalogNumber)}
              </span>
            )}
            {isAiRecommended && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#0E3A2F]/90 text-[#C5A059] border border-[#C5A059]/70 text-[9px] font-bold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
          </div>

          <div className="mt-2 space-y-0.5">
            <p className="text-[10px] font-semibold text-[#6B7A74] truncate">
              {item.category}
              {item.styleTag ? ` · ${item.styleTag}` : ''}
            </p>
            <h3 className="text-xs font-bold text-[#1A2421] line-clamp-2 leading-snug min-h-[32px]">
              {item.title}
            </h3>
            <p className="text-xs font-bold text-[#0E3A2F] font-mono-num">
              {formatSom(item.basePrice)}
            </p>
            <p className="text-[10px] text-[#6B7A74] font-mono-num">
              {item.defaultDimensions.widthCm * 10} × {item.defaultDimensions.heightCm * 10} ×{' '}
              {item.defaultDimensions.depthCm * 10} mm
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handlePlaceCatalogItem(item)}
          className={`mt-2.5 w-full min-h-[38px] rounded-xl text-xs font-semibold border transition-colors ${
            isSelected
              ? 'bg-[#0E3A2F] text-[#C5A059] border-[#C5A059]'
              : 'bg-[#0E3A2F] hover:bg-[#144D3E] text-white border-[#C5A059]/75'
          }`}
        >
          Tanlash
        </button>
      </div>
    );
  };

  return (
    <div className={`flex-1 flex flex-col px-3.5 pt-3 pb-24 ${telegramUser?.isTelegramEnv ? 'client-workspace--telegram' : ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleRoomUpload}
        className="hidden"
      />

      {/* SCREEN 1: ASOSIY — 1-BO'LIM: BO'SH XONA RASMINI YUKLASH */}
      {activeTab === 'asosiy' && (
        <div className="space-y-3.5">
          <div className="flex justify-center">
            <div className="w-full py-2 px-4 rounded-full bg-[#0E3A2F]/8 border border-[#C5A059]/60 text-center">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#0E3A2F]">
                1-BO&apos;LIM: BO&apos;SH XONA RASMINI YUKLASH
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#C5A059]/60 p-4 shadow-sm space-y-3.5">
            {/* Dashed Gold-Bordered Room Photo Frame */}
            <div className="relative rounded-2xl border-2 border-dashed border-[#C5A059] overflow-hidden aspect-[4/3] bg-[#FAF8F5]">
              <img
                src={roomImage}
                alt="Tanlangan xona rasmi"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3">
                <span className="px-3.5 py-1.5 rounded-full bg-[#0E3A2F]/90 text-white border border-[#C5A059] shadow-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                  <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Xonangiz tanlandi</span>
                </span>
              </div>
            </div>

            {/* Full-Width Dark Emerald Pill CTA */}
            <button
              type="button"
              onClick={() => {
                tgHapticImpact('light');
                fileInputRef.current?.click();
              }}
              className="w-full min-h-[48px] px-4 rounded-full bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059] text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.99]"
            >
              <Camera className="w-4 h-4 text-[#C5A059]" />
              <span>Bo&apos;sh xona rasmini yuklash</span>
            </button>

            <p className="text-xs text-center text-[#6B7A74] leading-relaxed px-1">
              Xonangiz rasmini yuklang yoki quyidagi namunalardan birini tanlang — mebel 7D muhitga avtomatik tushadi.
            </p>

            {/* 3-Column Namuna Xonalar Grid */}
            <div className="pt-1 space-y-2">
              <p className="text-xs font-bold text-[#0E3A2F]">Namuna xonalar:</p>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_ROOMS_ORDERED.map(({ presetId, shortLabel }) => {
                  const preset = ROOM_PRESETS.find((r) => r.id === presetId);
                  if (!preset) return null;
                  const isActive = selectedRoomId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        tgHapticSelection();
                        setSelectedRoomId(preset.id);
                        setRoomImage(preset.image);
                        setAiRenderImage(null);
                        setAiAnalysis(null);
                      }}
                      className={`rounded-2xl overflow-hidden border bg-[#FAF8F5] text-left transition-all ${
                        isActive
                          ? 'border-[#C5A059] ring-2 ring-[#C5A059]/45 shadow-xs'
                          : 'border-[#C5A059]/35 hover:border-[#C5A059]'
                      }`}
                    >
                      <div className="aspect-[4/3] relative overflow-hidden">
                        <img
                          src={preset.image}
                          alt={shortLabel}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        {isActive && (
                          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] flex items-center justify-center shadow">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="px-1.5 py-1.5 text-center bg-white">
                        <p className="text-[11px] font-semibold text-[#1A2421] truncate">
                          {shortLabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: MEBEL TANLASH — 2-BO'LIM: MEBEL TANLASH */}
      {activeTab === 'mebel' && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="w-full py-2 px-4 rounded-full bg-[#0E3A2F]/8 border border-[#C5A059]/60 text-center">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#0E3A2F]">
                2-BO&apos;LIM: MEBEL TANLASH
              </span>
            </div>
          </div>

          {/* Segmented Toggle: Usta Katalogi vs AI Tavsiyasi (15+) */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-[#C5A059]/50 rounded-2xl shadow-xs">
            <button
              type="button"
              onClick={() => {
                tgHapticSelection();
                setCatalogSource('catalog');
              }}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold transition-all ${
                catalogSource === 'catalog'
                  ? 'bg-[#0E3A2F] text-white border border-[#C5A059]'
                  : 'text-[#1A2421]/75 hover:text-[#0E3A2F]'
              }`}
            >
              Usta Katalogi
            </button>
            <button
              type="button"
              onClick={() => {
                tgHapticSelection();
                setCatalogSource('ai');
                if (!aiAnalysis && !isAnalyzingRoom) {
                  handleAnalyzeRoomWithAI();
                }
              }}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                catalogSource === 'ai'
                  ? 'bg-[#0E3A2F] text-white border border-[#C5A059]'
                  : 'text-[#1A2421]/75 hover:text-[#0E3A2F]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>AI Tavsiyasi (15+)</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#C5A059] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mebel raqami (№101) yoki nomi bo'yicha qidirish..."
              className="w-full min-h-[44px] pl-10 pr-10 rounded-2xl bg-white border border-[#C5A059]/45 text-xs font-medium text-[#1A2421] placeholder:text-[#6B7A74] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Qidiruvni tozalash"
                className="w-7 h-7 rounded-full hover:bg-[#FAF8F5] text-[#6B7A74] flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {filterCategories.map((cat) => {
              const count = cat === 'Hammasi' ? catalog.length : (categoryCounts.get(cat) ?? 0);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    tgHapticSelection();
                    setCategoryFilter(cat);
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 border ${
                    categoryFilter === cat
                      ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                      : 'bg-white text-[#1A2421] border-[#C5A059]/40 hover:border-[#C5A059]'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="font-mono-num text-[10px] opacity-80">{count}</span>
                </button>
              );
            })}
          </div>

          {/* AI Room Analysis Summary Strip (when AI Tavsiyasi tab is active) */}
          {catalogSource === 'ai' && (
            <div className="bg-white rounded-2xl border border-[#C5A059]/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0E3A2F] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>
                      {aiAnalysis ? `AI Tahlil: ${aiAnalysis.detectedStyle}` : 'Xona asosida AI tavsiyalar'}
                    </span>
                  </p>
                  <p className="text-[11px] text-[#6B7A74] line-clamp-2 mt-0.5">
                    {aiAnalysis
                      ? aiAnalysis.roomSummaryUz
                      : "Xonangiz yorug'ligi va o'lchamiga mos 15+ premium dizaynlar saralandi."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeRoomWithAI}
                  disabled={isAnalyzingRoom}
                  className="min-h-[34px] px-3 rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] disabled:opacity-60 text-white border border-[#C5A059] text-[11px] font-semibold flex items-center gap-1 shrink-0"
                >
                  {isAnalyzingRoom ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C5A059]" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                  )}
                  <span>{isAnalyzingRoom ? 'Tahlil...' : 'Tahlil'}</span>
                </button>
              </div>
              {aiRecommendError && (
                <p className="text-[11px] text-rose-700">{aiRecommendError}</p>
              )}
            </div>
          )}

          {/* 2-Column Furniture Cards Grid */}
          {(() => {
            const list = catalogSource === 'ai' ? aiCatalogItems : filteredCatalog;
            const recSet = new Set(aiAnalysis?.recommendations.map((r) => r.catalogItemId) ?? []);
            if (list.length === 0) {
              return (
                <div className="bg-white rounded-3xl border border-[#C5A059]/45 p-8 text-center">
                  <p className="text-xs font-semibold text-[#6B7A74]">
                    So&apos;rov bo&apos;yicha mebel topilmadi.
                  </p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-2 gap-3">
                {list.map((item) =>
                  renderFurnitureCard(
                    item,
                    catalogSource === 'ai' && (recSet.size === 0 || recSet.has(item.id)),
                  ),
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* SCREEN 3: KONSTRUKTOR — 3-BO'LIM: 360° KONSTRUKTOR (7D) */}
      {activeTab === 'konstruktor' && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="w-full py-2 px-4 rounded-full bg-[#0E3A2F]/8 border border-[#C5A059]/60 text-center">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#0E3A2F]">
                3-BO&apos;LIM: 360° KONSTRUKTOR (7D)
              </span>
            </div>
          </div>

          <InteractiveRoomCanvas
            roomImage={roomImage}
            selectedItem={selectedItem}
            catalog={catalog}
            onQuickSelectCatalogItem={(item) =>
              handlePlaceCatalogItem(item, undefined, { keepViewMode: true })
            }
            subParts={subParts}
            onSubPartsChange={handleSubPartsChangeWithHistory}
            onCommitHistorySnapshot={pushHistorySnapshot}
            canUndo={historyStack.length > 0}
            onUndo={handleUndo}
            selectedPartId={selectedPartId}
            onSelectPartId={setSelectedPartId}
            pricing={pricing}
            totalPrice={livePartsTotalPrice}
            overallDimensions={overallDimensions}
            extras={extras}
            aiRenderImage={aiRenderImage}
            canvasViewMode={canvasViewMode}
            onCanvasViewModeChange={setCanvasViewMode}
            onGenerateAIRender={handleGenerateAIRender}
            isGeneratingAI={isGeneratingAI}
            aiError={aiRenderError}
            onDismissAiError={() => setAiRenderError(null)}
            onAddFreeDetail={handleAddFreeDetail}
            onDuplicatePart={handleDuplicatePart}
            onDeletePart={handleDeletePartById}
            onOpenEditDrawer={() => setIsEditDrawerOpen(true)}
          />
        </div>
      )}

      {/* SCREEN 4: BUYURTMALAR — 4-BO'LIM: BUYURTMA VA RASKROY */}
      {activeTab === 'buyurtmalar' && (
        <div className="space-y-3.5">
          <div className="flex justify-center">
            <div className="w-full py-2 px-4 rounded-full bg-[#0E3A2F]/8 border border-[#C5A059]/60 text-center">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#0E3A2F]">
                4-BO&apos;LIM: BUYURTMA VA RASKROY
              </span>
            </div>
          </div>

          {/* Top Card: Interactive 2D Raskroy Map */}
          <div className="bg-white rounded-3xl border border-[#C5A059]/60 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0E3A2F] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#C5A059]" />
                <span>2D Raskroy xaritasi</span>
              </h2>
              <span className="px-2.5 py-1 rounded-full bg-[#FAF8F5] border border-[#C5A059]/60 text-[10px] font-bold font-mono-num text-[#0E3A2F]">
                {SHEET_DIMENSIONS[activeSheetSize].label}
              </span>
            </div>

            <SheetNestingVisualizer
              cuttingParts={customCuttingParts}
              sheetSize={activeSheetSize}
              editable={false}
            />
          </div>

          {/* Middle Summary Card: Buyurtma Hisoboti */}
          <div className="bg-white rounded-3xl border border-[#C5A059]/60 p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#C5A059]/25">
              <h2 className="text-sm font-bold text-[#0E3A2F] flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-[#C5A059]" />
                <span>Buyurtma hisoboti</span>
              </h2>
              {selectedItem && (
                <div className="flex items-center gap-1.5 min-w-0 max-w-[190px]">
                  {selectedItem.catalogNumber && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold font-mono-num shrink-0">
                      {formatCatalogCode(selectedItem.catalogNumber)}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-[#6B7A74] truncate">
                    {selectedItem.title}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6B7A74]">Umumiy detal soni:</span>
                <span className="font-bold font-mono-num text-[#1A2421]">
                  {nestingSummary.totalPartsCount} dona ({customCuttingParts.length} xil)
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6B7A74]">Raskroy varaqlari:</span>
                <span className="font-bold font-mono-num text-[#0E3A2F]">
                  {nestingSummary.totalSheetsFloat} varaq ({nestingSummary.totalSheetsCount} ta ·{' '}
                  {nestingSummary.wastePercent}% chiqindi)
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6B7A74]">Material:</span>
                <span className="font-semibold text-[#1A2421] text-right">
                  {carcassMaterial} + {facadeMaterial} ({hardwareBrand})
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6B7A74]">O&apos;lchami:</span>
                <span className="font-semibold font-mono-num text-[#1A2421]">
                  {overallDimensions.widthCm * 10} × {overallDimensions.heightCm * 10} ×{' '}
                  {overallDimensions.depthCm * 10} mm
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-[#C5A059]/30 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] text-[#6B7A74]">Umumiy narx</p>
                <p className="text-base font-bold font-mono-num text-[#0E3A2F]">
                  {formatSom(livePartsTotalPrice)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#6B7A74]">Tayyorlanish muddati</p>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-[#C5A059]/60 text-xs font-bold text-[#0E3A2F]">
                  {quote.productionDaysLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Emerald + Gold CTA */}
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => {
              tgHapticImpact('medium');
              setIsOrderModalOpen(true);
            }}
            className="w-full min-h-[50px] px-4 rounded-full bg-[#0E3A2F] hover:bg-[#144D3E] disabled:opacity-50 text-white border border-[#C5A059] text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-transform active:scale-[0.99]"
          >
            <ShoppingBag className="w-4 h-4 text-[#C5A059]" />
            <span>Ustaga buyurtma berish</span>
          </button>

          <button
            type="button"
            disabled={!selectedItem}
            onClick={handleShareDesignInTelegram}
            className="w-full min-h-[42px] px-4 rounded-full bg-white hover:bg-[#FAF8F5] text-[#0E3A2F] border border-[#C5A059]/55 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>{shareNotice ?? "Do'stga / Mijozga ulashish"}</span>
          </button>
        </div>
      )}

      {/* Fixed Bottom 4-Tab Navigation Bar */}
      <nav
        aria-label="Asosiy bo'limlar"
        className="client-bottom-nav fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-white border-t border-[#C5A059]/40 grid grid-cols-4 py-2 shadow-[0_-4px_16px_rgba(14,58,47,0.06)]"
      >
        {(
          [
            { id: 'asosiy', label: 'Asosiy', Icon: Home },
            { id: 'konstruktor', label: 'Konstruktor', Icon: PencilRuler },
            { id: 'mebel', label: 'Mebel tanlash', Icon: Armchair },
            { id: 'buyurtmalar', label: 'Buyurtmalar', Icon: ShoppingBag },
          ] as const
        ).map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSwitchTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1 py-1 px-1 relative transition-colors"
            >
              <span
                className={`h-0.5 w-7 rounded-full transition-opacity ${
                  isActive ? 'bg-[#C5A059] opacity-100' : 'opacity-0'
                }`}
              />
              <Icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-[#0E3A2F]' : 'text-[#6B7A74]'
                }`}
              />
              <span
                className={`client-bottom-nav-label text-[10px] leading-tight truncate max-w-full ${
                  isActive ? 'font-bold text-[#0E3A2F]' : 'font-medium text-[#6B7A74]'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <EditDetailsDrawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        dimensions={overallDimensions}
        onDimensionsChange={handleOverallDimensionsFromDrawer}
        carcassMaterial={carcassMaterial}
        onCarcassChange={handleCarcassChange}
        facadeMaterial={facadeMaterial}
        onFacadeChange={handleFacadeChange}
        hardwareBrand={hardwareBrand}
        onHardwareChange={setHardwareBrand}
        extras={extras}
        onExtrasChange={setExtras}
        pricing={pricing}
        totalPrice={livePartsTotalPrice}
      />

      {selectedItem && (
        <OrderSubmissionModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          selectedItem={selectedItem}
          dimensions={overallDimensions}
          carcassMaterial={carcassMaterial}
          facadeMaterial={facadeMaterial}
          hardwareBrand={hardwareBrand}
          extras={extras}
          roomImage={roomImage}
          aiRenderImage={aiRenderImage}
          placedBox={derivedBox}
          quote={quote}
          customCuttingParts={customCuttingParts}
          nestingSummary={nestingSummary}
          totalPriceOverride={livePartsTotalPrice}
          telegramUser={telegramUser}
          onOrderCreated={onOrderCreated}
          onSwitchToWorkshop={onSwitchToWorkshop}
        />
      )}
    </div>
  );
};
