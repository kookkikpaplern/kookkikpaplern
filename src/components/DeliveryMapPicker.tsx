import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Circle,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  X,
} from 'lucide-react';
import { useLang } from '../config/i18n';
import {
  computeHaversineMeters,
  formatDistanceKm,
  GeoPoint,
  isValidLatLng,
  MAX_DELIVERY_RADIUS_KM,
  MAX_DELIVERY_RADIUS_METERS,
  ShopLocationConfig,
} from '../utils/geoDistance';
import { playSoftClick } from '../utils/sound';

const INITIAL_FALLBACK_VIEW: GeoPoint = { lat: 13.7563, lng: 100.5018 };

function getStaticBundledMapsKey(): string {
  const viteKey =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
      : '';
  const processKey =
    typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_API_KEY
      ? String(process.env.GOOGLE_MAPS_API_KEY).trim()
      : '';
  return viteKey || processKey;
}

export function useGoogleMapsApiKey(): { apiKey: string; loadingKey: boolean } {
  const initial = useMemo(() => getStaticBundledMapsKey(), []);
  const [apiKey, setApiKey] = useState(initial);
  const [loadingKey, setLoadingKey] = useState(!initial);

  useEffect(() => {
    if (apiKey) {
      setLoadingKey(false);
      return;
    }
    let cancelled = false;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { apiKey?: string } | null) => {
        if (cancelled) return;
        const runtimeKey = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
        if (runtimeKey) setApiKey(runtimeKey);
      })
      .catch(() => {
        // Ignore network error; fallback state handled gracefully in UI
      })
      .finally(() => {
        if (!cancelled) setLoadingKey(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return { apiKey, loadingKey };
}

export function requestBrowserCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GPS_UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      (err) => {
        reject(new Error(err.message || 'GPS_FAILED'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  });
}

const MapViewportController: React.FC<{
  panTarget: { point: GeoPoint; zoom?: number; nonce: number } | null;
  onStatusChange?: (status: APILoadingStatus) => void;
}> = ({ panTarget, onStatusChange }) => {
  const map = useMap();
  const status = useApiLoadingStatus();

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!map || !panTarget) return;
    map.panTo(panTarget.point);
    if (typeof panTarget.zoom === 'number') {
      map.setZoom(panTarget.zoom);
    }
  }, [map, panTarget]);

  return null;
};

const GeometryDistanceBridge: React.FC<{
  origin: GeoPoint | null;
  pin: GeoPoint | null;
  onMetersCalculated: (meters: number | null) => void;
}> = ({ origin, pin, onMetersCalculated }) => {
  const geometryLib = useMapsLibrary('geometry');

  useEffect(() => {
    if (!origin || !pin) {
      onMetersCalculated(null);
      return;
    }
    if (geometryLib?.spherical) {
      const meters = geometryLib.spherical.computeDistanceBetween(origin, pin);
      onMetersCalculated(meters);
      return;
    }
    onMetersCalculated(computeHaversineMeters(origin, pin));
  }, [geometryLib, origin, pin, onMetersCalculated]);

  return null;
};

/* ============================================================================
 * 1. CUSTOMER DELIVERY PIN PICKER MODAL (Enforces max 3 km radius from shop)
 * ========================================================================== */

interface DeliveryMapPickerModalProps {
  isOpen: boolean;
  shopLocation: ShopLocationConfig | null;
  initialPin: GeoPoint | null;
  onClose: () => void;
  onConfirmPin: (result: { point: GeoPoint; distanceKm: number | null }) => void;
}

export const DeliveryMapPickerModal: React.FC<DeliveryMapPickerModalProps> = ({
  isOpen,
  shopLocation,
  initialPin,
  onClose,
  onConfirmPin,
}) => {
  const { lang, tx } = useLang();
  const { apiKey, loadingKey } = useGoogleMapsApiKey();
  const [draftPin, setDraftPin] = useState<GeoPoint | null>(initialPin);
  const [panTarget, setPanTarget] = useState<{
    point: GeoPoint;
    zoom?: number;
    nonce: number;
  } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [mapStatus, setMapStatus] = useState<APILoadingStatus>(APILoadingStatus.NOT_LOADED);
  const [measuredMeters, setMeasuredMeters] = useState<number | null>(null);
  const nonceRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setGpsError('');
    const nextPin = isValidLatLng(initialPin) ? initialPin : shopLocation ? { lat: shopLocation.lat, lng: shopLocation.lng } : null;
    setDraftPin(nextPin);
    if (nextPin) {
      nonceRef.current += 1;
      setPanTarget({ point: nextPin, zoom: 14, nonce: nonceRef.current });
    } else if (shopLocation) {
      nonceRef.current += 1;
      setPanTarget({ point: { lat: shopLocation.lat, lng: shopLocation.lng }, zoom: 13, nonce: nonceRef.current });
    }
  }, [isOpen, initialPin, shopLocation]);

  const effectiveMeters = useMemo(() => {
    if (!shopLocation || !draftPin) return null;
    return measuredMeters ?? computeHaversineMeters(shopLocation, draftPin);
  }, [shopLocation, draftPin, measuredMeters]);

  const isWithinLimit =
    effectiveMeters === null ? true : effectiveMeters <= MAX_DELIVERY_RADIUS_METERS;

  const handleUseMyGps = useCallback(async () => {
    playSoftClick();
    setGpsBusy(true);
    setGpsError('');
    try {
      const point = await requestBrowserCurrentLocation();
      setDraftPin(point);
      nonceRef.current += 1;
      setPanTarget({ point, zoom: 15, nonce: nonceRef.current });
    } catch {
      setGpsError(
        tx(
          'ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือแตะบนแผนที่เพื่อปักหมุดเองนะคะ',
          'Unable to get GPS location. Please allow location permission or tap directly on the map.'
        )
      );
    } finally {
      setGpsBusy(false);
    }
  }, [tx]);

  const handleMapClick = useCallback((ev: MapMouseEvent) => {
    const ll = ev.detail.latLng;
    if (!ll) return;
    playSoftClick();
    setGpsError('');
    setDraftPin({
      lat: Number(ll.lat.toFixed(6)),
      lng: Number(ll.lng.toFixed(6)),
    });
  }, []);

  if (!isOpen) return null;

  const defaultMapCenter: GeoPoint =
    draftPin ||
    (shopLocation ? { lat: shopLocation.lat, lng: shopLocation.lng } : INITIAL_FALLBACK_VIEW);

  const mapErrorState =
    mapStatus === APILoadingStatus.AUTH_FAILURE || mapStatus === APILoadingStatus.FAILED;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <MapPin className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              {tx(
                `ปักหมุดพิกัดส่งอาหาร (ไม่เกิน ${MAX_DELIVERY_RADIUS_KM} กม.)`,
                `Pin Delivery Location (Max ${MAX_DELIVERY_RADIUS_KM} km)`
              )}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {tx(
                'แตะบนแผนที่หรือลากหมุดสีเขียวให้อยู่ในวงกลมระยะ 3 กม. รอบร้านค่ะ',
                'Tap on the map or drag the pin inside the 3 km green circle around the shop.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            aria-label={tx('ปิดแผนที่', 'Close map')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {/* Quick GPS button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={gpsBusy}
              onClick={() => void handleUseMyGps()}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-transform active:scale-95"
              style={{ backgroundColor: '#0284C7' }}
            >
              {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              {tx('ใช้ตำแหน่ง GPS ปัจจุบันของฉัน', 'Use My Current GPS')}
            </button>

            {draftPin && (
              <span className="text-[11px] font-num font-semibold px-2.5 py-1 rounded-lg border" style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}>
                {draftPin.lat.toFixed(5)}, {draftPin.lng.toFixed(5)}
              </span>
            )}
          </div>

          {!shopLocation && (
            <div
              className="rounded-2xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2"
              style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {tx(
                  'ร้านยังไม่ได้ตั้งจุดพิกัดต้นทางบนแผนที่ (ตั้งค่าได้ที่หน้า ตั้งค่า > ตั้งค่าทั่วไป) คุณยังสามารถปักหมุดเพื่อให้พ่อหมีเปิดแผนที่นำทางได้ค่ะ',
                  'Shop origin coordinates have not been set yet in Admin Settings. You can still drop a pin for delivery navigation.'
                )}
              </span>
            </div>
          )}

          {gpsError && (
            <div className="rounded-xl px-3 py-2 text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700">
              {gpsError}
            </div>
          )}

          {/* Interactive Google Map Canvas (CF2: explicit height) */}
          <div
            className="w-full h-[340px] sm:h-[370px] rounded-2xl border-2 overflow-hidden relative bg-stone-100"
            style={{ borderColor: isWithinLimit ? 'var(--accent-border)' : '#FDA4AF' }}
          >
            {loadingKey ? (
              <div className="w-full h-full flex items-center justify-center gap-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
                {tx('กำลังโหลดแผนที่...', 'Loading Google Maps...')}
              </div>
            ) : !apiKey || mapErrorState ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center space-y-2">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
                <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('ไม่สามารถแสดงแผนที่ได้ชั่วคราว', 'Unable to load Google Maps right now')}
                </p>
                <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  {tx(
                    'ยังสามารถกดปุ่ม "ใช้ตำแหน่ง GPS ปัจจุบันของฉัน" ด้านบนเพื่อปักหมุดและคำนวณระยะทาง 3 กม. ได้ตามปกติค่ะ',
                    'You can still tap "Use My Current GPS" above to capture coordinates and verify the 3 km distance.'
                  )}
                </p>
              </div>
            ) : (
              <APIProvider
                apiKey={apiKey}
                libraries={['marker', 'geometry']}
                language={lang === 'en' ? 'en' : 'th'}
                region="TH"
                onError={() => {
                  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
                }}
              >
                <MapViewportController
                  panTarget={panTarget}
                  onStatusChange={setMapStatus}
                />
                <GeometryDistanceBridge
                  origin={shopLocation}
                  pin={draftPin}
                  onMetersCalculated={setMeasuredMeters}
                />
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  defaultCenter={defaultMapCenter}
                  defaultZoom={shopLocation || draftPin ? 14 : 6}
                  gestureHandling="greedy"
                  clickableIcons={false}
                  streetViewControl={false}
                  mapTypeControl={false}
                  onClick={handleMapClick}
                  style={{ width: '100%', height: '100%' }}
                >
                  {shopLocation && (
                    <>
                      <Circle
                        center={{ lat: shopLocation.lat, lng: shopLocation.lng }}
                        radius={MAX_DELIVERY_RADIUS_METERS}
                        strokeColor="#16A34A"
                        strokeOpacity={0.9}
                        strokeWeight={2}
                        fillColor="#22C55E"
                        fillOpacity={0.14}
                        clickable={false}
                      />
                      <AdvancedMarker
                        position={{ lat: shopLocation.lat, lng: shopLocation.lng }}
                        title={shopLocation.label || tx('พิกัดร้าน', 'Shop Location')}
                      >
                        <Pin
                          background="#0F766E"
                          borderColor="#115E59"
                          glyphColor="#FFFFFF"
                          glyphText="ร้าน"
                        />
                      </AdvancedMarker>
                    </>
                  )}

                  {draftPin && (
                    <AdvancedMarker
                      position={draftPin}
                      draggable
                      title={tx('จุดส่งอาหาร (ลากปรับได้)', 'Delivery Pin (Drag to adjust)')}
                      onDragEnd={(e) => {
                        if (!e.latLng) return;
                        setDraftPin({
                          lat: Number(e.latLng.lat().toFixed(6)),
                          lng: Number(e.latLng.lng().toFixed(6)),
                        });
                      }}
                    >
                      <Pin
                        background={isWithinLimit ? '#16A34A' : '#E11D48'}
                        borderColor={isWithinLimit ? '#14532D' : '#9F1239'}
                        glyphColor="#FFFFFF"
                        glyphText="ส่ง"
                        scale={1.15}
                      />
                    </AdvancedMarker>
                  )}
                </GoogleMap>
              </APIProvider>
            )}
          </div>

          {/* Distance Validation Banner */}
          {draftPin && effectiveMeters !== null && (
            <div
              className="rounded-2xl border px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm font-bold"
              style={{
                backgroundColor: isWithinLimit ? '#ECFDF5' : '#FFF1F2',
                borderColor: isWithinLimit ? '#6EE7B7' : '#FDA4AF',
                color: isWithinLimit ? '#065F46' : '#BE123C',
              }}
            >
              {isWithinLimit ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              )}
              <span>
                {isWithinLimit
                  ? tx(
                      `อยู่ในเขตจัดส่งค่ะ! ห่างจากร้าน ${formatDistanceKm(effectiveMeters, 'th')} (ไม่เกิน ${MAX_DELIVERY_RADIUS_KM} กม.)`,
                      `Within delivery zone! ${formatDistanceKm(effectiveMeters, 'en')} from shop (max ${MAX_DELIVERY_RADIUS_KM} km).`
                    )
                  : tx(
                      `เกินระยะทางจัดส่งค่ะ! ห่าง ${formatDistanceKm(effectiveMeters, 'th')} (ร้านรับส่งไม่เกิน ${MAX_DELIVERY_RADIUS_KM} กม.) กรุณาขยับหมุดเข้ามาในวงกลมสีเขียวค่ะ`,
                      `Out of range! ${formatDistanceKm(effectiveMeters, 'en')} away (max ${MAX_DELIVERY_RADIUS_KM} km). Please move the pin inside the green circle.`
                    )}
              </span>
            </div>
          )}

          <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
            {tx(
              'แผนที่จาก Google Maps · ใช้เพื่อระบุจุดส่งอาหารภายในระยะ 3 กม. เท่านั้น',
              'Powered by Google Maps · Used solely to pin delivery location within 3 km.'
            )}
          </p>
        </div>

        {/* Footer Confirm */}
        <div
          className="px-5 py-3.5 border-t flex items-center justify-end gap-2 shrink-0"
          style={{ borderColor: 'var(--border-soft)', backgroundColor: 'var(--bg-canvas)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-main)' }}
          >
            {tx('ยกเลิก', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!draftPin || !isWithinLimit}
            onClick={() => {
              if (!draftPin || !isWithinLimit) return;
              playSoftClick();
              onConfirmPin({
                point: draftPin,
                distanceKm:
                  effectiveMeters !== null ? Number((effectiveMeters / 1000).toFixed(2)) : null,
              });
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-45 transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Navigation className="w-4 h-4" />
            {tx('ยืนยันพิกัดส่งนี้', 'Confirm Delivery Pin')}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. SHOP ORIGIN LOCATION PICKER MODAL (Used in Admin Settings)
 * ========================================================================== */

interface ShopOriginMapModalProps {
  isOpen: boolean;
  shopLocation: ShopLocationConfig | null;
  onClose: () => void;
  onSaveShopLocation: (loc: ShopLocationConfig) => void;
}

export const ShopOriginMapModal: React.FC<ShopOriginMapModalProps> = ({
  isOpen,
  shopLocation,
  onClose,
  onSaveShopLocation,
}) => {
  const { lang, tx } = useLang();
  const { apiKey, loadingKey } = useGoogleMapsApiKey();
  const [draftShop, setDraftShop] = useState<GeoPoint | null>(
    shopLocation ? { lat: shopLocation.lat, lng: shopLocation.lng } : null
  );
  const [labelInput, setLabelInput] = useState(shopLocation?.label || '');
  const [panTarget, setPanTarget] = useState<{
    point: GeoPoint;
    zoom?: number;
    nonce: number;
  } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [mapStatus, setMapStatus] = useState<APILoadingStatus>(APILoadingStatus.NOT_LOADED);
  const nonceRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setGpsError('');
    setLabelInput(shopLocation?.label || '');
    const initPoint = shopLocation ? { lat: shopLocation.lat, lng: shopLocation.lng } : null;
    setDraftShop(initPoint);
    if (initPoint) {
      nonceRef.current += 1;
      setPanTarget({ point: initPoint, zoom: 14, nonce: nonceRef.current });
    }
  }, [isOpen, shopLocation]);

  const handleUseShopGps = useCallback(async () => {
    playSoftClick();
    setGpsBusy(true);
    setGpsError('');
    try {
      const point = await requestBrowserCurrentLocation();
      setDraftShop(point);
      nonceRef.current += 1;
      setPanTarget({ point, zoom: 14, nonce: nonceRef.current });
    } catch {
      setGpsError(
        tx(
          'ดึงพิกัด GPS ไม่สำเร็จ กรุณาอนุญาตตำแหน่งบนเบราว์เซอร์ หรือแตะบนแผนที่เพื่อปักหมุดร้านค่ะ',
          'Could not get GPS position. Please allow location access or tap on the map.'
        )
      );
    } finally {
      setGpsBusy(false);
    }
  }, [tx]);

  if (!isOpen) return null;

  const mapErrorState =
    mapStatus === APILoadingStatus.AUTH_FAILURE || mapStatus === APILoadingStatus.FAILED;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent-border)' }}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <MapPin className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              {tx('ตั้งพิกัดร้านต้นทาง (เขตส่ง 3 กม.)', 'Set Shop Origin Pin (3 km Zone)')}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {tx(
                'กดใช้ตำแหน่ง GPS ของร้าน หรือแตะบนแผนที่เพื่อกำหนดวงกลมระยะส่ง 3 กม.',
                'Use GPS at your shop or tap on the map to preview the 3 km delivery radius.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)' }}
            aria-label={tx('ปิด', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={gpsBusy}
              onClick={() => void handleUseShopGps()}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: '#0F766E' }}
            >
              {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              {tx('ใช้ตำแหน่ง GPS ของร้านตอนนี้', 'Pin Shop at My GPS')}
            </button>

            {draftShop && (
              <span className="text-[11px] font-num font-semibold px-2.5 py-1 rounded-lg border" style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}>
                {draftShop.lat.toFixed(6)}, {draftShop.lng.toFixed(6)}
              </span>
            )}
          </div>

          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder={tx('ชื่อจุดตั้งร้าน เช่น หน้าร้านกุ๊กกิ๊กพาเพลิน / ครัวแม่วัง', 'Optional shop landmark label')}
            className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-soft)', color: 'var(--text-main)' }}
          />

          {gpsError && (
            <div className="rounded-xl px-3 py-2 text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700">
              {gpsError}
            </div>
          )}

          <div className="w-full h-[340px] sm:h-[360px] rounded-2xl border-2 overflow-hidden bg-stone-100" style={{ borderColor: 'var(--accent-border)' }}>
            {loadingKey ? (
              <div className="w-full h-full flex items-center justify-center gap-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
                {tx('กำลังโหลดแผนที่...', 'Loading map...')}
              </div>
            ) : !apiKey || mapErrorState ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center space-y-2">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
                <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                  {tx('แผนที่ยังไม่พร้อมใช้งาน', 'Map temporarily unavailable')}
                </p>
                <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  {tx(
                    'กดปุ่ม "ใช้ตำแหน่ง GPS ของร้านตอนนี้" ด้านบนเพื่อบันทึกพิกัดร้านได้เลยค่ะ',
                    'Tap "Pin Shop at My GPS" above to save the shop coordinates directly.'
                  )}
                </p>
              </div>
            ) : (
              <APIProvider
                apiKey={apiKey}
                libraries={['marker', 'geometry']}
                language={lang === 'en' ? 'en' : 'th'}
                region="TH"
                onError={() => {
                  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
                }}
              >
                <MapViewportController panTarget={panTarget} onStatusChange={setMapStatus} />
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  defaultCenter={draftShop || INITIAL_FALLBACK_VIEW}
                  defaultZoom={draftShop ? 14 : 6}
                  gestureHandling="greedy"
                  clickableIcons={false}
                  streetViewControl={false}
                  mapTypeControl={false}
                  onClick={(ev) => {
                    const ll = ev.detail.latLng;
                    if (!ll) return;
                    playSoftClick();
                    setDraftShop({
                      lat: Number(ll.lat.toFixed(6)),
                      lng: Number(ll.lng.toFixed(6)),
                    });
                  }}
                  style={{ width: '100%', height: '100%' }}
                >
                  {draftShop && (
                    <>
                      <Circle
                        center={draftShop}
                        radius={MAX_DELIVERY_RADIUS_METERS}
                        strokeColor="#16A34A"
                        strokeOpacity={0.9}
                        strokeWeight={2}
                        fillColor="#22C55E"
                        fillOpacity={0.14}
                        clickable={false}
                      />
                      <AdvancedMarker
                        position={draftShop}
                        draggable
                        onDragEnd={(e) => {
                          if (!e.latLng) return;
                          setDraftShop({
                            lat: Number(e.latLng.lat().toFixed(6)),
                            lng: Number(e.latLng.lng().toFixed(6)),
                          });
                        }}
                      >
                        <Pin
                          background="#0F766E"
                          borderColor="#115E59"
                          glyphColor="#FFFFFF"
                          glyphText="ร้าน"
                          scale={1.15}
                        />
                      </AdvancedMarker>
                    </>
                  )}
                </GoogleMap>
              </APIProvider>
            )}
          </div>
        </div>

        <div
          className="px-5 py-3.5 border-t flex items-center justify-end gap-2 shrink-0"
          style={{ borderColor: 'var(--border-soft)', backgroundColor: 'var(--bg-canvas)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-main)' }}
          >
            {tx('ยกเลิก', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!draftShop}
            onClick={() => {
              if (!draftShop) return;
              playSoftClick();
              onSaveShopLocation({
                lat: draftShop.lat,
                lng: draftShop.lng,
                ...(labelInput.trim() ? { label: labelInput.trim() } : {}),
                updatedAt: new Date().toISOString(),
              });
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white cursor-pointer disabled:opacity-45"
            style={{ backgroundColor: '#0F766E' }}
          >
            {tx('บันทึกพิกัดร้าน (รัศมี 3 กม.)', 'Save Shop Pin (3 km Radius)')}
          </button>
        </div>
      </div>
    </div>
  );
};
