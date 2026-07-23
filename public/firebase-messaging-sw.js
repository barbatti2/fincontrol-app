/* firebase-messaging-sw.js
   Service worker do Firebase Cloud Messaging.
   Precisa ficar na RAIZ do site publicado (mesma pasta do index.html)
   para conseguir receber notificações push com o app fechado. */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDAHZEjirkb5ililKMim-2CDJ3lvyt87FE",
  authDomain: "fincontrol-app-bb06f.firebaseapp.com",
  projectId: "fincontrol-app-bb06f",
  storageBucket: "fincontrol-app-bb06f.firebasestorage.app",
  messagingSenderId: "690750174567",
  appId: "1:690750174567:web:1e45e728f7785279cc2bc2"
});

const messaging = firebase.messaging();

// Exibida quando o app está fechado ou em segundo plano
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'FinControl';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, { body, icon: undefined });
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      if (list.length > 0) return list[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
