export type AppMode = 'client' | 'workshop';

export type CanvasViewMode = 'interactive' | '3d-cad' | 'ai-render' | 'before';

export type RoomCategory = string;

export const DEFAULT_ROOM_CATEGORIES = [
  'Oshxona',
  'Shkaf',
  'TV-zona',
  'Yotoqxona',
] as const;

export type FurnitureStyleTag =
  | 'Modern'
  | 'Hi-Tech'
  | 'Neoklassika'
  | 'Minimalizm'
  | 'Loft';

export type FurnitureArchetype =
  | 'kitchen'
  | 'wardrobe'
  | 'tvzone'
  | 'bedroom'
  | 'kids'
  | 'hallway'
  | 'office';

export interface FurnitureFinishPalette {
  carcassHex: string;
  facadeHex: string;
  accentHex: string;
  handleHex: string;
  countertopHex?: string;
  glassHex?: string;
  frameHex?: string;
}

export interface FurnitureLayoutVariant {
  archetype: FurnitureArchetype;
  doorsCount?: number;
  drawersCount?: number;
  hasVitrine?: boolean;
  hasOpenNiche?: boolean;
  hasSlats?: boolean;
  hasDesk?: boolean;
}

export type CarcassMaterial = 'Rossiya LDSP' | 'Turkiya MDF';

export type FacadeMaterial =
  | 'Rossiya LDSP'
  | 'Turkiya MDF'
  | 'AGT Akril'
  | 'Shpon';

export type PartMaterial = 'LDSP' | 'MDF' | 'Akril' | 'Shisha' | 'DVP/HDF';

export type SubPartKind = 'door' | 'shelf' | 'drawer' | 'side' | 'board' | 'divider' | 'back';

export type CollisionEdge = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';

export type HardwareBrand = 'Boyard' | 'Blum';

export type SheetSizeKey = '2750x1830' | '2800x2070';

export type OrderStatus =
  | 'Yangi'
  | "O'lchov"
  | 'Kesish / Raskroy'
  | "Yig'ish"
  | 'Tayyor';

export interface DimensionsCm {
  widthCm: number;
  heightCm: number;
  depthCm: number;
}

export interface ExtraDetails {
  extraShelves: number;
  drawers: number;
  glassDoors: number;
  ledLighting: boolean;
}

export interface FurnitureSubPart {
  id: string;
  name: string;
  kind: SubPartKind;
  xMm: number;      // Left X on calibrated wall canvas (0..4500 mm)
  yMm: number;      // Top Y on calibrated wall canvas (0..3000 mm)
  widthMm: number;  // Width in mm
  heightMm: number; // Height in mm
  depthMm: number;  // Depth in mm
  material: PartMaterial;
  isFreePlaced?: boolean;
  colorHex?: string;
  handleColorHex?: string;
  frameColorHex?: string;
}

export interface MaterialPricing {
  ldspPerSqm: number;
  mdfPerSqm: number;
  acrylicPerSqm: number;
  veneerPerSqm: number;
  countertopPerM: number;
  edgeBandingPerM: number;
  hardwareBoyard: number;
  hardwareBlum: number;
  extraShelfPrice: number;
  extraDrawerPrice: number;
  extraGlassDoorPrice: number;
  extraLedPrice: number;
  laborPercent: number;
}

export interface CatalogItem {
  id: string;
  title: string;
  category: RoomCategory;
  description: string;
  image: string;
  basePrice: number;
  defaultDimensions: DimensionsCm;
  carcassMaterial: CarcassMaterial;
  facadeMaterial: FacadeMaterial;
  hardwareBrand: HardwareBrand;
  styleTag?: FurnitureStyleTag;
  finishLabel?: string;
  palette?: FurnitureFinishPalette;
  layoutVariant?: FurnitureLayoutVariant;
  isDefault?: boolean;
  isAiGenerated?: boolean;
  catalogNumber?: number;
}

export interface PlacedFurnitureBox {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface CuttingPart {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  qty: number;
  material: string;
  edgeBandingSides: string;
  role: 'carcass' | 'facade' | 'drawer' | 'shelf';
  canRotate?: boolean;
}

export interface PackedPartRect {
  partId: string;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
  material: string;
  edgeBandingSides: string;
  role: 'carcass' | 'facade' | 'drawer' | 'shelf';
}

export interface PackedSheet {
  sheetIndex: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  parts: PackedPartRect[];
  usedAreaMm2: number;
  wastePercent: number;
}

export interface NestingResult {
  sheetSize: SheetSizeKey;
  sheetWidthMm: number;
  sheetHeightMm: number;
  sheets: PackedSheet[];
  totalSheetsFloat: number;
  totalSheetsCount: number;
  wastePercent: number;
  totalEdgeBandingM: number;
  totalPartsCount: number;
}

export interface QuoteBreakdown {
  totalPrice: number;
  baseStructurePrice: number;
  extrasPrice: number;
  hardwarePrice: number;
  laborPrice: number;
  sheetAreaSqm: number;
  edgeBandingM: number;
  productionDaysLabel: string;
  cuttingParts: CuttingPart[];
  hardwareChecklist: string[];
}

export interface RoomPreset {
  id: string;
  title: string;
  subtitle: string;
  category: RoomCategory;
  dimensions: DimensionsCm;
  image: string;
}

export interface AIRecommendation {
  catalogItemId: string;
  reasonUz: string;
  suggestedDimensions: DimensionsCm;
  fitScoreLabel: string;
}

export interface AIRoomAnalysisResponse {
  roomSummaryUz: string;
  detectedStyle: string;
  lightingNoteUz: string;
  recommendations: AIRecommendation[];
  isFallback?: boolean;
}

export interface FurnitureOrder {
  id: string;
  createdAt: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  notes: string;
  catalogItemId: string;
  catalogItemTitle: string;
  catalogNumber?: number;
  category: RoomCategory;
  dimensions: DimensionsCm;
  carcassMaterial: CarcassMaterial;
  facadeMaterial: FacadeMaterial;
  hardwareBrand: HardwareBrand;
  extras: ExtraDetails;
  roomImage: string;
  furnitureImage: string;
  aiRenderImage?: string;
  placedBox: PlacedFurnitureBox;
  totalPrice: number;
  productionDaysLabel: string;
  cuttingParts: CuttingPart[];
  hardwareChecklist: string[];
  sheetSize: SheetSizeKey;
  status: OrderStatus;
  loyaltyCouponCode?: string;
  notificationSentAt?: string;
}
