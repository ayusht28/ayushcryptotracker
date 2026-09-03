import { useState, useEffect, useCallback } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState(function() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  const requestPermission = useCallback(async function() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const sendNotification = useCallback(function(title, body) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'crypto-alert',
      });
    } catch (err) {
      console.error('Notification failed:', err.message);
    }
  }, []);

  return { permission, requestPermission, sendNotification };
}
