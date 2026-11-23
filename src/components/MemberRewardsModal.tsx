import React, { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Gift, Search, Sparkles, Star, X } from 'lucide-react';
import { RewardOffer } from '../config/shopConfig';
import { translateRewardOffer, useLang } from '../config/i18n';
import { CustomerMember, findMemberByAnyQuery, getMembersCache } from '../utils/sheetsSync';
import { playSoftClick } from '../utils/sound';

interface MemberRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewardOffers: RewardOffer[];
  shopNameTh: string;
  foodShopNameTh: string;
}

export const MemberRewardsModal: React.FC<MemberRewardsModalProps> = ({
  isOpen,
  onClose,
  rewardOffers,
  shopNameTh,
  foodShopNameTh,
}) => {
  const { lang, tx } = useLang();
  const [query, setQuery] = useState('');
  const [searchedMember, setSearchedMember] = useState<CustomerMember | null>(null);
  const [notFound, setNotFound] = useState(false);

  const activeOffers = useMemo(
    () =>
      rewardOffers
        .filter((o) => o.active)
        .sort((a, b) => a.starsRequired - b.starsRequired)
        .map((o) => translateRewardOffer(o, lang)),
    [rewardOffers, lang]
  );

  if (!isOpen) return null;

  const hasStarterSample = getMembersCache().some((m) => m.memberId === 'KKP-0001');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    if (!query.trim()) {
      setSearchedMember(null);
      setNotFound(false);
      return;
    }
    const found = findMemberByAnyQuery(query);
    if (found) {
      setSearchedMember(found);
      setNotFound(false);
    } else {
      setSearchedMember(null);
      setNotFound(true);
    }
  };

  const handleQuickSample = () => {
    playSoftClick();
    setQuery('KKP-0001');
    const found = findMemberByAnyQuery('KKP-0001');
    if (found) {
      setSearchedMember(found);
      setNotFound(false);
    }
  };

  const unlockedCount = searchedMember
    ? activeOffers.filter((o) => searchedMember.stars >= o.starsRequired).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-4">
      <div
        className="w-full max-w-2xl max-h-[92vh] rounded-3xl border shadow-xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 sm:px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
              style={{ backgroundColor: '#E59A38' }}
            >
              <Star className="w-5 h-5 fill-current" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-main)' }}>
                {tx('เช็คคะแนนดาว & สิทธิพิเศษสมาชิก', 'Check Stars & Member Rewards')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  `ใช้ดาวสะสมร่วมกันได้ทั้ง ⭐ ${shopNameTh} และ 🍲 ${foodShopNameTh}`,
                  'Stars can be earned and redeemed at both ⭐ kookkikpaplern and 🍲 Krua Mae Wang'
                )}
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

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Member Lookup Form */}
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
          >
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tx(
                    'กรอกเบอร์โทร / 4 ตัวท้าย / รหัส KKP-0001 / ชื่อเล่น',
                    'Phone number / last 4 digits / ID (KKP-0001) / Nickname'
                  )}
                  className="w-full h-12 pl-10 pr-3 rounded-2xl border text-sm"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                />
              </div>
              <button
                type="submit"
                className="h-12 px-5 rounded-2xl font-bold text-sm text-white shrink-0 cursor-pointer transition-transform active:scale-95"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {tx('🔍 เช็คคะแนนดาว', '🔍 Check Stars')}
              </button>
            </form>

            {hasStarterSample && !searchedMember && (
              <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>
                  {tx(
                    'ยังไม่มีรหัส? สมัครฟรีเมื่อสั่งซื้อสินค้าเสร็จได้เลยค่ะ',
                    'Not a member yet? Sign up for free right after checkout!'
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleQuickSample}
                  className="font-bold underline underline-offset-2 cursor-pointer shrink-0"
                  style={{ color: 'var(--accent-text)' }}
                >
                  {tx('ทดลองดูบัตร KKP-0001', 'Try card KKP-0001')}
                </button>
              </div>
            )}

            {notFound && (
              <div
                className="rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold"
                style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
              >
                {tx(
                  `ไม่พบข้อมูลสมาชิกสำหรับ "${query}" ค่ะ (ลองใช้เบอร์โทร 10 หลัก, 4 ตัวท้าย หรือรหัส KKP-XXXX นะคะ)`,
                  `No member found for "${query}". Try a 10-digit phone number, last 4 digits, or KKP-XXXX.`
                )}
              </div>
            )}

            {/* Found Member Card */}
            {searchedMember && (
              <div
                className="rounded-2xl border-2 p-4 flex flex-wrap items-center justify-between gap-4"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--accent-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-xs shrink-0"
                    aria-hidden="true"
                  >
                    🐻
                  </div>
                  <div>
                    <p className="font-bold text-base sm:text-lg" style={{ color: 'var(--accent-text)' }}>
                      {tx('คุณ', '')}
                      {searchedMember.nickname || searchedMember.firstName} ({searchedMember.firstName}{' '}
                      {searchedMember.lastName})
                    </p>
                    <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {tx('รหัสสมาชิก:', 'Member ID:')} {searchedMember.memberId} ·{' '}
                      {tx('เบอร์ลงท้าย', 'Phone ending')} {searchedMember.phone.slice(-4)}
                    </p>
                  </div>
                </div>

                <div className="text-right ml-auto">
                  <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-white shadow-xs">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                    <span className="font-num text-2xl font-bold text-amber-700">
                      {searchedMember.stars}
                    </span>
                    <span className="text-xs font-bold text-amber-700">
                      {tx('ดาว', 'Stars')}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: 'var(--accent-text)' }}>
                    {unlockedCount > 0
                      ? tx(
                          `🎉 แลกของรางวัลได้แล้ว ${unlockedCount} รายการ!`,
                          `🎉 ${unlockedCount} reward(s) ready to redeem!`
                        )
                      : tx(
                          'สั่งสะสมเพิ่มอีกนิดเพื่อปลดล็อกของรางวัลค่ะ',
                          'Collect a few more stars to unlock rewards!'
                        )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Reward Offers Catalog with Terms & Expiry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Gift className="w-5 h-5" style={{ color: '#E59A38' }} />
                {tx(
                  `ข้อเสนอของรางวัลแลกดาว (${activeOffers.length} รายการ)`,
                  `Star Redemption Rewards (${activeOffers.length} offers)`
                )}
              </h3>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  'แจ้งสิทธิ์กับพนักงานที่หน้าร้านเพื่อแลกได้เลยค่ะ',
                  'Show this screen to counter staff to redeem'
                )}
              </span>
            </div>

            {activeOffers.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                {tx('ยังไม่มีโปรโมชันแลกดาวในขณะนี้ค่ะ', 'No reward offers available right now.')}
              </p>
            ) : (
              <div className="space-y-3">
                {activeOffers.map((offer) => {
                  const memberStars = searchedMember?.stars ?? 0;
                  const canRedeem = searchedMember ? memberStars >= offer.starsRequired : false;
                  const remaining = Math.max(0, offer.starsRequired - memberStars);
                  const pct = searchedMember
                    ? Math.min(100, Math.round((memberStars / offer.starsRequired) * 100))
                    : 0;

                  return (
                    <div
                      key={offer.id}
                      className="rounded-2xl border-2 p-4 space-y-3"
                      style={{
                        backgroundColor: canRedeem ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                        borderColor: canRedeem ? 'var(--accent-primary)' : 'var(--border-soft)',
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="space-y-1 flex-1 min-w-[200px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="px-3 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                              style={{
                                backgroundColor: canRedeem ? '#16A34A' : '#FEF3C7',
                                color: canRedeem ? '#FFFFFF' : '#92400E',
                              }}
                            >
                              <Star className="w-3.5 h-3.5 fill-current" />
                              {tx(`ใช้ ${offer.starsRequired} ดาว`, `${offer.starsRequired} Stars`)}
                            </span>
                            {searchedMember && canRedeem && (
                              <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                {tx('แลกได้แล้วตอนนี้!', 'Ready to Redeem!')}
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                            {offer.title}
                          </h4>
                          {offer.description && (
                            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              {offer.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Member Star Progress Bar */}
                      {searchedMember && (
                        <div className="space-y-1.5">
                          <div className="w-full h-2.5 rounded-full bg-white/80 overflow-hidden border" style={{ borderColor: 'var(--border-soft)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: canRedeem ? '#16A34A' : '#E59A38',
                              }}
                            />
                          </div>
                          <p className="text-xs font-semibold" style={{ color: canRedeem ? '#15803D' : '#9A3412' }}>
                            {canRedeem ? (
                              <span className="inline-flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                {tx(
                                  `คุณมี ${memberStars} ดาว — แสดงหน้านี้ให้พนักงานหน้าร้านกดแลกได้เลยค่ะ!`,
                                  `You have ${memberStars} stars — show this to counter staff to redeem!`
                                )}
                              </span>
                            ) : (
                              tx(
                                `มีอยู่ ${memberStars} / ${offer.starsRequired} ดาว — สะสมเพิ่มอีก ${remaining} ดาว เพื่อแลกรางวัลนี้`,
                                `${memberStars} / ${offer.starsRequired} stars — earn ${remaining} more stars to unlock`
                              )
                            )}
                          </p>
                        </div>
                      )}

                      {/* Terms & Expiry Box */}
                      <div
                        className="rounded-xl border px-3.5 py-2.5 text-xs space-y-1"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      >
                        {offer.terms && (
                          <p style={{ color: 'var(--text-main)' }}>
                            <span className="font-bold">{tx('เงื่อนไข: ', 'Terms: ')}</span>
                            {offer.terms}
                          </p>
                        )}
                        <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                          <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {tx('หมดเขต:', 'Expires:')} {offer.expiryDate || tx('ไม่มีกำหนด', 'No Expiry')}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t shrink-0 flex justify-end"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-6 h-11 rounded-2xl font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {tx('ปิดหน้าต่าง', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
