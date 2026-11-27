import React, { useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Check,
  ClipboardList,
  Copy,
  ImagePlus,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  PackagePlus,
  Phone,
  Save,
  Send,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CarcassMaterial,
  CatalogItem,
  CuttingPart,
  FacadeMaterial,
  FurnitureOrder,
  HardwareBrand,
  MaterialPricing,
  OrderStatus,
  RoomCategory,
  SheetSizeKey,
} from '../types.ts';
import {
  CARCASS_MATERIALS,
  FACADE_MATERIALS,
  formatNumber,
  formatSom,
  HARDWARE_BRANDS,
} from '../utils/furnitureCalculator.ts';
import { computeSheetNesting } from '../utils/sheetNesting.ts';
import { formatCatalogCode } from '../utils/furnitureCatalogFactory.ts';
import { SheetNestingVisualizer } from './SheetNestingVisualizer.tsx';
import { TransparentFurnitureImg } from './TransparentFurnitureImg.tsx';

interface WorkshopWorkspaceProps {
  pricing: MaterialPricing;
  catalog: CatalogItem[];
  categories: string[];
  orders: FurnitureOrder[];
  requestedTab?: 'orders' | 'catalog' | 'pricing';
  onTabChange?: (tab: 'orders' | 'catalog' | 'pricing') => void;
  onPricingSaved: (nextPricing: MaterialPricing) => void;
  onCatalogAdded: (item: CatalogItem) => void;
  onCatalogDeleted: (id: string) => void;
  onCategoryGenerated: (
    categoryName: string,
    items: CatalogItem[],
    nextCategories?: string[],
  ) => void;
  onOrderUpdated: (updatedOrder: FurnitureOrder) => void;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Yangi',
  "O'lchov",
  'Kesish / Raskroy',
  "Yig'ish",
  'Tayyor',
];

const QUICK_NEW_CATEGORIES = [
  'Bolalar xonasi',
  'Dahliz / Prixojka',
  'Ofis mebeli',
  'Mehmonxona vitrinasi',
];

const PRICING_FIELDS: {
  key: keyof MaterialPricing;
  label: string;
  unit: string;
}[] = [
  { key: 'ldspPerSqm', label: 'Rossiya LDSP', unit: "so'm / m²" },
  { key: 'mdfPerSqm', label: 'Turkiya MDF', unit: "so'm / m²" },
  { key: 'acrylicPerSqm', label: 'AGT Akril', unit: "so'm / m²" },
  { key: 'veneerPerSqm', label: 'Shpon', unit: "so'm / m²" },
  { key: 'countertopPerM', label: 'Stoleshnitsa', unit: "so'm / metr" },
  { key: 'edgeBandingPerM', label: 'Kromka PVX', unit: "so'm / metr" },
  { key: 'hardwareBoyard', label: 'Boyard furnitura', unit: "so'm / komp." },
  { key: 'hardwareBlum', label: 'Blum furnitura', unit: "so'm / komp." },
  { key: 'extraShelfPrice', label: "Qo'shimcha polka", unit: "so'm / dona" },
  { key: 'extraDrawerPrice', label: 'Tortma / Yashik', unit: "so'm / dona" },
  { key: 'extraGlassDoorPrice', label: 'Shisha eshik', unit: "so'm / dona" },
  { key: 'extraLedPrice', label: 'LED yoritgich', unit: "so'm / to'plam" },
  { key: 'laborPercent', label: 'Usta haqqi', unit: '%' },
];

export const WorkshopWorkspace: React.FC<WorkshopWorkspaceProps> = ({
  pricing,
  catalog,
  categories,
  orders,
  requestedTab,
  onTabChange,
  onPricingSaved,
  onCatalogAdded,
  onCatalogDeleted,
  onCategoryGenerated,
  onOrderUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'catalog' | 'pricing'>(
    requestedTab ?? 'orders',
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id ?? '');

  React.useEffect(() => {
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const handleSelectTab = (tab: 'orders' | 'catalog' | 'pricing') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const [draftPricing, setDraftPricing] = useState<MaterialPricing>(pricing);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingMessage, setPricingMessage] = useState<string | null>(null);

  const [catTitle, setCatTitle] = useState('');
  const [catCategory, setCatCategory] = useState<RoomCategory>(categories[0] ?? 'Oshxona');
  const [catDesc, setCatDesc] = useState('');
  const [catBasePrice, setCatBasePrice] = useState(6500000);
  const [catW, setCatW] = useState(260);
  const [catH, setCatH] = useState(240);
  const [catD, setCatD] = useState(60);
  const [catCarcass, setCatCarcass] = useState<CarcassMaterial>('Rossiya LDSP');
  const [catFacade, setCatFacade] = useState<FacadeMaterial>('Turkiya MDF');
  const [catHardware, setCatHardware] = useState<HardwareBrand>('Boyard');
  const [catImage, setCatImage] = useState<string>(
    '/src/assets/images/catalog_kitchen_modern_1795689530411.jpg',
  );
  const [isAddingCatalog, setIsAddingCatalog] = useState(false);
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);
  const catFileRef = useRef<HTMLInputElement>(null);

  // Auto-create new catalog category + AI 15 furniture recommendations
  const [newCatName, setNewCatName] = useState('');
  const [newCatStyleHint, setNewCatStyleHint] = useState('');
  const [isGeneratingCategory, setIsGeneratingCategory] = useState(false);
  const [categoryGenMsg, setCategoryGenMsg] = useState<string | null>(null);
  const [categoryGenErr, setCategoryGenErr] = useState<string | null>(null);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('Hammasi');

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [notifyModalOrder, setNotifyModalOrder] = useState<FurnitureOrder | null>(null);
  const [copiedSms, setCopiedSms] = useState(false);
  const [raskroySavedMsg, setRaskroySavedMsg] = useState<string | null>(null);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? orders[0] ?? null;
  const readyCount = orders.filter((o) => o.status === 'Tayyor').length;

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of catalog) {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
    }
    return map;
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (catalogCategoryFilter === 'Hammasi') return catalog;
    return catalog.filter((item) => item.category === catalogCategoryFilter);
  }, [catalog, catalogCategoryFilter]);

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPricing(true);
    setPricingMessage(null);
    try {
      const res = await fetch('/api/workshop/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftPricing),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Saqlashda xatolik');
      onPricingSaved(data.pricing);
      setPricingMessage("Narxlar bazasi saqlandi! Mijoz kalkulyatori darhol yangilandi.");
    } catch (err: unknown) {
      setPricingMessage(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleCatalogImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCatImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim()) return;
    setIsAddingCatalog(true);
    setCatalogMsg(null);
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: catTitle.trim(),
          category: catCategory,
          description: catDesc.trim(),
          image: catImage,
          basePrice: catBasePrice,
          defaultDimensions: { widthCm: catW, heightCm: catH, depthCm: catD },
          carcassMaterial: catCarcass,
          facadeMaterial: catFacade,
          hardwareBrand: catHardware,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Katalogga qo'shishda xatolik");
      onCatalogAdded(data.item);
      setCatTitle('');
      setCatDesc('');
      setCatalogMsg("Yangi mebel modeli Usta Katalogiga qo'shildi!");
    } catch (err: unknown) {
      setCatalogMsg(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setIsAddingCatalog(false);
    }
  };

  const handleAutoCreateCategoryWith15 = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (trimmed.length < 2) {
      setCategoryGenErr('Katalog nomini kamida 2 ta harfdan kiriting.');
      return;
    }

    setIsGeneratingCategory(true);
    setCategoryGenErr(null);
    setCategoryGenMsg(null);

    try {
      const res = await fetch('/api/categories/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName: trimmed,
          styleHint: newCatStyleHint.trim(),
        }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok || !Array.isArray(data.items)) {
        throw new Error(data.error || "Yangi katalog uchun AI takliflarini yaratib bo'lmadi.");
      }

      onCategoryGenerated(data.category, data.items, data.categories);
      setCatalogCategoryFilter(data.category);
      setCatCategory(data.category);
      setNewCatName('');
      setNewCatStyleHint('');
      setCategoryGenMsg(
        `"${data.category}" katalogi yaratildi va ${data.items.length} ta AI model avtomatik yuklandi!`,
      );
    } catch (err: unknown) {
      setCategoryGenErr(
        err instanceof Error ? err.message : "Server bilan bog'lanishda xatolik.",
      );
    } finally {
      setIsGeneratingCategory(false);
    }
  };

  const handleDeleteCatalogItem = async (id: string) => {
    const res = await fetch(`/api/catalog/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      onCatalogDeleted(id);
    }
  };

  const handleStatusChange = async (
    orderId: string,
    status: OrderStatus,
    sendNotification = false,
  ) => {
    setUpdatingStatusId(orderId);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, sendNotification }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        onOrderUpdated(data.order);
        if (sendNotification) {
          setNotifyModalOrder(data.order);
        }
      }
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSaveCuttingParts = async (
    orderId: string,
    cuttingParts: CuttingPart[],
    sheetSize: SheetSizeKey,
  ) => {
    setRaskroySavedMsg(null);
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cutting-parts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuttingParts, sheetSize }),
    });
    const data = await res.json();
    if (res.ok && data.order) {
      onOrderUpdated(data.order);
      setRaskroySavedMsg('Raskroy detallari va list formati saqlandi.');
      setTimeout(() => setRaskroySavedMsg(null), 2500);
    }
  };

  const buildCustomerSmsText = (order: FurnitureOrder) => {
    const coupon = order.loyaltyCouponCode || `RSM10-${order.id.replace('#MP-', '')}`;
    return `Assalomu alaykum, ${order.clientName}! RSM CUT (Ravshan Samarqand Mebel) xabar beradi: Sizning ${order.id} raqamli "${order.catalogItemTitle}" buyurtmangiz tayyor bo'ldi. O'rnatish vaqtini belgilash uchun qo'ng'iroq qiling. Keyingi buyurtmangiz uchun 10% chegirma promo-kodingiz: ${coupon}`;
  };

  return (
    <div className="px-3.5 py-4 pb-8 space-y-4 text-[#1A2421]">
      <div className="space-y-3">
        <div>
          <h1 className="text-base font-bold text-[#0E3A2F]">
            RSM CUT · Usta / Sex boshqaruvi
          </h1>
          <p className="text-[11px] text-[#6B7A74] font-medium mt-0.5">
            2D Raskroy (Nesting), Katalog va Material narxlar bazasi
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-2xl border border-[#C5A059]/50 shadow-xs">
          <button
            type="button"
            onClick={() => handleSelectTab('orders')}
            className={`min-h-[38px] px-2 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-[#0E3A2F] text-white border border-[#C5A059]'
                : 'text-[#6B7A74] hover:text-[#1A2421]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            <span>Buyurtma ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('catalog')}
            className={`min-h-[38px] px-2 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'bg-[#0E3A2F] text-white border border-[#C5A059]'
                : 'text-[#6B7A74] hover:text-[#1A2421]'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5 shrink-0" />
            <span>Katalog ({catalog.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('pricing')}
            className={`min-h-[38px] px-2 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeTab === 'pricing'
                ? 'bg-[#0E3A2F] text-white border border-[#C5A059]'
                : 'text-[#6B7A74] hover:text-[#1A2421]'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span>Narxlar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl border border-[#C5A059]/45 p-3 shadow-xs">
          <p className="text-[10px] text-[#6B7A74]">Buyurtmalar</p>
          <p className="text-sm font-bold text-[#1A2421] font-mono-num mt-0.5">
            {orders.length} ta
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#C5A059]/45 p-3 shadow-xs">
          <p className="text-[10px] text-[#6B7A74]">Katalog</p>
          <p className="text-sm font-bold text-[#0E3A2F] font-mono-num mt-0.5">
            {catalog.length} xil
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#C5A059]/45 p-3 shadow-xs">
          <p className="text-[10px] text-[#6B7A74]">Tayyor</p>
          <p className="text-sm font-bold text-[#0E3A2F] font-mono-num mt-0.5">
            {readyCount} ta
          </p>
        </div>
      </div>

      {activeTab === 'orders' && (
        orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#C5A059]/50 p-10 text-center shadow-xs">
            <ClipboardList className="w-10 h-10 text-[#0E3A2F] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#1A2421]">
              Hozircha buyurtmalar yo&apos;q
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2.5">
              {orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const nestingPreview = computeSheetNesting(order.cuttingParts, order.sheetSize);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-white border-[#C5A059] ring-2 ring-[#C5A059]/35 shadow-sm'
                        : 'bg-white border-[#E2E8F0] hover:border-[#C5A059]/70 hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#0E3A2F] font-mono-num">
                          {order.id}
                        </span>
                        {order.catalogNumber && (
                          <span className="px-1.5 py-0.5 rounded bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold font-mono-num">
                            {formatCatalogCode(order.catalogNumber)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          order.status === 'Tayyor'
                            ? 'bg-[#0E3A2F] text-white border-[#C5A059]/75'
                            : order.status === 'Kesish / Raskroy'
                              ? 'bg-amber-50 text-amber-900 border-[#C5A059]/60'
                              : 'bg-[#F8FAFC] text-slate-600 border-[#E2E8F0]'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#0F172A] mt-1.5 truncate">
                      {order.clientName}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {order.catalogItemTitle} · {order.dimensions.widthCm}×{order.dimensions.heightCm} sm
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#E2E8F0] text-xs">
                      <span className="font-mono-num text-slate-600">
                        {nestingPreview.totalSheetsFloat} list · {nestingPreview.wastePercent}% otxod
                      </span>
                      <span className="font-bold text-[#0E3A2F] font-mono-num">
                        {formatSom(order.totalPrice)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedOrder && (
              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-2.5 bg-[#F8FAFC] text-[#0F172A] border-b border-[#E2E8F0] flex items-center justify-between text-xs">
                  <span className="font-bold tracking-wide text-[#0E3A2F]">
                    RSM CUT · Buyurtma &amp; Raskroy Varaqasi
                  </span>
                  <span className="text-[11px] text-slate-500">Ravshan Samarqand Mebel</span>
                </div>
                <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-bold text-[#0E3A2F] font-mono-num">
                        {selectedOrder.id}
                      </span>
                      {selectedOrder.catalogNumber && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold font-mono-num">
                          {formatCatalogCode(selectedOrder.catalogNumber)}
                        </span>
                      )}
                      <span>·</span>
                      <span>{selectedOrder.catalogItemTitle}</span>
                      <span>·</span>
                      <span>
                        {selectedOrder.carcassMaterial} + {selectedOrder.facadeMaterial} (
                        {selectedOrder.hardwareBrand})
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-[#0F172A] mt-1">
                      {selectedOrder.clientName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                      <span className="flex items-center gap-1 font-mono-num">
                        <Phone className="w-3.5 h-3.5 text-[#0E3A2F]" />
                        {selectedOrder.clientPhone}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#0E3A2F]" />
                        {selectedOrder.clientAddress}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500">Buyurtma summasi</p>
                    <p className="text-xl font-bold text-[#0E3A2F] font-mono-num">
                      {formatSom(selectedOrder.totalPrice)}
                    </p>
                  </div>
                </div>

                <div className="px-4 sm:px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ORDER_STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={updatingStatusId === selectedOrder.id}
                        onClick={() => handleStatusChange(selectedOrder.id, st, false)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          selectedOrder.status === st
                            ? 'bg-[#0E3A2F] text-white border border-[#C5A059]/75'
                            : 'bg-white border border-[#E2E8F0] text-slate-600 hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={updatingStatusId === selectedOrder.id}
                    onClick={() => handleStatusChange(selectedOrder.id, 'Tayyor', true)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/75 text-xs font-semibold flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                  >
                    <MessageSquare className="w-4 h-4 text-[#C5A059]" />
                    <span>Mijozga xabar yuborish</span>
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative rounded-xl overflow-hidden border border-[#E2E8F0] aspect-[4/3] bg-[#F8FAFC]">
                      <img
                        src={selectedOrder.roomImage}
                        alt="Mijoz xonasi"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div
                        style={{
                          left: `${selectedOrder.placedBox.xPercent}%`,
                          top: `${selectedOrder.placedBox.yPercent}%`,
                          width: `${selectedOrder.placedBox.widthPercent}%`,
                          height: `${selectedOrder.placedBox.heightPercent}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      >
                        <TransparentFurnitureImg
                          src={selectedOrder.furnitureImage}
                          alt={selectedOrder.catalogItemTitle}
                          className="w-full h-full object-fill drop-shadow-lg"
                        />
                      </div>
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-white/90 border border-[#E2E8F0] text-[#0F172A] text-[11px] font-medium">
                        Xona joylashuvi ({selectedOrder.dimensions.widthCm}×
                        {selectedOrder.dimensions.heightCm} sm)
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between space-y-3 text-xs">
                      <div>
                        <p className="font-bold text-[#0E3A2F] mb-2">Furnitura va qo&apos;shimchalar</p>
                        <ul className="space-y-1.5 text-[#0F172A]">
                          {selectedOrder.hardwareChecklist.map((hw) => (
                            <li key={hw} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-[#0E3A2F] shrink-0 mt-0.5" />
                              <span>{hw}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {selectedOrder.notes && (
                        <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]">
                          <span className="font-semibold text-[#0E3A2F]">Izoh: </span>
                          {selectedOrder.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#0E3A2F] flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#0E3A2F]" />
                        <span>RSM CUT · 2D Listga detal joylashuvi (Raskroy / Nesting)</span>
                      </h3>
                      {raskroySavedMsg && (
                        <span className="text-xs font-semibold text-[#0E3A2F]">
                          {raskroySavedMsg}
                        </span>
                      )}
                    </div>

                    <SheetNestingVisualizer
                      cuttingParts={selectedOrder.cuttingParts}
                      sheetSize={selectedOrder.sheetSize}
                      editable={true}
                      onSaveParts={(parts, sz) =>
                        handleSaveCuttingParts(selectedOrder.id, parts, sz)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="space-y-4">
            {/* AI Auto-Generate New Category + 15 Tailored Models */}
            <form
              onSubmit={handleAutoCreateCategoryWith15}
              className="bg-white rounded-3xl border border-[#C5A059]/55 p-4 shadow-xs space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#0E3A2F] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#C5A059]" />
                    <span>Yangi katalog yaratish (AI 15 ta model)</span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Katalog nomini kiriting — RSM CUT AI avtomatik 15 ta tayyor model, o&apos;lcham, narx va 3D chizmani yuklaydi
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_NEW_CATEGORIES.map((presetCat) => (
                  <button
                    key={presetCat}
                    type="button"
                    onClick={() => setNewCatName(presetCat)}
                    className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[11px] font-semibold text-[#0F172A] transition-colors"
                  >
                    + {presetCat}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Yangi katalog nomi
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Masalan: Bolalar xonasi yoki Dahliz / Prixojka"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Uslub va material yo&apos;nalishi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={newCatStyleHint}
                  onChange={(e) => setNewCatStyleHint(e.target.value)}
                  placeholder="Masalan: Zumrad MDF, yong'oq shpon, zamonaviy minimalist"
                  className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
              </div>

              {categoryGenErr && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {categoryGenErr}
                </div>
              )}

              {categoryGenMsg && (
                <div className="p-3 rounded-xl bg-[#E6F0EC] border border-[#0E3A2F]/30 text-xs font-medium text-[#0E3A2F]">
                  {categoryGenMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isGeneratingCategory}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] disabled:opacity-60 text-white border border-[#C5A059]/75 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isGeneratingCategory ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
                    <span>15 ta AI model yaratilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#C5A059]" />
                    <span>AI bilan 15 ta taklif yaratish va yuklash</span>
                  </>
                )}
              </button>
            </form>

            {/* Manual Single Model Addition Form */}
            <form
              onSubmit={handleAddCatalogItem}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-4"
            >
              <h2 className="text-base font-bold text-[#0E3A2F]">
                Bitta tayyor model qo&apos;shish
              </h2>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Mebel rasmi (oq fon avtomatik tozalanadi)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-18 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden shrink-0 flex items-center justify-center p-1">
                    <TransparentFurnitureImg
                      src={catImage}
                      alt="Yangi mebel"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <input
                    ref={catFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCatalogImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => catFileRef.current?.click()}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5"
                  >
                    <ImagePlus className="w-4 h-4 text-[#0E3A2F]" />
                    <span>Rasm yuklash</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Model nomi
                </label>
                <input
                  type="text"
                  required
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  placeholder="Masalan: Samarqand Zumrad Oshxona"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Toifa
                  </label>
                  <select
                    value={catCategory}
                    onChange={(e) => setCatCategory(e.target.value as RoomCategory)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold bg-[#F8FAFC] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Boshlang&apos;ich narx (so&apos;m)
                  </label>
                  <input
                    type="number"
                    step={100000}
                    value={catBasePrice}
                    onChange={(e) => setCatBasePrice(Number(e.target.value) || 0)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold font-mono-num text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Eni (sm)</label>
                  <input
                    type="number"
                    value={catW}
                    onChange={(e) => setCatW(Number(e.target.value) || 100)}
                    className="w-full min-h-[38px] px-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold font-mono-num text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Bo&apos;yi (sm)</label>
                  <input
                    type="number"
                    value={catH}
                    onChange={(e) => setCatH(Number(e.target.value) || 100)}
                    className="w-full min-h-[38px] px-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold font-mono-num text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Chuqur (sm)</label>
                  <input
                    type="number"
                    value={catD}
                    onChange={(e) => setCatD(Number(e.target.value) || 40)}
                    className="w-full min-h-[38px] px-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold font-mono-num text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Karkas</label>
                  <select
                    value={catCarcass}
                    onChange={(e) => setCatCarcass(e.target.value as CarcassMaterial)}
                    className="w-full min-h-[38px] px-2 rounded-lg border border-[#E2E8F0] text-[11px] font-semibold bg-[#F8FAFC] text-[#0F172A]"
                  >
                    {CARCASS_MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Fasad</label>
                  <select
                    value={catFacade}
                    onChange={(e) => setCatFacade(e.target.value as FacadeMaterial)}
                    className="w-full min-h-[38px] px-2 rounded-lg border border-[#E2E8F0] text-[11px] font-semibold bg-[#F8FAFC] text-[#0F172A]"
                  >
                    {FACADE_MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Furnitura</label>
                  <select
                    value={catHardware}
                    onChange={(e) => setCatHardware(e.target.value as HardwareBrand)}
                    className="w-full min-h-[38px] px-2 rounded-lg border border-[#E2E8F0] text-[11px] font-semibold bg-[#F8FAFC] text-[#0F172A]"
                  >
                    {HARDWARE_BRANDS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Tavsif
                </label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Material, tutqich va dizayn xususiyatlari..."
                  className="w-full rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
              </div>

              {catalogMsg && (
                <div className="p-3 rounded-xl bg-[#E6F0EC] border border-[#0E3A2F]/30 text-xs font-medium text-[#0E3A2F]">
                  {catalogMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isAddingCatalog}
                className="w-full min-h-[44px] rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/75 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {isAddingCatalog ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
                ) : (
                  <PackagePlus className="w-4 h-4 text-[#C5A059]" />
                )}
                <span>Katalogga qo&apos;shish</span>
              </button>
            </form>
          </div>

          <div className="space-y-3.5">
            {/* Catalog Category Filter Bar in Workshop */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {['Hammasi', ...categories].map((cat) => {
                const count = cat === 'Hammasi' ? catalog.length : (categoryCounts.get(cat) ?? 0);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategoryFilter(cat)}
                    className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 border ${
                      catalogCategoryFilter === cat
                        ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                        : 'bg-white text-[#6B7A74] border-[#C5A059]/35 hover:text-[#1A2421]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="font-mono-num text-[10px] opacity-80">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs flex flex-col"
                >
                  <div className="aspect-[4/3] bg-[#F8FAFC] border-b border-[#E2E8F0] relative flex items-center justify-center p-2">
                    <TransparentFurnitureImg
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-contain"
                    />
                    {item.catalogNumber && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold font-mono-num shadow-xs">
                        {formatCatalogCode(item.catalogNumber)}
                      </span>
                    )}
                    {!item.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCatalogItem(item.id)}
                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg bg-white/95 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-[#E2E8F0] flex items-center justify-center shadow-xs"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 gap-2">
                        <span className="font-semibold text-[#0E3A2F] truncate">
                          {item.category}
                          {item.styleTag ? ` · ${item.styleTag}` : ''}
                        </span>
                        <span className="font-mono-num shrink-0">
                          {item.defaultDimensions.widthCm}×{item.defaultDimensions.heightCm}×
                          {item.defaultDimensions.depthCm} sm
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#0F172A] mt-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.description}</p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs gap-2">
                      <span className="text-slate-600 truncate">
                        {item.finishLabel || `${item.carcassMaterial} / ${item.facadeMaterial}`}
                      </span>
                      <span className="font-bold text-[#0E3A2F] font-mono-num whitespace-nowrap shrink-0">
                        {formatSom(item.basePrice)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <form
          onSubmit={handleSavePricing}
          className="bg-white rounded-3xl border border-[#C5A059]/55 p-4 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C5A059]/25 pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-[#0E3A2F]">
                Materiallar va usta haqqi narxlari
              </h2>
              <p className="text-[11px] text-[#6B7A74] mt-0.5">
                Mijoz rejimida o&apos;lcham va material o&apos;zgarganda ushbu tariflar qo&apos;llanadi
              </p>
            </div>
            <button
              type="submit"
              disabled={isSavingPricing}
              className="w-full min-h-[44px] px-4 py-2 rounded-full bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059] text-xs font-semibold flex items-center justify-center gap-2"
            >
              {isSavingPricing ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
              ) : (
                <Save className="w-4 h-4 text-[#C5A059]" />
              )}
              <span>Narxlarni saqlash</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {PRICING_FIELDS.map((field) => (
              <div
                key={field.key}
                className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#C5A059]/35 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#0F172A]">
                    {field.label}
                  </label>
                  <span className="text-[11px] font-medium text-[#0E3A2F]">
                    {field.unit}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={field.key === 'laborPercent' ? 1 : 5000}
                  value={draftPricing[field.key]}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    if (Number.isFinite(num) && num >= 0) {
                      setDraftPricing((prev) => ({ ...prev, [field.key]: num }));
                    }
                  }}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-white border border-[#E2E8F0] text-sm font-bold text-[#0F172A] font-mono-num focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
                <p className="text-[11px] text-slate-600 font-mono-num">
                  Joriy: {formatNumber(draftPricing[field.key])}
                </p>
              </div>
            ))}
          </div>

          {pricingMessage && (
            <div className="p-3.5 rounded-xl bg-[#E6F0EC] border border-[#0E3A2F]/30 text-xs font-medium text-[#0E3A2F]">
              {pricingMessage}
            </div>
          )}
        </form>
      )}

      {notifyModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setNotifyModalOrder(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white text-[#0F172A] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden"
          >
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-1" />
            <div className="flex items-center justify-between px-5 py-4 bg-[#F8FAFC] text-[#0F172A] border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  RSM CUT · Mijoz xabari
                </h3>
                <p className="text-xs text-[#0E3A2F] font-medium mt-0.5">
                  Buyurtma holati &ldquo;Tayyor&rdquo; ga o&apos;tkazildi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotifyModalOrder(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[#E2E8F0]/60 flex items-center justify-center text-slate-600 hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#0F172A]">
                  <Tag className="w-4 h-4 text-[#C5A059]" />
                  <span className="text-xs font-semibold">10% chegirma promo-kodi:</span>
                </div>
                <span className="text-xs font-bold text-[#0E3A2F] font-mono-num">
                  {notifyModalOrder.loyaltyCouponCode}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] leading-relaxed">
                {buildCustomerSmsText(notifyModalOrder)}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(buildCustomerSmsText(notifyModalOrder));
                    setCopiedSms(true);
                    setTimeout(() => setCopiedSms(false), 1800);
                  }}
                  className="min-h-[44px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-4 h-4 text-[#0E3A2F]" />
                  <span>{copiedSms ? 'Nusxalandi!' : 'Matnni nusxalash'}</span>
                </button>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent('https://rsmcut.uz')}&text=${encodeURIComponent(
                    buildCustomerSmsText(notifyModalOrder),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/75 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4 text-[#C5A059]" />
                  <span>Telegramdan yuborish</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
