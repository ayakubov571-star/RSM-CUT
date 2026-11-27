import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Layers,
  Loader2,
  MapPin,
  Phone,
  Send,
  Share2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import type {
  CarcassMaterial,
  CatalogItem,
  CuttingPart,
  DimensionsCm,
  ExtraDetails,
  FacadeMaterial,
  FurnitureOrder,
  HardwareBrand,
  NestingResult,
  PlacedFurnitureBox,
  QuoteBreakdown,
} from '../types.ts';
import { formatSom } from '../utils/furnitureCalculator.ts';
import { formatCatalogCode } from '../utils/furnitureCatalogFactory.ts';
import {
  sendOrderViaTelegram,
  shareViaTelegramLink,
  tgHapticImpact,
  tgHapticNotification,
  type TelegramUserInfo,
} from '../utils/telegram.ts';
import { SheetNestingVisualizer } from './SheetNestingVisualizer.tsx';

interface OrderSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: CatalogItem;
  dimensions: DimensionsCm;
  carcassMaterial: CarcassMaterial;
  facadeMaterial: FacadeMaterial;
  hardwareBrand: HardwareBrand;
  extras: ExtraDetails;
  roomImage: string;
  aiRenderImage: string | null;
  placedBox: PlacedFurnitureBox;
  quote: QuoteBreakdown;
  customCuttingParts?: CuttingPart[];
  nestingSummary?: NestingResult;
  totalPriceOverride?: number;
  telegramUser?: TelegramUserInfo;
  onOrderCreated: (order: FurnitureOrder) => void;
  onSwitchToWorkshop: () => void;
}

export const OrderSubmissionModal: React.FC<OrderSubmissionModalProps> = ({
  isOpen,
  onClose,
  selectedItem,
  dimensions,
  carcassMaterial,
  facadeMaterial,
  hardwareBrand,
  extras,
  roomImage,
  aiRenderImage,
  placedBox,
  quote,
  customCuttingParts,
  nestingSummary,
  totalPriceOverride,
  telegramUser,
  onOrderCreated,
  onSwitchToWorkshop,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('+998 ');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<FurnitureOrder | null>(null);
  const [showNestingPreview, setShowNestingPreview] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [tgSendNotice, setTgSendNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (telegramUser?.fullName && !clientName.trim()) {
      setClientName(telegramUser.fullName);
    }
    if (telegramUser?.username && !notes.trim()) {
      setNotes(`Telegram: @${telegramUser.username}`);
    }
  }, [isOpen, telegramUser?.fullName, telegramUser?.username]);

  if (!isOpen) return null;

  const displayTotal = totalPriceOverride ?? quote.totalPrice;

  const buildOrderTelegramText = (order: FurnitureOrder) => {
    const sheetsLabel = nestingSummary
      ? `${nestingSummary.totalSheetsFloat} list (${nestingSummary.totalSheetsCount} dona), chiqindi ${nestingSummary.wastePercent}%, kromka ${nestingSummary.totalEdgeBandingM} m`
      : `${order.cuttingParts.length} xil detal`;
    const itemCode = formatCatalogCode(order.catalogNumber ?? selectedItem.catalogNumber);
    return [
      `RSM CUT — Ravshan Samarqand Mebel`,
      `Buyurtma #${order.id} (AI Konstruktor & Raskroy)`,
      `Model: ${itemCode ? `${itemCode} · ` : ''}${order.catalogItemTitle}`,
      `O'lcham: ${order.dimensions.widthCm} × ${order.dimensions.heightCm} × ${order.dimensions.depthCm} sm`,
      `Material: ${order.carcassMaterial} + ${order.facadeMaterial} (${order.hardwareBrand})`,
      `2D Raskroy: ${sheetsLabel}`,
      `Narx: ${formatSom(order.totalPrice)}`,
      `Mijoz: ${order.clientName} (${order.clientPhone})`,
      telegramUser?.username ? `Telegram: @${telegramUser.username}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleSendToTelegramMaster = (order: FurnitureOrder) => {
    tgHapticImpact('medium');
    const payload = {
      type: 'rsm_cut_order',
      orderId: order.id,
      catalogNumber: order.catalogNumber ?? selectedItem.catalogNumber,
      furnitureName: order.catalogItemTitle,
      dimensionsCm: order.dimensions,
      materials: {
        carcass: order.carcassMaterial,
        facade: order.facadeMaterial,
        hardware: order.hardwareBrand,
        ledLighting: order.extras.ledLighting,
      },
      totalPriceUzs: order.totalPrice,
      raskroySummary: nestingSummary
        ? {
            sheetSize: nestingSummary.sheetSize,
            totalSheetsFloat: nestingSummary.totalSheetsFloat,
            totalSheetsCount: nestingSummary.totalSheetsCount,
            wastePercent: nestingSummary.wastePercent,
            edgeBandingM: nestingSummary.totalEdgeBandingM,
            partsCount: nestingSummary.totalPartsCount,
          }
        : {
            partsCount: order.cuttingParts.length,
          },
      client: {
        name: order.clientName,
        phone: order.clientPhone,
        address: order.clientAddress,
        telegramUsername: telegramUser?.username || undefined,
      },
    };
    const status = sendOrderViaTelegram(payload, buildOrderTelegramText(order));
    setTgSendNotice(
      status === 'sendData'
        ? 'Buyurtma Telegram botga yuborildi!'
        : status === 'telegramShare'
          ? 'Telegram ulashish oynasi ochildi!'
          : 'Buyurtma matni nusxalandi!',
    );
    window.setTimeout(() => setTgSendNotice(null), 2600);
  };

  const handleShareOrder = (order: FurnitureOrder) => {
    tgHapticImpact('light');
    const res = shareViaTelegramLink(buildOrderTelegramText(order));
    setTgSendNotice(
      res === 'telegram' ? 'Telegram orqali ulashildi!' : 'Hisob-kitob nusxalandi!',
    );
    window.setTimeout(() => setTgSendNotice(null), 2400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || clientPhone.trim().length < 9 || !clientAddress.trim()) {
      tgHapticNotification('warning');
      setError("Iltimos, ism, telefon raqami (+998) va manzilni kiriting.");
      return;
    }

    tgHapticImpact('light');
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          clientAddress: clientAddress.trim(),
          notes: notes.trim(),
          catalogItemId: selectedItem.id,
          catalogItemTitle: selectedItem.title,
          catalogNumber: selectedItem.catalogNumber,
          category: selectedItem.category,
          dimensions,
          carcassMaterial,
          facadeMaterial,
          hardwareBrand,
          extras,
          roomImage,
          furnitureImage: selectedItem.image,
          aiRenderImage: aiRenderImage ?? undefined,
          placedBox,
          customCuttingParts,
          totalPriceOverride,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(data.error || 'Buyurtma yuborishda xatolik.');
      }
      tgHapticNotification('success');
      setSubmittedOrder(data.order);
      onOrderCreated(data.order);
    } catch (err: unknown) {
      tgHapticNotification('error');
      setError(err instanceof Error ? err.message : 'Tarmoq xatosi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseReset = () => {
    tgHapticImpact('light');
    setSubmittedOrder(null);
    setShowNestingPreview(false);
    setError(null);
    setTgSendNotice(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0E3A2F]/40 backdrop-blur-xs p-0"
      onClick={handleCloseReset}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] bg-white text-[#1A2421] rounded-t-3xl shadow-2xl border-t border-x border-[#C5A059]/60 overflow-hidden max-h-[92dvh] flex flex-col transition-all"
      >
        <div className="w-10 h-1.5 bg-[#C5A059]/50 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        <div className="flex items-center justify-between px-5 py-3.5 bg-[#FAF8F5] text-[#1A2421] border-b border-[#C5A059]/30 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#0E3A2F]">
              {submittedOrder ? 'RSM CUT — Buyurtma tasdiqlandi' : 'RSM CUT — Buyurtma berish'}
            </h3>
            <p className="text-xs text-[#6B7A74] font-medium mt-0.5 truncate flex items-center gap-1.5">
              {selectedItem.catalogNumber && (
                <span className="px-1.5 py-0.5 rounded bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold font-mono-num shrink-0">
                  {formatCatalogCode(selectedItem.catalogNumber)}
                </span>
              )}
              <span className="truncate">
                Ravshan Samarqand Mebel · {selectedItem.title} ({dimensions.widthCm}×{dimensions.heightCm} sm)
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseReset}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-[#EFEAE0] flex items-center justify-center text-[#0E3A2F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedOrder ? (
          <div
            className="p-5 sm:p-6 space-y-4 overflow-y-auto"
            style={{ paddingBottom: 'max(1.25rem, var(--tg-safe-bottom, 0px))' }}
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#0E3A2F] border border-[#C5A059] flex items-center justify-center mx-auto text-[#C5A059]">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-xs font-medium text-slate-600">
                RSM CUT Buyurtma kvitansiyasi
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-xl font-bold text-[#0E3A2F] font-mono-num">
                  {submittedOrder.id}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    tgHapticImpact('light');
                    await navigator.clipboard?.writeText(submittedOrder.id);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 1800);
                  }}
                  className="p-1 rounded hover:bg-[#E2E8F0] text-[#0E3A2F]"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copiedId && (
                <p className="text-xs text-[#0E3A2F] font-semibold">Nusxalandi!</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">Model:</span>
                <span className="font-semibold text-[#0F172A] flex items-center gap-1.5 min-w-0">
                  {(submittedOrder.catalogNumber ?? selectedItem.catalogNumber) && (
                    <span className="px-1.5 py-0.5 rounded bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold font-mono-num shrink-0">
                      {formatCatalogCode(submittedOrder.catalogNumber ?? selectedItem.catalogNumber)}
                    </span>
                  )}
                  <span className="truncate">{submittedOrder.catalogItemTitle}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Umumiy narx:</span>
                <span className="font-bold text-[#0E3A2F] font-mono-num">
                  {formatSom(submittedOrder.totalPrice)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-600">Material tarkibi:</span>
                <span className="font-semibold text-[#0F172A] text-right">
                  {submittedOrder.carcassMaterial} + {submittedOrder.facadeMaterial} ({submittedOrder.hardwareBrand})
                </span>
              </div>
              {nestingSummary && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">2D Raskroy:</span>
                  <span className="font-mono-num font-semibold text-[#0E3A2F]">
                    {nestingSummary.totalSheetsFloat} list · {nestingSummary.totalEdgeBandingM} m kromka
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Tayyor bo&apos;lish muddati:</span>
                <span className="font-semibold text-[#0E3A2F]">
                  {submittedOrder.productionDaysLabel}
                </span>
              </div>
            </div>

            {/* 1-Click Telegram Master Submission & Share */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSendToTelegramMaster(submittedOrder)}
                className="min-h-[44px] px-4 rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/75 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Send className="w-4 h-4 text-[#C5A059]" />
                <span>Telegram orqali ustaga yuborish</span>
              </button>

              <button
                type="button"
                onClick={() => handleShareOrder(submittedOrder)}
                className="min-h-[44px] px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4 text-[#0E3A2F]" />
                <span>Do&apos;stga / Mijozga ulashish</span>
              </button>
            </div>

            {tgSendNotice && (
              <p className="text-center text-xs font-semibold text-[#0E3A2F]">
                {tgSendNotice}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                tgHapticImpact('light');
                setShowNestingPreview((v) => !v);
              }}
              className="w-full min-h-[42px] px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0E3A2F] text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4 text-[#C5A059]" />
              <span>
                {showNestingPreview
                  ? '2D Raskroy sxemasini yopish'
                  : "Avtomatik 2D Raskroy / Listga joylashuvni ko'rish"}
              </span>
            </button>

            {showNestingPreview && (
              <div className="pt-1">
                <SheetNestingVisualizer
                  cuttingParts={submittedOrder.cuttingParts}
                  sheetSize={submittedOrder.sheetSize}
                  editable={false}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCloseReset}
                className="min-h-[44px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-sm font-semibold"
              >
                Dizaynga qaytish
              </button>
              <button
                type="button"
                onClick={() => {
                  tgHapticImpact('light');
                  handleCloseReset();
                  onSwitchToWorkshop();
                }}
                className="min-h-[44px] rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/75 text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Wrench className="w-4 h-4 text-[#C5A059]" />
                <span>Sexda 2D Raskroyni ochish</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-5 space-y-3.5 overflow-y-auto"
            style={{ paddingBottom: 'max(1.25rem, var(--tg-safe-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <p className="text-xs text-slate-600">
                  {carcassMaterial} + {facadeMaterial} ({hardwareBrand})
                </p>
                <p className="text-sm font-bold text-[#0E3A2F] font-mono-num mt-0.5">
                  {formatSom(displayTotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-600">Muddat</p>
                <p className="text-xs font-semibold text-[#0E3A2F] mt-0.5">
                  {quote.productionDaysLabel}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  Ismingiz
                </label>
                {telegramUser?.username && (
                  <span className="text-[11px] font-mono-num text-[#0E3A2F] font-semibold">
                    @{telegramUser.username}
                  </span>
                )}
              </div>
              <div className="relative">
                <User className="w-4 h-4 text-[#0E3A2F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Masalan: Azizbek Tursunov"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Telefon raqamingiz
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#0E3A2F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder:text-slate-400 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Manzil
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#0E3A2F] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Samarqand sh., Mirzo Ulug'bek ko'chasi, 14-uy"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Izoh (ixtiyoriy)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Rang, tutqich yoki o'rnatish vaqti bo'yicha istaklar..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3A2F]"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] disabled:opacity-60 text-white border border-[#C5A059]/75 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
                  <span>Yuborilmoqda...</span>
                </>
              ) : (
                <span>Buyurtma berish va Raskroy yaratish</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
