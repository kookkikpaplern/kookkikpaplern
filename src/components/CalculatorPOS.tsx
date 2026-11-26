import React, { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  Camera,
  ChevronLeft,
  ChevronRight,
  Delete,
  Heart,
  ImagePlus,
  QrCode,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { BillLineItem } from '../utils/sheetsSync';
import { BearFamilyOutfits } from '../config/bearOutfits';
import { translateMenuName, useLang } from '../config/i18n';
import { compressMemoryPhotoFile } from '../utils/imageUpload';
import { playSoftClick } from '../utils/sound';
import { BearGangMascot } from './BearGangMascot';

const MEMORY_PHOTOS_STORAGE_KEY = 'kkp_mom_memory_photos_v2';
const LEGACY_MEMORY_PHOTOS_STORAGE_KEY = 'kkp_mom_memory_photos_v1';
const MAX_MEMORY_PHOTOS = 8;

const DEFAULT_MEMORY_PHOTOS: string[] = [
  '/assets/aistudio/603081028_122102001849172645_7066405203052875247_n_44e4a3ed.jpg',
  '/assets/aistudio/603902838_122102000931172645_5804029287773545388_n_712ab992.jpg',
  '/assets/aistudio/514726274_24034889729475888_1100481272007346060_n_2c8f93da.jpg',
  '/assets/aistudio/627987243_25901347492830093_8138760102041624349_n_50a0b736.jpg',
];

interface CalculatorPOSProps {
  billItems: BillLineItem[];
  outfits: BearFamilyOutfits;
  onAddManualAmount: (amount: number, label?: string) => void;
  onRemoveItem: (index: number) => void;
  onClearBill: () => void;
  onOpenScanner: () => void;
  onOpenCashModal: (total: number) => void;
  onOpenQrModal: (total: number) => void;
}

type CalcOp = '+' | '-' | '×' | '÷';

export const CalculatorPOS: React.FC<CalculatorPOSProps> = ({
  billItems,
  outfits,
  onAddManualAmount,
  onRemoveItem,
  onClearBill,
  onOpenScanner,
  onOpenCashModal,
  onOpenQrModal,
}) => {
  const { lang, tx } = useLang();
  const [inputValue, setInputValue] = useState('0');
  const [pendingLeft, setPendingLeft] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<CalcOp | null>(null);
  const [awaitingSecondOperand, setAwaitingSecondOperand] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [calcError, setCalcError] = useState('');

  // ภาพความสุขระหว่างรอ (เช่น ทริปญี่ปุ่นของแม่) — ซ่อนอัตโนมัติทันทีที่เริ่มคิดเงิน
  const memoryInputRef = useRef<HTMLInputElement>(null);
  const [memoryPhotos, setMemoryPhotos] = useState<string[]>(() => {
    try {
      const rawV2 = localStorage.getItem(MEMORY_PHOTOS_STORAGE_KEY);
      if (rawV2 !== null) {
        const parsed = JSON.parse(rawV2);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
      }
      const rawV1 = localStorage.getItem(LEGACY_MEMORY_PHOTOS_STORAGE_KEY);
      const legacy = rawV1 ? (JSON.parse(rawV1) as unknown[]) : [];
      const legacyValid = Array.isArray(legacy)
        ? legacy.filter((x): x is string => typeof x === 'string')
        : [];
      const initial = [...DEFAULT_MEMORY_PHOTOS, ...legacyValid].slice(0, MAX_MEMORY_PHOTOS);
      localStorage.setItem(MEMORY_PHOTOS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    } catch {
      return DEFAULT_MEMORY_PHOTOS;
    }
  });
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [photoError, setPhotoError] = useState('');

  const isCharging = billItems.length > 0 || inputValue !== '0' || pendingOp !== null;

  useEffect(() => {
    if (activePhotoIdx >= memoryPhotos.length && memoryPhotos.length > 0) {
      setActivePhotoIdx(0);
    }
  }, [memoryPhotos.length, activePhotoIdx]);

  useEffect(() => {
    if (isCharging || memoryPhotos.length <= 1) return;
    const timer = window.setInterval(() => {
      setActivePhotoIdx((prev) => (prev + 1) % memoryPhotos.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isCharging, memoryPhotos.length]);

  const persistMemoryPhotos = (next: string[]) => {
    setMemoryPhotos(next);
    try {
      localStorage.setItem(MEMORY_PHOTOS_STORAGE_KEY, JSON.stringify(next));
      setPhotoError('');
    } catch {
      setPhotoError(
        tx(
          'พื้นที่เก็บรูปเต็ม ลองลบบางรูปออกก่อนนะคะ',
          'Storage limit reached — please remove an older photo first.'
        )
      );
    }
  };

  const handleUploadMemoryPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, MAX_MEMORY_PHOTOS - memoryPhotos.length);
    if (remainingSlots === 0) {
      setPhotoError(
        tx(
          `อัปโหลดได้สูงสุด ${MAX_MEMORY_PHOTOS} รูปค่ะ ลบรูปเดิมออกก่อนเพิ่มใหม่นะคะ`,
          `Up to ${MAX_MEMORY_PHOTOS} photos allowed. Remove one before adding more.`
        )
      );
      return;
    }

    try {
      const compressed: string[] = [];
      for (const file of files.slice(0, remainingSlots)) {
        const dataUrl = await compressMemoryPhotoFile(file);
        compressed.push(dataUrl);
      }
      const next = [...memoryPhotos, ...compressed];
      persistMemoryPhotos(next);
      setActivePhotoIdx(memoryPhotos.length);
    } catch {
      setPhotoError(
        tx(
          'ไม่สามารถอ่านไฟล์รูปนี้ได้ กรุณาลองเลือกรูปอื่นนะคะ',
          'Could not read this image file. Please try another photo.'
        )
      );
    }
  };

  const handleRemoveCurrentPhoto = () => {
    if (memoryPhotos.length === 0) return;
    playSoftClick();
    const next = memoryPhotos.filter((_, idx) => idx !== activePhotoIdx);
    persistMemoryPhotos(next);
    setActivePhotoIdx((prev) => (next.length === 0 ? 0 : Math.min(prev, next.length - 1)));
  };

  const computeBinary = (left: number, op: CalcOp, right: number): number | null => {
    if (op === '÷' && right === 0) {
      return null;
    }
    let raw = 0;
    if (op === '+') raw = left + right;
    else if (op === '-') raw = left - right;
    else if (op === '×') raw = left * right;
    else if (op === '÷') raw = left / right;
    return Number(raw.toFixed(6));
  };

  const formatCalcNumber = (num: number): string => {
    const rounded = Math.round(num * 100) / 100;
    return String(rounded);
  };

  const resolvePendingCalculation = (): { ok: boolean; value: number } => {
    const rightVal = parseFloat(inputValue) || 0;
    if (pendingOp !== null && pendingLeft !== null) {
      if (awaitingSecondOperand) {
        return { ok: true, value: pendingLeft };
      }
      const computed = computeBinary(pendingLeft, pendingOp, rightVal);
      if (computed === null) {
        setCalcError(tx('หารด้วย 0 ไม่ได้ค่ะ', 'Cannot divide by zero'));
        return { ok: false, value: 0 };
      }
      return { ok: true, value: Math.round(computed * 100) / 100 };
    }
    return { ok: true, value: Math.round(rightVal * 100) / 100 };
  };

  const billTotal = billItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const currentEntry = parseFloat(inputValue) || 0;
  const effectiveCalcAmount =
    pendingOp !== null && pendingLeft !== null
      ? awaitingSecondOperand
        ? pendingLeft
        : (computeBinary(pendingLeft, pendingOp, currentEntry) ?? currentEntry)
      : currentEntry;
  const roundedEffectiveCalc = Math.round(effectiveCalcAmount * 100) / 100;
  const displayAmount = Math.max(
    0,
    Math.round((billTotal + (roundedEffectiveCalc > 0 ? roundedEffectiveCalc : 0)) * 100) / 100
  );

  const handleDigit = (d: string) => {
    playSoftClick();
    setCalcError('');
    if (awaitingSecondOperand || justEvaluated) {
      setAwaitingSecondOperand(false);
      setJustEvaluated(false);
      setInputValue(d === '.' ? '0.' : d);
      return;
    }
    if (d === '.' && inputValue.includes('.')) return;
    if (inputValue === '0' && d !== '.') {
      setInputValue(d);
    } else if (inputValue.length < 10) {
      setInputValue(inputValue + d);
    }
  };

  const handleBackspace = () => {
    playSoftClick();
    setCalcError('');
    if (awaitingSecondOperand) {
      setPendingOp(null);
      setPendingLeft(null);
      setAwaitingSecondOperand(false);
      return;
    }
    setJustEvaluated(false);
    if (inputValue.length <= 1 || (inputValue.length === 2 && inputValue.startsWith('-'))) {
      setInputValue('0');
    } else {
      setInputValue(inputValue.slice(0, -1));
    }
  };

  const handleOperator = (nextOp: CalcOp) => {
    playSoftClick();
    setCalcError('');
    const currentVal = parseFloat(inputValue) || 0;

    if (pendingOp !== null && pendingLeft !== null) {
      if (awaitingSecondOperand) {
        setPendingOp(nextOp);
        return;
      }
      const computed = computeBinary(pendingLeft, pendingOp, currentVal);
      if (computed === null) {
        setCalcError(tx('หารด้วย 0 ไม่ได้ค่ะ', 'Cannot divide by zero'));
        return;
      }
      const formatted = formatCalcNumber(computed);
      setInputValue(formatted);
      setPendingLeft(computed);
      setPendingOp(nextOp);
      setAwaitingSecondOperand(true);
      setJustEvaluated(false);
      return;
    }

    setPendingLeft(currentVal);
    setPendingOp(nextOp);
    setAwaitingSecondOperand(true);
    setJustEvaluated(false);
  };

  const handleEquals = () => {
    playSoftClick();
    setCalcError('');
    if (pendingOp === null || pendingLeft === null) return;
    const rightVal = parseFloat(inputValue) || 0;
    const computed = awaitingSecondOperand
      ? pendingLeft
      : computeBinary(pendingLeft, pendingOp, rightVal);
    if (computed === null) {
      setCalcError(tx('หารด้วย 0 ไม่ได้ค่ะ', 'Cannot divide by zero'));
      return;
    }
    setInputValue(formatCalcNumber(computed));
    setPendingLeft(null);
    setPendingOp(null);
    setAwaitingSecondOperand(false);
    setJustEvaluated(true);
  };

  const handleAddToBill = () => {
    playSoftClick();
    setCalcError('');
    const resolved = resolvePendingCalculation();
    if (!resolved.ok) return;
    const val = resolved.value;
    if (val > 0) {
      onAddManualAmount(
        val,
        tx(
          `รายการคิดเงิน ฿${val.toLocaleString('th-TH')}`,
          `Manual Item ฿${val.toLocaleString('en-US')}`
        )
      );
      setInputValue('0');
      setPendingLeft(null);
      setPendingOp(null);
      setAwaitingSecondOperand(false);
      setJustEvaluated(false);
    }
  };

  const handleClearCalculatorOrBill = () => {
    playSoftClick();
    setCalcError('');
    if (inputValue !== '0' || pendingOp !== null || pendingLeft !== null) {
      setInputValue('0');
      setPendingLeft(null);
      setPendingOp(null);
      setAwaitingSecondOperand(false);
      setJustEvaluated(false);
      return;
    }
    onClearBill();
  };

  const handleResetAll = () => {
    playSoftClick();
    setCalcError('');
    setInputValue('0');
    setPendingLeft(null);
    setPendingOp(null);
    setAwaitingSecondOperand(false);
    setJustEvaluated(false);
    onClearBill();
  };

  const commitAndPay = (method: 'cash' | 'qr') => {
    playSoftClick();
    setCalcError('');
    const resolved = resolvePendingCalculation();
    if (!resolved.ok) return;
    const val = resolved.value;
    let finalTotal = billTotal;
    if (val > 0) {
      onAddManualAmount(
        val,
        tx(
          `รายการคิดเงิน ฿${val.toLocaleString('th-TH')}`,
          `Manual Item ฿${val.toLocaleString('en-US')}`
        )
      );
      finalTotal = Math.round((finalTotal + val) * 100) / 100;
      setInputValue('0');
      setPendingLeft(null);
      setPendingOp(null);
      setAwaitingSecondOperand(false);
      setJustEvaluated(false);
    }
    if (finalTotal <= 0) return;
    if (method === 'cash') {
      onOpenCashModal(finalTotal);
    } else {
      onOpenQrModal(finalTotal);
    }
  };

  const expressionLabel =
    pendingOp !== null && pendingLeft !== null
      ? awaitingSecondOperand
        ? `${pendingLeft.toLocaleString('th-TH')} ${pendingOp}`
        : `${pendingLeft.toLocaleString('th-TH')} ${pendingOp} ${inputValue}`
      : inputValue !== '0'
        ? tx(`กำลังคิดเลข: ฿${inputValue}`, `Calculating: ฿${inputValue}`)
        : tx('ยอดรวมทั้งหมด', 'Grand Total');

  const mainCalcDisplay =
    pendingOp !== null || justEvaluated || inputValue !== '0'
      ? Number.isFinite(parseFloat(inputValue))
        ? inputValue
        : '0'
      : billTotal.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT: Calculator Display + Large Numpad */}
      <div
        className="lg:col-span-7 rounded-3xl border p-5 sm:p-6 shadow-sm space-y-5"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
        }}
      >
        {/* Display Panel */}
        <div
          className="rounded-2xl border p-4 sm:p-5 flex flex-col justify-between min-h-[128px]"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-soft)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-sm font-num font-semibold block truncate" style={{ color: 'var(--text-muted)' }}>
                {expressionLabel}
              </span>
              {billTotal > 0 && (pendingOp !== null || justEvaluated || inputValue !== '0') && (
                <span className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                  {tx(
                    `ในบิลเดิม ฿${billTotal.toLocaleString('th-TH')} · รวมทั้งหมด ฿${displayAmount.toLocaleString('th-TH')}`,
                    `Bill ฿${billTotal.toLocaleString('en-US')} · Combined ฿${displayAmount.toLocaleString('en-US')}`
                  )}
                </span>
              )}
              {calcError && (
                <span className="text-xs font-bold text-rose-600 block mt-0.5">{calcError}</span>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-transform active:scale-95 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--pastel-blue)',
                borderColor: 'var(--border-soft)',
                color: 'var(--pastel-blue-text)',
              }}
            >
              <Camera className="w-4 h-4" />
              {tx('สแกนบาร์โค้ด', 'Scan Barcode')}
            </button>
          </div>
          <div className="text-right pt-2">
            <span
              className="font-num text-4xl sm:text-5xl font-bold tracking-tight tabular-nums"
              style={{ color: 'var(--text-main)' }}
            >
              {pendingOp === null && !justEvaluated && inputValue === '0' ? '฿' : ''}
              {mainCalcDisplay}
            </span>
          </div>
        </div>

        {/* Large Senior-Friendly Full Arithmetic + POS Numpad (5 rows x 4 cols) */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1: Clear, Backspace, ÷, × */}
          <button
            type="button"
            onClick={handleClearCalculatorOrBill}
            className="h-16 sm:h-[70px] rounded-2xl border text-base font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--pastel-peach)',
              borderColor: 'var(--border-soft)',
              color: 'var(--pastel-peach-text)',
            }}
            title={tx('ล้างเลขบนจอ (กดซ้ำเพื่อล้างบิล)', 'Clear entry (tap again to clear bill)')}
          >
            <RotateCcw className="w-4 h-4" />
            {inputValue !== '0' || pendingOp !== null ? tx('C ล้างเลข', 'Clear') : tx('ล้างค่า', 'Reset')}
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            aria-label={tx('ลบตัวเลข', 'Backspace')}
            className="h-16 sm:h-[70px] rounded-2xl border flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-main)',
            }}
          >
            <Delete className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={() => handleOperator('÷')}
            aria-label={tx('หาร', 'Divide')}
            className="h-16 sm:h-[70px] rounded-2xl border-2 text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: pendingOp === '÷' ? 'var(--accent-primary)' : 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: pendingOp === '÷' ? '#FFFFFF' : 'var(--accent-text)',
            }}
          >
            ÷
          </button>

          <button
            type="button"
            onClick={() => handleOperator('×')}
            aria-label={tx('คูณ', 'Multiply')}
            className="h-16 sm:h-[70px] rounded-2xl border-2 text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: pendingOp === '×' ? 'var(--accent-primary)' : 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: pendingOp === '×' ? '#FFFFFF' : 'var(--accent-text)',
            }}
          >
            ×
          </button>

          {/* Row 2: 7, 8, 9, − */}
          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-16 sm:h-[70px] rounded-2xl border text-2xl sm:text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-soft)',
                color: 'var(--text-main)',
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('-')}
            aria-label={tx('ลบ', 'Subtract')}
            className="h-16 sm:h-[70px] rounded-2xl border-2 text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: pendingOp === '-' ? 'var(--accent-primary)' : 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: pendingOp === '-' ? '#FFFFFF' : 'var(--accent-text)',
            }}
          >
            −
          </button>

          {/* Row 3: 4, 5, 6, + */}
          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-16 sm:h-[70px] rounded-2xl border text-2xl sm:text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-soft)',
                color: 'var(--text-main)',
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('+')}
            aria-label={tx('บวก', 'Add')}
            className="h-16 sm:h-[70px] rounded-2xl border-2 text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: pendingOp === '+' ? 'var(--accent-primary)' : 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: pendingOp === '+' ? '#FFFFFF' : 'var(--accent-text)',
            }}
          >
            +
          </button>

          {/* Row 4: 1, 2, 3, = */}
          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-16 sm:h-[70px] rounded-2xl border text-2xl sm:text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-soft)',
                color: 'var(--text-main)',
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleEquals}
            aria-label={tx('เท่ากับ', 'Equals')}
            className="h-16 sm:h-[70px] rounded-2xl border-2 text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--pastel-blue)',
              borderColor: 'var(--border-soft)',
              color: 'var(--pastel-blue-text)',
            }}
          >
            =
          </button>

          {/* Row 5: 0 (span 2), ., + ลงบิล */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="col-span-2 h-16 sm:h-[70px] rounded-2xl border text-2xl sm:text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-main)',
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleDigit('.')}
            className="h-16 sm:h-[70px] rounded-2xl border text-2xl sm:text-3xl font-num font-bold cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-main)',
            }}
          >
            .
          </button>
          <button
            type="button"
            onClick={handleAddToBill}
            disabled={roundedEffectiveCalc <= 0}
            className="h-16 sm:h-[70px] rounded-2xl text-sm sm:text-base font-bold text-white cursor-pointer transition-transform active:scale-95 disabled:opacity-45 px-2 leading-tight"
            style={{ backgroundColor: 'var(--accent-primary)' }}
            title={tx('เพิ่มยอดนี้ลงในรายการบิลด้านขวา', 'Add this amount to the bill')}
          >
            {tx('+ ลงบิล', '+ To Bill')}
          </button>
        </div>
      </div>

      {/* RIGHT: Bill Items + Payment Card with 3 Bear Gang Clinging to Top Border */}
      <div className="lg:col-span-5 space-y-5">
        {/* Current Bill Items OR Idle Happy Memory Photo Frame (Auto-hides while charging) */}
        <div
          className="rounded-3xl border p-5 shadow-sm"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-soft)',
          }}
        >
          <input
            ref={memoryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUploadMemoryPhotos}
            className="hidden"
          />

          {!isCharging && memoryPhotos.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-text)' }}>
                  <Heart className="w-4 h-4 fill-current shrink-0" />
                  {tx('ภาพความสุขระหว่างรอลูกค้า', 'Happy Memories While Waiting')}
                </h2>
                <div className="flex items-center gap-1.5">
                  {memoryPhotos.length < MAX_MEMORY_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        memoryInputRef.current?.click();
                      }}
                      className="text-xs font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--accent-border)',
                        color: 'var(--accent-text)',
                      }}
                      title={tx('เพิ่มรูปทริปเที่ยว', 'Add photo')}
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {tx('เพิ่มรูป', 'Add')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveCurrentPhoto}
                    className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                    style={{
                      backgroundColor: 'var(--pastel-pink)',
                      borderColor: 'var(--border-soft)',
                      color: 'var(--pastel-pink-text)',
                    }}
                    title={tx('ลบรูปนี้', 'Remove this photo')}
                    aria-label={tx('ลบรูปนี้', 'Remove this photo')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                className="relative w-full h-56 sm:h-64 rounded-2xl border overflow-hidden flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-soft)',
                }}
              >
                <img
                  src={memoryPhotos[activePhotoIdx] || memoryPhotos[0]}
                  alt={tx('ภาพความสุขของแม่', "Mom's happy trip photo")}
                  className="w-full h-full object-contain"
                />

                {memoryPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setActivePhotoIdx((prev) => (prev - 1 + memoryPhotos.length) % memoryPhotos.length);
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center cursor-pointer hover:bg-black/60"
                      aria-label={tx('รูปก่อนหน้า', 'Previous photo')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setActivePhotoIdx((prev) => (prev + 1) % memoryPhotos.length);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center cursor-pointer hover:bg-black/60"
                      aria-label={tx('รูปถัดไป', 'Next photo')}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40">
                      {memoryPhotos.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            idx === activePhotoIdx ? 'w-4 bg-white' : 'w-2 bg-white/55'
                          }`}
                          aria-label={tx(`รูปที่ ${idx + 1}`, `Photo ${idx + 1}`)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  'เริ่มกดเลขหรือยิงบาร์โค้ดเมื่อไหร่ รูปจะซ่อนอัตโนมัติทันทีค่ะ',
                  'Automatically hides the moment you type a price or scan an item'
                )}
              </p>
              {photoError && (
                <p className="text-xs text-center text-rose-600 font-medium">{photoError}</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx(
                    `รายการในบิลนี้ (${billItems.reduce((s, i) => s + i.qty, 0)} ชิ้น)`,
                    `Current Bill (${billItems.reduce((s, i) => s + i.qty, 0)} pcs)`
                  )}
                </h2>
                {billItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="text-xs font-medium px-2.5 py-1 rounded-xl cursor-pointer"
                    style={{
                      backgroundColor: 'var(--pastel-pink)',
                      color: 'var(--pastel-pink-text)',
                    }}
                  >
                    {tx('ล้างบิล', 'Clear Bill')}
                  </button>
                )}
              </div>

              {billItems.length === 0 ? (
                <div
                  className="rounded-2xl border border-dashed py-6 px-4 text-center space-y-3"
                  style={{
                    borderColor: 'var(--border-soft)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <p className="text-sm">
                    {tx(
                      'กดคิดเลข (+ − × ÷ =) แล้วกด "+ ลงบิล" หรือรับเงินได้เลยค่ะ',
                      'Calculate (+ − × ÷ =) and tap "+ To Bill" or pay directly!'
                    )}
                  </p>
                  {!isCharging && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          memoryInputRef.current?.click();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-bold cursor-pointer transition-transform active:scale-95"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          borderColor: 'var(--accent-border)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        <ImagePlus className="w-4 h-4" />
                        {tx(
                          'อัปโหลดภาพความสุขให้แม่ (เช่น รูปเที่ยวญี่ปุ่น)',
                          "Upload Mom's Happy Trip Photo (Auto-hides on checkout)"
                        )}
                      </button>
                      {photoError && (
                        <p className="text-xs text-rose-600 font-medium mt-2">{photoError}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <ul className="divide-y max-h-52 overflow-y-auto pr-1" style={{ borderColor: 'var(--border-soft)' }}>
                  {billItems.map((item, idx) => {
                    const displayName = translateMenuName(item.name, lang);
                    return (
                      <li key={`${item.id}_${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                            {displayName}
                          </p>
                          <p className="text-xs font-num" style={{ color: 'var(--text-muted)' }}>
                            ฿{item.price.toLocaleString('th-TH')} × {item.qty}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-num font-bold text-base tabular-nums" style={{ color: 'var(--text-main)' }}>
                            ฿{(item.price * item.qty).toLocaleString('th-TH')}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(idx)}
                            aria-label={tx(`ลบ ${displayName}`, `Remove ${displayName}`)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                            style={{
                              backgroundColor: 'var(--pastel-pink)',
                              color: 'var(--pastel-pink-text)',
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Payment Box with 3 Bears Clinging on Top Edge */}
        <div className="pt-2">
          <div className="-mb-3.5 relative z-10 px-4">
            <BearGangMascot pose="peeking" outfits={outfits} />
          </div>

          <div
            className="relative z-20 rounded-3xl border-2 p-5 sm:p-6 shadow-sm space-y-4"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--accent-border)',
            }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>
                {tx('ยอดต้องชำระ', 'Amount Due')}
              </span>
              <span
                className="font-num text-3xl sm:text-4xl font-bold tabular-nums"
                style={{ color: 'var(--accent-text)' }}
              >
                ฿{displayAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={displayAmount <= 0}
                onClick={() => commitAndPay('cash')}
                className="h-16 rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-2.5 shadow-sm transition-transform active:scale-[0.98] disabled:opacity-45 cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                <Banknote className="w-6 h-6" />
                {tx('รับเงินสด', 'Cash')}
              </button>
              <button
                type="button"
                disabled={displayAmount <= 0}
                onClick={() => commitAndPay('qr')}
                className="h-16 rounded-2xl border-2 font-bold text-lg flex items-center justify-center gap-2.5 transition-transform active:scale-[0.98] disabled:opacity-45 cursor-pointer"
                style={{
                  backgroundColor: 'var(--pastel-blue)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--pastel-blue-text)',
                }}
              >
                <QrCode className="w-6 h-6" />
                {tx('สแกนจ่าย QR', 'Scan QR')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
