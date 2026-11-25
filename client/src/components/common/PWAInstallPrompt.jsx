import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share } from 'lucide-react';

function getInitialStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function getIsIOS() {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(getInitialStandalone);
  const isIOS = getIsIOS();

  useEffect(() => {
    if (installed) return undefined;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    let iosTimer;
    if (isIOS && !localStorage.getItem('nexstay_ios_pwa_dismissed')) {
      iosTimer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [installed, isIOS]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('nexstay_ios_pwa_dismissed', 'true');
    }
  };

  if (installed || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-24 left-4 right-4 md:bottom-6 md:left-6 md:right-auto md:max-w-md z-40"
      >
        <div className="relative overflow-hidden rounded-2xl bg-[#1A1F2C]/95 border border-cyan-400/40 p-4 md:p-5 shadow-2xl backdrop-blur-2xl shadow-cyan-500/20">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-violet-600/20 rounded-full blur-2xl pointer-events-none" />

          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close install prompt"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-0.5 shrink-0 shadow-neon-cyan">
              <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center font-black text-cyan-400 text-base">
                NX
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-white tracking-tight">Install NexStay App</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 font-mono">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Add to your home screen for instant offline room access, QR digital key, and virtual IoT controls.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            {isIOS ? (
              <div className="text-[11px] text-cyan-300 flex items-center gap-1.5 font-medium">
                <Share className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  Tap <strong className="text-white">Share</strong>, then select{' '}
                  <strong className="text-white">&apos;Add to Home Screen&apos;</strong>
                </span>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-neon-cyan"
              >
                <Download className="w-3.5 h-3.5" />
                Install to Device
              </button>
            )}

            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
