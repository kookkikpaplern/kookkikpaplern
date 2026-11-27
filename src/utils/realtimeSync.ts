import { useCallback, useEffect, useRef } from 'react';
import { FaqItem, MenuItem, RewardOffer } from '../config/shopConfig';
import { CustomerQueueOrder, ReceiptSlipRecord } from './sheetsSync';

export interface SharedShopConfigPayload {
  settings?: Record<string, string>;
  menu?: MenuItem[];
  faqs?: FaqItem[];
  rewardOffers?: RewardOffer[];
  updatedAt?: number;
}

interface UseRealtimeShopSyncOptions {
  roomId: string;
  role: 'staff' | 'customer';
  enabled?: boolean;
  onSyncState: (payload: {
    orders: CustomerQueueOrder[];
    receipts: ReceiptSlipRecord[];
    sharedConfig?: SharedShopConfigPayload;
  }) => void;
  onRemoteOrderCreated: (order: CustomerQueueOrder, fromRemote: boolean) => void;
  onRemoteOrderUpdated: (
    orderId: string,
    patch: Partial<Pick<CustomerQueueOrder, 'accepted' | 'status' | 'slip_url' | 'slipImageUrl' | 'supabaseOrderId'>>
  ) => void;
  onRemoteConfigUpdated: (payload: SharedShopConfigPayload) => void;
  onRemoteReceiptCreated?: (receipt: ReceiptSlipRecord) => void;
  onRemoteReceiptUpdated?: (
    billId: string,
    patch: Partial<Pick<ReceiptSlipRecord, 'exitedAt' | 'exitedBy'>>
  ) => void;
}

function getOrCreateTabClientId(): string {
  try {
    const key = 'kkp_sync_tab_client_id';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
}

export function useRealtimeShopSync({
  roomId,
  role,
  enabled = true,
  onSyncState,
  onRemoteOrderCreated,
  onRemoteOrderUpdated,
  onRemoteConfigUpdated,
  onRemoteReceiptCreated,
  onRemoteReceiptUpdated,
}: UseRealtimeShopSyncOptions) {
  const clientIdRef = useRef<string>(getOrCreateTabClientId());
  const wsRef = useRef<WebSocket | null>(null);
  const pendingOutboxRef = useRef<string[]>([]);

  const callbacksRef = useRef({
    onSyncState,
    onRemoteOrderCreated,
    onRemoteOrderUpdated,
    onRemoteConfigUpdated,
    onRemoteReceiptCreated,
    onRemoteReceiptUpdated,
  });
  callbacksRef.current = {
    onSyncState,
    onRemoteOrderCreated,
    onRemoteOrderUpdated,
    onRemoteConfigUpdated,
    onRemoteReceiptCreated,
    onRemoteReceiptUpdated,
  };

  useEffect(() => {
    if (!enabled || !roomId.trim()) return;

    let closed = false;
    let reconnectDelay = 1000;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (closed) return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws/sync`);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectDelay = 1000;
          ws.send(
            JSON.stringify({
              type: 'sync:join',
              roomId,
              clientId: clientIdRef.current,
              role,
            })
          );
          while (pendingOutboxRef.current.length > 0 && ws.readyState === WebSocket.OPEN) {
            const msg = pendingOutboxRef.current.shift();
            if (msg) ws.send(msg);
          }
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(String(ev.data)) as {
              type?: string;
              fromClientId?: string;
              orders?: CustomerQueueOrder[];
              receipts?: ReceiptSlipRecord[];
              sharedConfig?: SharedShopConfigPayload;
              order?: CustomerQueueOrder;
              orderId?: string;
              receipt?: ReceiptSlipRecord;
              billId?: string;
              patch?: Record<string, unknown>;
              settings?: Record<string, string>;
              menu?: MenuItem[];
              faqs?: FaqItem[];
              rewardOffers?: RewardOffer[];
            };

            if (data.type === 'sync:state') {
              callbacksRef.current.onSyncState({
                orders: Array.isArray(data.orders) ? data.orders : [],
                receipts: Array.isArray(data.receipts) ? data.receipts : [],
                sharedConfig: data.sharedConfig,
              });
              return;
            }

            if (data.type === 'sync:order-created' && data.order) {
              const fromRemote = data.fromClientId !== clientIdRef.current;
              callbacksRef.current.onRemoteOrderCreated(data.order, fromRemote);
              return;
            }

            if (data.type === 'sync:order-updated' && data.orderId && data.patch) {
              callbacksRef.current.onRemoteOrderUpdated(
                data.orderId,
                data.patch as Partial<
                  Pick<CustomerQueueOrder, 'accepted' | 'status' | 'slip_url' | 'slipImageUrl' | 'supabaseOrderId'>
                >
              );
              return;
            }

            if (data.type === 'sync:receipt-created' && data.receipt) {
              callbacksRef.current.onRemoteReceiptCreated?.(data.receipt);
              return;
            }

            if (data.type === 'sync:receipt-updated' && data.billId && data.patch) {
              callbacksRef.current.onRemoteReceiptUpdated?.(
                data.billId,
                data.patch as Partial<Pick<ReceiptSlipRecord, 'exitedAt' | 'exitedBy'>>
              );
              return;
            }

            if (data.type === 'sync:config-updated') {
              callbacksRef.current.onRemoteConfigUpdated({
                settings: data.settings,
                menu: data.menu,
                faqs: data.faqs,
                rewardOffers: data.rewardOffers,
              });
            }
          } catch {
            // Ignore malformed sync message
          }
        };

        ws.onclose = () => {
          if (wsRef.current === ws) wsRef.current = null;
          if (!closed) {
            reconnectTimer = window.setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
          }
        };

        ws.onerror = () => {
          try {
            ws.close();
          } catch {
            // Ignore
          }
        };
      } catch {
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
        }
      }
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }
    };
  }, [roomId, role, enabled]);

  const sendRaw = useCallback((payload: unknown) => {
    const raw = JSON.stringify(payload);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    } else {
      pendingOutboxRef.current = [...pendingOutboxRef.current.slice(-24), raw];
    }
  }, []);

  const broadcastOrderCreated = useCallback(
    (order: CustomerQueueOrder) => {
      sendRaw({
        type: 'sync:order-create',
        order,
      });
    },
    [sendRaw]
  );

  const broadcastOrderUpdated = useCallback(
    (
      orderId: string,
      patch: Partial<Pick<CustomerQueueOrder, 'accepted' | 'status' | 'slip_url' | 'slipImageUrl' | 'supabaseOrderId'>>
    ) => {
      sendRaw({
        type: 'sync:order-update',
        orderId,
        patch,
      });
    },
    [sendRaw]
  );

  const broadcastConfigUpdated = useCallback(
    (payload: SharedShopConfigPayload) => {
      sendRaw({
        type: 'sync:config-update',
        ...payload,
      });
    },
    [sendRaw]
  );

  const broadcastReceiptCreated = useCallback(
    (receipt: ReceiptSlipRecord) => {
      sendRaw({
        type: 'sync:receipt-create',
        receipt,
      });
    },
    [sendRaw]
  );

  const broadcastReceiptExited = useCallback(
    (billId: string, exitedAt: string, exitedBy: string) => {
      sendRaw({
        type: 'sync:receipt-mark-exited',
        billId,
        exitedAt,
        exitedBy,
      });
    },
    [sendRaw]
  );

  return {
    broadcastOrderCreated,
    broadcastOrderUpdated,
    broadcastConfigUpdated,
    broadcastReceiptCreated,
    broadcastReceiptExited,
  };
}
