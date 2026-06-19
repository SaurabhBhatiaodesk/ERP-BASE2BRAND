import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabase";

const firebaseConfig = {
  apiKey: "AIzaSyBjPzlA26UOFogrJPHoIejtE0w2qC07HOo",
  authDomain: "b2berp-f45e0.firebaseapp.com",
  projectId: "b2berp-f45e0",
  storageBucket: "b2berp-f45e0.firebasestorage.app",
  messagingSenderId: "776259679283",
  appId: "1:776259679283:web:81292cfcb7253012719f46",
  measurementId: "G-QLZS5052W6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Messaging and get a reference to the service
export const messaging = typeof window !== "undefined" && "serviceWorker" in navigator ? getMessaging(app) : null;

export const requestFirebaseToken = async (userId: string, vapidKey?: string) => {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // NOTE: User must provide a vapidKey for web push to work!
      const currentToken = await getToken(messaging, { vapidKey });
      if (currentToken) {
        console.log("FCM Token obtained:", currentToken);
        // Save to Supabase (assuming an fcm_token column exists in employee_profiles)
        await supabase
          .from("employee_profiles")
          .update({ fcm_token: currentToken })
          .eq("id", userId);
        return currentToken;
      } else {
        console.log("No registration token available. Request permission to generate one.");
      }
    }
  } catch (err) {
    console.error("An error occurred while retrieving token. ", err);
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
