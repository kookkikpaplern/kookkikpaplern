import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Coffee,
  Eye,
  FileImage,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  Utensils,
  X,
} from 'lucide-react';
import { MenuItem } from '../config/shopConfig';
import { BearFamilyOutfits } from '../config/bearOutfits';
import {
  translateCategory,
  translateDeliveryType,
  translateMenuName,
  translateRewardNotice,
  translateTasteNote,
  useLang,
} from '../config/i18n';
import { BillLineItem, CustomerQueueOrder } from '../utils/sheetsSync';
import { playSoftClick } from '../utils/sound';
import { MamaBearMascot, PapaBearVespaMascot } from './BearGangMascot';

interface CustomerMenuPOSProps {
  menuItems: MenuItem[];
  rewardNotice: string;
  onlineOrderEnabled: boolean;
  cartItems: BillLineItem[];
  queueOrders: CustomerQueueOrder[];
  outfits: BearFamilyOutfits;
  foodShopNameTh: string;
  foodShopNameEn: string;
  isMerchantView?: boolean;
  onAddMenuItem: (item: MenuItem, options?: { qty?: number; tasteNote?: string }) => void;
  onChangeQty: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onSubmitOrderPayment: (
    method: 'qr',
    deliveryInfo: {
      deliveryType: 'ทานนี้' | 'กลับบ้าน' | 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง';
      tableNumber?: string;
      customerName: string;
      dropPoint: string;
    }
  ) => void;
  onAcceptQueueOrder?: (orderId: string) => void;
  onMarkQueueDone: (orderId: string) => void;
  onRefreshOrdersFromSheets?: () => Promise<void>;
}

function isDrinkOrSnackCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  return (
    c.includes('เครื่องดื่ม') ||
    c.includes('น้ำ') ||
    c.includes('กาแฟ') ||
    c.includes('ชา') ||
    c.includes('ขนม') ||
    c.includes('drink') ||
    c.includes('snack') ||
    c.includes('coffee') ||
    c.includes('tea')
  );
}

export const CustomerMenuPOS: React.FC<CustomerMenuPOSProps> = ({
  menuItems,
  rewardNotice,
  onlineOrderEnabled,
  cartItems,
  queueOrders,
  outfits,
  foodShopNameTh,
  foodShopNameEn,
  isMerchantView = false,
  onAddMenuItem,
  onChangeQty,
  onClearCart,
  onSubmitOrderPayment,
  onAcceptQueueOrder,
  onMarkQueueDone,
  onRefreshOrdersFromSheets,
}) => {
  const { lang, tx } = useLang();
  // แยกปุ่มสลับหมวดอาหารกับเครื่องดื่มชัดเจน
  const [mainGroup, setMainGroup] = useState<'food' | 'drink'>('food');
  const [subCategory, setSubCategory] = useState('ทั้งหมด');
  const [deliveryType, setDeliveryType] = useState<'ทานนี้' | 'กลับบ้าน' | 'ให้พ่อไปส่ง'>('ทานนี้');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dropPoint, setDropPoint] = useState('');
  const [orderFormError, setOrderFormError] = useState('');
  const tableInputRef = React.useRef<HTMLInputElement>(null);
  const customerNameInputRef = React.useRef<HTMLInputElement>(null);
  const dropPointInputRef = React.useRef<HTMLInputElement>(null);

  // Modal เลือกรสชาติสำหรับเมนูอาหาร
  const [selectedFoodItem, setSelectedFoodItem] = useState<MenuItem | null>(null);
  const [spiceLevel, setSpiceLevel] = useState<string>('');
  const [sweetLevel, setSweetLevel] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [modalQty, setModalQty] = useState<number>(1);
  const [previewOrder, setPreviewOrder] = useState<CustomerQueueOrder | null>(null);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);

  const orderableItems = useMemo(
    () => menuItems.filter((item) => item.price > 0),
    [menuItems]
  );

  const hasFoodItems = useMemo(
    () => orderableItems.some((item) => !isDrinkOrSnackCategory(item.category)),
    [orderableItems]
  );
  const hasDrinkItems = useMemo(
    () => orderableItems.some((item) => isDrinkOrSnackCategory(item.category)),
    [orderableItems]
  );
  const hasSnackItems = useMemo(
    () =>
      orderableItems.some(
        (item) =>
          item.category.toLowerCase().includes('ขนม') ||
          item.category.toLowerCase().includes('snack')
      ),
    [orderableItems]
  );

  const effectiveGroup: 'food' | 'drink' =
    mainGroup === 'drink' && !hasDrinkItems && hasFoodItems
      ? 'food'
      : mainGroup === 'food' && !hasFoodItems && hasDrinkItems
        ? 'drink'
        : mainGroup;

  const groupItems = useMemo(() => {
    return orderableItems.filter((item) => {
      const isDrink = isDrinkOrSnackCategory(item.category);
      return effectiveGroup === 'drink' ? isDrink : !isDrink;
    });
  }, [orderableItems, effectiveGroup]);

  const subCategories = useMemo(() => {
    const set = new Set<string>(['ทั้งหมด']);
    groupItems.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [groupItems]);

  const filteredMenu = useMemo(() => {
    if (subCategory === 'ทั้งหมด') return groupItems;
    return groupItems.filter((m) => m.category === subCategory);
  }, [groupItems, subCategory]);

  // คิวที่ 1 อยู่บนสุดเสมอ
  const sortedActiveQueue = useMemo(() => {
    return [...queueOrders]
      .filter((q) => q.status === 'กำลังทำ')
      .sort((a, b) => a.queueNo - b.queueNo);
  }, [queueOrders]);

  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartStars = cartItems.reduce((sum, i) => sum + i.stars * i.qty, 0);
  const activeFoodName = lang === 'en' ? foodShopNameEn : foodShopNameTh;

  return (
    <div className="space-y-5">
      {/* Krua Mae Wang Banner + Reward Notice */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div
          className="md:col-span-5 rounded-2xl border px-4 py-3 flex items-center justify-between gap-2"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--accent-border)',
            color: 'var(--accent-text)',
          }}
        >
          <div>
            <p className="font-bold text-base">
              🍲 {activeFoodName} ({lang === 'en' ? foodShopNameTh : foodShopNameEn})
            </p>
            <p className="text-xs opacity-85">
              {tx(
                'แยกยอดลงแท็บ "ขายจริง_ครัวแม่วัง" · สะสมดาวร่วมกันได้',
                'Synced to Krua Mae Wang sales · Shared star loyalty across both shops'
              )}
            </p>
          </div>
        </div>
        <div
          className="md:col-span-7 rounded-2xl border px-5 py-3 flex items-center justify-center text-center font-semibold text-base"
          style={{
            backgroundColor: 'var(--pastel-peach)',
            borderColor: 'var(--border-soft)',
            color: 'var(--pastel-peach-text)',
          }}
        >
          {translateRewardNotice(rewardNotice, lang)}
        </div>
      </div>

      {!onlineOrderEnabled && (
        <div
          className="rounded-2xl border px-5 py-4 text-center font-semibold"
          style={{
            backgroundColor: 'var(--pastel-pink)',
            borderColor: 'var(--border-soft)',
            color: 'var(--pastel-pink-text)',
          }}
        >
          {tx(
            'ขณะนี้ร้านพักรับออเดอร์ออนไลน์ชั่วคราวค่ะ กรุณาสั่งที่หน้าร้านนะคะ',
            'Online ordering is temporarily paused. Please order directly at the counter!'
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Clear Food / Drink Main Toggle + Sub-categories + Square Menu Grid */}
        <div className="lg:col-span-8 space-y-4">
          {/* Main Food vs Drink Switcher (แสดงเมื่อมีรายการทั้ง 2 หมวด) */}
          {hasFoodItems && hasDrinkItems && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setMainGroup('food');
                  setSubCategory('ทั้งหมด');
                }}
                className="h-14 rounded-2xl border-2 font-bold text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
                style={{
                  backgroundColor: effectiveGroup === 'food' ? 'var(--accent-primary)' : 'var(--bg-card)',
                  borderColor: effectiveGroup === 'food' ? 'var(--accent-primary)' : 'var(--border-soft)',
                  color: effectiveGroup === 'food' ? '#FFFFFF' : 'var(--text-main)',
                }}
              >
                <Utensils className="w-5 h-5" />
                {tx('หมวดอาหาร / กับข้าว', 'Food & Rice Dishes')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setMainGroup('drink');
                  setSubCategory('ทั้งหมด');
                }}
                className="h-14 rounded-2xl border-2 font-bold text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
                style={{
                  backgroundColor: effectiveGroup === 'drink' ? 'var(--accent-primary)' : 'var(--bg-card)',
                  borderColor: effectiveGroup === 'drink' ? 'var(--accent-primary)' : 'var(--border-soft)',
                  color: effectiveGroup === 'drink' ? '#FFFFFF' : 'var(--text-main)',
                }}
              >
                <Coffee className="w-5 h-5" />
                {hasSnackItems
                  ? tx('หมวดเครื่องดื่ม & ขนม', 'Drinks & Snacks')
                  : tx('หมวดเครื่องดื่ม', 'Drinks')}
              </button>
            </div>
          )}

          {/* Sub-category Filter Tabs */}
          {subCategories.length > 2 && (
            <div className="flex flex-wrap gap-2">
              {subCategories.map((cat) => {
                const active = subCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setSubCategory(cat);
                    }}
                    className="px-4 py-2 rounded-2xl border text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-card)',
                      borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: active ? 'var(--accent-text)' : 'var(--text-main)',
                    }}
                  >
                    {translateCategory(cat, lang)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Square Menu Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredMenu.map((item) => {
              const isOutOfStock = item.status === 'หมด';
              const disabled = isOutOfStock || !onlineOrderEnabled;
              const isFood = !isDrinkOrSnackCategory(item.category);
              const totalInCartQty = cartItems
                .filter((c) => (c.menuItemId || c.id) === item.id)
                .reduce((sum, c) => sum + c.qty, 0);
              const displayName = translateMenuName(item.name, lang);
              const displayCategory = translateCategory(item.category, lang);

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    playSoftClick();
                    if (isFood) {
                      setSelectedFoodItem(item);
                      setSpiceLevel('');
                      setSweetLevel('');
                      setCustomNote('');
                      setModalQty(1);
                    } else {
                      onAddMenuItem(item);
                    }
                  }}
                  className="group text-left rounded-3xl border overflow-hidden flex flex-col transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed shadow-sm"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: totalInCartQty > 0 ? 'var(--accent-primary)' : 'var(--border-soft)',
                  }}
                >
                  <div
                    className="relative aspect-square w-full overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-subtle)' }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={displayName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                        {effectiveGroup === 'food' ? (
                          <Utensils className="w-10 h-10 opacity-45" style={{ color: 'var(--accent-text)' }} />
                        ) : (
                          <Coffee className="w-10 h-10 opacity-45" style={{ color: 'var(--accent-text)' }} />
                        )}
                        <span className="text-xs font-medium opacity-75" style={{ color: 'var(--text-muted)' }}>
                          {displayCategory}
                        </span>
                      </div>
                    )}

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center p-2">
                        <span className="px-3 py-1.5 rounded-xl bg-white/95 text-rose-700 font-bold text-sm">
                          {tx('หมดชั่วคราว', 'Sold Out')}
                        </span>
                      </div>
                    )}

                    {totalInCartQty > 0 && !isOutOfStock && (
                      <div
                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full font-num font-bold text-sm text-white flex items-center justify-center shadow"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      >
                        {totalInCartQty}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold leading-snug line-clamp-2" style={{ color: 'var(--text-main)' }}>
                      {displayName}
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-num text-lg font-bold tabular-nums" style={{ color: 'var(--accent-text)' }}>
                        ฿{item.price}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: '#B45309' }}>
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        +{item.stars}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Mama Bear (หน้ารับออเดอร์อาหาร) & Papa Bear on Mint Vespa (หน้าส่งอาหาร) */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. หน้ารับออเดอร์อาหาร -> แม่หมีหมวกเชฟ */}
          <div className="pt-1">
            <div className="-mb-3.5 relative z-10 px-4">
              <MamaBearMascot pose="peeking" outfits={outfits} />
            </div>

            <div
              className="relative z-20 rounded-3xl border-2 p-5 shadow-sm space-y-4"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--accent-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  {tx(`รับออเดอร์ (${foodShopNameTh})`, `Order (${foodShopNameEn})`)}
                </h2>
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="text-xs px-2.5 py-1 rounded-xl font-medium cursor-pointer"
                    style={{
                      backgroundColor: 'var(--pastel-pink)',
                      color: 'var(--pastel-pink-text)',
                    }}
                  >
                    {tx('ล้างตะกร้า', 'Clear Cart')}
                  </button>
                )}
              </div>

              {cartItems.length === 0 ? (
                <p
                  className="text-sm text-center py-5 rounded-2xl border border-dashed"
                  style={{ borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
                >
                  {tx(
                    'แม่หมีรอรับออเดอร์อยู่ค่ะ จิ้มเลือกอาหารทางซ้ายได้เลย',
                    'Mama Bear is ready! Tap dishes or drinks on the left to add.'
                  )}
                </p>
              ) : (
                <ul className="divide-y max-h-48 overflow-y-auto pr-1" style={{ borderColor: 'var(--border-soft)' }}>
                  {cartItems.map((item) => (
                    <li key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                          {translateMenuName(item.name, lang)}
                        </p>
                        {item.tasteNote && (
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--accent-text)' }}>
                            {translateTasteNote(item.tasteNote, lang)}
                          </p>
                        )}
                        <p className="text-xs font-num" style={{ color: 'var(--text-muted)' }}>
                          ฿{item.price} × {item.qty}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onChangeQty(item.id, -1)}
                          className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                          aria-label={tx('ลดจำนวน', 'Decrease quantity')}
                        >
                          {item.qty === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-500" /> : <Minus className="w-3.5 h-3.5" />}
                        </button>
                        <span className="w-6 text-center font-num font-bold text-sm">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => onChangeQty(item.id, 1)}
                          className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                          aria-label={tx('เพิ่มจำนวน', 'Increase quantity')}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* รูปแบบการรับอาหาร: ทานนี้ / กลับบ้าน / ให้พ่อไปส่ง + ช่องโต๊ะที่ */}
              <div className="border-t pt-3 space-y-2.5" style={{ borderColor: 'var(--border-soft)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('เลือกรูปแบบการรับอาหาร', 'Select Dining Option')}
                </p>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setDeliveryType('ทานนี้');
                      setOrderFormError('');
                    }}
                    className="py-2.5 px-2 rounded-2xl border-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                    style={{
                      backgroundColor: deliveryType === 'ทานนี้' ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                      borderColor: deliveryType === 'ทานนี้' ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: deliveryType === 'ทานนี้' ? '#FFFFFF' : 'var(--text-main)',
                    }}
                  >
                    <Utensils className="w-3.5 h-3.5 shrink-0" />
                    {tx('ทานนี้', 'Dine-in')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setDeliveryType('กลับบ้าน');
                      setOrderFormError('');
                    }}
                    className="py-2.5 px-2 rounded-2xl border-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                    style={{
                      backgroundColor: deliveryType === 'กลับบ้าน' ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                      borderColor: deliveryType === 'กลับบ้าน' ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: deliveryType === 'กลับบ้าน' ? '#FFFFFF' : 'var(--text-main)',
                    }}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    {tx('กลับบ้าน', 'Takeaway')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setDeliveryType('ให้พ่อไปส่ง');
                      setOrderFormError('');
                    }}
                    className="py-2.5 px-2 rounded-2xl border-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                    style={{
                      backgroundColor: deliveryType === 'ให้พ่อไปส่ง' ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                      borderColor: deliveryType === 'ให้พ่อไปส่ง' ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: deliveryType === 'ให้พ่อไปส่ง' ? '#FFFFFF' : 'var(--text-main)',
                    }}
                  >
                    <Truck className="w-3.5 h-3.5 shrink-0" />
                    {tx('ให้พ่อไปส่ง', 'Delivery')}
                  </button>
                </div>

                {deliveryType === 'ทานนี้' && (
                  <div className="space-y-1">
                    <div
                      className="flex items-center rounded-2xl border-2 overflow-hidden transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor:
                          orderFormError && !tableNumber.trim()
                            ? '#E11D48'
                            : tableNumber.trim()
                              ? 'var(--accent-primary)'
                              : 'var(--accent-border)',
                      }}
                    >
                      <span
                        className="px-3.5 py-2.5 font-bold text-sm sm:text-base shrink-0 select-none border-r"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent-text)',
                          borderColor: 'var(--accent-border)',
                        }}
                      >
                        {tx('โต๊ะที่', 'Table')}
                      </span>
                      <input
                        ref={tableInputRef}
                        type="text"
                        value={tableNumber}
                        onChange={(e) => {
                          setTableNumber(e.target.value);
                          if (orderFormError) setOrderFormError('');
                        }}
                        placeholder={tx('พิมพ์เลขโต๊ะ เช่น 7', 'e.g. 7')}
                        aria-label={tx('โต๊ะที่', 'Table number')}
                        className="w-full h-11 px-3.5 text-base font-num font-bold bg-transparent focus:outline-none"
                        style={{ color: 'var(--text-main)' }}
                      />
                    </div>
                    <p className="text-[11px] px-1" style={{ color: 'var(--text-muted)' }}>
                      {tx('เติมเลขโต๊ะในช่องว่างได้เลยค่ะ (เช่น 7)', 'Enter your table number in the blank (e.g. 7)')}
                    </p>
                  </div>
                )}

                {deliveryType === 'กลับบ้าน' && (
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={tx('ชื่อผู้สั่ง / ชื่อเล่น (ไม่บังคับ)', 'Your name (optional)')}
                    className="w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-soft)',
                      color: 'var(--text-main)',
                    }}
                  />
                )}

                {deliveryType === 'ให้พ่อไปส่ง' && (
                  <div className="space-y-2">
                    <input
                      ref={customerNameInputRef}
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (orderFormError) setOrderFormError('');
                      }}
                      placeholder={tx('ชื่อผู้สั่ง * (เช่น น้องมิ้น)', 'Your name * (e.g. Mint)')}
                      className="w-full h-11 px-3.5 rounded-xl border-2 text-sm focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor:
                          orderFormError && !customerName.trim() ? '#E11D48' : 'var(--border-soft)',
                        color: 'var(--text-main)',
                      }}
                    />
                    <input
                      ref={dropPointInputRef}
                      type="text"
                      value={dropPoint}
                      onChange={(e) => {
                        setDropPoint(e.target.value);
                        if (orderFormError) setOrderFormError('');
                      }}
                      placeholder={tx('จุดส่ง * (เช่น หน้าตึก 2 / บ้านเลขที่)', 'Drop-off spot * (e.g. Building 2 / House No.)')}
                      className="w-full h-11 px-3.5 rounded-xl border-2 text-sm focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor:
                          orderFormError && !dropPoint.trim() ? '#E11D48' : 'var(--border-soft)',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>
                )}

                {orderFormError && (
                  <div
                    className="rounded-xl px-3 py-2 text-xs font-bold"
                    style={{ backgroundColor: '#FFE4E6', color: '#BE123C' }}
                  >
                    {orderFormError}
                  </div>
                )}
              </div>

              {/* Total & Pay */}
              <div className="border-t pt-3 space-y-3" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                    {tx(`ยอดรวม (${cartStars} ดาว ⭐)`, `Total (+${cartStars} Stars ⭐)`)}
                  </p>
                  <span className="font-num text-3xl font-bold tabular-nums" style={{ color: 'var(--accent-text)' }}>
                    ฿{cartTotal.toLocaleString('th-TH')}
                  </span>
                </div>

                {(() => {
                  const handlePayClick = () => {
                    if (!isMerchantView) {
                      if (deliveryType === 'ทานนี้' && !tableNumber.trim()) {
                        setOrderFormError(
                          tx(
                            'กรุณากรอกเลขโต๊ะในช่อง "โต๊ะที่" ก่อนกดชำระเงินนะคะ (เช่น 7)',
                            'Please enter your table number before checking out (e.g. 7).'
                          )
                        );
                        tableInputRef.current?.focus();
                        return;
                      }
                      if (deliveryType === 'ให้พ่อไปส่ง' && !customerName.trim()) {
                        setOrderFormError(
                          tx(
                            'กรุณากรอกชื่อผู้สั่งก่อนนะคะ พ่อจะได้เรียกชื่อถูกค่ะ',
                            'Please enter your name so Papa Bear knows who ordered.'
                          )
                        );
                        customerNameInputRef.current?.focus();
                        return;
                      }
                      if (deliveryType === 'ให้พ่อไปส่ง' && !dropPoint.trim()) {
                        setOrderFormError(
                          tx(
                            'กรุณากรอกจุดส่งอาหารก่อนนะคะ พ่อจะได้ไปส่งถูกที่ค่ะ',
                            'Please enter your drop-off spot for delivery.'
                          )
                        );
                        dropPointInputRef.current?.focus();
                        return;
                      }
                    }
                    setOrderFormError('');
                    onSubmitOrderPayment('qr', {
                      deliveryType,
                      tableNumber: deliveryType === 'ทานนี้' ? tableNumber.trim() : undefined,
                      customerName,
                      dropPoint,
                    });
                  };

                  return (
                    <div className="space-y-2">
                      <p
                        className="text-[11px] font-semibold text-center rounded-xl px-2.5 py-1.5 border"
                        style={{
                          backgroundColor: 'var(--pastel-blue)',
                          borderColor: 'var(--border-soft)',
                          color: 'var(--pastel-blue-text)',
                        }}
                      >
                        {tx(
                          'รับชำระผ่านการสแกน QR เท่านั้น',
                          'QR scan payment only'
                        )}
                      </p>
                      <button
                        type="button"
                        disabled={cartTotal <= 0 || !onlineOrderEnabled}
                        onClick={handlePayClick}
                        className="w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 transition-transform active:scale-95"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                        }}
                      >
                        <QrCode className="w-5 h-5" />
                        {tx('สแกนจ่าย QR', 'Scan QR')}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 2. หน้าจัดการออเดอร์ & ตรวจสลิป (ฝั่งร้านค้า / คิวจัดส่ง) */}
          <div
            className="rounded-3xl border p-5 shadow-sm space-y-4"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-soft)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {isMerchantView
                    ? tx('จัดการออเดอร์ & ตรวจสลิป', 'Order Management & Slip Check')
                    : tx('หน้าส่งอาหาร & คิวจัดส่ง', 'Delivery & Order Queue')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {tx(
                    'พ่อหมีพร้อมขี่เวสป้าไปส่ง · คิวที่ 1 บนสุดเสมอ',
                    'Papa Bear on his Mint Vespa · Queue #1 always on top'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isMerchantView && onRefreshOrdersFromSheets && (
                  <button
                    type="button"
                    disabled={isRefreshingOrders}
                    onClick={async () => {
                      playSoftClick();
                      setIsRefreshingOrders(true);
                      try {
                        await onRefreshOrdersFromSheets();
                      } finally {
                        setIsRefreshingOrders(false);
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)', color: 'var(--accent-text)' }}
                    title={tx('ดึงออเดอร์ออนไลน์ล่าสุดจาก Google Sheets', 'Refresh online orders from Google Sheets')}
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
                    {tx('รีเฟรช', 'Refresh')}
                  </button>
                )}
                <span className="text-xs font-num font-semibold" style={{ color: 'var(--accent-text)' }}>
                  {sortedActiveQueue.length} {tx('คิว', 'orders')}
                </span>
              </div>
            </div>

            {/* Papa Bear on Mint Vespa */}
            <div
              className="rounded-2xl border py-2 px-3 flex flex-col items-center"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            >
              <PapaBearVespaMascot pose="delivering" outfits={outfits} />
            </div>

            {/* Current Dining / Delivery Selection Summary */}
            <div
              className="rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-bold"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent-border)',
                color: 'var(--accent-text)',
              }}
            >
              <span>
                {tx('รูปแบบออเดอร์ปัจจุบัน:', 'Current Order Type:')}{' '}
                {translateDeliveryType(deliveryType, lang)}
                {deliveryType === 'ทานนี้' && tableNumber.trim()
                  ? ` · ${tx('โต๊ะที่', 'Table')} ${tableNumber.trim()}`
                  : ''}
              </span>
            </div>

            {/* Active Queue List (Queue #1 on top) */}
            {sortedActiveQueue.length === 0 ? (
              <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                {tx('ยังไม่มีคิวรอส่งค่ะ', 'No pending delivery orders')}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
                {sortedActiveQueue.map((q) => (
                  <div
                    key={q.orderId}
                    className="rounded-2xl border p-3 space-y-2"
                    style={{
                      backgroundColor: q.queueNo === sortedActiveQueue[0]?.queueNo ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                      borderColor: q.slipImageUrl && !q.accepted ? '#16A34A' : 'var(--border-soft)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                            {tx(`คิวที่ ${q.queueNo}`, `Queue #${q.queueNo}`)} · {translateDeliveryType(q.deliveryType, lang)}
                          </p>
                          {isMerchantView && (q.tableNumber || (q.deliveryType === 'ทานนี้' && q.dropPoint)) && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold font-num"
                              style={{ backgroundColor: 'var(--accent-primary)', color: '#FFFFFF' }}
                            >
                              {q.tableNumber ? tx(`โต๊ะที่ ${q.tableNumber}`, `Table ${q.tableNumber}`) : q.dropPoint}
                            </span>
                          )}
                          <span className="font-num text-xs font-extrabold" style={{ color: 'var(--accent-text)' }}>
                            ฿{q.totalAmount.toLocaleString('th-TH')}
                          </span>
                        </div>

                        {/* Status Badges: Slip Attached + Acceptance */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {q.slipImageUrl && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold"
                              style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {tx('แนบสลิปแล้ว', 'Slip Attached')}
                            </span>
                          )}
                          {q.accepted ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold"
                              style={{ backgroundColor: 'var(--pastel-blue)', color: 'var(--pastel-blue-text)' }}
                            >
                              <Check className="w-3 h-3" />
                              {tx('รับออเดอร์แล้ว', 'Accepted')}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold"
                              style={{ backgroundColor: 'var(--pastel-peach)', color: 'var(--pastel-peach-text)' }}
                            >
                              {tx('รอร้านกดรับ', 'Pending Accept')}
                            </span>
                          )}
                        </div>

                        {isMerchantView && (q.customerName || (q.dropPoint && !q.tableNumber)) && (
                          <p className="text-xs mt-1 font-medium" style={{ color: 'var(--accent-text)' }}>
                            {q.customerName} {q.dropPoint && !q.tableNumber ? `(${q.dropPoint})` : ''}
                          </p>
                        )}
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                          {q.items
                            .map(
                              (i) =>
                                `${translateMenuName(i.name, lang)}${
                                  i.tasteNote ? ` (${translateTasteNote(i.tasteNote, lang)})` : ''
                                } ×${i.qty}`
                            )
                            .join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Action Row: Prominent View Slip (Merchant Only) + Merchant Accept / Done */}
                    {isMerchantView && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {q.slipImageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                playSoftClick();
                                setPreviewOrder(q);
                              }}
                              className="px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              style={{
                                backgroundColor: 'var(--bg-card)',
                                borderColor: 'var(--accent-primary)',
                                color: 'var(--accent-text)',
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {tx('ดูรูปสลิป', 'View Slip')}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {!q.accepted && onAcceptQueueOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                playSoftClick();
                                onAcceptQueueOrder(q.orderId);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                              style={{ backgroundColor: '#16A34A' }}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {tx('รับออเดอร์', 'Accept')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onMarkQueueDone(q.orderId)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                            style={{ backgroundColor: 'var(--accent-primary)' }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {tx('ส่งแล้ว', 'Done')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal เลือกรสชาติอาหาร (เผ็ดน้อย/กลาง/มาก · หวานน้อย/กลาง/มาก) */}
      {selectedFoodItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--accent-border)',
            }}
          >
            <div
              className="flex items-center justify-between gap-3 px-5 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-12 h-12 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
                >
                  {selectedFoodItem.imageUrl ? (
                    <img
                      src={selectedFoodItem.imageUrl}
                      alt={translateMenuName(selectedFoodItem.name, lang)}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Utensils className="w-5 h-5 opacity-55" style={{ color: 'var(--accent-text)' }} />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold truncate" style={{ color: 'var(--text-main)' }}>
                    {translateMenuName(selectedFoodItem.name, lang)}
                  </h3>
                  <p className="text-sm font-num font-bold" style={{ color: 'var(--accent-text)' }}>
                    ฿{selectedFoodItem.price} · {tx('เลือกรสชาติได้ตามชอบ', 'Customize your taste')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFoodItem(null)}
                className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 cursor-pointer"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                aria-label={tx('ปิดหน้าต่าง', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Spiciness Selection */}
              <div className="space-y-2">
                <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('ระดับความเผ็ด (ไม่บังคับ)', 'Spiciness Level (Optional)')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { th: 'ไม่เผ็ด', en: 'No Spice' },
                    { th: 'เผ็ดน้อย', en: 'Mild' },
                    { th: 'เผ็ดกลาง', en: 'Medium' },
                    { th: 'เผ็ดมาก', en: 'Very Spicy' },
                  ].map((opt) => {
                    const active = spiceLevel === opt.th;
                    return (
                      <button
                        key={opt.th}
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setSpiceLevel((prev) => (prev === opt.th ? '' : opt.th));
                        }}
                        className="py-2.5 px-2 rounded-2xl border-2 text-sm font-bold cursor-pointer transition-all active:scale-95"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                          color: active ? '#FFFFFF' : 'var(--text-main)',
                        }}
                      >
                        {tx(opt.th, opt.en)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sweetness Selection */}
              <div className="space-y-2">
                <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('ระดับความหวาน (ไม่บังคับ)', 'Sweetness Level (Optional)')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { th: 'หวานน้อย', en: 'Less Sweet' },
                    { th: 'หวานกลาง', en: 'Medium Sweet' },
                    { th: 'หวานมาก', en: 'Very Sweet' },
                  ].map((opt) => {
                    const active = sweetLevel === opt.th;
                    return (
                      <button
                        key={opt.th}
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setSweetLevel((prev) => (prev === opt.th ? '' : opt.th));
                        }}
                        className="py-2.5 px-2 rounded-2xl border-2 text-sm font-bold cursor-pointer transition-all active:scale-95"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                          color: active ? '#FFFFFF' : 'var(--text-main)',
                        }}
                      >
                        {tx(opt.th, opt.en)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Custom Note */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('เพิ่มเติมให้คุณแม่ (ถ้ามี)', 'Extra Note (Optional)')}
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder={tx('เช่น ไม่ใส่ผัก, ไข่ดาวไม่สุก, แยกน้ำ', 'e.g. No veggies, runny egg, sauce separate')}
                  className="w-full h-11 px-3.5 rounded-2xl border text-sm focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-soft)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Quantity Stepper */}
              <div
                className="flex items-center justify-between rounded-2xl border px-4 py-3"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              >
                <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('จำนวนที่สั่ง', 'Quantity')}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={modalQty <= 1}
                    onClick={() => {
                      playSoftClick();
                      setModalQty((q) => Math.max(1, q - 1));
                    }}
                    className="w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer disabled:opacity-40"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    aria-label={tx('ลดจำนวน', 'Decrease quantity')}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-num text-lg font-bold">{modalQty}</span>
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setModalQty((q) => q + 1);
                    }}
                    className="w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    aria-label={tx('เพิ่มจำนวน', 'Increase quantity')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t grid grid-cols-3 gap-2.5 shrink-0" style={{ borderColor: 'var(--border-soft)' }}>
              <button
                type="button"
                onClick={() => setSelectedFoodItem(null)}
                className="h-13 rounded-2xl border font-bold text-sm cursor-pointer"
                style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
              >
                {tx('ยกเลิก', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  const notes = [spiceLevel, sweetLevel, customNote.trim()].filter(Boolean);
                  const tasteNote = notes.length > 0 ? notes.join(', ') : undefined;
                  onAddMenuItem(selectedFoodItem, { qty: modalQty, tasteNote });
                  setSelectedFoodItem(null);
                }}
                className="col-span-2 h-13 rounded-2xl font-bold text-base text-white cursor-pointer transition-transform active:scale-[0.98]"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {tx(
                  `เพิ่มลงตะกร้า · ฿${(selectedFoodItem.price * modalQty).toLocaleString('th-TH')}`,
                  `Add to Order · ฿${(selectedFoodItem.price * modalQty).toLocaleString('en-US')}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ตรวจสอบรูปสลิปโอนเงินขนาดชัดเจนพร้อมข้อมูลออเดอร์ */}
      {isMerchantView && previewOrder && previewOrder.slipImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewOrder(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <div>
                <h4 className="font-bold text-base flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                  <FileImage className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  {tx('ตรวจสอบหลักฐานสลิปโอนเงิน', 'Verify Transfer Slip')}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {tx(`คิวที่ ${previewOrder.queueNo}`, `Queue #${previewOrder.queueNo}`)} · #{previewOrder.orderId} ·{' '}
                  <span className="font-num font-bold" style={{ color: 'var(--accent-text)' }}>
                    ฿{previewOrder.totalAmount.toLocaleString('th-TH')}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                aria-label={tx('ปิดหน้าต่าง', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex justify-center bg-stone-50 overflow-y-auto">
              <img
                src={previewOrder.slipImageUrl}
                alt={tx('สลิปโอนเงินลูกค้า', 'Customer transfer slip')}
                className="max-h-[62vh] w-auto rounded-2xl object-contain border border-stone-200 shadow-sm"
              />
            </div>

            <div
              className="p-4 border-t space-y-2.5 shrink-0"
              style={{ borderColor: 'var(--border-soft)', backgroundColor: 'var(--bg-canvas)' }}
            >
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>
                  {previewOrder.customerName || translateDeliveryType(previewOrder.deliveryType, lang)}
                  {previewOrder.dropPoint ? ` (${previewOrder.dropPoint})` : ''}
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg font-bold"
                  style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                >
                  {tx('แนบสลิปแล้ว', 'Slip Attached')}
                </span>
              </div>

              {isMerchantView && !previewOrder.accepted && onAcceptQueueOrder ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOrder(null)}
                    className="h-11 rounded-xl border text-xs font-bold cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  >
                    {tx('ปิด', 'Close')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      onAcceptQueueOrder(previewOrder.orderId);
                      setPreviewOrder(null);
                    }}
                    className="col-span-2 h-11 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: '#16A34A' }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {tx('สลิปถูกต้อง · กดรับออเดอร์ ✓', 'Slip Valid · Accept Order ✓')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreviewOrder(null)}
                  className="w-full h-11 rounded-xl font-bold text-sm text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  {tx('ปิดหน้าต่าง', 'Close')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
