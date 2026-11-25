import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Lightbulb,
  Thermometer,
  Wind,
  Lock,
  Unlock,
  QrCode,
  Mic,
  MicOff,
  Sparkles,
  CreditCard,
  Download,
  CheckCircle2,
  Plus,
  Minus,
  Zap,
  ShieldCheck,
  Crown,
  Wifi,
  Volume2,
  X,
  CalendarPlus,
  Utensils,
  Droplets,
  Shirt,
  Car,
  ShoppingBag,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/useApp';
import { apiFetch, apiUrl } from '../../utils/api';
import NewBookingModal from '../common/NewBookingModal';

const AMBIENT_COLORS = {
  CYAN: { label: 'Neon Cyan', hex: '#00F3FF', glow: 'shadow-[0_0_45px_rgba(0,243,255,0.35)]', bg: 'from-cyan-500/25 via-sky-500/10 to-transparent' },
  VIOLET: { label: 'Cyber Violet', hex: '#8A2BE2', glow: 'shadow-[0_0_45px_rgba(138,43,226,0.4)]', bg: 'from-violet-600/30 via-fuchsia-500/10 to-transparent' },
  GOLD: { label: 'Royal Gold', hex: '#F59E0B', glow: 'shadow-[0_0_45px_rgba(245,158,11,0.35)]', bg: 'from-amber-500/25 via-yellow-500/10 to-transparent' },
  WARM: { label: 'Sunset Warm', hex: '#FB7185', glow: 'shadow-[0_0_45px_rgba(251,113,133,0.35)]', bg: 'from-rose-500/25 via-orange-400/10 to-transparent' },
};

const MOOD_SCENES = [
  { id: 'CYBER_LOUNGE', vi: 'Cyber Lounge', en: 'Cyber Lounge', lights: true, ambientLighting: 'VIOLET', acTemp: 21, curtainsOpen: 75 },
  { id: 'ROMANTIC', vi: 'Lãng Mạn', en: 'Romantic', lights: true, ambientLighting: 'WARM', acTemp: 22, curtainsOpen: 30 },
  { id: 'FOCUS', vi: 'Làm Việc', en: 'Deep Focus', lights: true, ambientLighting: 'CYAN', acTemp: 20, curtainsOpen: 100 },
  { id: 'SLEEP', vi: 'Ngủ Sâu', en: 'Deep Sleep', lights: false, ambientLighting: 'WARM', acTemp: 23, curtainsOpen: 0 },
];

const QUICK_VOICE_COMMANDS = [
  { vi: 'Mở rèm 80%', en: 'Open curtains 80%' },
  { vi: 'Bật đèn tím lãng mạn', en: 'Romantic violet lights' },
  { vi: 'Chỉnh điều hòa 19 độ', en: 'Set AC to 19 degrees' },
  { vi: 'Chế độ ngủ sâu', en: 'Deep sleep mode' },
  { vi: 'Gọi dọn phòng ngay', en: 'Request cleaning now' },
];

const POS_MENU = [
  {
    id: 'water',
    itemName: 'Nước suối Evian & Snack VIP',
    enName: 'Evian Mineral Water & VIP Snacks',
    category: 'MINIBAR',
    unitPrice: 6,
    icon: Droplets,
    accent: 'text-cyan-400 bg-cyan-500/15 border-cyan-400/30',
  },
  {
    id: 'laundry',
    itemName: 'Giặt ủi Siêu Tốc 2h (Express Laundry)',
    enName: '2h Express Luxury Laundry',
    category: 'LAUNDRY',
    unitPrice: 18,
    icon: Shirt,
    accent: 'text-violet-400 bg-violet-500/15 border-violet-400/30',
  },
  {
    id: 'breakfast',
    itemName: 'Bữa Sáng Tại Phòng (Floating VIP Breakfast)',
    enName: 'In-Room Gourmet Breakfast',
    category: 'DINING',
    unitPrice: 32,
    icon: Utensils,
    accent: 'text-amber-400 bg-amber-500/15 border-amber-400/30',
  },
  {
    id: 'airport',
    itemName: 'Đưa Đón Sân Bay Limousine VIP',
    enName: 'Private Airport Limousine Transfer',
    category: 'TRANSPORT',
    unitPrice: 55,
    icon: Car,
    accent: 'text-emerald-400 bg-emerald-500/15 border-emerald-400/30',
  },
];

function parseVoiceFallbackUpdates(text) {
  const lower = String(text || '').toLowerCase();
  const updates = {};
  if (lower.includes('ngủ') || lower.includes('sleep')) {
    return { lights: false, curtainsOpen: 0, acTemp: 22, doorLocked: true, scene: 'SLEEP' };
  }
  if (lower.includes('lãng mạn') || lower.includes('romantic')) {
    return { lights: true, ambientLighting: 'VIOLET', curtainsOpen: 35, acTemp: 21, scene: 'ROMANTIC' };
  }
  if (lower.includes('làm việc') || lower.includes('focus') || lower.includes('work')) {
    return { lights: true, ambientLighting: 'CYAN', curtainsOpen: 100, acTemp: 20, scene: 'FOCUS' };
  }
  if (lower.includes('tắt đèn') || lower.includes('turn off light') || lower.includes('lights off')) {
    updates.lights = false;
  } else if (lower.includes('bật đèn') || lower.includes('mở đèn') || lower.includes('turn on light') || lower.includes('lights on')) {
    updates.lights = true;
  }
  if (lower.includes('tím') || lower.includes('violet') || lower.includes('purple')) {
    updates.lights = true;
    updates.ambientLighting = 'VIOLET';
  } else if (lower.includes('xanh') || lower.includes('cyan') || lower.includes('blue')) {
    updates.lights = true;
    updates.ambientLighting = 'CYAN';
  } else if (lower.includes('vàng') || lower.includes('ấm') || lower.includes('gold') || lower.includes('warm')) {
    updates.lights = true;
    updates.ambientLighting = 'GOLD';
  }
  const pct = lower.match(/(\d{1,3})\s*%/);
  if (lower.includes('rèm') || lower.includes('curtain') || lower.includes('blind')) {
    if (pct) {
      updates.curtainsOpen = Math.min(100, Math.max(0, parseInt(pct[1], 10)));
    } else if (lower.includes('mở') || lower.includes('open')) {
      updates.curtainsOpen = 100;
    } else if (lower.includes('đóng') || lower.includes('kéo') || lower.includes('close')) {
      updates.curtainsOpen = 0;
    }
  }
  const lowerNoPct = lower.replace(/\d{1,3}\s*%/g, ' ');
  const deg =
    lowerNoPct.match(/(?:điều hòa|máy lạnh|nhiệt độ|\bac\b|\btemp(?:erature)?\b)[^\d]*(\d{2})/) ||
    lowerNoPct.match(/(\d{2})\s*(?:độ|°|degree)/);
  if (
    deg &&
    (lower.includes('điều hòa') ||
      lower.includes('máy lạnh') ||
      lower.includes('nhiệt độ') ||
      /\bac\b/.test(lower) ||
      /\btemp(?:erature)?\b/.test(lower))
  ) {
    updates.acTemp = Math.min(30, Math.max(16, parseInt(deg[1], 10)));
  }
  if (lower.includes('mở cửa') || lower.includes('unlock')) {
    updates.doorLocked = false;
  } else if (lower.includes('khóa cửa') || lower.includes('lock door')) {
    updates.doorLocked = true;
  }
  return updates;
}

export default function GuestSmartRoomVIP() {
  const { theme, t, lang, showCustomToast, onSocketEvent, serverStatus, subscribeDemoReset } = useApp();
  const isDark = theme === 'dark';

  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [smartState, setSmartState] = useState({
    lights: true,
    ambientLighting: 'CYAN',
    acTemp: 21,
    curtainsOpen: 75,
    doorLocked: true,
    scene: 'CYBER_LOUNGE',
  });

  const [isListening, setIsListening] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceReply, setVoiceReply] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  const [unlockProgress, setUnlockProgress] = useState(0);
  const holdIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  const selectedRoomIdRef = useRef(null);
  const prevServerStatusRef = useRef(serverStatus);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [payingMethod, setPayingMethod] = useState('VIETQR');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [vnpayFallbackUrl, setVnpayFallbackUrl] = useState('');
  const [orderingId, setOrderingId] = useState(null);
  const [requestingClean, setRequestingClean] = useState(false);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoom?.id || null;
  }, [selectedRoom]);

  const fetchGuestData = useCallback(async () => {
    try {
      const [roomJson, bookJson] = await Promise.all([
        apiFetch('/api/rooms'),
        apiFetch('/api/bookings'),
      ]);

      setLoadError('');
      if (roomJson.success && Array.isArray(roomJson.data) && roomJson.data.length > 0) {
        setRooms(roomJson.data);
        const occupied = roomJson.data.find((r) => r.status === 'OCCUPIED') || roomJson.data[0];
        const prevId = selectedRoomIdRef.current;
        const target = prevId ? roomJson.data.find((r) => r.id === prevId) || occupied : occupied;
        selectedRoomIdRef.current = target?.id || null;
        setSelectedRoom(target);
        if (target?.smartControls) {
          try {
            setSmartState((s) => ({ ...s, ...JSON.parse(target.smartControls) }));
          } catch {
            // ignore malformed JSON
          }
        }
      }
      if (bookJson.success && Array.isArray(bookJson.data)) {
        setBookings(bookJson.data);
      }
    } catch (err) {
      setLoadError(err.message || 'Unable to load Smart Room telemetry.');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const [roomJson, bookJson] = await Promise.all([
          apiFetch('/api/rooms'),
          apiFetch('/api/bookings'),
        ]);
        if (!active) return;
        setLoadError('');
        if (roomJson.success && Array.isArray(roomJson.data) && roomJson.data.length > 0) {
          setRooms(roomJson.data);
          const occupied = roomJson.data.find((r) => r.status === 'OCCUPIED') || roomJson.data[0];
          const prevId = selectedRoomIdRef.current;
          const target = prevId ? roomJson.data.find((r) => r.id === prevId) || occupied : occupied;
          selectedRoomIdRef.current = target?.id || null;
          setSelectedRoom(target);
          if (target?.smartControls) {
            try {
              setSmartState((s) => ({ ...s, ...JSON.parse(target.smartControls) }));
            } catch {
              // ignore malformed JSON
            }
          }
        }
        if (bookJson.success && Array.isArray(bookJson.data)) {
          setBookings(bookJson.data);
        }
      } catch (err) {
        if (active) setLoadError(err.message || 'Unable to load Smart Room telemetry.');
      } finally {
        if (active) setLoadingInitial(false);
      }
    };
    init();

    const unsubs = [
      onSocketEvent('iot:action', (event) => {
        if (!event?.roomId) return;
        if (selectedRoomIdRef.current === event.roomId && event.smartControls) {
          setSmartState((prev) => ({ ...prev, ...event.smartControls }));
        }
      }),
      onSocketEvent('payment:confirmed', fetchGuestData),
      onSocketEvent('folio:updated', fetchGuestData),
      onSocketEvent('booking:created', fetchGuestData),
      onSocketEvent('room:status_updated', fetchGuestData),
      onSocketEvent('system:demo_reset', fetchGuestData),
      subscribeDemoReset(fetchGuestData),
    ];

    return () => {
      active = false;
      unsubs.forEach((unsub) => unsub());
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [onSocketEvent, subscribeDemoReset, fetchGuestData]);

  useEffect(() => {
    const prev = prevServerStatusRef.current;
    prevServerStatusRef.current = serverStatus;
    if (prev !== 'online' && serverStatus === 'online' && loadError) {
      Promise.resolve().then(fetchGuestData);
    }
  }, [serverStatus, loadError, fetchGuestData]);

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    if (room?.smartControls) {
      try {
        setSmartState({
          lights: false,
          ambientLighting: 'CYAN',
          acTemp: 21,
          curtainsOpen: 50,
          doorLocked: true,
          scene: 'STANDBY',
          ...JSON.parse(room.smartControls),
        });
      } catch {
        // ignore
      }
    }
  };

  const dispatchIoTUpdate = async (device, action, value, updates) => {
    const prevSnapshot = { ...smartState };
    setSmartState((curr) => ({ ...curr, ...updates }));
    if (!selectedRoom) return;

    try {
      const json = await apiFetch('/api/iot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 45000,
        body: JSON.stringify({
          roomId: selectedRoom.id,
          device,
          action,
          value,
          updates,
          source: 'UI',
        }),
      });
      if (json.success && json.smartControls) {
        setSmartState(json.smartControls);
      }
    } catch (err) {
      setSmartState(prevSnapshot);
      showCustomToast(`⚠️ ${err.message}`);
    }
  };

  const handleVoiceCommand = async (transcriptText) => {
    if (!transcriptText.trim()) return;
    setIsProcessingVoice(true);
    setVoiceInput(transcriptText);

    const applyLocalVoiceFallback = () => {
      const localUpdates = parseVoiceFallbackUpdates(transcriptText);
      if (Object.keys(localUpdates).length > 0) {
        setSmartState((prev) => ({ ...prev, ...localUpdates }));
        setVoiceReply(
          t(
            `[Chế độ Dự phòng] Đã mô phỏng cập nhật phòng cho lệnh "${transcriptText}" trong lúc máy chủ đang khởi động lại.`,
            `[Offline Fallback] Simulated room update for "${transcriptText}" while backend reconnects.`
          )
        );
      } else {
        setVoiceReply(
          t(
            'Không thể kết nối Voice AI tới máy chủ lúc này. Vui lòng thử lại sau giây lát.',
            'Could not reach Voice AI backend right now. Please retry shortly.'
          )
        );
      }
    };

    if (!selectedRoom) {
      applyLocalVoiceFallback();
      setIsProcessingVoice(false);
      return;
    }

    try {
      const data = await apiFetch('/api/iot/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 45000,
        body: JSON.stringify({
          roomId: selectedRoom.id,
          transcript: transcriptText,
        }),
      });
      if (data.success) {
        if (data.smartControls) setSmartState(data.smartControls);
        setVoiceReply(data.spokenReply || t('Đã thực thi lệnh giọng nói!', 'Voice command executed!'));
      }
    } catch {
      applyLocalVoiceFallback();
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const startMicrophoneListening = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceReply(
        t(
          'Trình duyệt chưa hỗ trợ Web Speech API. Vui lòng gõ lệnh hoặc chọn chip gợi ý bên dưới.',
          'Browser does not support Web Speech API. Type or tap a quick command below.'
        )
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang === 'vi' ? 'vi-VN' : 'en-US';
    recognition.interimResults = false;

    setIsListening(true);
    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || '';
      setIsListening(false);
      if (spoken) handleVoiceCommand(spoken);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const startHoldUnlock = () => {
    if (!smartState.doorLocked) {
      dispatchIoTUpdate('DOOR_LOCK', 'LOCK', 'Door Secured', { doorLocked: true });
      return;
    }
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setUnlockProgress(0);
    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / 1600) * 100));
      setUnlockProgress(pct);
      if (pct >= 100) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        dispatchIoTUpdate('DOOR_LOCK', 'UNLOCK', 'Biometric QR Unlocked', { doorLocked: false });
        setTimeout(() => setUnlockProgress(0), 600);
      }
    }, 30);
  };

  const cancelHoldUnlock = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setUnlockProgress(0);
  };

  const roomBooking = selectedRoom
    ? bookings.find((b) => b.roomId === selectedRoom.id) || selectedRoom.bookings?.[0] || null
    : null;

  const handleOrderPOSItem = async (item) => {
    if (!roomBooking) {
      showCustomToast(t('Vui lòng chọn phòng đang có booking hoặc bấm "Đặt Phòng Mới" trước khi gọi dịch vụ!', 'Select an active occupied room or create a booking first.'));
      return;
    }
    setOrderingId(item.id);
    try {
      const json = await apiFetch(`/api/bookings/${roomBooking.id}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: item.itemName,
          category: item.category,
          quantity: 1,
          unitPrice: item.unitPrice,
        }),
      });
      if (!json.success) throw new Error(json.message || 'POS order failed');
      await fetchGuestData();
    } catch (err) {
      showCustomToast(`❌ ${err.message}`);
    } finally {
      setOrderingId(null);
    }
  };

  const handleRequestCleaning = async () => {
    if (!selectedRoom) return;
    setRequestingClean(true);
    try {
      const json = await apiFetch(`/api/rooms/${selectedRoom.id}/request-cleaning`, { method: 'POST' });
      if (!json.success) throw new Error(json.message || 'Cleaning request failed');
      await fetchGuestData();
    } catch (err) {
      showCustomToast(`❌ ${err.message}`);
    } finally {
      setRequestingClean(false);
    }
  };

  const ambient = AMBIENT_COLORS[smartState.ambientLighting] || AMBIENT_COLORS.CYAN;

  const handleSimulateVietQR = async () => {
    if (!roomBooking) return;
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const json = await apiFetch(`/api/bookings/${roomBooking.id}/simulate-vietqr`, {
        method: 'POST',
      });
      if (!json.success) throw new Error(json.message || 'Payment simulation failed.');
      await fetchGuestData();
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleVNPayCheckout = async () => {
    if (!roomBooking) return;
    setPaymentProcessing(true);
    setPaymentError('');
    setVnpayFallbackUrl('');
    try {
      const json = await apiFetch('/api/payment/create_url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 55000,
        body: JSON.stringify({
          bookingId: roomBooking.id,
          amount: roomBooking.totalAmount,
          bankCode: 'NCB',
        }),
      });
      if (!json.success || !json.paymentUrl) {
        throw new Error(json.message || 'Could not create VNPay checkout URL.');
      }
      const win = window.open(json.paymentUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        setVnpayFallbackUrl(json.paymentUrl);
      }
    } catch (err) {
      setPaymentError(
        `${err.message} ${t('Bạn có thể chuyển sang thanh toán VietQR Napas 24/7 tức thì.', 'You may switch to instant VietQR Napas 24/7.')}`
      );
    } finally {
      setPaymentProcessing(false);
    }
  };

  const cardSurface = isDark
    ? 'bg-[#1A1F2C]/85 border-white/10 text-white'
    : 'bg-white/90 border-slate-200 text-slate-900 shadow-lg';

  const totalBookingAmount = Number(Number(roomBooking?.totalAmount || 0).toFixed(2));
  const posCharges = Array.isArray(roomBooking?.charges) ? roomBooking.charges : [];

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 shrink-0">
              <Crown className="w-5 h-5" />
            </span>
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('Trải Nghiệm Phòng Thông Minh 3D & POS', 'Guest 3D Smart Room & POS')}
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {t(
              'Điều khiển IoT 3D, giọng nói tiếng Việt, đặt Dịch Vụ Phòng tự động cộng Bill & thanh toán VietQR.',
              '3D Spatial IoT, bilingual Voice AI, instant POS Room Service folio & VietQR checkout.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex flex-wrap items-center p-1 rounded-xl border text-xs max-w-full ${isDark ? 'bg-[#1A1F2C] border-white/10' : 'bg-white border-slate-200'}`}>
            {loadingInitial && rooms.length === 0 ? (
              <span className="px-3 py-1.5 text-cyan-400 font-mono flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('Đang nạp phòng...', 'Loading suites...')}
              </span>
            ) : (
              rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectRoom(r)}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                    selectedRoom?.id === r.id
                      ? 'bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-950 font-bold shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  P.{r.number}
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => setShowNewBookingModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs shadow-neon-violet hover:scale-105 transition-all"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            {t('Đặt Phòng Mới', 'New Booking')}
          </button>

          {selectedRoom && (
            <button
              onClick={handleRequestCleaning}
              disabled={requestingClean}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-400 font-bold text-xs transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {requestingClean ? '...' : t('Yêu Cầu Dọn Phòng', 'Request Cleaning')}
            </button>
          )}

          {roomBooking && (
            <button
              onClick={() => {
                setPaymentError('');
                setVnpayFallbackUrl('');
                setShowCheckoutModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-bold text-xs shadow-neon-cyan transition-all"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {t(`Thanh Toán ($${totalBookingAmount})`, `Checkout ($${totalBookingAmount})`)}
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={fetchGuestData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 font-semibold"
          >
            <RefreshCw className="w-3 h-3" />
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all duration-500 ${cardSurface} ${smartState.lights ? ambient.glow : ''}`}>
            <AnimatePresence>
              {smartState.lights && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 bg-gradient-to-br ${ambient.bg} pointer-events-none`}
                />
              )}
            </AnimatePresence>

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
                  DIGITAL TWIN • SUITE #{selectedRoom?.number || '302'} ({selectedRoom?.status || 'OCCUPIED'})
                </span>
                <h2 className="text-xl font-bold mt-0.5">{selectedRoom?.type || 'Quantum Horizon VIP'}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  <Wifi className="w-3.5 h-3.5" /> Wi-Fi 7 Active
                </span>
              </div>
            </div>

            <div className="relative h-52 rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#070B19] via-[#131C3A] to-[#0F172A] mb-5">
              <div className="absolute inset-0 flex items-end justify-around px-6 pb-0 opacity-90">
                <div className="w-10 h-28 bg-slate-900/90 border-t border-x border-cyan-500/30 rounded-t-sm relative">
                  <div className="absolute top-3 left-2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                </div>
                <div className="w-14 h-40 bg-slate-950/90 border-t border-x border-violet-500/40 rounded-t-md relative">
                  <div className="absolute top-2 inset-x-3 h-1 bg-violet-400/70" />
                  <div className="grid grid-cols-3 gap-1 p-2 mt-4">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="h-1.5 bg-cyan-300/40 rounded-[1px]" />
                    ))}
                  </div>
                </div>
                <div className="w-16 h-44 bg-slate-900/95 border-t border-x border-cyan-400/50 rounded-t-lg relative flex flex-col items-center">
                  <div className="w-1 h-6 bg-cyan-400 -mt-6 shadow-[0_0_10px_#00f3ff]" />
                  <div className="text-[8px] font-mono text-cyan-300 mt-2">SAIGON SKY</div>
                </div>
                <div className="w-12 h-32 bg-slate-950/90 border-t border-x border-amber-400/30 rounded-t-sm" />
              </div>

              <motion.div
                animate={{ width: `${(100 - Number(smartState.curtainsOpen || 0)) / 2}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#0B0F19] via-[#1B2234] to-[#262F47] border-r border-white/10 shadow-2xl"
              />
              <motion.div
                animate={{ width: `${(100 - Number(smartState.curtainsOpen || 0)) / 2}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-[#0B0F19] via-[#1B2234] to-[#262F47] border-l border-white/10 shadow-2xl"
              />

              <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
                <div className="px-2.5 sm:px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] font-mono text-white flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" style={{ color: smartState.lights ? ambient.hex : '#64748B' }} />
                  <span>{smartState.lights ? `${ambient.label} ON` : 'Lights OFF'}</span>
                </div>
                <div className="px-2.5 sm:px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '5s' }} />
                  <span>AC {smartState.acTemp}°C</span>
                </div>
                <div className="px-2.5 sm:px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] font-mono text-amber-300">
                  {t(`Rèm ${smartState.curtainsOpen}%`, `Blinds ${smartState.curtainsOpen}%`)}
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                {t('Kịch Bản Ngữ Cảnh Thông Minh (1-Chạm)', 'Smart Room Mood Presets')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {MOOD_SCENES.map((scene) => {
                  const active = smartState.scene === scene.id;
                  return (
                    <button
                      key={scene.id}
                      onClick={() =>
                        dispatchIoTUpdate('SCENE', 'SET_SCENE', scene.id, {
                          lights: scene.lights,
                          ambientLighting: scene.ambientLighting,
                          acTemp: scene.acTemp,
                          curtainsOpen: scene.curtainsOpen,
                          scene: scene.id,
                        })
                      }
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 hover:scale-105 ${
                        active
                          ? 'bg-cyan-400/15 border-cyan-400 text-cyan-400 shadow-neon-cyan'
                          : isDark
                          ? 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {lang === 'vi' ? scene.vi : scene.en}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Room Service & Mini-Bar POS Folio */}
          <div className={`rounded-3xl border p-5 sm:p-6 ${cardSurface}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-400 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold">{t('Dịch Vụ Phòng & Mini-Bar POS (Tự Động Cộng Bill)', 'Room Service & Mini-Bar POS Folio')}</h3>
                  <p className="text-xs text-slate-400">
                    {t('Đặt món trực tiếp từ phòng — tự động báo Lễ tân và cộng vào hóa đơn VietQR/PDF.', 'Instant POS orders append directly to room folio, checkout & PDF invoice.')}
                  </p>
                </div>
              </div>
              {roomBooking && (
                <div className="text-xs font-mono px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 font-bold shrink-0 self-start sm:self-auto">
                  Folio Total: ${totalBookingAmount}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {POS_MENU.map((item) => {
                const Icon = item.icon;
                const isOrdering = orderingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      isDark ? 'bg-[#0B0F19]/65 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.accent}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold truncate">{lang === 'vi' ? item.itemName : item.enName}</h4>
                        <div className="text-[11px] font-mono text-cyan-400 font-bold mt-0.5">
                          ${item.unitPrice}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({(item.unitPrice * 25400).toLocaleString('vi-VN')}₫)
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOrderPOSItem(item)}
                      disabled={isOrdering}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition-all disabled:opacity-40"
                    >
                      {isOrdering ? '...' : t('+ Đặt', '+ Order')}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Room POS Folio Ledger */}
            {posCharges.length > 0 && (
              <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${isDark ? 'bg-[#0B0F19]/50 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div className="font-bold text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                  {t(`Dịch vụ đã phát sinh tại Phòng ${selectedRoom?.number || ''}`, `Itemized POS Folio (Room ${selectedRoom?.number || ''})`)}
                </div>
                {posCharges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="truncate">• {c.itemName} <span className="text-slate-400">x{c.quantity}</span></span>
                    <span className="font-mono font-bold text-emerald-400 shrink-0">+${Number(c.totalPrice || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice AI Control Hub */}
          <div className={`rounded-3xl border p-5 sm:p-6 ${cardSurface}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl border shrink-0 ${isListening ? 'bg-rose-500/20 border-rose-400 text-rose-400 animate-pulse' : 'bg-violet-500/15 border-violet-400/30 text-violet-400'}`}>
                  <Volume2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold">{t('Điều Khiển Giọng Nói AI (Tiếng Việt / English)', 'Voice AI Room Commander')}</h3>
                  <p className="text-xs text-slate-400">
                    {t('Nói tự nhiên để chỉnh đèn, rèm, điều hòa hoặc gọi dịch vụ phòng tức thì.', 'Speak naturally to adjust room hardware or dispatch room service.')}
                  </p>
                </div>
              </div>

              <button
                onClick={startMicrophoneListening}
                className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
                    : 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 shadow-neon-violet'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isListening ? t('Đang nghe...', 'Listening...') : t('Nói Lệnh Mic', 'Speak Command')}
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVoiceCommand(voiceInput);
              }}
              className="flex gap-2 mb-3"
            >
              <input
                type="text"
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                placeholder={t('Ví dụ: "Mở rèm 80% và bật đèn tím"...', 'Try: "Open curtains 80% and romantic lights"...')}
                className={`flex-1 min-w-0 px-4 py-2.5 rounded-xl border text-xs outline-none ${
                  isDark ? 'bg-[#0B0F19]/80 border-white/10 text-white focus:border-cyan-400' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'
                }`}
              />
              <button
                type="submit"
                disabled={isProcessingVoice || !voiceInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs disabled:opacity-40 transition-all shrink-0"
              >
                {isProcessingVoice ? '...' : t('Thực Thi', 'Execute')}
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {QUICK_VOICE_COMMANDS.map((cmd, idx) => {
                const label = lang === 'vi' ? cmd.vi : cmd.en;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleVoiceCommand(label)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all hover:scale-105 ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-cyan-300 hover:border-cyan-400/50'
                        : 'bg-slate-100 border-slate-200 text-cyan-800 hover:border-cyan-500'
                    }`}
                  >
                    🎙️ &quot;{label}&quot;
                  </button>
                );
              })}
            </div>

            {voiceReply && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-xs flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className={isDark ? 'text-cyan-200' : 'text-cyan-900'}>{voiceReply}</span>
              </motion.div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className={`rounded-3xl border p-5 sm:p-6 space-y-5 ${cardSurface}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${smartState.lights ? 'bg-cyan-400/20 border-cyan-400 text-cyan-400' : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{t('Đèn Thông Minh RGB', 'Smart Ambient Lights')}</h4>
                  <p className="text-[11px] text-slate-400">{smartState.lights ? ambient.label : t('Đang tắt', 'Powered Off')}</p>
                </div>
              </div>

              <button
                onClick={() => dispatchIoTUpdate('LIGHTS', 'TOGGLE', !smartState.lights ? 'ON' : 'OFF', { lights: !smartState.lights })}
                className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${smartState.lights ? 'bg-cyan-400' : 'bg-slate-700'}`}
                aria-label="Toggle smart lights"
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${smartState.lights ? 'translate-x-7' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(AMBIENT_COLORS).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => dispatchIoTUpdate('LIGHTS', 'COLOR', key, { lights: true, ambientLighting: key })}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-all ${
                    smartState.ambientLighting === key && smartState.lights
                      ? isDark
                        ? 'border-white text-white scale-105'
                        : 'border-slate-900 text-slate-950 scale-105'
                      : 'border-slate-500/20 text-slate-400 opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: `${cfg.hex}25`, borderColor: smartState.ambientLighting === key ? cfg.hex : undefined }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            <div className={`pt-4 border-t flex items-center justify-between ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{t('Điều Hòa Inverter AI', 'Smart Climate AC')}</h4>
                  <p className="text-[11px] text-slate-400">{t('Dải nhiệt 16°C – 30°C', 'Range 16°C – 30°C')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    const next = Math.max(16, Number(smartState.acTemp || 21) - 1);
                    dispatchIoTUpdate('AC', 'SET_TEMP', `${next}°C`, { acTemp: next });
                  }}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                    isDark ? 'bg-white/5 hover:bg-white/15 border-slate-500/25' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                  }`}
                  aria-label="Decrease AC temperature"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-black font-mono text-cyan-400 w-12 text-center">
                  {smartState.acTemp}°C
                </span>
                <button
                  onClick={() => {
                    const next = Math.min(30, Number(smartState.acTemp || 21) + 1);
                    dispatchIoTUpdate('AC', 'SET_TEMP', `${next}°C`, { acTemp: next });
                  }}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                    isDark ? 'bg-white/5 hover:bg-white/15 border-slate-500/25' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                  }`}
                  aria-label="Increase AC temperature"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className={`pt-4 border-t space-y-2.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">{t('Rèm Cửa Tự Động (0% – 100%)', 'Motorized Smart Curtains')}</span>
                <span className="font-mono text-cyan-400 font-bold">{smartState.curtainsOpen}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={smartState.curtainsOpen}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSmartState((p) => ({ ...p, curtainsOpen: val }));
                }}
                onMouseUp={(e) => dispatchIoTUpdate('CURTAINS', 'SET_OPEN', `${e.target.value}%`, { curtainsOpen: Number(e.target.value) })}
                onTouchEnd={(e) => dispatchIoTUpdate('CURTAINS', 'SET_OPEN', `${e.target.value}%`, { curtainsOpen: Number(e.target.value) })}
                onKeyUp={(e) => dispatchIoTUpdate('CURTAINS', 'SET_OPEN', `${e.target.value}%`, { curtainsOpen: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          <div className={`rounded-3xl border p-5 sm:p-6 space-y-4 ${cardSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <h4 className="text-sm font-bold">{t('Chìa Khóa Số QR & Khóa Cửa Thông Minh', 'Mobile QR Key & Biometric Door Lock')}</h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${smartState.doorLocked ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'}`}>
                {smartState.doorLocked ? t('ĐANG KHÓA', 'LOCKED') : t('ĐÃ MỞ CỬA', 'UNLOCKED')}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="p-3 rounded-2xl bg-white shadow-xl shrink-0">
                <QRCodeSVG
                  value={roomBooking?.digitalKey || `NEX-KEY-${selectedRoom?.number || '302'}-LIVE`}
                  size={104}
                  level="H"
                />
              </div>

              <div className="flex-1 space-y-3 text-center sm:text-left min-w-0">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">ENCRYPTED NFC / QR TOKEN</div>
                  <div className="text-xs font-mono font-bold text-cyan-400 break-all">
                    {roomBooking?.digitalKey || `NEX-KEY-${selectedRoom?.number || '302'}-STANDBY`}
                  </div>
                </div>

                <motion.button
                  onMouseDown={startHoldUnlock}
                  onMouseUp={cancelHoldUnlock}
                  onMouseLeave={cancelHoldUnlock}
                  onTouchStart={startHoldUnlock}
                  onTouchEnd={cancelHoldUnlock}
                  onTouchCancel={cancelHoldUnlock}
                  whileTap={{ scale: 0.97 }}
                  className={`relative w-full overflow-hidden py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all select-none ${
                    smartState.doorLocked
                      ? 'bg-cyan-500/10 border-cyan-400/50 text-cyan-400 hover:bg-cyan-500/20'
                      : 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                  }`}
                >
                  {unlockProgress > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan-400/35 transition-none"
                      style={{ width: `${unlockProgress}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {smartState.doorLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {smartState.doorLocked
                      ? unlockProgress > 0
                        ? t(`Đang xác thực (${unlockProgress}%)...`, `Verifying (${unlockProgress}%)...`)
                        : t('Nhấn & Giữ 2s để Mở Khóa Cửa', 'Hold 2s to Unlock Door')
                      : t('Chạm để Khóa Lại Cửa', 'Tap to Re-Lock Door')}
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Booking Modal */}
      <NewBookingModal
        isOpen={showNewBookingModal}
        onClose={() => setShowNewBookingModal(false)}
        rooms={rooms}
        defaultSource="ONLINE"
        onBookingCreated={(created) => {
          fetchGuestData();
          if (created?.room) setSelectedRoom(created.room);
        }}
      />

      {/* VietQR + VNPay Checkout Modal with Itemized POS Folio */}
      <AnimatePresence>
        {showCheckoutModal && roomBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-[#141925] border border-cyan-400/30 p-5 sm:p-6 md:p-7 shadow-2xl text-white relative my-auto"
            >
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4 pr-8">
                <span className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold">{t('Cổng Thanh Toán Kép VietQR & VNPay', 'VietQR Napas 24/7 & VNPay Checkout')}</h3>
                  <p className="text-xs text-slate-400">Folio #{String(roomBooking.id || '').slice(0, 8).toUpperCase()} • Phòng #{roomBooking.room?.number || selectedRoom?.number}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0B0F19] border border-white/10 space-y-2.5 mb-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400">{t('Tổng tiền thanh toán (Phòng + POS)', 'Total Balance (Room + POS)')}</span>
                    <div className="text-2xl font-black text-cyan-400 font-mono">
                      ${totalBookingAmount}
                      <span className="text-xs text-slate-400 font-normal ml-2">
                        ({Math.round(totalBookingAmount * 25400).toLocaleString('vi-VN')} ₫)
                      </span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
                    roomBooking.paymentStatus === 'COMPLETED'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-400/40'
                      : 'bg-amber-500/15 text-amber-400 border-amber-400/40'
                  }`}>
                    {roomBooking.paymentStatus === 'COMPLETED' ? t('ĐÃ THANH TOÁN', 'PAID') : t('CHỜ THANH TOÁN', 'PENDING')}
                  </span>
                </div>

                {posCharges.length > 0 && (
                  <div className="pt-2 border-t border-white/10 text-[11px] space-y-1">
                    {posCharges.map((c) => (
                      <div key={c.id} className="flex justify-between text-slate-300 gap-2">
                        <span className="truncate">+ {c.itemName} x{c.quantity}</span>
                        <span className="font-mono text-cyan-300 shrink-0">${Number(c.totalPrice || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {paymentError && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {paymentError}
                </div>
              )}

              {vnpayFallbackUrl && (
                <div className="mb-3 p-3 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs space-y-2">
                  <p className="text-cyan-200">
                    {t('Trình duyệt vừa chặn popup tự động. Vui lòng bấm liên kết bên dưới để mở cổng VNPay:', 'Popup was blocked by your browser. Click below to open VNPay:')}
                  </p>
                  <a
                    href={vnpayFallbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 text-slate-950 font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('Tiếp tục tới VNPay', 'Proceed to VNPay')}
                  </a>
                </div>
              )}

              {roomBooking.paymentStatus === 'COMPLETED' ? (
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-emerald-300 font-semibold">
                    {t('Giao dịch đã được xác nhận tự động qua Webhook!', 'Transaction verified & settled instantaneously!')}
                  </p>
                  <a
                    href={apiUrl(`/api/invoice/${roomBooking.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-950 font-bold text-xs shadow-neon-cyan"
                  >
                    <Download className="w-4 h-4" />
                    {t('Tải Hóa Đơn Điện Tử PDF (Đủ Mục POS & Dấu PAID)', 'Download Official PDF Invoice')}
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2 p-1 rounded-xl bg-[#0B0F19] border border-white/10 text-xs">
                    <button
                      onClick={() => setPayingMethod('VIETQR')}
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${payingMethod === 'VIETQR' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      VietQR Napas 24/7
                    </button>
                    <button
                      onClick={() => setPayingMethod('VNPAY')}
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${payingMethod === 'VNPAY' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
                    >
                      VNPay Sandbox Portal
                    </button>
                  </div>

                  {payingMethod === 'VIETQR' ? (
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-white text-slate-900 space-y-2 text-center">
                      <div className="text-[11px] font-black tracking-wider text-blue-700">VIETQR • NAPAS 24/7 • TECHCOMBANK</div>
                      <QRCodeSVG
                        value={`00020101021238570010A00000072701270006970407011319039998889990208QRIBFTTA5303704540${Math.round(totalBookingAmount * 25400)}5802VN62200816NEXSTAY${roomBooking.room?.number || selectedRoom?.number || ''}6304`}
                        size={148}
                        level="M"
                      />
                      <div className="text-xs font-bold">NEXSTAY LUXURY HOTEL • STK: 1903 999 888 999</div>
                      <div className="text-[11px] text-slate-500">Nội dung CK: NEXSTAY P{roomBooking.room?.number || selectedRoom?.number || ''}</div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#0B0F19] border border-white/10 text-xs text-slate-300 space-y-1.5">
                      <p className="font-bold text-white">Thông tin thẻ test VNPay Sandbox (Ngân hàng NCB):</p>
                      <p>Số thẻ: <span className="font-mono text-cyan-400">9704198526191432198</span></p>
                      <p>Chủ thẻ: <span className="font-mono">NGUYEN VAN A</span> • Ngày phát hành: <span className="font-mono">07/15</span> • OTP: <span className="font-mono text-emerald-400">123456</span></p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {payingMethod === 'VIETQR' ? (
                      <button
                        onClick={handleSimulateVietQR}
                        disabled={paymentProcessing}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-bold text-xs shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" />
                        {paymentProcessing ? t('Đang xác thực...', 'Processing...') : t('Giả Lập Bank Báo Có Tức Thì (VietQR)', 'Simulate Instant VietQR Payment')}
                      </button>
                    ) : (
                      <button
                        onClick={handleVNPayCheckout}
                        disabled={paymentProcessing}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs shadow-neon-violet disabled:opacity-50"
                      >
                        {paymentProcessing ? t('Đang tạo link...', 'Creating session...') : t('Mở Cổng Thanh Toán VNPay', 'Launch VNPay Checkout')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
