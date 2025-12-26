import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Replace these with actual values from Firebase Console
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "whats-app-ba228.firebaseapp.com",
    projectId: "whats-app-ba228",
    storageBucket: "whats-app-ba228.firebasestorage.app",
    messagingSenderId: "262534457804",
    appId: "1:262534457804:web:649d3a91c3aae990d71569",
    measurementId: "G-C1Y86CZ6D1"
};

const app = initializeApp(firebaseConfig);

export const getFirebaseMessaging = async () => {
    try {
        const { isSupported } = await import("firebase/messaging");
        if (await isSupported()) {
            return getMessaging(app);
        }
        return null;
    } catch (err) {
        console.error("Firebase Messaging not supported", err);
        return null;
    }
};

export const requestForToken = async () => {
    try {
        const messaging = await getFirebaseMessaging();
        if (!messaging) return null;

        const currentToken = await getToken(messaging, {
            vapidKey: "BHOxCY8sGByUx_Ck0R2X7O_DkEChn_TmXM3S2CWWzT-0v-mWlaOScvQryAJk9aT3kJD6iYhvLPwWExg5U9FPZxI"
        });
        if (currentToken) {
            console.log("FCM Token:", currentToken);
            return currentToken;
        } else {
            console.log("No registration token available. Request permission to generate one.");
            return null;
        }
    } catch (err) {
        console.log("An error occurred while retrieving token. ", err);
        return null;
    }
};

export const onMessageListener = async () => {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    return new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
};
