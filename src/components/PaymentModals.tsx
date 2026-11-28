import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Copy,
  Delete,
  Download,
  ExternalLink,
  Gift,
  ImagePlus,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Paperclip,
  PauseCircle,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  X,
  ZoomIn,
} from 'lucide-react';
import { BANK_PRESETS, PaymentAccount, StaffUser } from '../config/shopConfig';
import { BearFamilyOutfits } from '../config/bearOutfits';
import { translateMenuName, translateStaffName, translateTasteNote, useLang } from '../config/i18n';
import { compressSlipImageFile } from '../utils/imageUpload';
import {
  buildLineOrderText,
  buildLineSendHref,
  copyOrderTextToClipboard,
  extractLineOaId,
  LineDeliveryInfo,
} from '../utils/lineOrder';
import { uploadSlipToSupabase } from '../utils/supabaseClient';
import { generatePromptPayQrDataUrl, isValidPromptPayTarget } from '../utils/promptpay';
import {
  BillLineItem,
  checkAutoPaymentFromSheets,
  CustomerMember,
  CustomerQueueOrder,
  findMemberByPhoneOrLast4,
  generateNextMemberId,
  getMembersCache,
  postToSheets,
  ReceiptSlipRecord,
  saveMembersCache,
} from '../utils/sheetsSync';
import { playScanError, playScanSuccess, playSoftClick, speakMessage } from '../utils/sound';
import { BearGangMascot, BearParentsCelebration, MamaBearMascot } from './BearGangMascot';
import { ReceiptSlipCard } from './ReceiptSlipCard';

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
export interface SlipVerifyMeta {
  verifyStatus: 'verified' | 'unverified' | 'manual_line';
  detectedAmount?: number;
  transactionRef?: string;
  verifyNote?: string;
  slipPublicUrl?: string;
}

interface QrPaymentModalProps {
  isOpen: boolean;
  amount: number;
  items?: BillLineItem[];
  promptPayId: string;
  promptPayAccountName?: string;
  paymentAccounts?: PaymentAccount[];
  activePaymentAccountId?: string;
  onSelectPaymentAccount?: (accountId: string) => void;
  shopNameTh: string;
  enableAutoPaymentCheck: boolean;
  scriptUrl: string;
  mascotMode?: 'kids' | 'krua';
  outfits?: BearFamilyOutfits;
  allowSlipUpload?: boolean;
  isTestMode?: boolean;
  lineShopUrl?: string;
  lineQrImageUrl?: string;
  deliveryInfo?: LineDeliveryInfo;
  roomId?: string;
  onClose: () => void;
  onConfirmPaid: (
    slipImageUrl?: string,
    bankAccountLabel?: string,
    slipMeta?: SlipVerifyMeta
  ) => Promise<void> | void;
}

export const QrPaymentModal: React.FC<QrPaymentModalProps> = ({
  isOpen,
  amount,
  items = [],
  promptPayId,
  promptPayAccountName = 'คำวัง พวงมาลา',
  paymentAccounts = [],
  activePaymentAccountId,
  onSelectPaymentAccount,
  shopNameTh,
  enableAutoPaymentCheck,
  scriptUrl,
  mascotMode = 'kids',
  outfits,
  allowSlipUpload = false,
  isTestMode = false,
  lineShopUrl = '',
  lineQrImageUrl = '',
  deliveryInfo,
  roomId = 'KKP2027',
  onClose,
  onConfirmPaid,
}) => {
  const { lang, tx } = useLang();
  const [qrUrl, setQrUrl] = useState('');
  const [isAutoPolling, setIsAutoPolling] = useState(false);
  const [slipImageUrl, setSlipImageUrl] = useState('');
  const [slipPublicUrl, setSlipPublicUrl] = useState('');
  const [slipError, setSlipError] = useState('');
  const [slipVerifyMeta, setSlipVerifyMeta] = useState<SlipVerifyMeta | null>(null);
  const [isCompressingSlip, setIsCompressingSlip] = useState(false);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [slipZoomOpen, setSlipZoomOpen] = useState(false);
  const [copiedAccountNo, setCopiedAccountNo] = useState(false);
  const [lineBackupConfirmed, setLineBackupConfirmed] = useState(false);
  const [showLineQrPreview, setShowLineQrPreview] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string>('');
  const slipInputRef = useRef<HTMLInputElement>(null);

  const effectiveAccounts = useMemo<PaymentAccount[]>(() => {
    if (paymentAccounts && paymentAccounts.length > 0) return paymentAccounts;
    return [
      {
        id: 'acc_fallback',
        bankName: 'พร้อมเพย์ (PromptPay)',
        accountName: promptPayAccountName,
        accountNumber: promptPayId,
        promptPayId,
      },
    ];
  }, [paymentAccounts, promptPayAccountName, promptPayId]);

  useEffect(() => {
    if (isOpen) {
      setLocalSelectedId(activePaymentAccountId || effectiveAccounts[0]?.id || '');
      setCopiedAccountNo(false);
    }
  }, [isOpen, activePaymentAccountId, effectiveAccounts]);

  const selectedAccount = useMemo(() => {
    const targetId = activePaymentAccountId || localSelectedId;
    return effectiveAccounts.find((a) => a.id === targetId) || effectiveAccounts[0];
  }, [effectiveAccounts, activePaymentAccountId, localSelectedId]);

  const activePromptPayTarget = useMemo(() => {
    if (!selectedAccount) return promptPayId;
    if (isValidPromptPayTarget(selectedAccount.promptPayId)) {
      return selectedAccount.promptPayId!.trim();
    }
    if (isValidPromptPayTarget(selectedAccount.accountNumber)) {
      return selectedAccount.accountNumber.trim();
    }
    return '';
  }, [selectedAccount, promptPayId]);

  const bankLabel = selectedAccount
    ? `${selectedAccount.bankName} (${selectedAccount.accountNumber})`
    : promptPayId;

  useEffect(() => {
    if (!isOpen) {
      setSlipImageUrl('');
      setSlipPublicUrl('');
      setSlipError('');
      setSlipVerifyMeta(null);
      setIsCompressingSlip(false);
      setIsVerifyingSlip(false);
      setIsSubmittingOrder(false);
      setSlipZoomOpen(false);
      setLineBackupConfirmed(false);
      setShowLineQrPreview(false);
      setQrUrl('');
      return;
    }
    if (selectedAccount?.qrImageUrl) {
      setQrUrl(selectedAccount.qrImageUrl);
      return;
    }
    if (activePromptPayTarget) {
      generatePromptPayQrDataUrl(activePromptPayTarget, amount)
        .then(setQrUrl)
        .catch(() => setQrUrl(''));
    } else {
      setQrUrl('');
    }
  }, [isOpen, selectedAccount, activePromptPayTarget, amount]);

  useEffect(() => {
    if (!isOpen || !enableAutoPaymentCheck || !scriptUrl) {
      setIsAutoPolling(false);
      return;
    }

    setIsAutoPolling(true);
    const interval = window.setInterval(async () => {
      const paid = await checkAutoPaymentFromSheets(scriptUrl, amount);
      if (paid) {
        onConfirmPaid(slipImageUrl || undefined, bankLabel, slipVerifyMeta || undefined);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [
    isOpen,
    enableAutoPaymentCheck,
    scriptUrl,
    amount,
    onConfirmPaid,
    slipImageUrl,
    bankLabel,
    slipVerifyMeta,
  ]);

  if (!isOpen) return null;

  const handleSlipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    playSoftClick();
    setSlipError('');
    setSlipVerifyMeta(null);
    setSlipImageUrl('');
    setSlipPublicUrl('');
    setIsCompressingSlip(true);

    let compressed = '';
    try {
      compressed = await compressSlipImageFile(file);
    } catch {
      playScanError();
      setIsCompressingSlip(false);
      setSlipError(
        tx(
          'ไม่สามารถอ่านรูปสลิปได้ กรุณาเลือกไฟล์ JPG หรือ PNG ค่ะ',
          'Could not read slip image. Please select a JPG or PNG file.'
        )
      );
      return;
    } finally {
      setIsCompressingSlip(false);
    }

    setIsVerifyingSlip(true);
    let uploadedPublicUrl = '';
    try {
      const uploadTask = (async () => {
        try {
          const firstTry = await uploadSlipToSupabase(file);
          if (firstTry.publicUrl) return firstTry.publicUrl;
          const errLower = (firstTry.error || '').toLowerCase();
          if (errLower.includes('failed to fetch') || errLower.includes('abort') || errLower.includes('network')) {
            return '';
          }
          const fallbackTry = await uploadSlipToSupabase(compressed);
          return fallbackTry.publicUrl || '';
        } catch {
          return '';
        }
      })();

      const boundedUploadTask = Promise.race<string>([
        uploadTask,
        new Promise<string>((resolve) => window.setTimeout(() => resolve(''), 3500)),
      ]);

      const [resolvedUrl, verifyRes] = await Promise.all([
        boundedUploadTask,
        fetch('/api/verify-slip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slipImageUrl: compressed,
            expectedAmount: amount,
            expectedAccountName: selectedAccount?.accountName || promptPayAccountName,
            expectedPromptPayId: activePromptPayTarget || selectedAccount?.accountNumber || promptPayId,
            roomId,
            lang,
          }),
        }).catch(() => null),
      ]);

      uploadedPublicUrl = resolvedUrl;
      const data = verifyRes
        ? ((await verifyRes.json().catch(() => ({}))) as {
            verified?: boolean;
            status?: 'verified' | 'rejected' | 'unverified_ai_error';
            detectedAmount?: number;
            transactionRef?: string;
            reason?: string;
          })
        : {};

      if (data.status === 'rejected') {
        if (isTestMode) {
          if (uploadedPublicUrl) {
            setSlipPublicUrl(uploadedPublicUrl);
          }
          setSlipImageUrl(compressed);
          setSlipVerifyMeta({
            verifyStatus: 'unverified',
            slipPublicUrl: uploadedPublicUrl || undefined,
            verifyNote: tx(
              '🟠 โหมดทดสอบ: แนบรูปจำลองเพื่อทดสอบระบบแล้ว (ไม่ใช่สลิปโอนจริง)',
              '🟠 Test Mode: Dummy image attached for testing (not a real slip)'
            ),
          });
          playSoftClick();
          return;
        }
        playScanError();
        setSlipImageUrl('');
        setSlipPublicUrl('');
        setSlipVerifyMeta(null);
        setSlipError(
          data.reason ||
            tx(
              'สลิปไม่ถูกต้องหรือยอดเงินไม่ตรงกับรายการสั่งซื้อ กรุณาตรวจสอบและแนบใหม่อีกครั้งค่ะ',
              'Slip is invalid or amount does not match the order total.'
            )
        );
        return;
      }

      if (uploadedPublicUrl) {
        setSlipPublicUrl(uploadedPublicUrl);
      }

      if (data.status === 'verified' && data.verified) {
        setSlipImageUrl(compressed);
        setSlipVerifyMeta({
          verifyStatus: 'verified',
          detectedAmount: data.detectedAmount,
          transactionRef: data.transactionRef,
          verifyNote: data.reason,
          slipPublicUrl: uploadedPublicUrl || undefined,
        });
        playScanSuccess();
        return;
      }

      // AI unavailable fallback: attach slip, mark strictly as unverified (store must inspect manually)
      setSlipImageUrl(compressed);
      setSlipVerifyMeta({
        verifyStatus: 'unverified',
        slipPublicUrl: uploadedPublicUrl || undefined,
        verifyNote:
          data.reason ||
          (uploadedPublicUrl
            ? tx(
                'อัปโหลดสลิปขึ้นระบบคลาวด์แล้ว ✓ รอร้านตรวจยอดเงิน',
                'Slip uploaded to cloud ✓ Waiting for shop verification'
              )
            : tx(
                'ระบบตรวจสลิปอัตโนมัติไม่ว่างชั่วคราว · รอร้านตรวจยอดเงินเข้าบัญชีด้วยตนเอง',
                'Auto slip verification unavailable · Waiting for manual shop verification'
              )),
      });
      playSoftClick();
    } catch {
      if (uploadedPublicUrl) {
        setSlipPublicUrl(uploadedPublicUrl);
      }
      setSlipImageUrl(compressed);
      setSlipVerifyMeta({
        verifyStatus: 'unverified',
        slipPublicUrl: uploadedPublicUrl || undefined,
        verifyNote: tx(
          'ไม่สามารถเชื่อมต่อระบบตรวจสลิปอัตโนมัติ · รอร้านตรวจยอดเงินเข้าบัญชีด้วยตนเอง',
          'Could not reach auto slip check · Waiting for manual shop verification'
        ),
      });
    } finally {
      setIsVerifyingSlip(false);
    }
  };

  const cleanLineUrl = lineShopUrl.trim();
  const hasOaId = Boolean(extractLineOaId(cleanLineUrl));
  const lineOrderMessage = buildLineOrderText({
    shopNameTh,
    items,
    totalAmount: amount,
    deliveryInfo,
    noteLine: tx(
      '💳 แจ้งชำระเงิน / แนบสลิปทาง LINE ค่ะ',
      '💳 Payment confirmation / slip via LINE'
    ),
  });
  const effectiveLineHref =
    hasOaId || !/^https?:\/\//i.test(cleanLineUrl)
      ? buildLineSendHref(lineOrderMessage, cleanLineUrl)
      : buildLineSendHref(lineOrderMessage);

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
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate" style={{ color: 'var(--text-main)' }}>
                {tx('สแกนจ่าย / โอนเงินเข้าบัญชีร้าน', 'Scan QR / Bank Transfer')}
              </h3>
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                {shopNameTh} · {selectedAccount?.bankName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer shrink-0"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              aria-label={tx('ปิดหน้าต่าง', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 flex flex-col items-center text-center space-y-3.5">
            {/* Multi-Bank Account Selector when shop has >= 2 accounts */}
            {effectiveAccounts.length > 1 && (
              <div className="w-full space-y-1.5 text-left">
                <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  {tx('เลือกบัญชีธนาคารที่ต้องการรับโอน:', 'Select Receiving Bank Account:')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {effectiveAccounts.map((acc) => {
                    const active = acc.id === selectedAccount?.id;
                    const preset = BANK_PRESETS.find((b) => b.name === acc.bankName);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setLocalSelectedId(acc.id);
                          onSelectPaymentAccount?.(acc.id);
                          setCopiedAccountNo(false);
                        }}
                        className="px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                        style={{
                          backgroundColor: active
                            ? preset?.badgeColor || 'var(--accent-soft)'
                            : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                          color: active ? preset?.textColor || 'var(--accent-text)' : 'var(--text-main)',
                        }}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        <span>{acc.bankName.split(' (')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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

            {/* Total Amount + Selected Bank Receiver Details */}
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
                className="pt-2 mt-1 border-t text-xs sm:text-sm space-y-1"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <p className="font-bold" style={{ color: 'var(--text-main)' }}>
                  {selectedAccount?.bankName}
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="font-num font-bold tracking-wide text-base" style={{ color: 'var(--accent-text)' }}>
                    {selectedAccount?.accountNumber || promptPayId}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      playSoftClick();
                      try {
                        await navigator.clipboard.writeText(
                          (selectedAccount?.accountNumber || promptPayId).replace(/\s+/g, '')
                        );
                        setCopiedAccountNo(true);
                        window.setTimeout(() => setCopiedAccountNo(false), 2000);
                      } catch {
                        // Ignore clipboard restriction
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  >
                    {copiedAccountNo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedAccountNo ? tx('คัดลอกแล้ว', 'Copied') : tx('คัดลอกเลข', 'Copy')}
                  </button>
                </div>
                {(selectedAccount?.accountName || promptPayAccountName) && (
                  <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {tx('ชื่อบัญชี:', 'Account Name:')}{' '}
                    <span style={{ color: 'var(--text-main)' }}>
                      {selectedAccount?.accountName || promptPayAccountName}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* QR Code (Uploaded Bank QR or Dynamic PromptPay QR) */}
            {qrUrl ? (
              <div className="p-3 bg-white rounded-3xl border shadow-inner" style={{ borderColor: 'var(--border-soft)' }}>
                <img src={qrUrl} alt="Payment QR Code" className="w-52 h-52 sm:w-56 sm:h-56 object-contain" />
              </div>
            ) : activePromptPayTarget ? (
              <div className="p-3 bg-white rounded-3xl border shadow-inner" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="w-52 h-52 flex items-center justify-center text-sm text-stone-400">
                  {tx('กำลังสร้าง QR Code...', 'Generating QR Code...')}
                </div>
              </div>
            ) : (
              <div
                className="w-full rounded-2xl border border-dashed p-4 text-xs space-y-1"
                style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--accent-border)', color: 'var(--text-muted)' }}
              >
                <p className="font-bold text-sm" style={{ color: 'var(--accent-text)' }}>
                  {tx('โอนเงินผ่านเลขบัญชีธนาคารด้านบนได้เลยค่ะ', 'Transfer via the bank account number above')}
                </p>
                <p>
                  {tx(
                    'กดปุ่ม "คัดลอกเลข" เพื่อนำไปวางโอนในแอปธนาคารได้ทันทีค่ะ',
                    'Tap "Copy" to paste the account number in your banking app.'
                  )}
                </p>
              </div>
            )}

            {/* Primary Web Slip Upload + Small Backup LINE Option */}
            {allowSlipUpload && (
              <div
                className="w-full rounded-2xl border p-3.5 text-left space-y-2.5"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--accent-border)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                    <Paperclip className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                    {tx('แนบสลิปโอนเงิน (ส่งตรงเข้าร้าน)', 'Attach Transfer Slip (Direct Web Upload)')}
                  </p>
                  {slipImageUrl && (
                    <span
                      className="px-2 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                      style={{
                        backgroundColor:
                          slipVerifyMeta?.verifyStatus === 'verified' ? '#DCFCE7' : '#FEF3C7',
                        color:
                          slipVerifyMeta?.verifyStatus === 'verified' ? '#166534' : '#92400E',
                      }}
                    >
                      {slipVerifyMeta?.verifyStatus === 'verified' ? (
                        <>
                          <ShieldCheck className="w-3 h-3" />
                          {tx('สลิปตรงยอด', 'Amount Matched')}
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          {tx('รอร้านตรวจสลิป', 'Manual Check')}
                        </>
                      )}
                    </span>
                  )}
                </div>

                <input
                  ref={slipInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSlipFileChange}
                  className="hidden"
                />

                {slipImageUrl ? (
                  <div className="flex items-center gap-3 rounded-2xl border p-2.5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setSlipZoomOpen(true);
                      }}
                      className="relative w-18 h-24 rounded-xl overflow-hidden border shrink-0 bg-white cursor-pointer group"
                      style={{ borderColor: 'var(--accent-primary)' }}
                      title={tx('แตะเพื่อดูรูปสลิปขนาดใหญ่', 'Tap to enlarge slip')}
                    >
                      <img
                        src={slipImageUrl}
                        alt={tx('รูปสลิปโอนเงิน', 'Transfer slip preview')}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 w-5 h-5 rounded-md bg-black/60 text-white flex items-center justify-center">
                        <ZoomIn className="w-3 h-3" />
                      </span>
                    </button>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <p
                        className="text-xs font-bold"
                        style={{
                          color:
                            slipVerifyMeta?.verifyStatus === 'verified' ? '#15803D' : '#B45309',
                        }}
                      >
                        {slipVerifyMeta?.verifyNote ||
                          tx('พร้อมส่งให้ทางร้านตรวจสอบแล้วค่ะ', 'Ready to send for shop verification')}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {tx('แตะที่รูปสลิปเพื่อขยายตรวจดูความชัดเจนได้ค่ะ', 'Tap preview image to inspect clearly')}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            playSoftClick();
                            slipInputRef.current?.click();
                          }}
                          className="px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
                          style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                        >
                          {tx('เปลี่ยนรูปสลิป', 'Change Slip')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playSoftClick();
                            setSlipImageUrl('');
                            setSlipPublicUrl('');
                            setSlipVerifyMeta(null);
                            setSlipError('');
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
                        >
                          <Trash2 className="w-3 h-3" />
                          {tx('ลบรูป', 'Remove')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={isCompressingSlip || isVerifyingSlip}
                      onClick={() => {
                        playSoftClick();
                        slipInputRef.current?.click();
                      }}
                      className="w-full h-12 px-4 rounded-xl border-2 border-dashed font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.99] disabled:opacity-60"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--accent-primary)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {isVerifyingSlip ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Paperclip className="w-4 h-4" />
                      )}
                      {isCompressingSlip
                        ? tx('กำลังย่อขนาดรูปสลิป...', 'Compressing slip image...')
                        : isVerifyingSlip
                          ? tx('กำลังตรวจสอบยอดเงินในสลิป...', 'Verifying slip amount...')
                          : tx('แนบสลิปโอนเงิน', 'Attach Transfer Slip')}
                    </button>
                    <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'ระบบจะตรวจสอบยอดเงินในสลิปอัตโนมัติ หากยอดไม่ตรงจะไม่สามารถส่งออเดอร์ได้ค่ะ',
                        'System checks transfer amount automatically · Wrong-amount slips are blocked'
                      )}
                    </p>
                  </div>
                )}

                {slipError && (
                  <div
                    className="rounded-xl border px-3 py-2 text-xs font-bold flex items-start gap-2"
                    style={{ backgroundColor: '#FFE4E6', borderColor: '#FDA4AF', color: '#BE123C' }}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{slipError}</span>
                  </div>
                )}

                {/* Small Secondary Backup LINE Button (with full itemized order) */}
                <div className="pt-1 border-t space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {lineBackupConfirmed
                        ? tx('คัดลอกรายการอาหาร & เปิด LINE แล้ว ✓', 'Order copied & LINE opened ✓')
                        : tx('ทางเลือกสำรอง:', 'Backup option:')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {lineQrImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            playSoftClick();
                            void copyOrderTextToClipboard(lineOrderMessage);
                            setShowLineQrPreview((prev) => !prev);
                          }}
                          className="px-2 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          style={{
                            backgroundColor: showLineQrPreview ? '#DCFCE7' : 'var(--bg-card)',
                            borderColor: '#86EFAC',
                            color: '#15803D',
                          }}
                        >
                          {tx('ดู QR LINE', 'LINE QR')}
                        </button>
                      )}
                      <a
                        href={effectiveLineHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          playSoftClick();
                          void copyOrderTextToClipboard(lineOrderMessage);
                          setLineBackupConfirmed(true);
                        }}
                        className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:opacity-85"
                        style={{
                          backgroundColor: lineBackupConfirmed ? '#DCFCE7' : 'var(--bg-card)',
                          borderColor: '#86EFAC',
                          color: '#15803D',
                        }}
                      >
                        <MessageCircle className="w-3 h-3" />
                        {tx('ส่งรายการ & สลิปทาง LINE', 'Send Order via LINE')}
                        <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                      </a>
                    </div>
                  </div>
                  {showLineQrPreview && lineQrImageUrl && (
                    <div className="rounded-xl border bg-white p-2.5 flex flex-col items-center gap-1.5" style={{ borderColor: '#86EFAC' }}>
                      <img
                        src={lineQrImageUrl}
                        alt={tx('คิวอาร์โค้ด LINE ร้าน', 'Shop LINE QR')}
                        className="w-40 h-40 object-contain rounded-lg"
                      />
                      <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                        {tx('สแกนเพิ่มเพื่อน LINE ร้าน แล้วกด "วาง" รายการอาหารที่คัดลอกไว้ได้เลยค่ะ', 'Scan to add LINE & paste copied order!')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Check Status */}
            {allowSlipUpload && isTestMode && !slipImageUrl && (
              <p
                className="text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl w-full border"
                style={{ backgroundColor: '#FFEDD5', borderColor: '#FDBA74', color: '#9A3412' }}
              >
                {tx(
                  '🟠 โหมดทดสอบ: กดปุ่ม "ทดสอบส่งออเดอร์" ด้านล่างได้เลยโดยไม่ต้องโอนเงินจริง (หรือลองแนบรูปใดๆ เพื่อทดสอบระบบสลิป)',
                  '🟠 Test Mode: Tap below to submit a test order without real transfer (or attach any photo to test slip upload)'
                )}
              </p>
            )}

            {allowSlipUpload && !isTestMode && !slipImageUrl && !lineBackupConfirmed && (
              <p
                className="text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl w-full"
                style={{ backgroundColor: '#FFE4E6', color: '#BE123C' }}
              >
                {tx(
                  'กรุณาแนบรูปสลิปโอนเงินด้านบนก่อนกดส่งออเดอร์นะคะ',
                  'Please attach your transfer slip above before sending the order.'
                )}
              </p>
            )}

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
                    `ตรวจสอบชื่อบัญชี "${selectedAccount?.accountName || promptPayAccountName}" และยอดเงินก่อนกดยืนยัน`,
                    `Verify account name "${selectedAccount?.accountName || promptPayAccountName}" & amount before confirming`
                  )}
            </p>

            {/* Optional Slip Upload for Staff POS QR Modal */}
            {!allowSlipUpload && (
              <div
                className="w-full rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-2 text-left"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              >
                <input
                  ref={slipInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSlipFileChange}
                  className="hidden"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-main)' }}>
                    {slipImageUrl
                      ? slipPublicUrl
                        ? tx('แนบสลิป & บันทึกขึ้น Supabase แล้ว ✓', 'Slip attached & uploaded ✓')
                        : tx('แนบรูปสลิปแล้ว ✓', 'Slip attached ✓')
                      : tx('แนบสลิปโอนเงินเก็บลงฐานข้อมูล (ไม่บังคับ)', 'Attach slip to save with order (optional)')}
                  </p>
                  {slipError && (
                    <p className="text-[11px] font-semibold text-rose-600">{slipError}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isCompressingSlip || isVerifyingSlip}
                    onClick={() => {
                      playSoftClick();
                      slipInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      borderColor: 'var(--accent-border)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    {isVerifyingSlip || isCompressingSlip ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5" />
                    )}
                    {isVerifyingSlip || isCompressingSlip
                      ? tx('กำลังอัปโหลด...', 'Uploading...')
                      : slipImageUrl
                        ? tx('เปลี่ยนสลิป', 'Change')
                        : tx('แนบรูปสลิป', 'Attach Slip')}
                  </button>
                  {slipImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setSlipImageUrl('');
                        setSlipPublicUrl('');
                        setSlipVerifyMeta(null);
                        setSlipError('');
                      }}
                      className="px-2 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                      style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
                    >
                      {tx('ลบ', 'Remove')}
                    </button>
                  )}
                </div>
              </div>
            )}

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
                disabled={
                  isCompressingSlip ||
                  isVerifyingSlip ||
                  isSubmittingOrder ||
                  (allowSlipUpload && !isTestMode && !slipImageUrl && !lineBackupConfirmed)
                }
                onClick={async () => {
                  if (isSubmittingOrder) return;
                  const meta: SlipVerifyMeta | undefined = allowSlipUpload
                    ? slipImageUrl
                      ? {
                          ...(slipVerifyMeta || { verifyStatus: 'unverified' }),
                          slipPublicUrl: slipPublicUrl || slipVerifyMeta?.slipPublicUrl,
                        }
                      : isTestMode && !lineBackupConfirmed
                        ? {
                            verifyStatus: 'unverified',
                            verifyNote: tx(
                              '🟠 ออเดอร์จำลอง (โหมดทดสอบ · ไม่ได้โอนเงินจริง)',
                              '🟠 Simulated test order (Test Mode · No real transfer)'
                            ),
                          }
                        : {
                            verifyStatus: 'manual_line',
                            verifyNote: tx(
                              'ลูกค้าเลือกส่งสลิปทาง LINE สำรอง · รอร้านตรวจยอดเข้าบัญชีก่อนรับออเดอร์',
                              'Customer opted for LINE backup slip · Waiting for manual shop verification'
                            ),
                          }
                    : slipImageUrl
                      ? {
                          ...(slipVerifyMeta || { verifyStatus: 'unverified' }),
                          slipPublicUrl: slipPublicUrl || slipVerifyMeta?.slipPublicUrl,
                        }
                      : undefined;
                  setIsSubmittingOrder(true);
                  try {
                    await onConfirmPaid(slipImageUrl || undefined, bankLabel, meta);
                  } finally {
                    setIsSubmittingOrder(false);
                  }
                }}
                className="col-span-2 h-14 rounded-2xl font-bold text-base sm:text-lg text-white cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-transform active:scale-95 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: allowSlipUpload
                    ? isTestMode && !slipImageUrl && !lineBackupConfirmed
                      ? '#EA580C'
                      : '#0369A1'
                    : '#16A34A',
                }}
              >
                {isSubmittingOrder && <Loader2 className="w-5 h-5 animate-spin" />}
                {isSubmittingOrder
                  ? tx('กำลังบันทึกออเดอร์และสลิป...', 'Saving order & slip...')
                  : allowSlipUpload
                    ? slipImageUrl
                      ? tx('ส่งออเดอร์ & สลิปให้ร้านตรวจสอบ ✓', 'Send Order & Slip for Verification ✓')
                      : isTestMode && !lineBackupConfirmed
                        ? tx('🧪 ทดสอบส่งออเดอร์ (โหมดทดสอบ) ✓', '🧪 Submit Test Order ✓')
                        : tx('ส่งออเดอร์ (รอตรวจสลิปทาง LINE) ✓', 'Send Order (LINE Slip Check) ✓')
                    : tx('โอนเรียบร้อยแล้ว ✓', 'Payment Confirmed ✓')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-size Preview Modal for Customer Before Submitting */}
      {slipZoomOpen && slipImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setSlipZoomOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <h4 className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
                {tx('ตัวอย่างรูปสลิปก่อนส่ง', 'Slip Preview Before Sending')}
              </h4>
              <button
                type="button"
                onClick={() => setSlipZoomOpen(false)}
                className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                aria-label={tx('ปิดหน้าต่าง', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex justify-center bg-stone-50">
              <img
                src={slipImageUrl}
                alt={tx('ตัวอย่างรูปสลิป', 'Slip preview')}
                className="max-h-[70vh] w-auto rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
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
  receiptSlipEnabled?: boolean;
  exitScannerEnabled?: boolean;
  receiptData?: ReceiptSlipRecord | null;
  pendingOrder?: CustomerQueueOrder | null;
  lineShopUrl?: string;
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
  receiptSlipEnabled = true,
  exitScannerEnabled = true,
  receiptData,
  pendingOrder,
  lineShopUrl = '',
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
  const lastSpokenStateRef = useRef<string>('');

  const isWaitingMerchant = Boolean(pendingOrder && !pendingOrder.accepted);

  useEffect(() => {
    if (!isOpen) {
      setPhoneQuery('');
      setActiveMember(null);
      setFeedbackMsg('');
      setShowRegisterForm(false);
      setShowRedeemPinModal(false);
      setAdminPinInput('');
      setAdminPinError('');
      lastSpokenStateRef.current = '';
      return;
    }

    const stateKey = isWaitingMerchant ? 'waiting' : 'confirmed';
    if (lastSpokenStateRef.current === stateKey) return;
    lastSpokenStateRef.current = stateKey;

    if (isWaitingMerchant) {
      const spokenPending =
        lang === 'en'
          ? 'Your order and slip have been sent to the shop. Please wait while the staff verifies your payment.'
          : 'ส่งคำสั่งซื้อและสลิปเข้าร้านแล้วค่ะ กรุณารอพนักงานตรวจสอบยอดเงินสักครู่นะคะ';
      speakMessage(spokenPending, lang);
    } else {
      const cleanAmount = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
      const spoken =
        lang === 'en'
          ? `Received ${cleanAmount} baht. Payment confirmed, thank you!`
          : `ได้รับเงิน ${cleanAmount} บาท เรียบร้อยแล้วค่ะ ขอบคุณค่ะ`;
      speakMessage(spoken, lang);
    }
  }, [isOpen, amount, lang, isWaitingMerchant]);

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
    <div
      className={`fixed inset-0 z-50 overflow-y-auto text-white p-4 sm:p-6 flex flex-col items-center justify-center transition-colors ${
        isWaitingMerchant ? 'bg-amber-600' : 'bg-emerald-600'
      }`}
    >
      <div className="w-full max-w-2xl space-y-5 my-auto">
        {/* Celebrating Bears with Stars */}
        {mascotMode === 'krua' ? (
          <BearParentsCelebration outfits={outfits} />
        ) : (
          <BearGangMascot pose="celebrating" outfits={outfits} />
        )}

        <div className="text-center space-y-1.5 print:hidden">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 text-white font-semibold text-sm">
            {isWaitingMerchant ? (
              <>
                <Clock className="w-4 h-4" />
                {tx(
                  'ส่งคำสั่งซื้อและสลิปเข้าร้านแล้ว · รอร้านตรวจสอบยอดเงิน',
                  'Order & Slip Sent · Waiting for Shop Verification'
                )}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {pendingOrder
                  ? tx(
                      'ร้านตรวจสอบสลิปและรับออเดอร์เรียบร้อยแล้วค่ะ ✓',
                      'Shop Verified Slip & Accepted Order ✓'
                    )
                  : tx('ชำระเงินสำเร็จเรียบร้อยแล้วค่ะ', 'Payment Successful!')}
              </>
            )}
          </div>
          {pendingOrder && (
            <p className="text-sm font-bold text-white/95">
              {tx(`คิวที่ #${pendingOrder.queueNo}`, `Queue #${pendingOrder.queueNo}`)} · #{pendingOrder.orderId}
            </p>
          )}
          <h2 className="font-num text-5xl sm:text-6xl font-extrabold tracking-tight tabular-nums">
            ฿{amount.toLocaleString('th-TH')}
          </h2>
          <p className={`${isWaitingMerchant ? 'text-amber-50' : 'text-emerald-100'} text-base sm:text-lg font-medium`}>
            {isWaitingMerchant
              ? tx(
                  'กรุณารอพนักงานตรวจสอบยอดเงินเข้าบัญชีและกดรับออเดอร์นะคะ หน้าจอนี้จะเปลี่ยนเป็นสีเขียวทันทีที่ร้านยืนยันค่ะ',
                  'Please wait for staff to verify your payment and accept the order. This screen turns green automatically once confirmed.'
                )
              : tx(`บิลนี้ได้รับ ⭐ +${starsToGrant} ดาว`, `This bill earned ⭐ +${starsToGrant} Stars`)}
          </p>
        </div>

        {isWaitingMerchant ? (
          <div className="rounded-3xl bg-white/15 border border-white/30 p-5 text-center space-y-3 print:hidden">
            <div className="flex items-center justify-center gap-2 text-sm font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              {tx('กำลังรอหน้าร้านกดรับออเดอร์...', 'Waiting for shop confirmation...')}
            </div>
            <p className="text-xs text-amber-50/95">
              {tx(
                'ใบเสร็จรับเงินและคิวสะสมดาวจะเปิดให้อัตโนมัติหลังร้านตรวจสลิปถูกต้องแล้วเท่านั้นค่ะ',
                'Official receipt & star points unlock only after the shop verifies your slip.'
              )}
            </p>
            {pendingOrder && (() => {
              const orderMsg = buildLineOrderText({
                shopNameTh,
                items: pendingOrder.items,
                totalAmount: pendingOrder.totalAmount,
                deliveryInfo: {
                  deliveryType: pendingOrder.deliveryType,
                  tableNumber: pendingOrder.tableNumber,
                  customerName: pendingOrder.customerName,
                  dropPoint: pendingOrder.dropPoint,
                },
                orderRef: `${pendingOrder.orderId} (คิว #${pendingOrder.queueNo})`,
                noteLine: tx(
                  '📲 ส่งรายการอาหารยืนยันเข้า LINE ร้านค่ะ',
                  '📲 Food order confirmation sent via LINE'
                ),
              });
              const lineHref = buildLineSendHref(orderMsg, lineShopUrl);
              return (
                <a
                  href={lineHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    playSoftClick();
                    void copyOrderTextToClipboard(orderMsg);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#06C755] hover:bg-[#05B34C] text-white font-bold text-sm shadow-md transition-transform active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  {tx('ส่งเมนูอาหารเข้า LINE ร้านด้วย', 'Also Send Order to Shop LINE')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Digital & Printable Receipt Slip with Gate Exit QR */}
            {receiptSlipEnabled && receiptData ? (
              <ReceiptSlipCard receipt={receiptData} exitScannerEnabled={exitScannerEnabled} />
            ) : !receiptSlipEnabled ? (
              <div className="rounded-2xl bg-white/15 border border-white/25 px-4 py-3 text-center text-sm font-semibold text-emerald-50 flex items-center justify-center gap-2 print:hidden">
                <PauseCircle className="w-4 h-4 shrink-0" />
                {tx(
                  'ปิดการออกใบสลิปชั่วคราว (บันทึกยอดขายเรียบร้อยแล้ว)',
                  'Receipt slip issuance is paused (sale recorded)'
                )}
              </div>
            ) : null}

            {/* Loyalty / Member Card Box */}
            <div className="rounded-3xl bg-[#FFFDF9] text-[#2F2620] p-5 sm:p-6 shadow-xl space-y-4 print:hidden">
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
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`w-full h-15 rounded-3xl bg-white font-bold text-xl shadow-lg cursor-pointer transition-transform active:scale-[0.98] print:hidden ${
            isWaitingMerchant ? 'text-amber-800' : 'text-emerald-800'
          }`}
        >
          {isWaitingMerchant
            ? tx('ดูคิวอาหาร / สั่งเพิ่ม →', 'View Queue / Order More →')
            : tx('ปิดหน้านี้ & ขายบิลถัดไป →', 'Done & Next Bill →')}
        </button>
      </div>
    </div>
  );
};
