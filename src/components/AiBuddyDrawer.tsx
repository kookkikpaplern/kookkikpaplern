import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { translateStaffName, useLang } from '../config/i18n';
import { playSoftClick, speakMessage, stopSpeaking } from '../utils/sound';

interface AiBuddyDrawerProps {
  staffName: string;
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

export const AiBuddyDrawer: React.FC<AiBuddyDrawerProps> = ({ staffName }) => {
  const { lang, tx } = useLang();
  const displayStaffName = translateStaffName(staffName, lang);

  const buildGreeting = (targetLang: 'th' | 'en', name: string) =>
    targetLang === 'en'
      ? `Hello ${name}! Little Bear is here to keep you company at the shop today. Tap a prompt or use the mic to chat anytime!`
      : `สวัสดีค่ะ ${name}! วันนี้น้องหมีอยู่เป็นเพื่อนเฝ้าร้านนะคะ มีอะไรกดถามหรือกดปุ่มไมค์คุยกันได้เลยค่ะ`;

  const [isOpen, setIsOpen] = useState(false);
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
      {/* Small Floating Button Bottom-Left */}
      <button
        type="button"
        onClick={() => {
          playSoftClick();
          setIsOpen(true);
        }}
        className="fixed bottom-4 left-4 z-30 h-12 px-4 rounded-full border-2 shadow-md font-bold text-sm flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--accent-border)',
          color: 'var(--accent-text)',
        }}
      >
        <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        {tx('คุยกับผู้ช่วย', 'Bear Buddy')}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-start bg-black/45 backdrop-blur-sm p-0 sm:p-5">
          <div
            className="w-full sm:max-w-md h-[85vh] sm:h-[600px] rounded-t-3xl sm:rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--border-soft)' }}
            >
              <div>
                <h3 className="text-lg font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-text)' }}>
                  <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  {tx('น้องหมีผู้ช่วยคลายเหงา', 'Friendly Bear Helper')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {tx(`คุยเป็นเพื่อน ${displayStaffName} ตลอดวันค่ะ`, `Keeping ${displayStaffName} company all day`)}
                </p>
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
                  onClick={() => {
                    stopSpeaking();
                    setIsOpen(false);
                  }}
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

