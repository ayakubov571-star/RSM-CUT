import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DEFAULT_ROOM_CATEGORIES,
  type AIRoomAnalysisResponse,
  type CarcassMaterial,
  type CatalogItem,
  type CuttingPart,
  type DimensionsCm,
  type ExtraDetails,
  type FacadeMaterial,
  type FurnitureOrder,
  type HardwareBrand,
  type MaterialPricing,
  type OrderStatus,
  type PlacedFurnitureBox,
  type RoomCategory,
  type SheetSizeKey,
} from './src/types.ts';
import { DEFAULT_CATALOG_ITEMS } from './src/data/presets.ts';
import {
  calculateFurnitureQuote,
  DEFAULT_EXTRAS,
  DEFAULT_MATERIAL_PRICING,
} from './src/utils/furnitureCalculator.ts';
import {
  build15ItemsForCategory,
  getNextCatalogNumber,
  reconcileCatalogNumbers,
  type RawAiGeneratedFurnitureSpec,
} from './src/utils/furnitureCatalogFactory.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'mebelpro-db.json');

interface WorkshopDatabase {
  pricing: MaterialPricing;
  categories?: string[];
  catalog: CatalogItem[];
  nextOrderNumber: number;
  orders: FurnitureOrder[];
}

function createInitialDatabase(): WorkshopDatabase {
  const pricing = { ...DEFAULT_MATERIAL_PRICING };
  const catalog = [...DEFAULT_CATALOG_ITEMS];

  const kitchenDims: DimensionsCm = { widthCm: 300, heightCm: 250, depthCm: 60 };
  const kitchenExtras: ExtraDetails = {
    extraShelves: 2,
    drawers: 1,
    glassDoors: 0,
    ledLighting: true,
  };
  const kitchenQuote = calculateFurnitureQuote({
    category: 'Oshxona',
    dimensions: kitchenDims,
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'Turkiya MDF',
    hardwareBrand: 'Boyard',
    extras: kitchenExtras,
    pricing,
  });

  const wardrobeDims: DimensionsCm = { widthCm: 240, heightCm: 255, depthCm: 65 };
  const wardrobeExtras: ExtraDetails = {
    extraShelves: 2,
    drawers: 2,
    glassDoors: 2,
    ledLighting: true,
  };
  const wardrobeQuote = calculateFurnitureQuote({
    category: 'Shkaf',
    dimensions: wardrobeDims,
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'Turkiya MDF',
    hardwareBrand: 'Blum',
    extras: wardrobeExtras,
    pricing,
  });

  const seedOrders: FurnitureOrder[] = [
    {
      id: '#MP-2024',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      clientName: 'Sardorbek Alimov',
      clientPhone: '+998 90 412 88 15',
      clientAddress: 'Toshkent sh., Yunusobod 11-mavze, 24-uy',
      notes: "O'ng tomondagi gaz quvuri uchun 8 sm joy qoldirish kerak.",
      catalogItemId: 'cat-kitchen-modern',
      catalogItemTitle: 'Toshkent Modern Oshxona',
      catalogNumber: 101,
      category: 'Oshxona',
      dimensions: kitchenDims,
      carcassMaterial: 'Rossiya LDSP',
      facadeMaterial: 'Turkiya MDF',
      hardwareBrand: 'Boyard',
      extras: kitchenExtras,
      roomImage: '/src/assets/images/preset_kitchen_before_1795688941730.jpg',
      furnitureImage: '/src/assets/images/catalog_kitchen_modern_1795689530411.jpg',
      aiRenderImage: '/src/assets/images/preset_kitchen_after_1795688941979.jpg',
      placedBox: { xPercent: 54, yPercent: 52, widthPercent: 62, heightPercent: 56 },
      totalPrice: kitchenQuote.totalPrice,
      productionDaysLabel: kitchenQuote.productionDaysLabel,
      cuttingParts: kitchenQuote.cuttingParts,
      hardwareChecklist: kitchenQuote.hardwareChecklist,
      sheetSize: '2800x2070',
      status: 'Kesish / Raskroy',
    },
    {
      id: '#MP-2025',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      clientName: 'Madina Karimova',
      clientPhone: '+998 93 551 09 42',
      clientAddress: 'Toshkent sh., Chilonzor 6-mavze, 18-uy',
      notes: "Ichki LED chiroqlar eshik ochilganda yonsin.",
      catalogItemId: 'cat-wardrobe-kupe',
      catalogItemTitle: 'Minimalist Shkaf-Kupe Pro',
      catalogNumber: 102,
      category: 'Shkaf',
      dimensions: wardrobeDims,
      carcassMaterial: 'Rossiya LDSP',
      facadeMaterial: 'Turkiya MDF',
      hardwareBrand: 'Blum',
      extras: wardrobeExtras,
      roomImage: '/src/assets/images/preset_wardrobe_before_1795688942692.jpg',
      furnitureImage: '/src/assets/images/catalog_wardrobe_kupe_1795689531221.jpg',
      aiRenderImage: '/src/assets/images/preset_wardrobe_after_1795688943923.jpg',
      placedBox: { xPercent: 50, yPercent: 48, widthPercent: 52, heightPercent: 66 },
      totalPrice: wardrobeQuote.totalPrice,
      productionDaysLabel: wardrobeQuote.productionDaysLabel,
      cuttingParts: wardrobeQuote.cuttingParts,
      hardwareChecklist: wardrobeQuote.hardwareChecklist,
      sheetSize: '2750x1830',
      status: 'Yangi',
    },
  ];

  return {
    pricing,
    categories: [...DEFAULT_ROOM_CATEGORIES],
    catalog,
    nextOrderNumber: 2026,
    orders: seedOrders,
  };
}

function reconcileDatabase(db: WorkshopDatabase): { db: WorkshopDatabase; dirty: boolean } {
  let dirty = false;

  if (!Array.isArray(db.catalog)) {
    db.catalog = [];
    dirty = true;
  }

  const defaultById = new Map(DEFAULT_CATALOG_ITEMS.map((item) => [item.id, item]));
  const existingIds = new Set(db.catalog.map((item) => item.id));

  // Upgrade existing default items if they are missing palette/layout metadata
  db.catalog = db.catalog.map((item) => {
    const template = defaultById.get(item.id);
    if (template && (!item.palette || !item.layoutVariant || !item.styleTag)) {
      dirty = true;
      return {
        ...template,
        ...item,
        styleTag: item.styleTag ?? template.styleTag,
        finishLabel: item.finishLabel ?? template.finishLabel,
        palette: item.palette ?? template.palette,
        layoutVariant: item.layoutVariant ?? template.layoutVariant,
      };
    }
    return item;
  });

  // Ensure all 60 curated default models (15 per default category) are present
  const missingDefaults = DEFAULT_CATALOG_ITEMS.filter((item) => !existingIds.has(item.id));
  if (missingDefaults.length > 0) {
    db.catalog.push(...missingDefaults);
    dirty = true;
  }

  // Ensure every catalog item has a permanent unique catalogNumber (№101+ / №201+)
  const numbered = reconcileCatalogNumbers(db.catalog);
  if (numbered.changed) {
    db.catalog = numbered.items;
    dirty = true;
  }

  // Backfill missing catalogNumber on existing orders from catalog
  if (Array.isArray(db.orders)) {
    const numberByCatalogId = new Map(
      db.catalog
        .filter((c) => typeof c.catalogNumber === 'number')
        .map((c) => [c.id, c.catalogNumber]),
    );
    db.orders = db.orders.map((ord) => {
      if (typeof ord.catalogNumber === 'number') return ord;
      const resolved = numberByCatalogId.get(ord.catalogItemId);
      if (typeof resolved === 'number') {
        dirty = true;
        return { ...ord, catalogNumber: resolved };
      }
      return ord;
    });
  }

  const catSet = new Set<string>([...DEFAULT_ROOM_CATEGORIES]);
  if (Array.isArray(db.categories)) {
    for (const c of db.categories) {
      if (typeof c === 'string' && c.trim()) catSet.add(c.trim());
    }
  }
  for (const item of db.catalog) {
    if (item.category?.trim()) catSet.add(item.category.trim());
  }
  const nextCategories = Array.from(catSet);
  if (
    !Array.isArray(db.categories) ||
    nextCategories.length !== db.categories.length ||
    nextCategories.some((c, idx) => db.categories?.[idx] !== c)
  ) {
    db.categories = nextCategories;
    dirty = true;
  }

  return { db, dirty };
}

function loadDatabase(): WorkshopDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = createInitialDatabase();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as WorkshopDatabase;
    const { db, dirty } = reconcileDatabase(parsed);
    if (dirty) {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    }
    return db;
  } catch (err) {
    console.error('Failed to load RSM CUT DB, reinitializing:', err);
    return createInitialDatabase();
  }
}

function saveDatabase(db: WorkshopDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  );
}

/**
 * Automatic Retry Logic: 3 retries with 2-second delay (2000 ms)
 */
async function withGeminiRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isTransientGeminiError(err)) {
        console.warn(`Gemini transient error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms...`);
        await delay(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function buildSmartFallbackRecommendation(
  catalog: CatalogItem[],
  roomHint?: string,
): AIRoomAnalysisResponse {
  const hint = (roomHint ?? '').toLowerCase();
  let preferredCategory: RoomCategory = 'Oshxona';
  if (hint.includes('wardrobe') || hint.includes('shkaf')) preferredCategory = 'Shkaf';
  else if (hint.includes('tv')) preferredCategory = 'TV-zona';
  else if (hint.includes('bedroom') || hint.includes('yotoq')) preferredCategory = 'Yotoqxona';

  const sorted = [...catalog].sort((a, b) => {
    if (a.category === preferredCategory && b.category !== preferredCategory) return -1;
    if (b.category === preferredCategory && a.category !== preferredCategory) return 1;
    return 0;
  });

  const topTwo = sorted.slice(0, 2);

  return {
    roomSummaryUz:
      "Xona devori to'g'ri burchakli va tabiiy yorug'lik bilan yaxshi ta'minlangan. Bo'sh devor kengligi bo'ylab to'liq balandlikdagi buyurtma mebel optimal joylashadi.",
    detectedStyle: 'Modern / Minimalist',
    lightingNoteUz:
      "Yorug' devor foniga mat neytral (kulrang-kashmir) va tabiiy yog'och teksturali fasadlar mos keladi.",
    recommendations: topTwo.map((item, idx) => ({
      catalogItemId: item.id,
      fitScoreLabel: idx === 0 ? '98% mos' : '91% mos',
      reasonUz:
        idx === 0
          ? `${item.title} xonaning bo'sh devor proporsiyasiga va yorug'ligiga eng yaxshi mos tushadi.`
          : `${item.title} (${item.carcassMaterial} + ${item.facadeMaterial}) uzoq muddatli chidamli muqobil variant sifatida tavsiya etiladi.`,
      suggestedDimensions: { ...item.defaultDimensions },
    })),
    isFallback: true,
  };
}

function formatFriendlyUzError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return "AI serveri hozir band. Iltimos, bir ozdan so'ng qayta urinib ko'ring.";
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return "AI so'rovlar limiti vaqtincha tugadi. Katalogdagi modellarni qo'lda joylashtirishingiz mumkin.";
  }
  if (lower.includes('api_key') || lower.includes('403') || lower.includes('permission')) {
    return "AI kaliti faol emas. Settings > Secrets bo'limini tekshiring.";
  }
  return "AI xizmatida vaqtinchalik uzilish yuz berdi. Qayta urinib ko'ring.";
}

function resolveImageInputToInlineData(
  imageInput: string,
  fallbackMimeType?: string,
): { data: string; mimeType: string } | null {
  if (!imageInput) return null;

  const dataUrlMatch = imageInput.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      data: dataUrlMatch[2],
    };
  }

  if (imageInput.startsWith('/src/assets/images/')) {
    const safeFileName = path.basename(imageInput);
    const candidatePaths = [
      path.resolve(__dirname, 'src', 'assets', 'images', safeFileName),
      path.resolve(__dirname, 'dist', 'src', 'assets', 'images', safeFileName),
    ];
    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        const buffer = fs.readFileSync(candidate);
        const ext = path.extname(safeFileName).toLowerCase();
        const mime =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : fallbackMimeType || 'image/jpeg';
        return {
          mimeType: mime,
          data: buffer.toString('base64'),
        };
      }
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/workshop/state', (_req, res) => {
    const db = loadDatabase();
    res.json({
      pricing: db.pricing,
      categories: db.categories ?? [...DEFAULT_ROOM_CATEGORIES],
      catalog: db.catalog,
      orders: db.orders,
    });
  });

  app.put('/api/workshop/pricing', (req, res) => {
    const body = req.body as Partial<MaterialPricing>;
    const db = loadDatabase();

    const numericKeys: (keyof MaterialPricing)[] = [
      'ldspPerSqm',
      'mdfPerSqm',
      'acrylicPerSqm',
      'veneerPerSqm',
      'countertopPerM',
      'edgeBandingPerM',
      'hardwareBoyard',
      'hardwareBlum',
      'extraShelfPrice',
      'extraDrawerPrice',
      'extraGlassDoorPrice',
      'extraLedPrice',
      'laborPercent',
    ];

    const updated: MaterialPricing = { ...db.pricing };
    for (const key of numericKeys) {
      const val = Number(body[key]);
      if (Number.isFinite(val) && val >= 0) {
        updated[key] = val;
      }
    }

    db.pricing = updated;
    saveDatabase(db);
    res.json({ pricing: db.pricing });
  });

  app.post('/api/catalog', (req, res) => {
    const db = loadDatabase();
    const {
      title,
      category,
      description,
      image,
      basePrice,
      defaultDimensions,
      carcassMaterial,
      facadeMaterial,
      hardwareBrand,
      styleTag,
      finishLabel,
      palette,
      layoutVariant,
    } = req.body as Partial<CatalogItem>;

    if (!title?.trim() || !category?.trim() || !image) {
      res.status(400).json({
        error: "Iltimos, mebel nomi, toifasi va rasmini kiriting.",
      });
      return;
    }

    const cleanCategory = category.trim();
    const newItem: CatalogItem = {
      id: `cat-${Date.now()}`,
      title: title.trim(),
      category: cleanCategory,
      description:
        (description ?? '').trim() || "Buyurtma asosida tayyorlanadigan maxsus mebel modeli.",
      image,
      basePrice: Math.max(500000, Number(basePrice) || 5500000),
      defaultDimensions: {
        widthCm: Math.max(60, Number(defaultDimensions?.widthCm) || 240),
        heightCm: Math.max(80, Number(defaultDimensions?.heightCm) || 220),
        depthCm: Math.max(30, Number(defaultDimensions?.depthCm) || 60),
      },
      carcassMaterial: (carcassMaterial as CarcassMaterial) || 'Rossiya LDSP',
      facadeMaterial: (facadeMaterial as FacadeMaterial) || 'Turkiya MDF',
      hardwareBrand: (hardwareBrand as HardwareBrand) || 'Boyard',
      styleTag,
      finishLabel,
      palette,
      layoutVariant,
      isDefault: false,
      isAiGenerated: false,
      catalogNumber: getNextCatalogNumber(db.catalog, false),
    };

    const categories = db.categories ?? [...DEFAULT_ROOM_CATEGORIES];
    if (!categories.includes(cleanCategory)) {
      categories.push(cleanCategory);
      db.categories = categories;
    }

    db.catalog.unshift(newItem);
    saveDatabase(db);
    res.status(201).json({ item: newItem, categories: db.categories });
  });

  /**
   * Auto-creates a new catalog category and uses gemini-2.5-flash (with automatic retries + deterministic fallback)
   * to generate 15 tailored, photorealistic/CAD-synced furniture recommendations into that category.
   */
  app.post('/api/categories/auto-generate', async (req, res) => {
    const { categoryName, styleHint } = req.body as {
      categoryName?: string;
      styleHint?: string;
    };

    const cleanCategory = (categoryName ?? '').trim();
    if (!cleanCategory) {
      res.status(400).json({ error: 'Iltimos, yangi katalog nomini kiriting.' });
      return;
    }

    const db = loadDatabase();
    const ai = getGeminiClient();
    let aiSpecs: RawAiGeneratedFurnitureSpec[] = [];
    let usedFallback = true;

    if (ai) {
      try {
        const promptText = [
          `Design exactly 15 distinct custom furniture models in Uzbek for a new category named "${cleanCategory}".`,
          styleHint?.trim() ? `Style/customer note: "${styleHint.trim()}".` : '',
          `Vary styles across Modern, Hi-Tech, Neoklassika, Minimalizm, Loft and vary finishes (Emerald & Gold, Anthracite & Oak, Natural Walnut, White Gloss, Cashmere, Loft Graphite, Ivory, etc.).`,
          `Use realistic millimeter-calibrated dimensions in cm (widthCm 140..420, heightCm 180..270, depthCm 38..70).`,
          `carcassMaterial must be "Rossiya LDSP" or "Turkiya MDF".`,
          `facadeMaterial must be "Rossiya LDSP", "Turkiya MDF", "AGT Akril", or "Shpon".`,
          `hardwareBrand must be "Boyard" or "Blum".`,
          `Provide valid 6-digit hex codes for facadeHex, carcassHex, accentHex, handleHex.`,
        ]
          .filter(Boolean)
          .join(' ');

        const response = await withGeminiRetry(
          () =>
            ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: promptText,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    models: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          styleTag: { type: Type.STRING },
                          finishLabel: { type: Type.STRING },
                          widthCm: { type: Type.INTEGER },
                          heightCm: { type: Type.INTEGER },
                          depthCm: { type: Type.INTEGER },
                          carcassMaterial: { type: Type.STRING },
                          facadeMaterial: { type: Type.STRING },
                          hardwareBrand: { type: Type.STRING },
                          facadeHex: { type: Type.STRING },
                          carcassHex: { type: Type.STRING },
                          accentHex: { type: Type.STRING },
                          handleHex: { type: Type.STRING },
                        },
                        required: [
                          'title',
                          'description',
                          'styleTag',
                          'finishLabel',
                          'widthCm',
                          'heightCm',
                          'depthCm',
                          'carcassMaterial',
                          'facadeMaterial',
                          'hardwareBrand',
                          'facadeHex',
                          'carcassHex',
                          'accentHex',
                          'handleHex',
                        ],
                      },
                    },
                  },
                  required: ['models'],
                },
              },
            }),
          3,
          2000,
        );

        const rawText = (response.text ?? '{}')
          .replace(/^```json\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        const parsed = JSON.parse(rawText) as { models?: RawAiGeneratedFurnitureSpec[] };
        if (Array.isArray(parsed.models) && parsed.models.length > 0) {
          aiSpecs = parsed.models;
          usedFallback = false;
        }
      } catch (err) {
        console.warn('Gemini category auto-generate fell back to curated specs:', err);
      }
    }

    const generatedItems = build15ItemsForCategory({
      categoryName: cleanCategory,
      styleHint,
      aiSpecs,
      pricing: db.pricing,
      startCatalogNumber: getNextCatalogNumber(db.catalog, true),
    });

    const categories = db.categories ?? [...DEFAULT_ROOM_CATEGORIES];
    if (!categories.includes(cleanCategory)) {
      categories.push(cleanCategory);
      db.categories = categories;
    }

    db.catalog = [...generatedItems, ...db.catalog];
    saveDatabase(db);

    res.status(201).json({
      category: cleanCategory,
      categories: db.categories,
      items: generatedItems,
      count: generatedItems.length,
      usedFallback,
    });
  });

  app.delete('/api/catalog/:id', (req, res) => {
    const db = loadDatabase();
    const targetId = req.params.id;
    const beforeLen = db.catalog.length;
    db.catalog = db.catalog.filter((c) => c.id !== targetId);
    if (db.catalog.length === beforeLen) {
      res.status(404).json({ error: 'Katalog elementi topilmadi.' });
      return;
    }
    saveDatabase(db);
    res.json({ deletedId: targetId });
  });

  app.post('/api/orders', (req, res) => {
    const db = loadDatabase();
    const body = req.body as {
      clientName: string;
      clientPhone: string;
      clientAddress: string;
      notes?: string;
      catalogItemId: string;
      catalogItemTitle: string;
      catalogNumber?: number;
      category: RoomCategory;
      dimensions: DimensionsCm;
      carcassMaterial: CarcassMaterial;
      facadeMaterial: FacadeMaterial;
      hardwareBrand: HardwareBrand;
      extras?: ExtraDetails;
      roomImage: string;
      furnitureImage: string;
      aiRenderImage?: string;
      placedBox: PlacedFurnitureBox;
      customCuttingParts?: CuttingPart[];
      totalPriceOverride?: number;
    };

    if (!body.clientName?.trim() || !body.clientPhone?.trim() || !body.clientAddress?.trim()) {
      res.status(400).json({
        error: "Iltimos, ism, telefon raqami (+998) va manzilni to'liq kiriting.",
      });
      return;
    }

    const cleanDimensions: DimensionsCm = {
      widthCm: Math.max(60, Math.min(900, Math.round(Number(body.dimensions?.widthCm) || 240))),
      heightCm: Math.max(80, Math.min(420, Math.round(Number(body.dimensions?.heightCm) || 210))),
      depthCm: Math.max(30, Math.min(140, Math.round(Number(body.dimensions?.depthCm) || 60))),
    };

    const extras = body.extras ?? DEFAULT_EXTRAS;
    const quote = calculateFurnitureQuote({
      category: body.category,
      dimensions: cleanDimensions,
      carcassMaterial: body.carcassMaterial,
      facadeMaterial: body.facadeMaterial,
      hardwareBrand: body.hardwareBrand,
      extras,
      pricing: db.pricing,
    });

    const trackingId = `#MP-${db.nextOrderNumber}`;
    db.nextOrderNumber += 1;

    const finalCuttingParts =
      Array.isArray(body.customCuttingParts) && body.customCuttingParts.length > 0
        ? body.customCuttingParts
        : quote.cuttingParts;

    const finalPrice =
      typeof body.totalPriceOverride === 'number' && body.totalPriceOverride > 0
        ? body.totalPriceOverride
        : quote.totalPrice;

    const matchedCatalog = db.catalog.find((c) => c.id === body.catalogItemId);
    const resolvedCatalogNumber =
      typeof body.catalogNumber === 'number' && body.catalogNumber > 0
        ? body.catalogNumber
        : matchedCatalog?.catalogNumber;

    const newOrder: FurnitureOrder = {
      id: trackingId,
      createdAt: new Date().toISOString(),
      clientName: body.clientName.trim(),
      clientPhone: body.clientPhone.trim(),
      clientAddress: body.clientAddress.trim(),
      notes: (body.notes ?? '').trim(),
      catalogItemId: body.catalogItemId,
      catalogItemTitle: body.catalogItemTitle,
      catalogNumber: resolvedCatalogNumber,
      category: body.category,
      dimensions: cleanDimensions,
      carcassMaterial: body.carcassMaterial,
      facadeMaterial: body.facadeMaterial,
      hardwareBrand: body.hardwareBrand,
      extras,
      roomImage: body.roomImage,
      furnitureImage: body.furnitureImage,
      aiRenderImage: body.aiRenderImage,
      placedBox: body.placedBox,
      totalPrice: finalPrice,
      productionDaysLabel: quote.productionDaysLabel,
      cuttingParts: finalCuttingParts,
      hardwareChecklist: quote.hardwareChecklist,
      sheetSize: body.facadeMaterial === 'Rossiya LDSP' ? '2750x1830' : '2800x2070',
      status: 'Yangi',
    };

    db.orders.unshift(newOrder);
    saveDatabase(db);
    res.status(201).json({ order: newOrder });
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    const db = loadDatabase();
    const rawId = decodeURIComponent(req.params.id);
    const normalizedId = rawId.startsWith('#') ? rawId : `#${rawId}`;
    const { status, sendNotification } = req.body as {
      status?: OrderStatus;
      sendNotification?: boolean;
    };

    const order = db.orders.find((o) => o.id === normalizedId);
    if (!order) {
      res.status(404).json({ error: 'Buyurtma topilmadi.' });
      return;
    }

    if (status) {
      order.status = status;
    }
    if (sendNotification) {
      if (!order.loyaltyCouponCode) {
        const suffix = order.id.replace('#MP-', '');
        order.loyaltyCouponCode = `MP10-${suffix}`;
      }
      order.notificationSentAt = new Date().toISOString();
    }

    saveDatabase(db);
    res.json({ order });
  });

  app.patch('/api/orders/:id/cutting-parts', (req, res) => {
    const db = loadDatabase();
    const rawId = decodeURIComponent(req.params.id);
    const normalizedId = rawId.startsWith('#') ? rawId : `#${rawId}`;
    const { cuttingParts, sheetSize } = req.body as {
      cuttingParts?: CuttingPart[];
      sheetSize?: SheetSizeKey;
    };

    const order = db.orders.find((o) => o.id === normalizedId);
    if (!order) {
      res.status(404).json({ error: 'Buyurtma topilmadi.' });
      return;
    }

    if (Array.isArray(cuttingParts)) {
      order.cuttingParts = cuttingParts;
    }
    if (sheetSize === '2750x1830' || sheetSize === '2800x2070') {
      order.sheetSize = sheetSize;
    }

    saveDatabase(db);
    res.json({ order });
  });

  /**
   * Room Analysis & AI Recommendation using gemini-2.5-flash
   * With 3 retries (2s delay) + built-in smart fallback so raw JSON 503 errors never appear.
   */
  app.post('/api/ai/recommend-furniture', async (req, res) => {
    const { roomImage } = req.body as { roomImage?: string };
    const db = loadDatabase();

    const ai = getGeminiClient();
    const resolved = resolveImageInputToInlineData(roomImage ?? '');

    if (!ai || !resolved) {
      res.json(buildSmartFallbackRecommendation(db.catalog, roomImage));
      return;
    }

    const catalogSummary = db.catalog.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      defaultDimensions: c.defaultDimensions,
      materials: `${c.carcassMaterial} + ${c.facadeMaterial}`,
    }));

    try {
      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    data: resolved.data,
                    mimeType: resolved.mimeType,
                  },
                },
                {
                  text: `Analyze this empty room photo (wall geometry, plumbing/outlets, floor tone, natural lighting, interior style) and recommend the 2 best-fitting furniture models from this catalog: ${JSON.stringify(catalogSummary)}. Reply in natural Uzbek.`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  roomSummaryUz: { type: Type.STRING },
                  detectedStyle: { type: Type.STRING },
                  lightingNoteUz: { type: Type.STRING },
                  recommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        catalogItemId: { type: Type.STRING },
                        reasonUz: { type: Type.STRING },
                        fitScoreLabel: { type: Type.STRING },
                        suggestedDimensions: {
                          type: Type.OBJECT,
                          properties: {
                            widthCm: { type: Type.INTEGER },
                            heightCm: { type: Type.INTEGER },
                            depthCm: { type: Type.INTEGER },
                          },
                          required: ['widthCm', 'heightCm', 'depthCm'],
                        },
                      },
                      required: ['catalogItemId', 'reasonUz', 'fitScoreLabel', 'suggestedDimensions'],
                    },
                  },
                },
                required: ['roomSummaryUz', 'detectedStyle', 'lightingNoteUz', 'recommendations'],
              },
            },
          }),
        3,
        2000,
      );

      const rawText = (response.text ?? '{}')
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      const parsed = JSON.parse(rawText) as Partial<AIRoomAnalysisResponse>;

      if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
        res.json(buildSmartFallbackRecommendation(db.catalog, roomImage));
        return;
      }

      res.json({
        roomSummaryUz: parsed.roomSummaryUz || "Xona bo'sh devori mebel o'rnatish uchun qulay.",
        detectedStyle: parsed.detectedStyle || 'Modern',
        lightingNoteUz: parsed.lightingNoteUz || "Tabiiy yorug'lik mebel rangini ochiq ko'rsatadi.",
        recommendations: parsed.recommendations,
        isFallback: false,
      });
    } catch (err: unknown) {
      console.warn('Gemini recommend-furniture fell back after retries:', err);
      // Graceful smart fallback so raw 503 JSON errors NEVER appear on screen
      res.json(buildSmartFallbackRecommendation(db.catalog, roomImage));
    }
  });

  /**
   * Photorealistic Placement Render using gemini-2.5-flash-image with 3 retries (2s delay)
   */
  app.post('/api/ai/generate-furniture', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "AI kaliti sozlanmagan. Hozircha interaktiv joylashtirish rejimidan foydalaning.",
      });
      return;
    }

    const {
      roomImage,
      furnitureImage,
      furnitureTitle,
      category,
      dimensions,
      carcassMaterial,
      facadeMaterial,
      extras,
      placedBox,
    } = req.body as {
      roomImage: string;
      furnitureImage?: string;
      furnitureTitle?: string;
      category: RoomCategory;
      dimensions: DimensionsCm;
      carcassMaterial: CarcassMaterial;
      facadeMaterial: FacadeMaterial;
      extras?: ExtraDetails;
      placedBox?: PlacedFurnitureBox;
    };

    const resolvedRoom = resolveImageInputToInlineData(roomImage);
    if (!resolvedRoom) {
      res.status(400).json({ error: "Xona rasmi topilmadi." });
      return;
    }
    const resolvedFurn = furnitureImage ? resolveImageInputToInlineData(furnitureImage) : null;

    const extraNotes: string[] = [];
    if (extras?.ledLighting) extraNotes.push('warm integrated LED strip lighting');
    if ((extras?.glassDoors ?? 0) > 0) extraNotes.push(`${extras?.glassDoors} smoked glass doors`);
    if ((extras?.drawers ?? 0) > 0) extraNotes.push(`${extras?.drawers} soft-close drawers`);
    if ((extras?.extraShelves ?? 0) > 0) extraNotes.push(`${extras?.extraShelves} accent shelves`);

    const placementDesc = placedBox
      ? `Position the furniture around horizontal ${Math.round(placedBox.xPercent)}% and vertical ${Math.round(placedBox.yPercent)}% of the wall, spanning roughly ${Math.round(placedBox.widthPercent)}% width.`
      : '';

    const promptText = [
      `Install the custom ${category} furniture model ("${furnitureTitle || category}") seamlessly into the empty room photograph.`,
      `Strictly preserve the original room's walls, ceiling, window, floor material, camera perspective, and natural daylight.`,
      `Exact dimensions: ${dimensions.widthCm} cm wide x ${dimensions.heightCm} cm tall x ${dimensions.depthCm} cm deep.`,
      `Materials: ${carcassMaterial} body with ${facadeMaterial} front panels.${extraNotes.length > 0 ? ` Include: ${extraNotes.join(', ')}.` : ''}`,
      placementDesc,
      `Photorealistic bespoke carpentry photography, realistic ambient shadows, no text or overlays.`,
    ].join(' ');

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { inlineData: { data: resolvedRoom.data, mimeType: resolvedRoom.mimeType } },
    ];
    if (resolvedFurn) {
      parts.push({ inlineData: { data: resolvedFurn.data, mimeType: resolvedFurn.mimeType } });
    }
    parts.push({ text: promptText });

    try {
      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
          }),
        3,
        2000,
      );

      let imageDataUrl: string | null = null;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageDataUrl) {
        res.status(502).json({ error: "AI rasm qaytarmadi. Qayta urinib ko'ring." });
        return;
      }

      res.json({ imageDataUrl, modelUsed: 'gemini-2.5-flash-image' });
    } catch (err: unknown) {
      console.error('Gemini furniture render error:', err);
      res.status(503).json({ error: formatFriendlyUzError(err) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RSM CUT server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
