export type StaffRole = 'admin' | 'cashier';

export interface StaffUser {
  name: string;
  role: StaffRole;
}

export interface MenuItem {
  id: string;
  barcode: string;
  name: string;
  price: number;
  stars: number;
  category: string;
  imageUrl?: string;
  status: 'พร้อมขาย' | 'หมด';
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface RewardOffer {
  id: string;
  title: string;
  starsRequired: number;
  description: string;
  terms: string;
  expiryDate: string;
  active: boolean;
}

export type ThemeId = 'mint-earth' | 'peach-pastel' | 'matcha-warm' | 'lavender-milk';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  previewBg: string;
  previewAccent: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'mint-earth',
    name: 'เอิร์ธโทน-เขียวมิ้น',
    description: 'ครีมอบอุ่นผสมเขียวมิ้นพาสเทล (ค่าเริ่มต้น)',
    previewBg: '#FAF6F0',
    previewAccent: '#5FB894',
  },
  {
    id: 'peach-pastel',
    name: 'พีชละมุนอบอุ่น',
    description: 'ครีมน้ำนมตัดสีพีชอุ่นสบายตา',
    previewBg: '#FFF7F2',
    previewAccent: '#E08568',
  },
  {
    id: 'matcha-warm',
    name: 'มัทฉะชาเขียวอุ่น',
    description: 'เขียวใบชาอ่อนละมุน ลดแสงสะท้อน',
    previewBg: '#F4F7F2',
    previewAccent: '#689D72',
  },
  {
    id: 'lavender-milk',
    name: 'ลาเวนเดอร์พาสเทล',
    description: 'ม่วงพาสเทลอ่อนโยน ผ่อนคลายสายตา',
    previewBg: '#F7F5FA',
    previewAccent: '#8475B8',
  },
];

// ============================================================================
// บล็อกตั้งค่าจุดเดียว (SINGLE CONFIG BLOCK) - แก้ไขค่าเริ่มต้นของร้านได้ที่นี่จุดเดียว
// ============================================================================
export const SHOP_CONFIG = {
  orgCode: 'KKP2027',
  staffUsers: {
    '1606': { name: 'แม่', role: 'admin' },
    '0709': { name: 'พ่อ', role: 'admin' },
    '2804': { name: 'พี่เพลิน', role: 'admin' },
    '1628': { name: 'กุ๊ก', role: 'admin' },
    '1629': { name: 'กิ๊ก', role: 'admin' },
  } as Record<string, StaffUser>,
  shopNameTh: 'กุ๊กกิ๊กพาเพลิน',
  shopNameEn: 'kookkikpaplern',
  foodShopNameTh: 'ครัวแม่วัง',
  foodShopNameEn: 'Krua Mae Wang',
  promptPayId: '0837596411',
  promptPayAccountName: 'คำวัง พวงมาลา',
  scriptUrl:
    'https://script.google.com/macros/s/AKfycbx0HhQUqRtnnSKJwIp_Ld7QRtmg-kdbEq4J9M6T_WtlRjuWBSdwVSYYHH_V2OAH8cp_/exec',
  rewardNotice: '⭐ สะสมครบ 50 ดาว แลกฟรี! เมนูแนะนำ 1 อย่าง',
  promoTitle: 'โปรโมชันต้อนรับเช้าวันใหม่ ✨ สดชื่นอิ่มอร่อยทั้ง 2 ร้าน',
  promoSubtitle:
    'สั่งอาหารจานเดียวร้อนๆ จากครัวแม่วัง หรือสินค้าหน้าร้านกุ๊กกิ๊กพาเพลิน รับดาวสะสมทุกบิล ครบ 50 ดาว แลกฟรีทันที!',
  faqBubbleText: 'มีอะไรสงสัยสอบถามได้นะคะ อยากตอบจังเลย',
  faqModalTitle: 'น้องหมีช่วยตอบ (ถาม-ตอบอัตโนมัติ)',
  faqModalSubtitle: 'กดเลือกคำถามที่สงสัยได้เลยค่ะ',
  enableAutoPaymentCheck: false,
  faqs: [
    {
      id: 'faq1',
      question: 'ร้านเปิดให้บริการกี่โมงคะ?',
      answer: 'เปิดบริการทุกวันช่วงเช้า 06:30 น. - 18:00 น. (หรือจนกว่าของจะหมดค่ะ)',
    },
    {
      id: 'faq2',
      question: 'สะสมดาวครบ 50 ดาว แลกอะไรได้บ้าง?',
      answer: 'สะสมครบ 50 ดาว สามารถแลกฟรีเมนูอาหารหรือเมนูแนะนำได้ 1 อย่าง แจ้งคุณแม่ พ่อ พี่เพลิน กุ๊ก หรือกิ๊กที่หน้าร้านได้เลยค่ะ',
    },
    {
      id: 'faq3',
      question: 'มีบริการส่งอาหารถึงที่ไหม?',
      answer: 'มีบริการ "ให้พ่อไปส่ง" ค่ะ เลือกเมนูเสร็จแล้วกดเลือก "ให้พ่อไปส่ง" พร้อมใส่ชื่อและจุดส่งได้เลยค่ะ',
    },
    {
      id: 'faq4',
      question: 'จ่ายเงินผ่านสแกนพร้อมเพย์ได้ไหม?',
      answer: 'ได้ค่ะ สามารถเลือกจ่ายได้ทั้งเงินสดหน้าร้านและสแกนจ่ายพร้อมเพย์ (เบอร์ 0837596411 ชื่อบัญชี คำวัง พวงมาลา) ได้ทันทีค่ะ',
    },
  ] as FaqItem[],
  rewardOffers: [
    {
      id: 'rw1',
      title: 'ส่วนลดพิเศษ 20 บาท หรือเพิ่มท็อปปิ้งฟรี 1 อย่าง',
      starsRequired: 25,
      description: 'ใช้ 25 ดาว แลกส่วนลดท้ายบิล 20 บาท หรือเพิ่มไข่ดาว/พิเศษฟรี 1 รายการ',
      terms: 'ใช้สิทธิ์ได้ที่หน้าร้านกุ๊กกิ๊กพาเพลินและครัวแม่วัง แจ้งเบอร์โทรหรือรหัสสมาชิก KKP ก่อนคิดเงินนะคะ',
      expiryDate: '31 ธันวาคม 2569',
      active: true,
    },
    {
      id: 'rw2',
      title: 'ฟรี! อาหารจานเดียวครัวแม่วัง 1 จาน (มูลค่า 50 บาท)',
      starsRequired: 50,
      description: 'ใช้ 50 ดาว แลกฟรีอาหารจานเดียว 1 จาน (ข้าวมันไก่, ข้าวขาหมู, ข้าวผัดกะเพรา หรือก๋วยจั๊บ)',
      terms: 'แลกได้ 1 จานต่อบิล ใช้ได้เฉพาะเมนูที่พร้อมขายในวันนั้นๆ ไม่สามารถเปลี่ยนเป็นเงินสดได้ค่ะ',
      expiryDate: '31 ธันวาคม 2569',
      active: true,
    },
    {
      id: 'rw3',
      title: 'ฟรี! ชุดอิ่มคุ้ม 2 จาน (มูลค่า 100 บาท)',
      starsRequired: 80,
      description: 'ใช้ 80 ดาว แลกฟรีอาหารจานเดียว 2 จาน สำหรับทานคู่หรือสั่งกลับบ้าน',
      terms: 'กรุณาแจ้งสิทธิ์กับแม่ พ่อ พี่เพลิน กุ๊ก หรือกิ๊ก ก่อนสั่งทำค่ะ',
      expiryDate: '31 ธันวาคม 2569',
      active: true,
    },
  ] as RewardOffer[],
  menuItems: [
    {
      id: 'm12',
      barcode: '8850003001',
      name: 'ข้าวมันไก่',
      price: 50,
      stars: 2,
      category: 'อาหารจานเดียว',
      status: 'พร้อมขาย',
    },
    {
      id: 'm13',
      barcode: '8850003002',
      name: 'ข้าวขาหมู',
      price: 50,
      stars: 2,
      category: 'อาหารจานเดียว',
      status: 'พร้อมขาย',
    },
    {
      id: 'm14',
      barcode: '8850003003',
      name: 'ข้าวผัดกะเพรา',
      price: 50,
      stars: 2,
      category: 'อาหารจานเดียว',
      status: 'พร้อมขาย',
    },
    {
      id: 'm15',
      barcode: '8850003004',
      name: 'ก๋วยจั๊บ',
      price: 50,
      stars: 2,
      category: 'อาหารจานเดียว',
      status: 'พร้อมขาย',
    },
    {
      id: 'm16',
      barcode: '8850004001',
      name: 'น้ำเปล่า (1 ขวด)',
      price: 10,
      stars: 1,
      category: 'เครื่องดื่ม',
      status: 'พร้อมขาย',
    },
  ] as MenuItem[],
};
