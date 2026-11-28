import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://kadhcobomdqiobrnntlv.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_WvGv3CDfPK9dyoLJCu5Srw__iO18OXv';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_SUPABASE_URL?.trim()) ||
  DEFAULT_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_URL_DISPLAY = SUPABASE_URL;
export const SUPABASE_SLIPS_BUCKET = 'slips';
export const SUPABASE_ORDERS_TABLE = 'orders';
export const SALES_RETENTION_DAYS = 7;

const CLEANUP_STORAGE_KEY = 'kkp_last_sb_cleanup_v1';
const CLEANUP_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 8000);
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

export interface SupabaseOrderMeta {
  billId?: string;
  queueNo?: number;
  shopName?: string;
  staffName?: string;
  deliveryType?: 'ทานนี้' | 'กลับบ้าน' | 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง';
  tableNumber?: string;
  customerName?: string;
  dropPoint?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDistanceKm?: number;
  bankAccount?: string;
  isTestMode?: boolean;
}

export interface SupabaseOrderItem {
  id?: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
  tasteNote?: string;
  order_meta?: SupabaseOrderMeta;
}

export type SupabasePaymentMethod = 'transfer' | 'cash';
export type SupabaseOrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled' | string;

export interface SupabaseOrderRow {
  id: string | number;
  created_at?: string;
  items: SupabaseOrderItem[];
  total_amount: number;
  payment_method: string;
  slip_url: string | null;
  status: SupabaseOrderStatus;
}

export interface CreateSupabaseOrderInput {
  items: SupabaseOrderItem[];
  total_amount: number;
  payment_method: SupabasePaymentMethod;
  slip_url: string | null;
  status?: SupabaseOrderStatus;
  meta?: SupabaseOrderMeta;
}

export interface SupabaseCleanupSummary {
  ranAt: string;
  deletedOrders: number;
  deletedSlips: number;
  error?: string;
}

const ALLOWED_IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function isSafeHttpUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function extractSlipStoragePathFromUrl(slipUrl?: string | null): string | null {
  if (!isSafeHttpUrl(slipUrl)) return null;
  try {
    const parsed = new URL(slipUrl!.trim());
    const marker = `/storage/v1/object/public/${SUPABASE_SLIPS_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;
    const rawPath = parsed.pathname.slice(idx + marker.length);
    return decodeURIComponent(rawPath).replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
}

export function extractOrderMetaFromSupabaseOrder(
  row: Pick<SupabaseOrderRow, 'items'>
): SupabaseOrderMeta {
  if (!Array.isArray(row.items)) return {};
  for (const item of row.items) {
    if (item && typeof item === 'object' && item.order_meta && typeof item.order_meta === 'object') {
      return item.order_meta;
    }
  }
  return {};
}

function sanitizeOrderMeta(meta?: SupabaseOrderMeta): SupabaseOrderMeta | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const cleaned: SupabaseOrderMeta = {
    ...(meta.billId ? { billId: String(meta.billId).trim().slice(0, 40) } : {}),
    ...(typeof meta.queueNo === 'number' && Number.isFinite(meta.queueNo)
      ? { queueNo: meta.queueNo }
      : {}),
    ...(meta.shopName ? { shopName: String(meta.shopName).trim().slice(0, 80) } : {}),
    ...(meta.staffName ? { staffName: String(meta.staffName).trim().slice(0, 60) } : {}),
    ...(meta.deliveryType ? { deliveryType: meta.deliveryType } : {}),
    ...(meta.tableNumber ? { tableNumber: String(meta.tableNumber).trim().slice(0, 30) } : {}),
    ...(meta.customerName ? { customerName: String(meta.customerName).trim().slice(0, 80) } : {}),
    ...(meta.dropPoint ? { dropPoint: String(meta.dropPoint).trim().slice(0, 120) } : {}),
    ...(typeof meta.deliveryLat === 'number' && Number.isFinite(meta.deliveryLat)
      ? { deliveryLat: Number(meta.deliveryLat.toFixed(6)) }
      : {}),
    ...(typeof meta.deliveryLng === 'number' && Number.isFinite(meta.deliveryLng)
      ? { deliveryLng: Number(meta.deliveryLng.toFixed(6)) }
      : {}),
    ...(typeof meta.deliveryDistanceKm === 'number' && Number.isFinite(meta.deliveryDistanceKm)
      ? { deliveryDistanceKm: Number(meta.deliveryDistanceKm.toFixed(2)) }
      : {}),
    ...(meta.bankAccount ? { bankAccount: String(meta.bankAccount).trim().slice(0, 100) } : {}),
    ...(typeof meta.isTestMode === 'boolean' ? { isTestMode: meta.isTestMode } : {}),
  };
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data URL');
  }
  const mimeType = match[1].toLowerCase();
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
  };
}

export async function uploadSlipToSupabase(
  source: File | string
): Promise<{ publicUrl: string | null; path?: string; error?: string }> {
  try {
    let uploadBody: Blob;
    let mimeType = 'image/jpeg';

    if (typeof source === 'string') {
      const converted = dataUrlToBlob(source);
      uploadBody = converted.blob;
      mimeType = converted.mimeType;
    } else {
      if (source.size > 15 * 1024 * 1024) {
        return { publicUrl: null, error: 'Slip file exceeds 15MB limit.' };
      }
      uploadBody = source;
      mimeType = (source.type || 'image/jpeg').toLowerCase();
    }

    const ext = ALLOWED_IMAGE_EXT[mimeType] || 'jpg';
    const contentType = ALLOWED_IMAGE_EXT[mimeType] ? mimeType : 'image/jpeg';
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `slip_${uniqueSuffix}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_SLIPS_BUCKET)
      .upload(filePath, uploadBody, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { publicUrl: null, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from(SUPABASE_SLIPS_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl || '';
    if (!isSafeHttpUrl(publicUrl)) {
      return { publicUrl: null, error: 'Invalid public URL returned by storage.' };
    }

    return { publicUrl, path: filePath };
  } catch (err) {
    return {
      publicUrl: null,
      error: err instanceof Error ? err.message : 'Failed to upload slip',
    };
  }
}

export async function insertOrderToSupabase(
  input: CreateSupabaseOrderInput
): Promise<{ order: SupabaseOrderRow | null; error?: string }> {
  const numericTotal = Number(input.total_amount);
  if (!Number.isFinite(numericTotal) || numericTotal < 0) {
    return { order: null, error: 'Invalid total amount' };
  }

  const cleanMeta = sanitizeOrderMeta(input.meta);

  const sanitizedItems: SupabaseOrderItem[] =
    Array.isArray(input.items) && input.items.length > 0
      ? input.items.map((item, idx) => {
          const qty = Math.max(1, Math.round(Number(item.qty) || 1));
          const price = Math.max(0, Number(item.price) || 0);
          return {
            ...(item.id ? { id: String(item.id) } : {}),
            name: String(item.name || 'สินค้า'),
            qty,
            price,
            subtotal: Number((price * qty).toFixed(2)),
            ...(item.tasteNote ? { tasteNote: String(item.tasteNote) } : {}),
            ...(idx === 0 && cleanMeta ? { order_meta: cleanMeta } : {}),
          };
        })
      : [
          {
            name: cleanMeta?.shopName || 'รายการสั่งซื้อ',
            qty: 1,
            price: Number(numericTotal.toFixed(2)),
            subtotal: Number(numericTotal.toFixed(2)),
            ...(cleanMeta ? { order_meta: cleanMeta } : {}),
          },
        ];

  const safeSlipUrl =
    input.payment_method === 'cash'
      ? null
      : isSafeHttpUrl(input.slip_url)
        ? input.slip_url!.trim()
        : null;

  const rowPayload = {
    items: sanitizedItems,
    total_amount: Number(numericTotal.toFixed(2)),
    payment_method: input.payment_method === 'cash' ? 'cash' : 'transfer',
    slip_url: safeSlipUrl,
    status: String(input.status || 'pending'),
  };

  try {
    const { data, error } = await supabase
      .from(SUPABASE_ORDERS_TABLE)
      .insert(rowPayload)
      .select()
      .single();

    if (error) {
      return { order: null, error: error.message };
    }
    return { order: data as SupabaseOrderRow };
  } catch (err) {
    return {
      order: null,
      error: err instanceof Error ? err.message : 'Failed to insert order',
    };
  }
}

export async function fetchOrdersFromSupabase(
  limit = 100
): Promise<{ orders: SupabaseOrderRow[]; error?: string }> {
  try {
    const primary = await supabase
      .from(SUPABASE_ORDERS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!primary.error) {
      return {
        orders: (Array.isArray(primary.data) ? primary.data : []) as SupabaseOrderRow[],
      };
    }

    // Fallback if table does not have created_at column
    if (primary.error.message?.toLowerCase().includes('created_at')) {
      const fallback = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .select('*')
        .order('id', { ascending: false })
        .limit(limit);

      if (fallback.error) {
        return { orders: [], error: fallback.error.message };
      }
      return {
        orders: (Array.isArray(fallback.data) ? fallback.data : []) as SupabaseOrderRow[],
      };
    }

    return { orders: [], error: primary.error.message };
  } catch (err) {
    return {
      orders: [],
      error: err instanceof Error ? err.message : 'Failed to fetch orders',
    };
  }
}

export async function updateOrderStatusInSupabase(
  orderId: string | number,
  nextStatus: SupabaseOrderStatus
): Promise<{ order: SupabaseOrderRow | null; error?: string }> {
  const cleanStatus = String(nextStatus || '').trim();
  if (!cleanStatus) {
    return { order: null, error: 'Status is required' };
  }
  try {
    const { data, error } = await supabase
      .from(SUPABASE_ORDERS_TABLE)
      .update({ status: cleanStatus })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return { order: null, error: error.message };
    }
    return { order: data as SupabaseOrderRow };
  } catch (err) {
    return {
      order: null,
      error: err instanceof Error ? err.message : 'Failed to update order status',
    };
  }
}

export function getLastSupabaseCleanupSummary(): SupabaseCleanupSummary | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CLEANUP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SupabaseCleanupSummary) : null;
  } catch {
    return null;
  }
}

export async function cleanupExpiredOrdersInSupabase(
  retentionDays = SALES_RETENTION_DAYS,
  force = false
): Promise<SupabaseCleanupSummary> {
  const safeDays = Math.max(1, Math.round(retentionDays || SALES_RETENTION_DAYS));
  const nowMs = Date.now();

  if (!force && typeof localStorage !== 'undefined') {
    const prev = getLastSupabaseCleanupSummary();
    if (prev?.ranAt) {
      const elapsed = nowMs - new Date(prev.ranAt).getTime();
      if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < CLEANUP_COOLDOWN_MS) {
        return prev;
      }
    }
  }

  const cutoffMs = nowMs - safeDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();
  let deletedOrders = 0;
  let deletedSlips = 0;

  try {
    // 1) Find expired orders older than retentionDays (e.g. 7 days)
    const { data: expiredRows, error: selectErr } = await supabase
      .from(SUPABASE_ORDERS_TABLE)
      .select('id, created_at, slip_url')
      .lt('created_at', cutoffIso)
      .limit(200);

    if (selectErr) {
      const summary: SupabaseCleanupSummary = {
        ranAt: new Date(nowMs).toISOString(),
        deletedOrders: 0,
        deletedSlips: 0,
        error: selectErr.message,
      };
      return summary;
    }

    const rows = Array.isArray(expiredRows)
      ? (expiredRows as Array<{ id: string | number; slip_url?: string | null }>)
      : [];

    if (rows.length > 0) {
      const slipPaths = Array.from(
        new Set(
          rows
            .map((r) => extractSlipStoragePathFromUrl(r.slip_url))
            .filter((p): p is string => Boolean(p))
        )
      );

      if (slipPaths.length > 0) {
        const { error: rmErr } = await supabase.storage
          .from(SUPABASE_SLIPS_BUCKET)
          .remove(slipPaths);
        if (!rmErr) {
          deletedSlips += slipPaths.length;
        }
      }

      const ids = rows.map((r) => r.id);
      const { error: delErr } = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .delete()
        .in('id', ids);

      if (delErr) {
        return {
          ranAt: new Date(nowMs).toISOString(),
          deletedOrders: 0,
          deletedSlips,
          error: delErr.message,
        };
      }
      deletedOrders = ids.length;
    }

    // 2) Sweep any orphaned files in "slips" bucket older than retentionDays
    const { data: bucketFiles } = await supabase.storage
      .from(SUPABASE_SLIPS_BUCKET)
      .list('', { limit: 200 });

    if (Array.isArray(bucketFiles) && bucketFiles.length > 0) {
      const expiredFiles = bucketFiles
        .filter((f) => {
          if (!f.name || f.id === null) return false;
          const ts = f.created_at ? new Date(f.created_at).getTime() : NaN;
          return Number.isFinite(ts) && ts < cutoffMs;
        })
        .map((f) => f.name);

      if (expiredFiles.length > 0) {
        const { error: sweepErr } = await supabase.storage
          .from(SUPABASE_SLIPS_BUCKET)
          .remove(expiredFiles);
        if (!sweepErr) {
          deletedSlips += expiredFiles.length;
        }
      }
    }

    const summary: SupabaseCleanupSummary = {
      ranAt: new Date(nowMs).toISOString(),
      deletedOrders,
      deletedSlips,
    };
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(CLEANUP_STORAGE_KEY, JSON.stringify(summary));
      } catch {
        // Ignore storage quota error
      }
    }
    return summary;
  } catch (err) {
    return {
      ranAt: new Date(nowMs).toISOString(),
      deletedOrders,
      deletedSlips,
      error: err instanceof Error ? err.message : 'Cleanup failed',
    };
  }
}

export function mapSupabaseOrderToQueueOrder(
  row: SupabaseOrderRow,
  queueNoFallback: number
): {
  queueNo: number;
  orderId: string;
  supabaseOrderId: string | number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    qty: number;
    stars: number;
    tasteNote?: string;
  }>;
  totalAmount: number;
  totalStars: number;
  deliveryType: 'ทานนี้' | 'กลับบ้าน' | 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง';
  tableNumber?: string;
  customerName?: string;
  dropPoint?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDistanceKm?: number;
  paymentMethod: 'เงินสด' | 'สแกน QR';
  slipImageUrl?: string;
  slip_url?: string;
  slipVerifyNote?: string;
  isTestMode?: boolean;
  accepted: boolean;
  createdAt: string;
  status: 'กำลังทำ' | 'เสร็จแล้ว';
} {
  const safeSlip = isSafeHttpUrl(row.slip_url) ? row.slip_url!.trim() : undefined;
  const totalAmount = Number(row.total_amount) || 0;
  const meta = extractOrderMetaFromSupabaseOrder(row);

  const itemsArr = Array.isArray(row.items)
    ? row.items.map((it, idx) => ({
        id: String(it.id || `sb_${row.id}_${idx}`),
        name: String(it.name || 'สินค้า'),
        price: Number(it.price) || 0,
        qty: Math.max(1, Number(it.qty) || 1),
        stars: 1,
        ...(it.tasteNote ? { tasteNote: String(it.tasteNote) } : {}),
      }))
    : [];

  const statusLower = String(row.status || 'pending').toLowerCase();
  const isCompletedOrCancelled =
    statusLower === 'completed' || statusLower === 'cancelled';
  const isAccepted = statusLower === 'paid' || statusLower === 'completed';

  const resolvedQueueNo =
    typeof meta.queueNo === 'number' && Number.isFinite(meta.queueNo)
      ? meta.queueNo
      : typeof row.id === 'number' && Number.isFinite(row.id)
        ? row.id
        : queueNoFallback;

  const resolvedDropPoint =
    meta.dropPoint ||
    (meta.deliveryType === 'ทานนี้' && meta.tableNumber ? `โต๊ะที่ ${meta.tableNumber}` : undefined);

  return {
    queueNo: resolvedQueueNo,
    orderId: meta.billId || `SB-${String(row.id)}`,
    supabaseOrderId: row.id,
    items: itemsArr,
    totalAmount,
    totalStars: Math.max(1, Math.floor(totalAmount / 20) || 1),
    deliveryType: meta.deliveryType || 'ทานนี้',
    ...(meta.tableNumber ? { tableNumber: meta.tableNumber } : {}),
    ...(meta.customerName ? { customerName: meta.customerName } : {}),
    ...(resolvedDropPoint ? { dropPoint: resolvedDropPoint } : {}),
    ...(typeof meta.deliveryLat === 'number' ? { deliveryLat: meta.deliveryLat } : {}),
    ...(typeof meta.deliveryLng === 'number' ? { deliveryLng: meta.deliveryLng } : {}),
    ...(typeof meta.deliveryDistanceKm === 'number'
      ? { deliveryDistanceKm: meta.deliveryDistanceKm }
      : {}),
    paymentMethod: row.payment_method === 'cash' ? 'เงินสด' : 'สแกน QR',
    slipImageUrl: safeSlip,
    slip_url: safeSlip,
    slipVerifyNote: meta.isTestMode
      ? '🧪 ออเดอร์ทดสอบระบบ (ไม่รวมในยอดขายจริง)'
      : safeSlip
        ? 'แนบสลิปบน Supabase แล้ว · โปรดตรวจสอบยอดเงินและเวลาโอนก่อนกดรับ'
        : undefined,
    ...(typeof meta.isTestMode === 'boolean' ? { isTestMode: meta.isTestMode } : {}),
    accepted: isAccepted,
    createdAt: row.created_at || new Date().toISOString(),
    status: isCompletedOrCancelled ? 'เสร็จแล้ว' : 'กำลังทำ',
  };
}

export const SUPABASE_SETUP_SQL = `-- 1) Create orders table
create table if not exists public.orders (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(10, 2) not null default 0,
  payment_method text not null default 'transfer',
  slip_url text,
  status text not null default 'pending'
);

alter table public.orders enable row level security;

create policy "Allow public insert orders"
  on public.orders for insert
  to anon, authenticated
  with check (true);

create policy "Allow public select orders"
  on public.orders for select
  to anon, authenticated
  using (true);

create policy "Allow public update orders"
  on public.orders for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Allow public delete orders"
  on public.orders for delete
  to anon, authenticated
  using (true);

-- 2) Create public storage bucket "slips"
insert into storage.buckets (id, name, public)
values ('slips', 'slips', true)
on conflict (id) do update set public = true;

create policy "Allow public upload slips"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'slips');

create policy "Allow public read slips"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'slips');

create policy "Allow public delete slips"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'slips');

-- 3) (Optional DB Cron) Auto-delete orders older than 7 days if pg_cron is enabled:
-- create extension if not exists pg_cron;
-- select cron.schedule('delete-orders-every-week', '0 3 * * *', $$delete from public.orders where created_at < now() - interval '7 days';$$);`;
