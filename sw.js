importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const CACHE_NAME = 'guardias-pwa-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('gstatic.com')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

firebase.initializeApp({
  apiKey: "AIzaSyAddWXaYA9_Vek00Mye8Af6HtsCjS8t9uY",
  authDomain: "estrategias-ea93f.firebaseapp.com",
  projectId: "estrategias-ea93f",
  storageBucket: "estrategias-ea93f.firebasestorage.app",
  messagingSenderId: "672197334579",
  appId: "1:672197334579:web:41e39550e62bda3972b546"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Nueva Guardia Disponible';
  const options = {
    body: payload.notification?.body || 'Revisa el tablero de guardias en tu unidad.',
    icon: 'https://img.icons8.com/color/512/hospital-3.png',
    badge: 'https://img.icons8.com/color/512/hospital-3.png'
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://jjrmc8961-maker.github.io/Estrategias/index.html')
  );
});
