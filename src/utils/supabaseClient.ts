import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://kadhcobomdqiobrntlv.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_WvGv3CDfPK9dyoLJCu5Srw__i0180Xv';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_SUPABASE_URL?.trim()) ||
  DEFAULT_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_SLIPS_BUCKET = 'slips';
export const SUPABASE_ORDERS_TABLE = 'orders';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface SupabaseOrderItem {
  id?: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
  tasteNote?: string;
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

  const sanitizedItems: SupabaseOrderItem[] = Array.isArray(input.items)
    ? input.items.map((item) => {
        const qty = Math.max(1, Math.round(Number(item.qty) || 1));
        const price = Math.max(0, Number(item.price) || 0);
        return {
          ...(item.id ? { id: String(item.id) } : {}),
          name: String(item.name || 'สินค้า'),
          qty,
          price,
          subtotal: Number((price * qty).toFixed(2)),
          ...(item.tasteNote ? { tasteNote: String(item.tasteNote) } : {}),
        };
      })
    : [];

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
  using (bucket_id = 'slips');`;
