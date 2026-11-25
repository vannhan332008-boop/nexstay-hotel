import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Sparkles,
  ShieldCheck,
  DollarSign,
  BedDouble,
  Bot,
  Activity,
  Download,
  FileCode2,
  Zap,
  RefreshCw,
  Crown,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/useApp';
import { apiFetch, apiUrl } from '../../utils/api';

function formatTimeSafe(ts) {
  if (!ts) return '--:--';
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminSuperVIPDashboard() {
  const { theme, t, onSocketEvent, showCustomToast, serverStatus, subscribeDemoReset } = useApp();
  const isDark = theme === 'dark';

  const [data, setData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [applyingYield, setApplyingYield] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState(null);
  const [busyRoomId, setBusyRoomId] = useState(null);
  const refreshTimerRef = useRef(null);
  const prevServerStatusRef = useRef(serverStatus);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [sumJson, bookJson] = await Promise.all([
        apiFetch('/api/analytics/summary'),
        apiFetch('/api/bookings'),
      ]);
      setLoadError('');
      if (sumJson.success) setData(sumJson);
      if (bookJson.success && Array.isArray(bookJson.data)) setBookings(bookJson.data);
    } catch (err) {
      setLoadError(err.message || 'Failed loading admin analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleFetchAll = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      fetchAll();
    }, 120);
  }, [fetchAll]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const [sumJson, bookJson] = await Promise.all([
          apiFetch('/api/analytics/summary'),
          apiFetch('/api/bookings'),
        ]);
        if (!active) return;
        setLoadError('');
        if (sumJson.success) setData(sumJson);
        if (bookJson.success && Array.isArray(bookJson.data)) setBookings(bookJson.data);
      } catch (err) {
        if (active) setLoadError(err.message || 'Failed loading admin analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    init();

    const unsubs = [
      onSocketEvent('room:status_updated', scheduleFetchAll),
      onSocketEvent('housekeeping:updated', scheduleFetchAll),
      onSocketEvent('iot:action', scheduleFetchAll),
      onSocketEvent('payment:confirmed', scheduleFetchAll),
      onSocketEvent('folio:updated', scheduleFetchAll),
      onSocketEvent('booking:created', scheduleFetchAll),
      onSocketEvent('rooms:yield_updated', scheduleFetchAll),
      onSocketEvent('system:demo_reset', scheduleFetchAll),
      subscribeDemoReset(fetchAll),
    ];

    return () => {
      active = false;
      unsubs.forEach((unsub) => unsub());
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [onSocketEvent, subscribeDemoReset, fetchAll, scheduleFetchAll]);

  useEffect(() => {
    const prev = prevServerStatusRef.current;
    prevServerStatusRef.current = serverStatus;
    if (prev !== 'online' && serverStatus === 'online' && loadError) {
      Promise.resolve().then(fetchAll);
    }
  }, [serverStatus, loadError, fetchAll]);

  const handleApplyYield = async (multiplier, reset = false) => {
    setApplyingYield(true);
    try {
      const json = await apiFetch('/api/analytics/apply-yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier, reset }),
      });
      if (!json.success) throw new Error(json.message || 'Apply yield failed');
      await fetchAll();
      showCustomToast(
        reset
          ? t('💰 Đã khôi phục bảng giá phòng gốc.', '💰 Base room rates restored.')
          : t(`🚀 Đã áp dụng giá động AI Yield x${Number(multiplier).toFixed(2)}!`, `🚀 Applied AI Yield x${Number(multiplier).toFixed(2)}!`)
      );
    } catch (err) {
      showCustomToast(`❌ ${err.message}`);
    } finally {
      setApplyingYield(false);
    }
  };

  const handleCompleteCleaning = async (roomId) => {
    setBusyRoomId(roomId);
    try {
      const json = await apiFetch(`/api/rooms/${roomId}/complete-cleaning`, { method: 'POST' });
      if (!json.success) throw new Error(json.message || 'Complete cleaning failed');
      await fetchAll();
    } catch (err) {
      showCustomToast(`❌ ${err.message}`);
    } finally {
      setBusyRoomId(null);
    }
  };

  const handleSyncPolice = async (bookingId) => {
    setBusyBookingId(bookingId);
    try {
      const json = await apiFetch(`/api/bookings/${bookingId}/sync-police`, { method: 'POST' });
      if (!json.success) throw new Error(json.message || 'Sync C06 failed');
      await fetchAll();
      showCustomToast(t(`✓ Đã đồng bộ C06: ${json.declarationCode || 'SYNCED'}`, `✓ C06 Synced: ${json.declarationCode || 'SYNCED'}`));
    } catch (err) {
      showCustomToast(`❌ ${err.message}`);
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleSimulateVietQR = async (bookingId) => {
    setBusyBookingId(bookingId);
    try {
      const json = await apiFetch(`/api/bookings/${bookingId}/simulate-vietqr`, { method: 'POST' });
      if (!json.success) throw new Error(json.message || 'Simulate VietQR failed');
      await fetchAll();
    } catch (err) {
      showCustomToast(`❌ ${err.message}`);
    } finally {
      setBusyBookingId(null);
    }
  };

  const cardClass = isDark
    ? 'bg-[#1A1F2C]/85 border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900 shadow-lg';

  if (loading && !data) {
    return (
      <div className="w-full max-w-7xl mx-auto p-10 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-cyan-400 mx-auto" />
        <p className="text-cyan-400 font-mono text-sm">
          {t('Đang đồng bộ dữ liệu AI Yield & Doanh Thu...', 'Synchronizing AI Yield & Revenue Intelligence...')}
        </p>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 my-8 rounded-3xl border border-rose-500/30 bg-rose-500/10 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-base font-bold text-rose-300">
            {t('Chưa thể tải bảng điều khiển Admin', 'Could Not Load Executive Dashboard')}
          </h3>
          <p className="text-xs text-slate-300">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-bold text-rose-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('Thử lại ngay', 'Retry Now')}
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const yieldEngine = data?.yieldEngine || {};
  const charts = data?.charts || {};
  const recommendations = Array.isArray(yieldEngine.recommendations) ? yieldEngine.recommendations : [];
  const revenueTimeline = Array.isArray(charts.revenueTimeline) ? charts.revenueTimeline : [];
  const occupancyPie = Array.isArray(charts.occupancyPie) ? charts.occupancyPie : [];
  const aiUsageChart = Array.isArray(charts.aiUsageChart) ? charts.aiUsageChart : [];
  const housekeepingQueue = Array.isArray(data?.housekeepingQueue) ? data.housekeepingQueue : [];
  const recentTelemetry = Array.isArray(data?.recentTelemetry) ? data.recentTelemetry : [];

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-violet-500/15 border border-violet-400/30 text-violet-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('Trung Tâm Điều Hành AI Yield, Doanh Thu & Lưu Trú C06', 'Executive AI Yield, Analytics & C06 Compliance')}
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {t('Phân tích RevPAR, định giá phòng tự động theo nhu cầu, điều phối buồng phòng VIP & cổng khai báo Công An.', 'Live RevPAR intelligence, dynamic pricing autopilot, VIP housekeeping & Vietnam Police C06 portal.')}
          </p>
        </div>

        <button
          onClick={fetchAll}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all self-start md:self-auto ${cardClass}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          {t('Làm Mới Dữ Liệu', 'Refresh Live')}
        </button>
      </div>

      {loadError && (
        <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={fetchAll} className="px-3 py-1 rounded-lg bg-rose-500/20 font-semibold">
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl border p-5 ${cardClass}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>{t('Doanh Thu Đã Thu', 'Settled Revenue')}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            ${Number(kpis.totalRevenueUSD || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            ≈ {Number(kpis.totalRevenueVND || 0).toLocaleString('vi-VN')} ₫
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${cardClass}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>{t('Tỷ Lệ Lấp Đầy & RevPAR', 'Occupancy & RevPAR')}</span>
            <BedDouble className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-400">
            {Number(kpis.occupancyRate || 0)}% <span className="text-sm text-slate-400 font-normal">| ${Number(kpis.revPAR || 0)} RevPAR</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            ADR: <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>${Number(kpis.adr || 0)}/đêm</span> ({kpis.statusCounts?.OCCUPIED ?? 0}/{kpis.totalRooms ?? 0} phòng)
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${cardClass}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>{t('Đồng Bộ Lưu Trú C06', 'Police C06 Compliance')}</span>
            <ShieldCheck className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-black font-mono text-violet-400">
            {kpis.policeSyncedCount ?? 0}/{kpis.totalBookings ?? 0} <span className="text-xs font-normal text-slate-400">{t('Hồ sơ', 'Records')}</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            {t('Chuẩn XML Cổng Dịch Vụ Công', 'VNeID / XML Export Ready')}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${cardClass}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>{t('Tương Tác AI & Voice IoT', 'AI Concierge & Voice IoT')}</span>
            <Bot className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {kpis.aiInteractionsCount ?? 0} <span className="text-xs font-normal text-slate-400">events</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {t('Tự động xử lý không cần lễ tân', 'Zero-touch guest automation')}
          </div>
        </div>
      </div>

      <div className={`rounded-3xl border p-6 relative overflow-hidden ${cardClass} border-cyan-400/30`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 text-[11px] font-bold">
                AI YIELD AUTOPILOT
              </span>
              <span className="text-xs text-emerald-400 font-mono">
                {t(`Đề xuất Surge: +${yieldEngine.surgePercent ?? 0}%`, `Recommended Surge: +${yieldEngine.surgePercent ?? 0}%`)}
              </span>
            </div>
            <h2 className="text-lg font-bold mt-1">
              {t('Hệ Thống Định Giá Phòng Động AI (Dynamic Revenue Management)', 'AI Dynamic Yield Pricing Engine')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t(yieldEngine.reasonVi || '', yieldEngine.reasonEn || '')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleApplyYield(yieldEngine.recommendedMultiplier || 1.15, false)}
              disabled={applyingYield}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-950 font-bold text-xs shadow-neon-cyan hover:scale-105 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {t(`Áp Dụng Giá AI (+${yieldEngine.surgePercent ?? 0}%)`, `Apply AI Yield (+${yieldEngine.surgePercent ?? 0}%)`)}
            </button>
            <button
              onClick={() => handleApplyYield(1.0, true)}
              disabled={applyingYield}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 ${isDark ? 'border-white/15 hover:bg-white/10 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('Reset Giá Gốc', 'Reset Base')}
            </button>
          </div>
        </div>

        {recommendations.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">{t('Chưa có dữ liệu phòng để đề xuất giá.', 'No room inventory available for yield pricing.')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recommendations.slice(0, 4).map((rec) => {
              const delta = Number(rec.deltaPercent || 0);
              return (
                <div key={rec.roomId || rec.number} className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0B0F19]/60 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span>P.{rec.number || '--'} • {(rec.type || 'Suite').split(' ')[0]}</span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      {delta > 0 ? `+${delta}%` : `${delta}%`}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-xs text-slate-400 line-through">${Number(rec.basePrice || 0)}</span>
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>${Number(rec.currentPrice || 0)}</span>
                    <span className="text-sm text-emerald-400 font-bold">➜ ${Number(rec.suggestedPrice || 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-5 min-w-0 rounded-3xl border p-6 ${cardClass}`}>
          <h3 className="text-sm font-bold mb-1">{t('Biểu Đồ Doanh Thu & Dự Báo AI (USD)', 'Revenue Timeline & AI Forecast')}</h3>
          <p className="text-[11px] text-slate-400 mb-4">{t('Thực thu tuần vs Đường dự báo định giá động', 'Actual revenue vs AI dynamic forecast')}</p>
          <div className="h-60 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
              <AreaChart data={revenueTimeline}>
                <defs>
                  <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F3FF" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#00F3FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#00F3FF', borderRadius: '12px', fontSize: '12px', color: '#fff' }} />
                <Area type="monotone" dataKey="actual" stroke="#00F3FF" strokeWidth={2.5} fill="url(#cyanGrad)" name="Actual ($)" />
                <Area type="monotone" dataKey="forecast" stroke="#8A2BE2" strokeWidth={2} strokeDasharray="4 4" fill="transparent" name="AI Forecast ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`lg:col-span-3 min-w-0 rounded-3xl border p-6 ${cardClass}`}>
          <h3 className="text-sm font-bold mb-1">{t('Cơ Cấu Trạng Thái Phòng', 'Room Status Split')}</h3>
          <p className="text-[11px] text-slate-400 mb-2">{t('Phân bổ theo thời gian thực', 'Live hotel inventory')}</p>
          <div className="h-48 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160}>
              <PieChart>
                <Pie data={occupancyPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={4}>
                  {occupancyPie.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color || '#00F3FF'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            {occupancyPie.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color || '#00F3FF' }} />
                <span className="truncate text-slate-400">{item.name}: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{item.value ?? 0}</strong></span>
              </div>
            ))}
          </div>
        </div>

        <div className={`lg:col-span-4 min-w-0 rounded-3xl border p-6 ${cardClass}`}>
          <h3 className="text-sm font-bold mb-1">{t('Hiệu Suất Trợ Lý AI & Voice IoT', 'AI Concierge & Voice Queries')}</h3>
          <p className="text-[11px] text-slate-400 mb-4">{t('Số lượt AI phục vụ khách trong tuần', 'Automated queries handled this week')}</p>
          <div className="h-60 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
              <BarChart data={aiUsageChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="metric" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#8A2BE2', borderRadius: '12px', fontSize: '12px', color: '#fff' }} />
                <Bar dataKey="queries" fill="#8A2BE2" radius={[6, 6, 0, 0]} name="AI Concierge" />
                <Bar dataKey="voice" fill="#00F3FF" radius={[6, 6, 0, 0]} name="Voice IoT" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-7 rounded-3xl border p-6 ${cardClass}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                {t('Quản Lý Khai Báo Lưu Trú (C06) & Hóa Đơn Điện Tử', 'Vietnam C06 Residence Compliance & Billing')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('Đồng bộ dữ liệu CCCD/Passport lên Công An & xuất hóa đơn PDF có đủ mục POS + dấu PAID.', 'Sync CCCD/Passport to Police Portal, export XML & issue itemized PDF invoices.')}
              </p>
            </div>
          </div>

          {bookings.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              {t('Chưa có hồ sơ đặt phòng nào trong hệ thống.', 'No bookings recorded yet.')}
            </p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const totalAmt = Number(b.totalAmount || 0);
                const posCount = Array.isArray(b.charges) ? b.charges.length : 0;
                const isBusy = busyBookingId === b.id;
                return (
                  <div key={b.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'bg-[#0B0F19]/65 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-cyan-400/15 text-cyan-400 font-mono text-xs font-bold">
                          P.{b.room?.number || 'N/A'}
                        </span>
                        <span className="font-bold text-sm truncate">{b.guestName || b.user?.name || 'Guest'}</span>
                        {b.isVip && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1">
                            <Crown className="w-3 h-3" /> VIP
                          </span>
                        )}
                        {posCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-400/30 text-[10px] font-mono">
                            +{posCount} POS
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono break-words">
                        ID/CCCD: {b.guestIdNumber || 'Verified'} • ${Number(totalAmt.toFixed(2))} ({Math.round(totalAmt * 25400).toLocaleString('vi-VN')}₫)
                      </div>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          b.policeSyncStatus === 'SYNCED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                        }`}>
                          {b.policeSyncStatus === 'SYNCED' ? `✓ C06: ${b.policeDeclarationId || 'VERIFIED'}` : '⏳ Chưa khai báo C06'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          b.paymentStatus === 'COMPLETED'
                            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-400/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-400/30'
                        }`}>
                          {b.paymentStatus || 'PENDING'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {b.policeSyncStatus !== 'SYNCED' && (
                        <button
                          onClick={() => handleSyncPolice(b.id)}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] disabled:opacity-50"
                        >
                          {isBusy ? '...' : t('Đồng Bộ C06', 'Sync C06')}
                        </button>
                      )}
                      <a
                        href={apiUrl(`/api/bookings/${b.id}/police-xml`)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold ${isDark ? 'bg-white/5 hover:bg-white/15 border-white/10' : 'bg-white hover:bg-slate-100 border-slate-300'}`}
                        title="Export XML"
                      >
                        <FileCode2 className="w-3.5 h-3.5 text-emerald-400" /> XML
                      </a>
                      {b.paymentStatus !== 'COMPLETED' && (
                        <button
                          onClick={() => handleSimulateVietQR(b.id)}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 text-[11px] font-bold disabled:opacity-50"
                        >
                          {isBusy ? '...' : t('Thu VietQR', 'Pay VietQR')}
                        </button>
                      )}
                      <a
                        href={apiUrl(`/api/invoice/${b.id}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-400 text-[11px] font-bold"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className={`rounded-3xl border p-6 ${cardClass}`}>
            <h3 className="text-base font-bold flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {t('Điều Phối Buồng Phòng Thông Minh (AI Score)', 'AI Housekeeping VIP Priority')}
            </h3>
            <div className="space-y-2.5">
              {housekeepingQueue.length === 0 ? (
                <p className="text-xs text-emerald-400 py-4 text-center">✓ {t('Tất cả các phòng đều đã sạch sẽ!', 'All suites spotless & ready!')}</p>
              ) : (
                housekeepingQueue.map((item) => (
                  <div key={item.roomId} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isDark ? 'bg-[#0B0F19]/65 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                        <span className="text-cyan-400 font-mono">P.{item.roomNumber}</span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[9px] font-mono">
                          SCORE {item.priorityScore ?? 0} • {item.tier}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.reason}</p>
                    </div>
                    <button
                      onClick={() => handleCompleteCleaning(item.roomId)}
                      disabled={busyRoomId === item.roomId}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-400 text-[11px] font-bold disabled:opacity-50"
                    >
                      {busyRoomId === item.roomId ? '...' : `✓ ${t('Hoàn tất dọn phòng', 'Complete')}`}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`rounded-3xl border p-6 ${cardClass}`}>
            <h3 className="text-base font-bold flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              {t('Nhật Ký IoT & Voice AI Thời Gian Thực', 'Live IoT & Voice Telemetry')}
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
              {recentTelemetry.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">{t('Chưa có nhật ký IoT nào.', 'No IoT telemetry events yet.')}</p>
              ) : (
                recentTelemetry.map((log, idx) => (
                  <div key={log.id || idx} className="text-[11px] flex items-center justify-between py-1.5 border-b border-slate-500/15 last:border-0">
                    <div className="truncate pr-2">
                      <span className="font-mono font-bold text-cyan-400 mr-1.5">P.{log.room?.number || 'N/A'}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-[9px] font-mono mr-1.5">{log.source}</span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{log.device}: {log.value ?? ''}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {formatTimeSafe(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
