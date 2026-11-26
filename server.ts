import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 20000,
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface CallPeer {
  clientId: string;
  role: 'shop' | 'watcher' | 'observer';
  name: string;
  ws: WebSocket;
}

const callRooms = new Map<string, Map<string, CallPeer>>();

function sanitizeRoomId(raw: unknown): string {
  const cleaned = String(raw || 'KKP2027')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  return cleaned || 'KKP2027';
}

function getRoomPeersPayload(roomId: string) {
  const room = callRooms.get(roomId);
  if (!room) return [];
  return Array.from(room.values())
    .filter((p) => p.role === 'shop' || p.role === 'watcher')
    .map((p) => ({
      clientId: p.clientId,
      role: p.role,
      name: p.name,
    }));
}

function broadcastRoomState(roomId: string) {
  const room = callRooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify({
    type: 'room:state',
    roomId,
    peers: getRoomPeersPayload(roomId),
  });
  for (const peer of room.values()) {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

async function generateWithRetryAndFallback(params: {
  contents: Parameters<typeof ai.models.generateContent>[0]['contents'];
  config: NonNullable<Parameters<typeof ai.models.generateContent>[0]['config']>;
}) {
  // Try primary model with 15s cap, then fail over to flash-lite (minimal thinking) if busy/slow
  const attempts: Array<{ model: string; backoffMs: number; timeoutMs: number; stripThinking?: boolean }> = [
    { model: 'gemini-4-hydrogen', backoffMs: 300, timeoutMs: 15000 },
    { model: 'gemini-3.1-flash-lite', backoffMs: 0, timeoutMs: 15000, stripThinking: true },
  ];
  let lastError: unknown = null;

  for (const step of attempts) {
    try {
      const baseConfig = step.stripThinking
        ? (({ thinkingConfig: _tc, ...rest }) => rest)(params.config)
        : params.config;
      return await ai.models.generateContent({
        model: step.model,
        contents: params.contents,
        config: {
          ...baseConfig,
          abortSignal: AbortSignal.timeout(step.timeoutMs),
        },
      });
    } catch (err) {
      lastError = err;
      const errName = err instanceof Error ? err.name : '';
      const msg = `${errName} ${err instanceof Error ? err.message : String(err)}`.toLowerCase();
      console.warn(`[Gemini] ${step.model} attempt failed:`, msg.slice(0, 240));
      const isTransient =
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('504') ||
        msg.includes('404') ||
        msg.includes('not_found') ||
        msg.includes('abort') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('econnreset') ||
        msg.includes('fetch failed');
      if (!isTransient) {
        throw err;
      }
      if (step.backoffMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, step.backoffMs));
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/call/status', (req, res) => {
    const roomId = sanitizeRoomId(req.query.roomId);
    res.json({
      roomId,
      peers: getRoomPeersPayload(roomId),
    });
  });

  app.post('/api/verify-product-image', async (req, res) => {
    try {
      const { imageDataUrl, productName = '', lang = 'th' } = req.body as {
        imageDataUrl?: string;
        productName?: string;
        lang?: 'th' | 'en';
      };

      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        res.status(400).json({
          allowed: false,
          category: 'unrelated',
          reason:
            lang === 'en'
              ? 'Please upload a product photo before submitting.'
              : 'กรุณาแนบรูปภาพสินค้าก่อนบันทึกค่ะ',
        });
        return;
      }

      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({
          allowed: false,
          category: 'unrelated',
          reason:
            lang === 'en'
              ? 'Invalid image format. Please select a JPG or PNG image.'
              : 'รูปแบบไฟล์รูปภาพไม่ถูกต้อง กรุณาเลือกไฟล์รูปภาพใหม่ค่ะ',
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          allowed: false,
          category: 'unrelated',
          reason:
            lang === 'en'
              ? 'AI image verification is unavailable because GEMINI_API_KEY is missing in Settings > Secrets.'
              : 'ไม่สามารถตรวจคัดกรองรูปภาพด้วย AI ได้ (ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Settings > Secrets) ระบบจึงไม่อนุญาตให้บันทึกค่ะ',
        });
        return;
      }

      const [, mimeType, base64Data] = match;

      const response = await generateWithRetryAndFallback({
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Inspect this uploaded photo for a convenience store & food shop product catalog (declared product name: "${String(productName || '').slice(0, 80)}").
Rules (STRICT):
1. ALLOWED ("product"): ONLY clear photos of retail merchandise, packaged goods, bottled drinks, snacks, canned food, kitchen staples, household items, or plated food/drinks sold in a shop.
2. BLOCKED ("person"): Any photo featuring a human face, portrait, selfie, person holding/posing with something where a person is visible, body parts, or crowds.
3. BLOCKED ("animal"): Any photo featuring a dog, cat, bird, fish, or any animal/pet (even cute pets or next to a bag).
4. BLOCKED ("inappropriate"): Any explicit, violent, offensive, grotesque, or unsafe imagery.
5. BLOCKED ("unrelated"): Random scenery, screenshots, blank/blurry walls, memes, cartoons/drawings not on product packaging, cars, documents, or non-product clutter.

Respond strictly using the JSON schema. Return reasonTh in polite Thai explaining clearly why it was approved or blocked.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isProductImage: {
                type: Type.BOOLEAN,
                description:
                  'True ONLY when the image is clearly a physical retail product or food/drink item with NO humans, NO animals/pets, and NO inappropriate/unrelated content.',
              },
              detectedCategory: {
                type: Type.STRING,
                description: 'Must be one of: product, person, animal, inappropriate, unrelated',
              },
              reasonTh: {
                type: Type.STRING,
                description: 'Polite Thai explanation message for the user.',
              },
              reasonEn: {
                type: Type.STRING,
                description: 'Polite English explanation message for the user.',
              },
            },
            required: ['isProductImage', 'detectedCategory', 'reasonTh', 'reasonEn'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as {
        isProductImage?: boolean;
        detectedCategory?: string;
        reasonTh?: string;
        reasonEn?: string;
      };

      const cat = String(parsed.detectedCategory || 'unrelated').toLowerCase();
      const allowed = parsed.isProductImage === true && cat === 'product';

      if (!allowed) {
        let fallbackTh = 'รูปภาพนี้ไม่ใช่ภาพสินค้าที่ขายในร้าน ระบบจึงบล็อกและไม่บันทึกข้อมูลค่ะ';
        let fallbackEn = 'Only product photos are allowed. This image has been blocked.';
        if (cat === 'person') {
          fallbackTh = 'ตรวจพบรูปบุคคลในภาพ ระบบอนุญาตเฉพาะภาพสินค้าเท่านั้น จึงบล็อกการบันทึกค่ะ';
          fallbackEn = 'Human/person detected. Only product photos are allowed.';
        } else if (cat === 'animal') {
          fallbackTh = 'ตรวจพบรูปสัตว์เลี้ยงในภาพ ระบบอนุญาตเฉพาะภาพสินค้าเท่านั้น จึงบล็อกการบันทึกค่ะ';
          fallbackEn = 'Animal/pet detected. Only product photos are allowed.';
        } else if (cat === 'inappropriate') {
          fallbackTh = 'ตรวจพบรูปภาพที่ไม่เหมาะสม ระบบบล็อกและปฏิเสธการบันทึกทันทีค่ะ';
          fallbackEn = 'Inappropriate image detected and blocked.';
        }

        res.json({
          allowed: false,
          category: cat,
          reason: lang === 'en' ? parsed.reasonEn || fallbackEn : parsed.reasonTh || fallbackTh,
        });
        return;
      }

      res.json({
        allowed: true,
        category: 'product',
        reason:
          lang === 'en'
            ? parsed.reasonEn || 'Verified product photo.'
            : parsed.reasonTh || 'ผ่านการตรวจสอบว่าเป็นรูปภาพสินค้าเรียบร้อยค่ะ',
      });
    } catch (err) {
      console.error('Product image verification error:', err);
      const lang = (req.body as { lang?: string })?.lang === 'en' ? 'en' : 'th';
      res.status(500).json({
        allowed: false,
        category: 'unrelated',
        reason:
          lang === 'en'
            ? 'Image verification failed. Blocking upload to protect catalog.'
            : 'ไม่สามารถตรวจสอบรูปภาพด้วย AI ได้ ระบบจึงระงับการบันทึกไว้ก่อนค่ะ กรุณาลองใหม่อีกครั้ง',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  interface SyncClient {
    clientId: string;
    role: 'staff' | 'customer';
    ws: WebSocket;
  }

  interface SyncRoomState {
    clients: Map<string, SyncClient>;
    orders: Map<string, Record<string, unknown>>;
    receipts: Map<string, Record<string, unknown>>;
    sharedConfig: {
      settings?: Record<string, string>;
      menu?: unknown[];
      faqs?: unknown[];
      rewardOffers?: unknown[];
      updatedAt?: number;
    };
  }

  const syncRooms = new Map<string, SyncRoomState>();

  const getOrCreateSyncRoom = (roomId: string): SyncRoomState => {
    let room = syncRooms.get(roomId);
    if (!room) {
      room = {
        clients: new Map(),
        orders: new Map(),
        receipts: new Map(),
        sharedConfig: {},
      };
      syncRooms.set(roomId, room);
    }
    return room;
  };

  const broadcastSync = (room: SyncRoomState, payload: unknown, excludeClientId?: string) => {
    const raw = JSON.stringify(payload);
    for (const client of room.clients.values()) {
      if (excludeClientId && client.clientId === excludeClientId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  };

  const httpServer = http.createServer(app);
  const wssCall = new WebSocketServer({ noServer: true });
  const wssSync = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqPath = (request.url || '').split('?')[0];
    if (reqPath === '/ws/call') {
      wssCall.handleUpgrade(request, socket, head, (ws) => {
        wssCall.emit('connection', ws, request);
      });
    } else if (reqPath === '/ws/sync') {
      wssSync.handleUpgrade(request, socket, head, (ws) => {
        wssSync.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wssSync.on('connection', (ws) => {
    let joinedRoomId: string | null = null;
    let joinedClientId: string | null = null;

    const cleanupSyncClient = () => {
      if (!joinedRoomId || !joinedClientId) return;
      const room = syncRooms.get(joinedRoomId);
      if (room) {
        room.clients.delete(joinedClientId);
      }
      joinedRoomId = null;
      joinedClientId = null;
    };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          roomId?: string;
          clientId?: string;
          role?: 'staff' | 'customer';
          order?: Record<string, unknown>;
          orderId?: string;
          receipt?: Record<string, unknown>;
          billId?: string;
          exitedAt?: string;
          exitedBy?: string;
          patch?: Record<string, unknown>;
          settings?: Record<string, string>;
          menu?: unknown[];
          faqs?: unknown[];
          rewardOffers?: unknown[];
        };

        if (msg.type === 'sync:join') {
          const nextRoomId = sanitizeRoomId(msg.roomId);
          const nextClientId = String(msg.clientId || '').trim();
          const role = msg.role === 'staff' ? 'staff' : 'customer';
          if (!nextClientId) return;

          if (joinedRoomId && joinedRoomId !== nextRoomId) {
            cleanupSyncClient();
          }
          joinedRoomId = nextRoomId;
          joinedClientId = nextClientId;

          const room = getOrCreateSyncRoom(nextRoomId);
          room.clients.set(nextClientId, { clientId: nextClientId, role, ws });

          ws.send(
            JSON.stringify({
              type: 'sync:state',
              roomId: nextRoomId,
              orders: Array.from(room.orders.values()),
              receipts: Array.from(room.receipts.values()),
              sharedConfig: room.sharedConfig,
            })
          );
          return;
        }

        if (!joinedRoomId || !joinedClientId) return;
        const room = getOrCreateSyncRoom(joinedRoomId);

        if (msg.type === 'sync:order-create' && msg.order && typeof msg.order === 'object') {
          const orderId = String(msg.order.orderId || '').trim();
          if (!orderId) return;
          if (room.orders.has(orderId)) return; // Idempotent guard

          // Keep queueNo unique across concurrent devices
          const existingNos = Array.from(room.orders.values()).map((o) => Number(o.queueNo || 0));
          const maxNo = existingNos.length > 0 ? Math.max(...existingNos) : 0;
          const requestedNo = Number(msg.order.queueNo || 0);
          const resolvedQueueNo =
            requestedNo > 0 && !existingNos.includes(requestedNo) ? requestedNo : maxNo + 1;

          const storedOrder: Record<string, unknown> = {
            ...msg.order,
            orderId,
            queueNo: resolvedQueueNo,
          };
          room.orders.set(orderId, storedOrder);
          // Trim very old completed orders if > 150
          if (room.orders.size > 150) {
            const firstKey = room.orders.keys().next().value;
            if (firstKey) room.orders.delete(firstKey);
          }

          broadcastSync(room, {
            type: 'sync:order-created',
            roomId: joinedRoomId,
            fromClientId: joinedClientId,
            order: storedOrder,
          });
          return;
        }

        if (msg.type === 'sync:order-update' && msg.orderId && msg.patch) {
          const orderId = String(msg.orderId).trim();
          const existing = room.orders.get(orderId);
          if (existing) {
            const updated = { ...existing, ...msg.patch };
            room.orders.set(orderId, updated);
          }
          broadcastSync(
            room,
            {
              type: 'sync:order-updated',
              roomId: joinedRoomId,
              fromClientId: joinedClientId,
              orderId,
              patch: msg.patch,
            },
            joinedClientId
          );
          return;
        }

        if (msg.type === 'sync:config-update') {
          if (msg.settings && typeof msg.settings === 'object') {
            room.sharedConfig.settings = {
              ...(room.sharedConfig.settings || {}),
              ...msg.settings,
            };
          }
          if (Array.isArray(msg.menu)) {
            room.sharedConfig.menu = msg.menu;
          }
          if (Array.isArray(msg.faqs)) {
            room.sharedConfig.faqs = msg.faqs;
          }
          if (Array.isArray(msg.rewardOffers)) {
            room.sharedConfig.rewardOffers = msg.rewardOffers;
          }
          room.sharedConfig.updatedAt = Date.now();

          broadcastSync(
            room,
            {
              type: 'sync:config-updated',
              roomId: joinedRoomId,
              fromClientId: joinedClientId,
              settings: msg.settings,
              menu: msg.menu,
              faqs: msg.faqs,
              rewardOffers: msg.rewardOffers,
            },
            joinedClientId
          );
          return;
        }

        if (msg.type === 'sync:receipt-create' && msg.receipt && typeof msg.receipt === 'object') {
          const billId = String(msg.receipt.billId || '').trim().toUpperCase();
          if (!billId || room.receipts.has(billId)) return;
          const storedReceipt: Record<string, unknown> = {
            ...msg.receipt,
            billId,
          };
          room.receipts.set(billId, storedReceipt);
          if (room.receipts.size > 300) {
            const firstKey = room.receipts.keys().next().value;
            if (firstKey) room.receipts.delete(firstKey);
          }
          broadcastSync(
            room,
            {
              type: 'sync:receipt-created',
              roomId: joinedRoomId,
              fromClientId: joinedClientId,
              receipt: storedReceipt,
            },
            joinedClientId
          );
          return;
        }

        if (msg.type === 'sync:receipt-mark-exited' && msg.billId) {
          const billId = String(msg.billId).trim().toUpperCase();
          const existing = room.receipts.get(billId);
          const exitedAt = String(msg.exitedAt || new Date().toISOString());
          const exitedBy = String(msg.exitedBy || 'พนักงาน').trim();
          if (existing && !existing.exitedAt) {
            room.receipts.set(billId, {
              ...existing,
              exitedAt,
              exitedBy,
            });
          }
          broadcastSync(room, {
            type: 'sync:receipt-updated',
            roomId: joinedRoomId,
            fromClientId: joinedClientId,
            billId,
            patch: {
              exitedAt: (existing?.exitedAt as string | undefined) || exitedAt,
              exitedBy: (existing?.exitedBy as string | undefined) || exitedBy,
            },
          });
        }
      } catch {
        // Ignore malformed sync payloads
      }
    });

    ws.on('close', cleanupSyncClient);
    ws.on('error', cleanupSyncClient);
  });

  wssCall.on('connection', (ws) => {
    let joinedRoomId: string | null = null;
    let joinedClientId: string | null = null;

    const cleanupPeer = () => {
      if (!joinedRoomId || !joinedClientId) return;
      const room = callRooms.get(joinedRoomId);
      if (room) {
        room.delete(joinedClientId);
        if (room.size === 0) {
          callRooms.delete(joinedRoomId);
        } else {
          broadcastRoomState(joinedRoomId);
        }
      }
      joinedRoomId = null;
      joinedClientId = null;
    };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          roomId?: string;
          clientId?: string;
          role?: 'shop' | 'watcher' | 'observer';
          name?: string;
          targetId?: string;
          [key: string]: unknown;
        };

        if (msg.type === 'room:join') {
          const nextRoomId = sanitizeRoomId(msg.roomId);
          const nextClientId = String(msg.clientId || '').trim();
          const role =
            msg.role === 'shop' || msg.role === 'watcher' ? msg.role : 'observer';
          const name = String(msg.name || 'พนักงาน').trim().slice(0, 60);
          if (!nextClientId) return;

          if (joinedRoomId && joinedRoomId !== nextRoomId) {
            cleanupPeer();
          }

          joinedRoomId = nextRoomId;
          joinedClientId = nextClientId;

          let room = callRooms.get(nextRoomId);
          if (!room) {
            room = new Map();
            callRooms.set(nextRoomId, room);
          }

          // Replace stale entry for same role if same clientId or if another shop/watcher takes over gracefully
          room.set(nextClientId, { clientId: nextClientId, role, name, ws });
          broadcastRoomState(nextRoomId);
          return;
        }

        if (msg.type === 'room:leave') {
          cleanupPeer();
          return;
        }

        if (!joinedRoomId || !joinedClientId) return;
        const room = callRooms.get(joinedRoomId);
        if (!room) return;

        // Relay signaling and shop counter events to targetId or non-observer peers
        if (
          msg.type === 'rtc:offer' ||
          msg.type === 'rtc:answer' ||
          msg.type === 'rtc:ice' ||
          msg.type === 'call:quick-say' ||
          msg.type === 'call:show-qr'
        ) {
          const outbound = JSON.stringify({
            ...msg,
            fromId: joinedClientId,
            fromName: room.get(joinedClientId)?.name || '',
          });

          if (msg.targetId) {
            const targetPeer = room.get(String(msg.targetId));
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(outbound);
            }
          } else {
            for (const peer of room.values()) {
              if (
                peer.clientId !== joinedClientId &&
                peer.role !== 'observer' &&
                peer.ws.readyState === WebSocket.OPEN
              ) {
                peer.ws.send(outbound);
              }
            }
          }
        }
      } catch {
        // Ignore malformed payloads
      }
    });

    ws.on('close', cleanupPeer);
    ws.on('error', cleanupPeer);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
