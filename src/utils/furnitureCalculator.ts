import type {
  CarcassMaterial,
  CuttingPart,
  DimensionsCm,
  ExtraDetails,
  FacadeMaterial,
  FurnitureArchetype,
  HardwareBrand,
  MaterialPricing,
  QuoteBreakdown,
  RoomCategory,
} from '../types.ts';

export const DEFAULT_MATERIAL_PRICING: MaterialPricing = {
  ldspPerSqm: 185000,
  mdfPerSqm: 310000,
  acrylicPerSqm: 440000,
  veneerPerSqm: 540000,
  countertopPerM: 850000,
  edgeBandingPerM: 8500,
  hardwareBoyard: 950000,
  hardwareBlum: 2450000,
  extraShelfPrice: 150000,
  extraDrawerPrice: 220000,
  extraGlassDoorPrice: 350000,
  extraLedPrice: 180000,
  laborPercent: 32,
};

export const DEFAULT_EXTRAS: ExtraDetails = {
  extraShelves: 0,
  drawers: 0,
  glassDoors: 0,
  ledLighting: false,
};

export const CARCASS_MATERIALS: CarcassMaterial[] = ['Rossiya LDSP', 'Turkiya MDF'];
export const FACADE_MATERIALS: FacadeMaterial[] = [
  'Rossiya LDSP',
  'Turkiya MDF',
  'AGT Akril',
  'Shpon',
];
export const HARDWARE_BRANDS: HardwareBrand[] = ['Boyard', 'Blum'];

export function detectCategoryArchetype(category: string): FurnitureArchetype {
  const c = category.toLowerCase();
  if (c.includes('oshxona') || c.includes('kitchen') || c.includes('kuxn')) return 'kitchen';
  if (c.includes('tv') || c.includes('mehmon')) return 'tvzone';
  if (c.includes('yotoq') || c.includes('bedroom') || c.includes('spal')) return 'bedroom';
  if (c.includes('bola') || c.includes('kids') || c.includes('o‘quv') || c.includes("o'quv")) {
    return 'kids';
  }
  if (
    c.includes('dahliz') ||
    c.includes('prixoj') ||
    c.includes('koridor') ||
    c.includes("yo'lak") ||
    c.includes('hall')
  ) {
    return 'hallway';
  }
  if (c.includes('ofis') || c.includes('office') || c.includes('kabinet') || c.includes('ish')) {
    return 'office';
  }
  return 'wardrobe';
}

export function formatSom(amount: number): string {
  const rounded = Math.round(amount / 10000) * 10000;
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

export function formatNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getCarcassRate(mat: CarcassMaterial, pricing: MaterialPricing): number {
  return mat === 'Turkiya MDF' ? pricing.mdfPerSqm : pricing.ldspPerSqm;
}

function getFacadeRate(mat: FacadeMaterial, pricing: MaterialPricing): number {
  switch (mat) {
    case 'Rossiya LDSP':
      return pricing.ldspPerSqm;
    case 'Turkiya MDF':
      return pricing.mdfPerSqm;
    case 'AGT Akril':
      return pricing.acrylicPerSqm;
    case 'Shpon':
      return pricing.veneerPerSqm;
  }
}

function roundTenThousand(val: number): number {
  return Math.max(100000, Math.round(val / 10000) * 10000);
}

export function calculateFurnitureQuote(params: {
  category: RoomCategory;
  dimensions: DimensionsCm;
  carcassMaterial: CarcassMaterial;
  facadeMaterial: FacadeMaterial;
  hardwareBrand: HardwareBrand;
  extras: ExtraDetails;
  pricing: MaterialPricing;
}): QuoteBreakdown {
  const {
    category,
    dimensions,
    carcassMaterial,
    facadeMaterial,
    hardwareBrand,
    extras,
    pricing,
  } = params;

  const archetype = detectCategoryArchetype(category);

  const wMm = Math.max(600, Math.round(dimensions.widthCm * 10));
  const hMm = Math.max(800, Math.round(dimensions.heightCm * 10));
  const dMm = Math.max(300, Math.round(dimensions.depthCm * 10));

  const wM = wMm / 1000;
  const hM = hMm / 1000;
  const dM = dMm / 1000;

  const sections = Math.max(2, Math.round(dimensions.widthCm / 60));
  const sectionW = Math.round(wMm / sections);
  const cuttingParts: CuttingPart[] = [];

  if (archetype === 'kitchen') {
    const upperH = Math.min(1050, Math.max(650, Math.round(hMm * 0.35)));
    const lowerH = 740;
    const upperD = 340;
    const lowerD = Math.max(500, dMm - 40);

    cuttingParts.push(
      {
        id: 'k-upper-side',
        name: 'Yuqori shkaf yon devor',
        lengthMm: upperH,
        widthMm: upperD,
        qty: sections + 1,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun + 2 qisqa',
        role: 'carcass',
      },
      {
        id: 'k-upper-horiz',
        name: 'Yuqori shkaf gorizontal',
        lengthMm: sectionW - 32,
        widthMm: upperD - 18,
        qty: sections * 2 + 2,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'carcass',
      },
      {
        id: 'k-upper-door',
        name: 'Yuqori fasad eshik',
        lengthMm: upperH - 4,
        widthMm: sectionW - 4,
        qty: sections,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'facade',
      },
      {
        id: 'k-lower-side',
        name: 'Pastki tumba yon devor',
        lengthMm: lowerH,
        widthMm: lowerD,
        qty: sections + 1,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'carcass',
      },
      {
        id: 'k-lower-base',
        name: 'Pastki asos (Dno) va reyka',
        lengthMm: sectionW - 32,
        widthMm: lowerD,
        qty: sections * 2,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'carcass',
      },
      {
        id: 'k-lower-door',
        name: 'Pastki fasad eshik',
        lengthMm: lowerH - 6,
        widthMm: sectionW - 4,
        qty: sections,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'facade',
      },
    );
  } else if (archetype === 'wardrobe' || archetype === 'bedroom') {
    const innerDepth = Math.max(420, dMm - 80);
    const doorCount = Math.max(2, Math.min(5, Math.round(dimensions.widthCm / 75)));
    const doorW = Math.round(wMm / doorCount);

    cuttingParts.push(
      {
        id: 'w-side',
        name: 'Shkaf yon va ichki tosiq',
        lengthMm: Math.min(2720, hMm),
        widthMm: dMm,
        qty: doorCount + 1,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun (2mm)',
        role: 'carcass',
      },
      {
        id: 'w-topbot',
        name: 'Shkaf ustki va pastki qopqoq',
        lengthMm: Math.min(2720, wMm - 32),
        widthMm: dMm,
        qty: 2,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'carcass',
      },
      {
        id: 'w-shelf',
        name: 'Kiyim javon (Polka)',
        lengthMm: doorW - 24,
        widthMm: innerDepth,
        qty: doorCount * 3,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'shelf',
      },
      {
        id: 'w-door',
        name: archetype === 'wardrobe' ? 'Kupe / Fasad eshik' : 'Garderob fasad eshigi',
        lengthMm: Math.min(2720, hMm - 30),
        widthMm: doorW - 4,
        qty: doorCount,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'facade',
      },
    );
  } else if (archetype === 'tvzone') {
    const consoleW = Math.min(2720, Math.round(wMm * 0.85));
    const drawerPanels = Math.max(3, Math.round(dimensions.widthCm / 75));
    const backPanels = Math.max(2, Math.round(dimensions.widthCm / 80));

    cuttingParts.push(
      {
        id: 'tv-back',
        name: 'TV fon paneli (Reyka asosi)',
        lengthMm: Math.min(2500, Math.round(hMm * 0.72)),
        widthMm: Math.round(wMm / backPanels),
        qty: backPanels,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'facade',
      },
      {
        id: 'tv-console-top',
        name: 'Osma tumba ust va osti',
        lengthMm: consoleW,
        widthMm: dMm,
        qty: 2,
        material: facadeMaterial,
        edgeBandingSides: '3 tomonlama',
        role: 'facade',
      },
      {
        id: 'tv-console-side',
        name: 'Tumba yon va oraliq tosiq',
        lengthMm: 380,
        widthMm: dMm - 20,
        qty: drawerPanels + 1,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'carcass',
      },
      {
        id: 'tv-drawer-front',
        name: 'Tumba fasad qopqog‘i',
        lengthMm: Math.round(consoleW / drawerPanels) - 4,
        widthMm: 376,
        qty: drawerPanels,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'facade',
      },
    );
  } else {
    // kids / hallway / office modular system
    const unitDoors = Math.max(2, Math.min(4, Math.round(dimensions.widthCm / 70)));
    const shelfQty = archetype === 'office' || archetype === 'kids' ? 8 : 5;
    const drawerQty = archetype === 'hallway' ? 3 : 4;
    cuttingParts.push(
      {
        id: 'm-side',
        name: 'Asosiy yon va oraliq devor',
        lengthMm: Math.min(2720, hMm),
        widthMm: dMm,
        qty: 4,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun (2mm)',
        role: 'carcass',
      },
      {
        id: 'm-board',
        name: 'Ustki qopqoq, stol/o‘rindiq va taglik',
        lengthMm: Math.min(2400, Math.round(wMm * 0.48)),
        widthMm: dMm,
        qty: 4,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'carcass',
      },
      {
        id: 'm-shelf',
        name: 'Kitob / Poyabzal polkasi',
        lengthMm: Math.max(420, Math.round(wMm / 3.4)),
        widthMm: Math.max(300, dMm - 40),
        qty: shelfQty,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'shelf',
      },
      {
        id: 'm-door',
        name: 'Fasad eshik',
        lengthMm: Math.min(2400, Math.round(hMm * 0.78)),
        widthMm: Math.max(360, Math.round((wMm * 0.45) / unitDoors)),
        qty: unitDoors,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'facade',
      },
      {
        id: 'm-drawer',
        name: 'Tortma fasadi',
        lengthMm: Math.max(380, Math.round(wMm * 0.28)),
        widthMm: 185,
        qty: drawerQty,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'drawer',
      },
    );
  }

  // Extra Details added dynamically by user/maker
  if (extras.extraShelves > 0) {
    cuttingParts.push({
      id: 'extra-shelf',
      name: "Qo'shimcha polka",
      lengthMm: Math.max(400, sectionW - 32),
      widthMm: Math.max(320, dMm - 80),
      qty: extras.extraShelves,
      material: carcassMaterial,
      edgeBandingSides: '1 uzun',
      role: 'shelf',
    });
  }

  if (extras.drawers > 0) {
    cuttingParts.push(
      {
        id: 'extra-drawer-box',
        name: "Qo'shimcha tortma qutisi",
        lengthMm: Math.max(380, dMm - 100),
        widthMm: 160,
        qty: extras.drawers * 2,
        material: carcassMaterial,
        edgeBandingSides: '1 uzun',
        role: 'drawer',
      },
      {
        id: 'extra-drawer-front',
        name: "Qo'shimcha tortma old fasadi",
        lengthMm: Math.max(400, sectionW - 6),
        widthMm: 190,
        qty: extras.drawers,
        material: facadeMaterial,
        edgeBandingSides: '4 tomonlama',
        role: 'facade',
      },
    );
  }

  if (extras.glassDoors > 0) {
    cuttingParts.push({
      id: 'extra-glass-frame',
      name: 'Shisha eshik ramkasi (Alyuminiy/MDF)',
      lengthMm: Math.min(2200, Math.round(hMm * 0.6)),
      widthMm: Math.max(380, sectionW - 4),
      qty: extras.glassDoors,
      material: 'Shisha + Alyuminiy profil',
      edgeBandingSides: '4 tomonlama',
      role: 'facade',
    });
  }

  // Compute sheet areas separately for Carcass vs Facade
  let carcassSqm = 0;
  let facadeSqm = 0;
  let edgeMm = 0;

  for (const part of cuttingParts) {
    const pieceSqm = (part.lengthMm / 1000) * (part.widthMm / 1000) * part.qty;
    if (part.role === 'facade') {
      facadeSqm += pieceSqm;
    } else {
      carcassSqm += pieceSqm;
    }
    const sides = part.edgeBandingSides;
    const perMm = sides.includes('4')
      ? 2 * (part.lengthMm + part.widthMm)
      : sides.includes('3')
        ? 2 * part.lengthMm + part.widthMm
        : part.lengthMm;
    edgeMm += perMm * part.qty;
  }

  const sheetAreaSqm = Number(((carcassSqm + facadeSqm) * 1.12).toFixed(1));
  const edgeBandingM = Math.round(edgeMm / 1000);

  const carcassCost = carcassSqm * 1.12 * getCarcassRate(carcassMaterial, pricing);
  const facadeCost = facadeSqm * 1.12 * getFacadeRate(facadeMaterial, pricing);
  const countertopCost = archetype === 'kitchen' ? wM * pricing.countertopPerM : 0;
  const edgeCost = edgeBandingM * pricing.edgeBandingPerM;

  const baseStructureRaw = carcassCost + facadeCost + countertopCost + edgeCost;

  const hardwareBase =
    hardwareBrand === 'Blum' ? pricing.hardwareBlum : pricing.hardwareBoyard;
  const sizeHardwareScale = Math.max(0.8, (wM * hM) / 6.8 + dM * 0.15);
  const hardwarePrice = roundTenThousand(hardwareBase * sizeHardwareScale);

  const extrasPrice =
    extras.extraShelves * pricing.extraShelfPrice +
    extras.drawers * pricing.extraDrawerPrice +
    extras.glassDoors * pricing.extraGlassDoorPrice +
    (extras.ledLighting ? pricing.extraLedPrice : 0);

  const laborPrice = Math.round(
    (baseStructureRaw + hardwarePrice * 0.45) * (pricing.laborPercent / 100),
  );
  const totalPrice = roundTenThousand(
    baseStructureRaw + hardwarePrice + extrasPrice + laborPrice,
  );

  const hardwareChecklist: string[] = [
    `${sections * 2} dona ilgak (${hardwareBrand} yumshoq yopqich)`,
    `${Math.max(2, sections - 1) + extras.drawers} to'plam tortma yo'naltirgichi (${hardwareBrand})`,
    ...(archetype === 'kitchen' ? [`Stoleshnitsa (${wM.toFixed(1)} m) va suv o'tkazmas plintus`] : []),
    ...(archetype === 'wardrobe' ? [`Kupe rels va g'ildirak tizimi (${wM.toFixed(1)} m)`] : []),
    ...(extras.glassDoors > 0 ? [`${extras.glassDoors} dona toblangan qora/shaffof shisha eshik`] : []),
    ...(extras.ledLighting ? [`LED profil yoritish (${wM.toFixed(1)} m) va sensorli blok`] : []),
  ];

  const productionDaysLabel =
    hardwareBrand === 'Blum' || facadeMaterial === 'Shpon' || facadeMaterial === 'AGT Akril'
      ? '12–16 kun'
      : '8–12 kun';

  return {
    totalPrice,
    baseStructurePrice: roundTenThousand(baseStructureRaw),
    extrasPrice,
    hardwarePrice,
    laborPrice: roundTenThousand(laborPrice),
    sheetAreaSqm,
    edgeBandingM,
    productionDaysLabel,
    cuttingParts,
    hardwareChecklist,
  };
}
