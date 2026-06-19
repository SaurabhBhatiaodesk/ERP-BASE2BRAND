importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBjPzlA26UOFogrJPHoIejtE0w2qC07HOo",
  authDomain: "b2berp-f45e0.firebaseapp.com",
  projectId: "b2berp-f45e0",
  storageBucket: "b2berp-f45e0.firebasestorage.app",
  messagingSenderId: "776259679283",
  appId: "1:776259679283:web:81292cfcb7253012719f46",
  measurementId: "G-QLZS5052W6"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
