import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Delete,
  Download,
  Gift,
  LockKeyhole,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import { StaffUser } from '../config/shopConfig';
import { BearFamilyOutfits } from '../config/bearOutfits';
import { translateMenuName, translateStaffName, translateTasteNote, useLang } from '../config/i18n';
import { generatePromptPayQrDataUrl } from '../utils/promptpay';
import {
  BillLineItem,
  checkAutoPaymentFromSheets,
  CustomerMember,
  findMemberByPhoneOrLast4,
  generateNextMemberId,
  getMembersCache,
  postToSheets,
  saveMembersCache,
} from '../utils/sheetsSync';
import { playScanError, playScanSuccess, playSoftClick, speakMessage } from '../utils/sound';
import { BearGangMascot, BearParentsCelebration, MamaBearMascot } from './BearGangMascot';

/* ==================== 1. CASH PAYMENT MODAL ==================== */
interface CashPaymentModalProps {
  isOpen: boolean;
  amount: number;
  items?: BillLineItem[];
  onClose: () => void;
  onConfirmPaid: () => void;
}

export const CashPaymentModal: React.FC<CashPaymentModalProps> = ({
  isOpen,
  amount,
  items = [],
  onClose,
  onConfirmPaid,
}) => {
  const { lang, tx } = useLang();
  const [receivedStr, setReceivedStr] = useState('');

  useEffect(() => {
    if (isOpen) setReceivedStr('');
  }, [isOpen, amount]);

  if (!isOpen) return null;

  const received = parseFloat(receivedStr) || 0;
  const change = received - amount;
  const canConfirm = received >= amount;

  const quickBills = [20, 50, 100, 500, 1000];

  const appendDigit = (d: string) => {
    playSoftClick();
    if (receivedStr.length >= 7) return;
    setReceivedStr((prev) => (prev === '0' ? d : prev + d));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="w-full max-w-md rounded-3xl border shadow-xl overflow-hidden my-auto"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
          <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
            {tx('รับเงินสด', 'Cash Payment')}
          </h3>
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

        <div className="p-5 space-y-4">
          {items.length > 0 && (
            <div
              className="rounded-2xl border px-3.5 py-2.5 max-h-28 overflow-y-auto space-y-1 text-xs"
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
            >
              <p className="font-bold text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {tx('รายการในบิล', 'Order Items')}
              </p>
              {items.map((item, idx) => (
                <div key={`${item.id}_${idx}`} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium" style={{ color: 'var(--text-main)' }}>
                    {translateMenuName(item.name, lang)}
                    {item.tasteNote ? ` (${translateTasteNote(item.tasteNote, lang)})` : ''} × {item.qty}
                  </span>
                  <span className="font-num font-bold shrink-0" style={{ color: 'var(--text-main)' }}>
                    ฿{(item.price * item.qty).toLocaleString('th-TH')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Amount & Change Summary */}
          <div className="rounded-2xl border p-4 space-y-2" style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}>
            <div className="flex items-center justify-between text-base">
              <span style={{ color: 'var(--text-muted)' }}>{tx('ยอดที่ต้องชำระ', 'Amount Due')}</span>
              <span className="font-num text-2xl font-bold tabular-nums" style={{ color: 'var(--text-main)' }}>
                ฿{amount.toLocaleString('th-TH')}
              </span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span style={{ color: 'var(--text-muted)' }}>{tx('รับเงินมา', 'Cash Received')}</span>
              <span className="font-num text-2xl font-bold tabular-nums" style={{ color: 'var(--accent-text)' }}>
                ฿{received.toLocaleString('th-TH')}
              </span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                {tx('เงินทอน', 'Change')}
              </span>
              <span className="font-num text-3xl sm:text-4xl font-bold tabular-nums text-orange-600">
                {received === 0
                  ? '฿0'
                  : change >= 0
                    ? `฿${change.toLocaleString('th-TH')}`
                    : tx(
                        `ขาดอีก ฿${Math.abs(change).toLocaleString('th-TH')}`,
                        `Short ฿${Math.abs(change).toLocaleString('en-US')}`
                      )}
              </span>
            </div>
          </div>

          {/* Quick Banknotes */}
          <div className="grid grid-cols-3 gap-2">
            {quickBills.map((bill) => (
              <button
                key={bill}
                type="button"
                onClick={() => {
                  playSoftClick();
                  setReceivedStr(String(bill));
                }}
                className="h-12 rounded-2xl border font-num font-bold text-base cursor-pointer transition-transform active:scale-95"
                style={{
                  backgroundColor: 'var(--pastel-blue)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--pastel-blue-text)',
                }}
              >
                ฿{bill}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                playSoftClick();
                setReceivedStr(String(amount));
              }}
              className="h-12 rounded-2xl border font-bold text-sm cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent-border)',
                color: 'var(--accent-text)',
              }}
            >
              {tx('รับพอดี', 'Exact')}
            </button>
          </div>

          {/* Mini Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0'].map((key) => {
              if (key === 'CLEAR') {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setReceivedStr('');
                    }}
                    className="h-12 rounded-2xl border font-semibold text-sm cursor-pointer"
                    style={{ backgroundColor: 'var(--pastel-peach)', borderColor: 'var(--border-soft)', color: 'var(--pastel-peach-text)' }}
                  >
                    {tx('ล้าง', 'Clear')}
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => appendDigit(key)}
                  className="h-12 rounded-2xl border font-num font-bold text-xl cursor-pointer active:scale-95"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)', color: 'var(--text-main)' }}
                >
                  {key}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                playSoftClick();
                setReceivedStr((prev) => prev.slice(0, -1));
              }}
              className="h-12 rounded-2xl border flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
              aria-label={tx('ลบตัวเลข', 'Backspace')}
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-14 rounded-2xl border font-bold cursor-pointer"
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
            >
              {tx('ย้อนกลับ', 'Back')}
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={onConfirmPaid}
              className="h-14 rounded-2xl font-bold text-lg text-white cursor-pointer disabled:opacity-45 transition-transform active:scale-95"
              style={{ backgroundColor: '#16A34A' }}
            >
              {tx('รับเงินเรียบร้อย ✓', 'Confirm Paid ✓')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==================== 2. PROMPTPAY QR MODAL ==================== */
interface QrPaymentModalProps {
  isOpen: boolean;
  amount: number;
  items?: BillLineItem[];
  promptPayId: string;
  promptPayAccountName?: string;
  shopNameTh: string;
  enableAutoPaymentCheck: boolean;
  scriptUrl: string;
  mascotMode?: 'kids' | 'krua';
  outfits?: BearFamilyOutfits;
  onClose: () => void;
  onConfirmPaid: () => void;
}

export const QrPaymentModal: React.FC<QrPaymentModalProps> = ({
  isOpen,
  amount,
  items = [],
  promptPayId,
  promptPayAccountName = 'คำวัง พวงมาลา',
  shopNameTh,
  enableAutoPaymentCheck,
  scriptUrl,
  mascotMode = 'kids',
  outfits,
  onClose,
  onConfirmPaid,
}) => {
  const { lang, tx } = useLang();
  const [qrUrl, setQrUrl] = useState('');
  const [isAutoPolling, setIsAutoPolling] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    generatePromptPayQrDataUrl(promptPayId, amount)
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [isOpen, promptPayId, amount]);

  useEffect(() => {
    if (!isOpen || !enableAutoPaymentCheck || !scriptUrl) {
      setIsAutoPolling(false);
      return;
    }

    setIsAutoPolling(true);
    const interval = window.setInterval(async () => {
      const paid = await checkAutoPaymentFromSheets(scriptUrl, amount);
      if (paid) {
        onConfirmPaid();
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isOpen, enableAutoPaymentCheck, scriptUrl, amount, onConfirmPaid]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md pt-6 my-auto">
        {/* Mascot Clinging on Top Edge of QR Window (ไม่บังตัวเลข) */}
        <div className="-mb-3.5 relative z-10 px-6">
          {mascotMode === 'krua' ? (
            <MamaBearMascot pose="peeking" outfits={outfits} />
          ) : (
            <BearGangMascot pose="peeking" outfits={outfits} />
          )}
        </div>

        <div
          className="relative z-20 rounded-3xl border-2 shadow-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--accent-border)',
          }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {tx('สแกนจ่ายพร้อมเพย์ (PromptPay)', 'Scan PromptPay QR')}
              </h3>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {shopNameTh} · {promptPayId}
              </p>
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

          <div className="p-5 flex flex-col items-center text-center space-y-3.5">
            {/* Itemized Order Details */}
            {items.length > 0 && (
              <div
                className="w-full rounded-2xl border px-3.5 py-2.5 max-h-28 overflow-y-auto text-left space-y-1 text-xs"
                style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
              >
                <p className="font-bold text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {tx('รายละเอียดรายการอาหาร/สินค้า', 'Order Summary')}
                </p>
                {items.map((item, idx) => (
                  <div key={`${item.id}_${idx}`} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium" style={{ color: 'var(--text-main)' }}>
                      {translateMenuName(item.name, lang)}
                      {item.tasteNote ? ` (${translateTasteNote(item.tasteNote, lang)})` : ''} × {item.qty}
                    </span>
                    <span className="font-num font-bold shrink-0" style={{ color: 'var(--text-main)' }}>
                      ฿{(item.price * item.qty).toLocaleString('th-TH')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total Amount + PromptPay Receiver Details */}
            <div
              className="w-full rounded-2xl py-3 px-4 border space-y-1.5"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {tx('ยอดโอนทั้งหมด', 'Transfer Amount')}
              </p>
              <p className="font-num text-4xl font-bold tabular-nums" style={{ color: 'var(--accent-text)' }}>
                ฿{amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div
                className="pt-2 mt-1 border-t text-xs sm:text-sm space-y-0.5"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <p className="font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('เบอร์พร้อมเพย์:', 'PromptPay:')}{' '}
                  <span className="font-num tracking-wide" style={{ color: 'var(--accent-text)' }}>
                    {promptPayId}
                  </span>
                </p>
                {promptPayAccountName && (
                  <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {tx('ชื่อบัญชี:', 'Account Name:')}{' '}
                    <span style={{ color: 'var(--text-main)' }}>{promptPayAccountName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* QR Code */}
            <div className="p-3 bg-white rounded-3xl border shadow-inner" style={{ borderColor: 'var(--border-soft)' }}>
              {qrUrl ? (
                <img src={qrUrl} alt="PromptPay QR Code" className="w-52 h-52 sm:w-56 sm:h-56 object-contain" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-sm text-stone-400">
                  {tx('กำลังสร้าง QR Code...', 'Generating QR Code...')}
                </div>
              )}
            </div>

            {/* Payment Check Status */}
            <p
              className="text-sm font-medium px-4 py-2.5 rounded-2xl w-full"
              style={{
                backgroundColor: enableAutoPaymentCheck ? 'var(--accent-soft)' : 'var(--pastel-peach)',
                color: enableAutoPaymentCheck ? 'var(--accent-text)' : 'var(--pastel-peach-text)',
              }}
            >
              {enableAutoPaymentCheck
                ? isAutoPolling
                  ? tx('กำลังเช็กยอดเงินเข้าอัตโนมัติทุก 3 วินาที...', 'Checking payment automatically every 3 seconds...')
                  : tx('กำลังตรวจสอบยอดเงินเข้าอัตโนมัติ...', 'Auto-checking incoming transfer...')
                : tx(
                    'ตรวจสอบชื่อบัญชี "คำวัง พวงมาลา" และยอดเงินก่อนกดยืนยัน',
                    'Verify account name & transfer confirmation before confirming'
                  )}
            </p>

            <div className="grid grid-cols-3 gap-2.5 w-full">
              <button
                type="button"
                onClick={onClose}
                className="h-14 rounded-2xl border font-bold cursor-pointer"
                style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
              >
                {tx('ย้อนกลับ', 'Back')}
              </button>
              <button
                type="button"
                onClick={onConfirmPaid}
                className="col-span-2 h-14 rounded-2xl font-bold text-lg text-white cursor-pointer transition-transform active:scale-95"
                style={{ backgroundColor: '#16A34A' }}
              >
                {tx('โอนเรียบร้อยแล้ว ✓', 'Payment Confirmed ✓')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==================== 3. BRIGHT GREEN SUCCESS & STAR LOYALTY SCREEN ==================== */
interface PaymentSuccessOverlayProps {
  isOpen: boolean;
  amount: number;
  earnedStars: number;
  shopNameTh: string;
  shopNameEn: string;
  staffUser: StaffUser;
  staffUsers: Record<string, StaffUser>;
  scriptUrl: string;
  mascotMode?: 'kids' | 'krua';
  outfits?: BearFamilyOutfits;
  onClose: () => void;
}

export const PaymentSuccessOverlay: React.FC<PaymentSuccessOverlayProps> = ({
  isOpen,
  amount,
  earnedStars,
  shopNameTh,
  shopNameEn,
  staffUser,
  staffUsers,
  scriptUrl,
  mascotMode = 'kids',
  outfits,
  onClose,
}) => {
  const { lang, tx } = useLang();
  const [phoneQuery, setPhoneQuery] = useState('');
  const [activeMember, setActiveMember] = useState<CustomerMember | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Registration form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Admin PIN Modal for Star Redemption (cashier cannot redeem without admin PIN)
  const [showRedeemPinModal, setShowRedeemPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  const cardCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPhoneQuery('');
      setActiveMember(null);
      setFeedbackMsg('');
      setShowRegisterForm(false);
      setShowRedeemPinModal(false);
      setAdminPinInput('');
      setAdminPinError('');
      return;
    }

    const cleanAmount = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    const spoken =
      lang === 'en'
        ? `Received ${cleanAmount} baht. Payment confirmed, thank you!`
        : `ได้รับเงิน ${cleanAmount} บาท เรียบร้อยแล้วค่ะ ขอบคุณค่ะ`;
    speakMessage(spoken, lang);
  }, [isOpen, amount, lang]);

  if (!isOpen) return null;

  const starsToGrant = Math.max(1, earnedStars || Math.floor(amount / 20) || 1);

  const handleSaveStars = async (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    const found = findMemberByPhoneOrLast4(phoneQuery);
    if (!found) {
      playScanError();
      setFeedbackMsg(
        tx(
          'ไม่พบเบอร์โทรสมาชิกนี้ค่ะ กด "+ สมัครสมาชิกด่วน" ได้เลยนะคะ',
          'Phone number not found. Tap "+ Quick Member Sign-Up" below!'
        )
      );
      return;
    }

    const members = getMembersCache();
    const updated = members.map((m) =>
      m.memberId === found.memberId ? { ...m, stars: m.stars + starsToGrant } : m
    );
    saveMembersCache(updated);
    const updatedMember = updated.find((m) => m.memberId === found.memberId)!;
    setActiveMember(updatedMember);
    setFeedbackMsg(
      tx(
        `เพิ่ม +${starsToGrant} ดาว ให้คุณ ${updatedMember.nickname} เรียบร้อยค่ะ!`,
        `Added +${starsToGrant} stars to ${updatedMember.nickname}'s card!`
      )
    );
    playScanSuccess();

    await postToSheets(scriptUrl, 'สะสมแต้ม', {
      memberId: updatedMember.memberId,
      nickname: updatedMember.nickname,
      phone: updatedMember.phone,
      note: `ซื้อสินค้า ฿${amount}`,
      deltaStars: starsToGrant,
      totalStars: updatedMember.stars,
      staffName: staffUser.name,
    });
  };

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    if (!firstName.trim() || !nickname.trim() || !regPhone.trim()) {
      setFeedbackMsg(
        tx(
          'กรุณากรอกชื่อจริง ชื่อเล่น และเบอร์โทรให้ครบนะคะ',
          'Please enter First Name, Nickname, and Phone Number.'
        )
      );
      return;
    }

    const members = getMembersCache();
    const cleanPhone = regPhone.replace(/\D/g, '');
    const duplicate = members.find((m) => m.phone === cleanPhone);
    if (duplicate) {
      setFeedbackMsg(
        tx(
          `เบอร์นี้เป็นสมาชิกแล้ว (${duplicate.memberId} - ${duplicate.nickname})`,
          `Already a member (${duplicate.memberId} - ${duplicate.nickname})`
        )
      );
      setActiveMember(duplicate);
      setShowRegisterForm(false);
      return;
    }

    const newMember: CustomerMember = {
      memberId: generateNextMemberId(members),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nickname: nickname.trim(),
      phone: cleanPhone,
      stars: starsToGrant,
      createdAt: new Date().toISOString(),
    };

    const nextList = [...members, newMember];
    saveMembersCache(nextList);
    setActiveMember(newMember);
    setShowRegisterForm(false);
    setFeedbackMsg(
      tx(
        `สมัครสมาชิกสำเร็จ! รหัส ${newMember.memberId} รับทันที ${starsToGrant} ดาว ⭐`,
        `Registered! ID ${newMember.memberId} earned +${starsToGrant} stars ⭐`
      )
    );
    playScanSuccess();

    await postToSheets(scriptUrl, 'สมาชิกลูกค้า', newMember as unknown as Record<string, unknown>);
    await postToSheets(scriptUrl, 'สะสมแต้ม', {
      memberId: newMember.memberId,
      nickname: newMember.nickname,
      phone: newMember.phone,
      note: `สมัครสมาชิกใหม่ + ซื้อสินค้า ฿${amount}`,
      deltaStars: starsToGrant,
      totalStars: newMember.stars,
      staffName: staffUser.name,
    });
  };

  const executeRedeem = async (approverName: string) => {
    if (!activeMember || activeMember.stars < 50) return;
    const members = getMembersCache();
    const updated = members.map((m) =>
      m.memberId === activeMember.memberId ? { ...m, stars: m.stars - 50 } : m
    );
    saveMembersCache(updated);
    const updatedMember = updated.find((m) => m.memberId === activeMember.memberId)!;
    setActiveMember(updatedMember);
    setShowRedeemPinModal(false);
    setAdminPinInput('');
    const displayApprover = translateStaffName(approverName, lang);
    setFeedbackMsg(
      tx(
        `แลกฟรี 50 ดาว สำเร็จ! (อนุมัติโดย ${approverName})`,
        `Redeemed 50 Stars! (Approved by ${displayApprover})`
      )
    );
    playScanSuccess();

    await postToSheets(scriptUrl, 'สะสมแต้ม', {
      memberId: updatedMember.memberId,
      nickname: updatedMember.nickname,
      phone: updatedMember.phone,
      note: `แลกของรางวัลฟรี (อนุมัติโดย ${approverName})`,
      deltaStars: -50,
      totalStars: updatedMember.stars,
      staffName: approverName,
    });
  };

  const handleRedeemClick = () => {
    playSoftClick();
    if (!activeMember || activeMember.stars < 50) return;
    if (staffUser.role === 'admin') {
      executeRedeem(staffUser.name);
    } else {
      setShowRedeemPinModal(true);
      setAdminPinInput('');
      setAdminPinError('');
    }
  };

  const handleApproveRedeemPin = (e: React.FormEvent) => {
    e.preventDefault();
    const approver = staffUsers[adminPinInput.trim()];
    if (approver && approver.role === 'admin') {
      executeRedeem(approver.name);
    } else {
      playScanError();
      setAdminPinError(
        tx(
          'ต้องใช้รหัส PIN ของผู้ดูแลร้าน (Admin) เท่านั้นค่ะ',
          'Requires Admin PIN only.'
        )
      );
    }
  };

  const handleDownloadCard = () => {
    if (!activeMember) return;
    playSoftClick();
    const canvas = cardCanvasRef.current || document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Earth-tone & Pastel Mint gradient
    const grad = ctx.createLinearGradient(0, 0, 720, 420);
    grad.addColorStop(0, '#FAF6F0');
    grad.addColorStop(1, '#DDF4EA');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 420);

    // Outer Rounded Border
    ctx.strokeStyle = '#5FB894';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, 680, 380);

    // Shop Header
    ctx.fillStyle = '#2F2620';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(`⭐ ${lang === 'en' ? shopNameEn : shopNameTh} ⭐`, 48, 80);
    ctx.fillStyle = '#6B5E53';
    ctx.font = '22px sans-serif';
    ctx.fillText(
      lang === 'en' ? `${shopNameTh} · Star Loyalty Card` : `${shopNameEn} · การ์ดสะสมดาวสมาชิก`,
      50,
      114
    );

    // Member Info
    ctx.fillStyle = '#22664C';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(activeMember.memberId, 50, 185);

    ctx.fillStyle = '#2F2620';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(lang === 'en' ? activeMember.nickname : `คุณ ${activeMember.nickname}`, 50, 240);

    ctx.fillStyle = '#6B5E53';
    ctx.font = '22px sans-serif';
    ctx.fillText(`${activeMember.firstName} ${activeMember.lastName}`.trim(), 50, 278);

    // Star Box
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(430, 145, 235, 165);
    ctx.strokeStyle = '#A8DFC9';
    ctx.lineWidth = 4;
    ctx.strokeRect(430, 145, 235, 165);

    ctx.fillStyle = '#B45309';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(lang === 'en' ? '⭐ Star Points' : '⭐ ดาวสะสม', 475, 195);

    ctx.fillStyle = '#22664C';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(`${activeMember.stars}`, 505, 275);

    ctx.fillStyle = '#786B5E';
    ctx.font = '20px sans-serif';
    ctx.fillText(
      lang === 'en'
        ? 'Collect 50 Stars to Redeem 1 Free Signature Item!'
        : 'สะสมครบ 50 ดาว แลกฟรีเมนูแนะนำ 1 อย่าง',
      50,
      368
    );

    const link = document.createElement('a');
    link.download = `star-card-${activeMember.memberId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-600 text-white p-4 sm:p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-5 my-auto">
        {/* Celebrating Bears with Stars */}
        {mascotMode === 'krua' ? (
          <BearParentsCelebration outfits={outfits} />
        ) : (
          <BearGangMascot pose="celebrating" outfits={outfits} />
        )}

        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 text-white font-semibold text-sm">
            <Check className="w-4 h-4" />
            {tx('ชำระเงินสำเร็จเรียบร้อยแล้วค่ะ', 'Payment Successful!')}
          </div>
          <h2 className="font-num text-5xl sm:text-6xl font-extrabold tracking-tight tabular-nums">
            ฿{amount.toLocaleString('th-TH')}
          </h2>
          <p className="text-emerald-100 text-lg font-medium">
            {tx(`บิลนี้ได้รับ ⭐ +${starsToGrant} ดาว`, `This bill earned ⭐ +${starsToGrant} Stars`)}
          </p>
        </div>

        {/* Loyalty / Member Card Box */}
        <div className="rounded-3xl bg-[#FFFDF9] text-[#2F2620] p-5 sm:p-6 shadow-xl space-y-4">
          {!showRegisterForm && !activeMember && (
            <form onSubmit={handleSaveStars} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold">
                  {tx('สะสมดาวลูกค้า (ใส่เบอร์โทร หรือ 4 ตัวท้าย)', 'Collect Member Stars (Phone or Last 4 Digits)')}
                </h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="tel"
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value)}
                  placeholder={tx('เบอร์โทร หรือเลขท้าย 4 ตัว (เช่น 2222)', 'Phone number or last 4 digits (e.g. 2222)')}
                  className="flex-1 h-13 px-4 rounded-2xl border border-[#E6DDD0] bg-[#FAF6F0] text-lg font-num focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-13 px-5 rounded-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Star className="w-5 h-5 fill-white" />
                  {tx('⭐ บันทึกดาว', '⭐ Save Stars')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setShowRegisterForm(true);
                  setRegPhone(phoneQuery.replace(/\D/g, ''));
                }}
                className="w-full h-12 rounded-2xl border-2 border-[#A8DFC9] bg-[#E3F5ED] text-[#22664C] font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-5 h-5" />
                {tx('+ สมัครสมาชิกด่วน (ออกรหัส KKP อัตโนมัติ)', '+ Quick Member Sign-Up (Auto KKP ID)')}
              </button>
            </form>
          )}

          {showRegisterForm && (
            <form onSubmit={handleQuickRegister} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{tx('สมัครสมาชิกด่วน', 'Quick Member Sign-Up')}</h3>
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  className="text-sm underline text-[#786B5E] cursor-pointer"
                >
                  {tx('ย้อนกลับ', 'Back')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={tx('ชื่อจริง *', 'First Name *')}
                  className="h-12 px-3.5 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0]"
                  required
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={tx('นามสกุล', 'Last Name')}
                  className="h-12 px-3.5 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0]"
                />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={tx('ชื่อเล่น *', 'Nickname *')}
                  className="h-12 px-3.5 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0]"
                  required
                />
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder={tx('เบอร์โทร *', 'Phone Number *')}
                  className="h-12 px-3.5 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] font-num"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full h-13 rounded-2xl font-bold text-white bg-[#5FB894] cursor-pointer"
              >
                {tx(
                  `ยืนยันสมัคร & รับ ⭐ ${starsToGrant} ดาวทันที`,
                  `Register & Claim ⭐ ${starsToGrant} Stars Now`
                )}
              </button>
            </form>
          )}

          {feedbackMsg && (
            <p className="text-sm font-semibold text-center py-2 px-3 rounded-xl bg-[#E3F5ED] text-[#22664C]">
              {feedbackMsg}
            </p>
          )}

          {/* Digital Star Card */}
          {activeMember && (
            <div className="rounded-3xl border-2 border-[#A8DFC9] bg-gradient-to-br from-[#FAF6F0] to-[#E3F5ED] p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#2F2620]">
                    ⭐ {lang === 'en' ? shopNameEn : shopNameTh}
                  </p>
                  <p className="text-xs font-en text-[#786B5E]">
                    {lang === 'en' ? shopNameTh : shopNameEn}
                  </p>
                </div>
                <span className="font-num font-bold text-sm text-[#22664C]">
                  {activeMember.memberId}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div>
                  <p className="text-2xl font-bold text-[#2F2620]">
                    {tx(`คุณ ${activeMember.nickname}`, activeMember.nickname)}
                  </p>
                  <p className="text-xs text-[#786B5E]">
                    {activeMember.firstName} {activeMember.lastName}
                  </p>
                </div>
                <div className="text-right rounded-2xl bg-white/90 border border-[#A8DFC9] px-4 py-2">
                  <p className="text-xs font-semibold text-amber-700">
                    {tx('ดาวสะสม', 'Stars')}
                  </p>
                  <p className="font-num text-3xl font-extrabold text-[#22664C] tabular-nums">
                    ⭐ {activeMember.stars}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadCard}
                  className="flex-1 h-12 rounded-2xl bg-[#5FB894] text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {tx('💾 บันทึกรูปการ์ด', '💾 Save Card Image')}
                </button>
                {activeMember.stars >= 50 && (
                  <button
                    type="button"
                    onClick={handleRedeemClick}
                    className="h-12 px-4 rounded-2xl bg-amber-500 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Gift className="w-4 h-4" />
                    {tx('แลกฟรี (50⭐)', 'Redeem (50⭐)')}
                  </button>
                )}
              </div>
              <canvas ref={cardCanvasRef} className="hidden" />
            </div>
          )}

          {/* Admin PIN Modal for Cashier attempting Star Redemption */}
          {showRedeemPinModal && (
            <form onSubmit={handleApproveRedeemPin} className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2.5">
              <p className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                <LockKeyhole className="w-4 h-4" />
                {tx(
                  'ต้องใช้ PIN ของผู้ดูแลร้าน เพื่ออนุมัติแลกของรางวัล',
                  'Admin PIN required to approve redemption'
                )}
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder={tx('กรอก PIN ผู้ดูแล...', 'Enter Admin PIN...')}
                  className="flex-1 h-11 px-3 rounded-xl border border-amber-300 bg-white font-num"
                />
                <button type="submit" className="px-4 h-11 rounded-xl bg-amber-600 text-white font-bold cursor-pointer">
                  {tx('อนุมัติ', 'Approve')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRedeemPinModal(false)}
                  className="px-3 h-11 rounded-xl border border-amber-300 text-amber-900 cursor-pointer"
                >
                  {tx('ยกเลิก', 'Cancel')}
                </button>
              </div>
              {adminPinError && <p className="text-xs text-rose-600 font-medium">{adminPinError}</p>}
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-15 rounded-3xl bg-white text-emerald-800 font-bold text-xl shadow-lg cursor-pointer transition-transform active:scale-[0.98]"
        >
          {tx('ปิดหน้านี้ & ขายบิลถัดไป →', 'Done & Next Bill →')}
        </button>
      </div>
    </div>
  );
};
