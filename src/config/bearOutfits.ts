export type BearId = 'papa' | 'mama' | 'sister' | 'twinLeft' | 'twinRight';

export type HairStyle = 'default' | 'curly' | 'parted' | 'spiky' | 'none';
export type GlassesStyle = 'none' | 'round' | 'sunglasses' | 'mint-round';
export type HatStyle = 'none' | 'chef-star' | 'mint-beanie' | 'beret' | 'crown';
export type BowStyle = 'none' | 'pink-polka' | 'mint-ribbon' | 'gold-bowtie';
export type ApronStyle = 'none' | 'denim' | 'mint-chef' | 'peach-cafe';
export type BagStyle = 'none' | 'patchwork' | 'delivery-box' | 'tote-mint';
export type FancyStyle = 'none' | 'rainbow-scarf' | 'royal-cape' | 'hawaii-shirt';

export interface BearOutfit {
  hair: HairStyle;
  glasses: GlassesStyle;
  hat: HatStyle;
  bow: BowStyle;
  apron: ApronStyle;
  bag: BagStyle;
  fancy: FancyStyle;
}

export type BearFamilyOutfits = Record<BearId, BearOutfit>;

export const BEAR_CHARACTERS: Array<{ id: BearId; label: string; role: string }> = [
  { id: 'papa', label: 'พ่อหมี', role: 'ขี่เวสป้าส่งอาหาร' },
  { id: 'mama', label: 'แม่หมี', role: 'เชฟใหญ่ครัวแม่วัง' },
  { id: 'sister', label: 'พี่สาวคนโต', role: 'หมีขาวขนฟูใจดี' },
  { id: 'twinLeft', label: 'แฝดพี่', role: 'ผู้ช่วยหน้าร้าน' },
  { id: 'twinRight', label: 'แฝดน้อง', role: 'สายแฟชั่นสดใส' },
];

export const DEFAULT_BEAR_OUTFITS: BearFamilyOutfits = {
  papa: {
    hair: 'curly',
    glasses: 'round',
    hat: 'none',
    bow: 'none',
    apron: 'none',
    bag: 'delivery-box',
    fancy: 'none',
  },
  mama: {
    hair: 'default',
    glasses: 'none',
    hat: 'chef-star',
    bow: 'none',
    apron: 'mint-chef',
    bag: 'none',
    fancy: 'none',
  },
  sister: {
    hair: 'curly',
    glasses: 'none',
    hat: 'none',
    bow: 'pink-polka',
    apron: 'none',
    bag: 'none',
    fancy: 'none',
  },
  twinLeft: {
    hair: 'none',
    glasses: 'none',
    hat: 'none',
    bow: 'none',
    apron: 'denim',
    bag: 'none',
    fancy: 'none',
  },
  twinRight: {
    hair: 'parted',
    glasses: 'none',
    hat: 'mint-beanie',
    bow: 'none',
    apron: 'none',
    bag: 'patchwork',
    fancy: 'rainbow-scarf',
  },
};

export const OUTFIT_CATALOG = {
  hair: [
    { id: 'default' as HairStyle, label: 'ผมธรรมชาติ' },
    { id: 'curly' as HairStyle, label: 'ผมหยิกลอนคลายๆ' },
    { id: 'parted' as HairStyle, label: 'ปอยผมพาสเทล' },
    { id: 'spiky' as HairStyle, label: 'ผมตั้งเท่ๆ' },
    { id: 'none' as HairStyle, label: 'ไม่ใส่ทรงผม' },
  ],
  glasses: [
    { id: 'none' as GlassesStyle, label: 'ไม่ใส่แว่น' },
    { id: 'round' as GlassesStyle, label: 'แว่นตากรอบกลม' },
    { id: 'mint-round' as GlassesStyle, label: 'แว่นกลมเขียวมิ้น' },
    { id: 'sunglasses' as GlassesStyle, label: 'แว่นกันแดดสุดเท่' },
  ],
  hat: [
    { id: 'none' as HatStyle, label: 'ไม่สวมหมวก' },
    { id: 'chef-star' as HatStyle, label: 'หมวกเชฟปักดาว ⭐' },
    { id: 'mint-beanie' as HatStyle, label: 'หมวกไหมพรมมิ้น' },
    { id: 'beret' as HatStyle, label: 'หมวกเบเร่ต์ครีม' },
    { id: 'crown' as HatStyle, label: 'มงกุฎเจ้าหญิง/ราชา' },
  ],
  bow: [
    { id: 'none' as BowStyle, label: 'ไม่ติดโบว์' },
    { id: 'pink-polka' as BowStyle, label: 'โบว์ชมพูจุดมุก' },
    { id: 'mint-ribbon' as BowStyle, label: 'โบว์เขียวมิ้น' },
    { id: 'gold-bowtie' as BowStyle, label: 'หูกระต่ายทอง' },
  ],
  apron: [
    { id: 'none' as ApronStyle, label: 'ไม่ใส่ผ้ากันเปื้อน' },
    { id: 'mint-chef' as ApronStyle, label: 'ผ้ากันเปื้อนเขียวมิ้น' },
    { id: 'denim' as ApronStyle, label: 'ผ้ากันเปื้อนยีนส์' },
    { id: 'peach-cafe' as ApronStyle, label: 'ผ้ากันเปื้อนพีชละมุน' },
  ],
  bag: [
    { id: 'none' as BagStyle, label: 'ไม่สะพายกระเป๋า' },
    { id: 'patchwork' as BagStyle, label: 'กระเป๋าลายกราฟิก' },
    { id: 'delivery-box' as BagStyle, label: 'กล่อง/กระเป๋าส่งข้าว' },
    { id: 'tote-mint' as BagStyle, label: 'กระเป๋าผ้าเขียวมิ้น' },
  ],
  fancy: [
    { id: 'none' as FancyStyle, label: 'ชุดปกติ' },
    { id: 'rainbow-scarf' as FancyStyle, label: 'ผ้าพันคอสีรุ้ง' },
    { id: 'royal-cape' as FancyStyle, label: 'ผ้าคลุมแฟนซีดาวทอง' },
    { id: 'hawaii-shirt' as FancyStyle, label: 'เสื้อฮาวายสดใส' },
  ],
};

const OUTFIT_STORAGE_KEY = 'kkp_bear_family_outfits_v1';

export function loadBearOutfits(): BearFamilyOutfits {
  try {
    const raw = localStorage.getItem(OUTFIT_STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_BEAR_OUTFITS);
    const parsed = JSON.parse(raw) as Partial<BearFamilyOutfits>;
    return {
      papa: { ...DEFAULT_BEAR_OUTFITS.papa, ...(parsed.papa || {}) },
      mama: { ...DEFAULT_BEAR_OUTFITS.mama, ...(parsed.mama || {}) },
      sister: { ...DEFAULT_BEAR_OUTFITS.sister, ...(parsed.sister || {}) },
      twinLeft: { ...DEFAULT_BEAR_OUTFITS.twinLeft, ...(parsed.twinLeft || {}) },
      twinRight: { ...DEFAULT_BEAR_OUTFITS.twinRight, ...(parsed.twinRight || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_BEAR_OUTFITS);
  }
}

export function saveBearOutfits(outfits: BearFamilyOutfits): void {
  localStorage.setItem(OUTFIT_STORAGE_KEY, JSON.stringify(outfits));
}
