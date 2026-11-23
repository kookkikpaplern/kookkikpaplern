import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Barcode,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  GripVertical,
  Home,
  LogOut,
  MessageCircleQuestion,
  RotateCcw,
  Settings,
  UtensilsCrossed,
  Video,
} from 'lucide-react';
import { FaqItem, MenuItem, RewardOffer, SHOP_CONFIG, StaffUser, ThemeId } from './config/shopConfig';
import {
  LanguageToggleButton,
  translateMenuName,
  translateStaffName,
  useLang,
} from './config/i18n';
import {
  BearFamilyOutfits,
  loadBearOutfits,
  saveBearOutfits,
} from './config/bearOutfits';
import { WelcomeLanding } from './components/WelcomeLanding';
import { QuickFaqModal } from './components/QuickFaqModal';
import { MemberRewardsModal } from './components/MemberRewardsModal';
import { AuthGate } from './components/AuthGate';
import { ShopLogoFrame } from './components/ShopLogoFrame';
import { CalculatorPOS } from './components/CalculatorPOS';
import { CustomerMenuPOS } from './components/CustomerMenuPOS';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import {
  CashPaymentModal,
  PaymentSuccessOverlay,
  QrPaymentModal,
} from './components/PaymentModals';
import { AdminSettingsModal, AdminSettingsTab } from './components/AdminSettingsModal';
import { BearGuideModal } from './components/BearGuideModal';
import { DressingRoomModal } from './components/DressingRoomModal';
import { AiBuddyDrawer } from './components/AiBuddyDrawer';
import { CallPeerSummary, RemoteWatchModal } from './components/RemoteWatchModal';
import {
  BillLineItem,
  CustomerQueueOrder,
  flushOfflineQueue,
  getTodayDateKey,
  loadCachedFaqs,
  loadCachedMenu,
  loadCachedRewardOffers,
  loadCachedStaffUsers,
  loadDailyTestMode,
  postToSheets,
  recordSilentVoid,
  saveCachedFaqs,
  saveCachedMenu,
  saveCachedRewardOffers,
  saveDailyTestMode,
  saveSaleHistoryLog,
  syncAllFromSheets,
} from './utils/sheetsSync';
import { playScanError, playScanSuccess, playSoftClick, playSuccessChime } from './utils/sound';

const KEYS = {
  CONFIG_VER: 'kkp_config_version',
  ORG_VERIFIED: 'kkp_org_verified',
  ORG_CODE: 'kkp_org_code_value',
  SHOP_LOGO: 'kkp_shop_logo_dataurl',
  THEME: 'kkp_theme_id',
  SHOP_NAME_TH: 'kkp_shop_name_th',
  SHOP_NAME_EN: 'kkp_shop_name_en',
  FOOD_NAME_TH: 'kkp_food_shop_name_th',
  FOOD_NAME_EN: 'kkp_food_shop_name_en',
  PROMPTPAY: 'kkp_promptpay_id',
  PROMPTPAY_NAME: 'kkp_promptpay_account_name',
  SCRIPT_URL: 'kkp_script_url',
  REWARD_NOTICE: 'kkp_reward_notice',
  PROMO_TITLE: 'kkp_promo_title',
  PROMO_SUBTITLE: 'kkp_promo_subtitle',
  FAQ_BUBBLE: 'kkp_faq_bubble_text',
  FAQ_TITLE: 'kkp_faq_modal_title',
  FAQ_SUBTITLE: 'kkp_faq_modal_subtitle',
  ONLINE_ORDER: 'kkp_online_order_enabled',
  AUTO_CHECK: 'kkp_auto_payment_check',
  QUEUE: 'kkp_customer_queue',
  TOOLBAR_ORDER: 'kkp_toolbar_order',
};

const CURRENT_CONFIG_VERSION = '2027_kkp_clean_v3';

function ensureLatestShopConfig(): void {
  try {
    const prevVer = localStorage.getItem(KEYS.CONFIG_VER);
    if (prevVer === CURRENT_CONFIG_VERSION) return;

    localStorage.setItem(KEYS.ORG_CODE, SHOP_CONFIG.orgCode);
    localStorage.removeItem(KEYS.ORG_VERIFIED);
    localStorage.setItem(KEYS.PROMPTPAY, SHOP_CONFIG.promptPayId);
    localStorage.setItem(KEYS.PROMPTPAY_NAME, SHOP_CONFIG.promptPayAccountName);
    localStorage.setItem(KEYS.PROMO_SUBTITLE, SHOP_CONFIG.promoSubtitle);

    if (prevVer === '2027_kkp_clean_v2') {
      const rawMenu = localStorage.getItem('kkp_menu_cache');
      if (rawMenu) {
        try {
          const parsed = JSON.parse(rawMenu) as MenuItem[];
          const hasWater = parsed.some((m) => m.id === 'm16' || m.name.includes('น้ำเปล่า'));
          const waterItem = SHOP_CONFIG.menuItems.find((m) => m.id === 'm16');
          if (!hasWater && waterItem) {
            localStorage.setItem('kkp_menu_cache', JSON.stringify([...parsed, waterItem]));
          }
        } catch {
          localStorage.removeItem('kkp_menu_cache');
        }
      }
    } else {
      localStorage.removeItem('kkp_staff_cache');
      localStorage.removeItem('kkp_menu_cache');
      localStorage.removeItem('kkp_faq_cache');
      localStorage.removeItem('kkp_reward_offers_cache');
      localStorage.removeItem('kkp_sale_logs');
      localStorage.removeItem('kkp_silent_void_logs');
      localStorage.removeItem('kkp_customer_queue');
      localStorage.removeItem('kkp_offline_sheets_queue');
      localStorage.removeItem('kkp_members_cache');
      localStorage.setItem('kkp_is_test_mode', 'false');
    }

    localStorage.setItem(KEYS.CONFIG_VER, CURRENT_CONFIG_VERSION);
  } catch {
    // Ignore storage quota errors
  }
}

ensureLatestShopConfig();

type ToolbarItemId =
  | 'modeSwitch'
  | 'watchShop'
  | 'dressing'
  | 'guide'
  | 'testMode'
  | 'importExcel'
  | 'summary'
  | 'settings';

const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'modeSwitch',
  'watchShop',
  'dressing',
  'guide',
  'testMode',
  'importExcel',
  'summary',
  'settings',
];

type ViewScreen = 'welcome' | 'customer' | 'staff-auth' | 'staff-pos';

export default function App() {
  const { lang, tx } = useLang();

  // Navigation & Auth State
  const [viewScreen, setViewScreen] = useState<ViewScreen>('welcome');
  const [isOrgVerified, setIsOrgVerified] = useState<boolean>(
    () => localStorage.getItem(KEYS.ORG_VERIFIED) === 'true'
  );
  const [orgCode, setOrgCode] = useState<string>(
    () => localStorage.getItem(KEYS.ORG_CODE) || SHOP_CONFIG.orgCode
  );
  const [staffUsers, setStaffUsers] = useState<Record<string, StaffUser>>(
    () => loadCachedStaffUsers() || SHOP_CONFIG.staffUsers
  );
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);

  // Settings & Theme State (seeded from SHOP_CONFIG + localStorage + Sheets sync)
  const [themeId, setThemeId] = useState<ThemeId>(
    () => (localStorage.getItem(KEYS.THEME) as ThemeId) || 'mint-earth'
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(() => localStorage.getItem(KEYS.SHOP_LOGO));
  const [shopNameTh, setShopNameTh] = useState<string>(
    () => localStorage.getItem(KEYS.SHOP_NAME_TH) || SHOP_CONFIG.shopNameTh
  );
  const [shopNameEn, setShopNameEn] = useState<string>(
    () => localStorage.getItem(KEYS.SHOP_NAME_EN) || SHOP_CONFIG.shopNameEn
  );
  const [foodShopNameTh, setFoodShopNameTh] = useState<string>(
    () => localStorage.getItem(KEYS.FOOD_NAME_TH) || SHOP_CONFIG.foodShopNameTh
  );
  const [foodShopNameEn, setFoodShopNameEn] = useState<string>(
    () => localStorage.getItem(KEYS.FOOD_NAME_EN) || SHOP_CONFIG.foodShopNameEn
  );
  const [promptPayId, setPromptPayId] = useState<string>(
    () => localStorage.getItem(KEYS.PROMPTPAY) || SHOP_CONFIG.promptPayId
  );
  const [promptPayAccountName, setPromptPayAccountName] = useState<string>(
    () => localStorage.getItem(KEYS.PROMPTPAY_NAME) || SHOP_CONFIG.promptPayAccountName
  );
  const [scriptUrl, setScriptUrl] = useState<string>(
    () => localStorage.getItem(KEYS.SCRIPT_URL) || SHOP_CONFIG.scriptUrl
  );
  const [rewardNotice, setRewardNotice] = useState<string>(
    () => localStorage.getItem(KEYS.REWARD_NOTICE) || SHOP_CONFIG.rewardNotice
  );
  const [promoTitle, setPromoTitle] = useState<string>(
    () => localStorage.getItem(KEYS.PROMO_TITLE) || SHOP_CONFIG.promoTitle
  );
  const [promoSubtitle, setPromoSubtitle] = useState<string>(
    () => localStorage.getItem(KEYS.PROMO_SUBTITLE) || SHOP_CONFIG.promoSubtitle
  );
  const [faqBubbleText, setFaqBubbleText] = useState<string>(
    () => localStorage.getItem(KEYS.FAQ_BUBBLE) || SHOP_CONFIG.faqBubbleText
  );
  const [faqModalTitle, setFaqModalTitle] = useState<string>(
    () => localStorage.getItem(KEYS.FAQ_TITLE) || SHOP_CONFIG.faqModalTitle
  );
  const [faqModalSubtitle, setFaqModalSubtitle] = useState<string>(
    () => localStorage.getItem(KEYS.FAQ_SUBTITLE) || SHOP_CONFIG.faqModalSubtitle
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(() => loadCachedFaqs() || SHOP_CONFIG.faqs);
  const [rewardOffers, setRewardOffers] = useState<RewardOffer[]>(
    () => loadCachedRewardOffers() || SHOP_CONFIG.rewardOffers
  );
  const [onlineOrderEnabled, setOnlineOrderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(KEYS.ONLINE_ORDER);
    return saved === null ? true : saved === 'true';
  });
  const [enableAutoPaymentCheck, setEnableAutoPaymentCheck] = useState<boolean>(() => {
    const saved = localStorage.getItem(KEYS.AUTO_CHECK);
    return saved === null ? SHOP_CONFIG.enableAutoPaymentCheck : saved === 'true';
  });
  const [isTestMode, setIsTestMode] = useState<boolean>(() => loadDailyTestMode());

  // Family Outfits State (5 Bears)
  const [bearOutfits, setBearOutfits] = useState<BearFamilyOutfits>(() => loadBearOutfits());

  // POS Mode & Menu State
  const [posMode, setPosMode] = useState<'calculator' | 'menu'>('calculator');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(
    () => loadCachedMenu() || SHOP_CONFIG.menuItems
  );
  const [billItems, setBillItems] = useState<BillLineItem[]>([]);
  const [menuCart, setMenuCart] = useState<BillLineItem[]>([]);
  const [queueOrders, setQueueOrders] = useState<CustomerQueueOrder[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.QUEUE);
      return raw ? (JSON.parse(raw) as CustomerQueueOrder[]) : [];
    } catch {
      return [];
    }
  });

  // Modals & Notifications
  const [scannerOpen, setScannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<AdminSettingsTab>('general');
  const [guideOpen, setGuideOpen] = useState(false);
  const [dressingOpen, setDressingOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [callPeers, setCallPeers] = useState<CallPeerSummary[]>([]);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [memberRewardsOpen, setMemberRewardsOpen] = useState(false);
  const [scanToast, setScanToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Customizable Top Toolbar Order State
  const [toolbarOrder, setToolbarOrder] = useState<ToolbarItemId[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.TOOLBAR_ORDER);
      if (!raw) return DEFAULT_TOOLBAR_ORDER;
      const parsed = JSON.parse(raw) as ToolbarItemId[];
      const valid = parsed.filter((id) => DEFAULT_TOOLBAR_ORDER.includes(id));
      const missing = DEFAULT_TOOLBAR_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    } catch {
      return DEFAULT_TOOLBAR_ORDER;
    }
  });
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggedToolbarId, setDraggedToolbarId] = useState<ToolbarItemId | null>(null);
  const [dragOverToolbarId, setDragOverToolbarId] = useState<ToolbarItemId | null>(null);

  // Payment Checkout Context
  const [checkoutState, setCheckoutState] = useState<{
    step: 'idle' | 'cash' | 'qr' | 'success';
    amount: number;
    stars: number;
    source: 'calculator' | 'menu';
    method: 'เงินสด' | 'สแกน QR';
    deliveryInfo?: { deliveryType: 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง'; customerName: string; dropPoint: string };
  }>({
    step: 'idle',
    amount: 0,
    stars: 0,
    source: 'calculator',
    method: 'เงินสด',
  });

  // Apply selected theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(KEYS.THEME, themeId);
  }, [themeId]);

  // Persist Queue
  useEffect(() => {
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(queueOrders));
  }, [queueOrders]);

  // Daily auto-reset check (every minute + on mount)
  useEffect(() => {
    const checkDateReset = () => {
      const actual = loadDailyTestMode();
      setIsTestMode(actual);
    };
    const timer = window.setInterval(checkDateReset, 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Real-time WebSocket observer for Remote Shop Call room presence
  useEffect(() => {
    if (viewScreen !== 'staff-pos' || !currentUser) {
      setCallPeers([]);
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    const observerId = `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const connectObserver = () => {
      if (closed) return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${proto}//${window.location.host}/ws/call`);
        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: 'room:join',
              roomId: orgCode,
              clientId: observerId,
              role: 'observer',
              name: currentUser.name,
            })
          );
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as {
              type?: string;
              peers?: CallPeerSummary[];
            };
            if (msg.type === 'room:state' && Array.isArray(msg.peers)) {
              setCallPeers(msg.peers);
            }
          } catch {
            // Ignore malformed payload
          }
        };
        ws.onclose = () => {
          if (!closed) {
            reconnectTimer = window.setTimeout(connectObserver, 4000);
          }
        };
      } catch {
        // Ignore WS connection errors
      }
    };

    connectObserver();
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore close errors
        }
      }
    };
  }, [viewScreen, currentUser, orgCode]);

  // Sync all backend tabs from Google Sheets
  const syncAllBackendNow = useCallback(async (): Promise<string> => {
    if (!scriptUrl || !scriptUrl.trim()) {
      return tx(
        'กรุณาใส่ลิงก์ Google Apps Script Web App URL ก่อนซิงค์นะคะ',
        'Please enter your Google Apps Script Web App URL before syncing.'
      );
    }
    const synced = await syncAllFromSheets(scriptUrl);
    if (!synced) {
      return tx(
        'ไม่สามารถดึงข้อมูลจาก Google Sheets ได้ กรุณาตรวจสอบลิงก์หรือสิทธิ์การ Deploy (Anyone) ค่ะ',
        'Unable to fetch from Google Sheets. Please check the URL or Deploy permission (Anyone).'
      );
    }

    const parts: string[] = [];

    if (synced.settings) {
      const s = synced.settings;
      if (s.orgCode) {
        setOrgCode(s.orgCode);
        localStorage.setItem(KEYS.ORG_CODE, s.orgCode);
      }
      if (s.shopNameTh) {
        setShopNameTh(s.shopNameTh);
        localStorage.setItem(KEYS.SHOP_NAME_TH, s.shopNameTh);
      }
      if (s.shopNameEn) {
        setShopNameEn(s.shopNameEn);
        localStorage.setItem(KEYS.SHOP_NAME_EN, s.shopNameEn);
      }
      if (s.foodShopNameTh) {
        setFoodShopNameTh(s.foodShopNameTh);
        localStorage.setItem(KEYS.FOOD_NAME_TH, s.foodShopNameTh);
      }
      if (s.foodShopNameEn) {
        setFoodShopNameEn(s.foodShopNameEn);
        localStorage.setItem(KEYS.FOOD_NAME_EN, s.foodShopNameEn);
      }
      if (s.promptPayId) {
        setPromptPayId(s.promptPayId);
        localStorage.setItem(KEYS.PROMPTPAY, s.promptPayId);
      }
      if (s.promptPayAccountName) {
        setPromptPayAccountName(s.promptPayAccountName);
        localStorage.setItem(KEYS.PROMPTPAY_NAME, s.promptPayAccountName);
      }
      if (s.rewardNotice) {
        setRewardNotice(s.rewardNotice);
        localStorage.setItem(KEYS.REWARD_NOTICE, s.rewardNotice);
      }
      if (s.promoTitle) {
        setPromoTitle(s.promoTitle);
        localStorage.setItem(KEYS.PROMO_TITLE, s.promoTitle);
      }
      if (s.promoSubtitle) {
        setPromoSubtitle(s.promoSubtitle);
        localStorage.setItem(KEYS.PROMO_SUBTITLE, s.promoSubtitle);
      }
      if (s.faqBubbleText) {
        setFaqBubbleText(s.faqBubbleText);
        localStorage.setItem(KEYS.FAQ_BUBBLE, s.faqBubbleText);
      }
      if (s.faqModalTitle) {
        setFaqModalTitle(s.faqModalTitle);
        localStorage.setItem(KEYS.FAQ_TITLE, s.faqModalTitle);
      }
      if (s.faqModalSubtitle) {
        setFaqModalSubtitle(s.faqModalSubtitle);
        localStorage.setItem(KEYS.FAQ_SUBTITLE, s.faqModalSubtitle);
      }
      if (s.onlineOrderEnabled !== undefined) {
        const val = s.onlineOrderEnabled.toLowerCase() !== 'false';
        setOnlineOrderEnabled(val);
        localStorage.setItem(KEYS.ONLINE_ORDER, String(val));
      }
      if (s.enableAutoPaymentCheck !== undefined) {
        const val = s.enableAutoPaymentCheck.toLowerCase() === 'true';
        setEnableAutoPaymentCheck(val);
        localStorage.setItem(KEYS.AUTO_CHECK, String(val));
      }
      parts.push(tx('ตั้งค่าระบบ', 'System Settings'));
    }

    if (synced.menu && synced.menu.length > 0) {
      setMenuItems(synced.menu);
      parts.push(tx(`เมนู ${synced.menu.length} รายการ`, `${synced.menu.length} menu items`));
    }

    if (synced.staffUsers && Object.keys(synced.staffUsers).length > 0) {
      setStaffUsers(synced.staffUsers);
      parts.push(tx(`ผู้ใช้งาน ${Object.keys(synced.staffUsers).length} คน`, `${Object.keys(synced.staffUsers).length} users`));
    }

    if (synced.faqs && synced.faqs.length > 0) {
      setFaqs(synced.faqs);
      parts.push(tx(`ถาม-ตอบ ${synced.faqs.length} ข้อ`, `${synced.faqs.length} FAQs`));
    }

    if (synced.rewardOffers && synced.rewardOffers.length > 0) {
      setRewardOffers(synced.rewardOffers);
      parts.push(tx(`ของรางวัลแลกดาว ${synced.rewardOffers.length} รายการ`, `${synced.rewardOffers.length} reward offers`));
    }

    return parts.length > 0
      ? tx(
          `ซิงค์ข้อมูลจาก Google Sheets สำเร็จ: ${parts.join(', ')}`,
          `Synced from Google Sheets: ${parts.join(', ')}`
        )
      : tx(
          'เชื่อมต่อสำเร็จ แต่ยังไม่มีข้อมูลในแท็บของชีตค่ะ',
          'Connected, but no data found in the sheet tabs yet.'
        );
  }, [scriptUrl, tx]);

  useEffect(() => {
    if (scriptUrl) {
      syncAllBackendNow();
      flushOfflineQueue(scriptUrl);
    }
    const onOnline = () => {
      flushOfflineQueue(scriptUrl);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [scriptUrl, syncAllBackendNow]);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setScanToast({ type, text });
    window.setTimeout(() => setScanToast(null), 2600);
  }, []);

  // Barcode scan handler with 0.8s anti-duplicate lock
  const lastBarcodeScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const handleBarcodeLookup = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();
      if (now - lastBarcodeScanRef.current.time < 800 && code === lastBarcodeScanRef.current.code) {
        return;
      }
      lastBarcodeScanRef.current = { code, time: now };

      const matched = menuItems.find((m) => m.barcode === code);
      if (!matched) {
        playScanError();
        showToast(
          'err',
          tx(`ไม่พบบาร์โค้ด "${code}" ในระบบสินค้าค่ะ`, `Barcode "${code}" not found in catalog.`)
        );
        return;
      }

      playScanSuccess();
      setBillItems((prev) => {
        const idx = prev.findIndex((i) => i.id === matched.id);
        if (idx >= 0) {
          return prev.map((item, i) => (i === idx ? { ...item, qty: item.qty + 1 } : item));
        }
        return [
          ...prev,
          {
            id: matched.id,
            name: matched.name,
            price: matched.price,
            qty: 1,
            stars: matched.stars,
            barcode: matched.barcode,
          },
        ];
      });
      const itemLabel = translateMenuName(matched.name, lang);
      showToast(
        'ok',
        tx(`เพิ่ม "${itemLabel}" (฿${matched.price}) แล้วค่ะ`, `Added "${itemLabel}" (฿${matched.price})`)
      );
    },
    [menuItems, showToast, lang, tx]
  );

  // Global USB / Bluetooth Barcode Scanner listener (only in Staff POS)
  useEffect(() => {
    if (viewScreen !== 'staff-pos' || !currentUser) return;
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (checkoutState.step !== 'idle' || settingsOpen || guideOpen || dressingOpen || watchOpen || faqModalOpen) return;

      const now = Date.now();
      if (now - lastKeyTime > 120) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          handleBarcodeLookup(buffer);
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewScreen, currentUser, checkoutState.step, settingsOpen, guideOpen, dressingOpen, watchOpen, faqModalOpen, handleBarcodeLookup]);

  // Silent Void Logging for removing item / clearing bill
  const handleRemoveBillItem = (index: number) => {
    if (!currentUser) return;
    playSoftClick();
    const removed = billItems[index];
    setBillItems((prev) => prev.filter((_, i) => i !== index));
    if (removed) {
      recordSilentVoid(scriptUrl, {
        staffName: currentUser.name,
        staffRole: currentUser.role,
        action: 'ลบรายการ',
        detail: `${removed.name} ×${removed.qty}`,
        amount: removed.price * removed.qty,
      });
    }
  };

  const handleClearBill = () => {
    if (!currentUser) return;
    if (billItems.length > 0) {
      const totalAmt = billItems.reduce((s, i) => s + i.price * i.qty, 0);
      const summary = billItems.map((i) => `${i.name} ×${i.qty}`).join(', ');
      recordSilentVoid(scriptUrl, {
        staffName: currentUser.name,
        staffRole: currentUser.role,
        action: 'ล้างบิล',
        detail: summary,
        amount: totalAmt,
      });
    }
    setBillItems([]);
  };

  // Complete Payment & Send to Google Sheets (แยกแท็บ ขายจริง_หน้าร้าน / ขายจริง_ครัวแม่วัง / ทดสอบระบบ)
  const finalizeSalePayment = useCallback(async () => {
    const actorUser: StaffUser = currentUser || { name: 'ลูกค้าสั่งเอง', role: 'cashier' };
    playSuccessChime();

    const activeItems = checkoutState.source === 'calculator' ? billItems : menuCart;
    const totalAmt = checkoutState.amount;
    const totalStars =
      checkoutState.stars > 0
        ? checkoutState.stars
        : Math.max(1, Math.floor(totalAmt / 20) || 1);

    const itemsSummary =
      activeItems.length > 0
        ? activeItems
            .map((i) => `${i.name}${i.tasteNote ? ` (${i.tasteNote})` : ''} ×${i.qty}`)
            .join(', ')
        : `คิดเงินรวม ฿${totalAmt}`;

    const isKrua = checkoutState.source === 'menu';
    const realTabName = isKrua ? 'ขายจริง_ครัวแม่วัง' : 'ขายจริง_หน้าร้าน';
    const sheetTab = isTestMode ? 'ทดสอบระบบ' : realTabName;
    const modeLabel: 'ขายจริง' | 'ทดสอบระบบ' = isTestMode ? 'ทดสอบระบบ' : 'ขายจริง';
    const billId = `B${Date.now().toString().slice(-6)}`;
    const activeShopName = isKrua ? foodShopNameTh : shopNameTh;

    const deliveryStr = checkoutState.deliveryInfo
      ? `${checkoutState.deliveryInfo.deliveryType}${
          checkoutState.deliveryInfo.customerName ? ` - ${checkoutState.deliveryInfo.customerName}` : ''
        }${checkoutState.deliveryInfo.dropPoint ? ` (${checkoutState.deliveryInfo.dropPoint})` : ''}`
      : 'หน้าร้าน';

    saveSaleHistoryLog({
      id: billId,
      timestamp: new Date().toLocaleString('th-TH'),
      dateKey: getTodayDateKey(),
      shopType: isKrua ? 'krua' : 'store',
      shopName: activeShopName,
      mode: modeLabel,
      staffName: actorUser.name,
      paymentMethod: checkoutState.method,
      totalAmount: totalAmt,
      totalStars,
      itemsSummary,
      deliveryInfo: deliveryStr,
    });

    if (isKrua && menuCart.length > 0) {
      setQueueOrders((prev) => {
        const nextQueueNo = prev.length > 0 ? Math.max(...prev.map((q) => q.queueNo)) + 1 : 1;
        return [
          ...prev,
          {
            queueNo: nextQueueNo,
            orderId: billId,
            items: menuCart,
            totalAmount: totalAmt,
            totalStars,
            deliveryType: checkoutState.deliveryInfo?.deliveryType || 'รับเองที่ร้าน',
            customerName: checkoutState.deliveryInfo?.customerName,
            dropPoint: checkoutState.deliveryInfo?.dropPoint,
            createdAt: new Date().toISOString(),
            status: 'กำลังทำ',
          },
        ];
      });
    }

    postToSheets(scriptUrl, sheetTab, {
      billId,
      mode: sheetTab,
      shopBrand: activeShopName,
      staffName: actorUser.name,
      paymentMethod: checkoutState.method,
      totalAmount: totalAmt,
      totalStars,
      itemsSummary,
      deliveryInfo: deliveryStr,
    });

    if (checkoutState.source === 'calculator') {
      setBillItems([]);
    } else {
      setMenuCart([]);
    }

    setCheckoutState((prev) => ({
      ...prev,
      step: 'success',
      stars: totalStars,
    }));
  }, [currentUser, checkoutState, billItems, menuCart, isTestMode, scriptUrl, foodShopNameTh, shopNameTh]);

  // 1. WELCOME LANDING SCREEN (หน้าแรกต้อนรับลูกค้า + ป้ายโฆษณา + ถาม-ตอบด่วน)
  if (viewScreen === 'welcome') {
    return (
      <>
        <WelcomeLanding
          shopNameTh={shopNameTh}
          shopNameEn={shopNameEn}
          foodShopNameTh={foodShopNameTh}
          foodShopNameEn={foodShopNameEn}
          promoTitle={promoTitle}
          promoSubtitle={promoSubtitle}
          rewardNotice={rewardNotice}
          faqBubbleText={faqBubbleText}
          logoUrl={logoUrl}
          outfits={bearOutfits}
          onEnterCustomerOrder={() => {
            setPosMode('menu');
            setViewScreen('customer');
          }}
          onOpenMemberRewards={() => setMemberRewardsOpen(true)}
          onEnterStaffLogin={() => {
            setViewScreen('staff-auth');
          }}
          onOpenFaqModal={() => setFaqModalOpen(true)}
        />
        <QuickFaqModal
          isOpen={faqModalOpen}
          onClose={() => setFaqModalOpen(false)}
          faqs={faqs}
          shopNameTh={shopNameTh}
          foodShopNameTh={foodShopNameTh}
          faqModalTitle={faqModalTitle}
          faqModalSubtitle={faqModalSubtitle}
        />
        <MemberRewardsModal
          isOpen={memberRewardsOpen}
          onClose={() => setMemberRewardsOpen(false)}
          rewardOffers={rewardOffers}
          shopNameTh={shopNameTh}
          foodShopNameTh={foodShopNameTh}
        />
      </>
    );
  }

  // 2. STAFF 2-LAYER AUTH GATE
  if (viewScreen === 'staff-auth' || (viewScreen === 'staff-pos' && !currentUser)) {
    return (
      <AuthGate
        orgCodeExpected={orgCode}
        staffUsers={staffUsers}
        shopNameTh={shopNameTh}
        shopNameEn={shopNameEn}
        isOrgVerified={isOrgVerified}
        outfits={bearOutfits}
        onOrgVerified={() => {
          localStorage.setItem(KEYS.ORG_VERIFIED, 'true');
          setIsOrgVerified(true);
        }}
        onResetOrgCode={() => {
          localStorage.removeItem(KEYS.ORG_VERIFIED);
          setIsOrgVerified(false);
        }}
        onBackToWelcome={() => setViewScreen('welcome')}
        onAuthenticated={(_pin, user) => {
          setCurrentUser(user);
          setViewScreen('staff-pos');
        }}
      />
    );
  }

  // 3. CUSTOMER SELF-ORDER SCREEN (ลูกค้ากดสั่งซื้อเอง ไม่ต้องใส่ PIN)
  if (viewScreen === 'customer') {
    const guestUser: StaffUser = { name: 'ลูกค้าสั่งเอง', role: 'cashier' };
    return (
      <div className="min-h-screen pb-14" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-main)' }}>
        <header
          className="sticky top-0 z-30 border-b backdrop-blur-md"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-card) 92%, transparent)',
            borderColor: 'var(--border-soft)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setViewScreen('welcome');
                }}
                className="h-11 px-3.5 rounded-2xl border font-semibold text-sm flex items-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              >
                <ArrowLeft className="w-4 h-4" />
                {tx('หน้าแรก', 'Home')}
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold leading-tight">
                  {lang === 'en'
                    ? `🍲 ${foodShopNameEn} 🍲 · ⭐ ${shopNameEn} ⭐`
                    : `🍲 ${foodShopNameTh} 🍲 · ⭐ ${shopNameTh} ⭐`}
                </h1>
                <p className="text-xs font-en" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'en'
                    ? `${foodShopNameTh} & ${shopNameTh} · Self-Order Food & Drinks`
                    : `${foodShopNameEn} & ${shopNameEn} · สั่งอาหารและเครื่องดื่มด้วยตนเอง`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <LanguageToggleButton compact />
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setFaqModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: 'var(--pastel-blue)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--pastel-blue-text)',
                }}
              >
                <MessageCircleQuestion className="w-4 h-4" />
                {tx('💬 ถาม-ตอบด่วน', '💬 Quick FAQ')}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <CustomerMenuPOS
            menuItems={menuItems}
            rewardNotice={rewardNotice}
            onlineOrderEnabled={onlineOrderEnabled}
            cartItems={menuCart}
            queueOrders={queueOrders}
            outfits={bearOutfits}
            foodShopNameTh={foodShopNameTh}
            foodShopNameEn={foodShopNameEn}
            onAddMenuItem={(item, options) => {
              const tasteNote = options?.tasteNote?.trim() || undefined;
              const qtyToAdd = options?.qty && options.qty > 0 ? options.qty : 1;
              const lineId = tasteNote ? `${item.id}__${tasteNote}` : item.id;
              setMenuCart((prev) => {
                const idx = prev.findIndex((c) => c.id === lineId);
                if (idx >= 0) {
                  return prev.map((c, i) => (i === idx ? { ...c, qty: c.qty + qtyToAdd } : c));
                }
                return [
                  ...prev,
                  {
                    id: lineId,
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    qty: qtyToAdd,
                    stars: item.stars,
                    barcode: item.barcode,
                    tasteNote,
                  },
                ];
              });
            }}
            onChangeQty={(itemId, delta) => {
              setMenuCart((prev) =>
                prev
                  .map((c) => (c.id === itemId ? { ...c, qty: c.qty + delta } : c))
                  .filter((c) => c.qty > 0)
              );
            }}
            onClearCart={() => setMenuCart([])}
            onSubmitOrderPayment={(method, deliveryInfo) => {
              const total = menuCart.reduce((s, i) => s + i.price * i.qty, 0);
              const stars = menuCart.reduce((s, i) => s + i.stars * i.qty, 0);
              setCheckoutState({
                step: method,
                amount: total,
                stars,
                source: 'menu',
                method: method === 'cash' ? 'เงินสด' : 'สแกน QR',
                deliveryInfo,
              });
            }}
            onMarkQueueDone={(orderId) => {
              playSoftClick();
              setQueueOrders((prev) =>
                prev.map((q) => (q.orderId === orderId ? { ...q, status: 'เสร็จแล้ว' } : q))
              );
            }}
          />
        </main>

        <QuickFaqModal
          isOpen={faqModalOpen}
          onClose={() => setFaqModalOpen(false)}
          faqs={faqs}
          shopNameTh={shopNameTh}
          foodShopNameTh={foodShopNameTh}
          faqModalTitle={faqModalTitle}
          faqModalSubtitle={faqModalSubtitle}
        />

        <CashPaymentModal
          isOpen={checkoutState.step === 'cash'}
          amount={checkoutState.amount}
          items={menuCart}
          onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
          onConfirmPaid={finalizeSalePayment}
        />

        <QrPaymentModal
          isOpen={checkoutState.step === 'qr'}
          amount={checkoutState.amount}
          items={menuCart}
          promptPayId={promptPayId}
          promptPayAccountName={promptPayAccountName}
          shopNameTh={foodShopNameTh}
          enableAutoPaymentCheck={enableAutoPaymentCheck}
          scriptUrl={scriptUrl}
          mascotMode="krua"
          outfits={bearOutfits}
          onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
          onConfirmPaid={finalizeSalePayment}
        />

        <PaymentSuccessOverlay
          isOpen={checkoutState.step === 'success'}
          amount={checkoutState.amount}
          earnedStars={checkoutState.stars}
          shopNameTh={shopNameTh}
          shopNameEn={shopNameEn}
          staffUser={guestUser}
          staffUsers={staffUsers}
          scriptUrl={scriptUrl}
          mascotMode="krua"
          outfits={bearOutfits}
          onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
        />
      </div>
    );
  }

  // 4. STAFF POS SCREEN
  const activeUser = currentUser!;
  const isAdmin = activeUser.role === 'admin';
  const activeHeaderTh = posMode === 'menu' ? `🍲 ${foodShopNameTh} 🍲` : `⭐ ${shopNameTh} ⭐`;
  const activeHeaderEn = posMode === 'menu' ? foodShopNameEn : shopNameEn;
  const activeHeaderPrimary =
    lang === 'en'
      ? posMode === 'menu'
        ? `🍲 ${foodShopNameEn} 🍲`
        : `⭐ ${shopNameEn} ⭐`
      : activeHeaderTh;
  const activeHeaderSecondary = lang === 'en' ? activeHeaderTh : activeHeaderEn;

  return (
    <div
      className="min-h-screen pb-20"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-main)' }}
    >
      {/* Prominent Full-Width Test Mode Warning Banner */}
      {isTestMode && (
        <div className="bg-orange-600 text-white px-4 py-3 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm sm:text-base font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                {tx(
                  '⚠️ กำลังอยู่ใน "โหมดทดสอบระบบ" — ยอดขายจะส่งเข้าแท็บ "ทดสอบระบบ" เท่านั้น (ไม่ปนกับยอดขายจริง)',
                  '⚠️ "Test Mode" Active — Sales sync to the "Test" tab only (not mixed with live sales)'
                )}
              </span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setIsTestMode(false);
                  saveDailyTestMode(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-white text-orange-700 font-bold text-xs sm:text-sm cursor-pointer shrink-0"
              >
                {tx('สลับกลับโหมดขายจริง', 'Switch to Live Mode')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean 2-Row Staff Shop Header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-card) 94%, transparent)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
          {/* Top Row: Left Brand + Top-Right Distinct Home & Logout + Language Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: 52x52 Photo Frame + Dynamic 2-Line Shop Name */}
            <div className="flex items-center gap-3 min-w-0">
              <ShopLogoFrame
                logoUrl={logoUrl}
                onUpdateLogo={(dataUrl) => {
                  localStorage.setItem(KEYS.SHOP_LOGO, dataUrl);
                  setLogoUrl(dataUrl);
                }}
              />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold leading-tight truncate">
                  {activeHeaderPrimary}
                </h1>
                <p className="text-xs sm:text-sm font-en font-medium flex flex-wrap items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <span>
                    {activeHeaderSecondary} · {tx('พนักงาน', 'Staff')}: {translateStaffName(activeUser.name, lang)}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold"
                    style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                  >
                    ● {tx('พร้อมใช้งาน', 'Ready')}
                  </span>
                </p>
              </div>
            </div>

            {/* Top-Right: Language Toggle + Home vs Logout Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
              <LanguageToggleButton compact />

              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setIsReorderMode(false);
                  setCurrentUser(null);
                  setViewScreen('welcome');
                }}
                className="px-3.5 py-2 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-transform active:scale-95"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-main)',
                }}
              >
                <Home className="w-4 h-4" />
                {tx('กลับหน้าแรก', 'Home')}
              </button>

              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setIsReorderMode(false);
                  setCurrentUser(null);
                  setViewScreen('staff-auth');
                }}
                className="px-3.5 py-2 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-transform active:scale-95"
                style={{
                  backgroundColor: 'var(--pastel-pink)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--pastel-pink-text)',
                }}
              >
                <LogOut className="w-4 h-4" />
                {tx('ออกจากระบบ', 'Logout')}
              </button>
            </div>
          </div>

          {/* Bottom Toolbar Row: Reorderable Action Buttons (Drag & Drop + Arrow Controls) */}
          {(() => {
            const visibleIds = toolbarOrder.filter((id) => {
              if (!isAdmin && ['testMode', 'importExcel', 'summary', 'settings'].includes(id)) {
                return false;
              }
              return true;
            });

            const persistOrder = (next: ToolbarItemId[]) => {
              setToolbarOrder(next);
              localStorage.setItem(KEYS.TOOLBAR_ORDER, JSON.stringify(next));
            };

            const moveVisibleItem = (id: ToolbarItemId, direction: -1 | 1) => {
              playSoftClick();
              const visIdx = visibleIds.indexOf(id);
              const targetVisIdx = visIdx + direction;
              if (visIdx < 0 || targetVisIdx < 0 || targetVisIdx >= visibleIds.length) return;
              const targetId = visibleIds[targetVisIdx];
              const next = [...toolbarOrder];
              const a = next.indexOf(id);
              const b = next.indexOf(targetId);
              if (a < 0 || b < 0) return;
              [next[a], next[b]] = [next[b], next[a]];
              persistOrder(next);
            };

            const handleDropOnItem = (targetId: ToolbarItemId) => {
              if (!draggedToolbarId || draggedToolbarId === targetId) {
                setDraggedToolbarId(null);
                setDragOverToolbarId(null);
                return;
              }
              playSoftClick();
              const next = [...toolbarOrder];
              const fromIdx = next.indexOf(draggedToolbarId);
              const toIdx = next.indexOf(targetId);
              if (fromIdx >= 0 && toIdx >= 0) {
                next.splice(fromIdx, 1);
                next.splice(toIdx, 0, draggedToolbarId);
                persistOrder(next);
              }
              setDraggedToolbarId(null);
              setDragOverToolbarId(null);
            };

            const renderToolbarItem = (id: ToolbarItemId) => {
              switch (id) {
                case 'modeSwitch':
                  return (
                    <div
                      className="flex items-center gap-1 p-1 rounded-2xl border"
                      style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isReorderMode) return;
                          playSoftClick();
                          setPosMode('calculator');
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor: posMode === 'calculator' ? 'var(--bg-card)' : 'transparent',
                          color: posMode === 'calculator' ? 'var(--accent-text)' : 'var(--text-muted)',
                        }}
                      >
                        <Calculator className="w-4 h-4" />
                        {tx('เครื่องคิดเลขแม่', "Mom's Calculator")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isReorderMode) return;
                          playSoftClick();
                          setPosMode('menu');
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor: posMode === 'menu' ? 'var(--bg-card)' : 'transparent',
                          color: posMode === 'menu' ? 'var(--accent-text)' : 'var(--text-muted)',
                        }}
                      >
                        <UtensilsCrossed className="w-4 h-4" />
                        {lang === 'en' ? foodShopNameEn : foodShopNameTh} / {tx('สั่งอาหาร', 'Orders')}
                      </button>
                    </div>
                  );
                case 'watchShop': {
                  const momWaiting = callPeers.some((p) => p.role === 'shop');
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReorderMode) return;
                        playSoftClick();
                        setWatchOpen(true);
                      }}
                      className="px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: momWaiting ? '#FFEDD5' : 'var(--accent-soft)',
                        borderColor: momWaiting ? '#EA580C' : 'var(--accent-border)',
                        color: momWaiting ? '#9A3412' : 'var(--accent-text)',
                      }}
                    >
                      <Video className="w-4 h-4" />
                      {momWaiting
                        ? tx('เฝ้าร้านแทนแม่ (แม่รอสาย)', 'Watch Shop (Mom Waiting)')
                        : tx('เฝ้าร้านแทนแม่', 'Video Call Shop')}
                    </button>
                  );
                }
                case 'dressing':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReorderMode) return;
                        playSoftClick();
                        setDressingOpen(true);
                      }}
                      className="px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: 'var(--pastel-pink)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--pastel-pink-text)',
                      }}
                    >
                      {tx('👗 ห้องแต่งตัว', '👗 Dressing Room')}
                    </button>
                  );
                case 'guide':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReorderMode) return;
                        playSoftClick();
                        setGuideOpen(true);
                      }}
                      className="px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: 'var(--pastel-peach)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--pastel-peach-text)',
                      }}
                    >
                      {tx('🐻 น้องหมีสอนใช้', '🐻 Bear Guide')}
                    </button>
                  );
                case 'testMode':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReorderMode) return;
                        playSoftClick();
                        const next = !isTestMode;
                        setIsTestMode(next);
                        saveDailyTestMode(next);
                      }}
                      className="px-3 py-2.5 rounded-2xl border text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: isTestMode ? '#FFEDD5' : 'var(--accent-soft)',
                        borderColor: isTestMode ? '#EA580C' : 'var(--accent-border)',
                        color: isTestMode ? '#9A3412' : 'var(--accent-text)',
                      }}
                    >
                      {isTestMode ? tx('🟠 โหมดทดสอบ', '🟠 Test Mode') : tx('🟢 โหมดขายจริง', '🟢 Live Mode')}
                    </button>
                  );
                case 'importExcel':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReorderMode) return;
                        playSoftClick();
                        setSettingsInitialTab('products');
                        setSettingsOpen(true);
                      }}
                      className="px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--accent-border)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      <Barcode className="w-4 h-4" />
                      {tx('นำเข้าสินค้า Excel', 'Import Excel')}
                    </button>
                  );
                case 'summary':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReorderMode) return;
                        playSoftClick();
                        setSettingsInitialTab('summary');
                        setSettingsOpen(true);
                      }}
                      className="px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: 'var(--pastel-blue)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--pastel-blue-text)',
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {tx('สรุปยอด / LINE / Excel', 'Summary / LINE / Excel')}
                    </button>
                  );
                case 'settings':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReorderMode) return;
                        playSoftClick();
                        setSettingsInitialTab('general');
                        setSettingsOpen(true);
                      }}
                      className="px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--text-main)',
                      }}
                    >
                      <Settings className="w-4 h-4" />
                      {tx('ตั้งค่า', 'Settings')}
                    </button>
                  );
              }
            };

            return (
              <div className="space-y-1.5">
                {isReorderMode && (
                  <div
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2"
                    style={{ backgroundColor: 'var(--pastel-peach)', color: 'var(--pastel-peach-text)' }}
                  >
                    <span>
                      {tx(
                        '✨ โหมดย้ายตำแหน่งปุ่ม: กดลูกศร ◀ ▶ หรือลากปุ่มวางสลับตำแหน่งตามความถนัดได้เลยค่ะ',
                        '✨ Reorder Mode: Use ◀ ▶ arrows or drag & drop buttons to customize your toolbar.'
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        persistOrder(DEFAULT_TOOLBAR_ORDER);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/80 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {tx('รีเซ็ตลำดับ', 'Reset Order')}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {visibleIds.map((id, idx) => {
                    const isDragged = draggedToolbarId === id;
                    const isOver = dragOverToolbarId === id && draggedToolbarId !== id;
                    return (
                      <div
                        key={id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedToolbarId(id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverToolbarId !== id) setDragOverToolbarId(id);
                        }}
                        onDragLeave={() => {
                          if (dragOverToolbarId === id) setDragOverToolbarId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropOnItem(id);
                        }}
                        onDragEnd={() => {
                          setDraggedToolbarId(null);
                          setDragOverToolbarId(null);
                        }}
                        title={tx('ลากเพื่อสลับตำแหน่งปุ่มได้', 'Drag to reorder button')}
                        className={`flex items-center gap-1 rounded-2xl transition-all ${
                          isDragged ? 'opacity-45 scale-95' : ''
                        } ${isOver ? 'ring-2 ring-emerald-500 ring-offset-1' : ''} ${
                          isReorderMode ? 'p-1 border border-dashed bg-white/60' : ''
                        }`}
                        style={isReorderMode ? { borderColor: 'var(--accent-primary)' } : undefined}
                      >
                        {isReorderMode && (
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveVisibleItem(id, -1)}
                            aria-label={tx('เลื่อนไปทางซ้าย', 'Move left')}
                            className="w-7 h-8 rounded-xl border flex items-center justify-center cursor-pointer disabled:opacity-30"
                            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        )}

                        {isReorderMode && (
                          <span className="cursor-grab text-stone-400 px-0.5" aria-hidden="true">
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                        )}

                        {renderToolbarItem(id)}

                        {isReorderMode && (
                          <button
                            type="button"
                            disabled={idx === visibleIds.length - 1}
                            onClick={() => moveVisibleItem(id, 1)}
                            aria-label={tx('เลื่อนไปทางขวา', 'Move right')}
                            className="w-7 h-8 rounded-xl border flex items-center justify-center cursor-pointer disabled:opacity-30"
                            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Reorder Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setIsReorderMode((prev) => !prev);
                    }}
                    className="px-3 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ml-auto"
                    style={{
                      backgroundColor: isReorderMode ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                      borderColor: isReorderMode ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: isReorderMode ? '#FFFFFF' : 'var(--text-muted)',
                    }}
                  >
                    {isReorderMode ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {tx('จัดเรียงเสร็จแล้ว', 'Done Reordering')}
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        {tx('ย้ายตำแหน่งปุ่ม', 'Reorder Buttons')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </header>

      {/* Barcode Toast Notification */}
      {scanToast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg font-bold text-sm border"
          style={{
            backgroundColor: scanToast.type === 'ok' ? '#16A34A' : '#E11D48',
            color: '#FFFFFF',
            borderColor: 'rgba(255,255,255,0.3)',
          }}
        >
          {scanToast.text}
        </div>
      )}

      {/* Main POS Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {posMode === 'calculator' ? (
          <CalculatorPOS
            billItems={billItems}
            outfits={bearOutfits}
            onAddManualAmount={(amount, label) => {
              setBillItems((prev) => [
                ...prev,
                {
                  id: `manual_${Date.now()}`,
                  name: label || tx(`รายการ ฿${amount}`, `Item ฿${amount}`),
                  price: amount,
                  qty: 1,
                  stars: Math.max(1, Math.floor(amount / 20)),
                },
              ]);
            }}
            onRemoveItem={handleRemoveBillItem}
            onClearBill={handleClearBill}
            onOpenScanner={() => setScannerOpen(true)}
            onOpenCashModal={(total) => {
              const totalStars = billItems.reduce((s, i) => s + i.stars * i.qty, 0);
              setCheckoutState({
                step: 'cash',
                amount: total,
                stars: totalStars,
                source: 'calculator',
                method: 'เงินสด',
              });
            }}
            onOpenQrModal={(total) => {
              const totalStars = billItems.reduce((s, i) => s + i.stars * i.qty, 0);
              setCheckoutState({
                step: 'qr',
                amount: total,
                stars: totalStars,
                source: 'calculator',
                method: 'สแกน QR',
              });
            }}
          />
        ) : (
          <CustomerMenuPOS
            menuItems={menuItems}
            rewardNotice={rewardNotice}
            onlineOrderEnabled={onlineOrderEnabled}
            cartItems={menuCart}
            queueOrders={queueOrders}
            outfits={bearOutfits}
            foodShopNameTh={foodShopNameTh}
            foodShopNameEn={foodShopNameEn}
            onAddMenuItem={(item, options) => {
              const tasteNote = options?.tasteNote?.trim() || undefined;
              const qtyToAdd = options?.qty && options.qty > 0 ? options.qty : 1;
              const lineId = tasteNote ? `${item.id}__${tasteNote}` : item.id;
              setMenuCart((prev) => {
                const idx = prev.findIndex((c) => c.id === lineId);
                if (idx >= 0) {
                  return prev.map((c, i) => (i === idx ? { ...c, qty: c.qty + qtyToAdd } : c));
                }
                return [
                  ...prev,
                  {
                    id: lineId,
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    qty: qtyToAdd,
                    stars: item.stars,
                    barcode: item.barcode,
                    tasteNote,
                  },
                ];
              });
            }}
            onChangeQty={(itemId, delta) => {
              setMenuCart((prev) =>
                prev
                  .map((c) => (c.id === itemId ? { ...c, qty: c.qty + delta } : c))
                  .filter((c) => c.qty > 0)
              );
            }}
            onClearCart={() => setMenuCart([])}
            onSubmitOrderPayment={(method, deliveryInfo) => {
              const total = menuCart.reduce((s, i) => s + i.price * i.qty, 0);
              const stars = menuCart.reduce((s, i) => s + i.stars * i.qty, 0);
              setCheckoutState({
                step: method,
                amount: total,
                stars,
                source: 'menu',
                method: method === 'cash' ? 'เงินสด' : 'สแกน QR',
                deliveryInfo,
              });
            }}
            onMarkQueueDone={(orderId) => {
              playSoftClick();
              setQueueOrders((prev) =>
                prev.map((q) => (q.orderId === orderId ? { ...q, status: 'เสร็จแล้ว' } : q))
              );
            }}
          />
        )}
      </main>

      {/* Floating Bottom-Left AI Buddy */}
      <AiBuddyDrawer staffName={activeUser.name} />

      {/* Camera Barcode Scanner */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcodeDetected={(code) => {
          handleBarcodeLookup(code);
        }}
        menuItems={menuItems}
      />

      {/* Payment Modals */}
      <CashPaymentModal
        isOpen={checkoutState.step === 'cash'}
        amount={checkoutState.amount}
        items={checkoutState.source === 'calculator' ? billItems : menuCart}
        onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
        onConfirmPaid={finalizeSalePayment}
      />

      <QrPaymentModal
        isOpen={checkoutState.step === 'qr'}
        amount={checkoutState.amount}
        items={checkoutState.source === 'calculator' ? billItems : menuCart}
        promptPayId={promptPayId}
        promptPayAccountName={promptPayAccountName}
        shopNameTh={checkoutState.source === 'menu' ? foodShopNameTh : shopNameTh}
        enableAutoPaymentCheck={enableAutoPaymentCheck}
        scriptUrl={scriptUrl}
        mascotMode={checkoutState.source === 'menu' ? 'krua' : 'kids'}
        outfits={bearOutfits}
        onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
        onConfirmPaid={finalizeSalePayment}
      />

      <PaymentSuccessOverlay
        isOpen={checkoutState.step === 'success'}
        amount={checkoutState.amount}
        earnedStars={checkoutState.stars}
        shopNameTh={shopNameTh}
        shopNameEn={shopNameEn}
        staffUser={activeUser}
        staffUsers={staffUsers}
        scriptUrl={scriptUrl}
        mascotMode={checkoutState.source === 'menu' ? 'krua' : 'kids'}
        outfits={bearOutfits}
        onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
      />

      {/* Dressing Room Modal (5 Family Bears) */}
      <DressingRoomModal
        isOpen={dressingOpen}
        onClose={() => setDressingOpen(false)}
        savedOutfits={bearOutfits}
        onSaveOutfits={(next) => {
          setBearOutfits(next);
          saveBearOutfits(next);
        }}
      />

      {/* Bear Guide Modal */}
      <BearGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} outfits={bearOutfits} />

      {/* Remote Shop Video Call Modal (เฝ้าร้านแทนแม่) */}
      <RemoteWatchModal
        isOpen={watchOpen}
        onClose={() => setWatchOpen(false)}
        roomId={orgCode}
        staffName={activeUser.name}
        shopNameTh={shopNameTh}
        promptPayId={promptPayId}
        promptPayAccountName={promptPayAccountName}
        peersInRoom={callPeers}
      />

      {/* Admin-Only Settings Modal */}
      {isAdmin && (
        <AdminSettingsModal
          isOpen={settingsOpen}
          initialTab={settingsInitialTab}
          onClose={() => setSettingsOpen(false)}
          themeId={themeId}
          onChangeTheme={setThemeId}
          orgCode={orgCode}
          staffUsers={staffUsers}
          shopNameTh={shopNameTh}
          onChangeShopNameTh={(val) => {
            setShopNameTh(val);
            localStorage.setItem(KEYS.SHOP_NAME_TH, val);
          }}
          shopNameEn={shopNameEn}
          onChangeShopNameEn={(val) => {
            setShopNameEn(val);
            localStorage.setItem(KEYS.SHOP_NAME_EN, val);
          }}
          foodShopNameTh={foodShopNameTh}
          onChangeFoodShopNameTh={(val) => {
            setFoodShopNameTh(val);
            localStorage.setItem(KEYS.FOOD_NAME_TH, val);
          }}
          foodShopNameEn={foodShopNameEn}
          onChangeFoodShopNameEn={(val) => {
            setFoodShopNameEn(val);
            localStorage.setItem(KEYS.FOOD_NAME_EN, val);
          }}
          promptPayId={promptPayId}
          onChangePromptPayId={(val) => {
            setPromptPayId(val);
            localStorage.setItem(KEYS.PROMPTPAY, val);
          }}
          promptPayAccountName={promptPayAccountName}
          onChangePromptPayAccountName={(val) => {
            setPromptPayAccountName(val);
            localStorage.setItem(KEYS.PROMPTPAY_NAME, val);
          }}
          scriptUrl={scriptUrl}
          onChangeScriptUrl={(val) => {
            setScriptUrl(val);
            localStorage.setItem(KEYS.SCRIPT_URL, val);
          }}
          rewardNotice={rewardNotice}
          onChangeRewardNotice={(val) => {
            setRewardNotice(val);
            localStorage.setItem(KEYS.REWARD_NOTICE, val);
          }}
          promoTitle={promoTitle}
          onChangePromoTitle={(val) => {
            setPromoTitle(val);
            localStorage.setItem(KEYS.PROMO_TITLE, val);
          }}
          promoSubtitle={promoSubtitle}
          onChangePromoSubtitle={(val) => {
            setPromoSubtitle(val);
            localStorage.setItem(KEYS.PROMO_SUBTITLE, val);
          }}
          faqBubbleText={faqBubbleText}
          onChangeFaqBubbleText={(val) => {
            setFaqBubbleText(val);
            localStorage.setItem(KEYS.FAQ_BUBBLE, val);
          }}
          faqModalTitle={faqModalTitle}
          onChangeFaqModalTitle={(val) => {
            setFaqModalTitle(val);
            localStorage.setItem(KEYS.FAQ_TITLE, val);
          }}
          faqModalSubtitle={faqModalSubtitle}
          onChangeFaqModalSubtitle={(val) => {
            setFaqModalSubtitle(val);
            localStorage.setItem(KEYS.FAQ_SUBTITLE, val);
          }}
          faqs={faqs}
          onChangeFaqs={(next) => {
            setFaqs(next);
            saveCachedFaqs(next);
          }}
          rewardOffers={rewardOffers}
          onChangeRewardOffers={(next) => {
            setRewardOffers(next);
            saveCachedRewardOffers(next);
          }}
          menuItems={menuItems}
          onChangeMenuItems={(next) => {
            setMenuItems(next);
            saveCachedMenu(next);
          }}
          onlineOrderEnabled={onlineOrderEnabled}
          onToggleOnlineOrder={(val) => {
            setOnlineOrderEnabled(val);
            localStorage.setItem(KEYS.ONLINE_ORDER, String(val));
          }}
          isTestMode={isTestMode}
          onToggleTestMode={(val) => {
            setIsTestMode(val);
            saveDailyTestMode(val);
          }}
          enableAutoPaymentCheck={enableAutoPaymentCheck}
          onToggleAutoPaymentCheck={(val) => {
            setEnableAutoPaymentCheck(val);
            localStorage.setItem(KEYS.AUTO_CHECK, String(val));
          }}
          onSyncAllNow={syncAllBackendNow}
          onFlushQueueNow={() => flushOfflineQueue(scriptUrl)}
        />
      )}
    </div>
  );
}
