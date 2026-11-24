import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useLang } from '../config/i18n';
import { playSoftClick } from '../utils/sound';

export type ToolbarItemId =
  | 'modeSwitch'
  | 'exitScanner'
  | 'receiptSlipToggle'
  | 'watchShop'
  | 'dressing'
  | 'guide'
  | 'testMode'
  | 'importExcel'
  | 'summary'
  | 'settings';

export const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'modeSwitch',
  'exitScanner',
  'receiptSlipToggle',
  'watchShop',
  'summary',
  'settings',
  'testMode',
  'importExcel',
  'dressing',
  'guide',
];

export const DEFAULT_HIDDEN_TOOLBAR_IDS: ToolbarItemId[] = [
  'testMode',
  'importExcel',
  'dressing',
  'guide',
];

export const DEFAULT_CASHIER_ALLOWED_IDS: ToolbarItemId[] = [
  'modeSwitch',
  'exitScanner',
  'receiptSlipToggle',
  'watchShop',
  'dressing',
  'guide',
];

interface ToolbarOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  toolbarOrder: ToolbarItemId[];
  hiddenToolbarIds: ToolbarItemId[];
  cashierAllowedIds: ToolbarItemId[];
  foodShopNameTh: string;
  foodShopNameEn: string;
  onChangeToolbarOrder: (next: ToolbarItemId[]) => void;
  onChangeHiddenToolbarIds: (next: ToolbarItemId[]) => void;
  onChangeCashierAllowedIds: (next: ToolbarItemId[]) => void;
  onResetDefault: () => void;
}

export const ToolbarOrganizerModal: React.FC<ToolbarOrganizerModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  toolbarOrder,
  hiddenToolbarIds,
  cashierAllowedIds,
  foodShopNameTh,
  foodShopNameEn,
  onChangeToolbarOrder,
  onChangeHiddenToolbarIds,
  onChangeCashierAllowedIds,
  onResetDefault,
}) => {
  const { lang, tx } = useLang();

  if (!isOpen) return null;

  const itemMeta: Record<
    ToolbarItemId,
    { label: string; desc: string; adminLock?: boolean }
  > = {
    modeSwitch: {
      label: tx(
        `สลับเครื่องคิดเลขแม่ / ${foodShopNameTh}`,
        `Switch Calculator / ${foodShopNameEn}`
      ),
      desc: tx('ปุ่มสลับหน้าคิดเงินกับหน้าสั่งอาหาร', 'Switch between POS Calculator and Food Orders'),
    },
    exitScanner: {
      label: tx('สแกนสลิปผ่านประตู', 'Exit Slip Scanner'),
      desc: tx('ส่อง QR ใบสลิปก่อนลูกค้าออกจากร้าน', 'Scan customer exit slip QR codes'),
    },
    receiptSlipToggle: {
      label: tx('ใบสลิป: เปิดแจก / หยุดให้', 'Receipt Slips: ON / PAUSED'),
      desc: tx('กดสลับเปิด-ปิดการออกใบสลิปหลังจ่ายเงิน', 'Toggle issuing receipt slips after payment'),
    },
    watchShop: {
      label: tx('เฝ้าร้านแทนแม่ (วิดีโอคอล)', 'Video Call Shop'),
      desc: tx('โทรดูหน้าร้านและช่วยกดแจ้งยอดทางไกล', 'Remote video call & shop assistance'),
    },
    summary: {
      label: tx('สรุปยอด / LINE / Excel', 'Summary / LINE / Excel'),
      desc: tx('ดูยอดขายวันนี้ ส่งสรุปเข้า LINE และส่งออก Excel', 'Daily sales totals, LINE report & Excel export'),
    },
    settings: {
      label: tx('ตั้งค่าร้าน & บัญชีธนาคาร', 'Shop Settings'),
      desc: tx('ตั้งค่าพร้อมเพย์ ธนาคาร เมนู และ Google Sheets', 'Configure banks, menu & Google Sheets'),
      adminLock: true,
    },
    testMode: {
      label: tx('โหมดขายจริง / โหมดทดสอบ', 'Live / Test Mode'),
      desc: tx('สลับโหมดทดสอบระบบไม่ให้ปนยอดขายจริง', 'Switch between live sales and test mode'),
      adminLock: true,
    },
    importExcel: {
      label: tx('นำเข้าสินค้า Excel & บาร์โค้ด', 'Import Products Excel'),
      desc: tx('เพิ่ม/แก้ไขรายการสินค้าและบาร์โค้ดจากไฟล์ Excel', 'Import or update barcode products from Excel'),
      adminLock: true,
    },
    dressing: {
      label: tx('ห้องแต่งตัวน้องหมี', 'Bear Dressing Room'),
      desc: tx('เปลี่ยนชุดน่ารักให้น้องหมี 5 ตัว', 'Customize outfits for the 5 bear mascots'),
    },
    guide: {
      label: tx('น้องหมีสอนใช้', 'Bear Usage Guide'),
      desc: tx('คู่มือวิธีใช้งานระบบขายหน้าร้าน', 'Quick interactive user guide'),
    },
  };

  const configurableItems = toolbarOrder.filter((id) => {
    if (!isAdmin && !cashierAllowedIds.includes(id)) return false;
    return true;
  });

  const moveItem = (id: ToolbarItemId, direction: -1 | 1) => {
    playSoftClick();
    const idx = configurableItems.indexOf(id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= configurableItems.length) return;
    const targetId = configurableItems[targetIdx];
    const next = [...toolbarOrder];
    const a = next.indexOf(id);
    const b = next.indexOf(targetId);
    if (a < 0 || b < 0) return;
    [next[a], next[b]] = [next[b], next[a]];
    onChangeToolbarOrder(next);
  };

  const toggleVisibility = (id: ToolbarItemId) => {
    playSoftClick();
    const isHidden = hiddenToolbarIds.includes(id);
    const next = isHidden
      ? hiddenToolbarIds.filter((item) => item !== id)
      : [...hiddenToolbarIds, id];
    onChangeHiddenToolbarIds(next);
  };

  const toggleCashierAllowed = (id: ToolbarItemId) => {
    playSoftClick();
    const allowed = cashierAllowedIds.includes(id);
    const next = allowed
      ? cashierAllowedIds.filter((item) => item !== id)
      : [...cashierAllowedIds, id];
    onChangeCashierAllowedIds(next);
  };

  const applyPresetMinimal = () => {
    playSoftClick();
    const keepVisible: ToolbarItemId[] = ['modeSwitch', 'exitScanner', 'receiptSlipToggle'];
    const hidden = toolbarOrder.filter((id) => !keepVisible.includes(id));
    onChangeHiddenToolbarIds(hidden);
  };

  const applyPresetShopStandard = () => {
    playSoftClick();
    const keepVisible: ToolbarItemId[] = [
      'modeSwitch',
      'exitScanner',
      'receiptSlipToggle',
      'summary',
      'settings',
    ];
    const hidden = toolbarOrder.filter((id) => !keepVisible.includes(id));
    onChangeHiddenToolbarIds(hidden);
  };

  const applyPresetShowAll = () => {
    playSoftClick();
    onChangeHiddenToolbarIds([]);
  };

  const visibleCount = configurableItems.filter((id) => !hiddenToolbarIds.includes(id)).length;
  const hiddenCount = configurableItems.length - visibleCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-4">
      <div
        className="w-full max-w-2xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {tx('จัดการ & ซ่อนปุ่มบนหน้าคิดเงิน', 'Organize & Hide POS Toolbar Buttons')}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  `กำลังแสดงหน้าหลัก ${visibleCount} ปุ่ม · ซ่อนลง "เมนูอื่น" ${hiddenCount} ปุ่ม`,
                  `Showing ${visibleCount} buttons on main bar · ${hiddenCount} tucked in "More"`
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl border flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            aria-label={tx('ปิดหน้าต่าง', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Presets */}
          <div
            className="rounded-2xl border p-3.5 space-y-2.5"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
          >
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-text)' }}>
              <Sparkles className="w-3.5 h-3.5" />
              {tx('จัดระเบียบด่วนใน 1 คลิก:', '1-Tap Quick Layouts:')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyPresetMinimal}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {tx('หน้าจอโล่ง (เฉพาะปุ่มขายหน้าร้าน)', 'Clean POS Only (Recommended)')}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={applyPresetShopStandard}
                  className="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--pastel-blue)',
                    borderColor: 'var(--border-soft)',
                    color: 'var(--pastel-blue-text)',
                  }}
                >
                  {tx('ปุ่มขาย + สรุปยอด + ตั้งค่า', 'POS + Summary + Settings')}
                </button>
              )}
              <button
                type="button"
                onClick={applyPresetShowAll}
                className="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-main)',
                }}
              >
                {tx('แสดงทุกปุ่ม', 'Show All')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  onResetDefault();
                }}
                className="px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer ml-auto"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-muted)',
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {tx('ค่าเริ่มต้น', 'Reset')}
              </button>
            </div>
          </div>

          {/* Per-Button Visibility & Permission List */}
          <div className="space-y-2">
            {configurableItems.map((id, idx) => {
              const meta = itemMeta[id];
              const isHidden = hiddenToolbarIds.includes(id);
              const cashierAllowed = cashierAllowedIds.includes(id);
              return (
                <div
                  key={id}
                  className="rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-3"
                  style={{
                    backgroundColor: isHidden ? 'var(--bg-subtle)' : 'var(--bg-card)',
                    borderColor: isHidden ? 'var(--border-soft)' : 'var(--accent-border)',
                  }}
                >
                  {/* Reorder Arrows + Label */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(id, -1)}
                        className="w-7 h-6 rounded-lg border flex items-center justify-center cursor-pointer disabled:opacity-30"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                        aria-label={tx('เลื่อนขึ้น', 'Move up')}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === configurableItems.length - 1}
                        onClick={() => moveItem(id, 1)}
                        className="w-7 h-6 rounded-lg border flex items-center justify-center cursor-pointer disabled:opacity-30"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                        aria-label={tx('เลื่อนลง', 'Move down')}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>
                        {meta.label}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Controls: Cashier Permission (Admin only) + Show/Hide Toggle */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isAdmin && !meta.adminLock && (
                      <button
                        type="button"
                        onClick={() => toggleCashierAllowed(id)}
                        className="px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        style={{
                          backgroundColor: cashierAllowed ? '#EFF6FF' : '#F5F5F4',
                          borderColor: cashierAllowed ? '#BFDBFE' : '#D6D3D1',
                          color: cashierAllowed ? '#1D4ED8' : '#78716C',
                        }}
                        title={tx(
                          'อนุญาตให้พนักงาน/คุณแม่เห็นปุ่มนี้หรือไม่',
                          'Allow non-admin staff to access this button'
                        )}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {cashierAllowed
                          ? tx('อนุญาตให้พนักงานใช้', 'Staff Allowed')
                          : tx('เฉพาะแอดมิน', 'Admin Only')}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleVisibility(id)}
                      className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: isHidden ? '#FFFFFF' : '#DCFCE7',
                        borderColor: isHidden ? 'var(--border-soft)' : '#86EFAC',
                        color: isHidden ? 'var(--text-muted)' : '#166534',
                      }}
                    >
                      {isHidden ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          {tx('ซ่อนอยู่ (ในเมนูอื่น)', 'Hidden (in More)')}
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          {tx('แสดงหน้าคิดเงิน', 'Visible on POS')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {lang === 'en'
              ? 'Hidden buttons are neatly tucked inside the "More" menu so the top bar stays clean and uncluttered.'
              : 'ปุ่มที่ซ่อนไว้จะถูกเก็บอย่างเป็นระเบียบในปุ่ม "เมนูอื่น" ด้านขวาบน กดเรียกใช้ได้ทุกเมื่อโดยไม่รกหน้าคิดเงินค่ะ'}
          </p>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3.5 border-t flex justify-end shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <button
            type="button"
            onClick={() => {
              playSoftClick();
              onClose();
            }}
            className="px-6 h-11 rounded-2xl font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {tx('บันทึก & ปิดหน้าต่าง', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
};
