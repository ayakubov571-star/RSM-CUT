import React, { useMemo, useState } from 'react';
import {
  Copy,
  Layers,
  Plus,
  RotateCw,
  Save,
  Scissors,
  Trash2,
} from 'lucide-react';
import type { CuttingPart, PackedPartRect, SheetSizeKey } from '../types.ts';
import { computeSheetNesting, SHEET_DIMENSIONS } from '../utils/sheetNesting.ts';

interface SheetNestingVisualizerProps {
  cuttingParts: CuttingPart[];
  sheetSize: SheetSizeKey;
  editable?: boolean;
  onSaveParts?: (parts: CuttingPart[], sheetSize: SheetSizeKey) => Promise<void> | void;
}

const ROLE_COLORS: Record<
  CuttingPart['role'],
  { fill: string; stroke: string; text: string; badge: string }
> = {
  carcass: {
    fill: '#E2E8F0',
    stroke: '#475569',
    text: '#0F172A',
    badge: 'bg-slate-100 text-[#0F172A] border border-slate-300',
  },
  facade: {
    fill: '#E6F0EC',
    stroke: '#0E3A2F',
    text: '#0F172A',
    badge: 'bg-[#E6F0EC] text-[#0E3A2F] border border-[#0E3A2F]/40',
  },
  shelf: {
    fill: '#FEF3C7',
    stroke: '#C5A059',
    text: '#0F172A',
    badge: 'bg-amber-50 text-amber-900 border border-[#C5A059]/60',
  },
  drawer: {
    fill: '#F3ECE1',
    stroke: '#8B6F47',
    text: '#0F172A',
    badge: 'bg-stone-100 text-stone-900 border border-stone-300',
  },
};

export const SheetNestingVisualizer: React.FC<SheetNestingVisualizerProps> = ({
  cuttingParts,
  sheetSize,
  editable = false,
  onSaveParts,
}) => {
  const [localParts, setLocalParts] = useState<CuttingPart[]>(cuttingParts);
  const [localSheetSize, setLocalSheetSize] = useState<SheetSizeKey>(sheetSize);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [hoveredPart, setHoveredPart] = useState<PackedPartRect | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync if prop changes from another selected order
  React.useEffect(() => {
    setLocalParts(cuttingParts);
    setLocalSheetSize(sheetSize);
    setActiveSheetIdx(0);
    setHoveredPart(null);
  }, [cuttingParts, sheetSize]);

  const nesting = useMemo(
    () => computeSheetNesting(localParts, localSheetSize),
    [localParts, localSheetSize],
  );

  const safeSheetIndex = Math.min(activeSheetIdx, Math.max(0, nesting.sheets.length - 1));
  const activeSheet = nesting.sheets[safeSheetIndex];

  const handleAddPart = () => {
    const newPart: CuttingPart = {
      id: `custom-${Date.now()}`,
      name: "Yangi detal",
      lengthMm: 720,
      widthMm: 450,
      qty: 2,
      material: 'Rossiya LDSP',
      edgeBandingSides: '1 uzun',
      role: 'shelf',
    };
    setLocalParts((prev) => [...prev, newPart]);
  };

  const handleUpdatePart = (idx: number, patch: Partial<CuttingPart>) => {
    setLocalParts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };

  const handleDeletePart = (idx: number) => {
    setLocalParts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!onSaveParts) return;
    setIsSaving(true);
    try {
      await onSaveParts(localParts, localSheetSize);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCncSummary = async () => {
    const lines = [
      `RSM CUT — Ravshan Samarqand Mebel | 2D RASKROY SXEMASI (${SHEET_DIMENSIONS[localSheetSize].label})`,
      `Listlar: ${nesting.totalSheetsFloat} list (${nesting.totalSheetsCount} ta butun list)`,
      `Chiqindi: ${nesting.wastePercent}% | Kromka: ${nesting.totalEdgeBandingM} metr`,
      '',
      ...localParts.map(
        (p, i) =>
          `${i + 1}. ${p.name}: ${p.lengthMm}×${p.widthMm} mm — ${p.qty} dona [${p.material}, ${p.edgeBandingSides}]`,
      ),
    ];
    await navigator.clipboard?.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats & Sheet Size Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['2750x1830', '2800x2070'] as const).map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => {
                setLocalSheetSize(sz);
                setActiveSheetIdx(0);
              }}
              className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-colors ${
                localSheetSize === sz
                  ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                  : 'bg-[#FAF8F5] text-[#6B7A74] border-[#C5A059]/35 hover:text-[#1A2421]'
              }`}
            >
              {SHEET_DIMENSIONS[sz].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopyCncSummary}
          className="min-h-[34px] px-2.5 py-1 rounded-xl border border-[#C5A059]/45 bg-[#FAF8F5] hover:bg-[#F3ECE0] text-[11px] font-semibold text-[#0E3A2F] flex items-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>{copied ? 'Nusxalandi!' : 'CNC nusxalash'}</span>
        </button>
      </div>

      {/* 3 Core Nesting Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#C5A059]/35">
          <span className="text-[10px] text-[#6B7A74] flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#0E3A2F]" />
            Listlar
          </span>
          <p className="text-xs font-bold text-[#1A2421] font-mono-num mt-0.5">
            {nesting.totalSheetsFloat} ({nesting.totalSheetsCount} ta)
          </p>
        </div>

        <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#C5A059]/35">
          <span className="text-[10px] text-[#6B7A74]">Chiqindi</span>
          <p className="text-xs font-bold text-[#0E3A2F] font-mono-num mt-0.5">
            {nesting.wastePercent}%
          </p>
        </div>

        <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#C5A059]/35">
          <span className="text-[10px] text-[#6B7A74] flex items-center gap-1">
            <Scissors className="w-3 h-3 text-[#0E3A2F]" />
            Kromka
          </span>
          <p className="text-xs font-bold text-[#1A2421] font-mono-num mt-0.5">
            {nesting.totalEdgeBandingM} m
          </p>
        </div>
      </div>

      {/* Sheet Pagination Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {nesting.sheets.map((s, idx) => (
            <button
              key={s.sheetIndex}
              type="button"
              onClick={() => setActiveSheetIdx(idx)}
              className={`min-h-[32px] px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap ${
                safeSheetIndex === idx
                  ? 'bg-[#0E3A2F] text-white border border-[#C5A059]'
                  : 'bg-[#FAF8F5] text-[#6B7A74] border border-[#C5A059]/35 hover:text-[#1A2421]'
              }`}
            >
              List #{s.sheetIndex} ({s.parts.length} detal)
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-[#6B7A74]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#E2E8F0] border border-[#475569]" />
            Karkas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#E6F0EC] border border-[#0E3A2F]" />
            Fasad
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#FEF3C7] border border-[#C5A059]" />
            Polka
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#F3ECE1] border border-[#8B6F47]" />
            Tortma
          </span>
        </div>
      </div>

      {/* Interactive 2D Sheet SVG Packing Diagram */}
      {activeSheet && (
        <div className="rounded-2xl border border-[#C5A059]/45 bg-[#FAF8F5] p-2.5">
          <div className="flex items-center justify-between text-[10px] text-[#0E3A2F] font-semibold font-mono-num mb-2">
            <span>
              List #{activeSheet.sheetIndex} · {activeSheet.sheetWidthMm} ×{' '}
              {activeSheet.sheetHeightMm} mm
            </span>
            <span>Chiqindi: {activeSheet.wastePercent}%</span>
          </div>

          <svg
            viewBox={`0 0 ${activeSheet.sheetWidthMm} ${activeSheet.sheetHeightMm}`}
            className="w-full h-auto bg-white border border-[#C5A059]/50 rounded-xl shadow-inner"
          >
            {/* Subtle Technical Blueprint Grid */}
            <defs>
              <pattern id="sheetGridMm" width="200" height="200" patternUnits="userSpaceOnUse">
                <path
                  d="M 200 0 L 0 0 0 200"
                  fill="none"
                  stroke="rgba(15, 23, 42, 0.08)"
                  strokeWidth="2"
                />
              </pattern>
            </defs>
            <rect
              x={0}
              y={0}
              width={activeSheet.sheetWidthMm}
              height={activeSheet.sheetHeightMm}
              fill="url(#sheetGridMm)"
            />

            {/* Packed Rectangular Furniture Parts */}
            {activeSheet.parts.map((rect) => {
              const palette = ROLE_COLORS[rect.role] ?? ROLE_COLORS.carcass;
              const isHovered = hoveredPart?.partId === rect.partId;
              const fontSize = Math.max(24, Math.min(46, Math.min(rect.widthMm, rect.heightMm) * 0.14));
              const showLabel = rect.widthMm >= 180 && rect.heightMm >= 130;

              return (
                <g
                  key={rect.partId}
                  onMouseEnter={() => setHoveredPart(rect)}
                  onClick={() => setHoveredPart(rect)}
                  className="cursor-pointer"
                >
                  <rect
                    x={rect.xMm}
                    y={rect.yMm}
                    width={rect.widthMm}
                    height={rect.heightMm}
                    fill={palette.fill}
                    stroke={isHovered ? '#C5A059' : palette.stroke}
                    strokeWidth={isHovered ? 8 : 3}
                    rx={4}
                  />
                  {showLabel && (
                    <>
                      <text
                        x={rect.xMm + rect.widthMm / 2}
                        y={rect.yMm + rect.heightMm / 2 - fontSize * 0.35}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={palette.text}
                        fontSize={fontSize}
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {rect.widthMm}×{rect.heightMm}
                      </text>
                      <text
                        x={rect.xMm + rect.widthMm / 2}
                        y={rect.yMm + rect.heightMm / 2 + fontSize * 0.85}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={palette.text}
                        fontSize={Math.max(20, fontSize * 0.72)}
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {rect.name.slice(0, 18)}
                        {rect.rotated ? ' ↻' : ''}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Inspected Part Status Line */}
          <div className="mt-2.5 min-h-[28px] flex items-center justify-between text-xs text-[#0F172A]">
            {hoveredPart ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-semibold ${(ROLE_COLORS[hoveredPart.role] ?? ROLE_COLORS.carcass).badge}`}>
                  {hoveredPart.name}
                </span>
                <span className="font-mono-num font-bold text-[#0E3A2F]">
                  {hoveredPart.widthMm} × {hoveredPart.heightMm} mm
                </span>
                <span className="text-slate-600">· {hoveredPart.material}</span>
                <span className="text-slate-600">· Kromka: {hoveredPart.edgeBandingSides}</span>
                {hoveredPart.rotated && (
                  <span className="text-[#0E3A2F] font-semibold flex items-center gap-0.5">
                    <RotateCw className="w-3 h-3" /> 90° aylantirilgan
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-500">
                Detal ustiga bosing — aniq millimetr va kromka ma&apos;lumotini ko&apos;rasiz.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Editable Cutting Parts Table (for Workshop CNC Preparation) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-[#0E3A2F]">
            Kesish detallari ro&apos;yxati ({localParts.length} xil · {nesting.totalPartsCount} dona)
          </h4>
          {editable && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddPart}
                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-[#0E3A2F]" />
                <span>Detal qo&apos;shish</span>
              </button>
              {onSaveParts && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059]/75 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>{isSaving ? 'Saqlanmoqda...' : 'Raskroyni saqlash'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border border-[#E2E8F0] rounded-xl overflow-x-auto bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#0F172A] border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2 px-3 font-semibold">Detal nomi</th>
                <th className="py-2 px-2 font-semibold">Uzunlik (mm)</th>
                <th className="py-2 px-2 font-semibold">Kenglik (mm)</th>
                <th className="py-2 px-2 font-semibold">Soni</th>
                <th className="py-2 px-3 font-semibold">Material</th>
                {editable && <th className="py-2 px-2 font-semibold text-right">Amal</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {localParts.map((part, idx) => (
                <tr key={part.id} className="text-[#0F172A]">
                  <td className="py-2 px-3">
                    {editable ? (
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => handleUpdatePart(idx, { name: e.target.value })}
                        className="w-36 sm:w-44 px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0E3A2F]"
                      />
                    ) : (
                      <span className="font-medium">{part.name}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-mono-num">
                    {editable ? (
                      <input
                        type="number"
                        min={80}
                        max={2800}
                        value={part.lengthMm}
                        onChange={(e) =>
                          handleUpdatePart(idx, { lengthMm: Number(e.target.value) || 100 })
                        }
                        className="w-20 px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs font-mono-num focus:outline-none focus:ring-1 focus:ring-[#0E3A2F]"
                      />
                    ) : (
                      part.lengthMm
                    )}
                  </td>
                  <td className="py-2 px-2 font-mono-num">
                    {editable ? (
                      <input
                        type="number"
                        min={80}
                        max={2070}
                        value={part.widthMm}
                        onChange={(e) =>
                          handleUpdatePart(idx, { widthMm: Number(e.target.value) || 100 })
                        }
                        className="w-20 px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs font-mono-num focus:outline-none focus:ring-1 focus:ring-[#0E3A2F]"
                      />
                    ) : (
                      part.widthMm
                    )}
                  </td>
                  <td className="py-2 px-2 font-mono-num">
                    {editable ? (
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={part.qty}
                        onChange={(e) =>
                          handleUpdatePart(idx, { qty: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-14 px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs font-mono-num focus:outline-none focus:ring-1 focus:ring-[#0E3A2F]"
                      />
                    ) : (
                      `${part.qty} dona`
                    )}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-slate-600">{part.material}</td>
                  {editable && (
                    <td className="py-2 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeletePart(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        title="Detalni o'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
