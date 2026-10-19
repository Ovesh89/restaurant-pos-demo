import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { notificationRepository } from '../services/repositories/notificationRepository.js';

export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone (D5 - 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Second tone (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('Web Audio playback error:', err);
  }
};

/**
 * Hook providing sound + web push notifications + floating toast alerts
 * tailored for Captain and Kitchen roles upon order status events.
 */
export const useOrderNotifications = () => {
  const { user } = useAuth();
  const [activeToast, setActiveToast] = useState(null);
  const seenIdsRef = useRef(new Set());
  const toastTimerRef = useRef(null);

  const isEligibleRole =
    user?.role === 'captain' ||
    user?.role === 'kitchen' ||
    user?.role === 'admin' ||
    user?.role === 'owner';

  useEffect(() => {
    if (!isEligibleRole) return;

    // Request notification permission once on mount if not yet decided
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    const checkNotifications = async () => {
      try {
        const unread = await notificationRepository.getNotifications(true);
        if (!Array.isArray(unread) || unread.length === 0) return;

        for (const item of unread) {
          const notifId = item.id || item._id;
          if (!notifId || seenIdsRef.current.has(notifId)) continue;

          seenIdsRef.current.add(notifId);

          // 1. Play synthesized chime sound
          playNotificationChime();

          // 2. Trigger native browser Web Push notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(item.title || 'Order Update', {
                body: item.message || '',
                icon: '/logo.png',
                tag: notifId,
              });
            } catch (err) {
              console.warn('Browser Notification instantiation failed:', err);
            }
          }

          // 3. Display floating toast in web app
          setActiveToast({
            id: notifId,
            title: item.title || 'Order Alert',
            message: item.message || '',
            eventType: item.eventType || 'ALERT',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });

          // Auto-dismiss toast after 6 seconds
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => {
            setActiveToast(null);
          }, 6000);

          // Mark notification as read
          try {
            await notificationRepository.markAsRead(notifId);
          } catch (readErr) {
            console.warn('Failed to mark notification as read:', readErr);
          }
        }
      } catch (err) {
        // Silently catch polling errors in background
      }
    };

    // Initial check
    checkNotifications();

    // Poll every 5 seconds
    const interval = setInterval(checkNotifications, 5000);
    return () => {
      clearInterval(interval);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [user?.role, isEligibleRole]);

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActiveToast(null);
  };

  return {
    activeToast,
    dismissToast,
  };
};
