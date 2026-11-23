import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { FaqItem, SHOP_CONFIG } from '../config/shopConfig';
import { translateFaq, useLang } from '../config/i18n';
import { playSoftClick } from '../utils/sound';

interface QuickFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  faqs: FaqItem[];
  shopNameTh: string;
  foodShopNameTh: string;
  faqModalTitle?: string;
  faqModalSubtitle?: string;
}

export const QuickFaqModal: React.FC<QuickFaqModalProps> = ({
  isOpen,
  onClose,
  faqs,
  shopNameTh,
  foodShopNameTh,
  faqModalTitle = SHOP_CONFIG.faqModalTitle,
  faqModalSubtitle = SHOP_CONFIG.faqModalSubtitle,
}) => {
  const { lang, tx } = useLang();
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  if (!isOpen) return null;

  const displayTitle =
    lang === 'en' && faqModalTitle.trim() === SHOP_CONFIG.faqModalTitle
      ? 'Little Bear Q&A Assistant'
      : faqModalTitle;
  const displaySubtitle =
    lang === 'en' && faqModalSubtitle.trim() === SHOP_CONFIG.faqModalSubtitle
      ? 'Tap any question below'
      : faqModalSubtitle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg max-h-[85vh] rounded-3xl border shadow-xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: 'var(--accent-soft)' }}
              aria-hidden="true"
            >
              🐻
            </span>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {displayTitle}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {lang === 'en'
                  ? `kookkikpaplern & Krua Mae Wang · ${displaySubtitle}`
                  : `${shopNameTh} & ${foodShopNameTh} · ${displaySubtitle}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            aria-label={tx('ปิดหน้าต่าง', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {faqs.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
              {tx('ยังไม่มีรายการคำถาม-คำตอบค่ะ', 'No FAQ items available yet.')}
            </p>
          ) : (
            faqs.map((rawFaq) => {
              const faq = translateFaq(rawFaq, lang);
              const expanded = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="rounded-2xl border overflow-hidden transition-colors"
                  style={{
                    backgroundColor: expanded ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                    borderColor: expanded ? 'var(--accent-border)' : 'var(--border-soft)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setOpenId(expanded ? null : faq.id);
                    }}
                    className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="font-bold text-sm sm:text-base" style={{ color: 'var(--text-main)' }}>
                      {faq.question}
                    </span>
                    {expanded ? (
                      <ChevronUp className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                    ) : (
                      <ChevronDown className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                  {expanded && (
                    <div
                      className="px-4 pb-4 pt-1 text-sm leading-relaxed border-t"
                      style={{ borderColor: 'var(--accent-border)', color: 'var(--text-main)' }}
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3.5 border-t shrink-0" style={{ borderColor: 'var(--border-soft)' }}>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {tx('ปิดหน้าต่าง', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
