import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { AppContext } from './useApp';

export function AppProvider({ children }) {
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [lang, setLang] = useState('vi'); // 'vi' | 'en'
  const [notifications, setNotifications] = useState([]);
  const [liveToast, setLiveToast] = useState(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      document.body.style.backgroundColor = '#0B0F19';
      document.body.style.color = '#F8FAFC';
    } else {
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#F1F5F9';
      document.body.style.color = '#0F172A';
    }
  }, [theme]);

  useEffect(() => {
    const socket = io();

    const pushAlert = (alert) => {
      setNotifications((prev) => [alert, ...prev].slice(0, 15));
      setLiveToast(alert);
      setTimeout(() => {
        setLiveToast((curr) => (curr?.id === alert.id ? null : curr));
      }, 4500);
    };

    socket.on('reception:notification', (payload) => {
      pushAlert(payload);
    });

    socket.on('iot:action', (payload) => {
      pushAlert({
        id: `IOT-${payload.id || Date.now()}`,
        roomNumber: payload.roomNumber,
        type: 'IOT_TELEMETRY',
        message: `⚡ IoT Phòng ${payload.roomNumber}: ${payload.device} ➜ ${payload.value}`,
        timestamp: payload.timestamp || new Date().toISOString(),
        priority: payload.source === 'VOICE_AI' ? 'VIP' : 'NORMAL',
      });
    });

    socket.on('payment:confirmed', (payload) => {
      pushAlert({
        id: `PAY-${Date.now()}`,
        roomNumber: payload.roomNumber,
        type: 'PAYMENT',
        message: `✅ Thanh toán thành công Phòng ${payload.roomNumber}: $${payload.amount} (${payload.method})`,
        timestamp: new Date().toISOString(),
        priority: 'VIP',
      });
    });

    return () => socket.disconnect();
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const toggleLang = () => setLang((prev) => (prev === 'vi' ? 'en' : 'vi'));

  const dismissToast = () => setLiveToast(null);
  const clearNotifications = () => setNotifications([]);

  const showCustomToast = (message) => {
    const alert = {
      id: `LOCAL-${Date.now()}`,
      roomNumber: 'SYSTEM',
      type: 'INFO',
      message,
      timestamp: new Date().toISOString(),
    };
    setLiveToast(alert);
    setTimeout(() => {
      setLiveToast((curr) => (curr?.id === alert.id ? null : curr));
    }, 4000);
  };

  const t = (viText, enText) => (lang === 'vi' ? viText : enText);

  return (
    <AppContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
