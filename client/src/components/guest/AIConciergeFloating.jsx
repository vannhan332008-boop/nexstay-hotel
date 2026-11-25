import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Bot, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/useApp';

export default function AIConciergeFloating({ roomNumber = '302', guestName = 'Nguyễn Thảo Vy' }) {
  const { lang, t } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([]);

  const scrollRef = useRef(null);

  const welcomeMessage = {
    id: 'welcome',
    sender: 'bot',
    text:
      lang === 'vi'
        ? `Xin chào ${guestName}! Em là Nex – Trợ lý AI 5 sao của NexStay. Quý khách cần gọi thêm khăn tắm, đặt đồ ăn đêm, dọn phòng hay gợi ý địa điểm Quận 1 cứ nhắn cho em nhé ạ!`
        : `Welcome ${guestName}! I'm Nex, your 24/7 AI Concierge. Ask me to send towels, order gourmet dining, or recommend local spots!`,
  };

  const renderedMessages = [welcomeMessage, ...messages];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  const quickPrompts =
    lang === 'vi'
      ? ['Gọi thêm khăn & nước suối', 'Đặt Wagyu Steak tại phòng', 'Gợi ý ăn chơi Quận 1', 'Giờ check-out & Wi-Fi?']
      : ['Send extra towels & water', 'Order Wagyu Steak to room', 'Local dining recommendations', 'Checkout time & Wi-Fi?'];

  const sendMessage = async (textToSend) => {
    const trimmed = (textToSend || input).trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', text: trimmed }]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          roomNumber,
          language: lang,
          guestName,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: json.reply || t('Dạ em đã ghi nhận yêu cầu của quý khách ạ.', 'Your request has been logged.'),
          ticketCreated: Boolean(json.ticket),
          ticketType: json.ticket?.type,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          text: t('Kết nối tạm gián đoạn, vui lòng thử lại sau giây lát ạ.', 'Temporary connection issue, please try again.'),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-cyan-500 to-cyan-400 p-[2px] shadow-[0_0_30px_rgba(0,243,255,0.45)]"
        aria-label="Open Nex AI Concierge"
      >
        <div className="w-full h-full rounded-[14px] bg-[#0B0F19] flex items-center justify-center text-cyan-400 relative">
          {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0F19] animate-pulse" />
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[390px] h-[520px] rounded-3xl bg-[#121724]/95 border border-cyan-400/30 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-white"
          >
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-violet-900/40 to-cyan-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-400/15 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    Nex AI Concierge
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/30 font-mono">
                      24/7 VIP
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-300">{t('Tự động tạo ticket dịch vụ vào Lễ tân', 'Autonomous Reception Dispatch')}</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {renderedMessages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-br-sm'
                        : 'bg-[#1E2538] border border-white/10 text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.ticketCreated && (
                    <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] text-emerald-300 font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      {t(`Đã điều phối Ticket ${m.ticketType} tới Lễ tân`, `Dispatched ${m.ticketType} Ticket`)}
                    </span>
                  )}
                </motion.div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#1E2538] w-16 border border-white/10">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-t border-white/5 flex gap-1.5 overflow-x-auto no-scrollbar">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-[10px] text-cyan-300 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="p-3 border-t border-white/10 bg-[#0B0F19]/80 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('Nhắn cho trợ lý Nex...', 'Ask Nex anything...')}
                className="flex-1 bg-[#1A1F2C] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="p-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-all disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
