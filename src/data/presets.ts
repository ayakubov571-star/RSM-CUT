import type { CatalogItem, RoomPreset } from '../types.ts';
import { buildDefault60CatalogItems } from '../utils/furnitureCatalogFactory.ts';

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: 'room-kitchen',
    title: "Bo'sh oshxona devori",
    subtitle: '320 × 260 sm · Yorug‘ xona',
    category: 'Oshxona',
    dimensions: { widthCm: 320, heightCm: 260, depthCm: 60 },
    image: '/src/assets/images/preset_kitchen_before_1795688941730.jpg',
  },
  {
    id: 'room-wardrobe',
    title: 'Yotoqxona nishasi',
    subtitle: '280 × 265 sm · Shkaf uchun',
    category: 'Shkaf',
    dimensions: { widthCm: 280, heightCm: 265, depthCm: 65 },
    image: '/src/assets/images/preset_wardrobe_before_1795688942692.jpg',
  },
  {
    id: 'room-tvzone',
    title: 'Mehmonxona devori',
    subtitle: '340 × 250 sm · TV-zona',
    category: 'TV-zona',
    dimensions: { widthCm: 340, heightCm: 250, depthCm: 45 },
    image: '/src/assets/images/preset_tvzone_before_1795688943545.jpg',
  },
];

export const DEFAULT_CATALOG_ITEMS: CatalogItem[] = buildDefault60CatalogItems();
