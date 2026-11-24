import { FaqItem, MenuItem, RewardOffer, StaffUser } from '../config/shopConfig';

export interface BillLineItem {
  id: string;
  menuItemId?: string;
  name: string;
  price: number;
  qty: number;
  stars: number;
  barcode?: string;
  tasteNote?: string;
}

export interface CustomerMember {
  memberId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  stars: number;
  createdAt: string;
}

export interface CustomerQueueOrder {
  queueNo: number;
  orderId: string;
  items: BillLineItem[];
  totalAmount: number;
  totalStars: number;
  deliveryType: 'ทานนี้' | 'กลับบ้าน' | 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง';
  tableNumber?: string;
  paymentMethod?: 'เงินสด' | 'สแกน QR';
  customerName?: string;
  dropPoint?: string;
  slipImageUrl?: string;
  accepted?: boolean;
  createdAt: string;
  status: 'กำลังทำ' | 'เสร็จแล้ว';
}

export interface OfflineQueueRecord {
  id: string;
  sheetTab: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface VoidLogEntry {
  id: string;
  timestamp: string;
  staffName: string;
  staffRole: string;
  action: 'ลบรายการ' | 'ล้างบิล';
  detail: string;
  amount: number;
}

export interface ReceiptSlipRecord {
  billId: string;
  orgCode: string;
  issuedAt: string;
  timestamp: string;
  shopType: 'store' | 'krua';
  shopName: string;
  mode: 'ขายจริง' | 'ทดสอบระบบ';
  staffName: string;
  paymentMethod: 'เงินสด' | 'สแกน QR';
  bankAccountLabel?: string;
  deliveryInfo?: string;
  items: BillLineItem[];
  totalAmount: number;
  totalStars: number;
  exitedAt?: string;
  exitedBy?: string;
}

export interface SaleHistoryEntry {
  id: string;
  timestamp: string;
  dateKey?: string;
  shopType?: 'store' | 'krua';
  shopName?: string;
  mode: 'ขายจริง' | 'ทดสอบระบบ';
  staffName: string;
  paymentMethod: 'เงินสด' | 'สแกน QR';
  totalAmount: number;
  totalStars: number;
  itemsSummary: string;
  deliveryInfo?: string;
  slipImageUrl?: string;
  exitedAt?: string;
  exitedBy?: string;
}

export interface SyncedBackendData {
  settings?: Record<string, string>;
  menu?: MenuItem[];
  staffUsers?: Record<string, StaffUser>;
  faqs?: FaqItem[];
  rewardOffers?: RewardOffer[];
  queueOrders?: CustomerQueueOrder[];
}

const STORAGE_KEYS = {
  OFFLINE_QUEUE: 'kkp_offline_sheets_queue',
  MEMBERS: 'kkp_members_cache',
  VOID_LOGS: 'kkp_silent_void_logs',
  SALE_LOGS: 'kkp_sale_logs',
  MENU_CACHE: 'kkp_menu_cache',
  STAFF_CACHE: 'kkp_staff_cache',
  FAQ_CACHE: 'kkp_faq_cache',
  REWARD_OFFERS_CACHE: 'kkp_reward_offers_cache',
  SETTINGS_CACHE: 'kkp_settings_cache',
  RECEIPT_SLIPS: 'kkp_receipt_slips_cache',
  TEST_MODE_DATE: 'kkp_test_mode_date',
  TEST_MODE_FLAG: 'kkp_is_test_mode',
};

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadDailyTestMode(): boolean {
  const today = getTodayDateKey();
  const savedDate = localStorage.getItem(STORAGE_KEYS.TEST_MODE_DATE);
  if (savedDate !== today) {
    // รีเซ็ตกลับเป็นโหมดขายจริงอัตโนมัติทุกวันใหม่
    localStorage.setItem(STORAGE_KEYS.TEST_MODE_DATE, today);
    localStorage.setItem(STORAGE_KEYS.TEST_MODE_FLAG, 'false');
    return false;
  }
  return localStorage.getItem(STORAGE_KEYS.TEST_MODE_FLAG) === 'true';
}

export function saveDailyTestMode(isTest: boolean): void {
  localStorage.setItem(STORAGE_KEYS.TEST_MODE_DATE, getTodayDateKey());
  localStorage.setItem(STORAGE_KEYS.TEST_MODE_FLAG, isTest ? 'true' : 'false');
}

export function getOfflineQueue(): OfflineQueueRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? (JSON.parse(raw) as OfflineQueueRecord[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineQueueRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

export async function postToSheets(
  scriptUrl: string,
  sheetTab: string,
  payload: Record<string, unknown>
): Promise<{ queued: boolean; sent: boolean }> {
  const record: OfflineQueueRecord = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sheetTab,
    payload: {
      ...payload,
      sheetTab,
      clientTimestamp: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  if (!scriptUrl || !scriptUrl.trim()) {
    return { queued: false, sent: false };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const q = getOfflineQueue();
    q.push(record);
    saveOfflineQueue(q);
    return { queued: true, sent: false };
  }

  try {
    await fetch(scriptUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(record.payload),
    });
    return { queued: false, sent: true };
  } catch {
    const q = getOfflineQueue();
    q.push(record);
    saveOfflineQueue(q);
    return { queued: true, sent: false };
  }
}

export async function flushOfflineQueue(scriptUrl: string): Promise<number> {
  if (!scriptUrl || !scriptUrl.trim()) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  const remaining: OfflineQueueRecord[] = [];
  let sentCount = 0;

  for (const item of queue) {
    try {
      await fetch(scriptUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(item.payload),
      });
      sentCount++;
    } catch {
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return sentCount;
}

function mapMenuRows(rawRows: Array<Record<string, unknown>>): MenuItem[] {
  return rawRows.map((row, index) => {
    const rawStatus = String(row.status ?? row['สถานะ'] ?? 'พร้อมขาย').trim();
    const status: 'พร้อมขาย' | 'หมด' = rawStatus === 'หมด' ? 'หมด' : 'พร้อมขาย';
    return {
      id: String(row.id || `sheet_${index}`),
      barcode: String(row.barcode ?? row['เลขบาร์โค้ด'] ?? '').trim(),
      name: String(row.name ?? row['ชื่อสินค้า'] ?? 'สินค้า').trim(),
      price: Number(row.price ?? row['ราคา'] ?? 0) || 0,
      stars: Number(row.stars ?? row['จำนวนดาว'] ?? 1) || 0,
      category: String(row.category ?? row['หมวดหมู่'] ?? 'ทั่วไป').trim(),
      imageUrl: String(row.imageUrl ?? row['ลิงก์รูปภาพ'] ?? '').trim() || undefined,
      status,
    };
  });
}

export async function fetchMenuFromSheets(scriptUrl: string): Promise<MenuItem[] | null> {
  if (!scriptUrl || !scriptUrl.trim()) return null;
  try {
    const url = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=getMenu`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { menu?: Array<Record<string, unknown>> };
    if (!Array.isArray(data.menu) || data.menu.length === 0) return null;

    const mapped = mapMenuRows(data.menu);
    localStorage.setItem(STORAGE_KEYS.MENU_CACHE, JSON.stringify(mapped));
    return mapped;
  } catch {
    return null;
  }
}

export async function syncAllFromSheets(scriptUrl: string): Promise<SyncedBackendData | null> {
  if (!scriptUrl || !scriptUrl.trim()) return null;
  try {
    const url = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=syncAll`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      settings?: Record<string, string>;
      menu?: Array<Record<string, unknown>>;
      staffUsers?: Array<Record<string, unknown>> | Record<string, StaffUser>;
      faqs?: Array<Record<string, unknown>>;
      rewardOffers?: Array<Record<string, unknown>>;
      queueOrders?: Array<Record<string, unknown>>;
    };

    const result: SyncedBackendData = {};

    if (data.settings && typeof data.settings === 'object') {
      result.settings = data.settings;
      localStorage.setItem(STORAGE_KEYS.SETTINGS_CACHE, JSON.stringify(data.settings));
    }

    if (Array.isArray(data.menu) && data.menu.length > 0) {
      const mappedMenu = mapMenuRows(data.menu);
      result.menu = mappedMenu;
      localStorage.setItem(STORAGE_KEYS.MENU_CACHE, JSON.stringify(mappedMenu));
    }

    if (data.staffUsers) {
      const staffMap: Record<string, StaffUser> = {};
      if (Array.isArray(data.staffUsers)) {
        data.staffUsers.forEach((row) => {
          const pin = String(row.pin ?? row['PIN'] ?? '').trim();
          const name = String(row.name ?? row['ชื่อ'] ?? '').trim();
          const roleRaw = String(row.role ?? row['สิทธิ์'] ?? 'cashier').trim().toLowerCase();
          if (pin && name) {
            staffMap[pin] = {
              name,
              role: roleRaw === 'admin' ? 'admin' : 'cashier',
            };
          }
        });
      } else if (typeof data.staffUsers === 'object') {
        Object.entries(data.staffUsers).forEach(([pin, user]) => {
          if (pin && user?.name) {
            staffMap[pin] = {
              name: user.name,
              role: user.role === 'admin' ? 'admin' : 'cashier',
            };
          }
        });
      }
      if (Object.keys(staffMap).length > 0) {
        result.staffUsers = staffMap;
        localStorage.setItem(STORAGE_KEYS.STAFF_CACHE, JSON.stringify(staffMap));
      }
    }

    if (Array.isArray(data.faqs) && data.faqs.length > 0) {
      const mappedFaqs: FaqItem[] = data.faqs
        .map((row, idx) => ({
          id: String(row.id || `sheet_faq_${idx}`),
          question: String(row.question ?? row['คำถาม'] ?? '').trim(),
          answer: String(row.answer ?? row['คำตอบ'] ?? '').trim(),
        }))
        .filter((f) => f.question && f.answer);

      if (mappedFaqs.length > 0) {
        result.faqs = mappedFaqs;
        localStorage.setItem(STORAGE_KEYS.FAQ_CACHE, JSON.stringify(mappedFaqs));
      }
    }

    if (Array.isArray(data.rewardOffers) && data.rewardOffers.length > 0) {
      const mappedRewards: RewardOffer[] = data.rewardOffers
        .map((row, idx) => ({
          id: String(row.id || `sheet_rw_${idx}`),
          title: String(row.title ?? row['ชื่อของรางวัล'] ?? '').trim(),
          starsRequired: Number(row.starsRequired ?? row['ดาวที่ใช้'] ?? 50) || 50,
          description: String(row.description ?? row['รายละเอียด'] ?? '').trim(),
          terms: String(row.terms ?? row['เงื่อนไข'] ?? '').trim(),
          expiryDate: String(row.expiryDate ?? row['วันหมดเขต'] ?? 'ไม่มีกำหนด').trim(),
          active: String(row.active ?? row['เปิดใช้งาน'] ?? 'true').toLowerCase() !== 'false',
        }))
        .filter((r) => r.title);

      if (mappedRewards.length > 0) {
        result.rewardOffers = mappedRewards;
        localStorage.setItem(STORAGE_KEYS.REWARD_OFFERS_CACHE, JSON.stringify(mappedRewards));
      }
    }

    if (Array.isArray(data.queueOrders) && data.queueOrders.length > 0) {
      result.queueOrders = mapOnlineOrderRows(data.queueOrders);
    }

    return result;
  } catch {
    return null;
  }
}

function mapOnlineOrderRows(rawRows: Array<Record<string, unknown>>): CustomerQueueOrder[] {
  return rawRows
    .map((row, idx) => {
      let parsedItems: BillLineItem[] = [];
      if (Array.isArray(row.items)) {
        parsedItems = row.items as BillLineItem[];
      } else if (typeof row.itemsJson === 'string' && row.itemsJson.trim()) {
        try {
          const arr = JSON.parse(row.itemsJson);
          if (Array.isArray(arr)) parsedItems = arr;
        } catch {
          parsedItems = [];
        }
      }
      const deliveryRaw = String(row.deliveryType || 'รับเองที่ร้าน').trim();
      const deliveryType: 'ทานนี้' | 'กลับบ้าน' | 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง' =
        deliveryRaw === 'ทานนี้'
          ? 'ทานนี้'
          : deliveryRaw === 'กลับบ้าน'
            ? 'กลับบ้าน'
            : deliveryRaw === 'ให้พ่อไปส่ง'
              ? 'ให้พ่อไปส่ง'
              : 'รับเองที่ร้าน';
      const dropPointRaw = String(row.dropPoint || '').trim();
      const tableFromRow = String(row.tableNumber || '').trim();
      const tableFromDrop =
        !tableFromRow && deliveryType === 'ทานนี้' && dropPointRaw.startsWith('โต๊ะที่ ')
          ? dropPointRaw.replace(/^โต๊ะที่\s*/, '').trim()
          : '';
      const tableNumber = tableFromRow || tableFromDrop || undefined;
      const paymentRaw = String(row.paymentMethod || '');
      const paymentMethod: 'เงินสด' | 'สแกน QR' | undefined =
        paymentRaw === 'เงินสด' ? 'เงินสด' : paymentRaw === 'สแกน QR' ? 'สแกน QR' : undefined;
      const statusRaw = String(row.status || 'กำลังทำ');
      const status: 'กำลังทำ' | 'เสร็จแล้ว' = statusRaw === 'เสร็จแล้ว' ? 'เสร็จแล้ว' : 'กำลังทำ';
      const slipRaw = String(row.slipImageUrl || '').trim();
      return {
        queueNo: Number(row.queueNo) || idx + 1,
        orderId: String(row.orderId || `ORD_${idx + 1}`),
        items: parsedItems,
        totalAmount: Number(row.totalAmount || 0) || 0,
        totalStars: Number(row.totalStars || 0) || 0,
        deliveryType,
        tableNumber,
        paymentMethod,
        customerName: String(row.customerName || '').trim() || undefined,
        dropPoint: dropPointRaw || undefined,
        slipImageUrl: slipRaw || undefined,
        accepted: String(row.accepted || '').toLowerCase() === 'true',
        createdAt: String(row.createdAt || new Date().toISOString()),
        status,
      };
    })
    .filter((o) => o.orderId);
}

export async function fetchOnlineOrdersFromSheets(scriptUrl: string): Promise<CustomerQueueOrder[] | null> {
  if (!scriptUrl || !scriptUrl.trim()) return null;
  try {
    const url = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=getOrders`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { queueOrders?: Array<Record<string, unknown>> };
    if (!Array.isArray(data.queueOrders)) return null;
    return mapOnlineOrderRows(data.queueOrders);
  } catch {
    return null;
  }
}

export function loadCachedMenu(): MenuItem[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MENU_CACHE);
    return raw ? (JSON.parse(raw) as MenuItem[]) : null;
  } catch {
    return null;
  }
}

export function saveCachedMenu(menu: MenuItem[]): void {
  localStorage.setItem(STORAGE_KEYS.MENU_CACHE, JSON.stringify(menu));
}

export function loadCachedStaffUsers(): Record<string, StaffUser> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_CACHE);
    return raw ? (JSON.parse(raw) as Record<string, StaffUser>) : null;
  } catch {
    return null;
  }
}

export function loadCachedFaqs(): FaqItem[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAQ_CACHE);
    return raw ? (JSON.parse(raw) as FaqItem[]) : null;
  } catch {
    return null;
  }
}

export function saveCachedFaqs(faqs: FaqItem[]): void {
  localStorage.setItem(STORAGE_KEYS.FAQ_CACHE, JSON.stringify(faqs));
}

export function loadCachedRewardOffers(): RewardOffer[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REWARD_OFFERS_CACHE);
    return raw ? (JSON.parse(raw) as RewardOffer[]) : null;
  } catch {
    return null;
  }
}

export function saveCachedRewardOffers(offers: RewardOffer[]): void {
  localStorage.setItem(STORAGE_KEYS.REWARD_OFFERS_CACHE, JSON.stringify(offers));
}

export async function checkAutoPaymentFromSheets(
  scriptUrl: string,
  expectedAmount: number
): Promise<boolean> {
  if (!scriptUrl || !scriptUrl.trim()) return false;
  try {
    const url = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=checkPayment&amount=${expectedAmount}`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = (await res.json()) as { paid?: boolean; matchedAmount?: number };
    if (data.paid === true) return true;
    if (typeof data.matchedAmount === 'number' && Math.abs(data.matchedAmount - expectedAmount) < 0.01) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getMembersCache(): CustomerMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (raw) return JSON.parse(raw) as CustomerMember[];
  } catch {
    // Ignore
  }
  return [];
}

export function saveMembersCache(members: CustomerMember[]): void {
  localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
}

export function findMemberByPhoneOrLast4(query: string): CustomerMember | undefined {
  const digits = query.replace(/\D/g, '');
  if (!digits) return undefined;
  const members = getMembersCache();
  return members.find((m) => m.phone === digits || (digits.length === 4 && m.phone.endsWith(digits)));
}

export function findMemberByAnyQuery(query: string): CustomerMember | undefined {
  const raw = query.trim();
  if (!raw) return undefined;
  const members = getMembersCache();
  const upper = raw.toUpperCase();
  const byId = members.find((m) => m.memberId.toUpperCase() === upper);
  if (byId) return byId;

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) {
    const byPhone = members.find(
      (m) => m.phone === digits || (digits.length === 4 && m.phone.endsWith(digits))
    );
    if (byPhone) return byPhone;
  }

  const lower = raw.toLowerCase();
  return members.find(
    (m) =>
      m.nickname.toLowerCase() === lower ||
      m.firstName.toLowerCase() === lower
  );
}

export function generateNextMemberId(members: CustomerMember[]): string {
  let maxNum = 0;
  for (const m of members) {
    const match = m.memberId.match(/KKP-(\d+)/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `KKP-${String(maxNum + 1).padStart(4, '0')}`;
}

export function getSilentVoidLogs(): VoidLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOID_LOGS);
    return raw ? (JSON.parse(raw) as VoidLogEntry[]) : [];
  } catch {
    return [];
  }
}

export async function recordSilentVoid(
  scriptUrl: string,
  entry: Omit<VoidLogEntry, 'id' | 'timestamp'>
): Promise<void> {
  const fullEntry: VoidLogEntry = {
    id: `void_${Date.now()}`,
    timestamp: new Date().toLocaleString('th-TH'),
    ...entry,
  };
  const existing = getSilentVoidLogs();
  existing.unshift(fullEntry);
  localStorage.setItem(STORAGE_KEYS.VOID_LOGS, JSON.stringify(existing.slice(0, 100)));

  await postToSheets(scriptUrl, 'ประวัติการยกเลิก', {
    actionType: 'voidLog',
    ...fullEntry,
  });
}

export function getSaleHistoryLogs(): SaleHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SALE_LOGS);
    return raw ? (JSON.parse(raw) as SaleHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveSaleHistoryLog(entry: SaleHistoryEntry): void {
  const existing = getSaleHistoryLogs();
  existing.unshift({
    ...entry,
    dateKey: entry.dateKey || getTodayDateKey(),
  });
  localStorage.setItem(STORAGE_KEYS.SALE_LOGS, JSON.stringify(existing.slice(0, 500)));
}

export function getReceiptSlipsCache(): ReceiptSlipRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECEIPT_SLIPS);
    return raw ? (JSON.parse(raw) as ReceiptSlipRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveReceiptSlipsCache(receipts: ReceiptSlipRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECEIPT_SLIPS, JSON.stringify(receipts.slice(0, 300)));
  } catch {
    // Ignore storage quota errors
  }
}

export function markSaleHistoryExited(billId: string, exitedAt: string, exitedBy: string): void {
  const existing = getSaleHistoryLogs();
  const updated = existing.map((item) =>
    item.id === billId ? { ...item, exitedAt, exitedBy } : item
  );
  localStorage.setItem(STORAGE_KEYS.SALE_LOGS, JSON.stringify(updated));
}

export function buildExitPassQrPayload(
  receipt: Pick<ReceiptSlipRecord, 'billId' | 'totalAmount'>
): string {
  return `KKP_PASS:${receipt.billId}:${Math.round(receipt.totalAmount)}`;
}

export function parseExitPassCode(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  if (trimmed.toUpperCase().startsWith('KKP_PASS:')) {
    const parts = trimmed.split(':');
    return (parts[1] || '').trim().toUpperCase();
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { billId?: string };
      if (parsed.billId) return String(parsed.billId).trim().toUpperCase();
    } catch {
      // Fallback to raw text
    }
  }
  return trimmed.replace(/^#/, '').trim().toUpperCase();
}

export interface ShopDailyStats {
  bills: number;
  cash: number;
  qr: number;
  total: number;
  stars: number;
}

export function buildLineDailySummary(
  logs: SaleHistoryEntry[],
  shopNameTh: string,
  foodShopNameTh: string,
  promptPayInfo?: { id?: string; accountName?: string }
): {
  text: string;
  todayDateLabel: string;
  storeStats: ShopDailyStats;
  kruaStats: ShopDailyStats;
  grandTotal: number;
  grandBills: number;
  grandStars: number;
} {
  const todayKey = getTodayDateKey();
  const realToday = logs.filter((l) => {
    const isReal = l.mode === 'ขายจริง';
    const isToday = l.dateKey ? l.dateKey === todayKey : true;
    return isReal && isToday;
  });

  const storeStats: ShopDailyStats = { bills: 0, cash: 0, qr: 0, total: 0, stars: 0 };
  const kruaStats: ShopDailyStats = { bills: 0, cash: 0, qr: 0, total: 0, stars: 0 };

  for (const s of realToday) {
    const isKrua =
      s.shopType === 'krua' ||
      (s.shopName && s.shopName.includes(foodShopNameTh)) ||
      s.itemsSummary.includes(`[${foodShopNameTh}]`);
    const target = isKrua ? kruaStats : storeStats;
    target.bills += 1;
    target.total += s.totalAmount;
    target.stars += s.totalStars;
    if (s.paymentMethod === 'เงินสด') {
      target.cash += s.totalAmount;
    } else {
      target.qr += s.totalAmount;
    }
  }

  const grandTotal = storeStats.total + kruaStats.total;
  const grandBills = storeStats.bills + kruaStats.bills;
  const grandStars = storeStats.stars + kruaStats.stars;
  const todayDateLabel = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const ppLines: string[] = [];
  if (promptPayInfo?.id) {
    ppLines.push(
      `📱 พร้อมเพย์ร้าน: ${promptPayInfo.id}${
        promptPayInfo.accountName ? ` (ชื่อบัญชี: ${promptPayInfo.accountName})` : ''
      }`
    );
  }

  const text = [
    `📊 สรุปยอดขายประจำวัน (${todayDateLabel})`,
    `-------------------------`,
    `⭐ ${shopNameTh} (หน้าร้าน)`,
    `• จำนวนบิล: ${storeStats.bills} บิล`,
    `• เงินสด: ฿${storeStats.cash.toLocaleString('th-TH')}`,
    `• สแกน QR: ฿${storeStats.qr.toLocaleString('th-TH')}`,
    `• ยอดรวม: ฿${storeStats.total.toLocaleString('th-TH')} (แจก ⭐ ${storeStats.stars} ดาว)`,
    ``,
    `🍲 ${foodShopNameTh} (ร้านข้าวแม่)`,
    `• จำนวนบิล: ${kruaStats.bills} บิล`,
    `• เงินสด: ฿${kruaStats.cash.toLocaleString('th-TH')}`,
    `• สแกน QR: ฿${kruaStats.qr.toLocaleString('th-TH')}`,
    `• ยอดรวม: ฿${kruaStats.total.toLocaleString('th-TH')} (แจก ⭐ ${kruaStats.stars} ดาว)`,
    `-------------------------`,
    `💰 รวมสุทธิทั้ง 2 ร้าน: ฿${grandTotal.toLocaleString('th-TH')} (${grandBills} บิล | ⭐ ${grandStars} ดาว)`,
    ...ppLines,
  ].join('\n');

  return {
    text,
    todayDateLabel,
    storeStats,
    kruaStats,
    grandTotal,
    grandBills,
    grandStars,
  };
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportSalesToExcelCsv(
  logs: SaleHistoryEntry[],
  scope: 'today' | 'all',
  shopNameTh: string,
  foodShopNameTh: string
): number {
  const todayKey = getTodayDateKey();
  const filtered =
    scope === 'today'
      ? logs.filter((l) => (l.dateKey ? l.dateKey === todayKey : true))
      : logs;

  const headers = [
    'วันที่-เวลา',
    'เลขที่บิล',
    'ร้าน',
    'โหมด',
    'ผู้ขาย',
    'ช่องทางชำระเงิน',
    'ยอดเงิน (บาท)',
    'ดาวที่แจก',
    'รายการสินค้า',
    'การจัดส่ง',
  ];

  const rows = filtered.map((item) => {
    const inferredShop =
      item.shopName ||
      (item.shopType === 'krua' || item.itemsSummary.includes(`[${foodShopNameTh}]`)
        ? foodShopNameTh
        : shopNameTh);
    return [
      escapeCsvCell(item.timestamp),
      escapeCsvCell(item.id),
      escapeCsvCell(inferredShop),
      escapeCsvCell(item.mode),
      escapeCsvCell(item.staffName),
      escapeCsvCell(item.paymentMethod),
      escapeCsvCell(item.totalAmount),
      escapeCsvCell(item.totalStars),
      escapeCsvCell(item.itemsSummary),
      escapeCsvCell(item.deliveryInfo || 'หน้าร้าน'),
    ].join(',');
  });

  // \uFEFF UTF-8 BOM เพื่อให้เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kookkik-sales-${scope === 'today' ? todayKey : 'all-history'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return filtered.length;
}

export const APPS_SCRIPT_TEMPLATE = `// Google Apps Script สำหรับร้าน กุ๊กกิ๊กพาเพลิน & ครัวแม่วัง
// วางโค้ดนี้ใน ส่วนขยาย > Apps Script แล้ว Deploy เป็น Web App (Anyone)
// รองรับแท็บ: ตั้งค่าระบบ, ตั้งค่าเมนู, ผู้ใช้งานและPIN, ถามตอบลูกค้า, ขายจริง_หน้าร้าน, ขายจริง_ครัวแม่วัง, ทดสอบระบบ, ประวัติการยกเลิก, สมาชิกลูกค้า, สะสมแต้ม

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'syncAll') {
    return jsonOut({
      settings: readSettingsMap(ss),
      menu: readMenuRows(ss),
      staffUsers: readStaffRows(ss),
      faqs: readFaqRows(ss),
      rewardOffers: readRewardOfferRows(ss),
      queueOrders: readOnlineOrders(ss)
    });
  }

  if (action === 'getOrders') {
    return jsonOut({ queueOrders: readOnlineOrders(ss) });
  }

  if (action === 'getMenu') {
    return jsonOut({ menu: readMenuRows(ss) });
  }

  if (action === 'checkPayment') {
    var expected = Number(e.parameter.amount || 0);
    var paySheet = ss.getSheetByName('แจ้งเตือนเงินเข้า');
    if (!paySheet) return jsonOut({ paid: false });
    var lastRow = paySheet.getLastRow();
    if (lastRow < 2) return jsonOut({ paid: false });
    var latestAmount = Number(paySheet.getRange(lastRow, 2).getValue() || 0);
    var latestStatus = String(paySheet.getRange(lastRow, 3).getValue() || '');
    return jsonOut({
      paid: Math.abs(latestAmount - expected) < 0.01 && latestStatus !== 'USED',
      matchedAmount: latestAmount
    });
  }

  return jsonOut({ ok: true, shop: 'kookkikpaplern' });
}

function readSettingsMap(ss) {
  var sheet = ss.getSheetByName('ตั้งค่าระบบ');
  if (!sheet) return {};
  var rows = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var key = String(rows[i][0] || '').trim();
    if (key) map[key] = String(rows[i][1] || '');
  }
  return map;
}

function readMenuRows(ss) {
  var sheet = ss.getSheetByName('ตั้งค่าเมนู');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var menu = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    menu.push({
      barcode: String(r[0] || ''),
      name: String(r[1] || ''),
      price: Number(r[2] || 0),
      stars: Number(r[3] || 1),
      category: String(r[4] || 'ทั่วไป'),
      imageUrl: String(r[5] || ''),
      status: String(r[6] || 'พร้อมขาย')
    });
  }
  return menu;
}

function readStaffRows(ss) {
  var sheet = ss.getSheetByName('ผู้ใช้งานและPIN');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] || !r[1]) continue;
    list.push({
      pin: String(r[0] || '').trim(),
      name: String(r[1] || '').trim(),
      role: String(r[2] || 'cashier').trim().toLowerCase()
    });
  }
  return list;
}

function readFaqRows(ss) {
  var sheet = ss.getSheetByName('ถามตอบลูกค้า');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1] || !r[2]) continue;
    list.push({
      id: String(r[0] || ('faq_' + i)),
      question: String(r[1] || ''),
      answer: String(r[2] || '')
    });
  }
  return list;
}

function readRewardOfferRows(ss) {
  var sheet = ss.getSheetByName('โปรโมชันแลกดาว');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    list.push({
      id: String(r[0] || ('rw_' + i)),
      title: String(r[1] || ''),
      starsRequired: Number(r[2] || 50),
      description: String(r[3] || ''),
      terms: String(r[4] || ''),
      expiryDate: String(r[5] || ''),
      active: String(r[6] || 'true').toLowerCase() !== 'false'
    });
  }
  return list;
}

function readOnlineOrders(ss) {
  var sheet = ss.getSheetByName('ออเดอร์ออนไลน์');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    list.push({
      queueNo: Number(r[0] || i),
      orderId: String(r[1] || ''),
      createdAt: String(r[2] || ''),
      customerName: String(r[3] || ''),
      deliveryType: String(r[4] || 'รับเองที่ร้าน'),
      dropPoint: String(r[5] || ''),
      paymentMethod: String(r[6] || 'สแกน QR'),
      totalAmount: Number(r[7] || 0),
      totalStars: Number(r[8] || 0),
      itemsJson: String(r[9] || '[]'),
      slipImageUrl: String(r[10] || ''),
      accepted: String(r[11] || 'false'),
      status: String(r[12] || 'กำลังทำ')
    });
  }
  return list;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tabName = data.sheetTab || 'ขายจริง_หน้าร้าน';
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);

    if (tabName === 'ถามตอบลูกค้า' && Array.isArray(data.faqs)) {
      sheet.clearContents();
      sheet.appendRow(['รหัส', 'คำถาม', 'คำตอบ']);
      data.faqs.forEach(function(f) {
        sheet.appendRow([f.id, f.question, f.answer]);
      });
      return jsonOut({ ok: true });
    }

    if (tabName === 'โปรโมชันแลกดาว' && Array.isArray(data.rewardOffers)) {
      sheet.clearContents();
      sheet.appendRow(['รหัส', 'ชื่อของรางวัล', 'ดาวที่ใช้', 'รายละเอียด', 'เงื่อนไข', 'วันหมดเขต', 'เปิดใช้งาน']);
      data.rewardOffers.forEach(function(r) {
        sheet.appendRow([r.id, r.title, r.starsRequired, r.description, r.terms, r.expiryDate, r.active ? 'true' : 'false']);
      });
      return jsonOut({ ok: true });
    }

    if (tabName === 'ตั้งค่าระบบ' && data.settings) {
      sheet.clearContents();
      sheet.appendRow(['key', 'value']);
      Object.keys(data.settings).forEach(function(k) {
        sheet.appendRow([k, String(data.settings[k])]);
      });
      return jsonOut({ ok: true });
    }

    if (tabName === 'ตั้งค่าเมนู' && Array.isArray(data.menu)) {
      sheet.clearContents();
      sheet.appendRow(['เลขบาร์โค้ด', 'ชื่อสินค้า', 'ราคา', 'จำนวนดาว', 'หมวดหมู่', 'ลิงก์รูปภาพ', 'สถานะ']);
      data.menu.forEach(function(m) {
        sheet.appendRow([
          m.barcode ? ("'" + m.barcode) : '',
          m.name || '',
          Number(m.price || 0),
          Number(m.stars || 1),
          m.category || 'ทั่วไป',
          m.imageUrl || '',
          m.status || 'พร้อมขาย'
        ]);
      });
      return jsonOut({ ok: true });
    }

    if (tabName === 'ผู้ใช้งานและPIN' && Array.isArray(data.staffList)) {
      sheet.clearContents();
      sheet.appendRow(['PIN', 'ชื่อ', 'สิทธิ์']);
      data.staffList.forEach(function(st) {
        sheet.appendRow(["'" + String(st.pin || ''), String(st.name || ''), String(st.role || 'admin')]);
      });
      return jsonOut({ ok: true });
    }

    if (tabName === 'ออเดอร์ออนไลน์') {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['คิวที่', 'รหัสออเดอร์', 'เวลาสั่ง', 'ชื่อลูกค้า', 'วิธีรับ', 'จุดส่ง', 'ชำระเงิน', 'ยอดรวม', 'ดาว', 'รายการJSON', 'รูปสลิป', 'รับออเดอร์แล้ว', 'สถานะ']);
      }
      if (data.actionType === 'updateOrderStatus' && data.orderId) {
        var rows = sheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][1]) === String(data.orderId)) {
            if (data.accepted !== undefined) sheet.getRange(i + 1, 12).setValue(data.accepted ? 'true' : 'false');
            if (data.status !== undefined) sheet.getRange(i + 1, 13).setValue(String(data.status));
            break;
          }
        }
        return jsonOut({ ok: true });
      }
      sheet.appendRow([
        Number(data.queueNo || 1),
        String(data.orderId || ''),
        String(data.createdAt || new Date().toISOString()),
        String(data.customerName || ''),
        String(data.deliveryType || 'รับเองที่ร้าน'),
        String(data.dropPoint || ''),
        String(data.paymentMethod || 'สแกน QR'),
        Number(data.totalAmount || 0),
        Number(data.totalStars || 0),
        JSON.stringify(data.items || []),
        String(data.slipImageUrl || ''),
        data.accepted ? 'true' : 'false',
        String(data.status || 'กำลังทำ')
      ]);
      return jsonOut({ ok: true });
    }

    if (sheet.getLastRow() === 0) {
      if (tabName === 'ประวัติการยกเลิก') {
        sheet.appendRow(['เวลา', 'พนักงาน', 'สิทธิ์', 'การกระทำ', 'รายละเอียด', 'มูลค่า']);
      } else if (tabName === 'สมาชิกลูกค้า') {
        sheet.appendRow(['รหัสสมาชิก', 'ชื่อจริง', 'นามสกุล', 'ชื่อเล่น', 'เบอร์โทร', 'ดาวเริ่มต้น', 'วันที่สมัคร']);
      } else if (tabName === 'สะสมแต้ม') {
        sheet.appendRow(['เวลา', 'รหัสสมาชิก', 'ชื่อเล่น', 'เบอร์โทร', 'รายการ', 'ดาวที่เปลี่ยน', 'ดาวคงเหลือ', 'ผู้ทำรายการ']);
      } else {
        sheet.appendRow(['เวลา', 'เลขบิล', 'โหมด', 'ผู้ขาย', 'ช่องทาง', 'ยอดรวม', 'ดาวที่ได้', 'รายการสินค้า', 'การจัดส่ง', 'สถานะสลิป', 'รูปสลิป']);
      }
    }

    if (tabName === 'ประวัติการยกเลิก') {
      sheet.appendRow([new Date(), data.staffName, data.staffRole, data.action, data.detail, data.amount]);
    } else if (tabName === 'สมาชิกลูกค้า') {
      sheet.appendRow([data.memberId, data.firstName, data.lastName, data.nickname, "'" + data.phone, data.stars, new Date()]);
    } else if (tabName === 'สะสมแต้ม') {
      sheet.appendRow([new Date(), data.memberId, data.nickname, "'" + data.phone, data.note, data.deltaStars, data.totalStars, data.staffName]);
    } else {
      sheet.appendRow([
        new Date(),
        data.billId || '',
        data.mode || tabName,
        data.staffName || '',
        data.paymentMethod || '',
        data.totalAmount || 0,
        data.totalStars || 0,
        data.itemsSummary || '',
        data.deliveryInfo || '',
        data.slipStatus || '',
        data.slipImageUrl || ''
      ]);
    }
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: err.toString() });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;
