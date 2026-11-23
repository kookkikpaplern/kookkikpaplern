import React, { useEffect, useState } from 'react';
import { Check, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  BEAR_CHARACTERS,
  BearFamilyOutfits,
  BearId,
  BearOutfit,
  DEFAULT_BEAR_OUTFITS,
  OUTFIT_CATALOG,
} from '../config/bearOutfits';
import { translateBearCharacter, translateOutfitLabel, useLang } from '../config/i18n';
import { playScanSuccess, playSoftClick } from '../utils/sound';
import { BearSinglePreview } from './BearGangMascot';

interface DressingRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedOutfits: BearFamilyOutfits;
  onSaveOutfits: (next: BearFamilyOutfits) => void;
}

type CategoryKey = keyof typeof OUTFIT_CATALOG;

export const DressingRoomModal: React.FC<DressingRoomModalProps> = ({
  isOpen,
  onClose,
  savedOutfits,
  onSaveOutfits,
}) => {
  const { lang, tx } = useLang();
  const [draftOutfits, setDraftOutfits] = useState<BearFamilyOutfits>(savedOutfits);
  const [selectedBear, setSelectedBear] = useState<BearId>('papa');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('hat');
  const [noticeKey, setNoticeKey] = useState<'saved' | 'reset' | ''>('');

  useEffect(() => {
    if (isOpen) {
      setDraftOutfits(structuredClone(savedOutfits));
      setNoticeKey('');
    }
  }, [isOpen, savedOutfits]);

  if (!isOpen) return null;

  const categoryTabs: Array<{ key: CategoryKey; label: string }> = [
    { key: 'hair', label: tx('ทรงผม', 'Hair') },
    { key: 'glasses', label: tx('แว่นตา', 'Glasses') },
    { key: 'hat', label: tx('หมวก / หมวกเชฟ', 'Hats / Chef Hat') },
    { key: 'bow', label: tx('โบว์', 'Bows') },
    { key: 'apron', label: tx('ผ้ากันเปื้อน', 'Aprons') },
    { key: 'bag', label: tx('กระเป๋า', 'Bags') },
    { key: 'fancy', label: tx('ชุดแฟนซี', 'Outfits') },
  ];

  const currentCharacter = BEAR_CHARACTERS.find((c) => c.id === selectedBear)!;
  const currentCharDisplay = translateBearCharacter(
    currentCharacter.id,
    currentCharacter.label,
    currentCharacter.role,
    lang
  );
  const currentOutfit = draftOutfits[selectedBear];

  const handleSelectItem = <K extends CategoryKey>(category: K, value: BearOutfit[K]) => {
    playSoftClick();
    setNoticeKey('');
    setDraftOutfits((prev) => ({
      ...prev,
      [selectedBear]: {
        ...prev[selectedBear],
        [category]: value,
      },
    }));
  };

  const handleSave = () => {
    playScanSuccess();
    onSaveOutfits(draftOutfits);
    setNoticeKey('saved');
  };

  const handleReset = () => {
    playSoftClick();
    const fresh = structuredClone(DEFAULT_BEAR_OUTFITS);
    setDraftOutfits(fresh);
    onSaveOutfits(fresh);
    setNoticeKey('reset');
  };

  const optionsForCategory = OUTFIT_CATALOG[activeCategory];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-5">
      <div
        className="w-full max-w-4xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-5 sm:px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
              {tx('👗 ห้องแต่งตัวครอบครัวหมี 5 ตัว', '👗 5-Bear Family Dressing Room')}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {tx(
                'เลือกแต่งตัวให้ พ่อหมี, แม่หมี, พี่สาวคนโต, แฝดพี่ และแฝดน้อง แล้วกดบันทึกได้เลยค่ะ',
                'Style Papa Bear, Mama Bear, Big Sister, Older Twin, and Younger Twin, then tap Save.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            aria-label={tx('ปิดห้องแต่งตัว', 'Close dressing room')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Character Selector Tabs */}
        <div
          className="flex gap-2 px-5 py-3 border-b overflow-x-auto shrink-0"
          style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
        >
          {BEAR_CHARACTERS.map((char) => {
            const active = selectedBear === char.id;
            const charDisplay = translateBearCharacter(char.id, char.label, char.role, lang);
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => {
                  playSoftClick();
                  setSelectedBear(char.id);
                }}
                className="px-4 py-2 rounded-2xl border text-sm font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-card)',
                  borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                  color: active ? '#FFFFFF' : 'var(--text-main)',
                }}
              >
                {charDisplay.label}
              </button>
            );
          })}
        </div>

        {/* Main Dressing Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* LEFT: Live Preview Stage */}
          <div
            className="md:col-span-5 rounded-3xl border-2 p-6 flex flex-col items-center justify-center text-center space-y-3"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--accent-border)',
            }}
          >
            <div className="min-h-[200px] w-full flex items-center justify-center">
              <BearSinglePreview bearId={selectedBear} outfit={currentOutfit} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {currentCharDisplay.label}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {currentCharDisplay.role}
              </p>
            </div>
          </div>

          {/* RIGHT: Real-time Item Pickers */}
          <div className="md:col-span-7 space-y-4">
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {categoryTabs.map((cat) => {
                const active = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setActiveCategory(cat.key);
                    }}
                    className="px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                      borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: active ? 'var(--accent-text)' : 'var(--text-main)',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Item Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {optionsForCategory.map((opt) => {
                const isSelected = currentOutfit[activeCategory] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      handleSelectItem(activeCategory, opt.id as BearOutfit[typeof activeCategory])
                    }
                    className="p-3.5 rounded-2xl border-2 text-left flex items-center justify-between gap-2 cursor-pointer transition-transform active:scale-[0.98]"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: isSelected ? 'var(--accent-text)' : 'var(--text-main)',
                    }}
                  >
                    <span className="font-semibold text-sm">
                      {translateOutfitLabel(activeCategory, opt.id, opt.label, lang)}
                    </span>
                    {isSelected && (
                      <span
                        className="w-6 h-6 rounded-full text-white flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {noticeKey && (
              <div
                className="rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2"
                style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  {noticeKey === 'saved'
                    ? tx(
                        'บันทึกชุดครอบครัวหมีเรียบร้อยแล้วค่ะ! ไปดูบนหน้าจอหลักได้เลย',
                        'Bear family outfits saved! Check them out on the main screen.'
                      )
                    : tx(
                        'รีเซ็ตกลับเป็นชุดดั้งเดิมทั้งหมดเรียบร้อยแล้วค่ะ',
                        'All bear outfits have been reset to defaults.'
                      )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="px-5 sm:px-6 py-4 border-t shrink-0 flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <button
            type="button"
            onClick={handleReset}
            className="h-12 px-4 rounded-2xl border font-semibold text-sm flex items-center gap-2 cursor-pointer"
            style={{
              backgroundColor: 'var(--pastel-peach)',
              borderColor: 'var(--border-soft)',
              color: 'var(--pastel-peach-text)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            {tx('รีเซ็ตชุดดั้งเดิม', 'Reset Outfits')}
          </button>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-5 rounded-2xl border font-semibold text-sm cursor-pointer"
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
            >
              {tx('ปิดหน้าต่าง', 'Close')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-12 px-6 rounded-2xl font-bold text-white text-sm sm:text-base flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Check className="w-4 h-4" />
              {tx('บันทึกชุดปัจจุบัน', 'Save Current Outfits')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

