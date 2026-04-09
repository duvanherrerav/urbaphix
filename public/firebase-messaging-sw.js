/* global importScripts, firebase */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC7x1Bc8jjW3sA9JUvRpGMfSgQeCypstmM",
  authDomain: "urbaphix-b7e10.firebaseapp.com",
  projectId: "urbaphix-b7e10",
  messagingSenderId: "213323509730",
  appId: "1:213323509730:web:094a7a6e6dc1be08c993bb",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log("Mensaje en background:", payload);

  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon.png'
  });
});
