import React, { useState, Suspense, lazy, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Scan,
  Loader2,
  Cpu,
  TrendingUp,
  Sun,
  Moon,
  Globe,
  Bell,
  Zap,
  X,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowLeft,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { AppProvider } from './context/AppContext';
import { useApp } from './context/useApp';
import { apiFetch, apiUrl } from './utils/api';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';
import AIConciergeFloating from './components/guest/AIConciergeFloating';

const GuestSmartRoomVIP = lazy(() => import('./components/guest/GuestSmartRoomVIP'));
const InteractiveRoomMatrix = lazy(() => import('./components/reception/InteractiveRoomMatrix'));
const ExpressCheckInOCR = lazy(() => import('./components/reception/ExpressCheckInOCR'));
const AdminSuperVIPDashboard = lazy(() => import('./components/admin/AdminSuperVIPDashboard'));

function formatSafeTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN');
}

function ModuleLoadingFallback({ title = 'Initializing Module' }) {
  return (
    <div className="w-full max-w-7xl mx-auto min-h-[460px] flex flex-col items-center justify-center p-8 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-neon-cyan">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
      <div className="text-center space-y-1">
        <h4 className="text-sm font-bold tracking-wide">{title}</h4>
        <p className="text-xs text-slate-400 font-mono">Loading NexStay OS module...</p>
      </div>
    </div>
  );
}

function PaymentCallbackView({ pathname, onReturnHome }) {
  const { theme, t } = useApp();
  const isDark = theme === 'dark';
  const isSuccess = pathname.startsWith('/payment/success');
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('bookingId') || '';
  const transactionNo = params.get('transactionNo') || '';
  const amount = params.get('amount') || '';
  const reason = params.get('reason') || params.get('error') || '';

  const [bookingInfo, setBookingInfo] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(Boolean(bookingId));

  useEffect(() => {
    if (!bookingId) return undefined;
    let active = true;
    apiFetch(`/api/payment/status/${encodeURIComponent(bookingId)}`, { timeoutMs: 55000 })
      .then((j) => {
        if (active && j.success) setBookingInfo(j.booking);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingBooking(false);
      });
    return () => {
      active = false;
    };
  }, [bookingId]);

  const numericAmount = Number(amount);
  const hasValidAmount = Boolean(amount) && Number.isFinite(numericAmount);

  return (
    <div className="w-full max-w-lg mx-auto py-14 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-3xl border p-6 sm:p-8 text-center space-y-5 backdrop-blur-xl ${
          isDark ? 'bg-[#1A1F2C]/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
      >
        <div
          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border ${
            isSuccess
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
              : 'bg-rose-500/15 border-rose-400/40 text-rose-400'
          }`}
        >
          {isSuccess ? <CheckCircle2 className="w-9 h-9" /> : <AlertTriangle className="w-9 h-9" />}
        </div>

        <div>
          <h2 className="text-xl font-bold">
            {isSuccess
              ? t('Thanh Toán VNPay Thành Công!', 'VNPay Payment Successful!')
              : t('Thanh Toán Chưa Hoàn Tất', 'Payment Failed or Canceled')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSuccess
              ? t('Hồ sơ đặt phòng đã được tự động cập nhật trạng thái PAID.', 'Your booking folio has been settled automatically.')
              : reason || t('Giao dịch bị hủy hoặc chưa được xác thực.', 'Transaction was declined or canceled.')}
          </p>
        </div>

        {bookingId && (
          <div className={`p-4 rounded-2xl border text-left text-xs font-mono space-y-1.5 ${isDark ? 'bg-[#0B0F19]/80 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div>Booking ID: <span className="text-cyan-400">{bookingId.slice(0, 12)}...</span></div>
            {loadingBooking && !bookingInfo && (
              <div className="text-slate-400 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('Đang tải chi tiết đặt phòng...', 'Fetching booking details...')}
              </div>
            )}
            {bookingInfo && (
              <>
                <div>Guest: <span className="font-bold">{bookingInfo.guestName || 'Guest'}</span></div>
                <div>Room: <span className="text-cyan-400">#{bookingInfo.roomNumber || 'N/A'} ({bookingInfo.roomType || 'Suite'})</span></div>
              </>
            )}
            {transactionNo && <div>VNPay Txn: <span className="text-emerald-400">{transactionNo}</span></div>}
            {hasValidAmount && <div>Amount VND: <span>{numericAmount.toLocaleString('vi-VN')} ₫</span></div>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {isSuccess && bookingId && (
            <a
              href={apiUrl(`/api/invoice/${encodeURIComponent(bookingId)}`)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-950 font-bold text-xs shadow-neon-cyan"
            >
              <Download className="w-4 h-4" />
              {t('Tải Hóa Đơn PDF', 'Download PDF Invoice')}
            </a>
          )}

          <button
            onClick={onReturnHome}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl border text-xs font-semibold ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('Quay Về NexStay OS', 'Return to NexStay OS')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NexStayShell() {
  const {
    theme,
    toggleTheme,
    lang,
    toggleLang,
    t,
    notifications,
    clearNotifications,
    liveToast,
    dismissToast,
    showCustomToast,
    serverStatus,
    isWakingUp,
    wakeElapsedSec,
    retryConnection,
    triggerDemoResetRefresh,
  } = useApp();
  const isDark = theme === 'dark';

  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [activeTab, setActiveTab] = useState('guest');
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const notifContainerRef = useRef(null);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!showNotifPanel) return undefined;
    const onMouseDown = (e) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target)) {
        setShowNotifPanel(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowNotifPanel(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showNotifPanel]);

  const isPaymentRoute = pathname.startsWith('/payment/success') || pathname.startsWith('/payment/failed');

  const handleReturnHome = () => {
    window.history.pushState({}, '', '/');
    setPathname('/');
  };

  const handleResetDemoData = async () => {
    if (resettingDemo) return;
    setResettingDemo(true);
    try {
      const json = await apiFetch('/api/system/reset-demo', { method: 'POST', timeoutMs: 55000 });
      if (!json.success) throw new Error(json.message || 'Reset failed');
      clearNotifications();
      triggerDemoResetRefresh();
      showCustomToast(t('✨ Đã khôi phục dữ liệu thuyết trình mặc định!', '✨ Demo data restored to clean state!'));
    } catch (err) {
      showCustomToast(`❌ Reset error: ${err.message}`);
    } finally {
      setResettingDemo(false);
    }
  };

  const navItems = [
    { id: 'guest', label: t('Phòng 3D & Voice AI', '3D Room & Voice AI'), icon: Cpu },
    { id: 'matrix', label: t('Sơ Đồ Phòng (D&D)', 'Room Matrix'), icon: LayoutGrid },
    { id: 'ocr', label: t('Check-In CCCD & C06', 'AI CCCD & C06'), icon: Scan },
    { id: 'admin', label: t('AI Yield & Doanh Thu', 'AI Yield & Analytics'), icon: TrendingUp },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0B0F19] text-white' : 'bg-slate-100 text-slate-900'} selection:bg-cyan-500 selection:text-black`}>
      <header className={`border-b backdrop-blur-xl sticky top-0 z-40 transition-colors ${isDark ? 'border-white/10 bg-[#1A1F2C]/75' : 'border-slate-200 bg-white/85'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReturnHome}
            className="flex items-center gap-3 shrink-0 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-0.5 shadow-neon-cyan">
              <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center font-black text-cyan-400 text-sm">
                NX
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold tracking-tight text-lg">NexStay</span>
              <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-cyan-500/20 text-amber-400 border border-amber-400/40 font-mono inline-flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" /> SIÊU VIP
              </span>
            </div>
          </button>

          <nav aria-label="Primary" className={`hidden lg:flex items-center p-1 rounded-xl border text-xs ${isDark ? 'bg-[#0B0F19]/80 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = !isPaymentRoute && activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (isPaymentRoute) handleReturnHome();
                    setActiveTab(item.id);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-950 font-bold shadow-neon-cyan'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* Subtle One-Click Reset Demo Data Button */}
            <button
              type="button"
              onClick={handleResetDemoData}
              disabled={resettingDemo}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:border-rose-400/50 text-slate-300 hover:text-rose-300'
                  : 'bg-white border-slate-300 hover:border-rose-500 text-slate-700 hover:text-rose-600'
              }`}
              title={t('Khôi phục dữ liệu mẫu thuyết trình', 'Restore default presentation demo data')}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resettingDemo ? 'animate-spin text-rose-400' : ''}`} />
              <span className="hidden xl:inline">{t('Khôi Phục Demo', 'Reset Demo Data')}</span>
            </button>

            <button
              onClick={toggleLang}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                isDark ? 'bg-white/5 border-white/10 hover:border-cyan-400/50 text-cyan-300' : 'bg-white border-slate-300 text-slate-800'
              }`}
              title="Switch Language (VI / EN)"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{lang.toUpperCase()}</span>
            </button>

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all ${
                isDark ? 'bg-white/5 border-white/10 hover:border-amber-400/50 text-amber-300' : 'bg-white border-slate-300 text-slate-700'
              }`}
              title="Toggle Dark / Light Mode"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative" ref={notifContainerRef}>
              <button
                onClick={() => setShowNotifPanel((v) => !v)}
                className={`p-2 rounded-xl border transition-all relative ${
                  isDark ? 'bg-white/5 border-white/10 hover:border-cyan-400/50 text-white' : 'bg-white border-slate-300 text-slate-800'
                }`}
                title="Live Notification Hub"
              >
                <Bell className="w-4 h-4 text-cyan-400" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 rounded-2xl border p-4 shadow-2xl z-50 backdrop-blur-2xl ${
                      isDark ? 'bg-[#141925]/95 border-cyan-400/30 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className={`flex items-center justify-between pb-2 mb-2 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        {t('Trung Tâm Cảnh Báo Live', 'Real-Time Notification Hub')}
                      </span>
                      <button onClick={clearNotifications} className="text-[10px] text-slate-400 hover:text-cyan-400">
                        {t('Xóa hết', 'Clear')}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">{t('Chưa có thông báo mới', 'No live alerts yet')}</p>
                      ) : (
                        notifications.map((n, i) => (
                          <div key={n.id || i} className={`p-2.5 rounded-xl border text-[11px] ${isDark ? 'bg-[#0B0F19]/80 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="font-medium">{n.message}</p>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {formatSafeTime(n.timestamp)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="lg:hidden flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = !isPaymentRoute && activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isPaymentRoute) handleReturnHome();
                  setActiveTab(item.id);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-950 font-bold'
                    : isDark
                    ? 'bg-white/5 text-slate-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Render Free Tier Cold-Start / Backend Connectivity Banner */}
      <AnimatePresence>
        {(isWakingUp || serverStatus === 'offline') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`border-b px-4 py-2.5 text-xs ${
              serverStatus === 'offline' && !isWakingUp
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-amber-500/15 border-amber-400/30 text-amber-300'
            }`}
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isWakingUp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                )}
                <span>
                  {isWakingUp
                    ? t(
                        `Đang đánh thức máy chủ Render Free Tier (~30–50s cho lần truy cập đầu)... ${wakeElapsedSec > 0 ? `(${wakeElapsedSec}s)` : ''}`,
                        `Waking up Render Free Tier backend (~30–50s on cold start)... ${wakeElapsedSec > 0 ? `(${wakeElapsedSec}s)` : ''}`
                      )
                    : t(
                        'Chưa kết nối được máy chủ backend. Máy chủ có thể đang khởi động lại.',
                        'Unable to reach backend server. It may still be starting up.'
                      )}
                </span>
              </div>

              {serverStatus === 'offline' && !isWakingUp && (
                <button
                  type="button"
                  onClick={retryConnection}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" />
                  {t('Thử kết nối lại', 'Retry Connection')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="py-4 pb-24">
        {isPaymentRoute ? (
          <PaymentCallbackView pathname={pathname} onReturnHome={handleReturnHome} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <Suspense fallback={<ModuleLoadingFallback title={t('Đang nạp phân hệ...', 'Loading Module...')} />}>
                {activeTab === 'guest' && <GuestSmartRoomVIP />}
                {activeTab === 'matrix' && <InteractiveRoomMatrix />}
                {activeTab === 'ocr' && <ExpressCheckInOCR />}
                {activeTab === 'admin' && <AdminSuperVIPDashboard />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <AnimatePresence>
        {liveToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-20 left-1/2 z-50 max-w-md w-[90%] px-4 py-3 rounded-2xl bg-[#141925]/95 border border-cyan-400/50 text-cyan-200 text-xs font-semibold shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <span>{liveToast.message}</span>
            </div>
            <button onClick={dismissToast} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AIConciergeFloating />
      <PWAInstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NexStayShell />
    </AppProvider>
  );
}
