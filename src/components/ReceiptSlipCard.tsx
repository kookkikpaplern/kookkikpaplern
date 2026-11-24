import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Download, Printer, QrCode, Receipt, Star } from 'lucide-react';
import { translateMenuName, useLang } from '../config/i18n';
import { buildExitPassQrPayload, ReceiptSlipRecord } from '../utils/sheetsSync';
import { playSoftClick } from '../utils/sound';

interface ReceiptSlipCardProps {
  receipt: ReceiptSlipRecord;
}

export const ReceiptSlipCard: React.FC<ReceiptSlipCardProps> = ({ receipt }) => {
  const { lang, tx } = useLang();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

  const qrPayload = buildExitPassQrPayload(receipt);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1F2937',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [qrPayload]);

  const handleDownloadSlipPng = async () => {
    playSoftClick();
    setDownloading(true);
    try {
      const items = receipt.items.length > 0
        ? receipt.items
        : [{ id: 'total', name: tx('รายการสินค้าหน้าร้าน', 'Storefront Purchase'), price: receipt.totalAmount, qty: 1, stars: receipt.totalStars }];

      const width = 560;
      const lineHeight = 32;
      const baseHeight = 560 + items.length * lineHeight + (receipt.deliveryInfo ? 34 : 0) + (receipt.bankAccountLabel ? 30 : 0);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.max(680, baseHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, canvas.height);

      // Subtle receipt border
      ctx.strokeStyle = '#D6D3D1';
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, width - 28, canvas.height - 28);

      let y = 58;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(receipt.shopName, width / 2, y);

      y += 30;
      ctx.fillStyle = '#57534E';
      ctx.font = '18px sans-serif';
      ctx.fillText(tx('ใบเสร็จรับเงิน & บัตรสแกนผ่านประตู', 'Receipt Slip & Exit Gate Pass'), width / 2, y);

      y += 32;
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`#${receipt.billId}`, width / 2, y);

      y += 26;
      ctx.fillStyle = '#78716C';
      ctx.font = '16px sans-serif';
      ctx.fillText(receipt.timestamp, width / 2, y);

      const drawDivider = (currY: number) => {
        ctx.save();
        ctx.strokeStyle = '#D6D3D1';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(36, currY);
        ctx.lineTo(width - 36, currY);
        ctx.stroke();
        ctx.restore();
      };

      y += 20;
      drawDivider(y);
      y += 28;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#44403C';
      ctx.font = '17px sans-serif';
      ctx.fillText(`${tx('ช่องทาง:', 'Channel:')} ${receipt.paymentMethod}`, 38, y);
      y += 26;
      if (receipt.bankAccountLabel) {
        ctx.fillText(`${tx('เข้าบัญชี:', 'Account:')} ${receipt.bankAccountLabel}`.slice(0, 42), 38, y);
        y += 26;
      }
      if (receipt.deliveryInfo) {
        ctx.fillText(`${tx('รายละเอียด:', 'Order Info:')} ${receipt.deliveryInfo}`.slice(0, 44), 38, y);
        y += 26;
      }

      drawDivider(y);
      y += 28;

      for (const item of items) {
        const displayName = translateMenuName(item.name, lang);
        const label = `${displayName}${item.tasteNote ? ` (${item.tasteNote})` : ''} x${item.qty}`;
        const priceStr = `฿${(item.price * item.qty).toLocaleString('th-TH')}`;
        ctx.fillStyle = '#1C1917';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label.length > 28 ? `${label.slice(0, 27)}…` : label, 38, y);
        ctx.textAlign = 'right';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(priceStr, width - 38, y);
        y += lineHeight;
      }

      drawDivider(y);
      y += 38;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(tx('ยอดชำระสุทธิ', 'Total Paid'), 38, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`฿${receipt.totalAmount.toLocaleString('th-TH')}`, width - 38, y);

      y += 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#B45309';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(tx(`ได้รับดาวสะสม +${receipt.totalStars} ดาว`, `Earned +${receipt.totalStars} Stars`), 38, y);

      y += 24;
      drawDivider(y);
      y += 24;

      if (qrDataUrl) {
        const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = qrDataUrl;
        });
        const qrSize = 188;
        ctx.drawImage(qrImg, (width - qrSize) / 2, y, qrSize, qrSize);
        y += qrSize + 24;
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(
        tx('แสดง QR นี้ให้พนักงาน / คุณแม่สแกนก่อนออกประตูร้าน', 'Show this QR at the exit gate for verification'),
        width / 2,
        y
      );

      const link = document.createElement('a');
      link.download = `slip-${receipt.billId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintSlip = () => {
    playSoftClick();
    window.print();
  };

  return (
    <div
      id="kkp-printable-receipt"
      className="rounded-3xl bg-white text-[#2F2620] p-5 sm:p-6 shadow-xl border-2 border-emerald-200 space-y-4"
    >
      {/* Top Receipt Header */}
      <div className="flex items-start justify-between gap-3 border-b border-dashed border-stone-300 pb-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold mb-1.5">
            <Receipt className="w-3.5 h-3.5" />
            {tx('ใบเสร็จ / ใบสลิปผ่านประตู', 'Receipt & Exit Gate Slip')}
          </div>
          <h3 className="text-lg font-extrabold text-stone-900 truncate">{receipt.shopName}</h3>
          <p className="text-xs text-stone-500">{receipt.timestamp}</p>
        </div>

        <div className="text-right shrink-0">
          <span className="inline-block px-3 py-1 rounded-xl bg-stone-100 text-stone-800 font-num font-extrabold text-sm">
            #{receipt.billId}
          </span>
          {receipt.mode === 'ทดสอบระบบ' && (
            <p className="text-[11px] font-bold text-orange-600 mt-1">
              {tx('โหมดทดสอบ', 'Test Mode')}
            </p>
          )}
        </div>
      </div>

      {/* Payment & Order Metadata */}
      <div className="rounded-2xl bg-stone-50 border border-stone-200 px-3.5 py-2.5 text-xs space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-stone-500">{tx('ชำระโดย:', 'Payment:')}</span>
          <span className="font-bold text-stone-800">
            {receipt.paymentMethod}
            {receipt.bankAccountLabel ? ` · ${receipt.bankAccountLabel}` : ''}
          </span>
        </div>
        {receipt.deliveryInfo && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-stone-500">{tx('รายละเอียด:', 'Order Info:')}</span>
            <span className="font-semibold text-stone-800 text-right">{receipt.deliveryInfo}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-stone-500">{tx('ผู้ทำรายการ:', 'Handled by:')}</span>
          <span className="font-semibold text-stone-700">{receipt.staffName}</span>
        </div>
      </div>

      {/* Itemized List */}
      <div className="space-y-1.5 border-b border-dashed border-stone-300 pb-3 text-sm">
        {(receipt.items.length > 0
          ? receipt.items
          : [
              {
                id: 'manual',
                name: tx('รายการสินค้าหน้าร้าน', 'Storefront Purchase'),
                price: receipt.totalAmount,
                qty: 1,
                stars: receipt.totalStars,
              },
            ]
        ).map((item, idx) => (
          <div key={`${item.id}_${idx}`} className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-stone-800">
              <span className="font-medium">{translateMenuName(item.name, lang)}</span>
              {item.tasteNote && (
                <span className="text-xs text-stone-500 ml-1">({item.tasteNote})</span>
              )}
              <span className="font-num text-xs text-stone-500 ml-1.5">×{item.qty}</span>
            </div>
            <span className="font-num font-bold text-stone-900 shrink-0 tabular-nums">
              ฿{(item.price * item.qty).toLocaleString('th-TH')}
            </span>
          </div>
        ))}
      </div>

      {/* Grand Total & Stars */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-500">{tx('ยอดชำระสุทธิ', 'Total Paid')}</p>
          <p className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 mt-0.5">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            {tx(`ได้รับ +${receipt.totalStars} ดาว`, `Earned +${receipt.totalStars} Stars`)}
          </p>
        </div>
        <p className="font-num text-3xl font-extrabold text-emerald-700 tabular-nums">
          ฿{receipt.totalAmount.toLocaleString('th-TH')}
        </p>
      </div>

      {/* Gate Exit Pass QR Section */}
      <div
        className={`rounded-2xl border-2 p-4 flex flex-col sm:flex-row items-center gap-4 ${
          receipt.exitedAt
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-[#FAF6F0] border-emerald-200'
        }`}
      >
        <div className="w-36 h-36 rounded-2xl bg-white border border-stone-200 p-2 flex items-center justify-center shrink-0 shadow-sm">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={tx('QR สแกนผ่านประตู', 'Exit Gate QR Code')}
              className="w-full h-full object-contain"
            />
          ) : (
            <QrCode className="w-12 h-12 text-stone-400" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1.5">
          {receipt.exitedAt ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              {tx('สแกนผ่านประตูเรียบร้อยแล้ว', 'Exit Gate Verified')}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold">
              <QrCode className="w-3.5 h-3.5" />
              {tx('QR สแกนผ่านประตูออกร้าน', 'Exit Gate Pass QR')}
            </div>
          )}
          <p className="text-sm font-bold text-stone-800">
            {receipt.exitedAt
              ? tx(
                  `ตรวจผ่านประตูแล้ว${receipt.exitedBy ? ` โดย ${receipt.exitedBy}` : ''}`,
                  `Verified at exit${receipt.exitedBy ? ` by ${receipt.exitedBy}` : ''}`
                )
              : tx(
                  'แสดงใบสลิปนี้ให้คุณแม่หรือพนักงานสแกนก่อนออกประตูนะคะ',
                  'Please show this QR slip to staff/Mom at the exit gate before leaving.'
                )}
          </p>
          <p className="font-num text-xs text-stone-500">
            {tx('รหัสผ่านประตู:', 'Pass Code:')} {receipt.billId}
          </p>
        </div>
      </div>

      {/* Save PNG & Print Actions (hidden when printing) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 print:hidden">
        <button
          type="button"
          onClick={handleDownloadSlipPng}
          disabled={downloading}
          className="h-12 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95 disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {downloading
            ? tx('กำลังสร้างรูป...', 'Creating PNG...')
            : tx('บันทึกรูปใบสลิป (PNG)', 'Save Receipt Image (PNG)')}
        </button>

        <button
          type="button"
          onClick={handlePrintSlip}
          className="h-12 rounded-2xl border-2 border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
        >
          <Printer className="w-4 h-4" />
          {tx('พิมพ์ใบสลิป', 'Print Receipt')}
        </button>
      </div>
    </div>
  );
};
