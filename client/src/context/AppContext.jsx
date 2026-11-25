import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AppContext } from './useApp';
import { SOCKET_URL, apiFetch, subscribeApiWakeState, subscribeApiConnectivity } from '../utils/api';

export function AppProvider({ children }) {
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [lang, setLang] = useState('vi'); // 'vi' | 'en'
  const [notifications, setNotifications] = useState([]);
  const [liveToast, setLiveToast] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'waking' | 'online' | 'offline'
  const [isApiSlow, setIsApiSlow] = useState(false);
  const [wakeElapsedSec, setWakeElapsedSec] = useState(0);

  const toastTimerRef = useRef(null);
  const socketRef = useRef(null);
  const socketSubscribersRef = useRef(new Set());
  const demoResetSubscribersRef = useRef(new Set());
  const lastReachableRef = useRef(null);
  const retryingRef = useRef(false);

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

  const showToastWithTimeout = useCallback((alert, duration = 4500) => {
    setLiveToast(alert);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setLiveToast((curr) => (curr?.id === alert.id ? null : curr));
    }, duration);
  }, []);

  const retryConnection = useCallback(async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setServerStatus('checking');
    try {
      await apiFetch('/api/health', { timeoutMs: 55000, wakeThresholdMs: 2500 });
      lastReachableRef.current = true;
      setServerStatus('online');
      setIsApiSlow(false);
      setWakeElapsedSec(0);
    } catch {
      lastReachableRef.current = false;
      setServerStatus('offline');
    } finally {
      retryingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const unsubConn = subscribeApiConnectivity((reachable) => {
      if (!active) return;
      lastReachableRef.current = reachable;
      if (reachable) {
        setServerStatus('online');
        setWakeElapsedSec(0);
      }
    });

    const unsubWake = subscribeApiWakeState((slow) => {
      if (!active) return;
      setIsApiSlow(slow);
      if (slow) {
        setServerStatus('waking');
      } else {
        setWakeElapsedSec(0);
        setServerStatus(lastReachableRef.current === false ? 'offline' : 'online');
      }
    });

    (async () => {
      try {
        await apiFetch('/api/health', { timeoutMs: 55000, wakeThresholdMs: 2500 });
        if (!active) return;
        lastReachableRef.current = true;
        setServerStatus('online');
        setIsApiSlow(false);
        setWakeElapsedSec(0);
      } catch {
        if (active) {
          lastReachableRef.current = false;
          setServerStatus('offline');
        }
      }
    })();

    return () => {
      active = false;
      unsubWake();
      unsubConn();
    };
  }, []);

  const isWakingUp = isApiSlow || serverStatus === 'waking';

  useEffect(() => {
    if (!isWakingUp) return undefined;
    const started = Date.now();
    const interval = setInterval(() => {
      setWakeElapsedSec(Math.max(1, Math.floor((Date.now() - started) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isWakingUp]);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      withCredentials: true,
    });

    socketRef.current = socketInstance;
    const subscribers = socketSubscribersRef.current;

    const pushAlert = (alert) => {
      setNotifications((prev) => [alert, ...prev].slice(0, 15));
      showToastWithTimeout(alert, 4500);
    };

    socketInstance.on('connect', () => {
      lastReachableRef.current = true;
      setServerStatus('online');
      setIsApiSlow(false);
      setWakeElapsedSec(0);
    });

    socketInstance.on('reception:notification', (payload) => {
      if (payload) pushAlert(payload);
    });

    socketInstance.on('iot:action', (payload) => {
      if (!payload) return;
      pushAlert({
        id: `IOT-${payload.id || Date.now()}`,
        roomNumber: payload.roomNumber || 'N/A',
        type: 'IOT_TELEMETRY',
        message: `⚡ IoT Phòng ${payload.roomNumber || 'N/A'}: ${payload.device || 'SYSTEM'} ➜ ${payload.value ?? ''}`,
        timestamp: payload.timestamp || new Date().toISOString(),
        priority: payload.source === 'VOICE_AI' ? 'VIP' : 'NORMAL',
      });
    });

    socketInstance.on('payment:confirmed', (payload) => {
      if (!payload) return;
      pushAlert({
        id: `PAY-${Date.now()}`,
        roomNumber: payload.roomNumber || 'N/A',
        type: 'PAYMENT',
        message: `✅ Thanh toán thành công Phòng ${payload.roomNumber || 'N/A'}: $${payload.amount ?? 0} (${payload.method || 'ONLINE'})`,
        timestamp: new Date().toISOString(),
        priority: 'VIP',
      });
    });

    subscribers.forEach((sub) => {
      socketInstance.on(sub.event, sub.handler);
    });

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      subscribers.forEach((sub) => {
        socketInstance.off(sub.event, sub.handler);
      });
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [showToastWithTimeout]);

  const onSocketEvent = useCallback((event, handler) => {
    const entry = { event, handler };
    socketSubscribersRef.current.add(entry);
    socketRef.current?.on(event, handler);
    return () => {
      socketSubscribersRef.current.delete(entry);
      socketRef.current?.off(event, handler);
    };
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const toggleLang = () => setLang((prev) => (prev === 'vi' ? 'en' : 'vi'));

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setLiveToast(null);
  };
  const clearNotifications = () => setNotifications([]);

  const showCustomToast = useCallback(
    (message) => {
      const alert = {
        id: `LOCAL-${Date.now()}`,
        roomNumber: 'SYSTEM',
        type: 'INFO',
        message,
        timestamp: new Date().toISOString(),
      };
      showToastWithTimeout(alert, 4000);
    },
    [showToastWithTimeout]
  );

  const subscribeDemoReset = useCallback((cb) => {
    demoResetSubscribersRef.current.add(cb);
    return () => demoResetSubscribersRef.current.delete(cb);
  }, []);

  const triggerDemoResetRefresh = useCallback(() => {
    demoResetSubscribersRef.current.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore listener errors
      }
    });
  }, []);

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
        onSocketEvent,
        serverStatus,
        isWakingUp,
        wakeElapsedSec,
        retryConnection,
        subscribeDemoReset,
        triggerDemoResetRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
