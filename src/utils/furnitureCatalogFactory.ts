import type {
  CarcassMaterial,
  CatalogItem,
  DimensionsCm,
  FacadeMaterial,
  FurnitureArchetype,
  FurnitureFinishPalette,
  FurnitureLayoutVariant,
  FurnitureStyleTag,
  HardwareBrand,
  MaterialPricing,
  RoomCategory,
} from '../types.ts';
import {
  calculateFurnitureQuote,
  DEFAULT_EXTRAS,
  DEFAULT_MATERIAL_PRICING,
  detectCategoryArchetype,
} from './furnitureCalculator.ts';

export const CURATED_STUDIO_PHOTOS = {
  kitchenModern: '/src/assets/images/catalog_kitchen_modern_1795689530411.jpg',
  kitchenEmeraldGold: '/src/assets/images/catalog_kitchen_emerald_gold_1795696022518.jpg',
  wardrobeKupe: '/src/assets/images/catalog_wardrobe_kupe_1795689531221.jpg',
  wardrobeWalnutGlass: '/src/assets/images/catalog_wardrobe_walnut_glass_1795696022745.jpg',
  tvzoneHitech: '/src/assets/images/catalog_tvzone_hitech_1795689531427.jpg',
  bedroomCashmere: '/src/assets/images/catalog_bedroom_set_1795689533022.jpg',
  kidsRoom: '/src/assets/images/catalog_kids_room_set_1795696022389.jpg',
  hallwayPrixojka: '/src/assets/images/catalog_hallway_prixojka_1795696023265.jpg',
  officeExecutive: '/src/assets/images/catalog_office_executive_1795696023807.jpg',
} as const;

export interface FinishPreset {
  finishLabel: string;
  styleTag: FurnitureStyleTag;
  carcassMaterial: CarcassMaterial;
  facadeMaterial: FacadeMaterial;
  hardwareBrand: HardwareBrand;
  palette: FurnitureFinishPalette;
}

export const LUXURY_FINISH_PRESETS: FinishPreset[] = [
  {
    finishLabel: 'Zumrad & Tilla',
    styleTag: 'Neoklassika',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'Turkiya MDF',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#0E3A2F',
      facadeHex: '#114436',
      accentHex: '#7A5234',
      handleHex: '#D4AF37',
      countertopHex: '#F3EFE6',
      glassHex: '#18382F',
      frameHex: '#D4AF37',
    },
  },
  {
    finishLabel: 'Antratsit & Eman',
    styleTag: 'Modern',
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'Turkiya MDF',
    hardwareBrand: 'Boyard',
    palette: {
      carcassHex: '#2F3237',
      facadeHex: '#2F3237',
      accentHex: '#A67B5B',
      handleHex: '#18191C',
      countertopHex: '#F4F6F8',
      glassHex: '#25292E',
      frameHex: '#1F2226',
    },
  },
  {
    finishLabel: "Yong'oq Shpon",
    styleTag: 'Neoklassika',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'Shpon',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#4E3321',
      facadeHex: '#6E4A30',
      accentHex: '#8C5E3C',
      handleHex: '#D4AF37',
      countertopHex: '#EAE2D3',
      glassHex: '#2C241E',
      frameHex: '#3A2316',
    },
  },
  {
    finishLabel: 'Oq Glyants',
    styleTag: 'Hi-Tech',
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'AGT Akril',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#E8ECEF',
      facadeHex: '#F5F7FA',
      accentHex: '#B69471',
      handleHex: '#2A2E35',
      countertopHex: '#DCDFE4',
      glassHex: '#334155',
      frameHex: '#2A2E35',
    },
  },
  {
    finishLabel: 'Kashmir Mat',
    styleTag: 'Minimalizm',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'AGT Akril',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#BFB4A8',
      facadeHex: '#C9BFB4',
      accentHex: '#A68868',
      handleHex: '#C5A56A',
      countertopHex: '#F2ECE3',
      glassHex: '#3B3631',
      frameHex: '#3B3631',
    },
  },
  {
    finishLabel: 'Loft Grafit',
    styleTag: 'Loft',
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'Rossiya LDSP',
    hardwareBrand: 'Boyard',
    palette: {
      carcassHex: '#1F2226',
      facadeHex: '#3A3E45',
      accentHex: '#8C5E3C',
      handleHex: '#141518',
      countertopHex: '#52565B',
      glassHex: '#1E2228',
      frameHex: '#181A1D',
    },
  },
  {
    finishLabel: 'Tungi Zumrad & Yong‘oq',
    styleTag: 'Modern',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'Shpon',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#0A2E25',
      facadeHex: '#144D3E',
      accentHex: '#6E4A30',
      handleHex: '#D4AF37',
      countertopHex: '#ECE6DB',
      glassHex: '#152F28',
      frameHex: '#23150D',
    },
  },
  {
    finishLabel: 'Filsuyagi & Tilla',
    styleTag: 'Neoklassika',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'Turkiya MDF',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#DDD3C3',
      facadeHex: '#EFE8DB',
      accentHex: '#9C7B58',
      handleHex: '#C5A059',
      countertopHex: '#FAF7F0',
      glassHex: '#463C31',
      frameHex: '#C5A059',
    },
  },
  {
    finishLabel: 'Qumrang & Qora Profil',
    styleTag: 'Minimalizm',
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'Turkiya MDF',
    hardwareBrand: 'Boyard',
    palette: {
      carcassHex: '#1F2226',
      facadeHex: '#C4B199',
      accentHex: '#A68868',
      handleHex: '#1F2226',
      countertopHex: '#ECE7DF',
      glassHex: '#2C2824',
      frameHex: '#1F2226',
    },
  },
  {
    finishLabel: 'Tabiiy Eman & Krem',
    styleTag: 'Modern',
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'Turkiya MDF',
    hardwareBrand: 'Boyard',
    palette: {
      carcassHex: '#B6895E',
      facadeHex: '#E8DFD2',
      accentHex: '#B6895E',
      handleHex: '#8C6239',
      countertopHex: '#F4F0E8',
      glassHex: '#42392F',
      frameHex: '#8C6239',
    },
  },
  {
    finishLabel: 'Zaytun & Shpon',
    styleTag: 'Modern',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'Shpon',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#2C4239',
      facadeHex: '#3B564B',
      accentHex: '#7A5234',
      handleHex: '#D4AF37',
      countertopHex: '#EAE6DF',
      glassHex: '#1F3029',
      frameHex: '#2B221B',
    },
  },
  {
    finishLabel: 'Buzrang Kulrang Akril',
    styleTag: 'Hi-Tech',
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'AGT Akril',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#525860',
      facadeHex: '#8C949E',
      accentHex: '#A67B5B',
      handleHex: '#1E242B',
      countertopHex: '#F3F4F6',
      glassHex: '#1F262E',
      frameHex: '#1E242B',
    },
  },
  {
    finishLabel: 'Mokko & Bronza Shisha',
    styleTag: 'Minimalizm',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'AGT Akril',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#4B3A30',
      facadeHex: '#6F584A',
      accentHex: '#A88972',
      handleHex: '#D4AF37',
      countertopHex: '#EFEAE3',
      glassHex: '#362921',
      frameHex: '#3B2C22',
    },
  },
  {
    finishLabel: 'Qora Mat & Tilla Chiziq',
    styleTag: 'Hi-Tech',
    carcassMaterial: 'Turkiya MDF',
    facadeMaterial: 'AGT Akril',
    hardwareBrand: 'Blum',
    palette: {
      carcassHex: '#181B1F',
      facadeHex: '#22262C',
      accentHex: '#6E4A30',
      handleHex: '#D4AF37',
      countertopHex: '#D5D8DC',
      glassHex: '#14171A',
      frameHex: '#D4AF37',
    },
  },
  {
    finishLabel: 'Samarqand Klassik Yong‘oq',
    styleTag: 'Loft',
    carcassMaterial: 'Rossiya LDSP',
    facadeMaterial: 'Shpon',
    hardwareBrand: 'Boyard',
    palette: {
      carcassHex: '#3A2316',
      facadeHex: '#5C3A21',
      accentHex: '#9C724E',
      handleHex: '#C5A059',
      countertopHex: '#E8E0D4',
      glassHex: '#281C14',
      frameHex: '#23150D',
    },
  },
];

function sanitizeHex(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

/**
 * Generates a studio-lit, 100% transparent-background architectural elevation SVG data URL
 * so every style, finish, and custom category model has a crisp isolated preview image.
 */
export function buildFurniturePreviewSvg(params: {
  archetype: FurnitureArchetype;
  styleTag: FurnitureStyleTag;
  palette: FurnitureFinishPalette;
  layoutVariant?: FurnitureLayoutVariant;
}): string {
  const { archetype, styleTag, palette, layoutVariant } = params;
  const carcass = sanitizeHex(palette.carcassHex, '#2F3237');
  const facade = sanitizeHex(palette.facadeHex, '#2F3237');
  const accent = sanitizeHex(palette.accentHex, '#8C5E3C');
  const handle = sanitizeHex(palette.handleHex, '#D4AF37');
  const counter = sanitizeHex(palette.countertopHex, '#F2EFE8');
  const glass = sanitizeHex(palette.glassHex, '#1F2933');
  const frame = sanitizeHex(palette.frameHex, '#1F2226');

  const isNeoclassic = styleTag === 'Neoklassika';
  const isHiTech = styleTag === 'Hi-Tech';

  const defs = `
    <defs>
      <linearGradient id="fg" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="${facade}" stop-opacity="1"/>
        <stop offset="55%" stop-color="${facade}" stop-opacity="0.96"/>
        <stop offset="100%" stop-color="${carcass}" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}"/>
        <stop offset="100%" stop-color="${carcass}"/>
      </linearGradient>
      <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${glass}" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${glass}" stop-opacity="0.92"/>
      </linearGradient>
      <filter id="sh" x="-8%" y="-8%" width="116%" height="120%">
        <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#040d0a" flood-opacity="0.45"/>
      </filter>
    </defs>
  `;

  let bodySvg = '';

  if (archetype === 'kitchen') {
    const cols = Math.max(4, Math.min(6, layoutVariant?.doorsCount ?? 6));
    const x0 = 60;
    const w = 680;
    const colW = w / cols;
    const uY = 48;
    const uH = 192;
    const bY = 352;
    const bH = 200;

    let upperDoors = '';
    for (let i = 0; i < cols; i++) {
      const dx = x0 + i * colW + 2;
      const dw = colW - 4;
      const isCenterNiche = layoutVariant?.hasOpenNiche !== false && i >= 1 && i <= cols - 2;
      const dh = isCenterNiche ? uH - 68 : uH - 8;
      upperDoors += `<rect x="${dx}" y="${uY + 4}" width="${dw}" height="${dh}" rx="2" fill="url(#fg)" stroke="#00000040" stroke-width="1.5"/>`;
      if (isNeoclassic) {
        upperDoors += `<rect x="${dx + 10}" y="${uY + 14}" width="${dw - 20}" height="${dh - 20}" fill="none" stroke="${handle}" stroke-opacity="0.45" stroke-width="1.2"/>`;
      }
      if (!isHiTech) {
        const hx = i % 2 === 0 ? dx + dw - 12 : dx + 9;
        upperDoors += `<rect x="${hx}" y="${uY + dh - 44}" width="3.5" height="28" rx="1.5" fill="${handle}"/>`;
      }
    }

    const nicheX = x0 + colW;
    const nicheW = w - colW * 2;
    const nicheSvg =
      layoutVariant?.hasOpenNiche !== false
        ? `<rect x="${nicheX}" y="${uY + uH - 60}" width="${nicheW}" height="56" fill="url(#ag)" stroke="#00000044" stroke-width="1.5"/>
           <line x1="${nicheX + 6}" y1="${uY + uH - 57}" x2="${nicheX + nicheW - 6}" y2="${uY + uH - 57}" stroke="#FDE68A" stroke-width="2.5" stroke-opacity="0.85"/>`
        : '';

    const lowerCols = 4;
    const lColW = w / lowerCols;
    let lowerUnits = '';
    for (let i = 0; i < lowerCols; i++) {
      const dx = x0 + i * lColW + 2;
      const dw = lColW - 4;
      lowerUnits += `<rect x="${dx}" y="${bY + 4}" width="${dw}" height="56" rx="2" fill="url(#fg)" stroke="#00000040" stroke-width="1.5"/>`;
      lowerUnits += `<rect x="${dx + dw / 2 - 22}" y="${bY + 18}" width="44" height="3.5" rx="1.5" fill="${handle}"/>`;
      lowerUnits += `<rect x="${dx}" y="${bY + 64}" width="${dw}" height="${bH - 80}" rx="2" fill="url(#fg)" stroke="#00000040" stroke-width="1.5"/>`;
      if (isNeoclassic) {
        lowerUnits += `<rect x="${dx + 10}" y="${bY + 74}" width="${dw - 20}" height="${bH - 100}" fill="none" stroke="${handle}" stroke-opacity="0.45" stroke-width="1.2"/>`;
      }
      lowerUnits += `<rect x="${dx + dw - 14}" y="${bY + 78}" width="3.5" height="34" rx="1.5" fill="${handle}"/>`;
    }

    bodySvg = `
      <g filter="url(#sh)">
        <!-- Upper Carcass & Backsplash -->
        <rect x="${x0}" y="${uY}" width="${w}" height="${uH}" rx="4" fill="${carcass}"/>
        <rect x="${x0 + 4}" y="${uY + uH}" width="${w - 8}" height="${bY - (uY + uH) - 14}" fill="${counter}" fill-opacity="0.9"/>
        ${upperDoors}
        ${nicheSvg}
        <!-- Quartz Countertop -->
        <rect x="${x0 - 4}" y="${bY - 16}" width="${w + 8}" height="16" rx="2" fill="${counter}" stroke="#00000025" stroke-width="1"/>
        <!-- Lower Carcass & Plinth -->
        <rect x="${x0}" y="${bY}" width="${w}" height="${bH}" rx="3" fill="${carcass}"/>
        ${lowerUnits}
        <rect x="${x0 + 6}" y="${bY + bH - 14}" width="${w - 12}" height="14" fill="${carcass}"/>
      </g>`;
  } else if (archetype === 'wardrobe' || archetype === 'bedroom') {
    const isBedroom = archetype === 'bedroom';
    const x0 = isBedroom ? 74 : 110;
    const totalW = isBedroom ? 652 : 580;
    const mainW = isBedroom ? 510 : totalW;
    const doors = Math.max(3, Math.min(5, layoutVariant?.doorsCount ?? (isBedroom ? 5 : 4)));
    const doorW = mainW / doors;
    const y0 = 42;
    const h = 514;

    let doorSvgs = '';
    for (let i = 0; i < doors; i++) {
      const dx = x0 + 8 + i * ((mainW - 16) / doors);
      const dw = (mainW - 16) / doors - 4;
      const isGlassDoor = layoutVariant?.hasVitrine !== false && !isBedroom && (i === 0 || i === doors - 1);
      if (isGlassDoor) {
        doorSvgs += `
          <rect x="${dx}" y="${y0 + 8}" width="${dw}" height="${h - 28}" fill="url(#ag)"/>
          <line x1="${dx + 8}" y1="${y0 + 130}" x2="${dx + dw - 8}" y2="${y0 + 130}" stroke="${accent}" stroke-width="4"/>
          <line x1="${dx + 8}" y1="${y0 + 260}" x2="${dx + dw - 8}" y2="${y0 + 260}" stroke="${accent}" stroke-width="4"/>
          <line x1="${dx + 8}" y1="${y0 + 380}" x2="${dx + dw - 8}" y2="${y0 + 380}" stroke="${accent}" stroke-width="4"/>
          <rect x="${dx}" y="${y0 + 8}" width="${dw}" height="${h - 28}" fill="url(#gl)" stroke="${frame}" stroke-width="5"/>`;
      } else {
        doorSvgs += `<rect x="${dx}" y="${y0 + 8}" width="${dw}" height="${h - 28}" rx="2" fill="url(#fg)" stroke="${frame}" stroke-width="2"/>`;
        if (isNeoclassic) {
          doorSvgs += `<rect x="${dx + 10}" y="${y0 + 22}" width="${dw - 20}" height="${h - 56}" fill="none" stroke="${handle}" stroke-opacity="0.5" stroke-width="1.3"/>`;
        }
      }
      const hx = i % 2 === 0 ? dx + dw - 11 : dx + 7;
      doorSvgs += `<rect x="${hx}" y="${y0 + 210}" width="4" height="84" rx="2" fill="${handle}"/>`;
    }

    const sideConsole = isBedroom
      ? `<rect x="${x0 + mainW}" y="${y0 + 20}" width="${totalW - mainW}" height="${h - 32}" fill="${accent}" fill-opacity="0.35"/>
         <rect x="${x0 + mainW}" y="${y0 + 370}" width="${totalW - mainW}" height="144" rx="3" fill="${carcass}"/>
         <rect x="${x0 + mainW + 6}" y="${y0 + 380}" width="${totalW - mainW - 12}" height="56" rx="2" fill="url(#fg)" stroke="#00000033"/>
         <rect x="${x0 + mainW + 6}" y="${y0 + 444}" width="${totalW - mainW - 12}" height="58" rx="2" fill="url(#fg)" stroke="#00000033"/>
         <rect x="${x0 + mainW + 46}" y="${y0 + 404}" width="46" height="4" rx="2" fill="${handle}"/>
         <rect x="${x0 + mainW + 46}" y="${y0 + 468}" width="46" height="4" rx="2" fill="${handle}"/>`
      : '';

    bodySvg = `
      <g filter="url(#sh)">
        <rect x="${x0}" y="${y0}" width="${mainW}" height="${h}" rx="4" fill="${carcass}" stroke="${frame}" stroke-width="2"/>
        ${doorSvgs}
        ${sideConsole}
      </g>`;
  } else if (archetype === 'tvzone') {
    const x0 = 64;
    const w = 672;
    const panelW = 500;
    const vitW = w - panelW;
    const y0 = 60;
    const h = 480;
    let slats = '';
    for (let sx = x0 + 12; sx < x0 + panelW - 12; sx += 16) {
      slats += `<line x1="${sx}" y1="${y0 + 8}" x2="${sx}" y2="${y0 + h - 135}" stroke="#00000045" stroke-width="4"/>`;
    }
    bodySvg = `
      <g filter="url(#sh)">
        <rect x="${x0}" y="${y0}" width="${panelW}" height="${h - 130}" rx="4" fill="url(#ag)"/>
        ${slats}
        <!-- LED Halo + OLED TV -->
        <rect x="${x0 + 84}" y="${y0 + 64}" width="328" height="196" rx="6" fill="#FDE68A" fill-opacity="0.35"/>
        <rect x="${x0 + 92}" y="${y0 + 72}" width="312" height="180" rx="4" fill="#10141A" stroke="#334155" stroke-width="4"/>
        <!-- Console Drawers -->
        <rect x="${x0}" y="${y0 + h - 126}" width="${panelW}" height="114" rx="3" fill="${carcass}"/>
        <rect x="${x0 + 6}" y="${y0 + h - 118}" width="${panelW / 3 - 8}" height="96" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + panelW / 3 + 3}" y="${y0 + h - 118}" width="${panelW / 3 - 8}" height="96" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + (panelW / 3) * 2}" y="${y0 + h - 118}" width="${panelW / 3 - 6}" height="96" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <!-- Tall Vitrine -->
        <rect x="${x0 + panelW}" y="${y0}" width="${vitW}" height="${h}" rx="4" fill="${carcass}" stroke="${frame}" stroke-width="2"/>
        <rect x="${x0 + panelW + 10}" y="${y0 + 12}" width="${vitW - 20}" height="${h - 24}" fill="url(#ag)"/>
        <line x1="${x0 + panelW + 14}" y1="${y0 + 130}" x2="${x0 + w - 14}" y2="${y0 + 130}" stroke="#E2E8F0" stroke-width="3"/>
        <line x1="${x0 + panelW + 14}" y1="${y0 + 250}" x2="${x0 + w - 14}" y2="${y0 + 250}" stroke="#E2E8F0" stroke-width="3"/>
        <line x1="${x0 + panelW + 14}" y1="${y0 + 370}" x2="${x0 + w - 14}" y2="${y0 + 370}" stroke="#E2E8F0" stroke-width="3"/>
        <rect x="${x0 + panelW + 10}" y="${y0 + 12}" width="${vitW - 20}" height="${h - 24}" fill="url(#gl)" stroke="${frame}" stroke-width="4"/>
        <rect x="${x0 + panelW + 18}" y="${y0 + 210}" width="4" height="58" rx="2" fill="${handle}"/>
      </g>`;
  } else if (archetype === 'kids') {
    const x0 = 66;
    const w = 668;
    const y0 = 56;
    const h = 490;
    bodySvg = `
      <g filter="url(#sh)">
        <!-- Left 2-door Wardrobe -->
        <rect x="${x0}" y="${y0}" width="210" height="${h}" rx="6" fill="${carcass}"/>
        <rect x="${x0 + 8}" y="${y0 + 10}" width="94" height="${h - 24}" rx="3" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 108}" y="${y0 + 10}" width="94" height="${h - 24}" rx="3" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 92}" y="${y0 + 220}" width="5" height="44" rx="2" fill="${handle}"/>
        <rect x="${x0 + 114}" y="${y0 + 220}" width="5" height="44" rx="2" fill="${handle}"/>
        <!-- Center Overhead Cabinet + Study Desk -->
        <rect x="${x0 + 218}" y="${y0 + 6}" width="236" height="156" rx="4" fill="${carcass}"/>
        <rect x="${x0 + 224}" y="${y0 + 12}" width="110" height="144" rx="2" fill="url(#fg)" stroke="#00000028"/>
        <rect x="${x0 + 338}" y="${y0 + 12}" width="110" height="144" rx="2" fill="url(#fg)" stroke="#00000028"/>
        <rect x="${x0 + 324}" y="${y0 + 96}" width="4" height="32" rx="2" fill="${handle}"/>
        <rect x="${x0 + 344}" y="${y0 + 96}" width="4" height="32" rx="2" fill="${handle}"/>
        <!-- Study Desk -->
        <rect x="${x0 + 214}" y="${y0 + 326}" width="244" height="18" rx="3" fill="${accent}"/>
        <rect x="${x0 + 218}" y="${y0 + 344}" width="16" height="146" fill="${carcass}"/>
        <rect x="${x0 + 370}" y="${y0 + 344}" width="84" height="84" rx="3" fill="${accent}"/>
        <rect x="${x0 + 438}" y="${y0 + 344}" width="16" height="146" fill="${carcass}"/>
        <!-- Right Open Bookshelf Tower -->
        <rect x="${x0 + 462}" y="${y0}" width="206" height="${h}" rx="6" fill="${carcass}"/>
        <rect x="${x0 + 472}" y="${y0 + 12}" width="186" height="${h - 24}" fill="${accent}" fill-opacity="0.24"/>
        <rect x="${x0 + 472}" y="${y0 + 118}" width="186" height="12" fill="${accent}"/>
        <rect x="${x0 + 472}" y="${y0 + 236}" width="186" height="12" fill="${accent}"/>
        <rect x="${x0 + 472}" y="${y0 + 354}" width="186" height="12" fill="${accent}"/>
      </g>`;
  } else if (archetype === 'hallway') {
    const x0 = 116;
    const w = 568;
    const y0 = 46;
    const h = 508;
    let slats = '';
    for (let sx = x0 + 232; sx < x0 + w - 16; sx += 18) {
      slats += `<rect x="${sx}" y="${y0 + 16}" width="9" height="310" rx="1" fill="${accent}"/>`;
    }
    bodySvg = `
      <g filter="url(#sh)">
        <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="4" fill="${carcass}"/>
        <!-- Left Tall Coat Wardrobe -->
        <rect x="${x0 + 8}" y="${y0 + 10}" width="110" height="${h - 26}" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 122}" y="${y0 + 10}" width="96" height="${h - 26}" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 108}" y="${y0 + 210}" width="4" height="68" rx="2" fill="${handle}"/>
        <rect x="${x0 + 128}" y="${y0 + 210}" width="4" height="68" rx="2" fill="${handle}"/>
        <!-- Right Slatted Back + Bench & Shoe Drawers -->
        <rect x="${x0 + 224}" y="${y0 + 10}" width="${w - 232}" height="320" fill="#18120e" fill-opacity="0.5"/>
        ${slats}
        <rect x="${x0 + 224}" y="${y0 + 330}" width="${w - 232}" height="38" rx="5" fill="${counter}"/>
        <rect x="${x0 + 224}" y="${y0 + 372}" width="${w - 232}" height="62" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 224}" y="${y0 + 438}" width="${w - 232}" height="60" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 360}" y="${y0 + 398}" width="64" height="4" rx="2" fill="${handle}"/>
        <rect x="${x0 + 360}" y="${y0 + 464}" width="64" height="4" rx="2" fill="${handle}"/>
      </g>`;
  } else {
    // office
    const x0 = 60;
    const w = 680;
    const y0 = 54;
    const h = 492;
    bodySvg = `
      <g filter="url(#sh)">
        <!-- Left Bookcase + Lower Cabinet -->
        <rect x="${x0}" y="${y0}" width="176" height="${h}" rx="4" fill="${accent}"/>
        <rect x="${x0 + 10}" y="${y0 + 96}" width="156" height="12" fill="${carcass}"/>
        <rect x="${x0 + 10}" y="${y0 + 198}" width="156" height="12" fill="${carcass}"/>
        <rect x="${x0 + 10}" y="${y0 + 300}" width="156" height="12" fill="${carcass}"/>
        <rect x="${x0 + 8}" y="${y0 + 340}" width="78" height="142" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 90}" y="${y0 + 340}" width="78" height="142" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <!-- Center Upper Glass Vitrine + Desk -->
        <rect x="${x0 + 182}" y="${y0}" width="316" height="196" rx="4" fill="${carcass}" stroke="${frame}" stroke-width="2"/>
        <rect x="${x0 + 192}" y="${y0 + 10}" width="144" height="176" fill="url(#gl)" stroke="${handle}" stroke-width="2.5"/>
        <rect x="${x0 + 344}" y="${y0 + 10}" width="144" height="176" fill="url(#gl)" stroke="${handle}" stroke-width="2.5"/>
        <rect x="${x0 + 328}" y="${y0 + 92}" width="4" height="42" rx="2" fill="${handle}"/>
        <rect x="${x0 + 348}" y="${y0 + 92}" width="4" height="42" rx="2" fill="${handle}"/>
        <!-- Executive Desk + Pedestal Drawers -->
        <rect x="${x0 + 178}" y="${y0 + 320}" width="324" height="18" rx="3" fill="${accent}"/>
        <rect x="${x0 + 182}" y="${y0 + 338}" width="92" height="154" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 406}" y="${y0 + 338}" width="92" height="154" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 212}" y="${y0 + 356}" width="34" height="4" rx="2" fill="${handle}"/>
        <rect x="${x0 + 436}" y="${y0 + 356}" width="34" height="4" rx="2" fill="${handle}"/>
        <!-- Right Bookcase + Lower Cabinet -->
        <rect x="${x0 + 504}" y="${y0}" width="176" height="${h}" rx="4" fill="${accent}"/>
        <rect x="${x0 + 514}" y="${y0 + 96}" width="156" height="12" fill="${carcass}"/>
        <rect x="${x0 + 514}" y="${y0 + 198}" width="156" height="12" fill="${carcass}"/>
        <rect x="${x0 + 514}" y="${y0 + 300}" width="156" height="12" fill="${carcass}"/>
        <rect x="${x0 + 512}" y="${y0 + 340}" width="78" height="142" rx="2" fill="url(#fg)" stroke="#00000033"/>
        <rect x="${x0 + 594}" y="${y0 + 340}" width="78" height="142" rx="2" fill="url(#fg)" stroke="#00000033"/>
      </g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">${defs}${bodySvg}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface ModelBlueprintSpec {
  idSuffix: string;
  titleUz: string;
  descUz: string;
  dims: DimensionsCm;
  finishIndex: number;
  photoUrl?: string;
  layoutVariant?: Partial<FurnitureLayoutVariant>;
}

const ARCHETYPE_SPECS: Record<FurnitureArchetype, ModelBlueprintSpec[]> = {
  kitchen: [
    {
      idSuffix: 'cat-kitchen-modern',
      titleUz: 'Toshkent Modern Oshxona',
      descUz: "Shiftgacha yuqori shkaflar, ochiq yog'och nisha va kvars tosh stoleshnitsali zamonaviy oshxona.",
      dims: { widthCm: 300, heightCm: 250, depthCm: 60 },
      finishIndex: 1,
      photoUrl: CURATED_STUDIO_PHOTOS.kitchenModern,
      layoutVariant: { doorsCount: 6, drawersCount: 3, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-emerald-gold',
      titleUz: 'Samarqand Zumrad & Tilla Oshxona',
      descUz: "Chuqur zumrad mat MDF fasadlar, shampan tilla tutqichlar va yong'oq ochiq javonli hashamatli oshxona.",
      dims: { widthCm: 340, heightCm: 255, depthCm: 60 },
      finishIndex: 0,
      photoUrl: CURATED_STUDIO_PHOTOS.kitchenEmeraldGold,
      layoutVariant: { doorsCount: 6, drawersCount: 4, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-walnut-royal',
      titleUz: "Registon Yong'oq Neoklassika Oshxona",
      descUz: "Tabiiy yong'oq shpon frezerovka eshiklar, tilla profilli ramka va kvars stol ustki qoplamasi.",
      dims: { widthCm: 320, heightCm: 250, depthCm: 60 },
      finishIndex: 2,
      layoutVariant: { doorsCount: 6, drawersCount: 3, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-white-hitech',
      titleUz: 'Oq Glyants Hi-Tech Oshxona',
      descUz: "Tutqichsiz Gola profilli oq akril fasadlar va yashirin LED chiroqli minimal oshxona majmuasi.",
      dims: { widthCm: 280, heightCm: 245, depthCm: 60 },
      finishIndex: 3,
      layoutVariant: { doorsCount: 5, drawersCount: 3, hasOpenNiche: false },
    },
    {
      idSuffix: 'kitchen-cashmere-soft',
      titleUz: 'Kashmir Mat Minimalizm Oshxona',
      descUz: "Yumshoq kashmir AGT akril eshiklar va Blum yumshoq yopqichli ergonomik oshxona garnituri.",
      dims: { widthCm: 300, heightCm: 245, depthCm: 60 },
      finishIndex: 4,
      layoutVariant: { doorsCount: 6, drawersCount: 3, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-loft-grafit',
      titleUz: "Loft Grafit & Yong'oq Oshxona",
      descUz: "To'q grafit fakturali LDSP, qora metall tutqichlar va yong'oq oraliq tokchali loft oshxona.",
      dims: { widthCm: 260, heightCm: 240, depthCm: 60 },
      finishIndex: 5,
      layoutVariant: { doorsCount: 5, drawersCount: 3, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-night-emerald',
      titleUz: 'Tungi Zumrad Studio Oshxona',
      descUz: "Zumrad va yong'oq uyg'unligida shiftgacha baland shkafli premium oshxona.",
      dims: { widthCm: 360, heightCm: 260, depthCm: 62 },
      finishIndex: 6,
      layoutVariant: { doorsCount: 6, drawersCount: 4, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-ivory-gold',
      titleUz: 'Filsuyagi Neoklassik Oshxona',
      descUz: "Ochiq filsuyagi bo'yoqli MDF fasadlar, oltin tutqichlar va marmar naqshli fartuk.",
      dims: { widthCm: 310, heightCm: 250, depthCm: 60 },
      finishIndex: 7,
      layoutVariant: { doorsCount: 6, drawersCount: 3, hasOpenNiche: false },
    },
    {
      idSuffix: 'kitchen-sand-minimal',
      titleUz: 'Qumrang Profil Oshxona Pro',
      descUz: "Qumrang mat fasadlar, qora alyuminiy profil va keng saqlash tortmalari.",
      dims: { widthCm: 270, heightCm: 240, depthCm: 60 },
      finishIndex: 8,
      layoutVariant: { doorsCount: 5, drawersCount: 3, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-oak-cream',
      titleUz: 'Skandi Eman & Krem Oshxona',
      descUz: "Issiq eman teksturali korpus va krem rangli ustki shkaflarga ega shinam oshxona.",
      dims: { widthCm: 250, heightCm: 240, depthCm: 60 },
      finishIndex: 9,
      layoutVariant: { doorsCount: 4, drawersCount: 2, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-olive-shpon',
      titleUz: 'Zaytun & Shpon Premium Oshxona',
      descUz: "Zaytun-zumrad tusli mat MDF va tabiiy yog'och nishali zamonaviy oshxona.",
      dims: { widthCm: 330, heightCm: 255, depthCm: 60 },
      finishIndex: 10,
      layoutVariant: { doorsCount: 6, drawersCount: 3, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-icegray-hitech',
      titleUz: 'Buzrang Akril Hi-Tech Oshxona',
      descUz: "Yaltiroq kulrang AGT akril eshiklar va sensorli LED chiroqli oshxona tizimi.",
      dims: { widthCm: 290, heightCm: 250, depthCm: 60 },
      finishIndex: 11,
      layoutVariant: { doorsCount: 5, drawersCount: 3, hasOpenNiche: false },
    },
    {
      idSuffix: 'kitchen-mokko-bronze',
      titleUz: 'Mokko & Bronza Oshxona',
      descUz: "Qahva-mokko rangli silliq fasadlar va tillarang furnitura bilan jihozlangan oshxona.",
      dims: { widthCm: 310, heightCm: 248, depthCm: 60 },
      finishIndex: 12,
      layoutVariant: { doorsCount: 6, drawersCount: 3, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-obsidian-gold',
      titleUz: 'Qora Mat & Tilla Chiziq Oshxona',
      descUz: "Mat qora akril eshiklar va ingichka tilla profil chizig'iga ega Hi-Tech oshxona.",
      dims: { widthCm: 350, heightCm: 260, depthCm: 62 },
      finishIndex: 13,
      layoutVariant: { doorsCount: 6, drawersCount: 4, hasOpenNiche: true },
    },
    {
      idSuffix: 'kitchen-classic-samarkand',
      titleUz: "Samarqand Klassik Yong'oq Oshxona",
      descUz: "Keng oilaviy oshxona uchun mustahkam yong'oq shpon va boy saqlash bo'limlari.",
      dims: { widthCm: 380, heightCm: 255, depthCm: 60 },
      finishIndex: 14,
      layoutVariant: { doorsCount: 6, drawersCount: 4, hasOpenNiche: true },
    },
  ],

  wardrobe: [
    {
      idSuffix: 'cat-wardrobe-kupe',
      titleUz: 'Minimalist Shkaf-Kupe Pro',
      descUz: "Qora alyuminiy profilli, qoraytirilgan shisha va mat MDF eshikli to'liq bo'yli kupe shkafi.",
      dims: { widthCm: 240, heightCm: 255, depthCm: 65 },
      finishIndex: 8,
      photoUrl: CURATED_STUDIO_PHOTOS.wardrobeKupe,
      layoutVariant: { doorsCount: 4, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-walnut-glass',
      titleUz: "Shohona Yong'oq & Shisha Garderob",
      descUz: "Tabiiy yong'oq shpon, bronza vitrina eshiklar va ichki issiq LED chiroqli premium shkaf.",
      dims: { widthCm: 300, heightCm: 260, depthCm: 65 },
      finishIndex: 2,
      photoUrl: CURATED_STUDIO_PHOTOS.wardrobeWalnutGlass,
      layoutVariant: { doorsCount: 4, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-emerald-gold',
      titleUz: 'Zumrad & Tilla Neoklassika Shkaf',
      descUz: "Zumrad mat MDF eshiklar, tillarang uzun tutqichlar va ichki kiyim tortmali shkaf.",
      dims: { widthCm: 260, heightCm: 260, depthCm: 62 },
      finishIndex: 0,
      layoutVariant: { doorsCount: 4, hasVitrine: false },
    },
    {
      idSuffix: 'wardrobe-white-gloss',
      titleUz: 'Oq Glyants Hi-Tech Kupe Shkaf',
      descUz: "Xonani keng ko'rsatuvchi oq yaltiroq AGT akril fasadli 3 eshikli zamonaviy shkaf.",
      dims: { widthCm: 220, heightCm: 250, depthCm: 60 },
      finishIndex: 3,
      layoutVariant: { doorsCount: 3, hasVitrine: false },
    },
    {
      idSuffix: 'wardrobe-cashmere-5door',
      titleUz: 'Kashmir Mat 5-Eshikli Garderob',
      descUz: "Mat kashmir fasad, shampan tutqichlar va alohida poyabzal-ko'ylak bo'limlari.",
      dims: { widthCm: 280, heightCm: 260, depthCm: 62 },
      finishIndex: 4,
      layoutVariant: { doorsCount: 5, hasVitrine: false },
    },
    {
      idSuffix: 'wardrobe-loft-grafit',
      titleUz: 'Loft Grafit & Shisha Shkaf',
      descUz: "To'q grafit korpus, qora ramkali tutunli shisha vitrina va yong'oq polkalar.",
      dims: { widthCm: 250, heightCm: 255, depthCm: 65 },
      finishIndex: 5,
      layoutVariant: { doorsCount: 4, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-anthracite-oak',
      titleUz: 'Antratsit & Eman Modern Shkaf',
      descUz: "Mat antratsit eshiklar bilan eman rangli ichki javonlar uyg'unlashtirilgan model.",
      dims: { widthCm: 240, heightCm: 250, depthCm: 60 },
      finishIndex: 1,
      layoutVariant: { doorsCount: 4, hasVitrine: false },
    },
    {
      idSuffix: 'wardrobe-night-emerald',
      titleUz: 'Tungi Zumrad Vitrinali Shkaf',
      descUz: "Markaziy bronza shisha eshiklar va LED yoritishga ega zumrad garderob.",
      dims: { widthCm: 280, heightCm: 265, depthCm: 65 },
      finishIndex: 6,
      layoutVariant: { doorsCount: 4, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-ivory-classic',
      titleUz: 'Filsuyagi Neoklassik Garderob',
      descUz: "Frezerovkali filsuyagi eshiklar va nozik tilla tutqichli klassik shkaf.",
      dims: { widthCm: 260, heightCm: 255, depthCm: 60 },
      finishIndex: 7,
      layoutVariant: { doorsCount: 4, hasVitrine: false },
    },
    {
      idSuffix: 'wardrobe-oak-scandi',
      titleUz: 'Skandi Eman 3-Eshikli Shkaf',
      descUz: "Ixcham xonalar uchun tabiiy eman va krem rangli 3 eshikli qulay shkaf.",
      dims: { widthCm: 180, heightCm: 240, depthCm: 58 },
      finishIndex: 9,
      layoutVariant: { doorsCount: 3, hasVitrine: false },
    },
    {
      idSuffix: 'wardrobe-olive-gold',
      titleUz: 'Zaytun & Tilla Garderob Tizimi',
      descUz: "Zaytun tusli MDF eshiklar va Blum tortma mexanizmli keng kiyim shkafi.",
      dims: { widthCm: 270, heightCm: 255, depthCm: 62 },
      finishIndex: 10,
      layoutVariant: { doorsCount: 4, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-icegray-minimal',
      titleUz: 'Buzrang Minimalist Kupe Shkaf',
      descUz: "Sokin kulrang akril fasadlar va qora alyuminiy tutqichli zamonaviy shkaf.",
      dims: { widthCm: 230, heightCm: 250, depthCm: 62 },
      finishIndex: 11,
      layoutVariant: { doorsCount: 3, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-mokko-bronze',
      titleUz: 'Mokko & Bronza Shisha Garderob',
      descUz: "Mokko akril yon eshiklar va markaziy shaffof bronza vitrinali premium model.",
      dims: { widthCm: 290, heightCm: 260, depthCm: 65 },
      finishIndex: 12,
      layoutVariant: { doorsCount: 4, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-black-gold-hitech',
      titleUz: 'Qora Mat & Tilla Hi-Tech Shkaf',
      descUz: "Qora mat fasad, tilla chiziqli ramka va ichki sensor yoritish tizimi.",
      dims: { widthCm: 310, heightCm: 265, depthCm: 65 },
      finishIndex: 13,
      layoutVariant: { doorsCount: 5, hasVitrine: true },
    },
    {
      idSuffix: 'wardrobe-classic-walnut-5',
      titleUz: "Samarqand Yong'oq 5-Eshikli Shkaf",
      descUz: "Keng oilaviy garderob uchun 5 eshikli mustahkam yong'oq shpon shkaf.",
      dims: { widthCm: 320, heightCm: 260, depthCm: 64 },
      finishIndex: 14,
      layoutVariant: { doorsCount: 5, hasVitrine: false },
    },
  ],

  tvzone: [
    {
      idSuffix: 'cat-tvzone-hitech',
      titleUz: 'Hi-Tech Reykali TV-Zona',
      descUz: "Osma konsol tortmalari, vertikal yong'oq reykali fon va LED yoritgichli shisha vitrina.",
      dims: { widthCm: 320, heightCm: 230, depthCm: 42 },
      finishIndex: 5,
      photoUrl: CURATED_STUDIO_PHOTOS.tvzoneHitech,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-emerald-gold',
      titleUz: 'Zumrad & Tilla Mehmonxona TV-Zona',
      descUz: "Zumrad mat osma konsol, yong'oq reyka va tilla ramkali shisha vitrinali hashamatli devor.",
      dims: { widthCm: 340, heightCm: 240, depthCm: 45 },
      finishIndex: 0,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-anthracite-oak',
      titleUz: 'Antratsit & Eman Modern TV-Stenka',
      descUz: "Mat antratsit tortmalar va issiq eman reykali TV orqa devor majmuasi.",
      dims: { widthCm: 300, heightCm: 230, depthCm: 42 },
      finishIndex: 1,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-walnut-neoclassic',
      titleUz: "Yong'oq Shpon Neoklassik TV-Zona",
      descUz: "Tilla tutqichli yong'oq konsol va yorug' vitrinali mehmonxona devori.",
      dims: { widthCm: 330, heightCm: 240, depthCm: 45 },
      finishIndex: 2,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-white-hitech',
      titleUz: 'Oq Glyants Hi-Tech TV-Konsol',
      descUz: "Yaltiroq oq akril osma tumba, yashirin kabellar kanali va LED yoritish.",
      dims: { widthCm: 280, heightCm: 220, depthCm: 40 },
      finishIndex: 3,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: false },
    },
    {
      idSuffix: 'tvzone-cashmere-minimal',
      titleUz: 'Kashmir Mat Minimalizm TV-Zona',
      descUz: "Sokin kashmir rangli konsol va bronza shisha vitrina bilan jihozlangan TV devori.",
      dims: { widthCm: 300, heightCm: 230, depthCm: 42 },
      finishIndex: 4,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-night-emerald',
      titleUz: 'Tungi Zumrad & Shpon TV-Devor',
      descUz: "Chuqur zumrad osma tortmalar, yong'oq reyka va iliq orqa LED yorug'ligi.",
      dims: { widthCm: 350, heightCm: 245, depthCm: 45 },
      finishIndex: 6,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-ivory-gold',
      titleUz: 'Filsuyagi & Tilla TV-Stenka',
      descUz: "Klassik filsuyagi MDF fasadlar, oltin tutqichlar va shisha polkali javon.",
      dims: { widthCm: 310, heightCm: 235, depthCm: 44 },
      finishIndex: 7,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: false },
    },
    {
      idSuffix: 'tvzone-sand-black',
      titleUz: 'Qumrang & Qora Profil TV-Zona',
      descUz: "Qumrang mat tortmalar va qora alyuminiy shisha vitrinali zamonaviy stenka.",
      dims: { widthCm: 290, heightCm: 230, depthCm: 42 },
      finishIndex: 8,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-oak-scandi',
      titleUz: 'Skandi Eman & Krem TV-Zona',
      descUz: "Yengil va yorug' mehmonxonalar uchun eman va krem rangli TV tumba.",
      dims: { widthCm: 260, heightCm: 220, depthCm: 40 },
      finishIndex: 9,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-olive-shpon',
      titleUz: 'Zaytun & Shpon Premium TV-Zona',
      descUz: "Zaytun tusli konsol tortmalari va tabiiy yog'och reykali dizaynerlik devori.",
      dims: { widthCm: 320, heightCm: 235, depthCm: 44 },
      finishIndex: 10,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-icegray-hitech',
      titleUz: 'Buzrang Akril Hi-Tech TV-Zona',
      descUz: "Silliq kulrang akril fasadlar va qoraytirilgan shisha vitrina majmuasi.",
      dims: { widthCm: 300, heightCm: 230, depthCm: 42 },
      finishIndex: 11,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-mokko-bronze',
      titleUz: 'Mokko & Bronza TV-Stenka',
      descUz: "Mokko akril konsol, bronza shisha eshik va iliq LED chiziqli TV-zona.",
      dims: { widthCm: 310, heightCm: 235, depthCm: 44 },
      finishIndex: 12,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-obsidian-gold',
      titleUz: 'Qora Mat & Tilla TV-Majmua',
      descUz: "Qora mat fasad va tilla ramkali vitrina bilan jihozlangan hashamatli TV-zona.",
      dims: { widthCm: 360, heightCm: 245, depthCm: 45 },
      finishIndex: 13,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
    {
      idSuffix: 'tvzone-classic-walnut',
      titleUz: "Samarqand Yong'oq Loft TV-Zona",
      descUz: "Qalin yong'oq shpon fon paneli va keng konsol tortmalariga ega katta TV-zona.",
      dims: { widthCm: 370, heightCm: 245, depthCm: 45 },
      finishIndex: 14,
      layoutVariant: { drawersCount: 3, hasVitrine: true, hasSlats: true },
    },
  ],

  bedroom: [
    {
      idSuffix: 'cat-bedroom-cashmere',
      titleUz: 'Kashmir Yotoqxona Garderobi',
      descUz: "Mat kashmir MDF fasadli garderob shkafi va birlashtirilgan ikki tortmali konsol tumba.",
      dims: { widthCm: 280, heightCm: 250, depthCm: 60 },
      finishIndex: 4,
      photoUrl: CURATED_STUDIO_PHOTOS.bedroomCashmere,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-emerald-gold',
      titleUz: 'Zumrad & Tilla Yotoqxona To‘plami',
      descUz: "Zumrad mat MDF garderob, yon konsol tumba va shampan tilla tutqichli majmua.",
      dims: { widthCm: 300, heightCm: 255, depthCm: 60 },
      finishIndex: 0,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-anthracite-oak',
      titleUz: 'Antratsit & Eman Yotoqxona Shkafi',
      descUz: "Mat antratsit eshiklar, eman ichki javonlar va yon makiyaj/tumba konsoli.",
      dims: { widthCm: 270, heightCm: 250, depthCm: 60 },
      finishIndex: 1,
      layoutVariant: { doorsCount: 4, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-walnut-royal',
      titleUz: "Yong'oq Shpon Neoklassika Yotoqxona",
      descUz: "Tabiiy yong'oq shpon, tilla furnitura va keng saqlash bo'limlariga ega garderob.",
      dims: { widthCm: 310, heightCm: 255, depthCm: 62 },
      finishIndex: 2,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-white-hitech',
      titleUz: 'Oq Glyants Hi-Tech Yotoqxona',
      descUz: "Yaltiroq oq akril fasadli 4 eshikli garderob va ixcham yon tumba.",
      dims: { widthCm: 260, heightCm: 245, depthCm: 58 },
      finishIndex: 3,
      layoutVariant: { doorsCount: 4, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-loft-grafit',
      titleUz: 'Loft Grafit Yotoqxona Garderobi',
      descUz: "To'q grafit korpus, yong'oq ichki qism va 2 tortmali yon tumba.",
      dims: { widthCm: 275, heightCm: 250, depthCm: 60 },
      finishIndex: 5,
      layoutVariant: { doorsCount: 4, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-night-emerald',
      titleUz: 'Tungi Zumrad Premium Yotoqxona',
      descUz: "Chuqur zumrad va yong'oq uyg'unligida shiftgacha baland yotoqxona garderobi.",
      dims: { widthCm: 320, heightCm: 260, depthCm: 62 },
      finishIndex: 6,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-ivory-gold',
      titleUz: 'Filsuyagi & Tilla Yotoqxona',
      descUz: "Frezerovkali filsuyagi MDF eshiklar va tilla tutqichli hashamatli garderob.",
      dims: { widthCm: 290, heightCm: 255, depthCm: 60 },
      finishIndex: 7,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-sand-minimal',
      titleUz: 'Qumrang Minimalist Yotoqxona',
      descUz: "Qumrang MDF fasad, qora profil va yumshoq yopqichli Blum tortmalar.",
      dims: { widthCm: 265, heightCm: 248, depthCm: 60 },
      finishIndex: 8,
      layoutVariant: { doorsCount: 4, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-oak-cream',
      titleUz: 'Skandi Eman & Krem Yotoqxona',
      descUz: "Tabiiy eman va krem rangli iliq yotoqxona garderobi hamda konsol.",
      dims: { widthCm: 250, heightCm: 245, depthCm: 58 },
      finishIndex: 9,
      layoutVariant: { doorsCount: 4, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-olive-shpon',
      titleUz: 'Zaytun & Shpon Yotoqxona',
      descUz: "Zaytun-yashil fasadlar va yong'oq shpon bezakli zamonaviy yotoqxona majmuasi.",
      dims: { widthCm: 295, heightCm: 252, depthCm: 60 },
      finishIndex: 10,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-icegray-hitech',
      titleUz: 'Buzrang Akril Yotoqxona Shkafi',
      descUz: "Silliq kulrang AGT akril eshiklar va minimal yon konsol tumba.",
      dims: { widthCm: 270, heightCm: 250, depthCm: 60 },
      finishIndex: 11,
      layoutVariant: { doorsCount: 4, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-mokko-bronze',
      titleUz: 'Mokko Mat Yotoqxona Garderobi',
      descUz: "Mokko rangli akril fasad va shampan tutqichli keng yotoqxona shkafi.",
      dims: { widthCm: 300, heightCm: 255, depthCm: 62 },
      finishIndex: 12,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-obsidian-gold',
      titleUz: 'Qora Mat & Tilla Yotoqxona',
      descUz: "Zamonaviy qora mat fasad va tilla chiziqli hashamatli yotoqxona garderobi.",
      dims: { widthCm: 310, heightCm: 260, depthCm: 62 },
      finishIndex: 13,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
    {
      idSuffix: 'bedroom-classic-walnut',
      titleUz: "Samarqand Klassik Yong'oq Yotoqxona",
      descUz: "Mustahkam yong'oq shpon, keng kiyim bo'limi va 2 tortmali yon tumba.",
      dims: { widthCm: 325, heightCm: 258, depthCm: 62 },
      finishIndex: 14,
      layoutVariant: { doorsCount: 5, drawersCount: 2 },
    },
  ],

  kids: [
    {
      idSuffix: 'kids-oak-cream-pro',
      titleUz: "Skandi Eman & Krem O'quv Majmuasi",
      descUz: "Ikki eshikli kiyim shkafi, o'quv stoli, osma javon va kitob polkalaridan iborat bolalar xonasi.",
      dims: { widthCm: 280, heightCm: 225, depthCm: 55 },
      finishIndex: 9,
      photoUrl: CURATED_STUDIO_PHOTOS.kidsRoom,
      layoutVariant: { doorsCount: 2, drawersCount: 2, hasDesk: true },
    },
    {
      idSuffix: 'kids-emerald-gold',
      titleUz: 'Zumrad & Eman Bolalar Burchagi',
      descUz: "Zumrad mat fasadli shkaf, eman o'quv stoli va tilla tutqichli kitob javoni.",
      dims: { widthCm: 270, heightCm: 220, depthCm: 55 },
      finishIndex: 0,
      layoutVariant: { doorsCount: 2, drawersCount: 2, hasDesk: true },
    },
  ],

  hallway: [
    {
      idSuffix: 'hallway-anthracite-walnut',
      titleUz: "Antratsit & Yong'oq Reykali Prixojka",
      descUz: "Kiyim shkafi, vertikal yong'oq reyka, yumshoq o'rindiq va poyabzal tortmalari.",
      dims: { widthCm: 220, heightCm: 245, depthCm: 48 },
      finishIndex: 1,
      photoUrl: CURATED_STUDIO_PHOTOS.hallwayPrixojka,
      layoutVariant: { doorsCount: 2, drawersCount: 2, hasSlats: true },
    },
    {
      idSuffix: 'hallway-emerald-gold',
      titleUz: 'Zumrad & Tilla Dahliz Garnituri',
      descUz: "Hashamatli zumrad eshiklar, tilla tutqichlar va yong'oq reykali dahliz mebeli.",
      dims: { widthCm: 240, heightCm: 250, depthCm: 48 },
      finishIndex: 0,
      layoutVariant: { doorsCount: 2, drawersCount: 2, hasSlats: true },
    },
  ],

  office: [
    {
      idSuffix: 'office-emerald-walnut',
      titleUz: "Rahbar Ofis Kutubxonasi (Yong'oq & Zumrad)",
      descUz: "Ikki yon kitob javoni, shisha hujjat vitrinasi va zumrad-tilla rahbar stoli.",
      dims: { widthCm: 320, heightCm: 240, depthCm: 65 },
      finishIndex: 6,
      photoUrl: CURATED_STUDIO_PHOTOS.officeExecutive,
      layoutVariant: { doorsCount: 4, drawersCount: 4, hasVitrine: true, hasDesk: true },
    },
    {
      idSuffix: 'office-walnut-gold',
      titleUz: "Samarqand Neoklassik Kabinet Majmuasi",
      descUz: "Yong'oq shpon javonlar, tilla ramkali vitrina va keng ish stolli kabinet tizimi.",
      dims: { widthCm: 340, heightCm: 245, depthCm: 65 },
      finishIndex: 2,
      layoutVariant: { doorsCount: 4, drawersCount: 4, hasVitrine: true, hasDesk: true },
    },
  ],
};

function makeItemFromSpec(
  category: RoomCategory,
  archetype: FurnitureArchetype,
  spec: ModelBlueprintSpec,
  pricing: MaterialPricing,
  isDefault: boolean,
  isAiGenerated = false,
): CatalogItem {
  const preset = LUXURY_FINISH_PRESETS[spec.finishIndex % LUXURY_FINISH_PRESETS.length];
  const quote = calculateFurnitureQuote({
    category,
    dimensions: spec.dims,
    carcassMaterial: preset.carcassMaterial,
    facadeMaterial: preset.facadeMaterial,
    hardwareBrand: preset.hardwareBrand,
    extras: DEFAULT_EXTRAS,
    pricing,
  });

  const layoutVariant: FurnitureLayoutVariant = {
    archetype,
    doorsCount: spec.layoutVariant?.doorsCount ?? 4,
    drawersCount: spec.layoutVariant?.drawersCount ?? 2,
    hasVitrine: spec.layoutVariant?.hasVitrine,
    hasOpenNiche: spec.layoutVariant?.hasOpenNiche,
    hasSlats: spec.layoutVariant?.hasSlats,
    hasDesk: spec.layoutVariant?.hasDesk,
  };

  const previewImg =
    spec.photoUrl ||
    buildFurniturePreviewSvg({
      archetype,
      styleTag: preset.styleTag,
      palette: preset.palette,
      layoutVariant,
    });

  const id =
    spec.idSuffix.startsWith('cat-') ? spec.idSuffix : `cat-${spec.idSuffix}`;

  return {
    id,
    title: spec.titleUz,
    category,
    description: spec.descUz,
    image: previewImg,
    basePrice: quote.totalPrice,
    defaultDimensions: { ...spec.dims },
    carcassMaterial: preset.carcassMaterial,
    facadeMaterial: preset.facadeMaterial,
    hardwareBrand: preset.hardwareBrand,
    styleTag: preset.styleTag,
    finishLabel: preset.finishLabel,
    palette: { ...preset.palette },
    layoutVariant,
    isDefault,
    isAiGenerated,
  };
}

export function formatCatalogCode(num?: number): string {
  if (!num || !Number.isFinite(num)) return '';
  return `№${num}`;
}

export function getNextCatalogNumber(
  existingCatalog: CatalogItem[],
  isAi: boolean,
): number {
  if (isAi) {
    let maxAi = 200;
    for (const item of existingCatalog) {
      if (item.isAiGenerated && typeof item.catalogNumber === 'number' && item.catalogNumber >= 200) {
        if (item.catalogNumber > maxAi) maxAi = item.catalogNumber;
      }
    }
    return maxAi + 1;
  }
  let maxManual = 100;
  for (const item of existingCatalog) {
    if (!item.isAiGenerated && typeof item.catalogNumber === 'number') {
      if (item.catalogNumber > maxManual) maxManual = item.catalogNumber;
    }
  }
  const used = new Set(existingCatalog.map((c) => c.catalogNumber).filter(Boolean));
  let candidate = maxManual + 1;
  while (used.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

export function reconcileCatalogNumbers(items: CatalogItem[]): {
  items: CatalogItem[];
  changed: boolean;
} {
  let changed = false;
  const used = new Set<number>();
  let nextManual = 101;
  let nextAi = 201;

  for (const item of items) {
    if (typeof item.catalogNumber === 'number' && item.catalogNumber > 0) {
      used.add(item.catalogNumber);
      if (item.isAiGenerated && item.catalogNumber >= nextAi) {
        nextAi = item.catalogNumber + 1;
      } else if (!item.isAiGenerated && item.catalogNumber >= nextManual && item.catalogNumber < 200) {
        nextManual = item.catalogNumber + 1;
      }
    }
  }

  const nextItems = items.map((item) => {
    if (typeof item.catalogNumber === 'number' && item.catalogNumber > 0) {
      return item;
    }
    changed = true;
    if (item.isAiGenerated) {
      while (used.has(nextAi)) nextAi += 1;
      const assigned = nextAi;
      used.add(assigned);
      nextAi += 1;
      return { ...item, catalogNumber: assigned };
    }
    while (used.has(nextManual)) nextManual += 1;
    const assigned = nextManual;
    used.add(assigned);
    nextManual += 1;
    return { ...item, catalogNumber: assigned };
  });

  return { items: nextItems, changed };
}

export function searchCatalogItems(items: CatalogItem[], rawQuery: string): CatalogItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return items;
  const normalizedNumQuery = q.replace(/^[№#n]+/i, '').trim();
  const isPureDigits = /^\d+$/.test(normalizedNumQuery);

  const scored = items
    .map((item) => {
      const numStr = item.catalogNumber ? String(item.catalogNumber) : '';
      const codeStr = item.catalogNumber ? `№${item.catalogNumber}` : '';
      const titleLower = item.title.toLowerCase();
      const catLower = item.category.toLowerCase();
      const styleLower = item.styleTag?.toLowerCase() ?? '';
      const finishLower = item.finishLabel?.toLowerCase() ?? '';

      let score = 0;
      if (isPureDigits && numStr === normalizedNumQuery) {
        score = 100;
      } else if (normalizedNumQuery && numStr.startsWith(normalizedNumQuery)) {
        score = 80;
      } else if (normalizedNumQuery && numStr.includes(normalizedNumQuery)) {
        score = 60;
      } else if (codeStr.includes(q)) {
        score = 55;
      } else if (titleLower.includes(q)) {
        score = 40;
      } else if (catLower.includes(q) || styleLower.includes(q) || finishLower.includes(q)) {
        score = 20;
      }

      return { item, score };
    })
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score || (a.item.catalogNumber ?? 9999) - (b.item.catalogNumber ?? 9999));
  return scored.map((entry) => entry.item);
}

export function buildDefault60CatalogItems(
  pricing: MaterialPricing = DEFAULT_MATERIAL_PRICING,
): CatalogItem[] {
  const result: CatalogItem[] = [];
  const mapping: Array<{ category: RoomCategory; archetype: FurnitureArchetype }> = [
    { category: 'Oshxona', archetype: 'kitchen' },
    { category: 'Shkaf', archetype: 'wardrobe' },
    { category: 'TV-zona', archetype: 'tvzone' },
    { category: 'Yotoqxona', archetype: 'bedroom' },
  ];

  let nextManualNum = 101;
  let nextAiNum = 201;

  for (const { category, archetype } of mapping) {
    const specs = ARCHETYPE_SPECS[archetype];
    for (let i = 0; i < specs.length; i++) {
      const isHero = i === 0;
      const item = makeItemFromSpec(
        category,
        archetype,
        specs[i],
        pricing,
        isHero, // preserve original 4 seed items as isDefault: true
        !isHero,
      );
      item.catalogNumber = isHero ? nextManualNum++ : nextAiNum++;
      result.push(item);
    }
  }

  // Sort so Usta Katalogi hero models (№101..104) appear first, followed by №201+
  result.sort((a, b) => (a.catalogNumber ?? 9999) - (b.catalogNumber ?? 9999));
  return result;
}

export function getHeroPhotoForArchetype(archetype: FurnitureArchetype): string {
  switch (archetype) {
    case 'kitchen':
      return CURATED_STUDIO_PHOTOS.kitchenEmeraldGold;
    case 'wardrobe':
      return CURATED_STUDIO_PHOTOS.wardrobeWalnutGlass;
    case 'tvzone':
      return CURATED_STUDIO_PHOTOS.tvzoneHitech;
    case 'bedroom':
      return CURATED_STUDIO_PHOTOS.bedroomCashmere;
    case 'kids':
      return CURATED_STUDIO_PHOTOS.kidsRoom;
    case 'hallway':
      return CURATED_STUDIO_PHOTOS.hallwayPrixojka;
    case 'office':
      return CURATED_STUDIO_PHOTOS.officeExecutive;
  }
}

function getDefaultDimsForArchetype(
  archetype: FurnitureArchetype,
  idx: number,
): DimensionsCm {
  const widthShift = ((idx % 5) - 2) * 20; // -40 .. +40 cm
  switch (archetype) {
    case 'kitchen':
      return { widthCm: 300 + widthShift, heightCm: 250, depthCm: 60 };
    case 'wardrobe':
      return { widthCm: 240 + widthShift, heightCm: 255, depthCm: 62 };
    case 'tvzone':
      return { widthCm: 310 + widthShift, heightCm: 235, depthCm: 44 };
    case 'bedroom':
      return { widthCm: 280 + widthShift, heightCm: 250, depthCm: 60 };
    case 'kids':
      return { widthCm: 260 + widthShift, heightCm: 225, depthCm: 55 };
    case 'hallway':
      return { widthCm: 220 + widthShift, heightCm: 245, depthCm: 48 };
    case 'office':
      return { widthCm: 300 + widthShift, heightCm: 240, depthCm: 64 };
  }
}

export interface RawAiGeneratedFurnitureSpec {
  title?: string;
  description?: string;
  styleTag?: string;
  finishLabel?: string;
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  carcassMaterial?: string;
  facadeMaterial?: string;
  hardwareBrand?: string;
  facadeHex?: string;
  carcassHex?: string;
  accentHex?: string;
  handleHex?: string;
}

/**
 * Generates or completes a full 15-item AI catalog for any custom category name
 * (e.g., "Bolalar xonasi", "Dahliz / Prixojka", "Ofis mebeli", etc.).
 */
export function build15ItemsForCategory(params: {
  categoryName: string;
  styleHint?: string;
  aiSpecs?: RawAiGeneratedFurnitureSpec[];
  pricing?: MaterialPricing;
  startCatalogNumber?: number;
}): CatalogItem[] {
  const {
    categoryName,
    styleHint,
    aiSpecs = [],
    pricing = DEFAULT_MATERIAL_PRICING,
    startCatalogNumber = 201,
  } = params;
  const archetype = detectCategoryArchetype(categoryName);
  const slug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'custom';
  const baseStamp = Date.now();
  const curatedSpecs = ARCHETYPE_SPECS[archetype] ?? [];

  const items: CatalogItem[] = [];
  const totalCount = 15;

  for (let i = 0; i < totalCount; i++) {
    const preset = LUXURY_FINISH_PRESETS[i % LUXURY_FINISH_PRESETS.length];
    const aiSpec = aiSpecs[i];
    const seedSpec = curatedSpecs[i];

    const styleTag: FurnitureStyleTag =
      aiSpec?.styleTag === 'Hi-Tech' ||
      aiSpec?.styleTag === 'Neoklassika' ||
      aiSpec?.styleTag === 'Minimalizm' ||
      aiSpec?.styleTag === 'Loft' ||
      aiSpec?.styleTag === 'Modern'
        ? aiSpec.styleTag
        : preset.styleTag;

    const carcassMaterial: CarcassMaterial =
      aiSpec?.carcassMaterial === 'Turkiya MDF' ? 'Turkiya MDF' : preset.carcassMaterial;
    const facadeMaterial: FacadeMaterial =
      aiSpec?.facadeMaterial === 'AGT Akril' ||
      aiSpec?.facadeMaterial === 'Shpon' ||
      aiSpec?.facadeMaterial === 'Rossiya LDSP' ||
      aiSpec?.facadeMaterial === 'Turkiya MDF'
        ? aiSpec.facadeMaterial
        : preset.facadeMaterial;
    const hardwareBrand: HardwareBrand =
      aiSpec?.hardwareBrand === 'Blum' ? 'Blum' : preset.hardwareBrand;

    const fallbackDims = seedSpec?.dims ?? getDefaultDimsForArchetype(archetype, i);
    const dims: DimensionsCm = {
      widthCm: Math.max(120, Math.min(480, Math.round(Number(aiSpec?.widthCm) || fallbackDims.widthCm))),
      heightCm: Math.max(150, Math.min(300, Math.round(Number(aiSpec?.heightCm) || fallbackDims.heightCm))),
      depthCm: Math.max(35, Math.min(90, Math.round(Number(aiSpec?.depthCm) || fallbackDims.depthCm))),
    };

    const palette: FurnitureFinishPalette = {
      carcassHex: sanitizeHex(aiSpec?.carcassHex, preset.palette.carcassHex),
      facadeHex: sanitizeHex(aiSpec?.facadeHex, preset.palette.facadeHex),
      accentHex: sanitizeHex(aiSpec?.accentHex, preset.palette.accentHex),
      handleHex: sanitizeHex(aiSpec?.handleHex, preset.palette.handleHex),
      countertopHex: preset.palette.countertopHex,
      glassHex: preset.palette.glassHex,
      frameHex: preset.palette.frameHex,
    };

    const layoutVariant: FurnitureLayoutVariant = {
      archetype,
      doorsCount: seedSpec?.layoutVariant?.doorsCount ?? (i % 3 === 0 ? 5 : 4),
      drawersCount: seedSpec?.layoutVariant?.drawersCount ?? (i % 2 === 0 ? 3 : 2),
      hasVitrine: seedSpec?.layoutVariant?.hasVitrine ?? i % 2 === 1,
      hasOpenNiche: seedSpec?.layoutVariant?.hasOpenNiche ?? true,
      hasSlats: seedSpec?.layoutVariant?.hasSlats ?? i % 2 === 0,
      hasDesk: seedSpec?.layoutVariant?.hasDesk ?? (archetype === 'kids' || archetype === 'office'),
    };

    const quote = calculateFurnitureQuote({
      category: categoryName,
      dimensions: dims,
      carcassMaterial,
      facadeMaterial,
      hardwareBrand,
      extras: DEFAULT_EXTRAS,
      pricing,
    });

    const finishLabel = aiSpec?.finishLabel?.trim() || preset.finishLabel;
    const defaultTitle =
      seedSpec && i < curatedSpecs.length
        ? `${categoryName} · ${seedSpec.titleUz}`
        : `${categoryName} — ${finishLabel} (${styleTag})`;

    const title = aiSpec?.title?.trim() || defaultTitle;
    const description =
      aiSpec?.description?.trim() ||
      seedSpec?.descUz ||
      `${categoryName} uchun ${styleTag} uslubida ${finishLabel} rangli buyurtma mebel${
        styleHint ? ` (${styleHint})` : ''
      }. ${carcassMaterial} + ${facadeMaterial}, ${hardwareBrand} furnitura.`;

    const image =
      i === 0
        ? getHeroPhotoForArchetype(archetype)
        : buildFurniturePreviewSvg({
            archetype,
            styleTag,
            palette,
            layoutVariant,
          });

    items.push({
      id: `cat-${slug}-${baseStamp}-${i + 1}`,
      title,
      category: categoryName,
      description,
      image,
      basePrice: quote.totalPrice,
      defaultDimensions: dims,
      carcassMaterial,
      facadeMaterial,
      hardwareBrand,
      styleTag,
      finishLabel,
      palette,
      layoutVariant,
      isDefault: false,
      isAiGenerated: true,
      catalogNumber: startCatalogNumber + i,
    });
  }

  return items;
}
