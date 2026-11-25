import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  CalendarPlus,
  User,
  Phone,
  CreditCard,
  Crown,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  BedDouble,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/useApp';
import { apiFetch, apiUrl } from '../../utils/api';

function getDefaultDates() {
  const now = Date.now();
  return {
    checkIn: new Date(now).toISOString().split('T')[0],
    checkOut: new Date(now + 2 * 86400000).toISOString().split('T')[0],
  };
}

export default function NewBookingModal({ isOpen, onClose, rooms = [], onBookingCreated, defaultSource = 'ONLINE' }) {
  const { theme, t } = useApp();
  const isDark = theme === 'dark';

  const availableRooms = useMemo(() => {
    const avail = rooms.filter((r) => r.status === 'AVAILABLE');
    return avail.length > 0 ? avail : rooms;
  }, [rooms]);

  const [bookingSourceOverride, setBookingSourceOverride] = useState(null);
  const bookingSource = bookingSourceOverride ?? defaultSource;
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [checkIn, setCheckIn] = useState(() => getDefaultDates().checkIn);
  const [checkOut, setCheckOut] = useState(() => getDefaultDates().checkOut);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestIdNumber, setGuestIdNumber] = useState('');
  const [guestNationality, setGuestNationality] = useState('Việt Nam');
  const [isVip, setIsVip] = useState(true);
  const [autoSyncPolice, setAutoSyncPolice] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('VIETQR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdResult, setCreatedResult] = useState(null);

  const activeRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || availableRooms[0] || null;
  }, [rooms, availableRooms, selectedRoomId]);

  const nights = useMemo(() => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diff / 86400000) || 1);
  }, [checkIn, checkOut]);

  const unitRate = Number(activeRoom?.pricePerNight || 0);
  const totalEstimateUSD = Math.round(unitRate * nights);
  const totalEstimateVND = Math.round(totalEstimateUSD * 25400);

  const handleCheckInChange = (val) => {
    setCheckIn(val);
    if (val && checkOut && val >= checkOut) {
      const nextDay = new Date(new Date(val).getTime() + 86400000);
      if (!Number.isNaN(nextDay.getTime())) {
        setCheckOut(nextDay.toISOString().split('T')[0]);
      }
    }
  };

  const handleCheckOutChange = (val) => {
    setCheckOut(val);
    if (val && checkIn && val < checkIn) {
      setCheckIn(val);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeRoom) return;
    setSubmitting(true);
    setError('');

    try {
      const json = await apiFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: activeRoom.id,
          roomNumber: activeRoom.number,
          checkIn,
          checkOut,
          guestName,
          guestPhone,
          guestIdNumber,
          guestNationality,
          bookingSource,
          isVip,
          autoSyncPolice,
          paymentMethod,
        }),
      });
      if (!json.success) {
        throw new Error(json.message || 'Booking failed.');
      }
      setCreatedResult(json);
      if (onBookingCreated) onBookingCreated(json.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedResult(null);
    setError('');
    setSelectedRoomId('');
    setBookingSourceOverride(null);
    setGuestName('');
    setGuestPhone('');
    setGuestIdNumber('');
    onClose();
  };

  const inputClass = isDark
    ? 'bg-[#0B0F19]/80 border-white/10 text-white placeholder-slate-500 focus:border-cyan-400'
    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-600';

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          className={`w-full max-w-2xl rounded-3xl border p-5 sm:p-6 md:p-7 shadow-2xl relative my-auto ${
            isDark ? 'bg-[#141925] border-cyan-400/35 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-5 pr-8">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 shrink-0">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-2">
                {t('Đặt Phòng Thông Minh (Online & Tại Quầy)', 'Smart Reservation & Walk-In')}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 font-mono">
                  AI Yield Pricing
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {t('Tự động tính giá theo hệ số AI Yield hiện tại & đồng bộ tức thì Sơ đồ phòng.', 'Calculates rate using live AI Yield pricing and syncs Room Matrix & Revenue.')}
              </p>
            </div>
          </div>

          {createdResult ? (
            <div className="py-5 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-emerald-400">
                  {t('Đặt Phòng Thành Công!', 'Reservation Confirmed!')}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {t('Khách', 'Guest')}: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{createdResult.booking?.guestName || guestName}</strong> ➜ P.{createdResult.booking?.room?.number || activeRoom?.number || 'N/A'} ({createdResult.nights || nights} {t('đêm', 'nights')})
                </p>
              </div>
              <div className="inline-block p-3 rounded-2xl bg-white shadow-xl">
                <QRCodeSVG value={createdResult.digitalKey || 'NEX-KEY-LIVE'} size={108} />
              </div>
              <div className="text-xs font-mono text-cyan-400 break-all">Digital Key: {createdResult.digitalKey || 'NEX-KEY-LIVE'}</div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {createdResult.booking?.id && (
                  <a
                    href={apiUrl(`/api/invoice/${createdResult.booking.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-950 font-bold text-xs shadow-neon-cyan"
                  >
                    <Download className="w-4 h-4" />
                    {t('Xem Phiếu & Hóa Đơn PDF', 'Download PDF Invoice')}
                  </a>
                )}
                <button
                  onClick={handleClose}
                  className={`px-5 py-2.5 rounded-xl border text-xs font-semibold ${isDark ? 'border-white/15 bg-white/5 text-white' : 'border-slate-300 bg-slate-100 text-slate-800'}`}
                >
                  {t('Đóng', 'Close')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Source Switch */}
              <div className={`flex p-1 rounded-xl border text-xs ${isDark ? 'bg-[#0B0F19] border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setBookingSourceOverride('ONLINE')}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${bookingSource === 'ONLINE' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
                >
                  🌐 {t('Đặt Phòng Trực Tuyến (Online)', 'Online Reservation')}
                </button>
                <button
                  type="button"
                  onClick={() => setBookingSourceOverride('WALK_IN')}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${bookingSource === 'WALK_IN' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
                >
                  🛎️ {t('Khách Lẻ Tại Quầy (Walk-in)', 'Front Desk Walk-in')}
                </button>
              </div>

              {/* Dates & Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('Ngày nhận phòng (Check-in)', 'Check-in Date')}</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('Ngày trả phòng (Check-out)', 'Check-out Date')}</label>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => handleCheckOutChange(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                  />
                </div>
              </div>

              {/* Visual Room Selection */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <BedDouble className="w-3.5 h-3.5 text-cyan-400" />
                  {t('Chọn Phòng (Giá hiển thị đã bao gồm AI Yield)', 'Select Suite (Live AI Yield Rate)')}
                </label>
                {rooms.length === 0 ? (
                  <div className={`p-3 rounded-xl border text-xs text-slate-400 ${isDark ? 'border-white/10 bg-[#0B0F19]/50' : 'border-slate-200 bg-slate-50'}`}>
                    {t('Đang tải danh sách phòng từ máy chủ...', 'Loading suites from server...')}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {rooms.map((r) => {
                      const isSelected = activeRoom?.id === r.id;
                      const isAvail = r.status === 'AVAILABLE';
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRoomId(r.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-500/15 shadow-neon-cyan'
                              : isDark
                              ? 'border-white/10 bg-[#0B0F19]/60 hover:border-white/25'
                              : 'border-slate-200 bg-slate-50 hover:border-cyan-500'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>P.{r.number}</span>
                            <span className={`text-[9px] px-1.5 rounded ${isAvail ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                              {r.status === 'AVAILABLE' ? t('Trống', 'Open') : r.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{r.type}</div>
                          <div className="text-xs font-mono font-bold text-cyan-400 mt-1">
                            ${Number(r.pricePerNight || 0)}/nt
                            {Number(r.yieldMultiplier || 1) > 1 && (
                              <span className="text-[9px] text-amber-400 ml-1">x{Number(r.yieldMultiplier).toFixed(2)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Guest Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-cyan-400" /> {t('Tên Khách Hàng', 'Guest Full Name')} *
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Lê Minh Tuấn"
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-cyan-400" /> {t('Số Điện Thoại', 'Phone Number')}
                  </label>
                  <input
                    type="text"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="0909 123 456"
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-cyan-400" /> {t('CCCD / Hộ Chiếu (để khai báo C06)', 'CCCD / Passport No.')}
                  </label>
                  <input
                    type="text"
                    value={guestIdNumber}
                    onChange={(e) => setGuestIdNumber(e.target.value)}
                    placeholder="079094001122"
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('Quốc Tịch', 'Nationality')}</label>
                  <input
                    type="text"
                    value={guestNationality}
                    onChange={(e) => setGuestNationality(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} className="accent-amber-400" />
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('Khách VIP Ưu Tiên', 'VIP Priority Guest')}</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={autoSyncPolice} onChange={(e) => setAutoSyncPolice(e.target.checked)} className="accent-emerald-400" />
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('Đồng bộ Khai báo C06 nếu có CCCD', 'Auto-sync C06 if ID provided')}</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs outline-none ${inputClass}`}
                >
                  <option value="VIETQR">VietQR Napas 24/7</option>
                  <option value="VNPAY">VNPay Sandbox</option>
                </select>
              </div>

              {/* Pricing Summary Banner */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-[#0B0F19] border-cyan-400/30' : 'bg-cyan-50 border-cyan-200'}`}>
                <div className="text-xs">
                  <span className="text-slate-400">{t('Tạm tính AI Yield', 'AI Yield Total')}: </span>
                  <span className="font-mono font-bold">
                    ${unitRate} × {nights} {t('đêm', 'nights')}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-lg font-black text-cyan-400">${totalEstimateUSD}</div>
                  <div className="text-[10px] text-slate-400">≈ {totalEstimateVND.toLocaleString('vi-VN')} ₫</div>
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !activeRoom}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-violet-600 hover:from-cyan-300 hover:to-violet-500 text-slate-950 font-bold text-sm shadow-neon-cyan flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {submitting ? t('Đang tạo đặt phòng...', 'Creating Reservation...') : t('Xác Nhận Đặt Phòng & Cấp Khóa Số', 'Confirm Booking & Mint Digital Key')}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
