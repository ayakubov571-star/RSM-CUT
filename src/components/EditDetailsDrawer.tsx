import React from 'react';
import { Lightbulb, Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import type {
  CarcassMaterial,
  DimensionsCm,
  ExtraDetails,
  FacadeMaterial,
  HardwareBrand,
  MaterialPricing,
} from '../types.ts';
import {
  CARCASS_MATERIALS,
  FACADE_MATERIALS,
  formatSom,
  HARDWARE_BRANDS,
} from '../utils/furnitureCalculator.ts';
import { tgHapticImpact } from '../utils/telegram.ts';

interface EditDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dimensions: DimensionsCm;
  onDimensionsChange: (dims: DimensionsCm) => void;
  carcassMaterial: CarcassMaterial;
  onCarcassChange: (mat: CarcassMaterial) => void;
  facadeMaterial: FacadeMaterial;
  onFacadeChange: (mat: FacadeMaterial) => void;
  hardwareBrand: HardwareBrand;
  onHardwareChange: (hw: HardwareBrand) => void;
  extras: ExtraDetails;
  onExtrasChange: (extras: ExtraDetails) => void;
  pricing: MaterialPricing;
  totalPrice: number;
}

export const EditDetailsDrawer: React.FC<EditDetailsDrawerProps> = ({
  isOpen,
  onClose,
  dimensions,
  onDimensionsChange,
  carcassMaterial,
  onCarcassChange,
  facadeMaterial,
  onFacadeChange,
  hardwareBrand,
  onHardwareChange,
  extras,
  onExtrasChange,
  pricing,
  totalPrice,
}) => {
  if (!isOpen) return null;

  const adjustExtra = (key: 'extraShelves' | 'drawers' | 'glassDoors', delta: number) => {
    tgHapticImpact('light');
    onExtrasChange({
      ...extras,
      [key]: Math.max(0, Math.min(12, extras[key] + delta)),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0E3A2F]/40 backdrop-blur-xs p-0"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] bg-white text-[#1A2421] rounded-t-3xl shadow-2xl border-t border-x border-[#C5A059]/60 overflow-hidden max-h-[88dvh] flex flex-col"
      >
        <div className="w-10 h-1.5 bg-[#C5A059]/50 rounded-full mx-auto mt-3 mb-1" />

        <div className="flex items-center justify-between px-5 py-4 bg-[#FAF8F5] text-[#1A2421] border-b border-[#C5A059]/30">
          <div>
            <h3 className="text-base font-bold text-[#0E3A2F] flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-[#C5A059]" />
              <span>Tahrirlash / Qo&apos;shimcha qo&apos;shish</span>
            </h3>
            <p className="text-xs text-[#6B7A74] mt-0.5">
              Detallar va materiallar o&apos;zgarishi bilan narx darhol yangilanadi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full hover:bg-[#EFEAE0] flex items-center justify-center text-[#0E3A2F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Exact Dimensions Fine Tuning (including Depth slider) */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#0E3A2F]">
              Aniq o&apos;lchamlar (sm)
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { key: 'widthCm', label: 'Eni (sm)' },
                  { key: 'heightCm', label: 'Balandligi (sm)' },
                  { key: 'depthCm', label: 'Chuqurligi (sm)' },
                ] as const
              ).map((field) => (
                <div
                  key={field.key}
                  className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"
                >
                  <label className="block text-[11px] text-slate-600 mb-1">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    value={dimensions[field.key]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val)) {
                        onDimensionsChange({ ...dimensions, [field.key]: val });
                      }
                    }}
                    className="w-full bg-transparent text-sm font-bold text-[#0F172A] font-mono-num focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="pt-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Chuqurlikni sozlash</span>
                <span className="font-mono-num font-bold text-[#0E3A2F]">
                  {dimensions.depthCm} sm
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={dimensions.depthCm}
                onChange={(e) =>
                  onDimensionsChange({ ...dimensions, depthCm: Number(e.target.value) })
                }
                className="w-full accent-[#0E3A2F]"
              />
            </div>
          </div>

          {/* 1-Click Add Extra Details */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-[#0E3A2F]">
              Qo&apos;shimcha detallar qo&apos;shish
            </p>

            {(
              [
                {
                  key: 'extraShelves',
                  label: "Qo'shimcha polka",
                  price: pricing.extraShelfPrice,
                },
                {
                  key: 'drawers',
                  label: 'Tortma / Yashik',
                  price: pricing.extraDrawerPrice,
                },
                {
                  key: 'glassDoors',
                  label: 'Shisha eshik',
                  price: pricing.extraGlassDoorPrice,
                },
              ] as const
            ).map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"
              >
                <div>
                  <p className="text-xs font-semibold text-[#0F172A]">
                    {row.label}
                  </p>
                  <p className="text-[11px] text-[#0E3A2F] font-mono-num font-semibold">
                    +{formatSom(row.price)} / dona
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustExtra(row.key, -1)}
                    className="w-9 h-9 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] flex items-center justify-center text-[#0F172A]"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold font-mono-num text-[#0E3A2F]">
                    {extras[row.key]}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustExtra(row.key, 1)}
                    className="w-9 h-9 rounded-lg bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/70 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* LED Lighting Toggle */}
            <button
              type="button"
              onClick={() =>
                onExtrasChange({ ...extras, ledLighting: !extras.ledLighting })
              }
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                extras.ledLighting
                  ? 'bg-[#F8FAFC] border-[#C5A059] ring-1 ring-[#C5A059]/35'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-[#F1F5F9]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <Lightbulb
                  className={`w-4 h-4 ${
                    extras.ledLighting ? 'text-[#C5A059]' : 'text-slate-500'
                  }`}
                />
                <div>
                  <p className="text-xs font-semibold text-[#0F172A]">
                    LED yoritgich
                  </p>
                  <p className="text-[11px] text-[#0E3A2F] font-mono-num font-semibold">
                    +{formatSom(pricing.extraLedPrice)}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  extras.ledLighting
                    ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                    : 'bg-white border-[#E2E8F0] text-slate-600'
                }`}
              >
                {extras.ledLighting ? 'Yoqilgan' : "Qo'shish"}
              </span>
            </button>
          </div>

          {/* Carcass vs Facade & Hardware Material Mix */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-[#0E3A2F] mb-1.5">
                Karkas (Ichki korpus)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CARCASS_MATERIALS.map((mat) => (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => onCarcassChange(mat)}
                    className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      carcassMaterial === mat
                        ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-[#0E3A2F] mb-1.5">
                Fasad (Tashqi eshiklar)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FACADE_MATERIALS.map((mat) => (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => onFacadeChange(mat)}
                    className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      facadeMaterial === mat
                        ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-[#0E3A2F] mb-1.5">
                Furnitura tizimi
              </p>
              <div className="grid grid-cols-2 gap-2">
                {HARDWARE_BRANDS.map((hw) => (
                  <button
                    key={hw}
                    type="button"
                    onClick={() => onHardwareChange(hw)}
                    className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      hardwareBrand === hw
                        ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {hw} furnitura
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-4"
          style={{ paddingBottom: 'max(0.875rem, var(--tg-safe-bottom, 0px))' }}
        >
          <div>
            <p className="text-[11px] text-slate-600">Yangilangan narx</p>
            <p className="text-base font-bold text-[#0E3A2F] font-mono-num">
              {formatSom(totalPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              tgHapticImpact('light');
              onClose();
            }}
            className="min-h-[44px] px-6 rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/75 text-sm font-semibold"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
};
