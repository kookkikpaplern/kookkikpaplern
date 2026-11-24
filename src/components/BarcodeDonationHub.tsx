import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Camera,
  CheckCircle2,
  Package,
  PlusCircle,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { MenuItem } from '../config/shopConfig';
import { translateCategory, translateMenuName, useLang } from '../config/i18n';
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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

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

  const hasSearchQuery = searchQuery.trim().length > 0;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return menuItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.barcode.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [menuItems, searchQuery]);

  const cleanBarcode = barcode.trim();
  const duplicateItem = useMemo(() => {
    if (!cleanBarcode) return undefined;
    return menuItems.find(
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

    // กติกาห้ามบาร์โค้ดซ้ำ: ปฏิเสธและข้ามทันที ไม่เขียนทับ ไม่สร้างซ้ำ
    const existing = menuItems.find(
      (m) => m.barcode.trim() !== '' && m.barcode.trim() === code
    );
    if (existing) {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx(
          `มีเลขบาร์โค้ด "${code}" (${existing.name}) อยู่ในระบบแล้ว ระบบไม่อนุญาตให้บันทึกซ้ำหรือเขียนทับข้อมูลเดิมค่ะ`,
          `Barcode "${code}" (${existing.name}) already exists. Duplicates and overwrites are blocked.`
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

    if (!imageUrl) {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx(
          'กรุณาอัปโหลดรูปภาพสินค้าก่อนบันทึกนะคะ (ระบบจะตรวจสอบรูปสินค้าก่อนนำเข้า)',
          'Please upload a product photo before submitting.'
        ),
      });
      return;
    }

    // AI ตรวจคัดกรองรูปภาพก่อนบันทึก (บล็อกคน สัตว์ รูปไม่เหมาะสม หรือรูปไม่เกี่ยวข้องทันที)
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
      const data = (await res.json().catch(() => ({}))) as {
        allowed?: boolean;
        reason?: string;
      };

      if (!res.ok || data.allowed !== true) {
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
    } catch {
      playScanError();
      setFeedback({
        type: 'err',
        text: tx(
          'ไม่สามารถเชื่อมต่อระบบ AI ตรวจสอบรูปภาพได้ในขณะนี้ จึงระงับการบันทึกไว้ก่อนค่ะ',
          'Could not reach AI image screening right now. Upload blocked for safety.'
        ),
      });
      setIsVerifyingAi(false);
      return;
    }

    setIsVerifyingAi(false);

    const parsedPrice = Math.max(0, Number(priceStr) || 0);
    const newItem: MenuItem = {
      id: `donate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      barcode: code,
      name: productName,
      price: parsedPrice,
      stars: Math.max(1, Math.floor(parsedPrice / 20) || 1),
      category: productCategory,
      imageUrl,
      status: 'พร้อมขาย',
      stockMode: 'unlimited',
    };

    const result = onDonateProduct(newItem);
    if (!result.ok) {
      playScanError();
      setFeedback({
        type: 'err',
        text:
          result.reason ||
          tx('มีบาร์โค้ดนี้ในระบบแล้ว ระบบจึงปฏิเสธการบันทึกซ้ำค่ะ', 'Barcode already exists.'),
      });
      return;
    }

    playScanSuccess();
    setBarcode('');
    setName('');
    setPriceStr('');
    setImageUrl('');
    setSearchQuery('');
    setFeedback({
      type: 'ok',
      text: tx(
        `เพิ่ม "${productName}" (${code}) เข้าคลังสินค้า POS และหลังบ้านอัตโนมัติเรียบร้อยแล้วค่ะ พร้อมยิงบาร์โค้ดคิดเงินทันที!`,
        `Added "${productName}" (${code}) to POS & backend catalog automatically!`
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
      {/* Section Heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--accent-text)' }}>
            <Barcode className="w-4 h-4" />
            <span>{tx('เปิดให้ทุกคนร่วมเพิ่มข้อมูลได้ทันที ไม่ต้องล็อกอิน', 'Public Barcode Contribution · No Login Required')}</span>
          </div>
          <h2 id="barcode-donation-heading" className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
            {tx('คลังบาร์โค้ดบริจาคพร้อมรูปภาพ', 'Community Barcode & Product Photo Catalog')}
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            {tx(
              'ค้นหาบาร์โค้ดในร้าน หรือช่วยบริจาคเลขบาร์โค้ดพร้อมรูปภาพสินค้า ข้อมูลจะเข้าหลังบ้านและเครื่องคิดเงิน POS อัตโนมัติทันทีค่ะ',
              'Search existing barcodes or contribute new product photos & barcodes directly into the POS catalog.'
            )}
          </p>
        </div>
      </div>

      {/* Main 2-Column Layout: Left Search & Browse, Right Donate New Barcode */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Search & Catalog List */}
        <div className="lg:col-span-6 space-y-3.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tx(
                  'ค้นหาชื่อสินค้า เลขบาร์โค้ด หรือหมวดหมู่...',
                  'Search product name, barcode, or category...'
                )}
                className="w-full h-12 pl-10 pr-9 rounded-2xl border text-sm focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-main)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={tx('ล้างคำค้นหา', 'Clear search')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {!hasSearchQuery ? (
            <div
              className="rounded-2xl border border-dashed p-6 text-center space-y-2"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            >
              <Search className="w-8 h-8 mx-auto opacity-45" style={{ color: 'var(--accent-text)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                {tx(
                  'พิมพ์ชื่อสินค้าหรือเลขบาร์โค้ดเพื่อค้นหาในระบบ',
                  'Type a product name or barcode to search'
                )}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  'ตรวจสอบได้ทันทีว่าสินค้านี้มีบาร์โค้ดแล้วหรือยัง หรือกรอกข้อมูลบริจาคทางด้านขวาได้เลยค่ะ',
                  'Check whether a product barcode exists, or contribute a new one on the right.'
                )}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed p-6 text-center space-y-2"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            >
              <Package className="w-8 h-8 mx-auto opacity-45" style={{ color: 'var(--accent-text)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                {tx('ยังไม่พบสินค้าที่ตรงกับคำค้นหาค่ะ', 'No matching barcode items found.')}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  'ช่วยบริจาคบาร์โค้ดและรูปภาพสินค้านี้ทางด้านขวาได้เลยนะคะ',
                  'You can contribute this barcode and product photo on the right!'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border p-3 flex items-center gap-3"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  <div
                    className="w-14 h-14 rounded-xl border overflow-hidden flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={translateMenuName(item.name, lang)}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Package className="w-6 h-6 opacity-40" style={{ color: 'var(--accent-text)' }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>
                      {translateMenuName(item.name, lang)}
                    </p>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--accent-text)' }}>
                      {item.barcode || tx('ไม่มีบาร์โค้ด', 'No barcode')}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {translateCategory(item.category, lang)}
                      {item.price > 0 ? ` · ฿${item.price.toLocaleString('th-TH')}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Donate Barcode & Photo Form */}
        <form
          onSubmit={handleSubmitDonation}
          className="lg:col-span-6 rounded-2xl border p-4 sm:p-5 space-y-3.5"
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
                  borderColor: duplicateItem ? '#E11D48' : 'var(--border-soft)',
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
            {duplicateItem && (
              <p
                className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {tx(
                    `มีบาร์โค้ดนี้ในระบบแล้ว (${duplicateItem.name}) — ห้ามบันทึกซ้ำหรือเขียนทับของเดิมค่ะ`,
                    `Barcode already exists (${duplicateItem.name}) — duplicates are blocked.`
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
                  {imageUrl ? tx('เปลี่ยนรูปสินค้า', 'Change Photo') : tx('ถ่าย / เลือกรูปสินค้า *', 'Upload Product Photo *')}
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
                    {tx('ลบรูป', 'Remove')}
                  </button>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {tx(
                  'ย่อขนาดรูปอัตโนมัติ · อนุญาตเฉพาะภาพสินค้าเท่านั้น (บล็อกรูปคน สัตว์เลี้ยง และรูปไม่เกี่ยวข้อง)',
                  'Auto-resized · Product photos only (humans, pets, and unrelated images blocked)'
                )}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifyingAi || Boolean(duplicateItem)}
            className="w-full h-12 rounded-2xl font-bold text-sm sm:text-base text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-transform active:scale-[0.99]"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Sparkles className={`w-4 h-4 ${isVerifyingAi ? 'animate-spin' : ''}`} />
            {isVerifyingAi
              ? tx('กำลังให้ AI ตรวจสอบภาพสินค้า...', 'AI is verifying product photo...')
              : tx('ส่งบาร์โค้ดเข้าคลังสินค้า POS ทันที', 'Add Barcode to POS Catalog')}
          </button>
        </form>
      </div>

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
