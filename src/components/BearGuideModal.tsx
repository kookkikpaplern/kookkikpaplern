import React from 'react';
import { X } from 'lucide-react';
import { BearFamilyOutfits } from '../config/bearOutfits';
import { useLang } from '../config/i18n';
import { BearGangMascot } from './BearGangMascot';

interface BearGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  outfits?: BearFamilyOutfits;
}

export const BearGuideModal: React.FC<BearGuideModalProps> = ({ isOpen, onClose, outfits }) => {
  const { tx } = useLang();

  if (!isOpen) return null;

  const guideSteps = [
    {
      title: tx('1. เข้าใช้งาน 2 ชั้นง่ายๆ', '1. Easy 2-Step Staff Login'),
      body: tx(
        'กรอกรหัสร้านค้า (KKP2027) เพียงครั้งแรกครั้งเดียว จากนั้นใส่รหัส PIN 4 หลักของพนักงาน (แม่, พ่อ, พี่เพลิน, กุ๊ก, กิ๊ก) ระบบจะตรวจสอบชื่อพนักงาน แจ้งสถานะพร้อมใช้งาน และจำชื่อผู้ขายให้ทุกบิลค่ะ',
        'Enter Store ID (KKP2027) once on first setup, then sign in with your 4-digit staff PIN (Mom, Dad, Plern, Kook, Kik). The POS verifies the staff member, shows ready status, and records the seller on every bill.'
      ),
    },
    {
      title: tx('2. คิดเงินสด / สแกน QR / ยิงบาร์โค้ด', '2. Cash / PromptPay QR / Barcode Scanner'),
      body: tx(
        'ใช้โหมด "เครื่องคิดเลขแม่" กดตัวเลขแล้วกด + เพื่อรวมบิล หรือยิงปืนบาร์โค้ดได้ทันทีโดยไม่ต้องจิ้มช่องค้นหา จากนั้นกด "รับเงินสด" เพื่อคิดเงินทอน หรือกด "สแกนจ่าย QR" ให้ลูกค้าสแกนได้เลยค่ะ',
        'In "Mom\'s Calculator" mode, enter prices and press + to build a bill, or scan barcodes anytime without clicking a search box. Then tap "Cash" to calculate change or "Scan QR" for PromptPay.'
      ),
    },
    {
      title: tx('3. โหมดครัวแม่วัง & แยกยอดอัตโนมัติ', '3. Krua Mae Wang Mode & Auto Sheet Split'),
      body: tx(
        'สลับไปโหมด "ครัวแม่วัง / สั่งอาหาร" เพื่อขายอาหารกับข้าวและเครื่องดื่ม โดยมีแม่หมีเชฟคอยรับออเดอร์และพ่อหมีขี่เวสป้าเขียวมิ้นคอยส่งอาหาร ยอดขายจะแยกเข้าแท็บ "ขายจริง_ครัวแม่วัง" อัตโนมัติค่ะ',
        'Switch to "Krua Mae Wang / Orders" to sell home-cooked meals and drinks with Chef Mama Bear and Papa Bear on his mint Vespa. Sales automatically sync to the separate Krua Mae Wang sheet tab.'
      ),
    },
    {
      title: tx('4. สะสมดาว & ออกการ์ดสมาชิก', '4. Star Loyalty & Digital Member Card'),
      body: tx(
        'เมื่อหน้าจอเปลี่ยนเป็นสีเขียวและพูดขอบคุณแล้ว กรอกเบอร์โทรลูกค้า (หรือแค่เลขท้าย 4 ตัว) แล้วกด "⭐ บันทึกดาว" หรือกด "+ สมัครสมาชิกด่วน" เพื่อรับการ์ดสะสมดาวบันทึกรูปส่งให้ลูกค้าได้ทันทีค่ะ',
        'On the green thank-you screen, enter the customer\'s phone number (or last 4 digits) and tap "Save Stars" or "+ Quick Sign-Up" to issue and download a PNG star loyalty card.'
      ),
    },
    {
      title: tx(
        '5. ห้องแต่งตัวครอบครัวหมี 5 ตัว & สิทธิ์การใช้งาน',
        '5. 5-Bear Family Dressing Room & Permissions'
      ),
      body: tx(
        'ทุกคนสามารถกดปุ่ม "👗 ห้องแต่งตัว" เพื่อเปลี่ยนทรงผม แว่นตา หมวกเชฟ โบว์ ผ้ากันเปื้อน กระเป๋า หรือชุดแฟนซีให้ครอบครัวหมีทั้ง 5 ตัวได้ และสมาชิกครอบครัว (แม่, พ่อ, พี่เพลิน, กุ๊ก, กิ๊ก) สามารถเข้าเมนูตั้งค่าและอนุมัติแลกของรางวัล 50 ดาวได้เลยค่ะ',
        'Anyone can open the "Dressing Room" to customize hair, glasses, chef hats, bows, aprons, bags, or outfits for all 5 family bears. Family admins (Mom, Dad, Plern, Kook, Kik) can manage settings and approve 50-star redemptions.'
      ),
    },
    {
      title: tx('6. น้องหมีผู้ช่วย AI คลายเหงา', '6. Friendly Bear Helper Chat'),
      body: tx(
        'ถ้าระหว่างเฝ้าร้านรู้สึกเหงาหรืออยากได้กำลังใจ กดปุ่ม "คุยกับผู้ช่วย" มุมซ้ายล่าง พูดใส่ไมค์หรือจิ้มคำถามได้เลย น้องหมีจะคอยตอบและอ่านออกเสียงให้ฟังค่ะ',
        'Tap the "Bear Buddy" button in the bottom-left corner anytime for encouragement or a quick chat! You can type, tap preset prompts, or use the mic and listen to spoken replies.'
      ),
    },
    {
      title: tx('7. วิดีโอคอลเฝ้าร้านแทนแม่ (เมื่อแม่พักหรือเข้าห้องน้ำ)', '7. Remote Shop Video Call (Cover for Mom)'),
      body: tx(
        'หากคุณแม่ต้องเข้าห้องน้ำหรือพักสักครู่ กดปุ่ม "เฝ้าร้านแทนแม่" บนแถบเครื่องมือ แล้วเลือก "เปิดเคาน์เตอร์รอให้ลูกเฝ้าร้าน" จากนั้นลูกหรือคนในครอบครัวเปิดเว็บนี้จากมือถืออีกเครื่อง กดเข้าเฝ้าร้านแทน เพื่อเห็นหน้าคุยกับลูกค้าและส่ง QR พร้อมเพย์ให้ลูกค้าสแกนจ่ายได้ทันทีค่ะ',
        'When Mom needs a break, tap "Video Call Shop" on the toolbar and open Shop Counter Standby. Family members can then join from their phone to talk with customers live and push PromptPay QR to the counter screen.'
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl max-h-[90vh] pt-4 flex flex-col">
        <div className="-mb-3.5 relative z-10 px-8 shrink-0">
          <BearGangMascot pose="peeking" outfits={outfits} />
        </div>

        <div
          className="relative z-20 rounded-3xl border-2 shadow-xl flex flex-col overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--accent-border)',
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4 border-b shrink-0"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
                {tx('🐻 คู่มือมือใหม่ โดยแก๊งหมี 3 พี่น้อง', '🐻 Quick Guide by the 3 Sibling Bears')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx('อ่านเข้าใจง่าย ใช้เป็นใน 1 นาทีค่ะ', 'Simple & friendly — learn the POS in 1 minute')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              aria-label={tx('ปิดคู่มือ', 'Close guide')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 overflow-y-auto space-y-3.5">
            {guideSteps.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border p-4 space-y-1"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              >
                <h3 className="text-base font-bold" style={{ color: 'var(--accent-text)' }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-main)' }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--border-soft)' }}>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-13 rounded-2xl font-bold text-white text-base cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {tx('เข้าใจแล้ว กลับไปขายของกันเลย ✓', 'Got it! Back to Selling ✓')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

