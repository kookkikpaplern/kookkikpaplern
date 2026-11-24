import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  ShoppingCart,
  Sparkles,
  Star,
  Utensils,
} from 'lucide-react';
import { BearFamilyOutfits } from '../config/bearOutfits';
import {
  LanguageToggleButton,
  translatePromoSubtitle,
  translatePromoTitle,
  translateRewardNotice,
  useLang,
} from '../config/i18n';
import { MenuItem, SHOP_CONFIG } from '../config/shopConfig';
import { playSoftClick } from '../utils/sound';
import { BarcodeDonationHub } from './BarcodeDonationHub';
import { BearGangMascot } from './BearGangMascot';

interface WelcomeLandingProps {
  shopNameTh: string;
  shopNameEn: string;
  foodShopNameTh: string;
  foodShopNameEn: string;
  promoTitle: string;
  promoSubtitle: string;
  rewardNotice: string;
  faqBubbleText: string;
  logoUrl: string | null;
  outfits: BearFamilyOutfits;
  menuItems: MenuItem[];
  onDonateProduct: (item: MenuItem) => { ok: boolean; reason?: string };
  onEnterCustomerOrder: () => void;
  onOpenMemberRewards: () => void;
  onEnterStaffLogin: () => void;
  onOpenFaqModal: () => void;
}

export const WelcomeLanding: React.FC<WelcomeLandingProps> = ({
  shopNameTh,
  shopNameEn,
  foodShopNameTh,
  foodShopNameEn,
  promoTitle,
  promoSubtitle,
  rewardNotice,
  faqBubbleText,
  logoUrl,
  outfits,
  menuItems,
  onDonateProduct,
  onEnterCustomerOrder,
  onOpenMemberRewards,
  onEnterStaffLogin,
  onOpenFaqModal,
}) => {
  const { lang, tx } = useLang();
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const staffMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!staffMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (staffMenuRef.current && !staffMenuRef.current.contains(e.target as Node)) {
        setStaffMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [staffMenuOpen]);

  const primaryShopName = lang === 'en' ? shopNameEn : shopNameTh;
  const secondaryShopLine =
    lang === 'en'
      ? `${shopNameTh} · 🍲 ${foodShopNameEn} (${foodShopNameTh})`
      : `${shopNameEn} · 🍲 ${foodShopNameTh} (${foodShopNameEn})`;

  return (
    <div
      className="min-h-screen px-4 py-6 sm:py-10"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-main)' }}
    >
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Top Dual-Shop Header with Discreet Staff Login Hidden in Top-Left Bear + Language Switch */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 relative" ref={staffMenuRef}>
            <button
              type="button"
              onClick={() => {
                playSoftClick();
                setStaffMenuOpen((prev) => !prev);
              }}
              title={tx('คนในร้านเข้าสู่ระบบ', 'Staff Sign In')}
              aria-label={tx('เปิดเมนูคนในร้านเข้าสู่ระบบ', 'Open Staff Login Menu')}
              className="relative w-[56px] h-[56px] rounded-2xl border-2 overflow-visible flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}
            >
              <span className="w-full h-full rounded-[14px] overflow-hidden flex items-center justify-center">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${tx('โลโก้ร้าน', 'Shop Logo')} ${primaryShopName}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl leading-none" aria-hidden="true">🐻</span>
                )}
              </span>
              {/* Subtle tiny lock indicator on corner of bear logo */}
              <span
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-xs"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-muted)',
                }}
              >
                <LockKeyhole className="w-2.5 h-2.5" />
              </span>
            </button>

            {/* Discreet Staff Login Popover Hidden Inside Bear Avatar */}
            {staffMenuOpen && (
              <div
                className="absolute left-0 top-[64px] z-40 rounded-2xl border shadow-lg p-2.5 min-w-[215px]"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--accent-border)',
                }}
              >
                <p className="text-[11px] font-medium px-2 pb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tx('สำหรับแม่ · พ่อ · พี่เพลิน · กุ๊ก · กิ๊ก', 'For Mom · Dad · Plern · Kook · Kik')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playSoftClick();
                    setStaffMenuOpen(false);
                    onEnterStaffLogin();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <LockKeyhole className="w-3.5 h-3.5 shrink-0" />
                  {tx('คนในร้านเข้าสู่ระบบ', 'Staff Sign In')}
                </button>
              </div>
            )}

            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">
                ⭐ {primaryShopName} ⭐
              </h1>
              <p className="text-xs sm:text-sm font-en font-medium" style={{ color: 'var(--text-muted)' }}>
                {secondaryShopLine}
              </p>
            </div>
          </div>

          <LanguageToggleButton />
        </header>

        {/* Rounded Promotional Ad Banner with Interactive 3 Bears & Overhead Speech Bubble */}
        <section className="pt-1">
          <div className="relative z-10 flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                playSoftClick();
                onOpenFaqModal();
              }}
              aria-label={tx('สอบถามน้องหมี ถาม-ตอบอัตโนมัติ', 'Ask Little Bear (Auto Q&A)')}
              className="group flex flex-col items-center cursor-pointer focus:outline-none"
            >
              {/* Speech Bubble above Bears' Heads */}
              <div className="relative mb-2 transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95">
                <div
                  className="px-4 py-2 rounded-2xl border-2 shadow-sm text-xs sm:text-sm font-bold flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--accent-primary)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  <span>
                    {lang === 'en' && faqBubbleText.trim() === SHOP_CONFIG.faqBubbleText
                      ? 'Have a question? Tap me—I’d love to answer!'
                      : faqBubbleText}
                  </span>
                </div>
                {/* Downward Speech Bubble Tail */}
                <div
                  className="w-3 h-3 rotate-45 border-r-2 border-b-2 mx-auto -mt-1.5"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--accent-primary)',
                  }}
                />
              </div>

              {/* Clickable 3 Bears Mascot Clinging to Top Edge */}
              <div className="-mb-3.5 px-6 transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-[0.98]">
                <BearGangMascot pose="peeking" outfits={outfits} />
              </div>
            </button>
          </div>

          <div
            className="relative z-20 rounded-3xl border-2 p-6 sm:p-8 shadow-sm space-y-5"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--accent-border)',
            }}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold" style={{ color: 'var(--accent-text)' }}>
              <Megaphone className="w-4 h-4" />
              <span>{tx('ป้ายประกาศ & โปรโมชันประจำร้าน', 'Shop Announcements & Promotions')}</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold leading-snug" style={{ color: 'var(--text-main)' }}>
                {translatePromoTitle(promoTitle, lang)}
              </h2>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {translatePromoSubtitle(promoSubtitle, lang)}
              </p>
            </div>

            <div
              className="rounded-2xl border px-4 py-3 text-sm sm:text-base font-bold flex items-center gap-2"
              style={{
                backgroundColor: 'var(--pastel-peach)',
                borderColor: 'var(--border-soft)',
                color: 'var(--pastel-peach-text)',
              }}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{translateRewardNotice(rewardNotice, lang)}</span>
            </div>

            {/* Side-by-Side Customer Actions: Self-Order & Member Star Rewards Check */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Left: Customer Self-Order */}
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  onEnterCustomerOrder();
                }}
                className="w-full rounded-3xl p-5 sm:p-6 text-left text-white flex items-center justify-between gap-3.5 shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                  <div
                    className="w-16 h-16 rounded-2xl bg-white shadow-md flex flex-col items-center justify-center shrink-0"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    <ShoppingCart className="w-8 h-8" strokeWidth={2.5} />
                    <span
                      className="text-[10px] font-bold leading-none mt-0.5"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      {tx('สั่งเลย', 'Order')}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-xl">
                      <Utensils className="w-3.5 h-3.5" />
                      <span>{tx('สำหรับลูกค้าหน้าร้าน / ออนไลน์', 'Walk-in & Online Customers')}</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold tracking-tight">
                      {tx('ลูกค้ากดสั่งซื้อเอง', 'Self-Order Menu')}
                    </p>
                    <p className="text-xs sm:text-sm opacity-95">
                      {tx(
                        `เลือกเมนู ${foodShopNameTh} & ${shopNameTh} สะสมดาวได้เลยค่ะ`,
                        `Browse ${foodShopNameEn} & ${shopNameEn} and earn loyalty stars`
                      )}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex w-10 h-10 rounded-2xl bg-white/20 items-center justify-center shrink-0">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>

              {/* Right: Member Check Stars & Reward Offers with Bear Emoji */}
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  onOpenMemberRewards();
                }}
                className="w-full rounded-3xl border-2 p-5 sm:p-6 text-left flex items-center justify-between gap-3.5 shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                style={{
                  backgroundColor: 'var(--pastel-peach)',
                  borderColor: '#E59A38',
                  color: 'var(--pastel-peach-text)',
                }}
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                  <div
                    className="w-16 h-16 rounded-2xl bg-white shadow-md flex flex-col items-center justify-center shrink-0"
                    style={{ color: '#D97706' }}
                  >
                    <Star className="w-8 h-8 fill-amber-400 text-amber-500" />
                    <span className="text-[10px] font-bold leading-none mt-0.5 text-amber-800">
                      {tx('เช็คดาว', 'Stars')}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/70 px-2.5 py-0.5 rounded-xl text-amber-900">
                      <span aria-hidden="true">🐻</span>
                      <span>{tx('สำหรับสมาชิกร้าน', 'For Shop Members')}</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold tracking-tight">
                      {tx('เช็คคะแนนดาว & แลกรางวัล', 'Check Stars & Rewards')}
                    </p>
                    <p className="text-xs sm:text-sm opacity-90">
                      {tx(
                        'ดูแต้มคงเหลือ ของรางวัลแลกฟรี เงื่อนไข และวันหมดเขต',
                        'View your star balance, free rewards, terms & expiry dates'
                      )}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex w-10 h-10 rounded-2xl bg-white/60 items-center justify-center shrink-0 text-amber-900">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Public Community Barcode Search & Photo Donation Catalog (No Login Required) */}
        <BarcodeDonationHub menuItems={menuItems} onDonateProduct={onDonateProduct} />
      </div>
    </div>
  );
};
