import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { translateStaffName, useLang } from '../config/i18n';
import { playSoftClick, speakMessage, stopSpeaking } from '../utils/sound';

const SmartBearMascotIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Clever Idea Golden Sparkles */}
    <path
      d="M67 12 L69 17 L74 19 L69 21 L67 26 L65 21 L60 19 L65 17 Z"
      fill="#FBBF24"
      stroke="#B45309"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="13" cy="18" r="2.3" fill="#FDE047" />

    {/* Bear Ears */}
    <circle cx="22" cy="28" r="8.5" fill="#ECD5B8" stroke="#6D5242" strokeWidth="2.5" />
    <circle cx="22" cy="28" r="4.2" fill="#DFBE99" />
    <circle cx="58" cy="28" r="8.5" fill="#ECD5B8" stroke="#6D5242" strokeWidth="2.5" />
    <circle cx="58" cy="28" r="4.2" fill="#DFBE99" />

    {/* Bear Head */}
    <ellipse cx="40" cy="46" rx="23" ry="20" fill="#ECD5B8" stroke="#6D5242" strokeWidth="2.6" />

    {/* Cream Muzzle */}
    <ellipse cx="40" cy="52" rx="10.5" ry="7.8" fill="#FFF7EB" />

    {/* Rosy Cheeks */}
    <ellipse cx="24.5" cy="50.5" rx="4.2" ry="2.6" fill="#F5999B" opacity="0.82" />
    <ellipse cx="55.5" cy="50.5" rx="4.2" ry="2.6" fill="#F5999B" opacity="0.82" />

    {/* Sparkling Clever Eyes */}
    <circle cx="31" cy="43.5" r="3.1" fill="#3F2D22" />
    <circle cx="30" cy="42.3" r="1.1" fill="#FFFFFF" />
    <circle cx="49" cy="43.5" r="3.1" fill="#3F2D22" />
    <circle cx="48" cy="42.3" r="1.1" fill="#FFFFFF" />

    {/* Smart Round Glasses */}
    <circle cx="31" cy="43.5" r="6.8" fill="#FFFFFF" fillOpacity="0.18" stroke="#334155" strokeWidth="2.2" />
    <circle cx="49" cy="43.5" r="6.8" fill="#FFFFFF" fillOpacity="0.18" stroke="#334155" strokeWidth="2.2" />
    <path d="M37.8 43.2 Q40 41.6 42.2 43.2" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M24.2 43 H18.5" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
    <path d="M55.8 43 H61.5" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
    {/* Lens Glint */}
    <path d="M27.2 39.5 L29.2 41.2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
    <path d="M45.2 39.5 L47.2 41.2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />

    {/* Cute Nose & Confident Smile */}
    <ellipse cx="40" cy="49.5" rx="3" ry="2.1" fill="#4B372B" />
    <path
      d="M35.5 53.3 Q37.8 56 40 53.3 Q42.2 56 44.5 53.3"
      stroke="#4B372B"
      strokeWidth="2.1"
      strokeLinecap="round"
      fill="none"
    />

    {/* Tiny Scholar Graduation Cap */}
    <path
      d="M27 25.5 C29 20, 51 20, 53 25.5 L50 30 C45 27.5, 35 27.5, 30 30 Z"
      fill="#1E3A5F"
      stroke="#0F172A"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M40 12 L61 20.5 L40 27.5 L19 20.5 Z"
      fill="#254E7B"
      stroke="#0F172A"
      strokeWidth="2.1"
      strokeLinejoin="round"
    />
    <circle cx="40" cy="19.8" r="2.1" fill="#FBBF24" />
    <path d="M40 19.8 Q53 21.5 55.5 31" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="55.5" cy="32.5" r="2.2" fill="#FBBF24" stroke="#B45309" strokeWidth="1" />

    {/* Smart Emerald Bow Tie */}
    <path
      d="M32 63.5 L39 66.5 L32 69.5 Z M48 63.5 L41 66.5 L48 69.5 Z"
      fill="#10B981"
      stroke="#065F46"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="40" cy="66.5" r="2.2" fill="#34D399" stroke="#065F46" strokeWidth="1.4" />
  </svg>
);

interface AiBuddyDrawerProps {
  staffName: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isGreeting?: boolean;
}

const PRESET_PROMPTS_TH = [
  'ขอกำลังใจขายของวันนี้',
  'เล่าเรื่องสนุกๆ แก้เหงาหน่อย',
  'ขอคำอวยพรเรียกลูกค้าหน่อย',
  'ทักทายน้องหมีหน่อยสิ',
];

const PRESET_PROMPTS_EN = [
  'Cheer me on today!',
  'Tell a fun short story',
  'Give a lucky shop blessing',
  'Say hi to Little Bear!',
];

export const AiBuddyDrawer: React.FC<AiBuddyDrawerProps> = ({
  staffName,
  isOpen: controlledOpen,
  onClose,
}) => {
  const { lang, tx } = useLang();
  const displayStaffName = translateStaffName(staffName, lang);

  const buildGreeting = (targetLang: 'th' | 'en', name: string) =>
    targetLang === 'en'
      ? `Hello ${name}! Little Bear is here to keep you company at the shop today. Tap a prompt or use the mic to chat anytime!`
      : `สวัสดีค่ะ ${name}! วันนี้น้องหมีอยู่เป็นเพื่อนเฝ้าร้านนะคะ มีอะไรกดถามหรือกดปุ่มไมค์คุยกันได้เลยค่ะ`;

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const closeDrawer = () => {
    stopSpeaking();
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: 'model',
      isGreeting: true,
      text: buildGreeting(lang, displayStaffName),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.isGreeting ? { ...m, text: buildGreeting(lang, displayStaffName) } : m))
    );
  }, [lang, displayStaffName]);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    playSoftClick();
    const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextHistory);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-buddy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory.slice(-6).map(({ role, text: msgText }) => ({ role, text: msgText })),
          staffName: displayStaffName,
          lang,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        const errText =
          data.error ||
          tx(
            'ขออภัยค่ะ ตอนนี้น้องหมีตอบไม่ได้ชั่วคราว ลองใหม่อีกครั้งนะคะ',
            'Sorry, Little Bear cannot respond right now. Please try again in a moment.'
          );
        setMessages((prev) => [...prev, { role: 'model', text: errText }]);
      } else {
        const reply = data.reply
          .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
        setMessages((prev) => [...prev, { role: 'model', text: reply }]);
        if (autoSpeak) {
          speakMessage(reply, lang);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: tx(
            'อินเทอร์เน็ตอาจจะสะดุดสักครู่ ลองส่งข้อความใหม่อีกครั้งนะคะ',
            'Connection hiccup! Please try sending your message again.'
          ),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleMicToggle = () => {
    playSoftClick();
    const Win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
    };

    const Rec = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!Rec) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: tx(
            'เครื่องนี้ยังไม่รองรับการพูดผ่านไมโครโฟน สามารถจิ้มปุ่มคำถามด้านล่างได้เลยค่ะ',
            'Voice input is not supported on this device. Please tap one of the quick prompts below!'
          ),
        },
      ]);
      return;
    }

    const recognition = new Rec();
    recognition.lang = lang === 'en' ? 'en-US' : 'th-TH';
    recognition.interimResults = false;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        sendMessage(transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const presetPrompts = lang === 'en' ? PRESET_PROMPTS_EN : PRESET_PROMPTS_TH;

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={() => {
            playSoftClick();
            setInternalOpen(true);
          }}
          className="fixed bottom-4 left-4 z-30 h-13 pl-1.5 pr-4 rounded-full border-2 shadow-lg font-bold text-sm flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--accent-border)',
            color: 'var(--accent-text)',
          }}
          aria-label={tx('คุยกับผู้ช่วยน้องหมีแสนฉลาด', 'Talk to Smart Bear Buddy')}
        >
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
            }}
          >
            <SmartBearMascotIcon className="w-9 h-9" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm font-extrabold">{tx('คุยกับผู้ช่วย', 'Bear Buddy')}</span>
            <span className="text-[10px] font-semibold opacity-80">
              {tx('น้องหมีแสนฉลาด', 'Smart Helper')}
            </span>
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-start bg-black/45 backdrop-blur-sm p-0 sm:p-5">
          <div
            className="w-full sm:max-w-md h-[85vh] sm:h-[600px] rounded-t-3xl sm:rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
              style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--border-soft)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                >
                  <SmartBearMascotIcon className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold leading-tight" style={{ color: 'var(--accent-text)' }}>
                    {tx('น้องหมีผู้ช่วยแสนฉลาด', 'Smart Bear Helper')}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {tx(`คุยเป็นเพื่อน ${displayStaffName} ตลอดวันค่ะ`, `Keeping ${displayStaffName} company all day`)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !autoSpeak;
                    setAutoSpeak(next);
                    if (!next) stopSpeaking();
                  }}
                  title={
                    autoSpeak
                      ? tx('ปิดเสียงอ่านอัตโนมัติ', 'Mute auto voice')
                      : tx('เปิดเสียงอ่านอัตโนมัติ', 'Enable auto voice')
                  }
                  className="w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                >
                  {autoSpeak ? <Volume2 className="w-4 h-4 text-emerald-700" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  aria-label={tx('ปิดหน้าต่างผู้ช่วย', 'Close helper')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: 'var(--bg-canvas)' }}>
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:text-base leading-relaxed shadow-xs"
                    style={{
                      backgroundColor: m.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-card)',
                      color: m.role === 'user' ? '#FFFFFF' : 'var(--text-main)',
                      border: m.role === 'user' ? 'none' : '1px solid var(--border-soft)',
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl px-4 py-2.5 text-sm border"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
                  >
                    {tx('น้องหมีกำลังคิดคำตอบให้นะคะ...', 'Little Bear is thinking...')}
                  </div>
                </div>
              )}
              <div ref={scrollEndRef} />
            </div>

            {/* Quick Tap Preset Buttons */}
            <div className="px-4 py-2.5 border-t flex flex-wrap gap-1.5" style={{ borderColor: 'var(--border-soft)' }}>
              {presetPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-transform active:scale-95"
                  style={{
                    backgroundColor: 'var(--pastel-peach)',
                    borderColor: 'var(--border-soft)',
                    color: 'var(--pastel-peach-text)',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input + Mic */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(inputText);
              }}
              className="p-3.5 border-t flex items-center gap-2 shrink-0"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <button
                type="button"
                onClick={handleMicToggle}
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 cursor-pointer ${
                  isListening ? 'bg-rose-500 text-white border-rose-500' : ''
                }`}
                style={
                  !isListening
                    ? { backgroundColor: 'var(--pastel-blue)', borderColor: 'var(--border-soft)', color: 'var(--pastel-blue-text)' }
                    : undefined
                }
                title={tx('พูดภาษาไทย', 'Speak in English')}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={tx('พิมพ์คุยกับน้องหมี...', 'Type a message to Little Bear...')}
                className="flex-1 h-12 px-4 rounded-2xl border text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-45"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                aria-label={tx('ส่งข้อความ', 'Send message')}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

