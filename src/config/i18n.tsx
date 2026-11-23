import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { BearId } from './bearOutfits';
import { FaqItem, RewardOffer, SHOP_CONFIG, ThemeId } from './shopConfig';
import { playSoftClick } from '../utils/sound';

export type Language = 'th' | 'en';

const LANG_STORAGE_KEY = 'kkp_lang_v1';

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  toggleLang: () => void;
  tx: (th: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'th',
  setLang: () => {},
  toggleLang: () => {},
  tx: (th) => th,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'en' ? 'en' : 'th';
    } catch {
      return 'th';
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'th' ? 'en' : 'th'));
  }, []);

  const tx = useCallback(
    (th: string, en: string) => (lang === 'en' ? en : th),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, tx }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}

export const LanguageToggleButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang, setLang } = useLang();

  return (
    <div
      className="inline-flex items-center gap-0.5 p-1 rounded-2xl border shrink-0"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
      role="group"
      aria-label={lang === 'en' ? 'Select Language' : 'เลือกภาษา'}
    >
      <span className="pl-2 pr-1 flex items-center" style={{ color: 'var(--text-muted)' }}>
        <Globe className="w-3.5 h-3.5" />
      </span>
      <button
        type="button"
        onClick={() => {
          playSoftClick();
          setLang('th');
        }}
        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
          compact ? '' : 'min-w-[46px]'
        }`}
        style={{
          backgroundColor: lang === 'th' ? 'var(--accent-primary)' : 'transparent',
          color: lang === 'th' ? '#FFFFFF' : 'var(--text-muted)',
        }}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => {
          playSoftClick();
          setLang('en');
        }}
        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold font-en cursor-pointer transition-colors ${
          compact ? '' : 'min-w-[44px]'
        }`}
        style={{
          backgroundColor: lang === 'en' ? 'var(--accent-primary)' : 'transparent',
          color: lang === 'en' ? '#FFFFFF' : 'var(--text-muted)',
        }}
      >
        EN
      </button>
    </div>
  );
};

// ============================================================================
// Dynamic Data Translators (Preserve Thai internal keys, render EN when selected)
// ============================================================================

const STAFF_NAME_EN: Record<string, string> = {
  แม่: 'Mom',
  พ่อ: 'Dad',
  พี่เพลิน: 'Plern',
  กุ๊ก: 'Kook',
  กิ๊ก: 'Kik',
  พี่สาว: 'Big Sister',
  พนักงานขายแทน: 'Substitute Staff',
  ลูกค้าสั่งเอง: 'Self-Order Guest',
};

export function translateStaffName(name: string, lang: Language): string {
  if (lang === 'th') return name;
  return STAFF_NAME_EN[name.trim()] || name;
}

const CATEGORY_EN: Record<string, string> = {
  ทั้งหมด: 'All',
  เครื่องดื่ม: 'Drinks',
  ขนมทานเล่น: 'Snacks',
  อาหารจานเดียว: 'Rice & Noodles',
  กับข้าวครัวแม่วัง: 'Home-Cooked Dishes',
  สินค้าทั่วไป: 'General Items',
  ทั่วไป: 'General',
};

export function translateCategory(cat: string, lang: Language): string {
  if (lang === 'th') return cat;
  return CATEGORY_EN[cat.trim()] || cat;
}

const MENU_NAME_EN: Record<string, string> = {
  ข้าวมันไก่: 'Hainanese Chicken Rice',
  ข้าวขาหมู: 'Braised Pork Leg on Rice',
  ข้าวผัดกะเพรา: 'Stir-Fried Holy Basil on Rice',
  ก๋วยจั๊บ: 'Chinese Rolled Noodle Soup (Guay Jub)',
  'น้ำเปล่า (1 ขวด)': 'Drinking Water (1 Bottle)',
  น้ำเปล่า: 'Drinking Water',
  น้ำเปล่าว: 'Drinking Water',
  ชาไทยเย็นโบราณ: 'Traditional Iced Thai Tea',
  กาแฟเย็นนมสด: 'Iced Fresh Milk Coffee',
  โกโก้ปั่นวิปครีม: 'Cocoa Frappe w/ Whipped Cream',
  ชามะนาวสดน้ำผึ้ง: 'Fresh Honey Lemon Tea',
  นมชมพูเย็น: 'Iced Pink Milk (Nom Yen)',
  อัญชันมะนาวโซดา: 'Butterfly Pea Lemon Soda',
  ขนมปังปิ้งเนยนม: 'Butter & Condensed Milk Toast',
  ขนมปังสังขยาใบเตย: 'Pandan Custard Toast',
  'กล้วยทอดกรอบ (ชุด)': 'Crispy Fried Bananas (Set)',
  บราวนี่โฮมเมด: 'Homemade Brownie',
  คุกกี้เนยสดกล่องเล็ก: 'Butter Cookies (Small Box)',
  ข้าวไข่เจียวทรงเครื่อง: 'Loaded Omelet on Rice',
  ข้าวกะเพราหมูสับไข่ดาว: 'Basil Minced Pork & Fried Egg on Rice',
  ข้าวหมูกระเทียมพริกไทย: 'Garlic Pepper Pork on Rice',
  มาม่าต้มยำทรงเครื่อง: 'Tom Yum Instant Noodles Deluxe',
  'ข้าวต้มหมูสับร้อนๆ': 'Hot Minced Pork Rice Soup',
  แกงเขียวหวานไก่ยอดมะพร้าว: 'Chicken Green Curry w/ Coconut Shoot',
  ไข่พะโล้หมูสามชั้นสูตรแม่วัง: "Mom's Braised Pork & Egg Stew",
};

export function translateMenuName(name: string, lang: Language): string {
  if (lang === 'th') return name;
  return MENU_NAME_EN[name.trim()] || name;
}

const TASTE_NOTE_EN: Record<string, string> = {
  ไม่เผ็ด: 'No Spice',
  เผ็ดน้อย: 'Mild Spicy',
  เผ็ดกลาง: 'Medium Spicy',
  เผ็ดมาก: 'Very Spicy',
  หวานน้อย: 'Less Sweet',
  หวานกลาง: 'Medium Sweet',
  หวานมาก: 'Very Sweet',
};

export function translateTasteNote(tasteNote: string | undefined, lang: Language): string {
  if (!tasteNote) return '';
  if (lang === 'th') return tasteNote;
  return tasteNote
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      return TASTE_NOTE_EN[trimmed] || trimmed;
    })
    .filter(Boolean)
    .join(', ');
}

export function translateStatus(status: 'พร้อมขาย' | 'หมด', lang: Language): string {
  if (lang === 'th') return status;
  return status === 'หมด' ? 'Sold Out' : 'Available';
}

export function translateDeliveryType(
  deliveryType: 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง',
  lang: Language
): string {
  if (lang === 'th') return deliveryType;
  return deliveryType === 'ให้พ่อไปส่ง' ? 'Papa Delivery' : 'Self Pick-up';
}

export function translatePromoTitle(val: string, lang: Language): string {
  if (lang === 'th') return val;
  if (val.trim() === SHOP_CONFIG.promoTitle) {
    return 'Morning Special ✨ Fresh Drinks & Home-Cooked Meals';
  }
  return val;
}

export function translatePromoSubtitle(val: string, lang: Language): string {
  if (lang === 'th') return val;
  if (val.trim() === SHOP_CONFIG.promoSubtitle) {
    return 'Order hot homemade rice dishes from Krua Mae Wang or shop items from kookkikpaplern. Earn stars on every bill — collect 50 stars for a free treat!';
  }
  return val;
}

export function translateRewardNotice(val: string, lang: Language): string {
  if (lang === 'th') return val;
  if (val.trim() === SHOP_CONFIG.rewardNotice) {
    return '⭐ Collect 50 Stars to Redeem 1 Free Signature Item!';
  }
  return val;
}

const DEFAULT_FAQ_EN: Record<string, { question: string; answer: string }> = {
  faq1: {
    question: 'What are the shop opening hours?',
    answer: 'We are open daily from 06:30 AM – 06:00 PM (or until sold out).',
  },
  faq2: {
    question: 'What can I redeem with 50 stars?',
    answer:
      'With 50 stars, you can redeem 1 free rice dish or signature menu item. Just show your member ID or phone number to Mom, Dad, Plern, Kook, or Kik at the counter!',
  },
  faq3: {
    question: 'Do you offer local delivery?',
    answer:
      'Yes! Choose "Papa Delivery" on the order screen and enter your name and drop-off spot.',
  },
  faq4: {
    question: 'Can I pay by PromptPay QR scan?',
    answer:
      'Yes! You can pay by cash at the counter or scan PromptPay QR (Phone: 0837596411 · Account Name: Khamwang Phuangmala).',
  },
};

export function translateFaq(faq: FaqItem, lang: Language): FaqItem {
  if (lang === 'th') return faq;
  const matched = DEFAULT_FAQ_EN[faq.id];
  const orig = SHOP_CONFIG.faqs.find((f) => f.id === faq.id);
  if (matched && orig && faq.question === orig.question && faq.answer === orig.answer) {
    return { ...faq, question: matched.question, answer: matched.answer };
  }
  return faq;
}

const DEFAULT_REWARD_EN: Record<
  string,
  { title: string; description: string; terms: string; expiryDate: string }
> = {
  rw1: {
    title: '฿20 Off or Free Extra Topping (1 Item)',
    description:
      'Use 25 stars for a ฿20 bill discount or a free extra fried egg / upgrade.',
    terms:
      'Redeemable at kookkikpaplern & Krua Mae Wang. Please tell staff your phone number or KKP member ID before checkout.',
    expiryDate: '31 Dec 2026',
  },
  rw2: {
    title: 'Free! 1 Rice Dish at Krua Mae Wang (฿50 Value)',
    description:
      'Use 50 stars for 1 free single-plate rice or noodle dish (Chicken Rice, Braised Pork Leg, Stir-Fried Basil, or Guay Jub).',
    terms:
      'Limit 1 dish per bill for available daily dishes. Cannot be exchanged for cash.',
    expiryDate: '31 Dec 2026',
  },
  rw3: {
    title: 'Free! 2-Dish Meal Set (฿100 Value)',
    description:
      'Use 80 stars for any 2 single-plate rice dishes for dining together or takeaway.',
    terms:
      'Please inform Mom, Dad, Plern, Kook, or Kik before ordering.',
    expiryDate: '31 Dec 2026',
  },
};

export function translateRewardOffer(offer: RewardOffer, lang: Language): RewardOffer {
  if (lang === 'th') return offer;
  const matched = DEFAULT_REWARD_EN[offer.id];
  const orig = SHOP_CONFIG.rewardOffers.find((r) => r.id === offer.id);
  if (matched && orig && offer.title === orig.title) {
    return {
      ...offer,
      title: matched.title,
      description: offer.description === orig.description ? matched.description : offer.description,
      terms: offer.terms === orig.terms ? matched.terms : offer.terms,
      expiryDate: offer.expiryDate === orig.expiryDate ? matched.expiryDate : offer.expiryDate,
    };
  }
  const expiryEn =
    offer.expiryDate === 'ไม่มีกำหนด'
      ? 'No Expiry'
      : offer.expiryDate === '31 ธันวาคม 2569'
        ? '31 Dec 2026'
        : offer.expiryDate;
  return { ...offer, expiryDate: expiryEn };
}

const THEME_EN: Record<ThemeId, { name: string; description: string }> = {
  'mint-earth': {
    name: 'Earth-Tone Pastel Mint',
    description: 'Warm cream paired with soft pastel mint (Default)',
  },
  'peach-pastel': {
    name: 'Warm Pastel Peach',
    description: 'Milky cream with gentle warm peach accents',
  },
  'matcha-warm': {
    name: 'Warm Matcha Green',
    description: 'Soothing soft tea green, easy on the eyes',
  },
  'lavender-milk': {
    name: 'Pastel Lavender Milk',
    description: 'Gentle soft lavender for a calm workspace',
  },
};

export function translateThemeOption(
  id: ThemeId,
  thName: string,
  thDesc: string,
  lang: Language
): { name: string; description: string } {
  if (lang === 'th') return { name: thName, description: thDesc };
  return THEME_EN[id] || { name: thName, description: thDesc };
}

const BEAR_EN: Record<BearId, { label: string; role: string }> = {
  papa: { label: 'Papa Bear', role: 'Mint Vespa Delivery Rider' },
  mama: { label: 'Mama Bear', role: 'Head Chef of Krua Mae Wang' },
  sister: { label: 'Big Sister Bear', role: 'Fluffy Kind White Bear' },
  twinLeft: { label: 'Older Twin', role: 'Storefront Helper' },
  twinRight: { label: 'Younger Twin', role: 'Cheerful Fashionista' },
};

export function translateBearCharacter(
  id: BearId,
  thLabel: string,
  thRole: string,
  lang: Language
): { label: string; role: string } {
  if (lang === 'th') return { label: thLabel, role: thRole };
  return BEAR_EN[id] || { label: thLabel, role: thRole };
}

const OUTFIT_LABEL_EN: Record<string, string> = {
  // hair
  default: 'Natural Hair',
  curly: 'Soft Curly Hair',
  parted: 'Pastel Side Bangs',
  spiky: 'Cool Spiky Hair',
  // glasses
  round: 'Round Classic Glasses',
  'mint-round': 'Mint Round Glasses',
  sunglasses: 'Cool Sunglasses',
  // hat
  'chef-star': 'Star Chef Hat ⭐',
  'mint-beanie': 'Mint Knit Beanie',
  beret: 'Cream Beret',
  crown: 'Royal Crown',
  // bow
  'pink-polka': 'Pink Polka Dot Bow',
  'mint-ribbon': 'Mint Ribbon Bow',
  'gold-bowtie': 'Golden Bowtie',
  // apron
  'mint-chef': 'Mint Chef Apron',
  denim: 'Denim Apron',
  'peach-cafe': 'Soft Peach Cafe Apron',
  // bag
  patchwork: 'Patchwork Tote Bag',
  'delivery-box': 'Food Delivery Box/Bag',
  'tote-mint': 'Mint Canvas Tote',
  // fancy
  'rainbow-scarf': 'Rainbow Scarf',
  'royal-cape': 'Golden Star Cape',
  'hawaii-shirt': 'Bright Hawaii Shirt',
};

const NONE_LABEL_EN: Record<string, string> = {
  hair: 'No Hairpiece',
  glasses: 'No Glasses',
  hat: 'No Hat',
  bow: 'No Bow',
  apron: 'No Apron',
  bag: 'No Bag',
  fancy: 'Regular Outfit',
};

export function translateOutfitLabel(
  category: string,
  id: string,
  thLabel: string,
  lang: Language
): string {
  if (lang === 'th') return thLabel;
  if (id === 'none') return NONE_LABEL_EN[category] || 'None';
  return OUTFIT_LABEL_EN[id] || thLabel;
}
