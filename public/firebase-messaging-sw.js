importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js");

const firebaseConfig = {
    apiKey: "AIzaSyDzhHEabYIbHs3loetP33ixfg49Vr3rs60",
    authDomain: "whats-app-ba228.firebaseapp.com",
    projectId: "whats-app-ba228",
    storageBucket: "whats-app-ba228.firebasestorage.app",
    messagingSenderId: "262534457804",
    appId: "1:262534457804:web:649d3a91c3aae990d71569",
    measurementId: "G-C1Y86CZ6D1"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message ", payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: "/icon.png"
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
