import * as XLSX from 'xlsx';
import { MenuItem } from '../config/shopConfig';
import { getTodayDateKey } from './sheetsSync';

export interface ParsedExcelProductsResult {
  items: MenuItem[];
  sheetName: string;
  skippedCount: number;
  warnings: string[];
}

const HEADER_ALIASES = {
  barcode: ['เลขบาร์โค้ด', 'บาร์โค้ด', 'รหัสบาร์โค้ด', 'รหัสสินค้า', 'barcode', 'code', 'sku', 'ean', 'ean13'],
  name: ['ชื่อสินค้า', 'ชื่อเมนู', 'รายการสินค้า', 'รายการ', 'สินค้า', 'name', 'product', 'title', 'item'],
  price: ['ราคา', 'ราคาขาย', 'price', 'amount', 'unitprice'],
  stars: ['จำนวนดาว', 'ดาว', 'แต้ม', 'stars', 'star', 'points'],
  category: ['หมวดหมู่', 'ประเภท', 'หมวด', 'category', 'group'],
  imageUrl: ['ลิงก์รูปภาพ', 'รูปภาพ', 'image', 'imageurl', 'img', 'url'],
  status: ['สถานะ', 'พร้อมขาย', 'status', 'state'],
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_\-()]/g, '');
}

function matchColumnField(headerText: string): keyof typeof HEADER_ALIASES | null {
  const norm = normalizeHeader(headerText);
  if (!norm) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => norm === normalizeHeader(a) || norm.includes(normalizeHeader(a)))) {
      return field as keyof typeof HEADER_ALIASES;
    }
  }
  return null;
}

function readCellText(cell: XLSX.CellObject | undefined, preferExactInteger = false): string {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  if (cell.t === 's') return String(cell.v).trim();
  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (preferExactInteger && Number.isFinite(cell.v)) {
      if (Math.abs(cell.v - Math.round(cell.v)) < 1e-6 && Math.abs(cell.v) < 1e15) {
        return Math.round(cell.v).toFixed(0);
      }
    }
    return cell.w ? String(cell.w).trim() : String(cell.v).trim();
  }
  if (cell.t === 'b') return cell.v ? 'true' : 'false';
  return String(cell.v).trim();
}

function parseNumberSafe(raw: string, fallback = 0): number {
  const cleaned = raw.replace(/[฿,\sบาท]/g, '').trim();
  if (!cleaned) return fallback;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

export async function parseProductsFromExcelFile(file: File): Promise<ParsedExcelProductsResult> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  let workbook: XLSX.WorkBook;
  if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
    const utf8Text = new TextDecoder('utf-8').decode(buffer);
    const hasGarbled = utf8Text.includes('\uFFFD');
    let text = utf8Text;
    if (hasGarbled) {
      try {
        text = new TextDecoder('windows-874').decode(buffer);
      } catch {
        text = utf8Text;
      }
    }
    workbook = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  } else {
    workbook = XLSX.read(buffer, { type: 'array' });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      items: [],
      sheetName: '',
      skippedCount: 0,
      warnings: ['ไม่พบข้อมูลชีตในไฟล์นี้ค่ะ'],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const ref = sheet['!ref'];
  if (!ref) {
    return {
      items: [],
      sheetName: firstSheetName,
      skippedCount: 0,
      warnings: ['ไฟล์นี้ไม่มีข้อมูลสินค้าค่ะ'],
    };
  }

  const range = XLSX.utils.decode_range(ref);
  const rawRows: Array<Array<XLSX.CellObject | undefined>> = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowCells: Array<XLSX.CellObject | undefined> = [];
    let hasAny = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      if (cell && String(cell.v ?? '').trim() !== '') hasAny = true;
      rowCells.push(cell);
    }
    if (hasAny) rawRows.push(rowCells);
  }

  if (rawRows.length === 0) {
    return {
      items: [],
      sheetName: firstSheetName,
      skippedCount: 0,
      warnings: ['ไม่พบแถวข้อมูลสินค้าในไฟล์ค่ะ'],
    };
  }

  // Detect header row (check first 6 rows in case Excel has title/banner rows above table)
  let headerRowIndex = -1;
  let colMap: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};

  for (let r = 0; r < Math.min(6, rawRows.length); r++) {
    const candidateMap: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
    let matchedCount = 0;
    rawRows[r].forEach((cell, colIdx) => {
      const txt = readCellText(cell);
      const field = matchColumnField(txt);
      if (field && candidateMap[field] === undefined) {
        candidateMap[field] = colIdx;
        matchedCount++;
      }
    });
    if (matchedCount >= 2 && (candidateMap.name !== undefined || candidateMap.barcode !== undefined)) {
      headerRowIndex = r;
      colMap = candidateMap;
      break;
    }
  }

  // Positional fallback if no header matched
  if (headerRowIndex === -1) {
    colMap = {
      barcode: 0,
      name: 1,
      price: 2,
      stars: 3,
      category: 4,
      status: 5,
      imageUrl: 6,
    };
  }

  const startDataRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const items: MenuItem[] = [];
  let skippedCount = 0;
  let missingBarcodeCount = 0;
  const baseStamp = Date.now();

  for (let r = startDataRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    const barcode =
      colMap.barcode !== undefined ? readCellText(row[colMap.barcode], true) : '';
    const name = colMap.name !== undefined ? readCellText(row[colMap.name]) : '';
    const priceRaw = colMap.price !== undefined ? readCellText(row[colMap.price]) : '';
    const starsRaw = colMap.stars !== undefined ? readCellText(row[colMap.stars]) : '';
    const categoryRaw = colMap.category !== undefined ? readCellText(row[colMap.category]) : '';
    const imageUrl = colMap.imageUrl !== undefined ? readCellText(row[colMap.imageUrl]) : '';
    const statusRaw = colMap.status !== undefined ? readCellText(row[colMap.status]) : '';

    if (!name && !barcode) {
      continue;
    }
    if (!name) {
      skippedCount++;
      continue;
    }

    const price = Math.max(0, parseNumberSafe(priceRaw, 0));
    const parsedStars = parseNumberSafe(starsRaw, -1);
    const stars = parsedStars >= 0 ? Math.round(parsedStars) : Math.max(1, Math.floor(price / 20) || 1);
    const category = categoryRaw || 'สินค้าทั่วไป';

    const statusLower = statusRaw.toLowerCase();
    const status: 'พร้อมขาย' | 'หมด' =
      statusLower.includes('หมด') ||
      statusLower === 'out' ||
      statusLower === 'false' ||
      statusLower === '0'
        ? 'หมด'
        : 'พร้อมขาย';

    if (!barcode) missingBarcodeCount++;

    items.push({
      id: `xl_${baseStamp}_${r}`,
      barcode,
      name,
      price,
      stars,
      category,
      imageUrl: imageUrl || undefined,
      status,
      source: 'shop',
    });
  }

  const warnings: string[] = [];
  if (skippedCount > 0) {
    warnings.push(`ข้าม ${skippedCount} แถวที่ไม่มีชื่อสินค้า`);
  }
  if (missingBarcodeCount > 0) {
    warnings.push(`มีสินค้า ${missingBarcodeCount} รายการที่ไม่ได้ใส่เลขบาร์โค้ด (จะแสดงเป็นเมนูแต่สแกนบาร์โค้ดไม่ได้)`);
  }

  return {
    items,
    sheetName: firstSheetName,
    skippedCount,
    warnings,
  };
}

export function mergeImportedMenuItems(
  existing: MenuItem[],
  imported: MenuItem[],
  mode: 'merge' | 'replace'
): { nextItems: MenuItem[]; addedCount: number; updatedCount: number } {
  if (mode === 'replace') {
    return {
      nextItems: imported,
      addedCount: imported.length,
      updatedCount: 0,
    };
  }

  const next = [...existing];
  let addedCount = 0;
  let updatedCount = 0;

  for (const incoming of imported) {
    const matchIdx = next.findIndex((item) => {
      if (incoming.barcode && item.barcode) {
        return item.barcode.trim() === incoming.barcode.trim();
      }
      return item.name.trim() === incoming.name.trim();
    });

    if (matchIdx >= 0) {
      next[matchIdx] = {
        ...incoming,
        id: next[matchIdx].id,
        imageUrl: incoming.imageUrl || next[matchIdx].imageUrl,
      };
      updatedCount++;
    } else {
      next.push(incoming);
      addedCount++;
    }
  }

  return { nextItems: next, addedCount, updatedCount };
}

export function downloadProductExcelXlsx(items: MenuItem[], isTemplate: boolean): void {
  const headers = [
    'เลขบาร์โค้ด',
    'ชื่อสินค้า',
    'ราคา',
    'จำนวนดาว',
    'หมวดหมู่',
    'สถานะ',
    'ลิงก์รูปภาพ',
  ];

  const sourceItems: MenuItem[] = isTemplate
    ? [
        {
          id: 'tpl_1',
          barcode: '8851234500011',
          name: 'น้ำดื่มเย็นขวดเล็ก',
          price: 10,
          stars: 1,
          category: 'เครื่องดื่ม',
          status: 'พร้อมขาย',
        },
        {
          id: 'tpl_2',
          barcode: '8851234500028',
          name: 'ขนมขาไก่ซองใหญ่',
          price: 20,
          stars: 1,
          category: 'ขนมทานเล่น',
          status: 'พร้อมขาย',
        },
        {
          id: 'tpl_3',
          barcode: '8851234500035',
          name: 'ข้าวกล่องหมูกระเทียม',
          price: 50,
          stars: 3,
          category: 'อาหารจานเดียว',
          status: 'พร้อมขาย',
        },
      ]
    : items;

  const aoa: Array<Array<string | number>> = [
    headers,
    ...sourceItems.map((m) => [
      m.barcode || '',
      m.name,
      m.price,
      m.stars,
      m.category,
      m.status,
      m.imageUrl || '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Force barcode column (index 0) to String type so Excel preserves leading zeros and avoids scientific notation
  for (let r = 1; r < aoa.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (cell) {
      cell.t = 's';
      cell.v = String(aoa[r][0] ?? '');
      cell.z = '@';
    }
  }

  ws['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 26 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ตั้งค่าเมนู');

  const filename = isTemplate
    ? 'ต้นแบบ-สินค้าบาร์โค้ด-กุ๊กกิ๊กพาเพลิน.xlsx'
    : `รายการสินค้าบาร์โค้ด-${getTodayDateKey()}.xlsx`;

  XLSX.writeFile(wb, filename);
}
