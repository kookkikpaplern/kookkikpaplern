import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Camera,
  CheckCircle2,
  Lock,
  PlusCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { MenuItem } from '../config/shopConfig';
import { translateCategory, useLang } from '../config/i18n';
import { compressProductImageFile } from '../utils/imageUpload';
import { playScanError, playScanSuccess, playSoftClick } from '../utils/sound';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface BarcodeDonationHubProps {
  menuItems: MenuItem[];
  onDonateProduct: (item: MenuItem) => { ok: boolean; reason?: string };
}

const DONATION_CATEGORIES = [
  'สินค้าทั่วไป',
  'เครื่องดื่ม',
  'ขนมทานเล่น',
  'ของใช้ในบ้าน',
  'เครื่องปรุง / ของแห้ง',
  'อาหารจานเดียว',
];

export const BarcodeDonationHub: React.FC<BarcodeDonationHubProps> = ({
  menuItems,
  onDonateProduct,
}) => {
  const { lang, tx } = useLang();

  // Donation form state
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('สินค้าทั่วไป');
  const [priceStr, setPriceStr] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Camera scanner modal for filling barcode on home page
  const [scannerOpen, setScannerOpen] = useState(false);

  // Submission / AI check feedback
  const [isVerifyingAi, setIsVerifyingAi] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Duplicate check runs internally without exposing any store product names or catalog details
  const cleanBarcode = barcode.trim();
  const hasDuplicateBarcode = useMemo(() => {
    if (!cleanBarcode) return false;
    return menuItems.some(
      (m) => m.barcode.trim() !== '' && m.barcode.trim() === cleanBarcode
    );
  }, [menuItems, cleanBarcode]);

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    playSoftClick();
    setFeedback(null);
    try {
      const compressed = await compressProductImageFile(file, 360);
      setImageUrl(compressed);
    } catch {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx(
          'ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกไฟล์ JPG หรือ PNG ค่ะ',
          'Could not read image file. Please select a JPG or PNG photo.'
        ),
      });
    }
  };

  const handleSubmitDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    setFeedback(null);

    const code = barcode.trim();
    const productName = name.trim();
    const productCategory = category.trim() || 'สินค้าทั่วไป';

    if (!code) {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx('กรุณากรอกหรือสแกนเลขบาร์โค้ดก่อนนะคะ', 'Please enter or scan a barcode number.'),
      });
      return;
    }

    // ป้องกันการบันทึกบาร์โค้ดซ้ำ โดยไม่เปิดเผยชื่อสินค้าหรือข้อมูลภายในร้าน
    const existing = menuItems.find(
      (m) => m.barcode.trim() !== '' && m.barcode.trim() === code
    );
    if (existing) {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx(
          'เลขบาร์โค้ดนี้มีอยู่ในระบบแล้วค่ะ ระบบไม่อนุญาตให้บันทึกซ้ำหรือเขียนทับข้อมูลเดิม',
          'This barcode is already registered in the system. Duplicates are not allowed.'
        ),
      });
      return;
    }

    if (!productName) {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx('กรุณากรอกชื่อสินค้าก่อนส่งข้อมูลนะคะ', 'Please enter the product name.'),
      });
      return;
    }

    // AI ตรวจคัดกรองรูปภาพก่อนบันทึก (เฉพาะกรณีแนบรูป — หากไม่ใส่รูปก็บันทึกได้ทันที)
    let aiSkippedNote = '';
    if (imageUrl) {
      setIsVerifyingAi(true);
      try {
        const res = await fetch('/api/verify-product-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl: imageUrl,
            productName,
            lang,
          }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            allowed?: boolean;
            reason?: string;
          };

          if (data.allowed === false) {
            playScanError();
            setFeedback({
              type: 'err',
              text:
                data.reason ||
                tx(
                  'รูปภาพไม่ผ่านการคัดกรอง (อนุญาตเฉพาะภาพสินค้าเท่านั้น) ระบบจึงปฏิเสธการบันทึกค่ะ',
                  'Image blocked by AI screening (only product photos are allowed).'
                ),
            });
            setIsVerifyingAi(false);
            return;
          }
        } else {
          aiSkippedNote = tx(
            ' (ข้ามการตรวจภาพ AI ชั่วคราว)',
            ' (AI photo check unavailable)'
          );
        }
      } catch {
        aiSkippedNote = tx(
          ' (ข้ามการตรวจภาพ AI ชั่วคราว)',
          ' (AI photo check unavailable)'
        );
      }
      setIsVerifyingAi(false);
    }

    const parsedPrice = Math.max(0, Number(priceStr) || 0);
    const newItem: MenuItem = {
      id: `donate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      barcode: code,
      name: productName,
      price: parsedPrice,
      stars: Math.max(1, Math.floor(parsedPrice / 20) || 1),
      category: productCategory,
      imageUrl: imageUrl || undefined,
      status: 'พร้อมขาย',
      stockMode: 'unlimited',
      source: 'customer',
      submittedAt: new Date().toISOString(),
    };

    const result = onDonateProduct(newItem);
    if (!result.ok) {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx(
          'เลขบาร์โค้ดนี้มีอยู่ในระบบแล้ว ระบบจึงปฏิเสธการบันทึกซ้ำค่ะ',
          'This barcode is already registered. Duplicates are blocked.'
        ),
      });
      return;
    }

    playScanSuccess();
    setBarcode('');
    setName('');
    setPriceStr('');
    setImageUrl('');
    setFeedback({
      type: 'ok',
      text: tx(
        `ส่งบริจาคบาร์โค้ด "${productName}" (${code}) เข้าสู่ระบบหลังบ้านเรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ!${aiSkippedNote}`,
        `Submitted barcode contribution "${productName}" (${code}) to the back-office system. Thank you!${aiSkippedNote}`
      ),
    });
  };

  return (
    <section
      aria-labelledby="barcode-donation-heading"
      className="rounded-3xl border-2 p-5 sm:p-7 shadow-sm space-y-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      {/* Section Heading (Donate-Only · Store Catalog Concealed & Search Disabled) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--accent-text)' }}>
            <Barcode className="w-4 h-4" />
            <span>{tx('เปิดให้ร่วมบริจาคข้อมูลสินค้าได้ทันที ไม่ต้องล็อกอิน', 'Public Barcode Contribution · No Login Required')}</span>
          </div>
          <h2 id="barcode-donation-heading" className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
            {tx('บริจาคบาร์โค้ด & รูปภาพสินค้า', 'Donate Product Barcode & Photo')}
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            {tx(
              'ช่วยบริจาคเลขบาร์โค้ดพร้อมรูปภาพสินค้า ข้อมูลจะส่งตรงเข้าหลังบ้านร้านอัตโนมัติ (ข้อมูลสินค้าภายในร้านถูกปกปิดและปิดการค้นหาเพื่อความเป็นส่วนตัว)',
              'Contribute product barcodes & photos directly to the store back office (store inventory is kept private and search is disabled).'
            )}
          </p>
        </div>

        <div
          className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-soft)',
            color: 'var(--text-muted)',
          }}
        >
          <Lock className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          <span>{tx('ปกปิดข้อมูลในร้าน', 'Store Catalog Private')}</span>
        </div>
      </div>

      {/* Centered Single Donation Form */}
      <form
        onSubmit={handleSubmitDonation}
        className="max-w-2xl mx-auto rounded-2xl border p-4 sm:p-6 space-y-4"
        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--accent-border)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
            <PlusCircle className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            {tx('บริจาคบาร์โค้ด & รูปภาพสินค้าใหม่', 'Contribute New Barcode & Photo')}
          </h3>
          <span
            className="text-[11px] font-semibold flex items-center gap-1"
            style={{ color: 'var(--accent-text)' }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {tx('AI คัดกรองภาพ', 'AI Screened')}
          </span>
        </div>

        {feedback && (
          <div
            className="rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold flex items-start gap-2"
            style={{
              backgroundColor: feedback.type === 'ok' ? 'var(--accent-soft)' : 'var(--pastel-pink)',
              color: feedback.type === 'ok' ? 'var(--accent-text)' : 'var(--pastel-pink-text)',
            }}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Barcode input + Camera Scan button */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold" style={{ color: 'var(--text-main)' }}>
            {tx('เลขบาร์โค้ดสินค้า *', 'Product Barcode *')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setFeedback(null);
              }}
              placeholder={tx('พิมพ์หรือสแกนเลขบาร์โค้ด เช่น 8851234567890', 'Type or scan barcode e.g. 8851234567890')}
              className="flex-1 h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: hasDuplicateBarcode ? '#E11D48' : 'var(--border-soft)',
                color: 'var(--text-main)',
              }}
            />
            <button
              type="button"
              onClick={() => {
                playSoftClick();
                setScannerOpen(true);
              }}
              className="px-3.5 h-11 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--pastel-blue)',
                borderColor: 'var(--border-soft)',
                color: 'var(--pastel-blue-text)',
              }}
            >
              <QrCode className="w-4 h-4" />
              {tx('สแกนกล้อง', 'Scan')}
            </button>
          </div>
          {hasDuplicateBarcode && (
            <p
              className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {tx(
                  'เลขบาร์โค้ดนี้มีอยู่ในระบบแล้วค่ะ — ห้ามบันทึกซ้ำหรือเขียนทับข้อมูลเดิม',
                  'This barcode is already registered — duplicate entries are blocked.'
                )}
              </span>
            </p>
          )}
        </div>

        {/* Product Name */}
        <div>
          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-main)' }}>
            {tx('ชื่อสินค้า *', 'Product Name *')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tx('เช่น น้ำดื่มคริสตัล 600 มล., ขนมปังโฮลวีต', 'e.g. Drinking Water 600ml, Whole Wheat Bread')}
            className="w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-main)',
            }}
          />
        </div>

        {/* Category + Optional Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-main)' }}>
              {tx('หมวดหมู่สินค้า', 'Category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-soft)',
                color: 'var(--text-main)',
              }}
            >
              {DONATION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {translateCategory(cat, lang)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-main)' }}>
              {tx('ราคาขาย (บาท - ถ้าทราบ)', 'Price (฿ - Optional)')}
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder={tx('เช่น 10, 20', 'e.g. 10, 20')}
              className="w-full h-11 px-3.5 rounded-xl border text-sm font-num focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-soft)',
                color: 'var(--text-main)',
              }}
            />
          </div>
        </div>

        {/* Product Photo Upload (Auto-compressed + AI verified) */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelected}
          className="hidden"
        />
        <div
          className="rounded-2xl border p-3 flex flex-wrap items-center gap-3"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <button
            type="button"
            onClick={() => {
              playSoftClick();
              imageInputRef.current?.click();
            }}
            className="w-16 h-16 rounded-2xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: imageUrl ? 'var(--accent-primary)' : 'var(--border-soft)',
              color: 'var(--accent-text)',
            }}
            aria-label={tx('เลือกรูปภาพสินค้า', 'Upload product image')}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={tx('ตัวอย่างรูปสินค้า', 'Product preview')} className="w-full h-full object-cover" />
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span className="text-[10px] font-bold mt-0.5">{tx('รูปสินค้า', 'Photo')}</span>
              </>
            )}
          </button>

          <div className="flex-1 min-w-[180px] space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  imageInputRef.current?.click();
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent-text)',
                }}
              >
                <Upload className="w-3.5 h-3.5" />
                {imageUrl
                  ? tx('เปลี่ยนรูปสินค้า', 'Change Photo')
                  : tx('ถ่าย / เลือกรูปสินค้า (ไม่ใส่รูปก็ได้)', 'Upload Photo (Optional)')}
              </button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    playSoftClick();
                    setImageUrl('');
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--pastel-pink)',
                    color: 'var(--pastel-pink-text)',
                  }}
                >
                  {tx('ไม่ใส่รูป / ลบรูป', 'Remove Photo')}
                </button>
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {tx(
                'ไม่ใส่รูปก็กดบันทึกได้ทันทีค่ะ · หากใส่รูป ระบบจะย่อขนาดและคัดกรองภาพสินค้าให้อัตโนมัติ',
                'Photo is optional — save anytime without an image, or upload a product photo.'
              )}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isVerifyingAi || hasDuplicateBarcode}
          className="w-full h-12 rounded-2xl font-bold text-sm sm:text-base text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-transform active:scale-[0.99]"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Sparkles className={`w-4 h-4 ${isVerifyingAi ? 'animate-spin' : ''}`} />
          {isVerifyingAi
            ? tx('กำลังให้ AI ตรวจสอบภาพสินค้า...', 'AI is verifying product photo...')
            : tx('ส่งบาร์โค้ดเข้าคลังสินค้า POS ทันที', 'Add Barcode to POS Catalog')}
        </button>
      </form>

      {/* Camera Scanner Modal for quick barcode capture on Home Page */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcodeDetected={(code) => {
          setBarcode(code);
          setScannerOpen(false);
          setFeedback(null);
        }}
        menuItems={[]}
      />
    </section>
  );
};
