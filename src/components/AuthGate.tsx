import React, { useState } from 'react';
import { CheckCircle2, Delete, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { StaffUser } from '../config/shopConfig';
import { BearFamilyOutfits } from '../config/bearOutfits';
import { LanguageToggleButton, translateStaffName, useLang } from '../config/i18n';
import { playSoftClick, playScanError, playScanSuccess } from '../utils/sound';
import { BearGangMascot } from './BearGangMascot';

interface AuthGateProps {
  orgCodeExpected: string;
  staffUsers: Record<string, StaffUser>;
  shopNameTh: string;
  shopNameEn: string;
  isOrgVerified: boolean;
  outfits?: BearFamilyOutfits;
  onOrgVerified: () => void;
  onResetOrgCode: () => void;
  onBackToWelcome?: () => void;
  onAuthenticated: (pin: string, user: StaffUser) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  orgCodeExpected,
  staffUsers,
  shopNameTh,
  shopNameEn,
  isOrgVerified,
  outfits,
  onOrgVerified,
  onResetOrgCode,
  onBackToWelcome,
  onAuthenticated,
}) => {
  const { lang, tx } = useLang();
  const [orgInput, setOrgInput] = useState('');
  const [orgError, setOrgError] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifiedStaff, setVerifiedStaff] = useState<StaffUser | null>(null);

  const staffDisplayNames = Array.from(
    new Set(Object.values(staffUsers).map((u) => translateStaffName(u.name, lang)))
  ).join(' · ');

  const handleOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    if (orgInput.trim().toUpperCase() === orgCodeExpected.trim().toUpperCase()) {
      playScanSuccess();
      setOrgError('');
      onOrgVerified();
    } else {
      playScanError();
      setOrgError(tx('รหัสร้านค้าไม่ถูกต้อง กรุณาลองใหม่อีกครั้งนะคะ', 'Incorrect store code. Please try again.'));
    }
  };

  const handlePinDigit = (digit: string) => {
    if (verifiedStaff || pinInput.length >= 4) return;
    playSoftClick();
    const next = pinInput + digit;
    setPinInput(next);
    setPinError('');

    if (next.length === 4) {
      const matched = staffUsers[next];
      if (matched) {
        playScanSuccess();
        setVerifiedStaff(matched);
        window.setTimeout(() => {
          onAuthenticated(next, matched);
        }, 700);
      } else {
        playScanError();
        setPinError(tx('รหัส PIN ไม่ถูกต้อง ลองใหม่อีกครั้งนะคะ', 'Incorrect PIN. Please try again.'));
        setTimeout(() => setPinInput(''), 380);
      }
    }
  };

  const handleBackspace = () => {
    if (verifiedStaff) return;
    playSoftClick();
    setPinInput((prev) => prev.slice(0, -1));
    setPinError('');
  };

  const handleClearPin = () => {
    if (verifiedStaff) return;
    playSoftClick();
    setPinInput('');
    setPinError('');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="w-full max-w-md flex justify-end mb-2">
        <LanguageToggleButton />
      </div>

      <div className="w-full max-w-md">
        {/* Header Title */}
        <div className="text-center mb-2">
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text-main)' }}
          >
            ⭐ {lang === 'en' ? shopNameEn : shopNameTh} ⭐
          </h1>
          <p className="text-sm font-en font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {lang === 'en' ? shopNameTh : shopNameEn}
          </p>
        </div>

        {/* Mascot clinging cleanly on top of the login card */}
        <div className="-mb-3 relative z-10 px-6">
          <BearGangMascot pose="peeking" outfits={outfits} />
        </div>

        {/* Main Card */}
        <div
          className="relative z-20 rounded-3xl border p-6 sm:p-8 shadow-sm"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-soft)',
          }}
        >
          {!isOrgVerified ? (
            <form onSubmit={handleOrgSubmit} className="space-y-5">
              <div className="text-center space-y-1">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2"
                  style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('ยืนยันรหัสร้านค้า (ชั้นที่ 1)', 'Verify Store ID (Step 1)')}
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {tx(
                    'กรอกรหัสร้านค้า (Store ID) ครั้งแรกครั้งเดียว เครื่องจะจำให้อัตโนมัติค่ะ',
                    'Enter your Store ID once; this device will remember it.'
                  )}
                </p>
              </div>

              <div>
                <label
                  htmlFor="org-code-input"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-main)' }}
                >
                  {tx('รหัสร้านค้า (Store ID)', 'Store ID')}
                </label>
                <input
                  id="org-code-input"
                  type="text"
                  value={orgInput}
                  onChange={(e) => {
                    setOrgInput(e.target.value);
                    setOrgError('');
                  }}
                  placeholder={tx('เช่น KKP2027', 'e.g. KKP2027')}
                  autoFocus
                  className="w-full h-14 px-4 rounded-2xl border text-lg font-num tracking-wider text-center uppercase focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-soft)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {orgError && (
                <p
                  className="text-sm text-center font-medium py-2 px-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--pastel-pink)',
                    color: 'var(--pastel-pink-text)',
                  }}
                >
                  {orgError}
                </p>
              )}

              <button
                type="submit"
                className="w-full h-14 rounded-2xl font-bold text-lg text-white transition-transform active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {tx('เข้าสู่ขั้นตอนใส่รหัส PIN', 'Continue to PIN Entry')}
              </button>

              {onBackToWelcome && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={onBackToWelcome}
                    className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline cursor-pointer py-1 px-2"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {tx('← กลับหน้าแรก', '← Back to Welcome')}
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <div
                  className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-1"
                  style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                >
                  <LockKeyhole className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('ใส่รหัส PIN เข้าขายหน้าร้าน', 'Enter Staff PIN')}
                </h2>
                <p className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  {tx(`พนักงาน: ${staffDisplayNames}`, `Staff: ${staffDisplayNames}`)}
                </p>
              </div>

              {/* 4-dot PIN display */}
              <div className="flex items-center justify-center gap-4 py-2">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = idx < pinInput.length;
                  return (
                    <div
                      key={idx}
                      className="w-5 h-5 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: filled ? 'var(--accent-primary)' : 'transparent',
                        borderColor: filled ? 'var(--accent-primary)' : 'var(--border-soft)',
                      }}
                    />
                  );
                })}
              </div>

              {verifiedStaff && (
                <div
                  className="rounded-2xl border-2 px-4 py-3 text-center flex items-center justify-center gap-2 font-bold text-sm"
                  style={{
                    backgroundColor: '#DCFCE7',
                    borderColor: '#16A34A',
                    color: '#166534',
                  }}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>
                    {tx(
                      `พนักงาน: ${verifiedStaff.name} · สถานะ: พร้อมใช้งาน`,
                      `Staff: ${translateStaffName(verifiedStaff.name, lang)} · Status: Ready`
                    )}
                  </span>
                </div>
              )}

              {pinError && (
                <p
                  className="text-sm text-center font-medium py-2 px-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--pastel-pink)',
                    color: 'var(--pastel-pink-text)',
                  }}
                >
                  {pinError}
                </p>
              )}

              {/* Large Touch PIN Numpad */}
              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinDigit(digit)}
                    className="h-16 rounded-2xl border text-2xl font-num font-bold transition-transform active:scale-95 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-soft)',
                      color: 'var(--text-main)',
                    }}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearPin}
                  className="h-16 rounded-2xl border text-base font-semibold transition-transform active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--pastel-peach)',
                    borderColor: 'var(--border-soft)',
                    color: 'var(--pastel-peach-text)',
                  }}
                >
                  {tx('ล้าง', 'Clear')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  className="h-16 rounded-2xl border text-2xl font-num font-bold transition-transform active:scale-95 cursor-pointer"
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
                  onClick={handleBackspace}
                  aria-label={tx('ลบตัวเลข', 'Backspace')}
                  className="h-16 rounded-2xl border flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border-soft)',
                    color: 'var(--text-main)',
                  }}
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={onResetOrgCode}
                  className="inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline cursor-pointer py-1 px-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {tx(`เปลี่ยนรหัสองค์กร (${orgCodeExpected})`, `Change Shop Code (${orgCodeExpected})`)}
                </button>
                {onBackToWelcome && (
                  <button
                    type="button"
                    onClick={onBackToWelcome}
                    className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline cursor-pointer py-1 px-2"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {tx('← กลับหน้าแรก', '← Back to Welcome')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
