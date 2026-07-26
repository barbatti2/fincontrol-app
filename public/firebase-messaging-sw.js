/* firebase-messaging-sw.js
   Service worker do Firebase Cloud Messaging.
   Precisa ficar na RAIZ do site publicado (mesma pasta do index.html)
   para conseguir receber notificações push com o app fechado.

   IMPORTANTE: as mensagens são enviadas com payload "data" (não
   "notification"). Isso evita que o navegador exiba uma notificação
   automática por conta própria ao mesmo tempo que o showNotification()
   abaixo é chamado — o que causava notificação duplicada. */

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
  const title = (payload.data && payload.data.title) || 'FinUp';
  const body = (payload.data && payload.data.body) || '';
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
