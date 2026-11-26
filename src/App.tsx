import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Calculator,
  ChevronDown,
  FileSpreadsheet,
  Home,
  LogOut,
  MessageCircleQuestion,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Receipt,
  ScanLine,
  Settings,
  SlidersHorizontal,
  UtensilsCrossed,
  Video,
} from 'lucide-react';
import { FaqItem, MenuItem, PaymentAccount, RewardOffer, SHOP_CONFIG, StaffUser, ThemeId } from './config/shopConfig';
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
import { ExitSlipScannerModal } from './components/ExitSlipScannerModal';
import {
  DEFAULT_CASHIER_ALLOWED_IDS,
  DEFAULT_HIDDEN_TOOLBAR_IDS,
  DEFAULT_TOOLBAR_ORDER,
  ToolbarItemId,
  ToolbarOrganizerModal,
} from './components/ToolbarOrganizerModal';
import {
  CashPaymentModal,
  PaymentSuccessOverlay,
  QrPaymentModal,
} from './components/PaymentModals';
import { AdminSettingsModal, AdminSettingsTab } from './components/AdminSettingsModal';
import { BearGuideModal } from './components/BearGuideModal';
import { DressingRoomModal } from './components/DressingRoomModal';
import { CallPeerSummary, RemoteWatchModal } from './components/RemoteWatchModal';
import {
  BillLineItem,
  CustomerQueueOrder,
  fetchOnlineOrdersFromSheets,
  flushOfflineQueue,
  getReceiptSlipsCache,
  getTodayDateKey,
  loadCachedFaqs,
  loadCachedMenu,
  loadCachedRewardOffers,
  loadCachedStaffUsers,
  loadDailyTestMode,
  markSaleHistoryExited,
  postToSheets,
  ReceiptSlipRecord,
  recordSilentVoid,
  saveCachedFaqs,
  saveCachedMenu,
  saveCachedRewardOffers,
  saveDailyTestMode,
  saveReceiptSlipsCache,
  saveSaleHistoryLog,
  syncAllFromSheets,
} from './utils/sheetsSync';
import {
  playNewOrderBell,
  playScanError,
  playScanSuccess,
  playSoftClick,
  playSuccessChime,
} from './utils/sound';
import { SharedShopConfigPayload, useRealtimeShopSync } from './utils/realtimeSync';

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
  PAYMENT_ACCOUNTS: 'kkp_payment_accounts',
  ACTIVE_PAYMENT_ACCOUNT_ID: 'kkp_active_payment_account_id',
  LINE_SHOP_URL: 'kkp_line_shop_url',
  SCRIPT_URL: 'kkp_script_url',
  REWARD_NOTICE: 'kkp_reward_notice',
  PROMO_TITLE: 'kkp_promo_title',
  PROMO_SUBTITLE: 'kkp_promo_subtitle',
  FAQ_BUBBLE: 'kkp_faq_bubble_text',
  FAQ_TITLE: 'kkp_faq_modal_title',
  FAQ_SUBTITLE: 'kkp_faq_modal_subtitle',
  ONLINE_ORDER: 'kkp_online_order_enabled',
  RECEIPT_SLIP: 'kkp_receipt_slip_enabled',
  EXIT_SCANNER: 'kkp_exit_scanner_enabled',
  AUTO_CHECK: 'kkp_auto_payment_check',
  QUEUE: 'kkp_customer_queue',
  TOOLBAR_ORDER: 'kkp_toolbar_order',
  HIDDEN_TOOLBAR: 'kkp_hidden_toolbar_ids_v1',
  CASHIER_ALLOWED_TOOLBAR: 'kkp_cashier_allowed_toolbar_ids_v1',
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
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.PAYMENT_ACCOUNTS);
      if (raw) {
        const parsed = JSON.parse(raw) as PaymentAccount[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore malformed JSON
    }
    const seededId = localStorage.getItem(KEYS.PROMPTPAY) || SHOP_CONFIG.promptPayId;
    const seededName = localStorage.getItem(KEYS.PROMPTPAY_NAME) || SHOP_CONFIG.promptPayAccountName;
    if (seededId || seededName) {
      return [
        {
          id: 'acc_default_pp',
          bankName: 'พร้อมเพย์ (PromptPay)',
          accountName: seededName,
          accountNumber: seededId,
          promptPayId: seededId,
        },
      ];
    }
    return SHOP_CONFIG.paymentAccounts;
  });
  const [activePaymentAccountId, setActivePaymentAccountId] = useState<string>(() => {
    const savedId = localStorage.getItem(KEYS.ACTIVE_PAYMENT_ACCOUNT_ID);
    return savedId || 'acc_default_pp';
  });

  const activePaymentAccount =
    paymentAccounts.find((a) => a.id === activePaymentAccountId) || paymentAccounts[0];

  const syncBroadcastRef = useRef<{
    broadcastOrderCreated: (order: CustomerQueueOrder) => void;
    broadcastOrderUpdated: (
      orderId: string,
      patch: Partial<Pick<CustomerQueueOrder, 'accepted' | 'status'>>
    ) => void;
    broadcastConfigUpdated: (payload: SharedShopConfigPayload) => void;
    broadcastReceiptCreated: (receipt: ReceiptSlipRecord) => void;
    broadcastReceiptExited: (billId: string, exitedAt: string, exitedBy: string) => void;
  }>({
    broadcastOrderCreated: () => {},
    broadcastOrderUpdated: () => {},
    broadcastConfigUpdated: () => {},
    broadcastReceiptCreated: () => {},
    broadcastReceiptExited: () => {},
  });

  const pushSettingsTimerRef = useRef<number | null>(null);
  const pushConfigSnapshotRef = useRef<(overrides?: Record<string, string>, immediate?: boolean) => void>(() => {});

  const handleChangePaymentAccounts = useCallback(
    (next: PaymentAccount[]) => {
      const sanitized = next.length > 0 ? next : SHOP_CONFIG.paymentAccounts;
      setPaymentAccounts(sanitized);
      localStorage.setItem(KEYS.PAYMENT_ACCOUNTS, JSON.stringify(sanitized));
      const activeAcc = sanitized.find((a) => a.id === activePaymentAccountId) || sanitized[0];
      const nextActiveId = activeAcc?.id || activePaymentAccountId;
      let nextPp = promptPayId;
      let nextPpName = promptPayAccountName;
      if (activeAcc) {
        if (activeAcc.id !== activePaymentAccountId) {
          setActivePaymentAccountId(activeAcc.id);
          localStorage.setItem(KEYS.ACTIVE_PAYMENT_ACCOUNT_ID, activeAcc.id);
        }
        nextPp = activeAcc.promptPayId || activeAcc.accountNumber;
        nextPpName = activeAcc.accountName;
        setPromptPayId(nextPp);
        setPromptPayAccountName(nextPpName);
        localStorage.setItem(KEYS.PROMPTPAY, nextPp);
        localStorage.setItem(KEYS.PROMPTPAY_NAME, nextPpName);
      }
      pushConfigSnapshotRef.current(
        {
          paymentAccountsJson: JSON.stringify(
            sanitized.map((a) => ({ ...a, qrImageUrl: a.qrImageUrl || undefined }))
          ),
          activePaymentAccountId: nextActiveId,
          promptPayId: nextPp,
          promptPayAccountName: nextPpName,
        },
        true
      );
    },
    [activePaymentAccountId, promptPayId, promptPayAccountName]
  );

  const handleSelectActivePaymentAccount = useCallback(
    (id: string) => {
      setActivePaymentAccountId(id);
      localStorage.setItem(KEYS.ACTIVE_PAYMENT_ACCOUNT_ID, id);
      const activeAcc = paymentAccounts.find((a) => a.id === id);
      let nextPp = promptPayId;
      let nextPpName = promptPayAccountName;
      if (activeAcc) {
        nextPp = activeAcc.promptPayId || activeAcc.accountNumber;
        nextPpName = activeAcc.accountName;
        setPromptPayId(nextPp);
        setPromptPayAccountName(nextPpName);
        localStorage.setItem(KEYS.PROMPTPAY, nextPp);
        localStorage.setItem(KEYS.PROMPTPAY_NAME, nextPpName);
      }
      pushConfigSnapshotRef.current(
        {
          activePaymentAccountId: id,
          promptPayId: nextPp,
          promptPayAccountName: nextPpName,
        },
        true
      );
    },
    [paymentAccounts, promptPayId, promptPayAccountName]
  );

  const [lineShopUrl, setLineShopUrl] = useState<string>(
    () => localStorage.getItem(KEYS.LINE_SHOP_URL) || SHOP_CONFIG.lineShopUrl
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
  const [receiptSlipEnabled, setReceiptSlipEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(KEYS.RECEIPT_SLIP);
    return saved === null ? true : saved === 'true';
  });
  const [exitScannerEnabled, setExitScannerEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(KEYS.EXIT_SCANNER);
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
  const [receipts, setReceipts] = useState<ReceiptSlipRecord[]>(() => getReceiptSlipsCache());

  // Modals & Notifications
  const [scannerOpen, setScannerOpen] = useState(false);
  const [exitScannerOpen, setExitScannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<AdminSettingsTab>('general');
  const [guideOpen, setGuideOpen] = useState(false);
  const [dressingOpen, setDressingOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [callPeers, setCallPeers] = useState<CallPeerSummary[]>([]);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [memberRewardsOpen, setMemberRewardsOpen] = useState(false);
  const [toolbarOrganizerOpen, setToolbarOrganizerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [scanToast, setScanToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Customizable Top Toolbar Order, Hidden Buttons & Staff Allowance State
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
  const [hiddenToolbarIds, setHiddenToolbarIds] = useState<ToolbarItemId[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.HIDDEN_TOOLBAR);
      if (!raw) return DEFAULT_HIDDEN_TOOLBAR_IDS;
      const parsed = JSON.parse(raw) as ToolbarItemId[];
      return Array.isArray(parsed)
        ? parsed.filter((id) => DEFAULT_TOOLBAR_ORDER.includes(id))
        : DEFAULT_HIDDEN_TOOLBAR_IDS;
    } catch {
      return DEFAULT_HIDDEN_TOOLBAR_IDS;
    }
  });
  const [cashierAllowedToolbarIds, setCashierAllowedToolbarIds] = useState<ToolbarItemId[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.CASHIER_ALLOWED_TOOLBAR);
      if (!raw) return DEFAULT_CASHIER_ALLOWED_IDS;
      const parsed = JSON.parse(raw) as ToolbarItemId[];
      return Array.isArray(parsed)
        ? parsed.filter((id) => DEFAULT_TOOLBAR_ORDER.includes(id))
        : DEFAULT_CASHIER_ALLOWED_IDS;
    } catch {
      return DEFAULT_CASHIER_ALLOWED_IDS;
    }
  });
  const [draggedToolbarId, setDraggedToolbarId] = useState<ToolbarItemId | null>(null);
  const [dragOverToolbarId, setDragOverToolbarId] = useState<ToolbarItemId | null>(null);

  // Payment Checkout Context
  const [checkoutState, setCheckoutState] = useState<{
    step: 'idle' | 'cash' | 'qr' | 'success';
    amount: number;
    stars: number;
    source: 'calculator' | 'menu';
    method: 'เงินสด' | 'สแกน QR';
    deliveryInfo?: {
      deliveryType: 'ทานนี้' | 'กลับบ้าน' | 'รับเองที่ร้าน' | 'ให้พ่อไปส่ง';
      tableNumber?: string;
      customerName: string;
      dropPoint: string;
    };
    receipt?: ReceiptSlipRecord | null;
  }>({
    step: 'idle',
    amount: 0,
    stars: 0,
    source: 'calculator',
    method: 'เงินสด',
    receipt: null,
  });

  // Apply selected theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(KEYS.THEME, themeId);
  }, [themeId]);

  // Persist Queue & Receipts
  useEffect(() => {
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(queueOrders));
  }, [queueOrders]);

  useEffect(() => {
    saveReceiptSlipsCache(receipts);
  }, [receipts]);

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

  const applySettingsFromRecord = useCallback((s: Record<string, string>) => {
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
    if (s.paymentAccountsJson) {
      try {
        const parsedAccounts = JSON.parse(s.paymentAccountsJson) as PaymentAccount[];
        if (Array.isArray(parsedAccounts) && parsedAccounts.length > 0) {
          setPaymentAccounts(parsedAccounts);
          localStorage.setItem(KEYS.PAYMENT_ACCOUNTS, JSON.stringify(parsedAccounts));
          const targetActiveId = s.activePaymentAccountId || parsedAccounts[0].id;
          setActivePaymentAccountId(targetActiveId);
          localStorage.setItem(KEYS.ACTIVE_PAYMENT_ACCOUNT_ID, targetActiveId);
        }
      } catch {
        // Ignore malformed paymentAccountsJson
      }
    } else if (s.activePaymentAccountId) {
      setActivePaymentAccountId(s.activePaymentAccountId);
      localStorage.setItem(KEYS.ACTIVE_PAYMENT_ACCOUNT_ID, s.activePaymentAccountId);
    }
    if (s.lineShopUrl !== undefined) {
      setLineShopUrl(s.lineShopUrl);
      localStorage.setItem(KEYS.LINE_SHOP_URL, s.lineShopUrl);
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
    if (s.receiptSlipEnabled !== undefined) {
      const val = s.receiptSlipEnabled.toLowerCase() !== 'false';
      setReceiptSlipEnabled(val);
      localStorage.setItem(KEYS.RECEIPT_SLIP, String(val));
    }
    if (s.exitScannerEnabled !== undefined) {
      const val = s.exitScannerEnabled.toLowerCase() !== 'false';
      setExitScannerEnabled(val);
      localStorage.setItem(KEYS.EXIT_SCANNER, String(val));
    }
    if (s.enableAutoPaymentCheck !== undefined) {
      const val = s.enableAutoPaymentCheck.toLowerCase() === 'true';
      setEnableAutoPaymentCheck(val);
      localStorage.setItem(KEYS.AUTO_CHECK, String(val));
    }
    if (s.hiddenToolbarIdsJson) {
      try {
        const parsed = JSON.parse(s.hiddenToolbarIdsJson) as ToolbarItemId[];
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((id) => DEFAULT_TOOLBAR_ORDER.includes(id));
          setHiddenToolbarIds(clean);
          localStorage.setItem(KEYS.HIDDEN_TOOLBAR, JSON.stringify(clean));
        }
      } catch {
        // Ignore malformed hiddenToolbarIdsJson
      }
    }
    if (s.cashierAllowedToolbarIdsJson) {
      try {
        const parsed = JSON.parse(s.cashierAllowedToolbarIdsJson) as ToolbarItemId[];
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((id) => DEFAULT_TOOLBAR_ORDER.includes(id));
          setCashierAllowedToolbarIds(clean);
          localStorage.setItem(KEYS.CASHIER_ALLOWED_TOOLBAR, JSON.stringify(clean));
        }
      } catch {
        // Ignore malformed cashierAllowedToolbarIdsJson
      }
    }
  }, []);

  const buildSettingsPayload = useCallback(
    (overrides?: Record<string, string>): Record<string, string> => ({
      orgCode,
      shopNameTh,
      shopNameEn,
      foodShopNameTh,
      foodShopNameEn,
      promptPayId,
      promptPayAccountName,
      paymentAccountsJson: JSON.stringify(
        paymentAccounts.map((a) => ({ ...a, qrImageUrl: a.qrImageUrl || undefined }))
      ),
      activePaymentAccountId,
      lineShopUrl,
      rewardNotice,
      promoTitle,
      promoSubtitle,
      faqBubbleText,
      faqModalTitle,
      faqModalSubtitle,
      onlineOrderEnabled: String(onlineOrderEnabled),
      receiptSlipEnabled: String(receiptSlipEnabled),
      exitScannerEnabled: String(exitScannerEnabled),
      enableAutoPaymentCheck: String(enableAutoPaymentCheck),
      hiddenToolbarIdsJson: JSON.stringify(hiddenToolbarIds),
      cashierAllowedToolbarIdsJson: JSON.stringify(cashierAllowedToolbarIds),
      ...(overrides || {}),
    }),
    [
      orgCode,
      shopNameTh,
      shopNameEn,
      foodShopNameTh,
      foodShopNameEn,
      promptPayId,
      promptPayAccountName,
      paymentAccounts,
      activePaymentAccountId,
      lineShopUrl,
      rewardNotice,
      promoTitle,
      promoSubtitle,
      faqBubbleText,
      faqModalTitle,
      faqModalSubtitle,
      onlineOrderEnabled,
      receiptSlipEnabled,
      exitScannerEnabled,
      enableAutoPaymentCheck,
      hiddenToolbarIds,
      cashierAllowedToolbarIds,
    ]
  );

  useEffect(() => {
    pushConfigSnapshotRef.current = (overrides?: Record<string, string>, immediate?: boolean) => {
      const nextSettings = buildSettingsPayload(overrides);
      syncBroadcastRef.current.broadcastConfigUpdated({ settings: nextSettings });
      if (!scriptUrl || !scriptUrl.trim()) return;
      if (pushSettingsTimerRef.current) {
        window.clearTimeout(pushSettingsTimerRef.current);
        pushSettingsTimerRef.current = null;
      }
      if (immediate) {
        postToSheets(scriptUrl, 'ตั้งค่าระบบ', { settings: nextSettings });
      } else {
        pushSettingsTimerRef.current = window.setTimeout(() => {
          postToSheets(scriptUrl, 'ตั้งค่าระบบ', { settings: nextSettings });
          pushSettingsTimerRef.current = null;
        }, 900);
      }
    };
  }, [buildSettingsPayload, scriptUrl]);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setScanToast({ type, text });
    window.setTimeout(() => setScanToast(null), 3200);
  }, []);

  const knownOrderIdsRef = useRef<Set<string>>(new Set(queueOrders.map((q) => q.orderId)));
  useEffect(() => {
    for (const q of queueOrders) {
      knownOrderIdsRef.current.add(q.orderId);
    }
  }, [queueOrders]);

  const notifyIncomingOrder = useCallback(
    (incoming: CustomerQueueOrder) => {
      if (viewScreen !== 'staff-pos') return;
      playNewOrderBell();
      const tablePart = incoming.tableNumber ? ` · โต๊ะที่ ${incoming.tableNumber}` : '';
      showToast(
        'ok',
        tx(
          `🔔 มีออเดอร์ใหม่เข้า! คิวที่ ${incoming.queueNo}${tablePart} (฿${incoming.totalAmount.toLocaleString('th-TH')})`,
          `New order arrived! Queue #${incoming.queueNo} (฿${incoming.totalAmount.toLocaleString('en-US')})`
        )
      );
    },
    [viewScreen, showToast, tx]
  );

  const mergeOrdersIntoState = useCallback(
    (incomingList: CustomerQueueOrder[], shouldRingOnNew = false) => {
      let brandNewToRing: CustomerQueueOrder | null = null;
      for (const inc of incomingList) {
        if (!knownOrderIdsRef.current.has(inc.orderId)) {
          knownOrderIdsRef.current.add(inc.orderId);
          if (shouldRingOnNew && inc.status === 'กำลังทำ' && !inc.accepted) {
            brandNewToRing = inc;
          }
        }
      }
      setQueueOrders((prev) => {
        const byId = new Map(prev.map((q) => [q.orderId, q]));
        for (const incoming of incomingList) {
          const existing = byId.get(incoming.orderId);
          if (!existing) {
            byId.set(incoming.orderId, incoming);
          } else {
            byId.set(incoming.orderId, {
              ...incoming,
              accepted: existing.accepted || incoming.accepted,
              status: existing.status === 'เสร็จแล้ว' ? 'เสร็จแล้ว' : incoming.status,
              slipImageUrl: existing.slipImageUrl || incoming.slipImageUrl,
              tableNumber: existing.tableNumber || incoming.tableNumber,
            });
          }
        }
        return Array.from(byId.values()).sort((a, b) => a.queueNo - b.queueNo);
      });
      if (brandNewToRing) {
        notifyIncomingOrder(brandNewToRing);
      }
    },
    [notifyIncomingOrder]
  );

  const mergeReceiptsIntoState = useCallback((incomingList: ReceiptSlipRecord[]) => {
    if (!Array.isArray(incomingList) || incomingList.length === 0) return;
    setReceipts((prev) => {
      const byId = new Map(prev.map((r) => [r.billId.toUpperCase(), r]));
      for (const inc of incomingList) {
        const key = String(inc.billId || '').trim().toUpperCase();
        if (!key) continue;
        const existing = byId.get(key);
        if (!existing) {
          byId.set(key, { ...inc, billId: key });
        } else {
          byId.set(key, {
            ...inc,
            billId: key,
            exitedAt: existing.exitedAt || inc.exitedAt,
            exitedBy: existing.exitedBy || inc.exitedBy,
          });
        }
      }
      return Array.from(byId.values())
        .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''))
        .slice(0, 300);
    });
  }, []);

  const {
    broadcastOrderCreated,
    broadcastOrderUpdated,
    broadcastConfigUpdated,
    broadcastReceiptCreated,
    broadcastReceiptExited,
  } = useRealtimeShopSync({
    roomId: orgCode,
    role: viewScreen === 'staff-pos' ? 'staff' : 'customer',
    onSyncState: ({ orders, receipts: remoteReceipts, sharedConfig }) => {
      if (orders.length > 0) {
        mergeOrdersIntoState(orders, false);
      }
      if (remoteReceipts && remoteReceipts.length > 0) {
        mergeReceiptsIntoState(remoteReceipts);
      }
      if (sharedConfig) {
        if (sharedConfig.settings) applySettingsFromRecord(sharedConfig.settings);
        if (Array.isArray(sharedConfig.menu) && sharedConfig.menu.length > 0) {
          setMenuItems(sharedConfig.menu);
          saveCachedMenu(sharedConfig.menu);
        }
        if (Array.isArray(sharedConfig.faqs) && sharedConfig.faqs.length > 0) {
          setFaqs(sharedConfig.faqs);
          saveCachedFaqs(sharedConfig.faqs);
        }
        if (Array.isArray(sharedConfig.rewardOffers) && sharedConfig.rewardOffers.length > 0) {
          setRewardOffers(sharedConfig.rewardOffers);
          saveCachedRewardOffers(sharedConfig.rewardOffers);
        }
      }
    },
    onRemoteOrderCreated: (order, fromRemote) => {
      mergeOrdersIntoState([order], fromRemote);
    },
    onRemoteOrderUpdated: (orderId, patch) => {
      setQueueOrders((prev) =>
        prev.map((q) => (q.orderId === orderId ? { ...q, ...patch } : q))
      );
    },
    onRemoteConfigUpdated: (payload) => {
      if (payload.settings) applySettingsFromRecord(payload.settings);
      if (Array.isArray(payload.menu) && payload.menu.length > 0) {
        setMenuItems(payload.menu);
        saveCachedMenu(payload.menu);
      }
      if (Array.isArray(payload.faqs) && payload.faqs.length > 0) {
        setFaqs(payload.faqs);
        saveCachedFaqs(payload.faqs);
      }
      if (Array.isArray(payload.rewardOffers) && payload.rewardOffers.length > 0) {
        setRewardOffers(payload.rewardOffers);
        saveCachedRewardOffers(payload.rewardOffers);
      }
    },
    onRemoteReceiptCreated: (receipt) => {
      mergeReceiptsIntoState([receipt]);
    },
    onRemoteReceiptUpdated: (billId, patch) => {
      const key = billId.trim().toUpperCase();
      setReceipts((prev) =>
        prev.map((r) =>
          r.billId.toUpperCase() === key
            ? {
                ...r,
                exitedAt: r.exitedAt || patch.exitedAt,
                exitedBy: r.exitedBy || patch.exitedBy,
              }
            : r
        )
      );
    },
  });

  useEffect(() => {
    syncBroadcastRef.current = {
      broadcastOrderCreated,
      broadcastOrderUpdated,
      broadcastConfigUpdated,
      broadcastReceiptCreated,
      broadcastReceiptExited,
    };
  }, [
    broadcastOrderCreated,
    broadcastOrderUpdated,
    broadcastConfigUpdated,
    broadcastReceiptCreated,
    broadcastReceiptExited,
  ]);

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
      applySettingsFromRecord(synced.settings);
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

    if (synced.queueOrders && synced.queueOrders.length > 0) {
      mergeOrdersIntoState(synced.queueOrders, false);
      parts.push(tx(`ออเดอร์ออนไลน์ ${synced.queueOrders.length} คิว`, `${synced.queueOrders.length} online orders`));
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
  }, [scriptUrl, tx, applySettingsFromRecord, mergeOrdersIntoState]);

  const refreshOnlineOrdersNow = useCallback(
    async (shouldRingOnNew = false) => {
      if (!scriptUrl || !scriptUrl.trim()) return;
      const remoteOrders = await fetchOnlineOrdersFromSheets(scriptUrl);
      if (!remoteOrders || remoteOrders.length === 0) return;
      mergeOrdersIntoState(remoteOrders, shouldRingOnNew);
    },
    [scriptUrl, mergeOrdersIntoState]
  );

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

  // Background 10s fallback poll from Google Sheets when POS or Customer menu is open
  useEffect(() => {
    if (!scriptUrl || !scriptUrl.trim()) return;
    if (viewScreen !== 'staff-pos' && viewScreen !== 'customer') return;
    const timer = window.setInterval(() => {
      refreshOnlineOrdersNow(viewScreen === 'staff-pos');
    }, 10000);
    return () => window.clearInterval(timer);
  }, [scriptUrl, viewScreen, refreshOnlineOrdersNow]);

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
      if (checkoutState.step !== 'idle' || settingsOpen || guideOpen || dressingOpen || watchOpen || faqModalOpen || exitScannerOpen || toolbarOrganizerOpen) return;

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
  }, [viewScreen, currentUser, checkoutState.step, settingsOpen, guideOpen, dressingOpen, watchOpen, faqModalOpen, exitScannerOpen, toolbarOrganizerOpen, handleBarcodeLookup]);

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

  // Donate Barcode + Photo from Home Page (Strict No-Duplicate + Auto-Sync to Backend & POS)
  const handleDonateBarcodeProduct = useCallback(
    (incoming: MenuItem): { ok: boolean; reason?: string } => {
      const cleanCode = incoming.barcode.trim();
      if (!cleanCode) {
        return {
          ok: false,
          reason: tx('กรุณาระบุเลขบาร์โค้ดก่อนบันทึกค่ะ', 'Please provide a barcode.'),
        };
      }

      const duplicate = menuItems.find(
        (m) => m.barcode.trim() !== '' && m.barcode.trim() === cleanCode
      );
      if (duplicate) {
        return {
          ok: false,
          reason: tx(
            `มีเลขบาร์โค้ด "${cleanCode}" (${duplicate.name}) อยู่ในระบบแล้ว ระบบจึงปฏิเสธและไม่เขียนทับข้อมูลเดิมค่ะ`,
            `Barcode "${cleanCode}" (${duplicate.name}) already exists. Duplicates and overwrites are blocked.`
          ),
        };
      }

      const donatedItem: MenuItem = {
        ...incoming,
        barcode: cleanCode,
        status: 'พร้อมขาย',
        stockMode: 'unlimited',
      };

      const nextItems = [...menuItems, donatedItem];
      setMenuItems(nextItems);
      saveCachedMenu(nextItems);
      syncBroadcastRef.current.broadcastConfigUpdated({ menu: nextItems });

      if (scriptUrl && scriptUrl.trim()) {
        postToSheets(scriptUrl, 'ตั้งค่าเมนู', { menu: nextItems });
      }

      return { ok: true };
    },
    [menuItems, scriptUrl, tx]
  );

  // Complete Payment & Send to Google Sheets (แยกแท็บ ขายจริง_หน้าร้าน / ขายจริง_ครัวแม่วัง / ทดสอบระบบ)
  const finalizeSalePayment = useCallback(async (slipImageUrl?: string, bankAccountLabel?: string) => {
    const cleanSlip =
      typeof slipImageUrl === 'string' && slipImageUrl.startsWith('data:image/')
        ? slipImageUrl
        : undefined;
    const cleanBank = bankAccountLabel?.trim() || '';
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

    const cleanTable = checkoutState.deliveryInfo?.tableNumber?.trim() || '';
    const cleanCustomerName = checkoutState.deliveryInfo?.customerName?.trim() || '';
    const cleanDropPoint = checkoutState.deliveryInfo?.dropPoint?.trim() || '';
    const chosenType = checkoutState.deliveryInfo?.deliveryType;

    const baseDeliveryStr = chosenType
      ? chosenType === 'ทานนี้'
        ? `ทานนี้${cleanTable ? ` (โต๊ะที่ ${cleanTable})` : ''}${cleanCustomerName ? ` - ${cleanCustomerName}` : ''}`
        : chosenType === 'กลับบ้าน'
          ? `กลับบ้าน${cleanCustomerName ? ` - ${cleanCustomerName}` : ''}`
          : `${chosenType}${cleanCustomerName ? ` - ${cleanCustomerName}` : ''}${cleanDropPoint ? ` (${cleanDropPoint})` : ''}`
      : 'หน้าร้าน';

    const deliveryWithBank = cleanBank
      ? `${baseDeliveryStr} [เข้า: ${cleanBank}]`
      : baseDeliveryStr;

    const issuedTimestamp = new Date().toLocaleString('th-TH');
    const issuedIso = new Date().toISOString();

    const issuedReceipt: ReceiptSlipRecord | null = receiptSlipEnabled
      ? {
          billId,
          orgCode,
          issuedAt: issuedIso,
          timestamp: issuedTimestamp,
          shopType: isKrua ? 'krua' : 'store',
          shopName: activeShopName,
          mode: modeLabel,
          staffName: actorUser.name,
          paymentMethod: checkoutState.method,
          bankAccountLabel: cleanBank || undefined,
          deliveryInfo: baseDeliveryStr,
          items: activeItems.map((item) => ({ ...item })),
          totalAmount: totalAmt,
          totalStars,
        }
      : null;

    saveSaleHistoryLog({
      id: billId,
      timestamp: issuedTimestamp,
      dateKey: getTodayDateKey(),
      shopType: isKrua ? 'krua' : 'store',
      shopName: activeShopName,
      mode: modeLabel,
      staffName: actorUser.name,
      paymentMethod: checkoutState.method,
      totalAmount: totalAmt,
      totalStars,
      itemsSummary,
      deliveryInfo: deliveryWithBank,
      slipImageUrl: cleanSlip,
    });

    if (issuedReceipt) {
      mergeReceiptsIntoState([issuedReceipt]);
      syncBroadcastRef.current.broadcastReceiptCreated(issuedReceipt);
    }

    if (isKrua && menuCart.length > 0) {
      const nextQueueNo = queueOrders.length > 0 ? Math.max(...queueOrders.map((q) => q.queueNo)) + 1 : 1;
      const resolvedDropPoint =
        chosenType === 'ทานนี้' && cleanTable
          ? `โต๊ะที่ ${cleanTable}`
          : cleanDropPoint || undefined;
      const newOrder: CustomerQueueOrder = {
        queueNo: nextQueueNo,
        orderId: billId,
        items: menuCart,
        totalAmount: totalAmt,
        totalStars,
        deliveryType: chosenType || 'ทานนี้',
        tableNumber: cleanTable || undefined,
        paymentMethod: checkoutState.method,
        customerName: cleanCustomerName || undefined,
        dropPoint: resolvedDropPoint,
        slipImageUrl: cleanSlip,
        accepted: Boolean(currentUser),
        createdAt: issuedIso,
        status: 'กำลังทำ',
      };
      knownOrderIdsRef.current.add(newOrder.orderId);
      setQueueOrders((prev) => [...prev, newOrder]);
      syncBroadcastRef.current.broadcastOrderCreated(newOrder);

      postToSheets(scriptUrl, 'ออเดอร์ออนไลน์', {
        ...newOrder,
        bankAccount: cleanBank,
        slipImageUrl: cleanSlip || '',
        slipStatus: cleanSlip ? 'แนบสลิปแล้ว' : 'ไม่มีสลิป',
      });
    }

    postToSheets(scriptUrl, sheetTab, {
      billId,
      mode: sheetTab,
      shopBrand: activeShopName,
      staffName: actorUser.name,
      paymentMethod: checkoutState.method,
      bankAccount: cleanBank,
      totalAmount: totalAmt,
      totalStars,
      itemsSummary,
      deliveryInfo: cleanSlip ? `${deliveryWithBank} [แนบสลิปแล้ว]` : deliveryWithBank,
      slipStatus: cleanSlip ? 'แนบสลิปแล้ว' : 'ไม่มีสลิป',
      slipImageUrl: cleanSlip || '',
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
      receipt: issuedReceipt,
    }));
  }, [currentUser, checkoutState, billItems, menuCart, queueOrders, isTestMode, scriptUrl, foodShopNameTh, shopNameTh, receiptSlipEnabled, orgCode, mergeReceiptsIntoState]);

  const handleMarkReceiptExited = useCallback(
    (billId: string) => {
      const key = billId.trim().toUpperCase();
      const exitedAt = new Date().toISOString();
      const exitedBy = currentUser?.name || 'พนักงาน';
      setReceipts((prev) =>
        prev.map((r) =>
          r.billId.toUpperCase() === key && !r.exitedAt
            ? { ...r, exitedAt, exitedBy }
            : r
        )
      );
      markSaleHistoryExited(key, exitedAt, exitedBy);
      syncBroadcastRef.current.broadcastReceiptExited(key, exitedAt, exitedBy);
    },
    [currentUser]
  );

  const handleToggleReceiptSlip = useCallback(
    (nextVal: boolean) => {
      setReceiptSlipEnabled(nextVal);
      localStorage.setItem(KEYS.RECEIPT_SLIP, String(nextVal));
      pushConfigSnapshotRef.current({ receiptSlipEnabled: String(nextVal) }, true);
    },
    []
  );

  const handleToggleExitScanner = useCallback(
    (nextVal: boolean) => {
      setExitScannerEnabled(nextVal);
      localStorage.setItem(KEYS.EXIT_SCANNER, String(nextVal));
      pushConfigSnapshotRef.current({ exitScannerEnabled: String(nextVal) }, true);
    },
    []
  );

  const handleAcceptQueueOrder = useCallback(
    (orderId: string) => {
      playScanSuccess();
      setQueueOrders((prev) =>
        prev.map((q) => (q.orderId === orderId ? { ...q, accepted: true } : q))
      );
      syncBroadcastRef.current.broadcastOrderUpdated(orderId, { accepted: true });
      if (scriptUrl && scriptUrl.trim()) {
        postToSheets(scriptUrl, 'ออเดอร์ออนไลน์', {
          actionType: 'updateOrderStatus',
          orderId,
          accepted: true,
        });
      }
    },
    [scriptUrl]
  );

  const handleMarkQueueDone = useCallback(
    (orderId: string) => {
      playSoftClick();
      setQueueOrders((prev) =>
        prev.map((q) => (q.orderId === orderId ? { ...q, accepted: true, status: 'เสร็จแล้ว' } : q))
      );
      syncBroadcastRef.current.broadcastOrderUpdated(orderId, {
        accepted: true,
        status: 'เสร็จแล้ว',
      });
      if (scriptUrl && scriptUrl.trim()) {
        postToSheets(scriptUrl, 'ออเดอร์ออนไลน์', {
          actionType: 'updateOrderStatus',
          orderId,
          accepted: true,
          status: 'เสร็จแล้ว',
        });
      }
    },
    [scriptUrl]
  );

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
          menuItems={menuItems}
          onDonateProduct={handleDonateBarcodeProduct}
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
            isMerchantView={false}
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
            onSubmitOrderPayment={(_method, deliveryInfo) => {
              const total = menuCart.reduce((s, i) => s + i.price * i.qty, 0);
              const stars = menuCart.reduce((s, i) => s + i.stars * i.qty, 0);
              setCheckoutState({
                step: 'qr',
                amount: total,
                stars,
                source: 'menu',
                method: 'สแกน QR',
                deliveryInfo,
              });
            }}
            onMarkQueueDone={handleMarkQueueDone}
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

        <QrPaymentModal
          isOpen={checkoutState.step === 'qr'}
          amount={checkoutState.amount}
          items={menuCart}
          promptPayId={activePaymentAccount?.promptPayId || activePaymentAccount?.accountNumber || promptPayId}
          promptPayAccountName={activePaymentAccount?.accountName || promptPayAccountName}
          paymentAccounts={activePaymentAccount ? [activePaymentAccount] : paymentAccounts}
          activePaymentAccountId={activePaymentAccountId}
          shopNameTh={foodShopNameTh}
          enableAutoPaymentCheck={enableAutoPaymentCheck}
          scriptUrl={scriptUrl}
          mascotMode="krua"
          outfits={bearOutfits}
          allowSlipUpload={true}
          lineShopUrl={lineShopUrl}
          onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
          onConfirmPaid={(slipUrl, bankLabel) => finalizeSalePayment(slipUrl, bankLabel)}
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
          receiptSlipEnabled={receiptSlipEnabled}
          exitScannerEnabled={exitScannerEnabled}
          receiptData={
            checkoutState.receipt
              ? receipts.find((r) => r.billId === checkoutState.receipt?.billId) ||
                checkoutState.receipt
              : null
          }
          onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle', receipt: null }))}
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
                  setMoreMenuOpen(false);
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
                  setMoreMenuOpen(false);
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

          {/* Bottom Toolbar Row: Clean Organized Buttons + More Menu + Organize Controls */}
          {(() => {
            const adminLockedIds: ToolbarItemId[] = ['testMode', 'importExcel', 'settings'];
            const permittedIds = toolbarOrder.filter((id) => {
              if (!isAdmin && (adminLockedIds.includes(id) || !cashierAllowedToolbarIds.includes(id))) {
                return false;
              }
              return true;
            });
            const visibleIds = permittedIds.filter((id) => !hiddenToolbarIds.includes(id));
            const hiddenMenuIds = permittedIds.filter((id) => hiddenToolbarIds.includes(id));

            const persistOrder = (next: ToolbarItemId[]) => {
              setToolbarOrder(next);
              localStorage.setItem(KEYS.TOOLBAR_ORDER, JSON.stringify(next));
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

            const renderToolbarItem = (id: ToolbarItemId, insideMenu = false) => {
              const afterClick = () => {
                if (insideMenu) setMoreMenuOpen(false);
              };
              const btnClass = insideMenu
                ? 'w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap text-left'
                : 'px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0';

              switch (id) {
                case 'modeSwitch':
                  return (
                    <div
                      className={`flex items-center gap-1 p-1 rounded-2xl border ${insideMenu ? 'w-full justify-between' : ''}`}
                      style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setPosMode('calculator');
                          afterClick();
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
                          playSoftClick();
                          setPosMode('menu');
                          afterClick();
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
                case 'exitScanner': {
                  const waitingExitCount = receipts.filter((r) => !r.exitedAt).length;
                  return (
                    <div
                      className={`inline-flex items-stretch rounded-2xl border overflow-hidden shrink-0 ${
                        insideMenu ? 'w-full' : ''
                      }`}
                      style={{
                        borderColor: exitScannerEnabled ? 'var(--accent-border)' : '#FECDD3',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setExitScannerOpen(true);
                          afterClick();
                        }}
                        className={`px-3 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          insideMenu ? 'flex-1 text-left' : ''
                        }`}
                        style={{
                          backgroundColor: exitScannerEnabled ? 'var(--accent-soft)' : '#FFF1F2',
                          color: exitScannerEnabled ? 'var(--accent-text)' : '#9F1239',
                        }}
                      >
                        <ScanLine className="w-4 h-4 shrink-0" />
                        {tx('สแกนสลิปผ่านประตู', 'Exit Slip Scan')}
                        {exitScannerEnabled && waitingExitCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-num">
                            {waitingExitCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          const next = !exitScannerEnabled;
                          handleToggleExitScanner(next);
                          showToast(
                            'ok',
                            next
                              ? tx('เปิดใช้สแกนสลิปผ่านประตูแล้วค่ะ', 'Exit slip scanner enabled')
                              : tx('หยุดใช้สแกนสลิปผ่านประตูชั่วคราวแล้วค่ะ', 'Exit slip scanner paused')
                          );
                          afterClick();
                        }}
                        title={
                          exitScannerEnabled
                            ? tx('กำลังเปิดใช้ — กดเพื่อหยุดใช้', 'Active — tap to pause')
                            : tx('หยุดใช้อยู่ — กดเพื่อเปิดใช้', 'Paused — tap to enable')
                        }
                        className="px-2.5 py-2.5 border-l text-[11px] sm:text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor: exitScannerEnabled ? '#DCFCE7' : '#FFE4E6',
                          borderColor: exitScannerEnabled ? '#A7F3D0' : '#FECDD3',
                          color: exitScannerEnabled ? '#166534' : '#9F1239',
                        }}
                      >
                        {exitScannerEnabled ? (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                            {tx('เปิดใช้', 'ON')}
                          </>
                        ) : (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                            {tx('หยุดใช้', 'PAUSED')}
                          </>
                        )}
                      </button>
                    </div>
                  );
                }
                case 'receiptSlipToggle':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        const next = !receiptSlipEnabled;
                        handleToggleReceiptSlip(next);
                        showToast(
                          'ok',
                          next
                            ? tx('เปิดการออกใบสลิป & QR ผ่านประตูแล้วค่ะ', 'Receipt slips & exit QR resumed')
                            : tx('หยุดการให้ใบสลิปชั่วคราวแล้วค่ะ', 'Receipt slip issuance paused')
                        );
                        afterClick();
                      }}
                      className={btnClass}
                      style={{
                        backgroundColor: receiptSlipEnabled ? '#ECFDF5' : '#FFF1F2',
                        borderColor: receiptSlipEnabled ? '#A7F3D0' : '#FECDD3',
                        color: receiptSlipEnabled ? '#065F46' : '#9F1239',
                      }}
                    >
                      {receiptSlipEnabled ? (
                        <Receipt className="w-4 h-4 shrink-0" />
                      ) : (
                        <PauseCircle className="w-4 h-4 shrink-0" />
                      )}
                      {receiptSlipEnabled
                        ? tx('ใบสลิป: เปิดแจก', 'Slips: ON')
                        : tx('หยุดให้ใบสลิป', 'Slips: PAUSED')}
                    </button>
                  );
                case 'watchShop': {
                  const momWaiting = callPeers.some((p) => p.role === 'shop');
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setWatchOpen(true);
                        afterClick();
                      }}
                      className={btnClass}
                      style={{
                        backgroundColor: momWaiting ? '#FFEDD5' : 'var(--accent-soft)',
                        borderColor: momWaiting ? '#EA580C' : 'var(--accent-border)',
                        color: momWaiting ? '#9A3412' : 'var(--accent-text)',
                      }}
                    >
                      <Video className="w-4 h-4 shrink-0" />
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
                        playSoftClick();
                        setDressingOpen(true);
                        afterClick();
                      }}
                      className={btnClass}
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
                        playSoftClick();
                        setGuideOpen(true);
                        afterClick();
                      }}
                      className={btnClass}
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
                        playSoftClick();
                        const next = !isTestMode;
                        setIsTestMode(next);
                        saveDailyTestMode(next);
                        afterClick();
                      }}
                      className={btnClass}
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
                        playSoftClick();
                        setSettingsInitialTab('products');
                        setSettingsOpen(true);
                        afterClick();
                      }}
                      className={btnClass}
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--accent-border)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      <Barcode className="w-4 h-4 shrink-0" />
                      {tx('นำเข้าสินค้า Excel', 'Import Excel')}
                    </button>
                  );
                case 'summary':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setSettingsInitialTab('summary');
                        setSettingsOpen(true);
                        afterClick();
                      }}
                      className={btnClass}
                      style={{
                        backgroundColor: 'var(--pastel-blue)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--pastel-blue-text)',
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4 shrink-0" />
                      {tx('สรุปยอด / LINE / Excel', 'Summary / LINE / Excel')}
                    </button>
                  );
                case 'settings':
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setSettingsInitialTab('general');
                        setSettingsOpen(true);
                        afterClick();
                      }}
                      className={btnClass}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--text-main)',
                      }}
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      {tx('ตั้งค่า', 'Settings')}
                    </button>
                  );
              }
            };

            return (
              <div className="relative flex flex-wrap items-center gap-2">
                {visibleIds.map((id) => {
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
                      className={`flex items-center rounded-2xl transition-all ${
                        isDragged ? 'opacity-45 scale-95' : ''
                      } ${isOver ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
                    >
                      {renderToolbarItem(id, false)}
                    </div>
                  );
                })}

                {/* Right Controls: Compact "More" Dropdown for Hidden Buttons + "Manage/Hide Buttons" */}
                <div className="flex items-center gap-1.5 ml-auto shrink-0 relative">
                  {hiddenMenuIds.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setMoreMenuOpen((prev) => !prev);
                        }}
                        className="px-3 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        style={{
                          backgroundColor: moreMenuOpen ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                          borderColor: moreMenuOpen ? 'var(--accent-border)' : 'var(--border-soft)',
                          color: moreMenuOpen ? 'var(--accent-text)' : 'var(--text-main)',
                        }}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        {tx(`เมนูอื่น (${hiddenMenuIds.length})`, `More (${hiddenMenuIds.length})`)}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {moreMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setMoreMenuOpen(false)}
                          />
                          <div
                            className="absolute right-0 mt-2 w-72 rounded-2xl border shadow-2xl p-2.5 space-y-2 z-50"
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              borderColor: 'var(--border-soft)',
                            }}
                          >
                            <p className="text-[11px] font-bold px-1.5" style={{ color: 'var(--text-muted)' }}>
                              {tx('ปุ่มที่ซ่อนจากหน้าคิดเงิน (กดใช้ได้ทันที)', 'Hidden from POS bar (ready to use)')}
                            </p>
                            {hiddenMenuIds.map((id) => (
                              <div key={id}>{renderToolbarItem(id, true)}</div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      setMoreMenuOpen(false);
                      setToolbarOrganizerOpen(true);
                    }}
                    className="px-3 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-soft)',
                      color: 'var(--text-muted)',
                    }}
                    title={tx('เลือกซ่อนหรือแสดงปุ่มบนหน้าคิดเงิน', 'Choose which buttons appear on POS screen')}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {tx('จัดการ / ซ่อนปุ่ม', 'Hide / Organize')}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {posMode === 'calculator' &&
          queueOrders.some((q) => q.status === 'กำลังทำ' && !q.accepted) && (
            <div
              className="rounded-2xl border-2 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent-primary)',
                color: 'var(--accent-text)',
              }}
            >
              <div className="text-sm font-bold">
                {tx(
                  `มีออเดอร์ออนไลน์ใหม่ ${queueOrders.filter((q) => q.status === 'กำลังทำ' && !q.accepted).length} คิว รอตรวจสลิปและกดรับออเดอร์ค่ะ`,
                  `${queueOrders.filter((q) => q.status === 'กำลังทำ' && !q.accepted).length} new online order(s) waiting for slip check & acceptance`
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  playSoftClick();
                  setPosMode('menu');
                }}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {tx('ดูออเดอร์ & ตรวจสลิป', 'Inspect Orders & Slips')}
              </button>
            </div>
          )}

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
            isMerchantView={true}
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
            onSubmitOrderPayment={(_method, deliveryInfo) => {
              const total = menuCart.reduce((s, i) => s + i.price * i.qty, 0);
              const stars = menuCart.reduce((s, i) => s + i.stars * i.qty, 0);
              setCheckoutState({
                step: 'qr',
                amount: total,
                stars,
                source: 'menu',
                method: 'สแกน QR',
                deliveryInfo,
              });
            }}
            onAcceptQueueOrder={handleAcceptQueueOrder}
            onMarkQueueDone={handleMarkQueueDone}
            onRefreshOrdersFromSheets={scriptUrl.trim() ? () => refreshOnlineOrdersNow(false) : undefined}
          />
        )}
      </main>

      {/* Camera Barcode Scanner */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcodeDetected={(code) => {
          handleBarcodeLookup(code);
        }}
        menuItems={menuItems}
      />

      {/* Toolbar Hide / Show & Permission Organizer Modal */}
      <ToolbarOrganizerModal
        isOpen={toolbarOrganizerOpen}
        onClose={() => setToolbarOrganizerOpen(false)}
        isAdmin={isAdmin}
        toolbarOrder={toolbarOrder}
        hiddenToolbarIds={hiddenToolbarIds}
        cashierAllowedIds={cashierAllowedToolbarIds}
        foodShopNameTh={foodShopNameTh}
        foodShopNameEn={foodShopNameEn}
        onChangeToolbarOrder={(next) => {
          setToolbarOrder(next);
          localStorage.setItem(KEYS.TOOLBAR_ORDER, JSON.stringify(next));
        }}
        onChangeHiddenToolbarIds={(next) => {
          setHiddenToolbarIds(next);
          localStorage.setItem(KEYS.HIDDEN_TOOLBAR, JSON.stringify(next));
          if (isAdmin) {
            pushConfigSnapshotRef.current({ hiddenToolbarIdsJson: JSON.stringify(next) }, true);
          }
        }}
        onChangeCashierAllowedIds={(next) => {
          setCashierAllowedToolbarIds(next);
          localStorage.setItem(KEYS.CASHIER_ALLOWED_TOOLBAR, JSON.stringify(next));
          pushConfigSnapshotRef.current(
            { cashierAllowedToolbarIdsJson: JSON.stringify(next) },
            true
          );
        }}
        onResetDefault={() => {
          setToolbarOrder(DEFAULT_TOOLBAR_ORDER);
          setHiddenToolbarIds(DEFAULT_HIDDEN_TOOLBAR_IDS);
          setCashierAllowedToolbarIds(DEFAULT_CASHIER_ALLOWED_IDS);
          localStorage.setItem(KEYS.TOOLBAR_ORDER, JSON.stringify(DEFAULT_TOOLBAR_ORDER));
          localStorage.setItem(KEYS.HIDDEN_TOOLBAR, JSON.stringify(DEFAULT_HIDDEN_TOOLBAR_IDS));
          localStorage.setItem(
            KEYS.CASHIER_ALLOWED_TOOLBAR,
            JSON.stringify(DEFAULT_CASHIER_ALLOWED_IDS)
          );
          if (isAdmin) {
            pushConfigSnapshotRef.current(
              {
                hiddenToolbarIdsJson: JSON.stringify(DEFAULT_HIDDEN_TOOLBAR_IDS),
                cashierAllowedToolbarIdsJson: JSON.stringify(DEFAULT_CASHIER_ALLOWED_IDS),
              },
              true
            );
          }
        }}
      />

      {/* Exit Gate Slip Scanner Modal (สำหรับคุณแม่และพนักงานตรวจสลิปออกประตู) */}
      <ExitSlipScannerModal
        isOpen={exitScannerOpen}
        onClose={() => setExitScannerOpen(false)}
        receipts={receipts}
        staffName={activeUser.name}
        exitScannerEnabled={exitScannerEnabled}
        onToggleExitScanner={(next) => {
          handleToggleExitScanner(next);
          showToast(
            'ok',
            next
              ? tx('เปิดใช้สแกนสลิปผ่านประตูแล้วค่ะ', 'Exit slip scanner enabled')
              : tx('หยุดใช้สแกนสลิปผ่านประตูชั่วคราวแล้วค่ะ', 'Exit slip scanner paused')
          );
        }}
        onMarkReceiptExited={handleMarkReceiptExited}
      />

      {/* Payment Modals */}
      <CashPaymentModal
        isOpen={checkoutState.step === 'cash'}
        amount={checkoutState.amount}
        items={checkoutState.source === 'calculator' ? billItems : menuCart}
        onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
        onConfirmPaid={() => finalizeSalePayment()}
      />

      <QrPaymentModal
        isOpen={checkoutState.step === 'qr'}
        amount={checkoutState.amount}
        items={checkoutState.source === 'calculator' ? billItems : menuCart}
        promptPayId={activePaymentAccount?.promptPayId || activePaymentAccount?.accountNumber || promptPayId}
        promptPayAccountName={activePaymentAccount?.accountName || promptPayAccountName}
        paymentAccounts={paymentAccounts}
        activePaymentAccountId={activePaymentAccountId}
        onSelectPaymentAccount={handleSelectActivePaymentAccount}
        shopNameTh={checkoutState.source === 'menu' ? foodShopNameTh : shopNameTh}
        enableAutoPaymentCheck={enableAutoPaymentCheck}
        scriptUrl={scriptUrl}
        mascotMode={checkoutState.source === 'menu' ? 'krua' : 'kids'}
        outfits={bearOutfits}
        onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle' }))}
        onConfirmPaid={(slipUrl, bankLabel) => finalizeSalePayment(slipUrl, bankLabel)}
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
        receiptSlipEnabled={receiptSlipEnabled}
        exitScannerEnabled={exitScannerEnabled}
        receiptData={
          checkoutState.receipt
            ? receipts.find((r) => r.billId === checkoutState.receipt?.billId) ||
              checkoutState.receipt
            : null
        }
        onClose={() => setCheckoutState((prev) => ({ ...prev, step: 'idle', receipt: null }))}
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
        promptPayId={activePaymentAccount?.promptPayId || activePaymentAccount?.accountNumber || promptPayId}
        promptPayAccountName={activePaymentAccount?.accountName || promptPayAccountName}
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
            pushConfigSnapshotRef.current({ shopNameTh: val });
          }}
          shopNameEn={shopNameEn}
          onChangeShopNameEn={(val) => {
            setShopNameEn(val);
            localStorage.setItem(KEYS.SHOP_NAME_EN, val);
            pushConfigSnapshotRef.current({ shopNameEn: val });
          }}
          foodShopNameTh={foodShopNameTh}
          onChangeFoodShopNameTh={(val) => {
            setFoodShopNameTh(val);
            localStorage.setItem(KEYS.FOOD_NAME_TH, val);
            pushConfigSnapshotRef.current({ foodShopNameTh: val });
          }}
          foodShopNameEn={foodShopNameEn}
          onChangeFoodShopNameEn={(val) => {
            setFoodShopNameEn(val);
            localStorage.setItem(KEYS.FOOD_NAME_EN, val);
            pushConfigSnapshotRef.current({ foodShopNameEn: val });
          }}
          promptPayId={promptPayId}
          onChangePromptPayId={(val) => {
            setPromptPayId(val);
            localStorage.setItem(KEYS.PROMPTPAY, val);
            pushConfigSnapshotRef.current({ promptPayId: val });
          }}
          promptPayAccountName={promptPayAccountName}
          onChangePromptPayAccountName={(val) => {
            setPromptPayAccountName(val);
            localStorage.setItem(KEYS.PROMPTPAY_NAME, val);
            pushConfigSnapshotRef.current({ promptPayAccountName: val });
          }}
          paymentAccounts={paymentAccounts}
          activePaymentAccountId={activePaymentAccountId}
          onChangePaymentAccounts={handleChangePaymentAccounts}
          onSelectActivePaymentAccount={handleSelectActivePaymentAccount}
          lineShopUrl={lineShopUrl}
          onChangeLineShopUrl={(val) => {
            setLineShopUrl(val);
            localStorage.setItem(KEYS.LINE_SHOP_URL, val);
            pushConfigSnapshotRef.current({ lineShopUrl: val });
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
            pushConfigSnapshotRef.current({ rewardNotice: val });
          }}
          promoTitle={promoTitle}
          onChangePromoTitle={(val) => {
            setPromoTitle(val);
            localStorage.setItem(KEYS.PROMO_TITLE, val);
            pushConfigSnapshotRef.current({ promoTitle: val });
          }}
          promoSubtitle={promoSubtitle}
          onChangePromoSubtitle={(val) => {
            setPromoSubtitle(val);
            localStorage.setItem(KEYS.PROMO_SUBTITLE, val);
            pushConfigSnapshotRef.current({ promoSubtitle: val });
          }}
          faqBubbleText={faqBubbleText}
          onChangeFaqBubbleText={(val) => {
            setFaqBubbleText(val);
            localStorage.setItem(KEYS.FAQ_BUBBLE, val);
            pushConfigSnapshotRef.current({ faqBubbleText: val });
          }}
          faqModalTitle={faqModalTitle}
          onChangeFaqModalTitle={(val) => {
            setFaqModalTitle(val);
            localStorage.setItem(KEYS.FAQ_TITLE, val);
            pushConfigSnapshotRef.current({ faqModalTitle: val });
          }}
          faqModalSubtitle={faqModalSubtitle}
          onChangeFaqModalSubtitle={(val) => {
            setFaqModalSubtitle(val);
            localStorage.setItem(KEYS.FAQ_SUBTITLE, val);
            pushConfigSnapshotRef.current({ faqModalSubtitle: val });
          }}
          faqs={faqs}
          onChangeFaqs={(next) => {
            setFaqs(next);
            saveCachedFaqs(next);
            syncBroadcastRef.current.broadcastConfigUpdated({ faqs: next });
            if (scriptUrl && scriptUrl.trim()) {
              postToSheets(scriptUrl, 'ถามตอบลูกค้า', { faqs: next });
            }
          }}
          rewardOffers={rewardOffers}
          onChangeRewardOffers={(next) => {
            setRewardOffers(next);
            saveCachedRewardOffers(next);
            syncBroadcastRef.current.broadcastConfigUpdated({ rewardOffers: next });
            if (scriptUrl && scriptUrl.trim()) {
              postToSheets(scriptUrl, 'โปรโมชันแลกดาว', { rewardOffers: next });
            }
          }}
          menuItems={menuItems}
          onChangeMenuItems={(next) => {
            setMenuItems(next);
            saveCachedMenu(next);
            syncBroadcastRef.current.broadcastConfigUpdated({ menu: next });
            if (scriptUrl && scriptUrl.trim()) {
              postToSheets(scriptUrl, 'ตั้งค่าเมนู', { menu: next });
            }
          }}
          onlineOrderEnabled={onlineOrderEnabled}
          onToggleOnlineOrder={(val) => {
            setOnlineOrderEnabled(val);
            localStorage.setItem(KEYS.ONLINE_ORDER, String(val));
            pushConfigSnapshotRef.current({ onlineOrderEnabled: String(val) }, true);
          }}
          receiptSlipEnabled={receiptSlipEnabled}
          onToggleReceiptSlip={handleToggleReceiptSlip}
          exitScannerEnabled={exitScannerEnabled}
          onToggleExitScanner={handleToggleExitScanner}
          isTestMode={isTestMode}
          onToggleTestMode={(val) => {
            setIsTestMode(val);
            saveDailyTestMode(val);
          }}
          enableAutoPaymentCheck={enableAutoPaymentCheck}
          onToggleAutoPaymentCheck={(val) => {
            setEnableAutoPaymentCheck(val);
            localStorage.setItem(KEYS.AUTO_CHECK, String(val));
            pushConfigSnapshotRef.current({ enableAutoPaymentCheck: String(val) }, true);
          }}
          onSyncAllNow={syncAllBackendNow}
          onFlushQueueNow={() => flushOfflineQueue(scriptUrl)}
        />
      )}
    </div>
  );
}
