import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

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

  app.post('/api/ai-buddy', async (req, res) => {
    try {
      const { message, history = [], staffName = 'คุณแม่', lang = 'th' } = req.body as {
        message?: string;
        history?: Array<{ role: 'user' | 'model'; text: string }>;
        staffName?: string;
        lang?: 'th' | 'en';
      };

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({
          error: lang === 'en' ? 'Please send a message to chat.' : 'กรุณาส่งข้อความที่ต้องการคุยค่ะ',
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error:
            lang === 'en'
              ? 'GEMINI_API_KEY is not configured in Settings > Secrets.'
              : 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Settings > Secrets ของระบบค่ะ',
        });
        return;
      }

      const conversationContext = history
        .slice(-6)
        .map((m) => `${m.role === 'user' ? staffName : 'Bear Helper'}: ${m.text}`)
        .join('\n');

      const prompt = conversationContext
        ? `${conversationContext}\n${staffName}: ${message.trim()}`
        : message.trim();

      const systemInstruction =
        lang === 'en'
          ? `You are "Little Bear Helper" at the shop "kookkikpaplern". You are a warm, cheerful, gentle grandchild/helper chatting with "${staffName}" while tending the shop.
Guidelines:
- Speak polite, warm, friendly English suitable for reading aloud naturally.
- Keep answers concise (2-4 short sentences) so text-to-speech sounds pleasant and clear.
- Avoid markdown formatting like ** and do NOT use any emojis or pictographs in your reply (plain text only).
- Share positive encouragement, light cheerful stories, or gentle humor.`
          : `คุณคือ "น้องหมีผู้ช่วย" ของร้าน "กุ๊กกิ๊กพาเพลิน (kookkikpaplern)" เป็นหลานสาว/หลานชายที่น่ารัก อบอุ่น อ่อนโยน และอารมณ์ดี คอยคุยแก้เหงาและเป็นกำลังใจให้ "${staffName}" (เช่น คุณแม่ หรือพี่สาว) ระหว่างเฝ้าร้านขายของ
แนวทางการตอบ:
- พูดภาษาไทยสุภาพ อบอุ่น เป็นกันเอง เหมือนลูกหลานคุยกับคุณแม่ (ลงท้าย ค่ะ/นะคะ อย่างเป็นธรรมชาติ)
- ตอบกระชับ อ่านง่าย ความยาวประมาณ 2-4 ประโยค เพื่อให้อ่านออกเสียงฟังสบายไม่ยาวเกินไป
- หลีกเลี่ยงการใช้สัญลักษณ์โค้ด มาร์กดาวน์ตัวหนา ** และห้ามใช้อิโมจิหรือสัญลักษณ์รูปภาพใดๆ ในคำตอบโดยเด็ดขาด (ตอบเป็นข้อความตัวอักษรล้วน)
- ให้กำลังใจเชิงบวก เล่าเรื่องน่ารักๆ หรือมุกอารมณ์ดีเบาๆ ที่เหมาะกับผู้ใหญ่`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction,
        },
      });

      const rawReply = response.text?.trim() || '';
      const reply = rawReply
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      if (!reply) {
        res.status(502).json({ error: 'ผู้ช่วยไม่สามารถตอบกลับได้ในขณะนี้ ลองใหม่อีกครั้งนะคะ' });
        return;
      }

      res.json({ reply });
    } catch (err) {
      console.error('AI Buddy error:', err);
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อผู้ช่วย AI';
      res.status(500).json({ error: errMsg });
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

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/call' });

  wss.on('connection', (ws) => {
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
