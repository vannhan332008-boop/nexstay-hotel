import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import {
  DoorClosed,
  User,
  Sparkles,
  Wrench,
  CheckCircle2,
  Search,
  RefreshCw,
  Sliders,
  Radio,
  GripVertical,
  Zap,
  CalendarPlus,
} from 'lucide-react';
import { useApp } from '../../context/useApp';
import NewBookingModal from '../common/NewBookingModal';

const COLUMNS = [
  {
    id: 'AVAILABLE',
    labelVi: 'Sẵn Sàng / Trống',
    labelEn: 'Ready / Available',
    icon: CheckCircle2,
    borderClass: 'border-emerald-500/20 hover:border-emerald-500/40',
    overClass: 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_-5px_rgba(16,185,129,0.35)]',
    headerBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    descVi: 'Đã kiểm tra & sẵn sàng đón khách',
    descEn: 'Inspected & prepared for immediate arrival',
  },
  {
    id: 'OCCUPIED',
    labelVi: 'Đang Lưu Trú',
    labelEn: 'Occupied / In Stay',
    icon: User,
    borderClass: 'border-cyan-500/20 hover:border-cyan-500/40',
    overClass: 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_25px_-5px_rgba(0,243,255,0.4)]',
    headerBadge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    descVi: 'Khách đang ở kèm Digital Key',
    descEn: 'Active checked-in guest with live key access',
  },
  {
    id: 'CLEANING',
    labelVi: 'Đang Dọn Phòng',
    labelEn: 'Housekeeping / Turn',
    icon: Sparkles,
    borderClass: 'border-amber-500/20 hover:border-amber-500/40',
    overClass: 'border-amber-400 bg-amber-500/10 shadow-[0_0_20px_-5px_rgba(245,158,11,0.35)]',
    headerBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    descVi: 'Thay ga, khử khuẩn & bổ sung minibar',
    descEn: 'Linen replacement, sanitization & restock',
  },
  {
    id: 'MAINTENANCE',
    labelVi: 'Bảo Trì Kỹ Thuật',
    labelEn: 'Out of Order / Tech',
    icon: Wrench,
    borderClass: 'border-rose-500/20 hover:border-rose-500/40',
    overClass: 'border-rose-400 bg-rose-500/10 shadow-[0_0_20px_-5px_rgba(244,63,94,0.35)]',
    headerBadge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    descVi: 'Kiểm tra thiết bị IoT hoặc điều hòa',
    descEn: 'Hardware, HVAC inspection, or repair',
  },
];

function DraggableRoomCard({ room, isOverlay = false, isDark = true }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: room.id,
    data: { room },
  });

  const activeBooking = room.bookings?.[0];
  const guestName = activeBooking?.guestName || activeBooking?.user?.name;

  let controls = null;
  try {
    if (room.smartControls) controls = JSON.parse(room.smartControls);
  } catch {
    controls = null;
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative select-none rounded-xl p-4 transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isOverlay
          ? 'bg-[#1E2538] text-white border-2 border-cyan-400 shadow-2xl shadow-cyan-500/40 rotate-1 scale-105 z-50'
          : isDragging
          ? 'opacity-30 border border-dashed border-white/20 bg-white/5'
          : isDark
          ? 'bg-[#1A1F2C]/90 hover:bg-[#22293A] border border-white/10 hover:border-cyan-400/40 hover:shadow-lg text-white'
          : 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-cyan-500/50 shadow-sm text-slate-900'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-lg border font-bold font-mono text-sm transition-colors ${
              isDark
                ? 'bg-white/5 border-white/10 text-white group-hover:border-cyan-400/50 group-hover:text-cyan-400'
                : 'bg-slate-100 border-slate-200 text-slate-900 group-hover:border-cyan-500 group-hover:text-cyan-600'
            }`}
          >
            {room.number}
          </span>
          <div>
            <h4 className="text-xs font-semibold tracking-tight line-clamp-1">{room.type}</h4>
            <span className="text-[10px] text-slate-400">
              Floor {room.floor}
              {Number(room.yieldMultiplier || 1) > 1 ? ` • AI x${Number(room.yieldMultiplier).toFixed(2)}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-mono font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            ${Number(room.pricePerNight || 0)}
            <span className="text-[9px] text-slate-500">/nt</span>
          </span>
          <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {room.status === 'OCCUPIED' && guestName ? (
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
          <div className={`flex items-center gap-1.5 font-medium truncate ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            <User className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="truncate">{guestName}</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 font-mono">
            Active Key
          </span>
        </div>
      ) : (
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
            IoT Telemetry
          </span>
          <span className="font-mono text-slate-400">
            {controls?.acTemp ? `${controls.acTemp}°C` : 'Standby'}
          </span>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column, rooms, isOver, isDark, lang }) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const Icon = column.icon;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border transition-all duration-300 backdrop-blur-xl min-h-[500px] p-4 ${
        isDark ? 'bg-[#141925]/80' : 'bg-slate-50/90 shadow-md'
      } ${isOver ? column.overClass : column.borderClass}`}
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={`p-1.5 rounded-lg border ${column.headerBadge}`}>
            <Icon className="w-4 h-4" />
          </span>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'vi' ? column.labelVi : column.labelEn}
            </h3>
            <p className="text-[10px] text-slate-400 line-clamp-1">
              {lang === 'vi' ? column.descVi : column.descEn}
            </p>
          </div>
        </div>

        <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${column.headerBadge}`}>
          {rooms.length}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
        {rooms.length === 0 ? (
          <div className="h-44 rounded-xl border border-dashed border-slate-500/25 flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <DoorClosed className="w-6 h-6 mb-1.5 opacity-40" />
            <p className="text-xs">{lang === 'vi' ? 'Chưa có phòng ở trạng thái này' : 'No rooms in this state'}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{lang === 'vi' ? 'Kéo thẻ phòng vào đây' : 'Drag a room card here'}</p>
          </div>
        ) : (
          rooms.map((room) => <DraggableRoomCard key={room.id} room={room} isDark={isDark} />)
        )}
      </div>
    </div>
  );
}

export default function InteractiveRoomMatrix() {
  const { theme, lang, t } = useApp();
  const isDark = theme === 'dark';

  const [rooms, setRooms] = useState([]);
  const [housekeepingQueue, setHousekeepingQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [activeDragRoom, setActiveDragRoom] = useState(null);
  const [activeOverId, setActiveOverId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [completingRoomId, setCompletingRoomId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const fetchMatrixAndQueue = useCallback(async () => {
    try {
      setLoading(true);
      const [roomRes, hkRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/rooms/housekeeping/queue'),
      ]);
      const roomData = await roomRes.json();
      const hkData = await hkRes.json();
      if (roomData.success && Array.isArray(roomData.data)) {
        setRooms(roomData.data);
      }
      if (hkData.success && Array.isArray(hkData.data)) {
        setHousekeepingQueue(hkData.data);
      }
    } catch (err) {
      console.error('Failed to load room matrix:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const [roomRes, hkRes] = await Promise.all([
          fetch('/api/rooms'),
          fetch('/api/rooms/housekeeping/queue'),
        ]);
        const roomData = await roomRes.json();
        const hkData = await hkRes.json();
        if (!active) return;
        if (roomData.success && Array.isArray(roomData.data)) setRooms(roomData.data);
        if (hkData.success && Array.isArray(hkData.data)) setHousekeepingQueue(hkData.data);
      } catch (err) {
        console.error('Initial matrix fetch failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    init();

    const socket = io();

    socket.on('room:status_updated', (event) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === event.roomId ? { ...r, status: event.status } : r))
      );
      showToast(`Room #${event.roomNumber} ➜ ${event.status}`);
    });

    socket.on('housekeeping:updated', fetchMatrixAndQueue);
    socket.on('rooms:yield_updated', fetchMatrixAndQueue);
    socket.on('booking:created', fetchMatrixAndQueue);
    socket.on('system:demo_reset', fetchMatrixAndQueue);

    socket.on('iot:action', (event) => {
      if (event.smartControls) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === event.roomId ? { ...r, smartControls: JSON.stringify(event.smartControls) } : r
          )
        );
      }
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [fetchMatrixAndQueue, showToast]);

  const handleCompleteCleaning = async (roomId, roomNumber) => {
    setCompletingRoomId(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/complete-cleaning`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Complete cleaning failed');
      showToast(`✓ P.${roomNumber} ${t('đã hoàn tất dọn phòng ➜ AVAILABLE', 'cleaned & ready ➜ AVAILABLE')}`);
      await fetchMatrixAndQueue();
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      setCompletingRoomId(null);
    }
  };

  const filteredRooms = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rooms.filter((room) => {
      const guestName = room.bookings?.[0]?.guestName || room.bookings?.[0]?.user?.name || '';
      const matchesSearch =
        room.number.toLowerCase().includes(q) ||
        room.type.toLowerCase().includes(q) ||
        guestName.toLowerCase().includes(q);

      const matchesFloor = selectedFloor === 'ALL' || room.floor.toString() === selectedFloor;
      return matchesSearch && matchesFloor;
    });
  }, [rooms, searchQuery, selectedFloor]);

  const roomsByColumn = useMemo(() => {
    const grouped = { AVAILABLE: [], OCCUPIED: [], CLEANING: [], MAINTENANCE: [] };
    filteredRooms.forEach((room) => {
      if (grouped[room.status]) grouped[room.status].push(room);
      else grouped.AVAILABLE.push(room);
    });
    return grouped;
  }, [filteredRooms]);

  const handleDragStart = (event) => {
    const foundRoom = rooms.find((r) => r.id === event.active.id);
    setActiveDragRoom(foundRoom || null);
  };

  const handleDragOver = (event) => {
    setActiveOverId(event.over ? event.over.id : null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragRoom(null);
    setActiveOverId(null);

    if (!over) return;

    const roomId = active.id;
    const targetStatus = over.id;

    const draggedRoom = rooms.find((r) => r.id === roomId);
    if (!draggedRoom || draggedRoom.status === targetStatus) return;

    const previousStatus = draggedRoom.status;

    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, status: targetStatus } : r))
    );
    showToast(t(`Đang chuyển P.${draggedRoom.number} ➜ ${targetStatus}...`, `Moving Room #${draggedRoom.number} ➜ ${targetStatus}...`));

    try {
      const res = await fetch(`/api/rooms/${roomId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'Failed to update status');
      await fetchMatrixAndQueue();
      showToast(`✓ P.${draggedRoom.number} ➜ ${targetStatus}`);
    } catch (err) {
      console.error('Drag update failed:', err);
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: previousStatus } : r))
      );
      showToast(`❌ ${t('Không thể cập nhật trạng thái', 'Could not change status')} P.${draggedRoom.number}`);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400">
              <Sliders className="w-5 h-5 text-cyan-400" />
            </span>
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('Sơ Đồ Buồng Phòng Trực Quan', 'Interactive Room Matrix')}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 font-medium">
                Live Drag & Drop
              </span>
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {t('Kéo thả phòng sang CLEANING để tạo nhiệm vụ Buồng phòng tự động, hoặc đặt phòng Walk-in ngay tại quầy.', 'Drag cards to CLEANING to auto-spawn housekeeping tasks, or create Walk-in bookings.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowBookingModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs shadow-neon-violet hover:scale-105 transition-all"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            {t('Đặt Phòng Mới', 'New Booking')}
          </button>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Tìm số phòng hoặc tên khách...', 'Search room or guest...')}
              className={`pl-9 pr-4 py-2 rounded-xl border text-xs focus:border-cyan-400 outline-none w-48 md:w-56 transition-all ${
                isDark ? 'bg-[#1A1F2C] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <div className={`flex items-center p-1 rounded-xl border text-xs ${isDark ? 'bg-[#1A1F2C] border-white/10' : 'bg-white border-slate-200'}`}>
            {['ALL', '1', '2', '3', '4'].map((floor) => (
              <button
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                  selectedFloor === floor
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {floor === 'ALL' ? t('Tất cả', 'All') : `Fl ${floor}`}
              </button>
            ))}
          </div>

          <button
            onClick={fetchMatrixAndQueue}
            disabled={loading}
            className={`p-2 rounded-xl border transition-colors ${isDark ? 'bg-[#1A1F2C] border-white/10 text-slate-300 hover:text-cyan-400' : 'bg-white border-slate-200 text-slate-700 hover:text-cyan-600'}`}
            title="Refresh room telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Smart Housekeeping Task Queue Banner */}
      <div className={`rounded-2xl border p-4 backdrop-blur-xl ${isDark ? 'bg-[#141925]/90 border-amber-400/25' : 'bg-amber-50/70 border-amber-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{t('Hàng Đợi Điều Phối Buồng Phòng Thông Minh (Smart Housekeeping Queue)', 'Smart Housekeeping Priority Queue')}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30 font-mono text-[10px]">
              {housekeepingQueue.length} {t('phòng chờ dọn', 'active')}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {t('Tự động tạo khi kéo thẻ sang CLEANING hoặc khách gọi từ phòng 3D', 'Auto-created on CLEANING drop or Guest 3D request')}
          </span>
        </div>

        {housekeepingQueue.length === 0 ? (
          <p className="text-xs text-emerald-400 font-medium">
            ✓ {t('Tất cả các phòng đã hoàn tất vệ sinh!', 'All rooms are spotless and ready!')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {housekeepingQueue.map((task) => (
              <div
                key={task.roomId}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                  isDark ? 'bg-[#0B0F19]/80 border-white/10' : 'bg-white border-amber-200 shadow-sm'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-xs text-cyan-400">P.{task.roomNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      task.tier === 'VIP URGENT'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-400/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                    }`}>
                      {task.tier} • {task.priorityScore}đ
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-mono">
                      {task.taskStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-1">{task.reason}</p>
                </div>

                <button
                  onClick={() => handleCompleteCleaning(task.roomId, task.roomNumber)}
                  disabled={completingRoomId === task.roomId}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-all disabled:opacity-50"
                >
                  {completingRoomId === task.roomId ? '...' : t('Hoàn tất dọn phòng', 'Complete')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kanban Drag & Drop Workspace */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              rooms={roomsByColumn[column.id] || []}
              isOver={activeOverId === column.id}
              isDark={isDark}
              lang={lang}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDragRoom ? <DraggableRoomCard room={activeDragRoom} isOverlay={true} isDark={true} /> : null}
        </DragOverlay>
      </DndContext>

      <NewBookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        rooms={rooms}
        defaultSource="WALK_IN"
        onBookingCreated={() => fetchMatrixAndQueue()}
      />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-xl bg-[#1A1F2C] border border-cyan-400/40 text-cyan-300 text-xs font-semibold shadow-2xl flex items-center gap-2.5 backdrop-blur-xl"
          >
            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
