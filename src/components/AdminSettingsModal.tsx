import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  Gift,
  ImagePlus,
  Loader2,
  MessageCircle,
  MessageCircleQuestion,
  Palette,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
  Wifi,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  BANK_PRESETS,
  FaqItem,
  MenuItem,
  PaymentAccount,
  RewardOffer,
  StaffUser,
  THEME_OPTIONS,
  ThemeId,
} from '../config/shopConfig';
import { compressProductImageFile, compressSlipImageFile } from '../utils/imageUpload';
import { isValidPromptPayTarget } from '../utils/promptpay';
import {
  translateCategory,
  translateMenuName,
  translateStatus,
  translateThemeOption,
  useLang,
} from '../config/i18n';
import {
  APPS_SCRIPT_TEMPLATE,
  buildLineDailySummary,
  exportSalesToExcelCsv,
  getOfflineQueue,
  getSaleHistoryLogs,
  getSilentVoidLogs,
  isCustomerItemMissingFromShop,
  postToSheets,
} from '../utils/sheetsSync';
import {
  downloadProductExcelXlsx,
  mergeImportedMenuItems,
  ParsedExcelProductsResult,
  parseProductsFromExcelFile,
} from '../utils/excelProducts';
import {
  decodeQrCodeFromFile,
  extractLineOaId,
} from '../utils/lineOrder';
import {
  fetchOrdersFromSupabase,
  isSafeHttpUrl,
  SUPABASE_SETUP_SQL,
  SUPABASE_URL_DISPLAY,
  SupabaseOrderRow,
  updateOrderStatusInSupabase,
} from '../utils/supabaseClient';
import { playSoftClick } from '../utils/sound';

export type AdminSettingsTab = 'general' | 'products' | 'faq' | 'summary' | 'sheets';

interface AdminSettingsModalProps {
  isOpen: boolean;
  initialTab?: AdminSettingsTab;
  onClose: () => void;
  themeId: ThemeId;
  onChangeTheme: (id: ThemeId) => void;
  orgCode: string;
  staffUsers: Record<string, StaffUser>;
  shopNameTh: string;
  onChangeShopNameTh: (val: string) => void;
  shopNameEn: string;
  onChangeShopNameEn: (val: string) => void;
  foodShopNameTh: string;
  onChangeFoodShopNameTh: (val: string) => void;
  foodShopNameEn: string;
  onChangeFoodShopNameEn: (val: string) => void;
  promptPayId: string;
  onChangePromptPayId: (val: string) => void;
  promptPayAccountName: string;
  onChangePromptPayAccountName: (val: string) => void;
  paymentAccounts: PaymentAccount[];
  activePaymentAccountId: string;
  onChangePaymentAccounts: (next: PaymentAccount[]) => void;
  onSelectActivePaymentAccount: (id: string) => void;
  lineShopUrl: string;
  onChangeLineShopUrl: (val: string) => void;
  lineQrImageUrl: string;
  onChangeLineQrImageUrl: (val: string) => void;
  scriptUrl: string;
  onChangeScriptUrl: (val: string) => void;
  rewardNotice: string;
  onChangeRewardNotice: (val: string) => void;
  promoTitle: string;
  onChangePromoTitle: (val: string) => void;
  promoSubtitle: string;
  onChangePromoSubtitle: (val: string) => void;
  faqBubbleText: string;
  onChangeFaqBubbleText: (val: string) => void;
  faqModalTitle: string;
  onChangeFaqModalTitle: (val: string) => void;
  faqModalSubtitle: string;
  onChangeFaqModalSubtitle: (val: string) => void;
  faqs: FaqItem[];
  onChangeFaqs: (next: FaqItem[]) => void;
  rewardOffers: RewardOffer[];
  onChangeRewardOffers: (next: RewardOffer[]) => void;
  menuItems: MenuItem[];
  onChangeMenuItems: (next: MenuItem[]) => void;
  onlineOrderEnabled: boolean;
  onToggleOnlineOrder: (val: boolean) => void;
  receiptSlipEnabled: boolean;
  onToggleReceiptSlip: (val: boolean) => void;
  exitScannerEnabled: boolean;
  onToggleExitScanner: (val: boolean) => void;
  isTestMode: boolean;
  onToggleTestMode: (val: boolean) => void;
  enableAutoPaymentCheck: boolean;
  onToggleAutoPaymentCheck: (val: boolean) => void;
  onSyncAllNow: () => Promise<string>;
  onFlushQueueNow: () => Promise<number>;
  supabaseOrdersVersion?: number;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  initialTab = 'general',
  onClose,
  themeId,
  onChangeTheme,
  orgCode,
  staffUsers,
  shopNameTh,
  onChangeShopNameTh,
  shopNameEn,
  onChangeShopNameEn,
  foodShopNameTh,
  onChangeFoodShopNameTh,
  foodShopNameEn,
  onChangeFoodShopNameEn,
  promptPayId,
  onChangePromptPayId,
  promptPayAccountName,
  onChangePromptPayAccountName,
  paymentAccounts,
  activePaymentAccountId,
  onChangePaymentAccounts,
  onSelectActivePaymentAccount,
  lineShopUrl,
  onChangeLineShopUrl,
  lineQrImageUrl,
  onChangeLineQrImageUrl,
  scriptUrl,
  onChangeScriptUrl,
  rewardNotice,
  onChangeRewardNotice,
  promoTitle,
  onChangePromoTitle,
  promoSubtitle,
  onChangePromoSubtitle,
  faqBubbleText,
  onChangeFaqBubbleText,
  faqModalTitle,
  onChangeFaqModalTitle,
  faqModalSubtitle,
  onChangeFaqModalSubtitle,
  faqs,
  onChangeFaqs,
  rewardOffers,
  onChangeRewardOffers,
  menuItems,
  onChangeMenuItems,
  onlineOrderEnabled,
  onToggleOnlineOrder,
  receiptSlipEnabled,
  onToggleReceiptSlip,
  exitScannerEnabled,
  onToggleExitScanner,
  isTestMode,
  onToggleTestMode,
  enableAutoPaymentCheck,
  onToggleAutoPaymentCheck,
  onSyncAllNow,
  onFlushQueueNow,
  supabaseOrdersVersion = 0,
}) => {
  const { lang, tx } = useLang();
  const [activeTab, setActiveTab] = useState<AdminSettingsTab>(initialTab);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [supabaseOrders, setSupabaseOrders] = useState<SupabaseOrderRow[]>([]);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState('');
  const [supabaseStatusFilter, setSupabaseStatusFilter] = useState<
    'all' | 'pending' | 'paid' | 'completed'
  >('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | number | null>(null);
  const [showSqlHelper, setShowSqlHelper] = useState(false);
  const [copiedSqlSetup, setCopiedSqlSetup] = useState(false);
  const [previewBill, setPreviewBill] = useState<{
    id: string;
    timestamp: string;
    totalAmount: number;
    staffName: string;
    deliveryInfo?: string;
    slipImageUrl: string;
  } | null>(null);

  const loadSupabaseOrders = useCallback(async () => {
    setSupabaseLoading(true);
    setSupabaseError('');
    const { orders, error } = await fetchOrdersFromSupabase(100);
    setSupabaseLoading(false);
    if (error) {
      setSupabaseError(error);
      return;
    }
    setSupabaseOrders(orders);
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'summary') {
      void loadSupabaseOrders();
    }
  }, [isOpen, activeTab, supabaseOrdersVersion, loadSupabaseOrders]);

  const handleChangeSupabaseOrderStatus = async (
    orderId: string | number,
    nextStatus: 'pending' | 'paid' | 'completed' | 'cancelled'
  ) => {
    playSoftClick();
    setUpdatingOrderId(orderId);
    const { order, error } = await updateOrderStatusInSupabase(orderId, nextStatus);
    setUpdatingOrderId(null);
    if (error) {
      setSupabaseError(error);
      return;
    }
    setSupabaseOrders((prev) =>
      prev.map((row) =>
        row.id === orderId ? (order || { ...row, status: nextStatus }) : row
      )
    );
    setStatusMsg(
      tx(
        `อัปเดตสถานะออเดอร์ #${orderId} เป็น "${nextStatus}" เรียบร้อยแล้วค่ะ`,
        `Updated order #${orderId} status to "${nextStatus}".`
      )
    );
  };

  const filteredSupabaseOrders = useMemo(() => {
    if (supabaseStatusFilter === 'all') return supabaseOrders;
    return supabaseOrders.filter(
      (o) => String(o.status || 'pending').toLowerCase() === supabaseStatusFilter
    );
  }, [supabaseOrders, supabaseStatusFilter]);

  const supabaseOrderStats = useMemo(() => {
    let pendingCount = 0;
    let paidRevenue = 0;
    let totalRevenue = 0;
    supabaseOrders.forEach((o) => {
      const amt = Number(o.total_amount) || 0;
      const st = String(o.status || 'pending').toLowerCase();
      if (st !== 'cancelled') totalRevenue += amt;
      if (st === 'pending') pendingCount += 1;
      if (st === 'paid' || st === 'completed') paidRevenue += amt;
    });
    return {
      totalCount: supabaseOrders.length,
      pendingCount,
      paidRevenue,
      totalRevenue,
    };
  }, [supabaseOrders]);

  // Add/Edit Payment Bank Account state
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [bankNameInput, setBankNameInput] = useState('ธนาคารกสิกรไทย (KBank)');
  const [bankAccountNoInput, setBankAccountNoInput] = useState('');
  const [bankAccountNameInput, setBankAccountNameInput] = useState(promptPayAccountName || '');
  const [bankPromptPayInput, setBankPromptPayInput] = useState('');
  const [bankQrImageInput, setBankQrImageInput] = useState('');
  const bankQrInputRef = useRef<HTMLInputElement>(null);
  const lineQrInputRef = useRef<HTMLInputElement>(null);
  const [lineQrFeedback, setLineQrFeedback] = useState('');
  const [isReadingLineQr, setIsReadingLineQr] = useState(false);

  // Add FAQ state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  // Add Reward Offer state
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardStars, setNewRewardStars] = useState('50');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [newRewardTerms, setNewRewardTerms] = useState('');
  const [newRewardExpiry, setNewRewardExpiry] = useState('31 ธันวาคม 2569');

  // Excel Barcode Product Importer & Catalog Manager state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newProdImageInputRef = useRef<HTMLInputElement>(null);
  const editProdImageInputRef = useRef<HTMLInputElement>(null);
  const [editingImageItemId, setEditingImageItemId] = useState<string | null>(null);
  const [excelPreview, setExcelPreview] = useState<ParsedExcelProductsResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [productSearch, setProductSearch] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStars, setNewProdStars] = useState('2');
  const [newProdCategory, setNewProdCategory] = useState('อาหารจานเดียว');
  const [newProdImageUrl, setNewProdImageUrl] = useState('');
  const [addProdFeedback, setAddProdFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [productSourceFilter, setProductSourceFilter] = useState<
    'all' | 'shop' | 'customer' | 'missing'
  >('all');
  const excelPreviewRef = useRef<HTMLDivElement>(null);

  const productSourceCounts = useMemo(() => {
    const shop = menuItems.filter((m) => m.source !== 'customer').length;
    const customer = menuItems.filter((m) => m.source === 'customer').length;
    const missing = menuItems.filter((m) => isCustomerItemMissingFromShop(m, menuItems)).length;
    return { total: menuItems.length, shop, customer, missing };
  }, [menuItems]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return menuItems.filter((m) => {
      if (productSourceFilter === 'shop' && m.source === 'customer') return false;
      if (productSourceFilter === 'customer' && m.source !== 'customer') return false;
      if (productSourceFilter === 'missing' && !isCustomerItemMissingFromShop(m, menuItems)) {
        return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.barcode.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [menuItems, productSearch, productSourceFilter]);

  // Customer Self-Order QR Poster Generator state
  const [customerQrBaseUrl, setCustomerQrBaseUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('kkp_customer_qr_base_url') || window.location.origin;
    } catch {
      return '';
    }
  });
  const [customerQrTable, setCustomerQrTable] = useState<string>('');
  const [customerQrDataUrl, setCustomerQrDataUrl] = useState<string>('');
  const [copiedCustomerQrLink, setCopiedCustomerQrLink] = useState(false);

  const customerOrderTargetUrl = useMemo(() => {
    const base = (customerQrBaseUrl || (typeof window !== 'undefined' ? window.location.origin : ''))
      .trim()
      .replace(/\/+$/, '');
    if (!base) return '';
    const params = new URLSearchParams();
    params.set('mode', 'customer');
    if (customerQrTable.trim()) {
      params.set('table', customerQrTable.trim());
    }
    return `${base}/?${params.toString()}`;
  }, [customerQrBaseUrl, customerQrTable]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'general' || !customerOrderTargetUrl) return;
    let active = true;
    QRCode.toDataURL(customerOrderTargetUrl, {
      width: 360,
      margin: 2,
      color: { dark: '#1F2937', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setCustomerQrDataUrl(url);
      })
      .catch(() => {
        if (active) setCustomerQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, activeTab, customerOrderTargetUrl]);

  const handleDownloadCustomerQrPoster = () => {
    if (!customerQrDataUrl) return;
    playSoftClick();
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1040;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Warm cream card background
      ctx.fillStyle = '#FAF6F0';
      ctx.fillRect(0, 0, 800, 1040);

      // Soft outer frame
      ctx.strokeStyle = '#5FB894';
      ctx.lineWidth = 14;
      ctx.strokeRect(24, 24, 752, 992);

      // Top Header Banner
      ctx.fillStyle = '#2F2620';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🍲 ${foodShopNameTh} · ${shopNameTh}`, 400, 105);

      ctx.fillStyle = '#22664C';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(
        customerQrTable.trim()
          ? `โต๊ะที่ ${customerQrTable.trim()} · สแกนเพื่อสั่งอาหาร & เครื่องดื่ม`
          : 'สแกนคิวอาร์โค้ดเพื่อสั่งอาหาร & เครื่องดื่ม',
        400,
        162
      );

      // White QR container
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(150, 210, 500, 500);
      ctx.strokeStyle = '#CBEAD9';
      ctx.lineWidth = 6;
      ctx.strokeRect(150, 210, 500, 500);
      ctx.drawImage(img, 180, 240, 440, 440);

      // Footer instructions
      ctx.fillStyle = '#1E3A8A';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('รับชำระผ่านการสแกน QR เท่านั้น', 400, 790);

      ctx.fillStyle = '#57534E';
      ctx.font = '24px sans-serif';
      ctx.fillText('รองรับทั้ง ทานนี้ · กลับบ้าน · ให้พ่อไปส่ง', 400, 840);
      ctx.fillText('สแกนกล้องมือถือหรือแอป LINE เพื่อเปิดเมนูทันที', 400, 886);

      ctx.fillStyle = '#9A8C7D';
      ctx.font = '18px monospace';
      const shortUrl =
        customerOrderTargetUrl.length > 58
          ? `${customerOrderTargetUrl.slice(0, 55)}...`
          : customerOrderTargetUrl;
      ctx.fillText(shortUrl, 400, 960);

      const link = document.createElement('a');
      const safeTable = customerQrTable.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      link.download = safeTable
        ? `qr-order-table-${safeTable}.png`
        : 'qr-order-storefront.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = customerQrDataUrl;
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setStatusMsg('');
      setExcelPreview(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const offlineQueue = getOfflineQueue();
  const saleLogs = getSaleHistoryLogs();
  const voidLogs = getSilentVoidLogs();
  const lineSummary = buildLineDailySummary(saleLogs, shopNameTh, foodShopNameTh, {
    id: promptPayId,
    accountName: promptPayAccountName,
  });
  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineSummary.text)}`;

  const handleCopyScript = async () => {
    playSoftClick();
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      setStatusMsg(
        tx(
          'กรุณาคัดลอกโค้ดด้วยตนเองจากกล่องด้านล่างค่ะ',
          'Please manually copy the script code from the box below.'
        )
      );
    }
  };

  const handleCopyLineSummary = async () => {
    playSoftClick();
    try {
      await navigator.clipboard.writeText(lineSummary.text);
      setCopiedLine(true);
      setTimeout(() => setCopiedLine(false), 2500);
    } catch {
      setStatusMsg(
        tx(
          'ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกข้อความในกล่องด้านบนค่ะ',
          'Auto-copy blocked; please copy the summary text above.'
        )
      );
    }
  };

  const handleSyncAll = async () => {
    playSoftClick();
    setSyncing(true);
    setStatusMsg('');
    const msg = await onSyncAllNow();
    setSyncing(false);
    setStatusMsg(msg);
  };

  const handleFlushQueue = async () => {
    playSoftClick();
    setSyncing(true);
    const count = await onFlushQueueNow();
    setSyncing(false);
    setStatusMsg(
      count > 0
        ? tx(`ส่งข้อมูลที่ค้าง ${count} รายการเข้าชีตสำเร็จค่ะ`, `Flushed ${count} offline items to Google Sheets.`)
        : tx('ไม่มีรายการค้างส่ง หรือยังไม่ได้ใส่ลิงก์ชีตค่ะ', 'No pending offline items or missing Script URL.')
    );
  };

  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const next: FaqItem[] = [
      ...faqs,
      {
        id: `faq_${Date.now()}`,
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
      },
    ];
    onChangeFaqs(next);
    setNewQuestion('');
    setNewAnswer('');
    setStatusMsg(tx('เพิ่มคำถาม-คำตอบด่วนเรียบร้อยแล้วค่ะ', 'Quick FAQ item added!'));
  };

  const handleUpdateFaq = (id: string, field: 'question' | 'answer', value: string) => {
    onChangeFaqs(faqs.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const handleDeleteFaq = (id: string) => {
    playSoftClick();
    onChangeFaqs(faqs.filter((f) => f.id !== id));
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    playSoftClick();
    setStatusMsg('');
    try {
      const parsed = await parseProductsFromExcelFile(file);
      if (parsed.items.length === 0) {
        setExcelPreview(null);
        setStatusMsg(
          parsed.warnings[0] ||
            tx(
              'ไม่พบข้อมูลสินค้าในไฟล์ กรุณาตรวจสอบหัวตาราง (เลขบาร์โค้ด, ชื่อสินค้า, ราคา) ค่ะ',
              'No products found in file. Please check column headers (Barcode, Product Name, Price).'
            )
        );
        return;
      }
      setExcelPreview(parsed);
      window.setTimeout(() => {
        excelPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    } catch {
      setExcelPreview(null);
      setStatusMsg(
        tx(
          'ไม่สามารถอ่านไฟล์นี้ได้ กรุณาใช้ไฟล์ .xlsx, .xls หรือ .csv ค่ะ',
          'Could not read this file. Please upload a .xlsx, .xls, or .csv file.'
        )
      );
    }
  };

  const handleConfirmExcelImport = () => {
    if (!excelPreview || excelPreview.items.length === 0) return;
    playSoftClick();
    const { nextItems, addedCount, updatedCount } = mergeImportedMenuItems(
      menuItems,
      excelPreview.items,
      importMode
    );
    onChangeMenuItems(nextItems);
    setExcelPreview(null);
    setProductSearch('');
    const msg =
      importMode === 'replace'
        ? tx(
            `นำเข้าและแทนที่สินค้าทั้งหมด ${addedCount} รายการเรียบร้อยแล้วค่ะ (พร้อมยิงบาร์โค้ดทันที!)`,
            `Imported and replaced catalog with ${addedCount} items (ready for barcode scan!).`
          )
        : tx(
            `นำเข้าข้อมูลสำเร็จ! เพิ่มใหม่ ${addedCount} รายการ, อัปเดต ${updatedCount} รายการ (รวม ${nextItems.length} รายการ)`,
            `Import complete! Added ${addedCount}, updated ${updatedCount} (Total: ${nextItems.length} items).`
          );
    setStatusMsg(msg);
    setAddProdFeedback({ type: 'ok', text: msg });
  };

  const handleAddSingleProduct = (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    setAddProdFeedback(null);
    const name = newProdName.trim();
    const priceTrimmed = newProdPrice.trim();
    const price = Number(priceTrimmed);
    if (!name) {
      const errText = tx('กรุณากรอกชื่อสินค้า/เมนูอาหารก่อนนะคะ', 'Please enter a product or dish name.');
      setStatusMsg(errText);
      setAddProdFeedback({ type: 'err', text: errText });
      return;
    }
    if (!priceTrimmed || Number.isNaN(price) || price <= 0) {
      const errText = tx(
        'กรุณากรอกราคาขาย (มากกว่า 0 บาท) เพื่อให้สินค้าแสดงในหน้าเมนูขายค่ะ',
        'Please enter a selling price greater than 0 so it appears on the menu.'
      );
      setStatusMsg(errText);
      setAddProdFeedback({ type: 'err', text: errText });
      return;
    }
    const stars = Math.max(0, parseInt(newProdStars, 10) || 1);
    const barcode = newProdBarcode.trim();
    const newItem: MenuItem = {
      id: `manual_${Date.now()}`,
      barcode,
      name,
      price,
      stars,
      category: newProdCategory.trim() || 'สินค้าทั่วไป',
      imageUrl: newProdImageUrl || undefined,
      status: 'พร้อมขาย',
      source: 'shop',
    };

    const existingIdx = menuItems.findIndex((item) => {
      if (barcode && item.barcode) {
        return item.barcode.trim() === barcode;
      }
      return item.name.trim() === name;
    });

    let nextItems: MenuItem[];
    let isUpdate = false;
    if (existingIdx >= 0) {
      isUpdate = true;
      nextItems = menuItems.map((item, idx) =>
        idx === existingIdx
          ? {
              ...newItem,
              id: item.id,
              imageUrl: newItem.imageUrl || item.imageUrl,
            }
          : item
      );
    } else {
      // Prepend newly added product so it appears right at the top of the catalog immediately
      nextItems = [newItem, ...menuItems];
    }

    onChangeMenuItems(nextItems);
    setProductSearch('');
    setNewProdBarcode('');
    setNewProdName('');
    setNewProdPrice('');
    setNewProdStars('2');
    setNewProdImageUrl('');
    const okMsg = isUpdate
      ? tx(`อัปเดตสินค้า "${name}" (฿${price}) เรียบร้อยแล้วค่ะ`, `Updated product "${name}" (฿${price}).`)
      : tx(
          `เพิ่มสินค้า "${name}" (฿${price}) เข้าระบบเรียบร้อยแล้วค่ะ พร้อมขายและสั่งผ่านเมนูทันที!`,
          `Added "${name}" (฿${price}) to catalog — live in POS & customer menu!`
        );
    setStatusMsg(okMsg);
    setAddProdFeedback({ type: 'ok', text: okMsg });
  };

  const handleNewProductImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    playSoftClick();
    try {
      const compressed = await compressProductImageFile(file);
      setNewProdImageUrl(compressed);
      setStatusMsg(tx('อัปโหลดรูปภาพสินค้าพร้อมบันทึกแล้วค่ะ', 'Product photo uploaded and ready to save!'));
    } catch {
      setStatusMsg(
        tx('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกไฟล์ JPG หรือ PNG ค่ะ', 'Could not read image file. Please choose JPG or PNG.')
      );
    }
  };

  const handleExistingProductImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetId = editingImageItemId;
    setEditingImageItemId(null);
    if (!file || !targetId) return;
    playSoftClick();
    try {
      const compressed = await compressProductImageFile(file);
      const target = menuItems.find((m) => m.id === targetId);
      onChangeMenuItems(
        menuItems.map((m) => (m.id === targetId ? { ...m, imageUrl: compressed } : m))
      );
      setStatusMsg(
        tx(
          `อัปโหลดรูปภาพ "${target?.name || 'สินค้า'}" เรียบร้อยแล้วค่ะ`,
          `Updated photo for "${target?.name || 'product'}"!`
        )
      );
    } catch {
      setStatusMsg(
        tx('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกไฟล์ JPG หรือ PNG ค่ะ', 'Could not read image file. Please choose JPG or PNG.')
      );
    }
  };

  const handleClearProductImage = (id: string) => {
    playSoftClick();
    onChangeMenuItems(menuItems.map((m) => (m.id === id ? { ...m, imageUrl: undefined } : m)));
  };

  const handleToggleProductStatus = (id: string) => {
    playSoftClick();
    onChangeMenuItems(
      menuItems.map((m) =>
        m.id === id ? { ...m, status: m.status === 'พร้อมขาย' ? 'หมด' : 'พร้อมขาย' } : m
      )
    );
  };

  const handleDeleteProduct = (id: string) => {
    playSoftClick();
    onChangeMenuItems(menuItems.filter((m) => m.id !== id));
  };

  const handlePromoteCustomerProduct = (id: string) => {
    playSoftClick();
    const target = menuItems.find((m) => m.id === id);
    if (!target) return;
    onChangeMenuItems(
      menuItems.map((m) => (m.id === id ? { ...m, source: 'shop', status: 'พร้อมขาย' } : m))
    );
    setStatusMsg(
      tx(
        `รับ "${target.name}" เข้ารายการสินค้าของร้านเรียบร้อยแล้วค่ะ (ย้ายออกจากรายการรอรับเข้าแล้ว)`,
        `Promoted "${target.name}" into official shop catalog!`
      )
    );
  };

  const handlePushMenuToSheets = async () => {
    playSoftClick();
    if (!scriptUrl.trim()) {
      setStatusMsg(
        tx(
          'กรุณาใส่ลิงก์ Google Apps Script URL ในแท็บ "Google Sheets หลังบ้าน" ก่อนนะคะ',
          'Please enter your Google Apps Script URL in the "Google Sheets" tab first.'
        )
      );
      return;
    }
    setSyncing(true);
    const res = await postToSheets(scriptUrl, 'ตั้งค่าเมนู', {
      menu: menuItems,
    });
    setSyncing(false);
    setStatusMsg(
      res.sent
        ? tx(
            `ส่งขึ้น Google Sheets ไฟล์เดียวกันแล้วค่ะ (แยกแท็บ "ตั้งค่าเมนู" ${productSourceCounts.shop} รายการ และ "สินค้าลูกค้าส่งเข้า" ${productSourceCounts.customer} รายการ · ยังไม่มีในร้าน ${productSourceCounts.missing} รายการ)`,
            `Pushed ${productSourceCounts.shop} shop items & ${productSourceCounts.customer} customer items to separate tabs in the same Google Sheet!`
          )
        : tx(
            'บันทึกเข้าคิวออฟไลน์แล้ว ระบบจะส่งขึ้น Google Sheets เมื่อต่อเน็ตค่ะ',
            'Saved to offline queue; will sync once back online.'
          )
    );
  };

  const handleAddRewardOffer = (e: React.FormEvent) => {
    e.preventDefault();
    playSoftClick();
    if (!newRewardTitle.trim()) return;
    const next: RewardOffer[] = [
      ...rewardOffers,
      {
        id: `rw_${Date.now()}`,
        title: newRewardTitle.trim(),
        starsRequired: Math.max(1, parseInt(newRewardStars, 10) || 50),
        description: newRewardDesc.trim(),
        terms: newRewardTerms.trim(),
        expiryDate: newRewardExpiry.trim() || 'ไม่มีกำหนด',
        active: true,
      },
    ];
    onChangeRewardOffers(next);
    setNewRewardTitle('');
    setNewRewardStars('50');
    setNewRewardDesc('');
    setNewRewardTerms('');
    setStatusMsg(tx('เพิ่มข้อเสนอของรางวัลแลกดาวเรียบร้อยแล้วค่ะ', 'Star reward offer added!'));
  };

  const handleUpdateRewardOffer = (
    id: string,
    field: keyof RewardOffer,
    value: string | number | boolean
  ) => {
    onChangeRewardOffers(
      rewardOffers.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleDeleteRewardOffer = (id: string) => {
    playSoftClick();
    onChangeRewardOffers(rewardOffers.filter((r) => r.id !== id));
  };

  const handlePushRewardsToSheets = async () => {
    playSoftClick();
    if (!scriptUrl.trim()) {
      setStatusMsg(
        tx(
          'กรุณาใส่ลิงก์ Google Apps Script URL ในแท็บ "Google Sheets หลังบ้าน" ก่อนนะคะ',
          'Please enter your Google Apps Script URL in the "Google Sheets" tab first.'
        )
      );
      return;
    }
    setSyncing(true);
    const res = await postToSheets(scriptUrl, 'โปรโมชันแลกดาว', {
      rewardOffers,
    });
    setSyncing(false);
    setStatusMsg(
      res.sent
        ? tx(
            'บันทึกข้อเสนอแลกดาวขึ้นแท็บ "โปรโมชันแลกดาว" ใน Google Sheets แล้วค่ะ',
            'Saved star reward offers to Google Sheets.'
          )
        : tx(
            'บันทึกเข้าคิวออฟไลน์แล้ว ระบบจะส่งขึ้น Google Sheets เมื่อต่อเน็ตค่ะ',
            'Saved to offline queue; will sync once back online.'
          )
    );
  };

  const handlePushFaqsToSheets = async () => {
    playSoftClick();
    if (!scriptUrl.trim()) {
      setStatusMsg(
        tx(
          'กรุณาใส่ลิงก์ Google Apps Script URL ในแท็บ "Google Sheets หลังบ้าน" ก่อนนะคะ',
          'Please enter your Google Apps Script URL in the "Google Sheets" tab first.'
        )
      );
      return;
    }
    setSyncing(true);
    const [resFaq, resSettings] = await Promise.all([
      postToSheets(scriptUrl, 'ถามตอบลูกค้า', { faqs }),
      postToSheets(scriptUrl, 'ตั้งค่าระบบ', {
        settings: {
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
          lineQrImageUrl,
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
        },
      }),
    ]);
    setSyncing(false);
    setStatusMsg(
      resFaq.sent && resSettings.sent
        ? tx(
            `ส่งข้อความถาม-ตอบหน้าแรก (${faqs.length} ข้อ) ขึ้น Google Sheets เรียบร้อยแล้วค่ะ`,
            `Pushed home Q&A copy and ${faqs.length} FAQ items to Google Sheets!`
          )
        : tx(
            'บันทึกเข้าคิวออฟไลน์แล้ว ระบบจะส่งขึ้น Google Sheets เมื่อต่อเน็ตค่ะ',
            'Saved to offline queue; will sync once back online.'
          )
    );
  };

  const handlePushAllToSheets = async () => {
    playSoftClick();
    if (!scriptUrl.trim()) {
      setStatusMsg(
        tx(
          'กรุณาใส่ลิงก์ Google Apps Script URL ก่อนนะคะ',
          'Please enter your Google Apps Script URL first.'
        )
      );
      return;
    }
    setSyncing(true);
    const staffList = Object.entries(staffUsers).map(([pin, u]) => ({
      pin,
      name: u.name,
      role: u.role,
    }));
    const r1 = await postToSheets(scriptUrl, 'ตั้งค่าระบบ', {
      settings: {
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
        lineQrImageUrl,
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
      },
    });
    const r2 = await postToSheets(scriptUrl, 'ตั้งค่าเมนู', { menu: menuItems });
    const r3 = await postToSheets(scriptUrl, 'ถามตอบลูกค้า', { faqs });
    const r4 = await postToSheets(scriptUrl, 'โปรโมชันแลกดาว', { rewardOffers });
    const r5 = await postToSheets(scriptUrl, 'ผู้ใช้งานและPIN', { staffList });
    setSyncing(false);

    if (r1.sent && r2.sent && r3.sent && r4.sent && r5.sent) {
      setStatusMsg(
        tx(
          'สร้างแท็บและส่งข้อมูล (ตั้งค่าระบบ, เมนู, พนักงาน/PIN, ถาม-ตอบ, แลกดาว) ขึ้น Google Sheets เรียบร้อยแล้วค่ะ!',
          'Successfully initialized tabs & pushed settings, menu, staff PINs, FAQs, and rewards to Google Sheets!'
        )
      );
    } else {
      setStatusMsg(
        tx(
          'บันทึกบางส่วนเข้าคิวออฟไลน์แล้ว กรุณาตรวจสอบอินเทอร์เน็ตและลองอีกครั้งค่ะ',
          'Some items were queued offline. Please check your connection and try again.'
        )
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-4">
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-3xl border shadow-xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-5 sm:px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
              {tx('⚙️ ตั้งค่าร้าน & สรุปยอด (เฉพาะผู้ดูแลร้าน)', '⚙️ Shop Settings & Reports (Admin Only)')}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {tx(
                `รหัสร้านค้า: ${orgCode} · ซ่อนจากหน้าลูกค้าสั่งซื้อเอง`,
                `Store ID: ${orgCode} · Hidden from Customer self-order screens`
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            aria-label={tx('ปิดหน้าต่าง', 'Close settings')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex gap-2 px-5 sm:px-6 py-3 border-b shrink-0 overflow-x-auto"
          style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-soft)' }}
        >
          {[
            { id: 'general', label: tx('ธีม & โหมดร้าน', 'Themes & Mode'), icon: Palette },
            { id: 'products', label: tx('สินค้าบาร์โค้ด (Excel)', 'Products & Excel'), icon: Barcode },
            { id: 'summary', label: tx('ออเดอร์ / ตรวจสอบยอดขาย', 'Orders & Sales Check'), icon: FileSpreadsheet },
            { id: 'faq', label: tx('โปรโมชัน / ถาม-ตอบหน้าแรก', 'Promos / Home Q&A'), icon: MessageCircleQuestion },
            { id: 'sheets', label: tx('Google Sheets หลังบ้าน', 'Google Sheets'), icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playSoftClick();
                  setActiveTab(tab.id as AdminSettingsTab);
                }}
                className="px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-card)',
                  color: active ? '#FFFFFF' : 'var(--text-main)',
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {statusMsg && (
            <div
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-center"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              {statusMsg}
            </div>
          )}

          {/* ================= TAB 1: THEME & STORE SETTINGS ================= */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Real vs Test Mode Segmented Switch */}
              <div className="space-y-2.5">
                <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx(
                    'โหมดการทำงานของระบบขาย (รีเซ็ตเป็นขายจริงอัตโนมัติทุกวันใหม่)',
                    'POS Operating Mode (Auto-resets to Live Mode each new day)'
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      onToggleTestMode(false);
                    }}
                    className="p-4 rounded-2xl border-2 text-left cursor-pointer transition-colors"
                    style={{
                      backgroundColor: !isTestMode ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                      borderColor: !isTestMode ? '#16A34A' : 'var(--border-soft)',
                    }}
                  >
                    <p className="font-bold text-sm sm:text-base text-emerald-800">
                      {tx('🟢 โหมดขายจริง', '🟢 Live Sales Mode')}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {tx(
                        'ส่งลง "ขายจริง_หน้าร้าน" / "ขายจริง_ครัวแม่วัง"',
                        'Syncs to live Storefront & Krua Mae Wang tabs'
                      )}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      onToggleTestMode(true);
                    }}
                    className="p-4 rounded-2xl border-2 text-left cursor-pointer transition-colors"
                    style={{
                      backgroundColor: isTestMode ? '#FFEDD5' : 'var(--bg-canvas)',
                      borderColor: isTestMode ? '#EA580C' : 'var(--border-soft)',
                    }}
                  >
                    <p className="font-bold text-sm sm:text-base text-orange-800">
                      {tx('🟠 โหมดทดสอบระบบ', '🟠 System Test Mode')}
                    </p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      {tx(
                        'ส่งแยกเข้าแท็บ "ทดสอบระบบ" ไม่ปนยอดจริง',
                        'Syncs separately to the "Test" tab only'
                      )}
                    </p>
                  </button>
                </div>
              </div>

              {/* 4 Eye-Friendly Themes */}
              <div className="space-y-2.5">
                <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('เลือกโทนสีสบายตา (4 โทน)', 'Choose Comfort Color Theme (4 Themes)')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((t) => {
                    const selected = themeId === t.id;
                    const themeDisplay = translateThemeOption(t.id, t.name, t.description, lang);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          onChangeTheme(t.id);
                        }}
                        className="p-3.5 rounded-2xl border-2 text-left flex items-center gap-3 cursor-pointer transition-transform active:scale-[0.99]"
                        style={{
                          backgroundColor: t.previewBg,
                          borderColor: selected ? t.previewAccent : 'var(--border-soft)',
                        }}
                      >
                        <span
                          className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white"
                          style={{ backgroundColor: t.previewAccent }}
                        >
                          {selected && <Check className="w-5 h-5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#2F2620]">{themeDisplay.name}</p>
                          <p className="text-xs text-[#6B5E53] truncate">{themeDisplay.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Operation Switches */}
              <div className="space-y-3">
                <label
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
                      {tx('เปิดรับออเดอร์ออนไลน์ / สั่งเมนูหน้าร้าน', 'Accept Self-Orders & Online Menu Orders')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'ปิดชั่วคราวได้เมื่อของหมดหรือหน้าร้านยุ่งมาก',
                        'Temporarily pause when items sell out or during rush hours'
                      )}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={onlineOrderEnabled}
                    onChange={(e) => onToggleOnlineOrder(e.target.checked)}
                    className="w-6 h-6 accent-emerald-600 cursor-pointer"
                  />
                </label>

                <label
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
                      {tx('แจกใบสลิป & QR สแกนผ่านประตูหลังชำระเงิน', 'Issue Receipt Slip & Exit Gate QR After Payment')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'ปิดชั่วคราวได้หากไม่ต้องการออกใบสลิป (สามารถกดหยุด/เปิดจากแถบปุ่มด้านบนได้เลยค่ะ)',
                        'Pause slip issuance anytime (also toggleable from the top POS toolbar)'
                      )}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={receiptSlipEnabled}
                    onChange={(e) => onToggleReceiptSlip(e.target.checked)}
                    className="w-6 h-6 accent-emerald-600 cursor-pointer"
                  />
                </label>

                <label
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
                      {tx('เปิดระบบสแกนใบสลิปผ่านประตู (สำหรับคุณแม่ / พนักงาน)', 'Enable Exit Gate Slip Scanner')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'กดใช้หรือหยุดใช้ชั่วคราวได้เมื่อไม่ได้ตรวจสลิปที่ประตู (สลับจากปุ่มบนแถบหน้าคิดเงินได้ทันทีค่ะ)',
                        'Pause or resume exit gate QR scanning anytime from the top toolbar or here'
                      )}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={exitScannerEnabled}
                    onChange={(e) => onToggleExitScanner(e.target.checked)}
                    className="w-6 h-6 accent-emerald-600 cursor-pointer"
                  />
                </label>

                <label
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
                      {tx('เช็กยอดเงินเข้าอัตโนมัติทุก 3 วินาที', 'Auto-Check QR Payment Every 3 Seconds')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'ค่าเริ่มต้นปิดไว้ (รอฟังเสียงจากลำโพงธนาคารแล้วกดยืนยันเอง)',
                        'Off by default (listen for bank alert and tap Confirm manually)'
                      )}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableAutoPaymentCheck}
                    onChange={(e) => onToggleAutoPaymentCheck(e.target.checked)}
                    className="w-6 h-6 accent-emerald-600 cursor-pointer"
                  />
                </label>
              </div>

              {/* Printable Customer Ordering QR Code & Poster Generator */}
              <div
                className="rounded-3xl border-2 p-4 sm:p-5 space-y-4"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--accent-border)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                      <QrCode className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                      {tx(
                        'คิวอาร์โค้ดสั่งอาหารหน้าร้าน / ติดโต๊ะ (พร้อมโหลดไปปริ้น)',
                        'Printable Customer Order QR Code & Table Poster'
                      )}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'ลูกค้าสแกนแล้วจะเข้าสู่หน้าเมนูสั่งอาหารทันที (ข้ามหน้าแอดมินและกรอกเลขโต๊ะให้อัตโนมัติ)',
                        'Customers scan to jump straight to the ordering menu (with optional auto-filled table number)'
                      )}
                    </p>
                  </div>
                </div>

                {typeof window !== 'undefined' && window.location.origin.includes('ais-dev-') && (
                  <div
                    className="rounded-2xl border px-3.5 py-2.5 text-xs font-medium"
                    style={{
                      backgroundColor: '#FEF3C7',
                      borderColor: '#FCD34D',
                      color: '#92400E',
                    }}
                  >
                    {tx(
                      'เคล็ดลับ: แนะนำให้ใช้ลิงก์จริงของร้าน (เช่น https://kkp-steel.vercel.app หลังอัปเดตโค้ดล่าสุดแล้ว หรือ Shared App URL https://ais-pre-...) ในช่องด้านล่างก่อนดาวน์โหลด QR เพื่อไม่ให้ลิงก์ติดสิทธิ์เครื่องพัฒนาค่ะ',
                      'Tip: Use your live shop URL (e.g. https://kkp-steel.vercel.app after deploying latest code, or Shared App URL https://ais-pre-...) before downloading QR posters.'
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <div className="md:col-span-3 space-y-3">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <label className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                          {tx('ลิงก์เว็บของร้าน (สำหรับสร้าง QR)', 'Shop App Base URL (for QR)')}
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              playSoftClick();
                              const vercelUrl = 'https://kkp-steel.vercel.app';
                              setCustomerQrBaseUrl(vercelUrl);
                              localStorage.setItem('kkp_customer_qr_base_url', vercelUrl);
                            }}
                            className="text-[11px] font-bold underline cursor-pointer"
                            style={{ color: 'var(--accent-text)' }}
                          >
                            {tx('ใช้ kkp-steel.vercel.app', 'Use kkp-steel.vercel.app')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playSoftClick();
                              const origin = window.location.origin;
                              setCustomerQrBaseUrl(origin);
                              localStorage.setItem('kkp_customer_qr_base_url', origin);
                            }}
                            className="text-[11px] font-bold underline cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {tx('ใช้ลิงก์ปัจจุบัน', 'Use Current URL')}
                          </button>
                        </div>
                      </div>
                      <input
                        type="url"
                        value={customerQrBaseUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomerQrBaseUrl(val);
                          localStorage.setItem('kkp_customer_qr_base_url', val);
                        }}
                        placeholder="https://kkp-steel.vercel.app"
                        className="w-full h-11 px-3.5 rounded-xl border text-xs sm:text-sm font-en focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-soft)',
                          color: 'var(--text-main)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-main)' }}>
                        {tx('เลขโต๊ะ (ไม่บังคับ — เว้นว่างได้สำหรับติดหน้าร้าน)', 'Table Number (Optional — leave blank for storefront)')}
                      </label>
                      <input
                        type="text"
                        value={customerQrTable}
                        onChange={(e) => setCustomerQrTable(e.target.value)}
                        placeholder={tx('เช่น 1, 2, 7 (ระบบจะเติมเลขโต๊ะให้อัตโนมัติ)', 'e.g. 1, 2, 7 (auto-filled on scan)')}
                        className="w-full h-11 px-3.5 rounded-xl border text-sm font-num focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-soft)',
                          color: 'var(--text-main)',
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!customerOrderTargetUrl) return;
                          playSoftClick();
                          try {
                            await navigator.clipboard.writeText(customerOrderTargetUrl);
                            setCopiedCustomerQrLink(true);
                            window.setTimeout(() => setCopiedCustomerQrLink(false), 2000);
                          } catch {
                            // Ignore clipboard restriction
                          }
                        }}
                        className="px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-soft)',
                          color: 'var(--text-main)',
                        }}
                      >
                        {copiedCustomerQrLink ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copiedCustomerQrLink
                          ? tx('คัดลอกลิงก์แล้ว ✓', 'Link Copied ✓')
                          : tx('คัดลอกลิงก์สั่งอาหาร', 'Copy Order Link')}
                      </button>

                      <button
                        type="button"
                        disabled={!customerQrDataUrl}
                        onClick={handleDownloadCustomerQrPoster}
                        className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      >
                        <Download className="w-4 h-4" />
                        {tx('ดาวน์โหลดรูป QR ไปปริ้น (PNG)', 'Download Printable QR Poster')}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-col items-center justify-center rounded-2xl border bg-white p-3.5 text-center space-y-1.5" style={{ borderColor: 'var(--border-soft)' }}>
                    {customerQrDataUrl ? (
                      <img
                        src={customerQrDataUrl}
                        alt={tx('QR สั่งอาหารลูกค้า', 'Customer Order QR')}
                        className="w-40 h-40 object-contain"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-xs text-stone-400">
                        {tx('กำลังสร้าง QR...', 'Generating QR...')}
                      </div>
                    )}
                    <p className="text-[11px] font-bold text-stone-700">
                      {customerQrTable.trim()
                        ? tx(`โต๊ะที่ ${customerQrTable.trim()} · พร้อมปริ้น`, `Table ${customerQrTable.trim()} · Ready to Print`)
                        : tx('สแกนสั่งอาหารหน้าร้าน · พร้อมปริ้น', 'Storefront Order QR · Ready to Print')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Shop Names & PromptPay */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      {tx('ชื่อหน้าร้านหลัก (ไทย)', 'Main Shop Name (Thai)')}
                    </label>
                    <input
                      type="text"
                      value={shopNameTh}
                      onChange={(e) => onChangeShopNameTh(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-2xl border text-sm"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      {tx('ชื่อหน้าร้านหลัก (อังกฤษ)', 'Main Shop Name (English)')}
                    </label>
                    <input
                      type="text"
                      value={shopNameEn}
                      onChange={(e) => onChangeShopNameEn(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-2xl border text-sm font-en"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      {tx('ชื่อร้านอาหาร (ไทย)', 'Kitchen Shop Name (Thai)')}
                    </label>
                    <input
                      type="text"
                      value={foodShopNameTh}
                      onChange={(e) => onChangeFoodShopNameTh(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-2xl border text-sm"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      {tx('ชื่อร้านอาหาร (อังกฤษ)', 'Kitchen Shop Name (English)')}
                    </label>
                    <input
                      type="text"
                      value={foodShopNameEn}
                      onChange={(e) => onChangeFoodShopNameEn(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-2xl border text-sm font-en"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                    />
                  </div>
                </div>
                {/* Multi-Bank Receiving Channels Manager */}
                <div
                  className="rounded-2xl border p-4 space-y-3.5"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--accent-border)' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                        <Building2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                        {tx('ช่องทางการรับเงิน / บัญชีธนาคาร', 'Receiving Bank & PromptPay Accounts')}
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {tx(
                          'เพิ่มได้หลายธนาคาร และกดเลือกบัญชีที่ต้องการใช้รับเงินในร้านได้ทันทีค่ะ',
                          'Add multiple bank accounts and choose which one receives payments.'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setEditingAccountId(null);
                        setBankNameInput('ธนาคารกสิกรไทย (KBank)');
                        setBankAccountNoInput('');
                        setBankAccountNameInput(promptPayAccountName || 'คำวัง พวงมาลา');
                        setBankPromptPayInput('');
                        setBankQrImageInput('');
                        setShowAddAccountForm((prev) => !prev);
                      }}
                      className="px-3.5 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 cursor-pointer shrink-0"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      <Plus className="w-4 h-4" />
                      {tx('เพิ่มบัญชีรับเงิน', 'Add Account')}
                    </button>
                  </div>

                  {/* Saved Accounts List */}
                  <div className="space-y-2.5">
                    {paymentAccounts.map((acc) => {
                      const isActive = acc.id === activePaymentAccountId;
                      const preset = BANK_PRESETS.find((b) => b.name === acc.bankName);
                      const hasQrReady =
                        Boolean(acc.qrImageUrl) ||
                        isValidPromptPayTarget(acc.promptPayId) ||
                        isValidPromptPayTarget(acc.accountNumber);

                      return (
                        <div
                          key={acc.id}
                          className="rounded-2xl border-2 p-3 flex flex-wrap items-center justify-between gap-3"
                          style={{
                            backgroundColor: isActive ? 'var(--accent-soft)' : 'var(--bg-card)',
                            borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-soft)',
                          }}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="px-2 py-0.5 rounded-lg text-[11px] font-bold"
                                style={{
                                  backgroundColor: preset?.badgeColor || '#E5E7EB',
                                  color: preset?.textColor || '#1F2937',
                                }}
                              >
                                {acc.bankName}
                              </span>
                              {hasQrReady && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                                  style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--accent-text)' }}
                                >
                                  <QrCode className="w-3 h-3" />
                                  {acc.qrImageUrl
                                    ? tx('มีรูป QR', 'QR Uploaded')
                                    : tx('สร้าง PromptPay QR', 'Auto QR')}
                                </span>
                              )}
                            </div>
                            <p className="font-num font-bold text-sm sm:text-base" style={{ color: 'var(--text-main)' }}>
                              {acc.accountNumber}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {tx('ชื่อบัญชี:', 'Account Name:')} {acc.accountName}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                playSoftClick();
                                onSelectActivePaymentAccount(acc.id);
                                onChangePromptPayId(acc.promptPayId || acc.accountNumber);
                                onChangePromptPayAccountName(acc.accountName);
                                setStatusMsg(
                                  tx(
                                    `เลือกใช้บัญชี "${acc.bankName} (${acc.accountNumber})" รับเงินเรียบร้อยแล้วค่ะ`,
                                    `Switched active receiving account to "${acc.bankName} (${acc.accountNumber})".`
                                  )
                                );
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                              style={{
                                backgroundColor: isActive ? '#16A34A' : 'var(--bg-canvas)',
                                border: isActive ? 'none' : '1px solid var(--border-soft)',
                                color: isActive ? '#FFFFFF' : 'var(--accent-text)',
                              }}
                            >
                              {isActive && <Check className="w-3.5 h-3.5" />}
                              {isActive
                                ? tx('กำลังรับเงินบัญชีนี้', 'Active Account')
                                : tx('เลือกใช้บัญชีนี้', 'Use This Account')}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                playSoftClick();
                                setEditingAccountId(acc.id);
                                setBankNameInput(acc.bankName);
                                setBankAccountNoInput(acc.accountNumber);
                                setBankAccountNameInput(acc.accountName);
                                setBankPromptPayInput(acc.promptPayId || '');
                                setBankQrImageInput(acc.qrImageUrl || '');
                                setShowAddAccountForm(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer"
                              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                            >
                              {tx('แก้ไข', 'Edit')}
                            </button>

                            {paymentAccounts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  playSoftClick();
                                  const next = paymentAccounts.filter((item) => item.id !== acc.id);
                                  onChangePaymentAccounts(next);
                                  if (isActive && next[0]) {
                                    onSelectActivePaymentAccount(next[0].id);
                                    onChangePromptPayId(next[0].promptPayId || next[0].accountNumber);
                                    onChangePromptPayAccountName(next[0].accountName);
                                  }
                                }}
                                className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer"
                                style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
                                aria-label={tx(`ลบบัญชี ${acc.bankName}`, `Delete ${acc.bankName}`)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add / Edit Bank Account Form */}
                  {showAddAccountForm && (
                    <div
                      className="rounded-2xl border-2 p-4 space-y-3"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent-primary)' }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold" style={{ color: 'var(--accent-text)' }}>
                          {editingAccountId
                            ? tx('แก้ไขบัญชีรับเงิน', 'Edit Receiving Account')
                            : tx('+ เพิ่มบัญชีธนาคาร / ช่องทางรับเงินใหม่', '+ Add New Receiving Bank Account')}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddAccountForm(false);
                            setEditingAccountId(null);
                          }}
                          className="text-xs underline cursor-pointer"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {tx('ยกเลิก', 'Cancel')}
                        </button>
                      </div>

                      {/* Quick Bank Chips */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                          {tx('เลือกธนาคารด่วน หรือพิมพ์ชื่อธนาคารเองด้านล่าง:', 'Quick-pick bank or enter below:')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {BANK_PRESETS.map((bank) => {
                            const selected = bankNameInput === bank.name;
                            return (
                              <button
                                key={bank.name}
                                type="button"
                                onClick={() => {
                                  playSoftClick();
                                  setBankNameInput(bank.name);
                                }}
                                className="px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer"
                                style={{
                                  backgroundColor: selected ? bank.badgeColor : 'var(--bg-canvas)',
                                  borderColor: selected ? bank.textColor : 'var(--border-soft)',
                                  color: selected ? bank.textColor : 'var(--text-main)',
                                }}
                              >
                                {bank.name.split(' (')[0]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            {tx('ชื่อธนาคาร / ช่องทาง *', 'Bank / Channel Name *')}
                          </label>
                          <input
                            type="text"
                            value={bankNameInput}
                            onChange={(e) => setBankNameInput(e.target.value)}
                            placeholder={tx('เช่น ธนาคารกสิกรไทย (KBank)', 'e.g. KBank / SCB / PromptPay')}
                            className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm"
                            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            {tx('เลขบัญชีธนาคาร หรือ เบอร์พร้อมเพย์ *', 'Account Number / PromptPay ID *')}
                          </label>
                          <input
                            type="text"
                            value={bankAccountNoInput}
                            onChange={(e) => setBankAccountNoInput(e.target.value)}
                            placeholder={tx('เช่น 123-4-56789-0 หรือ 0837596411', 'e.g. 123-4-56789-0 or 0837596411')}
                            className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm font-num"
                            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            {tx('ชื่อบัญชี *', 'Account Holder Name *')}
                          </label>
                          <input
                            type="text"
                            value={bankAccountNameInput}
                            onChange={(e) => setBankAccountNameInput(e.target.value)}
                            placeholder={tx('เช่น คำวัง พวงมาลา', 'e.g. คำวัง พวงมาลา')}
                            className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm"
                            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            {tx('เบอร์พร้อมเพย์สร้าง QR (ถ้าผูกไว้ - ไม่บังคับ)', 'Linked PromptPay ID for QR (Optional)')}
                          </label>
                          <input
                            type="text"
                            value={bankPromptPayInput}
                            onChange={(e) => setBankPromptPayInput(e.target.value)}
                            placeholder={tx('ใส่เบอร์มือถือ/เลขบัตร 13 หลักหากต้องการ QR อัตโนมัติ', 'Mobile/13-digit ID for auto QR')}
                            className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm font-num"
                            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                          />
                        </div>
                      </div>

                      {/* Optional Custom Bank QR Image Upload */}
                      <input
                        ref={bankQrInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          playSoftClick();
                          try {
                            const compressed = await compressSlipImageFile(file, 480);
                            setBankQrImageInput(compressed);
                          } catch {
                            setStatusMsg(tx('ไม่สามารถอ่านรูป QR ได้ค่ะ', 'Could not read QR image.'));
                          }
                        }}
                      />
                      <div
                        className="rounded-xl border p-2.5 flex flex-wrap items-center justify-between gap-2.5"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          {bankQrImageInput ? (
                            <img
                              src={bankQrImageInput}
                              alt="Bank QR"
                              className="w-12 h-12 rounded-lg object-contain bg-white border"
                              style={{ borderColor: 'var(--accent-primary)' }}
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-lg border border-dashed flex items-center justify-center"
                              style={{ borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
                            >
                              <QrCode className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                              {tx('อัปโหลดรูป QR ของธนาคารนี้ (ไม่บังคับ)', 'Upload Bank QR Image (Optional)')}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {tx('บันทึกรูป QR รับเงินจากแอปธนาคารมาใส่ได้เลยค่ะ', 'Upload QR picture saved from your bank app')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              playSoftClick();
                              bankQrInputRef.current?.click();
                            }}
                            className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer"
                            style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }}
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                            {bankQrImageInput ? tx('เปลี่ยนรูป QR', 'Change QR') : tx('เลือกรูป QR', 'Upload QR')}
                          </button>
                          {bankQrImageInput && (
                            <button
                              type="button"
                              onClick={() => setBankQrImageInput('')}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                              style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
                            >
                              {tx('ลบรูป', 'Remove')}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playSoftClick();
                            const cleanBank = bankNameInput.trim();
                            const cleanNo = bankAccountNoInput.trim();
                            const cleanHolder = bankAccountNameInput.trim();
                            if (!cleanBank || !cleanNo || !cleanHolder) {
                              setStatusMsg(
                                tx(
                                  'กรุณากรอกชื่อธนาคาร เลขบัญชี/เบอร์พร้อมเพย์ และชื่อบัญชีให้ครบนะคะ',
                                  'Please enter Bank Name, Account Number, and Account Holder Name.'
                                )
                              );
                              return;
                            }

                            if (editingAccountId) {
                              const next = paymentAccounts.map((acc) =>
                                acc.id === editingAccountId
                                  ? {
                                      ...acc,
                                      bankName: cleanBank,
                                      accountNumber: cleanNo,
                                      accountName: cleanHolder,
                                      promptPayId: bankPromptPayInput.trim() || undefined,
                                      qrImageUrl: bankQrImageInput || undefined,
                                    }
                                  : acc
                              );
                              onChangePaymentAccounts(next);
                              if (activePaymentAccountId === editingAccountId) {
                                onChangePromptPayId(bankPromptPayInput.trim() || cleanNo);
                                onChangePromptPayAccountName(cleanHolder);
                              }
                              setStatusMsg(tx(`อัปเดตบัญชี "${cleanBank}" เรียบร้อยแล้วค่ะ`, `Updated account "${cleanBank}".`));
                            } else {
                              const newAcc: PaymentAccount = {
                                id: `acc_${Date.now()}`,
                                bankName: cleanBank,
                                accountNumber: cleanNo,
                                accountName: cleanHolder,
                                promptPayId: bankPromptPayInput.trim() || undefined,
                                qrImageUrl: bankQrImageInput || undefined,
                              };
                              const next = [...paymentAccounts, newAcc];
                              onChangePaymentAccounts(next);
                              onSelectActivePaymentAccount(newAcc.id);
                              onChangePromptPayId(newAcc.promptPayId || newAcc.accountNumber);
                              onChangePromptPayAccountName(newAcc.accountName);
                              setStatusMsg(
                                tx(
                                  `เพิ่มบัญชี "${cleanBank}" และตั้งเป็นบัญชีรับเงินหลักแล้วค่ะ`,
                                  `Added "${cleanBank}" and set as active receiving account.`
                                )
                              );
                            }

                            setShowAddAccountForm(false);
                            setEditingAccountId(null);
                          }}
                          className="px-4 h-10 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 cursor-pointer"
                          style={{ backgroundColor: '#16A34A' }}
                        >
                          <Check className="w-4 h-4" />
                          {editingAccountId
                            ? tx('บันทึกการแก้ไขบัญชี', 'Save Account Changes')
                            : tx('บันทึก & เลือกใช้บัญชีนี้เลย', 'Save & Activate Account')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border p-4" style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      {tx(
                        'ลิงก์ LINE ร้าน / รูปคิวอาร์โค้ด LINE (ให้ลูกค้าส่งเมนูอาหารเข้า LINE)',
                        'Shop LINE Link or LINE QR Code (for receiving food orders)'
                      )}
                    </label>
                    <input
                      type="url"
                      value={lineShopUrl}
                      onChange={(e) => onChangeLineShopUrl(e.target.value)}
                      placeholder="https://line.me/R/ti/p/@yourshop"
                      className="w-full h-11 px-3.5 rounded-2xl border text-sm font-mono"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    />
                  </div>

                  {/* อัปโหลดรูป QR Code LINE ที่พี่สาวหรือร้านส่งมาให้ */}
                  <input
                    ref={lineQrInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      playSoftClick();
                      setIsReadingLineQr(true);
                      setLineQrFeedback('');
                      try {
                        const [compressed, decoded] = await Promise.all([
                          compressProductImageFile(file, 420),
                          decodeQrCodeFromFile(file),
                        ]);
                        onChangeLineQrImageUrl(compressed);
                        if (decoded) {
                          onChangeLineShopUrl(decoded);
                          const oaId = extractLineOaId(decoded);
                          setLineQrFeedback(
                            oaId
                              ? tx(
                                  `อ่านลิงก์ LINE OA (${oaId}) จากคิวอาร์โค้ดเรียบร้อยแล้วค่ะ ✓ กดส่งเมนูเข้าแชทร้านได้ทันที`,
                                  `Decoded LINE OA (${oaId}) from QR code! Direct order messages enabled ✓`
                                )
                              : tx(
                                  'อ่านลิงก์ LINE จากรูปคิวอาร์โค้ดเรียบร้อย ✓ และบันทึกรูป QR ไว้ให้ลูกค้าสแกนเพิ่มเพื่อนด้วยค่ะ',
                                  'Decoded LINE link & saved QR picture for customers to scan ✓'
                                )
                          );
                        } else {
                          setLineQrFeedback(
                            tx(
                              'บันทึกรูปคิวอาร์โค้ด LINE ร้านเรียบร้อยแล้วค่ะ ✓ ลูกค้าสามารถกดดู QR เพิ่มเพื่อนหน้าเมนูได้ทันที',
                              'Saved LINE QR picture! Customers can view & scan it right from the menu ✓'
                            )
                          );
                        }
                      } catch {
                        setLineQrFeedback(
                          tx(
                            'ไม่สามารถอ่านไฟล์รูปได้ กรุณาลองเลือกรูปคิวอาร์โค้ดใหม่อีกครั้งนะคะ',
                            'Could not load image file. Please try another QR photo.'
                          )
                        );
                      } finally {
                        setIsReadingLineQr(false);
                      }
                    }}
                  />

                  <div
                    className="rounded-2xl border border-dashed p-3 flex flex-wrap items-center justify-between gap-3"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent-border)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {lineQrImageUrl ? (
                        <img
                          src={lineQrImageUrl}
                          alt={tx('รูปคิวอาร์โค้ด LINE ร้าน', 'Shop LINE QR')}
                          className="w-14 h-14 rounded-xl object-contain border bg-white p-0.5 shrink-0"
                          style={{ borderColor: 'var(--border-soft)' }}
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-xl border border-dashed flex items-center justify-center shrink-0"
                          style={{ borderColor: 'var(--border-soft)', color: '#16A34A', backgroundColor: '#DCFCE7' }}
                        >
                          <QrCode className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                          {tx(
                            'มีแต่รูปคิวอาร์โค้ด LINE? อัปโหลดตรงนี้ได้เลยค่ะ',
                            'Only have a LINE QR screenshot? Upload it here'
                          )}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {tx(
                            'ระบบจะอ่านลิงก์ LINE จากรูปให้เอง และเก็บภาพ QR ไว้ให้ลูกค้าสแกนเพิ่มเพื่อนด้วยค่ะ',
                            'Auto-reads the LINE URL from the QR and shows it for customers to scan'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isReadingLineQr}
                        onClick={() => {
                          playSoftClick();
                          lineQrInputRef.current?.click();
                        }}
                        className="px-3.5 h-10 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: '#16A34A' }}
                      >
                        <ImagePlus className="w-4 h-4" />
                        {isReadingLineQr
                          ? tx('กำลังอ่าน QR...', 'Reading QR...')
                          : lineQrImageUrl
                            ? tx('เปลี่ยนรูป QR LINE', 'Change LINE QR')
                            : tx('อัปโหลดรูป QR LINE', 'Upload LINE QR')}
                      </button>
                      {lineQrImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            playSoftClick();
                            onChangeLineQrImageUrl('');
                            setLineQrFeedback('');
                          }}
                          className="px-2.5 h-10 rounded-xl text-xs font-bold cursor-pointer"
                          style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
                        >
                          {tx('ลบรูป', 'Remove')}
                        </button>
                      )}
                    </div>
                  </div>

                  {lineQrFeedback && (
                    <p
                      className="text-xs font-bold rounded-xl px-3 py-2"
                      style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                    >
                      {lineQrFeedback}
                    </p>
                  )}

                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {tx(
                      'ใช้ได้ทั้งรูป QR ส่วนตัวและ LINE OA (@ชื่อร้าน) · หากไม่มี @ ลูกค้าจะเลือกห้องแชทร้านใน LINE หรือสแกน QR เพิ่มเพื่อนก่อนส่งได้ทันทีค่ะ',
                      'Works with both personal LINE QR and LINE OA (@shop) images.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: EXCEL BARCODE PRODUCT IMPORTER & CATALOG ================= */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              {/* Step 1: Import Excel Box */}
              <div
                className="rounded-2xl border p-4 sm:p-5 space-y-4"
                style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--accent-text)' }}>
                      {tx('📥 ดึงไฟล์ Excel ข้อมูลสินค้า & บาร์โค้ดเข้าระบบ', '📥 Import Excel Product & Barcode Catalog')}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {tx('รองรับไฟล์', 'Supports')}{' '}
                      <span className="font-en font-semibold">.xlsx, .xls, .csv</span>{' '}
                      {tx(
                        '(คอลัมน์: เลขบาร์โค้ด, ชื่อสินค้า, ราคา, จำนวนดาว, หมวดหมู่, สถานะ)',
                        '(Columns: Barcode, Product Name, Price, Stars, Category, Status)'
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        downloadProductExcelXlsx(menuItems, true);
                        setStatusMsg(
                          tx(
                            'ดาวน์โหลดไฟล์ต้นแบบ Excel เรียบร้อยแล้วค่ะ',
                            'Sample Excel template downloaded!'
                          )
                        );
                      }}
                      className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {tx('โหลดไฟล์ต้นแบบ Excel', 'Download Template')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        downloadProductExcelXlsx(menuItems, false);
                        setStatusMsg(
                          tx(
                            `ส่งออกสินค้าปัจจุบัน ${menuItems.length} รายการเป็นไฟล์ Excel แล้วค่ะ`,
                            `Exported ${menuItems.length} current products to Excel.`
                          )
                        );
                      }}
                      className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      {tx(`ส่งออกสินค้าที่มี (${menuItems.length})`, `Export Current (${menuItems.length})`)}
                    </button>
                  </div>
                </div>

                {/* Hidden File Input + Friendly Big Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    playSoftClick();
                    fileInputRef.current?.click();
                  }}
                  className="w-full h-14 px-5 rounded-2xl font-bold text-sm sm:text-base text-white flex items-center justify-center gap-2.5 shadow-sm cursor-pointer transition-transform active:scale-[0.99]"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  <Upload className="w-5 h-5" />
                  {tx('เลือกไฟล์ Excel / CSV สินค้าบาร์โค้ดจากเครื่อง', 'Choose Excel / CSV Barcode File')}
                </button>

                {/* Preview & Confirm Panel */}
                {excelPreview && (
                  <div
                    ref={excelPreviewRef}
                    className="rounded-2xl border-2 p-4 space-y-3"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent-primary)' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-sm" style={{ color: 'var(--accent-text)' }}>
                        {tx(
                          `ตรวจพบสินค้าทั้งหมด ${excelPreview.items.length} รายการ (ชีต: ${excelPreview.sheetName})`,
                          `Detected ${excelPreview.items.length} items (Sheet: ${excelPreview.sheetName})`
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExcelPreview(null)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
                        style={{ borderColor: 'var(--border-soft)' }}
                      >
                        {tx('ยกเลิกไฟล์นี้', 'Cancel File')}
                      </button>
                    </div>

                    {excelPreview.warnings.length > 0 && (
                      <div
                        className="rounded-xl px-3 py-2 text-xs space-y-0.5"
                        style={{ backgroundColor: 'var(--pastel-peach)', color: 'var(--pastel-peach-text)' }}
                      >
                        {excelPreview.warnings.map((w, idx) => (
                          <p key={idx}>• {w}</p>
                        ))}
                      </div>
                    )}

                    {/* Import Mode Choice */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className="p-3 rounded-xl border-2 text-left text-xs cursor-pointer"
                        style={{
                          backgroundColor: importMode === 'merge' ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                          borderColor: importMode === 'merge' ? 'var(--accent-primary)' : 'var(--border-soft)',
                        }}
                      >
                        <p className="font-bold text-sm">
                          {tx('🔄 เพิ่มใหม่ + อัปเดตสินค้าเดิม (แนะนำ)', '🔄 Merge & Update Existing (Recommended)')}
                        </p>
                        <p style={{ color: 'var(--text-muted)' }}>
                          {tx(
                            'บาร์โค้ดเดิมจะอัปเดตราคา/ชื่อใหม่ ส่วนบาร์โค้ดใหม่จะเพิ่มต่อท้าย',
                            'Updates matching barcodes and appends new items'
                          )}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className="p-3 rounded-xl border-2 text-left text-xs cursor-pointer"
                        style={{
                          backgroundColor: importMode === 'replace' ? '#FFEDD5' : 'var(--bg-canvas)',
                          borderColor: importMode === 'replace' ? '#EA580C' : 'var(--border-soft)',
                        }}
                      >
                        <p className="font-bold text-sm text-orange-900">
                          {tx('♻️ แทนที่รายการสินค้าเดิมทั้งหมด', '♻️ Replace Entire Catalog')}
                        </p>
                        <p className="text-orange-700">
                          {tx(
                            'ล้างรายการเก่าแล้วใช้เฉพาะรายการจากไฟล์ Excel นี้',
                            'Clears old catalog and keeps only items from this file'
                          )}
                        </p>
                      </button>
                    </div>

                    {/* Preview Table */}
                    <div className="max-h-48 overflow-auto rounded-xl border" style={{ borderColor: 'var(--border-soft)' }}>
                      <table className="w-full text-xs text-left">
                        <thead style={{ backgroundColor: 'var(--bg-subtle)' }}>
                          <tr>
                            <th className="p-2 font-bold">{tx('บาร์โค้ด', 'Barcode')}</th>
                            <th className="p-2 font-bold">{tx('ชื่อสินค้า', 'Product Name')}</th>
                            <th className="p-2 font-bold">{tx('ราคา', 'Price')}</th>
                            <th className="p-2 font-bold">{tx('ดาว', 'Stars')}</th>
                            <th className="p-2 font-bold">{tx('หมวดหมู่', 'Category')}</th>
                            <th className="p-2 font-bold">{tx('สถานะ', 'Status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                          {excelPreview.items.slice(0, 30).map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-mono">{item.barcode || '-'}</td>
                              <td className="p-2 font-semibold">{translateMenuName(item.name, lang)}</td>
                              <td className="p-2 font-num">฿{item.price}</td>
                              <td className="p-2 font-num">⭐{item.stars}</td>
                              <td className="p-2">{translateCategory(item.category, lang)}</td>
                              <td className="p-2">{translateStatus(item.status, lang)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {excelPreview.items.length > 30 && (
                        <p className="text-center text-xs py-1.5" style={{ color: 'var(--text-muted)' }}>
                          {tx(
                            `... และอีก ${excelPreview.items.length - 30} รายการ`,
                            `... and ${excelPreview.items.length - 30} more items`
                          )}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmExcelImport}
                      className="w-full h-12 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
                      style={{ backgroundColor: '#16A34A' }}
                    >
                      <Check className="w-5 h-5" />
                      {tx(
                        `ยืนยันนำเข้าข้อมูล (${excelPreview.items.length} รายการ)`,
                        `Confirm Import (${excelPreview.items.length} items)`
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Quick Add Single Product + Mobile/PC Photo Upload */}
              <form
                onSubmit={handleAddSingleProduct}
                className="rounded-2xl border p-4 space-y-3"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm">
                    {tx('+ เพิ่มสินค้าใหม่ทีละรายการ (อัปโหลดรูปจากมือถือ/คอมได้)', '+ Add Single Product (Upload Photo from Mobile/PC)')}
                  </h4>
                </div>

                <input
                  ref={newProdImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleNewProductImageSelected}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      newProdImageInputRef.current?.click();
                    }}
                    className="w-16 h-16 rounded-2xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center gap-0.5 shrink-0 cursor-pointer transition-transform active:scale-95"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: newProdImageUrl ? 'var(--accent-primary)' : 'var(--border-soft)',
                      color: 'var(--accent-text)',
                    }}
                    title={tx('เลือกรูปหรือถ่ายรูปสินค้า', 'Choose or capture product photo')}
                  >
                    {newProdImageUrl ? (
                      <img src={newProdImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[10px] font-bold">{tx('ใส่รูป', 'Photo')}</span>
                      </>
                    )}
                  </button>

                  <div className="flex-1 min-w-[200px] space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          newProdImageInputRef.current?.click();
                        }}
                        className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--pastel-blue)',
                          borderColor: 'var(--border-soft)',
                          color: 'var(--pastel-blue-text)',
                        }}
                      >
                        <Camera className="w-4 h-4" />
                        {newProdImageUrl
                          ? tx('เปลี่ยนรูปภาพสินค้า', 'Change Product Photo')
                          : tx('อัปโหลด / ถ่ายรูปสินค้า (ไม่ใส่รูปก็ได้)', 'Upload Photo (Optional)')}
                      </button>
                      {newProdImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            playSoftClick();
                            setNewProdImageUrl('');
                          }}
                          className="px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                          style={{
                            backgroundColor: 'var(--pastel-pink)',
                            color: 'var(--pastel-pink-text)',
                          }}
                        >
                          {tx('ไม่ใส่รูป / ลบรูป', 'Remove Photo')}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'ไม่ใส่รูปก็เพิ่มสินค้าได้ทันทีค่ะ หรือเลือกภาพจากมือถือ/คอม (ระบบย่อขนาดให้อัตโนมัติ)',
                        'Optional — add product with or without a photo (auto-compressed).'
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    placeholder={tx('เลขบาร์โค้ด (ไม่บังคับ)', 'Barcode (optional)')}
                    className="sm:col-span-4 h-10 px-3 rounded-xl border text-xs font-mono"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <input
                    type="text"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder={tx('ชื่อสินค้า/เมนูอาหาร *', 'Product / Dish Name *')}
                    className="sm:col-span-4 h-10 px-3 rounded-xl border text-xs"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder={tx('ราคา (บาท) *', 'Price (฿) *')}
                    className="sm:col-span-2 h-10 px-3 rounded-xl border text-xs font-num"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <input
                    type="number"
                    min="0"
                    value={newProdStars}
                    onChange={(e) => setNewProdStars(e.target.value)}
                    placeholder={tx('ดาว', 'Stars')}
                    className="sm:col-span-2 h-10 px-3 rounded-xl border text-xs font-num"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    placeholder={tx(
                      'หมวดหมู่ (เช่น อาหารจานเดียว, เครื่องดื่ม, สินค้าทั่วไป)',
                      'Category (e.g. Rice & Noodles, Drinks, General)'
                    )}
                    className="flex-1 min-w-[200px] h-10 px-3 rounded-xl border text-xs"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <button
                    type="submit"
                    className="px-4 h-10 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <Plus className="w-4 h-4" />
                    {tx('เพิ่มสินค้า', 'Add Product')}
                  </button>
                </div>

                {addProdFeedback && (
                  <div
                    className="rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2"
                    style={{
                      backgroundColor: addProdFeedback.type === 'ok' ? '#DCFCE7' : '#FFE4E6',
                      color: addProdFeedback.type === 'ok' ? '#166534' : '#9F1239',
                    }}
                  >
                    {addProdFeedback.type === 'ok' ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                    )}
                    <span>{addProdFeedback.text}</span>
                  </div>
                )}
              </form>

              {/* Hidden file input shared by all existing product cards for mobile/desktop photo upload */}
              <input
                ref={editProdImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleExistingProductImageSelected}
                className="hidden"
              />

              {/* Step 3: Current Product List & Optional Push to Sheets */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm">
                      {tx(
                        `รายการสินค้าในระบบทั้งหมด (${menuItems.length} รายการ)`,
                        `All Catalog Products (${menuItems.length} items)`
                      )}
                    </h4>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'กดที่กรอบรูปด้านซ้ายของสินค้าแต่ละรายการเพื่ออัปโหลด/เปลี่ยนรูปภาพได้ทันทีค่ะ',
                        'Tap the photo box on any item to upload or update its image'
                      )}
                    </p>
                  </div>
                  {scriptUrl.trim() && (
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={handlePushMenuToSheets}
                      className="px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--pastel-blue)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--pastel-blue-text)',
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      {tx('ส่งรายการสินค้าขึ้น Google Sheets', 'Push Catalog to Google Sheets')}
                    </button>
                  )}
                </div>

                {/* Filter Tabs: Shop vs Customer-Submitted vs Missing from Shop */}
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      {
                        id: 'all',
                        label: tx(`ทั้งหมด (${productSourceCounts.total})`, `All (${productSourceCounts.total})`),
                      },
                      {
                        id: 'shop',
                        label: tx(
                          `🏪 ข้อมูลในร้าน (${productSourceCounts.shop})`,
                          `🏪 Shop Catalog (${productSourceCounts.shop})`
                        ),
                      },
                      {
                        id: 'customer',
                        label: tx(
                          `🙋 ลูกค้าส่งเข้ามา (${productSourceCounts.customer})`,
                          `🙋 Customer Sent (${productSourceCounts.customer})`
                        ),
                      },
                      {
                        id: 'missing',
                        label: tx(
                          `🆕 ยังไม่มีในร้าน (${productSourceCounts.missing})`,
                          `🆕 Missing in Shop (${productSourceCounts.missing})`
                        ),
                      },
                    ] as const
                  ).map((filterTab) => {
                    const active = productSourceFilter === filterTab.id;
                    return (
                      <button
                        key={filterTab.id}
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setProductSourceFilter(filterTab.id);
                        }}
                        className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                          color: active ? '#FFFFFF' : 'var(--text-main)',
                        }}
                      >
                        {filterTab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={tx(
                      'ค้นหาชื่อสินค้า, เลขบาร์โค้ด หรือหมวดหมู่...',
                      'Search product name, barcode, or category...'
                    )}
                    className="w-full h-10 pl-10 pr-3 rounded-xl border text-xs sm:text-sm"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  />
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                      {tx('ไม่พบสินค้าในหมวดหรือคำค้นหานี้ค่ะ', 'No matching products found.')}
                    </p>
                  ) : (
                    filteredProducts.map((item) => {
                      const isCustomer = item.source === 'customer';
                      const missingInShop = isCustomerItemMissingFromShop(item, menuItems);
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border p-2.5 sm:p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5"
                          style={{
                            backgroundColor: isCustomer ? '#FFFBEB' : 'var(--bg-canvas)',
                            borderColor: isCustomer ? '#FDE68A' : 'var(--border-soft)',
                          }}
                        >
                          {/* Tappable Thumbnail Photo Uploader (Mobile & Desktop) */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                playSoftClick();
                                setEditingImageItemId(item.id);
                                editProdImageInputRef.current?.click();
                              }}
                              title={tx('อัปโหลด / เปลี่ยนรูปภาพสินค้า', 'Upload / Change Product Image')}
                              className="group relative w-13 h-13 rounded-xl border overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95"
                              style={{
                                backgroundColor: 'var(--bg-card)',
                                borderColor: item.imageUrl ? 'var(--accent-primary)' : 'var(--border-soft)',
                                color: 'var(--accent-text)',
                              }}
                            >
                              {item.imageUrl ? (
                                <>
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Camera className="w-4 h-4" />
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Camera className="w-4 h-4" />
                                  <span className="text-[9px] font-bold leading-tight mt-0.5">
                                    {tx('ใส่รูป', 'Photo')}
                                  </span>
                                </>
                              )}
                            </button>
                            {item.imageUrl && (
                              <button
                                type="button"
                                onClick={() => handleClearProductImage(item.id)}
                                aria-label={tx(`ลบรูป ${item.name}`, `Remove image for ${item.name}`)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                                style={{
                                  backgroundColor: isCustomer ? '#FEF3C7' : 'var(--accent-soft)',
                                  color: isCustomer ? '#92400E' : 'var(--accent-text)',
                                }}
                              >
                                {isCustomer
                                  ? tx('🙋 ลูกค้าส่งเข้ามา', '🙋 Customer Sent')
                                  : tx('🏪 ข้อมูลในร้าน', '🏪 Shop Item')}
                              </span>
                              {isCustomer && (
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                                  style={{
                                    backgroundColor: missingInShop ? '#FFE4E6' : '#DCFCE7',
                                    color: missingInShop ? '#9F1239' : '#166534',
                                  }}
                                >
                                  {missingInShop
                                    ? tx('🆕 ทางร้านยังไม่มี', '🆕 Not in shop yet')
                                    : tx('✓ มีในร้านแล้ว', '✓ Already in shop')}
                                </span>
                              )}
                              <span className="font-bold text-xs sm:text-sm truncate">
                                {translateMenuName(item.name, lang)}
                              </span>
                              <span
                                className="text-[11px] px-2 py-0.5 rounded-lg font-medium"
                                style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                              >
                                {translateCategory(item.category, lang)}
                              </span>
                            </div>
                            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {tx('บาร์โค้ด:', 'Barcode:')} {item.barcode || tx('ไม่มี', 'None')} · ⭐ {item.stars}{' '}
                              {tx('ดาว', 'stars')}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <span className="font-num font-bold text-sm">฿{item.price}</span>
                            {isCustomer && (
                              <button
                                type="button"
                                onClick={() => handlePromoteCustomerProduct(item.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white cursor-pointer"
                                style={{ backgroundColor: '#16A34A' }}
                              >
                                {tx('+ รับเข้าในร้าน', '+ Add to Shop')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleProductStatus(item.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                              style={{
                                backgroundColor:
                                  item.status === 'พร้อมขาย' ? 'var(--accent-soft)' : 'var(--pastel-pink)',
                                color:
                                  item.status === 'พร้อมขาย'
                                    ? 'var(--accent-text)'
                                    : 'var(--pastel-pink-text)',
                              }}
                            >
                              {translateStatus(item.status, lang)}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(item.id)}
                              aria-label={tx(`ลบ ${item.name}`, `Delete ${item.name}`)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                              style={{
                                backgroundColor: 'var(--pastel-pink)',
                                color: 'var(--pastel-pink-text)',
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: SUPABASE ORDERS / SUMMARY / LINE / EXCEL ================= */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Supabase Cloud Orders & Slip Review Section */}
              <div
                className="rounded-3xl border-2 p-4 sm:p-5 space-y-4"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--accent-border)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                      <Database className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      {tx('รายการออเดอร์ & สลิปจาก Supabase (ล่าสุดขึ้นก่อน)', 'Supabase Orders & Slip Verification (Newest First)')}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'ดึงจากตาราง orders และรูปสลิปจาก Storage bucket "slips" พร้อมกดปรับสถานะได้ทันที',
                        'Live records from "orders" table & "slips" storage bucket'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playSoftClick();
                        setShowSqlHelper((prev) => !prev);
                      }}
                      className="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
                    >
                      {showSqlHelper ? tx('ซ่อน SQL ตั้งค่า', 'Hide SQL') : tx('ดู SQL ตั้งค่า Supabase', 'Supabase SQL')}
                    </button>
                    <button
                      type="button"
                      disabled={supabaseLoading}
                      onClick={() => {
                        playSoftClick();
                        void loadSupabaseOrders();
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${supabaseLoading ? 'animate-spin' : ''}`} />
                      {tx('รีเฟรชออเดอร์', 'Refresh')}
                    </button>
                  </div>
                </div>

                {/* Live KPI Summary Row */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-2xl border p-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{tx('ออเดอร์ทั้งหมด', 'Total Orders')}</p>
                    <p className="font-num text-xl font-extrabold" style={{ color: 'var(--text-main)' }}>
                      {supabaseOrderStats.totalCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border p-3" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                    <p className="text-[11px] text-amber-800">{tx('รอตรวจ (pending)', 'Pending')}</p>
                    <p className="font-num text-xl font-extrabold text-amber-700">
                      {supabaseOrderStats.pendingCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border p-3" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                    <p className="text-[11px] text-emerald-800">{tx('ยอดชำระแล้ว (paid/done)', 'Confirmed Revenue')}</p>
                    <p className="font-num text-xl font-extrabold text-emerald-700">
                      ฿{supabaseOrderStats.paidRevenue.toLocaleString('th-TH')}
                    </p>
                  </div>
                </div>

                {/* Status Filter Row */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: tx(`ทั้งหมด (${supabaseOrders.length})`, `All (${supabaseOrders.length})`) },
                    { id: 'pending', label: tx('รอตรวจ (pending)', 'Pending') },
                    { id: 'paid', label: tx('ชำระแล้ว (paid)', 'Paid') },
                    { id: 'completed', label: tx('เสร็จสิ้น (completed)', 'Completed') },
                  ].map((f) => {
                    const active = supabaseStatusFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          playSoftClick();
                          setSupabaseStatusFilter(f.id as 'all' | 'pending' | 'paid' | 'completed');
                        }}
                        className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-card)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-soft)',
                          color: active ? '#FFFFFF' : 'var(--text-main)',
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                {supabaseError && (
                  <div
                    className="rounded-2xl border p-3.5 text-xs space-y-2"
                    style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' }}
                  >
                    <p className="font-bold">
                      {tx(
                        `ไม่สามารถเชื่อมต่อ Supabase (${SUPABASE_URL_DISPLAY}) ได้: ${supabaseError}`,
                        `Supabase connection error (${SUPABASE_URL_DISPLAY}): ${supabaseError}`
                      )}
                    </p>
                    <p>
                      {supabaseError.toLowerCase().includes('fetch') || supabaseError.toLowerCase().includes('abort')
                        ? tx(
                            'ระบบตรวจพบว่าไม่พบโดเมน Project URL นี้ใน DNS (ปกติรหัสโปรเจกต์ Supabase จะมี 20 ตัวอักษร แต่ลิงก์ปัจจุบันมี 19 ตัวอักษร) กรุณาคัดลอก Project URL ที่ถูกต้องจาก Supabase > Settings > Data API มาแจ้งในแชทเพื่อให้เชื่อมต่อให้ใหม่ได้ทันทีค่ะ (ระหว่างนี้ออเดอร์ออนไลน์หน้าร้านยังเข้าได้ตามปกติค่ะ)',
                            'DNS lookup failed for this Project URL (Supabase refs are normally 20 chars; this one is 19). Please check Settings > Data API in Supabase and share the exact URL. Live web orders continue arriving normally.'
                          )
                        : tx(
                            'หากเพิ่งเชื่อมต่อครั้งแรก กรุณานำ SQL ด้านล่างไปรันใน Supabase SQL Editor เพื่อสร้างตาราง orders และ bucket "slips" นะคะ',
                            'If this is your first setup, run the SQL below in Supabase SQL Editor to create the "orders" table and "slips" bucket.'
                          )}
                    </p>
                  </div>
                )}

                {(showSqlHelper || Boolean(supabaseError)) && (
                  <div className="rounded-2xl border p-3.5 space-y-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                        {tx('SQL สร้างตาราง "orders" และ Storage bucket "slips"', 'SQL Setup for "orders" table & "slips" bucket')}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          playSoftClick();
                          try {
                            await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                            setCopiedSqlSetup(true);
                            window.setTimeout(() => setCopiedSqlSetup(false), 3000);
                          } catch {
                            // Ignore clipboard error
                          }
                        }}
                        className="px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                      >
                        {copiedSqlSetup ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedSqlSetup ? tx('คัดลอกแล้ว!', 'Copied!') : tx('คัดลอก SQL', 'Copy SQL')}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono p-3 rounded-xl border overflow-x-auto max-h-44" style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}>
                      {SUPABASE_SETUP_SQL}
                    </pre>
                  </div>
                )}

                {/* Supabase Orders List */}
                {supabaseLoading && supabaseOrders.length === 0 ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tx('กำลังโหลดรายการออเดอร์จาก Supabase...', 'Loading orders from Supabase...')}
                  </div>
                ) : filteredSupabaseOrders.length === 0 ? (
                  <p className="text-xs text-center py-6 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}>
                    {tx('ยังไม่มีออเดอร์ในหมวดนี้ค่ะ', 'No orders found in this filter')}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                    {filteredSupabaseOrders.map((order) => {
                      const statusLower = String(order.status || 'pending').toLowerCase();
                      const statusStyle =
                        statusLower === 'completed'
                          ? { bg: '#DBEAFE', text: '#1E40AF', label: tx('เสร็จสิ้น (completed)', 'completed') }
                          : statusLower === 'paid'
                            ? { bg: '#DCFCE7', text: '#166534', label: tx('ชำระแล้ว (paid)', 'paid') }
                            : statusLower === 'cancelled'
                              ? { bg: '#FFE4E6', text: '#BE123C', label: tx('ยกเลิก (cancelled)', 'cancelled') }
                              : { bg: '#FEF3C7', text: '#92400E', label: tx('รอตรวจสอบ (pending)', 'pending') };

                      const safeSlip = isSafeHttpUrl(order.slip_url) ? order.slip_url! : '';
                      const createdLabel = order.created_at
                        ? new Date(order.created_at).toLocaleString('th-TH')
                        : '-';
                      const itemsArr = Array.isArray(order.items) ? order.items : [];
                      const isUpdating = updatingOrderId === order.id;

                      return (
                        <div
                          key={String(order.id)}
                          className="rounded-2xl border p-3.5 space-y-3"
                          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-num font-extrabold text-sm" style={{ color: 'var(--text-main)' }}>
                                  #{String(order.id)}
                                </span>
                                <span
                                  className="px-2 py-0.5 rounded-lg text-[11px] font-bold"
                                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                                >
                                  {statusStyle.label}
                                </span>
                                <span
                                  className="px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                                  style={{
                                    backgroundColor: order.payment_method === 'cash' ? '#F3F4F6' : '#E0F2FE',
                                    color: order.payment_method === 'cash' ? '#374151' : '#0369A1',
                                  }}
                                >
                                  {order.payment_method === 'cash'
                                    ? tx('💵 เงินสด (cash)', '💵 Cash')
                                    : tx('💳 โอนเงิน (transfer)', '💳 Transfer')}
                                </span>
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                  {createdLabel}
                                </span>
                              </div>

                              {/* Itemized Order Lines */}
                              <div className="space-y-0.5 text-xs">
                                {itemsArr.length > 0 ? (
                                  itemsArr.map((it, idx) => (
                                    <p key={idx} style={{ color: 'var(--text-main)' }}>
                                      • {it.name}
                                      {it.tasteNote ? ` (${it.tasteNote})` : ''}{' '}
                                      <span className="font-num font-semibold" style={{ color: 'var(--text-muted)' }}>
                                        ×{it.qty} (฿{Number(it.subtotal ?? it.price * it.qty).toLocaleString('th-TH')})
                                      </span>
                                    </p>
                                  ))
                                ) : (
                                  <p style={{ color: 'var(--text-muted)' }}>-</p>
                                )}
                              </div>

                              <p className="font-num text-base font-extrabold" style={{ color: 'var(--accent-text)' }}>
                                {tx('ยอดรวม:', 'Total:')} ฿{Number(order.total_amount || 0).toLocaleString('th-TH')}
                              </p>
                            </div>

                            {/* Slip Thumbnail from Supabase Storage */}
                            {safeSlip && (
                              <div className="shrink-0 flex flex-col items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    playSoftClick();
                                    setPreviewBill({
                                      id: String(order.id),
                                      timestamp: createdLabel,
                                      totalAmount: Number(order.total_amount || 0),
                                      staffName:
                                        order.payment_method === 'cash' ? 'cash' : 'transfer',
                                      deliveryInfo: `Status: ${order.status}`,
                                      slipImageUrl: safeSlip,
                                    });
                                  }}
                                  className="w-20 h-24 rounded-xl border-2 overflow-hidden bg-white cursor-pointer hover:opacity-90"
                                  style={{ borderColor: 'var(--accent-primary)' }}
                                  title={tx('แตะเพื่อดูรูปสลิปขนาดใหญ่', 'Tap to inspect slip')}
                                >
                                  <img
                                    src={safeSlip}
                                    alt={tx(`สลิปออเดอร์ #${order.id}`, `Slip #${order.id}`)}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <a
                                  href={safeSlip}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold inline-flex items-center gap-0.5 hover:underline"
                                  style={{ color: 'var(--accent-text)' }}
                                >
                                  {tx('เปิดสลิปเต็ม', 'Full Image')}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Status Action Controls */}
                          <div className="pt-2 border-t flex flex-wrap items-center gap-1.5" style={{ borderColor: 'var(--border-soft)' }}>
                            <span className="text-[11px] font-semibold mr-1" style={{ color: 'var(--text-muted)' }}>
                              {tx('เปลี่ยนสถานะ:', 'Set status:')}
                            </span>
                            <button
                              type="button"
                              disabled={isUpdating || statusLower === 'paid'}
                              onClick={() => void handleChangeSupabaseOrderStatus(order.id, 'paid')}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer disabled:opacity-45"
                              style={{ backgroundColor: '#16A34A' }}
                            >
                              <Check className="w-3 h-3" />
                              {tx('ชำระแล้ว (paid)', 'paid')}
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating || statusLower === 'completed'}
                              onClick={() => void handleChangeSupabaseOrderStatus(order.id, 'completed')}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer disabled:opacity-45"
                              style={{ backgroundColor: '#0284C7' }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {tx('เสร็จสิ้น (completed)', 'completed')}
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating || statusLower === 'pending'}
                              onClick={() => void handleChangeSupabaseOrderStatus(order.id, 'pending')}
                              className="px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-45"
                              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)', color: '#92400E' }}
                            >
                              <Clock className="w-3 h-3" />
                              {tx('รอตรวจ (pending)', 'pending')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2-Shop Daily Summary Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">
                    {tx(
                      `สรุปยอดขายจริงวันนี้ (${lineSummary.todayDateLabel})`,
                      `Today's Live Sales Summary (${lineSummary.todayDateLabel})`
                    )}
                  </h3>
                  <span className="font-num font-bold text-lg" style={{ color: 'var(--accent-text)' }}>
                    {tx('รวม', 'Total')} ฿{lineSummary.grandTotal.toLocaleString('th-TH')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Store 1 */}
                  <div
                    className="rounded-2xl border p-4 space-y-1.5"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  >
                    <p className="font-bold text-sm">
                      ⭐ {lang === 'en' ? shopNameEn : shopNameTh} ({tx('หน้าร้าน', 'Storefront')})
                    </p>
                    <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                      <p>
                        {tx('จำนวนบิล:', 'Bills:')}{' '}
                        <span className="font-num font-bold text-[#2F2620]">
                          {lineSummary.storeStats.bills} {tx('บิล', 'bills')}
                        </span>
                      </p>
                      <p>
                        {tx('เงินสด:', 'Cash:')}{' '}
                        <span className="font-num font-bold text-[#2F2620]">
                          ฿{lineSummary.storeStats.cash.toLocaleString('th-TH')}
                        </span>
                      </p>
                      <p>
                        {tx('สแกน QR:', 'QR Scan:')}{' '}
                        <span className="font-num font-bold text-[#2F2620]">
                          ฿{lineSummary.storeStats.qr.toLocaleString('th-TH')}
                        </span>
                      </p>
                      <p>
                        {tx('ยอดรวม:', 'Total:')}{' '}
                        <span className="font-num font-bold text-emerald-700">
                          ฿{lineSummary.storeStats.total.toLocaleString('th-TH')}
                        </span>{' '}
                        · ⭐ {lineSummary.storeStats.stars} {tx('ดาว', 'stars')}
                      </p>
                    </div>
                  </div>

                  {/* Store 2 */}
                  <div
                    className="rounded-2xl border p-4 space-y-1.5"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  >
                    <p className="font-bold text-sm">
                      🍲 {lang === 'en' ? foodShopNameEn : foodShopNameTh} ({tx('ร้านข้าวแม่', "Mom's Kitchen")})
                    </p>
                    <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                      <p>
                        {tx('จำนวนบิล:', 'Bills:')}{' '}
                        <span className="font-num font-bold text-[#2F2620]">
                          {lineSummary.kruaStats.bills} {tx('บิล', 'bills')}
                        </span>
                      </p>
                      <p>
                        {tx('เงินสด:', 'Cash:')}{' '}
                        <span className="font-num font-bold text-[#2F2620]">
                          ฿{lineSummary.kruaStats.cash.toLocaleString('th-TH')}
                        </span>
                      </p>
                      <p>
                        {tx('สแกน QR:', 'QR Scan:')}{' '}
                        <span className="font-num font-bold text-[#2F2620]">
                          ฿{lineSummary.kruaStats.qr.toLocaleString('th-TH')}
                        </span>
                      </p>
                      <p>
                        {tx('ยอดรวม:', 'Total:')}{' '}
                        <span className="font-num font-bold text-emerald-700">
                          ฿{lineSummary.kruaStats.total.toLocaleString('th-TH')}
                        </span>{' '}
                        · ⭐ {lineSummary.kruaStats.stars} {tx('ดาว', 'stars')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PromptPay Payment Reference Card */}
                <div
                  className="rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
                  style={{ backgroundColor: 'var(--pastel-blue)', borderColor: 'var(--border-soft)', color: 'var(--pastel-blue-text)' }}
                >
                  <span className="font-bold">
                    {tx('📱 ข้อมูลพร้อมเพย์รับชำระเงิน:', '📱 Store PromptPay Receiver:')}
                  </span>
                  <span className="font-semibold">
                    <span className="font-num font-bold">{promptPayId}</span>
                    {promptPayAccountName ? ` · ${tx('ชื่อบัญชี', 'Account')}: ${promptPayAccountName}` : ''}
                  </span>
                </div>
              </div>

              {/* LINE Share Box */}
              <div
                className="rounded-2xl border p-4 space-y-3"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm">
                    {tx('💬 ส่งสรุปยอดเข้า LINE รายวัน', '💬 Share Daily Summary to LINE')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLineSummary}
                      className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    >
                      {copiedLine ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLine ? tx('คัดลอกแล้ว!', 'Copied!') : tx('คัดลอกข้อความ', 'Copy Text')}
                    </button>
                    <a
                      href={lineShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
                      style={{ backgroundColor: '#06C755' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {tx('💬 ส่งสรุปเข้า LINE', '💬 Send to LINE')}
                    </a>
                  </div>
                </div>
                <pre
                  className="text-xs whitespace-pre-wrap p-3 rounded-xl border leading-relaxed"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                >
                  {lineSummary.text}
                </pre>
              </div>

              {/* Excel Export Buttons */}
              <div
                className="rounded-2xl border p-4 space-y-3"
                style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}
              >
                <div>
                  <h4 className="font-bold text-sm" style={{ color: 'var(--accent-text)' }}>
                    {tx(
                      '📊 ส่งออกไฟล์ Excel (รองรับภาษาไทย 100% ไม่เพี้ยน)',
                      '📊 Export Sales to Excel (UTF-8 Thai & English Ready)'
                    )}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {tx(
                      'สร้างไฟล์ตารางแยกคอลัมน์ชัดเจน (วันที่, เลขบิล, ร้าน, โหมด, ผู้ขาย, ช่องทาง, ยอดเงิน, ดาว, รายการ)',
                      'Clean table columns: Date, Bill ID, Shop, Mode, Seller, Method, Amount, Stars, Items'
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      const count = exportSalesToExcelCsv(saleLogs, 'today', shopNameTh, foodShopNameTh);
                      setStatusMsg(
                        tx(
                          `ส่งออกไฟล์ Excel ยอดวันนี้ (${count} รายการ) เรียบร้อยแล้วค่ะ`,
                          `Exported today's Excel report (${count} bills).`
                        )
                      );
                    }}
                    className="h-12 px-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <Download className="w-4 h-4" />
                    {tx('📊 ส่งออก Excel (ยอดวันนี้)', "📊 Export Excel (Today's Sales)")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSoftClick();
                      const count = exportSalesToExcelCsv(saleLogs, 'all', shopNameTh, foodShopNameTh);
                      setStatusMsg(
                        tx(
                          `ส่งออกไฟล์ Excel ประวัติทั้งหมด (${count} รายการ) เรียบร้อยแล้วค่ะ`,
                          `Exported full sales history (${count} bills).`
                        )
                      );
                    }}
                    className="h-12 px-4 rounded-2xl border font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {tx('📊 ส่งออก Excel (ประวัติทั้งหมด)', '📊 Export Excel (All History)')}
                  </button>
                </div>
              </div>

              {/* Recent Sales & Silent Void Logs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold">
                    {tx(`ประวัติบิลล่าสุด (${saleLogs.length})`, `Recent Bills (${saleLogs.length})`)}
                  </h4>
                  {saleLogs.length === 0 ? (
                    <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                      {tx('ยังไม่มีรายการขาย', 'No sales recorded yet')}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {saleLogs.slice(0, 15).map((s) => (
                        <div
                          key={s.id}
                          className="rounded-xl border p-2.5 flex items-center justify-between gap-2 text-xs"
                          style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-semibold truncate">[{s.mode}] {s.itemsSummary}</p>
                              {s.slipImageUrl && (
                                <span
                                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0"
                                  style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                                >
                                  {tx('แนบสลิปแล้ว', 'Slip Attached')}
                                </span>
                              )}
                            </div>
                            <p style={{ color: 'var(--text-muted)' }}>{s.timestamp} · {s.staffName}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.slipImageUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  playSoftClick();
                                  setPreviewBill({
                                    id: s.id,
                                    timestamp: s.timestamp,
                                    totalAmount: s.totalAmount,
                                    staffName: s.staffName,
                                    deliveryInfo: s.deliveryInfo,
                                    slipImageUrl: s.slipImageUrl!,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--accent-soft)',
                                  borderColor: 'var(--accent-primary)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <FileImage className="w-3 h-3" />
                                {tx('ดูรูปสลิป', 'View Slip')}
                              </button>
                            )}
                            <span className="font-num font-bold">฿{s.totalAmount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    {tx(`ประวัติยกเลิก (Silent Void: ${voidLogs.length})`, `Void History (Silent Void: ${voidLogs.length})`)}
                  </h4>
                  {voidLogs.length === 0 ? (
                    <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                      {tx('ยังไม่มีการยกเลิก', 'No void actions recorded')}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {voidLogs.slice(0, 15).map((v) => (
                        <div
                          key={v.id}
                          className="rounded-xl border p-2.5 flex items-center justify-between gap-2 text-xs"
                          style={{ backgroundColor: 'var(--pastel-pink)', borderColor: 'var(--border-soft)' }}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[#9A3B5E] truncate">{v.action}: {v.detail}</p>
                            <p className="text-[#786B5E]">{v.timestamp} · {v.staffName}</p>
                          </div>
                          <span className="font-num font-bold text-[#9A3B5E] shrink-0">฿{v.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: PROMO AD & QUICK FAQ EDITOR ================= */}
          {activeTab === 'faq' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-base font-bold">
                  {tx('ป้ายโฆษณาโปรโมชันหน้าแรกต้อนรับลูกค้า', 'Welcome Screen Promo Banner')}
                </h3>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    {tx('หัวข้อป้ายโฆษณา', 'Promo Headline')}
                  </label>
                  <input
                    type="text"
                    value={promoTitle}
                    onChange={(e) => onChangePromoTitle(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border text-sm"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    {tx('รายละเอียดโปรโมชัน', 'Promo Subtitle / Description')}
                  </label>
                  <textarea
                    rows={2}
                    value={promoSubtitle}
                    onChange={(e) => onChangePromoSubtitle(e.target.value)}
                    className="w-full p-3 rounded-2xl border text-sm"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    {tx('แถบประกาศรางวัลสะสมดาว', 'Star Reward Announcement Bar')}
                  </label>
                  <input
                    type="text"
                    value={rewardNotice}
                    onChange={(e) => onChangeRewardNotice(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border text-sm"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  />
                </div>
              </div>

              {/* Reward Offers Editor */}
              <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-amber-600" />
                      {tx(
                        'ข้อเสนอของรางวัลแลกดาว & วันหมดเขต (หน้าสมาชิก)',
                        'Star Reward Offers & Expiry Dates (Member Modal)'
                      )}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'กำหนดจำนวนดาวที่ต้องใช้ รายละเอียด เงื่อนไข และวันหมดเขตที่แสดงให้ลูกค้าเห็น',
                        'Configure stars required, reward details, terms, and expiry dates shown to members'
                      )}
                    </p>
                  </div>
                  {scriptUrl.trim() && (
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={handlePushRewardsToSheets}
                      className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--pastel-blue)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--pastel-blue-text)',
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      {tx('ส่งขึ้น Google Sheets', 'Push to Google Sheets')}
                    </button>
                  )}
                </div>

                {/* Add New Reward Offer */}
                <form
                  onSubmit={handleAddRewardOffer}
                  className="rounded-2xl border p-4 space-y-2.5"
                  style={{ backgroundColor: 'var(--pastel-peach)', borderColor: 'var(--border-soft)' }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <input
                      type="text"
                      value={newRewardTitle}
                      onChange={(e) => setNewRewardTitle(e.target.value)}
                      placeholder={tx('ชื่อของรางวัล เช่น ฟรี! ชาไทยเย็น 1 แก้ว', 'Reward title (e.g. Free! 1 Iced Thai Tea)')}
                      className="sm:col-span-6 h-10 px-3 rounded-xl border text-xs sm:text-sm"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    />
                    <div className="sm:col-span-3 relative">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="1"
                        value={newRewardStars}
                        onChange={(e) => setNewRewardStars(e.target.value)}
                        placeholder={tx('จำนวนดาว', 'Stars')}
                        className="w-full h-10 pl-8 pr-2 rounded-xl border text-xs sm:text-sm font-num"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                    </div>
                    <input
                      type="text"
                      value={newRewardExpiry}
                      onChange={(e) => setNewRewardExpiry(e.target.value)}
                      placeholder={tx('หมดเขต (เช่น 31 ธ.ค. 2569)', 'Expiry (e.g. 31 Dec 2026)')}
                      className="sm:col-span-3 h-10 px-3 rounded-xl border text-xs sm:text-sm"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    />
                  </div>
                  <input
                    type="text"
                    value={newRewardDesc}
                    onChange={(e) => setNewRewardDesc(e.target.value)}
                    placeholder={tx('รายละเอียดของรางวัล...', 'Reward description...')}
                    className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <input
                    type="text"
                    value={newRewardTerms}
                    onChange={(e) => setNewRewardTerms(e.target.value)}
                    placeholder={tx(
                      'เงื่อนไขการใช้สิทธิ์ (เช่น แลกได้ 1 สิทธิ์/บิล ไม่สามารถแลกเป็นเงินสด)',
                      'Terms & conditions (e.g. 1 per bill, non-exchangeable for cash)'
                    )}
                    className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <button
                    type="submit"
                    className="px-4 h-10 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <Plus className="w-4 h-4" />
                    {tx('เพิ่มข้อเสนอแลกดาว', 'Add Star Reward')}
                  </button>
                </form>

                {/* Existing Reward Offers */}
                <div className="space-y-2.5">
                  {rewardOffers.map((rw) => (
                    <div
                      key={rw.id}
                      className="rounded-2xl border p-3.5 space-y-2"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={rw.title}
                          onChange={(e) => handleUpdateRewardOffer(rw.id, 'title', e.target.value)}
                          className="sm:col-span-5 h-9 px-3 rounded-xl border text-xs sm:text-sm font-bold"
                          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                        />
                        <div className="sm:col-span-2 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                          <input
                            type="number"
                            min="1"
                            value={rw.starsRequired}
                            onChange={(e) =>
                              handleUpdateRewardOffer(
                                rw.id,
                                'starsRequired',
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            }
                            className="w-full h-9 px-2 rounded-xl border text-xs font-num font-bold"
                            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                          />
                        </div>
                        <input
                          type="text"
                          value={rw.expiryDate}
                          onChange={(e) => handleUpdateRewardOffer(rw.id, 'expiryDate', e.target.value)}
                          placeholder={tx('วันหมดเขต', 'Expiry Date')}
                          className="sm:col-span-3 h-9 px-2.5 rounded-xl border text-xs"
                          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                        />
                        <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateRewardOffer(rw.id, 'active', !rw.active)}
                            className="px-2.5 h-9 rounded-xl text-[11px] font-bold cursor-pointer"
                            style={{
                              backgroundColor: rw.active ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                              color: rw.active ? 'var(--accent-text)' : 'var(--text-muted)',
                            }}
                          >
                            {rw.active ? tx('แสดงอยู่', 'Active') : tx('ซ่อนไว้', 'Hidden')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRewardOffer(rw.id)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
                            style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
                            aria-label={tx('ลบข้อเสนอ', 'Delete offer')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={rw.description}
                        onChange={(e) => handleUpdateRewardOffer(rw.id, 'description', e.target.value)}
                        placeholder={tx('รายละเอียดของรางวัล...', 'Reward description...')}
                        className="w-full h-9 px-3 rounded-xl border text-xs"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                      <input
                        type="text"
                        value={rw.terms}
                        onChange={(e) => handleUpdateRewardOffer(rw.id, 'terms', e.target.value)}
                        placeholder={tx('เงื่อนไขการใช้สิทธิ์...', 'Terms & conditions...')}
                        className="w-full h-9 px-3 rounded-xl border text-xs"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t pt-4" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      {tx('จัดการข้อความถาม-ตอบหน้าแรก (น้องหมีช่วยตอบ)', 'Manage Home Screen Q&A (Little Bear)')}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx(
                        'แก้ไขข้อความบอลลูนบนหัวน้องหมี หัวข้อหน้าต่าง และคำถาม-คำตอบที่แสดงบนหน้าแรกได้ทันที',
                        'Edit the bear speech bubble, modal heading, and Q&A items shown on the home page'
                      )}
                    </p>
                  </div>
                  {scriptUrl.trim() && (
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={handlePushFaqsToSheets}
                      className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--pastel-blue)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--pastel-blue-text)',
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      {tx('ส่งถาม-ตอบขึ้น Google Sheets', 'Push Q&A to Google Sheets')}
                    </button>
                  )}
                </div>

                {/* Home Bubble & Modal Header Settings */}
                <div
                  className="rounded-2xl border p-4 space-y-3"
                  style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}
                >
                  <div>
                    <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--accent-text)' }}>
                      {tx('ข้อความบอลลูนบนหัวน้องหมี (หน้าแรก)', 'Overhead Bear Speech Bubble (Home Page)')}
                    </label>
                    <input
                      type="text"
                      value={faqBubbleText}
                      onChange={(e) => onChangeFaqBubbleText(e.target.value)}
                      placeholder={tx('เช่น มีอะไรสงสัยสอบถามได้นะคะ อยากตอบจังเลย', 'e.g. Have a question? Tap me!')}
                      className="w-full h-11 px-3.5 rounded-2xl border text-sm"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--accent-text)' }}>
                        {tx('หัวข้อหน้าต่างถาม-ตอบ', 'Q&A Modal Title')}
                      </label>
                      <input
                        type="text"
                        value={faqModalTitle}
                        onChange={(e) => onChangeFaqModalTitle(e.target.value)}
                        placeholder={tx('เช่น น้องหมีช่วยตอบ (ถาม-ตอบอัตโนมัติ)', 'e.g. Little Bear Q&A Assistant')}
                        className="w-full h-11 px-3.5 rounded-2xl border text-sm"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--accent-text)' }}>
                        {tx('คำโปรยใต้หัวข้อถาม-ตอบ', 'Q&A Modal Subtitle')}
                      </label>
                      <input
                        type="text"
                        value={faqModalSubtitle}
                        onChange={(e) => onChangeFaqModalSubtitle(e.target.value)}
                        placeholder={tx('เช่น กดเลือกคำถามที่สงสัยได้เลยค่ะ', 'e.g. Tap any question below')}
                        className="w-full h-11 px-3.5 rounded-2xl border text-sm"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Add New FAQ */}
                <form
                  onSubmit={handleAddFaq}
                  className="rounded-2xl border p-4 space-y-2.5"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                    {tx('เพิ่มคำถาม-คำตอบใหม่', 'Add New Q&A Item')}
                  </p>
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder={tx('พิมพ์คำถามใหม่ เช่น มีที่จอดรถไหมคะ?', 'Enter new question (e.g. Is parking available?)')}
                    className="w-full h-11 px-3.5 rounded-xl border text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <textarea
                    rows={2}
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder={tx('พิมพ์คำตอบสำเร็จรูป...', 'Enter preset answer...')}
                    className="w-full p-3 rounded-xl border text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                  />
                  <button
                    type="submit"
                    className="px-4 h-10 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <Plus className="w-4 h-4" />
                    {tx('เพิ่มคำถาม-คำตอบ', 'Add FAQ Item')}
                  </button>
                </form>

                {/* Existing FAQs */}
                <div className="space-y-2.5">
                  {faqs.map((f, idx) => (
                    <div
                      key={f.id}
                      className="rounded-2xl border p-3.5 space-y-2"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                          {tx(`คำถามข้อที่ ${idx + 1}`, `Question #${idx + 1}`)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteFaq(f.id)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: 'var(--pastel-pink)', color: 'var(--pastel-pink-text)' }}
                          aria-label={tx('ลบคำถาม', 'Delete question')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={f.question}
                        onChange={(e) => handleUpdateFaq(f.id, 'question', e.target.value)}
                        placeholder={tx('คำถาม...', 'Question...')}
                        className="w-full h-10 px-3 rounded-xl border text-sm font-semibold"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                      <textarea
                        rows={2}
                        value={f.answer}
                        onChange={(e) => handleUpdateFaq(f.id, 'answer', e.target.value)}
                        placeholder={tx('คำตอบ...', 'Answer...')}
                        className="w-full p-2.5 rounded-xl border text-xs sm:text-sm"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: GOOGLE SHEETS BACKEND SYNC ================= */}
          {activeTab === 'sheets' && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <label className="block text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('ลิงก์ Google Apps Script Web App URL (scriptUrl)', 'Google Apps Script Web App URL (scriptUrl)')}
                </label>
                <input
                  type="url"
                  value={scriptUrl}
                  onChange={(e) => onChangeScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full h-12 px-4 rounded-2xl border text-sm font-mono"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                />
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={handleSyncAll}
                    className="px-4 h-12 rounded-2xl font-bold text-sm text-white flex items-center gap-2 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {tx('🔄 ซิงค์ข้อมูลทั้งหมดจาก Google Sheets', '🔄 Sync All Data from Google Sheets')}
                  </button>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={handleFlushQueue}
                    className="px-4 h-12 rounded-2xl border font-semibold text-sm flex items-center gap-2 cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                  >
                    <Wifi className="w-4 h-4" />
                    {tx(`คิวออฟไลน์ค้างส่ง (${offlineQueue.length})`, `Offline Queue (${offlineQueue.length})`)}
                  </button>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={handlePushAllToSheets}
                    className="px-4 h-12 rounded-2xl border font-bold text-sm flex items-center gap-2 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--pastel-blue)',
                      borderColor: 'var(--border-soft)',
                      color: 'var(--pastel-blue-text)',
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    {tx('📤 ส่งข้อมูลเริ่มต้นทั้งหมดขึ้น Sheet', '📤 Push Initial Data to Sheet')}
                  </button>
                </div>
              </div>

              {/* 5 Backend Config Tabs Guide */}
              <div
                className="rounded-2xl border p-4 space-y-2 text-xs"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
              >
                <p className="font-bold text-sm">
                  {tx(
                    'โครงสร้าง 5 แท็บสำหรับแก้ไขหลังบ้านใน Google Sheets:',
                    '5 Backend Sheet Tabs Structure (Google Sheets):'
                  )}
                </p>
                <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <li>
                    <strong>ตั้งค่าระบบ</strong>{' '}
                    {tx(
                      '(คอลัมน์ A: key, B: value เช่น orgCode, shopNameTh, foodShopNameTh, promptPayId, rewardNotice, promoTitle, promoSubtitle, faqBubbleText, faqModalTitle, faqModalSubtitle)',
                      '(Col A: key, Col B: value — orgCode, shopNameTh, foodShopNameTh, promptPayId, rewardNotice, promoTitle, promoSubtitle, faqBubbleText, faqModalTitle, faqModalSubtitle)'
                    )}
                  </li>
                  <li>
                    <strong>ตั้งค่าเมนู</strong>{' '}
                    {tx(
                      '(เลขบาร์โค้ด, ชื่อสินค้า, ราคา, จำนวนดาว, หมวดหมู่, ลิงก์รูปภาพ, สถานะ พร้อมขาย/หมด)',
                      '(Barcode, Name, Price, Stars, Category, ImageURL, Status)'
                    )}
                  </li>
                  <li>
                    <strong>ผู้ใช้งานและPIN</strong>{' '}
                    {tx('(pin, name, role คือ admin หรือ cashier)', '(pin, name, role: admin or cashier)')}
                  </li>
                  <li>
                    <strong>ถามตอบลูกค้า</strong> (id, question, answer)
                  </li>
                  <li>
                    <strong>โปรโมชันแลกดาว</strong>{' '}
                    {tx(
                      '(id, ชื่อของรางวัล, ดาวที่ใช้, รายละเอียด, เงื่อนไข, วันหมดเขต, เปิดใช้งาน)',
                      '(id, title, starsRequired, description, terms, expiryDate, active)'
                    )}
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                    {tx(
                      'โค้ด Google Apps Script สำเร็จรูป (รองรับ 4 แท็บหลังบ้าน + 2 ร้าน + ทดสอบระบบ)',
                      'Ready-to-Use Google Apps Script (Supports 5 Backend Tabs + 2 Shops + Test Mode)'
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? tx('คัดลอกแล้ว!', 'Copied!') : tx('คัดลอกโค้ด', 'Copy Code')}
                  </button>
                </div>
                <pre
                  className="p-3.5 rounded-2xl border text-xs font-mono overflow-x-auto max-h-56"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                >
                  {APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div
          className="px-6 py-4 border-t shrink-0 flex justify-end"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-6 h-12 rounded-2xl font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {tx('บันทึก & กลับหน้าขาย', 'Save & Back to POS')}
          </button>
        </div>
      </div>

      {/* Slip Image Viewer Lightbox */}
      {previewBill && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewBill(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <div>
                <h4 className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
                  {tx('หลักฐานสลิปโอนเงิน', 'Transfer Slip Proof')}
                </h4>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  #{previewBill.id} · ฿{previewBill.totalAmount.toLocaleString('th-TH')} · {previewBill.timestamp}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewBill(null)}
                className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
                aria-label={tx('ปิดหน้าต่าง', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex justify-center bg-stone-50">
              <img
                src={previewBill.slipImageUrl}
                alt={tx('สลิปโอนเงินลูกค้า', 'Customer transfer slip')}
                className="max-h-[68vh] w-auto rounded-2xl object-contain border border-stone-200"
              />
            </div>
            {previewBill.deliveryInfo && (
              <div
                className="px-4 py-2.5 border-t text-xs flex items-center justify-between"
                style={{ borderColor: 'var(--border-soft)', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-muted)' }}
              >
                <span>{previewBill.deliveryInfo}</span>
                <span className="font-bold" style={{ color: '#166534' }}>
                  {tx('แนบสลิปแล้ว', 'Slip Attached')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
