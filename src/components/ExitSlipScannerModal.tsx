import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Keyboard,
  PauseCircle,
  PlayCircle,
  QrCode,
  ScanLine,
  ShieldAlert,
  X,
} from 'lucide-react';
import { translateMenuName, useLang } from '../config/i18n';
import { parseExitPassCode, ReceiptSlipRecord } from '../utils/sheetsSync';
import { playScanError, playScanSuccess, playSoftClick, speakMessage } from '../utils/sound';

interface ExitSlipScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: ReceiptSlipRecord[];
  staffName: string;
  exitScannerEnabled: boolean;
  onToggleExitScanner: (next: boolean) => void;
  onMarkReceiptExited: (billId: string) => void;
}

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
}

type VerificationResult =
  | { status: 'idle' }
  | { status: 'valid'; receipt: ReceiptSlipRecord }
  | { status: 'already-exited'; receipt: ReceiptSlipRecord }
  | { status: 'not-found'; scannedCode: string };

export const ExitSlipScannerModal: React.FC<ExitSlipScannerModalProps> = ({
  isOpen,
  onClose,
  receipts,
  exitScannerEnabled,
  onToggleExitScanner,
  onMarkReceiptExited,
}) => {
  const { lang, tx } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const [cameraError, setCameraError] = useState(false);
  const [supportsDetector, setSupportsDetector] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [verification, setVerification] = useState<VerificationResult>({ status: 'idle' });

  const verifySlipCode = useCallback(
    (rawValue: string) => {
      const billId = parseExitPassCode(rawValue);
      if (!billId) return;

      const found = receipts.find((r) => r.billId.toUpperCase() === billId);
      if (!found) {
        playScanError();
        setVerification({ status: 'not-found', scannedCode: billId });
        speakMessage(
          lang === 'en'
            ? 'Receipt not found. Please check payment with the customer.'
            : 'ไม่พบข้อมูลใบสลิปนี้ในระบบค่ะ กรุณาตรวจสอบอีกครั้ง',
          lang
        );
        return;
      }

      if (found.exitedAt) {
        playScanError();
        setVerification({ status: 'already-exited', receipt: found });
        speakMessage(
          lang === 'en'
            ? 'This receipt slip was already scanned at the exit.'
            : 'ใบสลิปนี้ถูกสแกนผ่านประตูไปแล้วค่ะ',
          lang
        );
        return;
      }

      playScanSuccess();
      const verifiedSnapshot: ReceiptSlipRecord = {
        ...found,
        exitedAt: new Date().toISOString(),
      };
      setVerification({ status: 'valid', receipt: verifiedSnapshot });
      onMarkReceiptExited(found.billId);
      speakMessage(
        lang === 'en'
          ? `Verified! Paid ${found.totalAmount} baht. Exit approved.`
          : `ผ่านประตูได้ค่ะ ชำระเงิน ${found.totalAmount} บาทเรียบร้อยแล้ว`,
        lang
      );
    },
    [receipts, onMarkReceiptExited, lang]
  );

  useEffect(() => {
    if (!isOpen) {
      setVerification({ status: 'idle' });
      setManualCode('');
      return;
    }
    if (!exitScannerEnabled) {
      return;
    }

    let stream: MediaStream | null = null;
    let timerId: number | null = null;
    let active = true;

    const startCamera = async () => {
      setCameraError(false);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const Win = window as unknown as {
          BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorInstance;
        };

        if (!Win.BarcodeDetector) {
          setSupportsDetector(false);
          return;
        }

        setSupportsDetector(true);
        const detector = new Win.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39'],
        });

        const scanFrame = async () => {
          if (!active || !videoRef.current) return;
          if (videoRef.current.readyState >= 2) {
            try {
              const results = await detector.detect(videoRef.current);
              if (results.length > 0 && results[0].rawValue) {
                const code = results[0].rawValue.trim();
                const now = Date.now();
                if (now - lastScanRef.current.time >= 1600 || code !== lastScanRef.current.code) {
                  lastScanRef.current = { code, time: now };
                  verifySlipCode(code);
                }
              }
            } catch {
              // Skip frame error
            }
          }
          if (active) {
            timerId = window.setTimeout(scanFrame, 280);
          }
        };

        timerId = window.setTimeout(scanFrame, 450);
      } catch {
        setCameraError(true);
      }
    };

    startCamera();

    return () => {
      active = false;
      if (timerId !== null) window.clearTimeout(timerId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, exitScannerEnabled, verifySlipCode]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playSoftClick();
    verifySlipCode(manualCode);
    setManualCode('');
  };

  const recentReceipts = receipts.slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div
        className="w-full max-w-2xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {tx('สแกนใบสลิปผ่านประตู (สำหรับคุณแม่ / พนักงาน)', 'Exit Gate Slip Scanner')}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  'ส่อง QR บนใบสลิปของลูกค้าที่ชำระเงินเอง เพื่อตรวจยืนยันก่อนออกจากร้านค่ะ',
                  'Scan customer self-order QR receipt to verify payment before exiting.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playSoftClick();
                onToggleExitScanner(!exitScannerEnabled);
              }}
              className="px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: exitScannerEnabled ? '#ECFDF5' : '#FFF1F2',
                borderColor: exitScannerEnabled ? '#A7F3D0' : '#FECDD3',
                color: exitScannerEnabled ? '#065F46' : '#9F1239',
              }}
            >
              {exitScannerEnabled ? (
                <>
                  <PauseCircle className="w-4 h-4 shrink-0" />
                  {tx('เปิดใช้อยู่ (กดหยุดใช้)', 'Active (Pause)')}
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 shrink-0" />
                  {tx('หยุดใช้อยู่ (กดเปิดใช้)', 'Paused (Resume)')}
                </>
              )}
            </button>

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
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Verification Result Banner */}
          {verification.status === 'valid' && (
            <div className="rounded-3xl bg-emerald-600 text-white p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-8 h-8 shrink-0" />
                  <div>
                    <p className="text-xl font-extrabold">
                      {tx('ผ่านประตูได้ · ชำระเงินเรียบร้อยแล้ว', 'EXIT APPROVED · PAID')}
                    </p>
                    <p className="text-xs text-emerald-100">
                      #{verification.receipt.billId} · {verification.receipt.shopName}
                    </p>
                  </div>
                </div>
                <span className="font-num text-2xl font-extrabold">
                  ฿{verification.receipt.totalAmount.toLocaleString('th-TH')}
                </span>
              </div>

              <div className="rounded-2xl bg-white/15 px-3.5 py-2.5 text-xs space-y-1">
                <p>
                  <span className="opacity-80">{tx('ช่องทาง:', 'Payment:')}</span>{' '}
                  <strong>{verification.receipt.paymentMethod}</strong>
                  {verification.receipt.deliveryInfo ? ` · ${verification.receipt.deliveryInfo}` : ''}
                </p>
                {verification.receipt.items.length > 0 && (
                  <p>
                    <span className="opacity-80">{tx('รายการ:', 'Items:')}</span>{' '}
                    {verification.receipt.items
                      .map((i) => `${translateMenuName(i.name, lang)} ×${i.qty}`)
                      .join(', ')}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setVerification({ status: 'idle' });
                }}
                className="w-full h-11 rounded-2xl bg-white text-emerald-800 font-bold text-sm cursor-pointer"
              >
                {tx('พร้อมสแกนสลิปใบถัดไป', 'Ready for Next Slip')}
              </button>
            </div>
          )}

          {verification.status === 'already-exited' && (
            <div className="rounded-3xl bg-amber-50 border-2 border-amber-400 text-amber-950 p-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-7 h-7 text-amber-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-base">
                    {tx('สลิปนี้ถูกสแกนออกประตูไปแล้ว!', 'Slip Already Used at Exit!')}
                  </p>
                  <p className="text-xs text-amber-800">
                    #{verification.receipt.billId} ·{' '}
                    {tx('สแกนออกเมื่อ', 'Scanned at')}{' '}
                    {new Date(verification.receipt.exitedAt || '').toLocaleTimeString('th-TH')}
                    {verification.receipt.exitedBy ? ` (${verification.receipt.exitedBy})` : ''}
                  </p>
                </div>
              </div>
              <p className="text-xs text-amber-800">
                {tx(
                  'ยอดเงิน ฿' +
                    verification.receipt.totalAmount.toLocaleString('th-TH') +
                    ' · ป้องกันการใช้สลิปซ้ำ กรุณาตรวจสอบกับลูกค้าค่ะ',
                  'Amount ฿' +
                    verification.receipt.totalAmount.toLocaleString('th-TH') +
                    ' · Duplicate slip protection triggered.'
                )}
              </p>
            </div>
          )}

          {verification.status === 'not-found' && (
            <div className="rounded-3xl bg-rose-50 border-2 border-rose-400 text-rose-900 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
                <p className="font-extrabold text-base">
                  {tx('ไม่พบข้อมูลการชำระเงินของสลิปนี้', 'Receipt Slip Not Found')}
                </p>
              </div>
              <p className="text-xs text-rose-700">
                {tx(
                  `รหัสที่อ่านได้: "${verification.scannedCode}" ไม่ตรงกับบิลที่ชำระเงินในห้องร้าน (${receipts.length} บิลล่าสุด)`,
                  `Scanned code "${verification.scannedCode}" was not found in synced paid receipts.`
                )}
              </p>
            </div>
          )}

          {/* Camera Viewport or Paused Banner */}
          {!exitScannerEnabled ? (
            <div
              className="rounded-2xl border-2 border-dashed p-6 text-center space-y-3"
              style={{
                backgroundColor: '#FFF1F2',
                borderColor: '#FECDD3',
                color: '#9F1239',
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/80 mx-auto flex items-center justify-center shadow-sm">
                <PauseCircle className="w-7 h-7 text-rose-600" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-extrabold">
                  {tx('ระบบสแกนสลิปผ่านประตูถูกกดหยุดใช้ชั่วคราว', 'Exit Gate Slip Scanner Is Paused')}
                </p>
                <p className="text-xs text-rose-800">
                  {tx(
                    'กล้องสแกนและคิวอาร์โค้ดผ่านประตูบนสลิปใหม่ถูกปิดไว้ชั่วคราว สามารถกดเปิดใช้งานใหม่ได้ทันทีค่ะ',
                    'Camera scanning and exit QR codes on new slips are paused. Tap below to resume anytime.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  onToggleExitScanner(true);
                }}
                className="px-5 h-11 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <PlayCircle className="w-4 h-4" />
                {tx('กดเปิดใช้สแกนสลิปผ่านประตู', 'Resume Exit Slip Scanner')}
              </button>
            </div>
          ) : (
            <>
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-stone-900 flex items-center justify-center">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-emerald-300/95 bg-emerald-400/5 flex items-center justify-center">
                    <QrCode className="w-8 h-8 text-emerald-300/60" />
                  </div>
                </div>
                {cameraError && (
                  <div className="absolute inset-0 bg-stone-900/90 flex flex-col items-center justify-center p-6 text-center text-white text-sm gap-2">
                    <Camera className="w-7 h-7 text-emerald-300" />
                    <p>
                      {tx(
                        'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง หรือพิมพ์เลขบิล (เช่น B123456) ด้านล่างค่ะ',
                        'Cannot access camera. Please allow camera access or type the Bill ID below.'
                      )}
                    </p>
                  </div>
                )}
              </div>

              {!supportsDetector && !cameraError && (
                <p
                  className="text-xs px-3 py-2 rounded-xl text-center"
                  style={{ backgroundColor: 'var(--pastel-peach)', color: 'var(--pastel-peach-text)' }}
                >
                  {tx(
                    'เบราว์เซอร์นี้ไม่รองรับการอ่าน QR อัตโนมัติจากกล้อง สามารถพิมพ์เลขบิล (เช่น B123456) หรือกดยืนยันจากรายการล่าสุดด้านล่างได้เลยค่ะ',
                    'Camera auto-QR is unsupported in this browser. Enter the Bill ID or tap a recent slip below.'
                  )}
                </p>
              )}
            </>
          )}

          {/* Manual Bill ID Entry */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={tx('พิมพ์เลขบิลบนสลิป (เช่น B123456)...', 'Enter Bill ID on slip (e.g. B123456)...')}
                className="w-full h-12 pl-10 pr-3 rounded-2xl border text-base font-num focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-main)',
                }}
              />
            </div>
            <button
              type="submit"
              className="px-5 h-12 rounded-2xl font-bold text-white cursor-pointer shrink-0"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {tx('ตรวจสลิป', 'Verify')}
            </button>
          </form>

          {/* Recent Synced Slips Quick Verification */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Clock className="w-3.5 h-3.5" />
              {tx(
                `ใบสลิปล่าสุดในระบบ (${receipts.length} ใบ) — แตะตรวจผ่านประตูได้ทันที`,
                `Recent Synced Slips (${receipts.length}) — Tap to verify exit`
              )}
            </p>

            {recentReceipts.length === 0 ? (
              <div
                className="rounded-2xl border p-4 text-center text-xs"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
              >
                {tx(
                  'ยังไม่มีใบสลิปที่ออกในรอบนี้ เมื่อลูกค้าชำระเงินแล้วใบสลิปจะเด้งมาที่นี่อัตโนมัติค่ะ',
                  'No slips issued yet. Completed customer & POS slips will appear here automatically.'
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {recentReceipts.map((r) => {
                  const isExited = Boolean(r.exitedAt);
                  return (
                    <div
                      key={r.billId}
                      className="rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-2.5"
                      style={{
                        backgroundColor: isExited ? '#F5F5F4' : 'var(--bg-canvas)',
                        borderColor: isExited ? '#D6D3D1' : 'var(--accent-border)',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-num font-extrabold text-sm" style={{ color: 'var(--text-main)' }}>
                            #{r.billId}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-lg text-[11px] font-bold"
                            style={{
                              backgroundColor: isExited ? '#E7E5E4' : '#DCFCE7',
                              color: isExited ? '#57534E' : '#166534',
                            }}
                          >
                            {isExited
                              ? tx('ผ่านประตูแล้ว', 'Exited')
                              : tx('รอสแกนออก', 'Ready to Exit')}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {r.paymentMethod}
                          </span>
                        </div>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {r.deliveryInfo || r.shopName} ·{' '}
                          {r.items
                            .slice(0, 2)
                            .map((i) => `${translateMenuName(i.name, lang)} ×${i.qty}`)
                            .join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-num font-bold text-sm text-emerald-700">
                          ฿{r.totalAmount.toLocaleString('th-TH')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playSoftClick();
                            verifySlipCode(r.billId);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                          style={{
                            backgroundColor: isExited ? '#E7E5E4' : 'var(--accent-primary)',
                            color: isExited ? '#57534E' : '#FFFFFF',
                          }}
                        >
                          {isExited ? tx('สแกนแล้ว', 'Scanned') : tx('ให้ผ่านประตู', 'Approve Exit')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
