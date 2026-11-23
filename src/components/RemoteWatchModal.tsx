import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  QrCode,
  RefreshCw,
  Send,
  Store,
  UserCheck,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { translateStaffName, useLang } from '../config/i18n';
import { generatePromptPayQrDataUrl } from '../utils/promptpay';
import { playSoftClick, speakMessage } from '../utils/sound';

export interface CallPeerSummary {
  clientId: string;
  role: 'shop' | 'watcher';
  name: string;
}

interface RemoteWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  staffName: string;
  shopNameTh: string;
  promptPayId: string;
  promptPayAccountName: string;
  peersInRoom: CallPeerSummary[];
}

type ActiveRole = 'shop' | 'watcher' | null;

const FACETIME_STORAGE_KEY = 'kkp_facetime_contact_v1';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const RemoteWatchModal: React.FC<RemoteWatchModalProps> = ({
  isOpen,
  onClose,
  roomId,
  staffName,
  shopNameTh,
  promptPayId,
  promptPayAccountName,
  peersInRoom,
}) => {
  const { lang, tx } = useLang();
  const displayStaff = translateStaffName(staffName, lang);

  const [activeRole, setActiveRole] = useState<ActiveRole>(null);
  const [roomPeers, setRoomPeers] = useState<CallPeerSummary[]>(peersInRoom);
  const [wsConnected, setWsConnected] = useState(false);
  const [rtcState, setRtcState] = useState<'idle' | 'waiting' | 'connecting' | 'connected'>('idle');
  const [mediaNotice, setMediaNotice] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Remote watcher -> Shop counter overlays
  const [quickBanner, setQuickBanner] = useState<string>('');
  const [customSayText, setCustomSayText] = useState<string>('');
  const [qrPushAmountInput, setQrPushAmountInput] = useState<string>('50');
  const [shopQrAmount, setShopQrAmount] = useState<number>(0);
  const [shopQrDataUrl, setShopQrDataUrl] = useState<string>('');

  // Optional Apple FaceTime shortcut
  const [facetimeContact, setFacetimeContact] = useState<string>(
    () => localStorage.getItem(FACETIME_STORAGE_KEY) || ''
  );
  const [copiedLink, setCopiedLink] = useState(false);

  const clientIdRef = useRef<string>(
    `kkp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  );
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const targetPeerIdRef = useRef<string | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!activeRole) {
      setRoomPeers(peersInRoom);
    }
  }, [peersInRoom, activeRole]);

  useEffect(() => {
    if (shopQrAmount > 0 && promptPayId) {
      generatePromptPayQrDataUrl(promptPayId, shopQrAmount)
        .then(setShopQrDataUrl)
        .catch(() => setShopQrDataUrl(''));
    } else {
      setShopQrDataUrl('');
    }
  }, [shopQrAmount, promptPayId]);

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    targetPeerIdRef.current = null;
    pendingIceRef.current = [];
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const leaveCall = useCallback(() => {
    closePeerConnection();
    stopLocalMedia();
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
        }
        wsRef.current.close();
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }
    setActiveRole(null);
    setWsConnected(false);
    setRtcState('idle');
    setMediaNotice('');
    setQuickBanner('');
    setShopQrAmount(0);
    setMicMuted(false);
    setCamOff(false);
  }, [closePeerConnection, stopLocalMedia]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      leaveCall();
    };
  }, [leaveCall]);

  const acquireMedia = useCallback(
    async (preferredFacing: 'user' | 'environment'): Promise<MediaStream | null> => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMediaNotice(
          tx(
            'เบราว์เซอร์นี้ไม่รองรับกล้อง/ไมโครโฟน ระบบจะเชื่อมต่อแบบรับภาพและเสียงแทนค่ะ',
            'Camera/mic is unavailable in this browser; connecting in receive-only mode.'
          )
        );
        return null;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: preferredFacing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        setMediaNotice('');
        return stream;
      } catch {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          setMediaNotice(
            tx(
              'ไม่พบกล้องหรือไม่ได้อนุญาตกล้อง ระบบเปิดโหมดคุยด้วยเสียงแทนค่ะ',
              'Camera unavailable or blocked — connected with voice audio.'
            )
          );
          setCamOff(true);
          return audioOnly;
        } catch {
          setMediaNotice(
            tx(
              'ไม่ได้เปิดสิทธิ์กล้อง/ไมโครโฟน (สามารถรับชมและฟังเสียงอีกฝั่งได้ค่ะ)',
              'Camera & mic permissions not granted (you can still watch and listen).'
            )
          );
          setCamOff(true);
          setMicMuted(true);
          return null;
        }
      }
    },
    [tx]
  );

  const createPeerConnection = useCallback((targetId: string) => {
    closePeerConnection();
    targetPeerIdRef.current = targetId;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    } else {
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    const inbound = new MediaStream();
    remoteStreamRef.current = inbound;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = inbound;
    }

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!inbound.getTracks().some((t) => t.id === track.id)) {
          inbound.addTrack(track);
        }
      });
      if (!event.streams[0] && event.track) {
        inbound.addTrack(event.track);
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = inbound;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'rtc:ice',
            targetId,
            candidate: event.candidate,
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setRtcState('connected');
      } else if (state === 'connecting' || state === 'new') {
        setRtcState('connecting');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        setRtcState('waiting');
      }
    };

    return pc;
  }, [closePeerConnection]);

  const flushPendingIce = async (pc: RTCPeerConnection) => {
    const queued = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // Ignore stale ICE
      }
    }
  };

  const startCallSession = async (role: 'shop' | 'watcher') => {
    playSoftClick();
    setActiveRole(role);
    setRtcState('waiting');
    setMediaNotice('');

    const stream = await acquireMedia(facingMode);
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/call`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(
        JSON.stringify({
          type: 'room:join',
          roomId,
          clientId: clientIdRef.current,
          role,
          name: displayStaff,
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          peers?: CallPeerSummary[];
          fromId?: string;
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
          text?: string;
          amount?: number;
        };

        if (msg.type === 'room:state' && Array.isArray(msg.peers)) {
          setRoomPeers(msg.peers);
          const counterpartRole = role === 'watcher' ? 'shop' : 'watcher';
          const counterpart = msg.peers.find(
            (p) => p.role === counterpartRole && p.clientId !== clientIdRef.current
          );

          if (!counterpart) {
            if (targetPeerIdRef.current) {
              closePeerConnection();
            }
            setRtcState('waiting');
            return;
          }

          // Deterministic initiator: 'watcher' always sends the WebRTC offer to 'shop'
          if (role === 'watcher' && targetPeerIdRef.current !== counterpart.clientId) {
            setRtcState('connecting');
            const pc = createPeerConnection(counterpart.clientId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'rtc:offer',
                  targetId: counterpart.clientId,
                  sdp: offer,
                })
              );
            }
          }
          return;
        }

        if (msg.type === 'rtc:offer' && msg.fromId && msg.sdp) {
          setRtcState('connecting');
          const pc = createPeerConnection(msg.fromId);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await flushPendingIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'rtc:answer',
                targetId: msg.fromId,
                sdp: answer,
              })
            );
          }
          return;
        }

        if (msg.type === 'rtc:answer' && msg.sdp && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await flushPendingIce(pcRef.current);
          return;
        }

        if (msg.type === 'rtc:ice' && msg.candidate) {
          if (pcRef.current && pcRef.current.remoteDescription) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch {
              // Ignore invalid ICE
            }
          } else {
            pendingIceRef.current.push(msg.candidate);
          }
          return;
        }

        if (msg.type === 'call:quick-say' && msg.text) {
          setQuickBanner(msg.text);
          if (role === 'shop') {
            speakMessage(msg.text, lang);
          }
          return;
        }

        if (msg.type === 'call:show-qr') {
          setShopQrAmount(Number(msg.amount || 0));
        }
      } catch {
        // Ignore malformed message
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };
  };

  const toggleMic = () => {
    playSoftClick();
    const next = !micMuted;
    setMicMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const toggleCam = () => {
    playSoftClick();
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const switchCamera = async () => {
    playSoftClick();
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (!navigator.mediaDevices?.getUserMedia) return;

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      const oldStream = localStreamRef.current;
      localStreamRef.current = nextStream;
      nextStream.getAudioTracks().forEach((t) => {
        t.enabled = !micMuted;
      });
      nextStream.getVideoTracks().forEach((t) => {
        t.enabled = !camOff;
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = nextStream;
      }

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const newVideo = nextStream.getVideoTracks()[0];
        const newAudio = nextStream.getAudioTracks()[0];
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        const audioSender = senders.find((s) => s.track?.kind === 'audio');
        if (videoSender && newVideo) await videoSender.replaceTrack(newVideo);
        if (audioSender && newAudio) await audioSender.replaceTrack(newAudio);
      }

      oldStream?.getTracks().forEach((t) => t.stop());
    } catch {
      // Keep current camera if switch fails
    }
  };

  const sendQuickSay = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    playSoftClick();
    setQuickBanner(trimmed);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'call:quick-say', text: trimmed }));
    }
  };

  const sendQrToShop = (amount: number) => {
    playSoftClick();
    setShopQrAmount(amount);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'call:show-qr', amount }));
    }
  };

  // Re-attach streams whenever video refs mount
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [activeRole, rtcState]);

  if (!isOpen) return null;

  const shopPeer = roomPeers.find((p) => p.role === 'shop');
  const watcherPeer = roomPeers.find((p) => p.role === 'watcher');
  const counterpart =
    activeRole === 'shop'
      ? watcherPeer
      : activeRole === 'watcher'
        ? shopPeer
        : undefined;

  const shareUrl = window.location.origin;
  const cleanFacetime = facetimeContact.trim();
  const isFacetimeUrl = cleanFacetime.startsWith('http://') || cleanFacetime.startsWith('https://');
  const facetimeHref = cleanFacetime
    ? isFacetimeUrl
      ? cleanFacetime
      : `facetime:${cleanFacetime}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div
        className="w-full max-w-4xl rounded-3xl border-2 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--accent-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-b shrink-0"
          style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--border-soft)' }}
        >
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2" style={{ color: 'var(--accent-text)' }}>
              <Video className="w-5 h-5 shrink-0" />
              {tx('วิดีโอคอลเฝ้าร้านแทนแม่', 'Remote Shop Video Call')}
            </h2>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {tx(
                `${shopNameTh} · รหัสห้อง ${roomId} · เชื่อมต่อภาพและเสียงสดกับลูกค้าที่หน้าร้าน`,
                `${shopNameTh} · Room ${roomId} · Live 2-way audio & video with shop counter`
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeRole) leaveCall();
              onClose();
            }}
            className="w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
            aria-label={tx('ปิดหน้าต่างวิดีโอคอล', 'Close video call')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {!activeRole ? (
            <>
              {/* Live Room Status Banner */}
              <div
                className="rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                style={{
                  backgroundColor: shopPeer ? '#FFF7ED' : 'var(--bg-canvas)',
                  borderColor: shopPeer ? '#FDBA74' : 'var(--border-soft)',
                  color: shopPeer ? '#9A3412' : 'var(--text-main)',
                }}
              >
                <span className="font-bold">
                  {shopPeer
                    ? tx(
                        `เครื่องหน้าร้าน (${shopPeer.name}) กำลังเปิดรอคนช่วยเฝ้าร้านอยู่ค่ะ`,
                        `Shop counter (${shopPeer.name}) is open and waiting for family!`
                      )
                    : tx(
                        'เลือกบทบาทของเครื่องนี้ด้านล่างเพื่อเริ่มเชื่อมต่อภาพและเสียงสด',
                        'Choose this device’s role below to start live video & audio'
                      )}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-white/80">
                  {tx(`ห้อง ${roomId}`, `Room ${roomId}`)}
                </span>
              </div>

              {/* Two Role Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Role A: Mom's Shop Counter Tablet */}
                <div
                  className="rounded-3xl border-2 p-5 flex flex-col justify-between gap-4"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--accent-border)',
                  }}
                >
                  <div className="space-y-2">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      <Store className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                      {tx('1. เครื่องที่ร้าน (คุณแม่ฝากร้านชั่วคราว)', '1. Shop Counter Device (Mom Stepping Away)')}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'วางเครื่องไว้หน้าเคาน์เตอร์ กดปุ่มนี้ก่อนไปเข้าห้องน้ำ เมื่อลูกสาวหรือคนในครอบครัวกดเข้ามา หน้าจอจะรับสายอัตโนมัติให้คุยกับลูกค้าแทนทันทีค่ะ',
                        'Leave this device at the counter before stepping away. When a family member connects, it answers automatically so they can greet customers!'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startCallSession('shop')}
                    className="w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <Camera className="w-5 h-5" />
                    {tx('เปิดเคาน์เตอร์รอให้ลูกเฝ้าร้าน', 'Open Shop Counter Standby')}
                  </button>
                </div>

                {/* Role B: Daughter Watching Remotely */}
                <div
                  className="rounded-3xl border-2 p-5 flex flex-col justify-between gap-4"
                  style={{
                    backgroundColor: 'var(--pastel-blue)',
                    borderColor: shopPeer ? '#EA580C' : 'var(--border-soft)',
                  }}
                >
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-xs text-sky-700">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--pastel-blue-text)' }}>
                      {tx('2. เครื่องลูก / ครอบครัว (เฝ้าร้านแทนแม่)', '2. Family Watcher (Cover for Mom)')}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--pastel-blue-text)' }}>
                      {tx(
                        'เปิดเว็บนี้บนมือถือหรือคอมจากที่บ้าน กดปุ่มนี้เพื่อเห็นหน้าเคาน์เตอร์ร้านสดๆ พูดคุยกับลูกค้า และส่ง QR พร้อมเพย์ให้ลูกค้าสแกนจ่ายแทนแม่ได้ทันทีค่ะ',
                        'Open this app on your phone or laptop, tap below to see the shop counter live, talk with customers, and push PromptPay QR for checkout.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startCallSession('watcher')}
                    className="w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
                    style={{ backgroundColor: shopPeer ? '#EA580C' : '#0284C7' }}
                  >
                    <Phone className="w-5 h-5" />
                    {shopPeer
                      ? tx('เข้าเฝ้าร้านแทนแม่ตอนนี้ (แม่รอสายอยู่)', 'Join Shop Counter Now (Mom Waiting)')
                      : tx('เข้าเฝ้าร้านแทนแม่ (เชื่อมต่อสด)', 'Join & Watch Shop Live')}
                  </button>
                </div>
              </div>

              {/* Optional Apple FaceTime + Share Link Helper */}
              <div
                className="rounded-2xl border p-4 space-y-3"
                style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                      {tx(
                        'วิธีใช้ให้ลูกเปิดจากมือถืออีกเครื่อง + ทางเลือก Apple FaceTime',
                        'How to Connect Another Phone + Optional Apple FaceTime'
                      )}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'วิดีโอคอลในระบบ POS ด้านบนใช้ได้ทั้ง iPhone, Android และคอมพิวเตอร์ทุกรุ่น ไม่ต้องโหลดแอปเพิ่มค่ะ',
                        'Built-in POS video call works across iPhone, Android, and desktop with zero extra apps.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      playSoftClick();
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2200);
                      } catch {
                        // Ignore clipboard error
                      }
                    }}
                    className="px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? tx('คัดลอกลิงก์แล้ว', 'Copied Link') : tx('คัดลอกลิงก์ร้านส่งให้ครอบครัว', 'Copy Shop Link')}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={facetimeContact}
                    onChange={(e) => {
                      setFacetimeContact(e.target.value);
                      localStorage.setItem(FACETIME_STORAGE_KEY, e.target.value);
                    }}
                    placeholder={tx(
                      'เสริม (เฉพาะ iPhone/iPad): เบอร์โทร หรือ Apple ID สำหรับ FaceTime',
                      'Optional (Apple only): FaceTime phone, email, or link'
                    )}
                    className="flex-1 h-11 px-3.5 rounded-xl border text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  {facetimeHref && (
                    <a
                      href={facetimeHref}
                      target="_top"
                      className="h-11 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Video className="w-4 h-4" />
                      {tx('โทร Apple FaceTime', 'Call via FaceTime')}
                    </a>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ACTIVE VIDEO CALL WORKSPACE */
            <div className="space-y-4">
              {/* Connection Status Header */}
              <div
                className="rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
                style={{
                  backgroundColor:
                    rtcState === 'connected'
                      ? '#DCFCE7'
                      : rtcState === 'connecting'
                        ? '#FEF3C7'
                        : 'var(--bg-canvas)',
                  borderColor: 'var(--border-soft)',
                  color:
                    rtcState === 'connected'
                      ? '#166534'
                      : rtcState === 'connecting'
                        ? '#92400E'
                        : 'var(--text-main)',
                }}
              >
                <span className="font-bold flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      rtcState === 'connected'
                        ? 'bg-emerald-600'
                        : rtcState === 'connecting'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-stone-400 animate-pulse'
                    }`}
                  />
                  {activeRole === 'shop'
                    ? counterpart
                      ? tx(
                          `เชื่อมต่อกับ "${counterpart.name}" แล้ว · ลูกค้าคุยผ่านหน้าจอนี้ได้เลยค่ะ`,
                          `Connected with "${counterpart.name}" · Customers can talk on this screen`
                        )
                      : tx(
                          `เปิดเคาน์เตอร์รอสาย (${wsConnected ? 'ออนไลน์' : 'กำลังเชื่อมเซิร์ฟเวอร์'}) · คุณแม่ไปพักได้เลยค่ะ`,
                          `Counter standby (${wsConnected ? 'Online' : 'Connecting'}) · Ready for family to join`
                        )
                    : counterpart
                      ? tx(
                          `กำลังเฝ้าร้านแทนคุณแม่ · เชื่อมต่อ "${counterpart.name}" แล้ว`,
                          `Watching shop for Mom · Connected with "${counterpart.name}"`
                        )
                      : tx(
                          'กำลังรอเครื่องที่ร้านเปิดโหมด "เปิดเคาน์เตอร์รอให้ลูกเฝ้าร้าน"...',
                          'Waiting for Shop Counter device to enter standby...'
                        )}
                </span>
                <span className="font-num font-semibold opacity-80">
                  {tx(`ห้อง ${roomId}`, `Room ${roomId}`)}
                </span>
              </div>

              {mediaNotice && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
                  {mediaNotice}
                </div>
              )}

              {/* Video Area + Optional Remote PromptPay QR on Shop Screen */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <div
                  className={`${
                    activeRole === 'shop' && shopQrAmount > 0 ? 'lg:col-span-8' : 'lg:col-span-12'
                  } relative rounded-3xl border overflow-hidden bg-stone-900 min-h-[280px] sm:min-h-[360px] flex items-center justify-center`}
                  style={{ borderColor: 'var(--border-soft)' }}
                >
                  {/* Remote Video */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full max-h-[420px] object-cover"
                  />

                  {/* Waiting Placeholder Overlay */}
                  {!counterpart && (
                    <div className="absolute inset-0 bg-stone-900/80 text-white p-6 flex flex-col items-center justify-center text-center space-y-2">
                      <Video className="w-12 h-12 opacity-70" />
                      <p className="text-lg font-bold">
                        {activeRole === 'shop'
                          ? tx(
                              'คุณแม่ไปเข้าห้องน้ำได้เลยค่ะ เดี๋ยวครอบครัวรับช่วงเฝ้าร้านต่อให้',
                              'Mom can step away — waiting for family watcher to connect'
                            )
                          : tx(
                              'ยังไม่พบเครื่องหน้าร้านในห้องนี้ (ให้ที่ร้านกด "เปิดเคาน์เตอร์รอให้ลูกเฝ้าร้าน")',
                              'Shop counter is not online in this room yet'
                            )}
                      </p>
                      <p className="text-xs text-stone-300">
                        {tx('ระบบจะเชื่อมต่อภาพและเสียงอัตโนมัติทันทีเมื่ออีกฝั่งเปิดเข้าห้อง', 'Auto-connects as soon as the other device joins')}
                      </p>
                    </div>
                  )}

                  {/* Quick Greeting Banner on Screen */}
                  {quickBanner && (
                    <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md rounded-2xl bg-emerald-600/95 text-white px-4 py-2.5 shadow-lg flex items-center gap-2 text-sm font-bold">
                      <Volume2 className="w-4 h-4 shrink-0" />
                      <span>{quickBanner}</span>
                    </div>
                  )}

                  {/* Small Self-View PIP */}
                  <div className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video rounded-2xl border-2 border-white/80 overflow-hidden bg-stone-800 shadow-lg">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Remote PromptPay QR displayed on Shop Screen for Customers */}
                {activeRole === 'shop' && shopQrAmount > 0 && (
                  <div
                    className="lg:col-span-4 rounded-3xl border-2 p-4 flex flex-col items-center justify-center text-center space-y-2.5"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--accent-primary)',
                    }}
                  >
                    <p className="text-sm font-bold" style={{ color: 'var(--accent-text)' }}>
                      {tx('สแกนจ่ายพร้อมเพย์ได้เลยค่ะ', 'Scan PromptPay QR')}
                    </p>
                    <p className="font-num text-3xl font-extrabold" style={{ color: 'var(--text-main)' }}>
                      ฿{shopQrAmount.toLocaleString('th-TH')}
                    </p>
                    <div className="p-2 bg-white rounded-2xl border" style={{ borderColor: 'var(--border-soft)' }}>
                      {shopQrDataUrl ? (
                        <img src={shopQrDataUrl} alt="PromptPay QR" className="w-44 h-44 object-contain" />
                      ) : (
                        <div className="w-44 h-44 flex items-center justify-center text-xs text-stone-400">
                          QR...
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                      {promptPayId} · {promptPayAccountName}
                    </p>
                  </div>
                )}
              </div>

              {/* Audio / Video / Hangup Controls */}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleMic}
                  className="h-12 px-4 rounded-2xl border font-bold text-sm flex items-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: micMuted ? '#FEE2E2' : 'var(--bg-canvas)',
                    borderColor: micMuted ? '#FCA5A5' : 'var(--border-soft)',
                    color: micMuted ? '#991B1B' : 'var(--text-main)',
                  }}
                >
                  {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {micMuted ? tx('ปิดไมค์อยู่', 'Mic Muted') : tx('ไมค์เปิดอยู่', 'Mic On')}
                </button>

                <button
                  type="button"
                  onClick={toggleCam}
                  className="h-12 px-4 rounded-2xl border font-bold text-sm flex items-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: camOff ? '#FEE2E2' : 'var(--bg-canvas)',
                    borderColor: camOff ? '#FCA5A5' : 'var(--border-soft)',
                    color: camOff ? '#991B1B' : 'var(--text-main)',
                  }}
                >
                  {camOff ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  {camOff ? tx('ปิดกล้องอยู่', 'Camera Off') : tx('กล้องเปิดอยู่', 'Camera On')}
                </button>

                <button
                  type="button"
                  onClick={switchCamera}
                  className="h-12 px-4 rounded-2xl border font-bold text-sm flex items-center gap-2 cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  {tx('สลับกล้อง', 'Flip Camera')}
                </button>

                <button
                  type="button"
                  onClick={leaveCall}
                  className="h-12 px-5 rounded-2xl font-bold text-sm text-white bg-rose-600 flex items-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  {tx('วางสาย / ออกจากห้อง', 'End Call')}
                </button>
              </div>

              {/* Extra Controls for Daughter Watching Remotely */}
              {activeRole === 'watcher' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Quick Say to Customers at Shop */}
                  <div
                    className="rounded-2xl border p-4 space-y-2.5"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  >
                    <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                      <Volume2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      {tx('ส่งข้อความพูดออกเสียงทักลูกค้าที่หน้าร้าน', 'Speak Quick Greeting at Shop')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        tx('สวัสดีค่ะ สั่งอาหารหรือหยิบของได้เลยนะคะ', 'Hello! Feel free to order or pick items.'),
                        tx('รอสักครู่นะคะ คุณแม่กำลังกลับมาค่ะ', 'Just a moment please, Mom will be right back!'),
                        tx('สแกนจ่ายพร้อมเพย์ที่หน้าจอได้เลยนะคะ', 'You can scan the PromptPay QR on screen.'),
                      ].map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => sendQuickSay(phrase)}
                          className="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer text-left"
                          style={{
                            backgroundColor: 'var(--accent-soft)',
                            borderColor: 'var(--accent-border)',
                            color: 'var(--accent-text)',
                          }}
                        >
                          {phrase}
                        </button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendQuickSay(customSayText);
                        setCustomSayText('');
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={customSayText}
                        onChange={(e) => setCustomSayText(e.target.value)}
                        placeholder={tx('พิมพ์ข้อความให้เครื่องหน้าร้านอ่านออกเสียง...', 'Type message to speak at counter...')}
                        className="flex-1 h-10 px-3 rounded-xl border text-xs sm:text-sm focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                      <button
                        type="submit"
                        className="h-10 px-3.5 rounded-xl font-bold text-xs text-white flex items-center gap-1 cursor-pointer shrink-0"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {tx('พูดเลย', 'Speak')}
                      </button>
                    </form>
                  </div>

                  {/* Push PromptPay QR to Mom's Shop Tablet */}
                  <div
                    className="rounded-2xl border p-4 space-y-2.5"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  >
                    <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                      <QrCode className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      {tx('ส่ง QR พร้อมเพย์ขึ้นหน้าจอหน้าร้านให้ลูกค้าสแกน', 'Show PromptPay QR on Shop Screen')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[50, 100, 150, 200].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setQrPushAmountInput(String(amt));
                            sendQrToShop(amt);
                          }}
                          className="px-3 py-1.5 rounded-xl border font-num text-xs font-bold cursor-pointer"
                          style={{
                            backgroundColor: shopQrAmount === amt ? 'var(--accent-primary)' : 'var(--pastel-blue)',
                            borderColor: 'var(--border-soft)',
                            color: shopQrAmount === amt ? '#FFFFFF' : 'var(--pastel-blue-text)',
                          }}
                        >
                          ฿{amt}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={qrPushAmountInput}
                        onChange={(e) => setQrPushAmountInput(e.target.value)}
                        placeholder={tx('ระบุยอดเงิน (บาท)', 'Amount (THB)')}
                        className="flex-1 h-10 px-3 rounded-xl border text-sm font-num focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const n = parseFloat(qrPushAmountInput) || 0;
                          if (n > 0) sendQrToShop(n);
                        }}
                        className="h-10 px-3.5 rounded-xl font-bold text-xs text-white cursor-pointer shrink-0"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      >
                        {tx('โชว์ QR บนจอร้าน', 'Show QR')}
                      </button>
                      {shopQrAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => sendQrToShop(0)}
                          className="h-10 px-3 rounded-xl border font-bold text-xs cursor-pointer shrink-0"
                          style={{
                            backgroundColor: 'var(--pastel-pink)',
                            borderColor: 'var(--border-soft)',
                            color: 'var(--pastel-pink-text)',
                          }}
                        >
                          {tx('ซ่อน QR', 'Hide')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
