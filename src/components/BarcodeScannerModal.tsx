import React, { useEffect, useRef, useState } from 'react';
import { Camera, Keyboard, X } from 'lucide-react';
import { MenuItem } from '../config/shopConfig';
import { translateMenuName, useLang } from '../config/i18n';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (code: string) => void;
  menuItems: MenuItem[];
}

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onBarcodeDetected,
  menuItems,
}) => {
  const { lang, tx } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const [cameraError, setCameraError] = useState(false);
  const [supportsDetector, setSupportsDetector] = useState(true);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!isOpen) return;

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
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
        });

        const scanFrame = async () => {
          if (!active || !videoRef.current) return;
          if (videoRef.current.readyState >= 2) {
            try {
              const results = await detector.detect(videoRef.current);
              if (results.length > 0 && results[0].rawValue) {
                const code = results[0].rawValue.trim();
                const now = Date.now();
                // กันยิงซ้ำภายใน 0.8 วินาที (800ms)
                if (now - lastScanRef.current.time >= 800 || code !== lastScanRef.current.code) {
                  lastScanRef.current = { code, time: now };
                  onBarcodeDetected(code);
                }
              }
            } catch {
              // Frame detect skip
            }
          }
          if (active) {
            timerId = window.setTimeout(scanFrame, 250);
          }
        };

        timerId = window.setTimeout(scanFrame, 400);
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
  }, [isOpen, onBarcodeDetected]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onBarcodeDetected(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg rounded-3xl border shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-soft)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
              {tx('สแกนบาร์โค้ดสินค้า', 'Scan Product Barcode')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-2xl flex items-center justify-center border cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-main)',
            }}
            aria-label={tx('ปิดหน้าต่าง', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="p-5 space-y-4">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-stone-900 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Scan target frame */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-60 h-28 rounded-2xl border-2 border-dashed border-emerald-300/90 bg-emerald-400/5" />
            </div>
            {cameraError && (
              <div className="absolute inset-0 bg-stone-900/90 flex items-center justify-center p-6 text-center text-white text-sm">
                {tx(
                  'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง หรือพิมพ์เลขบาร์โค้ดด้านล่างค่ะ',
                  'Unable to open camera. Please allow camera access or enter the barcode below.'
                )}
              </div>
            )}
          </div>

          {!supportsDetector && !cameraError && (
            <p
              className="text-xs px-3 py-2 rounded-xl text-center"
              style={{
                backgroundColor: 'var(--pastel-peach)',
                color: 'var(--pastel-peach-text)',
              }}
            >
              {tx(
                'เบราว์เซอร์นี้ไม่รองรับสแกนอัตโนมัติผ่านกล้อง สามารถใช้ปืนยิงบาร์โค้ด หรือพิมพ์รหัสด้านล่างได้เลยค่ะ',
                'This browser does not support camera barcode detection. You can use a USB/Bluetooth scanner or type the code below.'
              )}
            </p>
          )}

          {/* Manual Barcode Input + Quick Test */}
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
                placeholder={tx('พิมพ์เลขบาร์โค้ด...', 'Type barcode number...')}
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
              className="px-5 h-12 rounded-2xl font-bold text-white cursor-pointer shrink-0 transition-transform active:scale-95"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {tx('เพิ่มสินค้า', 'Add Item')}
            </button>
          </form>

          {/* Quick Sample Barcode Buttons */}
          {menuItems.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                {tx('กดทดสอบบาร์โค้ดตัวอย่าง:', 'Test sample barcodes:')}
              </p>
              <div className="flex flex-wrap gap-2">
                {menuItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onBarcodeDetected(item.barcode)}
                    className="px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-transform active:scale-95"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-soft)',
                      color: 'var(--text-main)',
                    }}
                  >
                    {translateMenuName(item.name, lang)} ({item.barcode})
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-2xl border font-semibold cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-main)',
            }}
          >
            {tx('ย้อนกลับ', 'Back')}
          </button>
        </div>
      </div>
    </div>
  );
};
