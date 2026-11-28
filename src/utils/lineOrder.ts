import jsQR from 'jsqr';
import { BillLineItem } from './sheetsSync';

export interface LineDeliveryInfo {
  deliveryType: 'ทานนี้' | 'กลับบ้าน' | 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง' | string;
  tableNumber?: string;
  customerName?: string;
  dropPoint?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDistanceKm?: number | null;
}

export interface BuildLineOrderParams {
  shopNameTh: string;
  items: BillLineItem[];
  totalAmount: number;
  deliveryInfo?: LineDeliveryInfo;
  orderRef?: string;
  noteLine?: string;
}

export function buildLineOrderText({
  shopNameTh,
  items,
  totalAmount,
  deliveryInfo,
  orderRef,
  noteLine,
}: BuildLineOrderParams): string {
  const lines: string[] = [];
  lines.push(`🍽️ สั่งอาหาร: ${shopNameTh}`);
  if (orderRef) {
    lines.push(`🧾 เลขออเดอร์: #${orderRef}`);
  }

  if (deliveryInfo) {
    if (deliveryInfo.deliveryType === 'ทานนี้') {
      const table = deliveryInfo.tableNumber?.trim();
      lines.push(`🪑 รูปแบบ: ทานที่ร้าน${table ? ` (โต๊ะที่ ${table})` : ''}`);
    } else if (deliveryInfo.deliveryType === 'ให้พ่อไปส่ง') {
      lines.push('🛵 รูปแบบ: ให้พ่อไปส่ง');
      if (deliveryInfo.customerName?.trim()) {
        lines.push(`👤 ชื่อผู้สั่ง: ${deliveryInfo.customerName.trim()}`);
      }
      if (deliveryInfo.dropPoint?.trim()) {
        lines.push(`📍 จุดส่ง: ${deliveryInfo.dropPoint.trim()}`);
      }
      if (
        typeof deliveryInfo.deliveryLat === 'number' &&
        typeof deliveryInfo.deliveryLng === 'number'
      ) {
        const distText =
          typeof deliveryInfo.deliveryDistanceKm === 'number'
            ? ` (ห่างจากร้าน ${deliveryInfo.deliveryDistanceKm.toFixed(2)} กม.)`
            : '';
        lines.push(
          `🗺️ พิกัดแผนที่${distText}: https://www.google.com/maps/search/?api=1&query=${deliveryInfo.deliveryLat.toFixed(6)},${deliveryInfo.deliveryLng.toFixed(6)}`
        );
      }
    } else {
      lines.push(`🛍️ รูปแบบ: ${deliveryInfo.deliveryType}`);
      if (deliveryInfo.customerName?.trim()) {
        lines.push(`👤 ชื่อผู้สั่ง: ${deliveryInfo.customerName.trim()}`);
      }
    }
  }

  if (items.length > 0) {
    lines.push('');
    lines.push('📋 รายการอาหาร:');
    items.forEach((item, index) => {
      const note = item.tasteNote?.trim() ? ` (${item.tasteNote.trim()})` : '';
      const lineTotal = (item.price * item.qty).toLocaleString('th-TH');
      lines.push(`${index + 1}. ${item.name}${note} × ${item.qty} = ฿${lineTotal}`);
    });
  }

  lines.push('');
  lines.push(
    `💰 ยอดรวมทั้งหมด: ฿${totalAmount.toLocaleString('th-TH', {
      minimumFractionDigits: Number.isInteger(totalAmount) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`
  );

  if (noteLine) {
    lines.push(noteLine);
  }

  return lines.join('\n');
}

export function extractLineOaId(lineShopUrl?: string): string | null {
  const raw = (lineShopUrl || '').trim();
  if (!raw) return null;
  const match = raw.match(/@[a-zA-Z0-9._-]+/);
  return match ? match[0] : null;
}

export function buildLineSendHref(orderText: string, lineShopUrl?: string): string {
  const oaId = extractLineOaId(lineShopUrl);
  if (oaId) {
    return `https://line.me/R/oaMessage/${oaId}/?${encodeURIComponent(orderText)}`;
  }
  return `https://line.me/R/msg/text/?${encodeURIComponent(orderText)}`;
}

export async function copyOrderTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function tryJsQrOnCrop(
  img: HTMLImageElement,
  cropRatio: number,
  maxSide = 960
): string | null {
  const srcSize = Math.round(Math.min(img.width, img.height) * cropRatio);
  const sx = cropRatio >= 1 ? 0 : Math.round((img.width - srcSize) / 2);
  const sy = cropRatio >= 1 ? 0 : Math.round((img.height - srcSize) / 2);
  const sw = cropRatio >= 1 ? img.width : srcSize;
  const sh = cropRatio >= 1 ? img.height : srcSize;

  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const targetW = Math.max(64, Math.round(sw * scale));
  const targetH = Math.max(64, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const found = jsQR(imageData.data, targetW, targetH, {
    inversionAttempts: 'attemptBoth',
  });
  return found?.data?.trim() || null;
}

export async function decodeQrCodeFromFile(file: File): Promise<string | null> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Invalid image'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onerror = () => reject(new Error('Failed to load image'));
    el.onload = () => resolve(el);
    el.src = dataUrl;
  });

  // 1. Try native BarcodeDetector first if supported
  try {
    const Win = window as unknown as {
      BarcodeDetector?: new (opts?: { formats: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    };
    if (Win.BarcodeDetector) {
      const detector = new Win.BarcodeDetector({ formats: ['qr_code'] });
      const results = await detector.detect(img);
      const raw = results.find((r) => r.rawValue?.trim())?.rawValue?.trim();
      if (raw) return raw;
    }
  } catch {
    // Fallback to jsQR below
  }

  // 2. Try jsQR across full image & center crops (handles LINE screenshot borders/text)
  const ratios = [1, 0.8, 0.62];
  for (const ratio of ratios) {
    const decoded = tryJsQrOnCrop(img, ratio);
    if (decoded) return decoded;
  }

  return null;
}
