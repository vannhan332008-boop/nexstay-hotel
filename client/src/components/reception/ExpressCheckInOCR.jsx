import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Scan,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
  User,
  Calendar,
  CreditCard,
  MapPin,
  Key,
  RotateCcw,
  ShieldCheck,
  Zap,
  Flag,
  Download,
  FileCode2,
} from 'lucide-react';
import { useApp } from '../../context/useApp';

export default function ExpressCheckInOCR() {
  const { theme, t } = useApp();
  const isDark = theme === 'dark';

  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkInReceipt, setCheckInReceipt] = useState(null);
  const [rooms, setRooms] = useState([]);

  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    idNumber: '',
    address: '',
    nationality: 'Việt Nam',
    gender: 'FEMALE',
    roomNumber: '301',
    nights: 2,
    isVip: true,
    autoSyncPolice: true,
  });

  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((j) => {
        if (active && j.success && Array.isArray(j.data) && j.data.length > 0) {
          setRooms(j.data);
          const avail = j.data.find((x) => x.status === 'AVAILABLE') || j.data[0];
          setFormData((p) => ({ ...p, roomNumber: avail.number }));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const scanSteps = [
    t('Phân tích hình học thẻ CCCD / Hộ chiếu...', 'Analyzing document geometry & lighting...'),
    t('Trích xuất mã định danh 12 số & MRZ...', 'Extracting 12-digit CCCD & MRZ fields...'),
    t('Tổng hợp dữ liệu sinh trắc học Gemini Vision AI...', 'Synthesizing biometric parameters via Gemini Vision AI...'),
    t('Sẵn sàng đồng bộ Cổng Khai Báo Lưu Trú C06...', 'Preparing Vietnam C06 Residence Compliance payload...'),
  ];

  const updatePreview = (fileObj) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (fileObj) {
      const url = URL.createObjectURL(fileObj);
      objectUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      objectUrlRef.current = null;
      setPreviewUrl(null);
    }
  };

  const processFile = async (imageFile, docHint = '') => {
    setError(null);
    setCheckInReceipt(null);
    updatePreview(imageFile);
    setIsScanning(true);
    setScanStep(0);

    const stepInterval = setInterval(() => {
      setScanStep((prev) => (prev < scanSteps.length - 1 ? prev + 1 : prev));
    }, 380);

    const uploadData = new FormData();
    uploadData.append('idDocument', imageFile);
    if (docHint) uploadData.append('docHint', docHint);

    try {
      const response = await fetch('/api/checkin/ocr', {
        method: 'POST',
        body: uploadData,
      });
      const result = await response.json();
      clearInterval(stepInterval);

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'OCR extraction failed.');
      }

      setFormData((prev) => ({
        ...prev,
        fullName: result.data.fullName || '',
        dob: result.data.dob || '',
        idNumber: result.data.idNumber || '',
        address: result.data.address || '',
        nationality: result.data.nationality || 'Việt Nam',
        gender: result.data.gender || 'FEMALE',
      }));
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const loadDemoVietnameseCCCD = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 640, 400);
    grad.addColorStop(0, '#E8F3E8');
    grad.addColorStop(0.5, '#F5FBF5');
    grad.addColorStop(1, '#DCECE3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 400);

    ctx.fillStyle = '#B91C1C';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 180, 36);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Độc lập - Tự do - Hạnh phúc', 240, 56);
    ctx.fillStyle = '#B91C1C';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('CĂN CƯỚC CÔNG DÂN', 210, 92);

    ctx.fillStyle = '#D97706';
    ctx.fillRect(42, 110, 54, 42);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 110, 54, 42);

    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(36, 170, 128, 165);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('ẢNH 3x4', 72, 255);

    ctx.fillStyle = '#991B1B';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Số / No: 079196008214', 190, 138);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Họ và tên: NGUYỄN MINH ANH', 190, 178);
    ctx.font = '14px sans-serif';
    ctx.fillText('Ngày sinh: 22/03/1996', 190, 212);
    ctx.fillText('Giới tính: Nữ     Quốc tịch: Việt Nam', 190, 244);
    ctx.fillText('Nơi thường trú: 45 Lê Lợi, P. Bến Thành,', 190, 278);
    ctx.fillText('Quận 1, TP. Hồ Chí Minh', 190, 300);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(540, 24, 74, 74);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(548, 32, 22, 22);
    ctx.fillRect(584, 32, 22, 22);
    ctx.fillRect(548, 68, 22, 22);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const demoFile = new File([blob], 'demo_cccd_vietnam.png', { type: 'image/png' });
      processFile(demoFile, 'CCCD_VN');
    }, 'image/png');
  };

  const loadDemoPassport = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 600, 380);
    grad.addColorStop(0, '#10172A');
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 380);

    ctx.fillStyle = '#00F3FF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('NEXSTAY GLOBAL IDENTIFICATION / PASSPORT', 40, 50);

    ctx.fillStyle = '#334155';
    ctx.fillRect(40, 80, 140, 180);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px sans-serif';
    ctx.fillText('BIOMETRIC PHOTO', 50, 175);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('NAME: SOPHIA ELEANOR CHEN', 210, 110);
    ctx.fillText('DOB: 14 AUG 1994', 210, 145);
    ctx.fillText('SEX: F', 210, 180);
    ctx.fillText('DOC NO: P49201948', 210, 215);
    ctx.fillText('NATIONALITY: USA', 210, 250);

    ctx.fillStyle = '#050B14';
    ctx.fillRect(20, 290, 560, 70);
    ctx.fillStyle = '#00F3FF';
    ctx.font = '14px monospace';
    ctx.fillText('P<USASOPHIA<<ELEANOR<<<<<<<<<<<<<<<<<<<<<<<<<', 30, 320);
    ctx.fillText('P492019485USA9408149F2911181<<<<<<<<<<<<<<04', 30, 345);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const demoFile = new File([blob], 'demo_passport.png', { type: 'image/png' });
      processFile(demoFile, 'PASSPORT');
    }, 'image/png');
  };

  const handleConfirmCheckIn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/express-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Check-in failed');
      setCheckInReceipt(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    updatePreview(null);
    setIsScanning(false);
    setCheckInReceipt(null);
    setError(null);
    setFormData((p) => ({
      ...p,
      fullName: '',
      dob: '',
      idNumber: '',
      address: '',
      nationality: 'Việt Nam',
      gender: 'FEMALE',
    }));
  };

  const surfaceClass = isDark
    ? 'bg-[#1A1F2C] border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900 shadow-lg';

  const inputClass = isDark
    ? 'bg-[#0B0F19]/75 border-white/10 text-white placeholder-slate-500 focus:border-cyan-400'
    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-600';

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight flex flex-wrap items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('Check-In AI CCCD Gắn Chip & Khai Báo C06', 'Express AI OCR & Police C06 Sync')}
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 font-medium">
                Gemini Vision
              </span>
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {t(
              'Quét ảnh CCCD Việt Nam hoặc Hộ chiếu ➜ Tự điền hồ sơ ➜ Cấp Digital Key & Xuất XML Công An C06 trong 3 giây.',
              'Scan Vietnam CCCD or Passport ➜ Auto-populate folio ➜ Issue QR Key & Export Police C06 XML.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadDemoVietnameseCCCD}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/35 hover:to-amber-500/35 text-amber-400 border border-amber-400/40 transition-all"
          >
            <Flag className="w-3.5 h-3.5 text-rose-400" />
            {t('Quét Thử CCCD Việt Nam', 'Demo Vietnam CCCD')}
          </button>
          <button
            onClick={loadDemoPassport}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600/25 to-cyan-500/25 hover:from-violet-600/45 hover:to-cyan-500/45 text-cyan-400 border border-cyan-400/30 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            {t('Quét Thử Hộ Chiếu QT', 'Demo Passport')}
          </button>
          <button
            onClick={handleReset}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${isDark ? 'bg-slate-800/80 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f && f.type.startsWith('image/')) processFile(f);
            }}
            onClick={() => !isScanning && fileInputRef.current?.click()}
            className={`relative min-h-[370px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 cursor-pointer overflow-hidden ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/20 shadow-neon-cyan'
                : previewUrl
                ? 'border-cyan-500/40 bg-[#1A1F2C]'
                : isDark
                ? 'border-white/10 hover:border-cyan-500/50 bg-[#1A1F2C]/60'
                : 'border-slate-300 hover:border-cyan-500 bg-white'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files[0] && processFile(e.target.files[0])}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative w-full h-full min-h-[320px] flex items-center justify-center">
                <img src={previewUrl} alt="Document Preview" className="max-h-[300px] w-auto rounded-xl object-contain shadow-2xl border border-white/10" />

                <AnimatePresence>
                  {isScanning && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-cyan-950/40 backdrop-blur-[2px] rounded-xl flex flex-col justify-between overflow-hidden pointer-events-none"
                    >
                      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_15px_#00f3ff] animate-laser" />
                      <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-slate-900/90 border border-cyan-400/40 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold mb-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                          Gemini Neural OCR Running
                        </div>
                        <p className="text-[11px] text-slate-300 font-mono">{scanSteps[scanStep]}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t('Kéo thả ảnh CCCD hoặc Hộ chiếu vào đây', 'Drop Vietnam CCCD or Passport here')}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP (Max 10MB)</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center gap-1.5">
                  <Scan className="w-3.5 h-3.5 text-cyan-400" />
                  {t('Hỗ trợ nhận diện tiếng Việt có dấu 99.4%', 'Vietnamese diacritics & MRZ supported')}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          <div className={`p-6 md:p-8 rounded-2xl border backdrop-blur-xl relative overflow-hidden ${surfaceClass}`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  {t('Hồ Sơ Lưu Trú & Cấp Khóa Số', 'Guest Registration & Digital Key')}
                </h3>
              </div>

              {formData.fullName && !isScanning && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('Đã trích xuất AI OCR', 'OCR Verified')}
                </span>
              )}
            </div>

            <form onSubmit={handleConfirmCheckIn} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" /> {t('Họ và Tên', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="NGUYỄN MINH ANH"
                    required
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-400" /> {t('Số CCCD (12 số) / Hộ chiếu', 'CCCD / Passport No.')}
                  </label>
                  <input
                    type="text"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    placeholder="079196008214"
                    required
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono uppercase outline-none ${inputClass}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" /> {t('Ngày sinh', 'Date of Birth')}
                  </label>
                  <input
                    type="text"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    placeholder="YYYY-MM-DD"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono outline-none ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t('Quốc tịch', 'Nationality')}</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t('Số đêm lưu trú', 'Nights')}</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.nights}
                    onChange={(e) => setFormData({ ...formData, nights: Math.max(1, Number(e.target.value) || 1) })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono outline-none ${inputClass}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {t('Địa chỉ thường trú', 'Permanent Address')}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="45 Lê Lợi, Quận 1, TP. Hồ Chí Minh"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${inputClass}`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-violet-400" /> {t('Chọn Phòng Bàn Giao', 'Assign Suite')}
                  </label>
                  <select
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${inputClass}`}
                  >
                    {rooms.length > 0 ? (
                      rooms.map((r) => (
                        <option key={r.id} value={r.number}>
                          P.{r.number} - {r.type} (${r.pricePerNight}/nt) [{r.status}]
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="101">P.101 - Cyber Executive Suite ($280/nt)</option>
                        <option value="301">P.301 - Starlight Panoramic Loft ($385/nt)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                  <div>
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      {t('Khai Báo Công An C06', 'Auto Police C06 Sync')}
                    </div>
                    <div className="text-[10px] text-slate-400">{t('Tự động tạo hồ sơ VNeID / XML', 'Instant C06 Compliance Record')}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoSyncPolice}
                    onChange={(e) => setFormData({ ...formData, autoSyncPolice: e.target.checked })}
                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!formData.fullName || isScanning || submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-violet-600 hover:from-cyan-300 hover:to-violet-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-neon-cyan disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {submitting ? t('Đang lưu vào Database...', 'Saving...') : t('Hoàn Tất Check-In, Cấp QR Key & Đồng Bộ C06', 'Confirm Check-In, Mint Key & Sync C06')}
              </button>
            </form>

            <AnimatePresence>
              {checkInReceipt && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 bg-[#0B0F19]/95 backdrop-blur-xl p-6 flex flex-col items-center justify-center text-center z-20 text-white"
                >
                  <div className="p-2.5 rounded-2xl bg-white mb-3 shadow-2xl">
                    <QRCodeSVG value={checkInReceipt.digitalKey} size={96} />
                  </div>
                  <h4 className="text-lg font-bold text-emerald-400 mb-1">
                    {t('Check-In Thành Công & Đã Lưu DB!', 'Guest Checked In & Synced!')}
                  </h4>
                  <p className="text-xs text-slate-300 mb-4 max-w-sm">
                    {t('Phòng', 'Room')} <strong className="text-cyan-400">#{checkInReceipt.booking?.room?.number}</strong> {t('đã chuyển sang OCCUPIED.', 'is now OCCUPIED.')}
                    {checkInReceipt.policeDeclarationId && (
                      <span className="block mt-1 text-emerald-300 font-mono">
                        ✓ C06 Police ID: {checkInReceipt.policeDeclarationId}
                      </span>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5">
                    <a
                      href={`/api/bookings/${checkInReceipt.booking?.id}/police-xml`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30"
                    >
                      <FileCode2 className="w-3.5 h-3.5" />
                      {t('Tải XML Công An C06', 'Download C06 XML')}
                    </a>
                    <a
                      href={`/api/invoice/${checkInReceipt.booking?.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-bold hover:bg-cyan-500/30"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t('Xuất Hóa Đơn PDF', 'Export PDF Invoice')}
                    </a>
                  </div>

                  <button
                    onClick={() => setCheckInReceipt(null)}
                    className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-white/10"
                  >
                    {t('Đóng & Tiếp Tục Đón Khách', 'Done & Next Guest')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
