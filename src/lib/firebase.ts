import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
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

export const FIREBASE_VAPID_KEY =
  "BFsN6ecy2D12X0vjN6zIt8BtV50Q4uGhmk9Dd3mZElGvXzRqxP5ROx1ZK5adB_YYbTU57H_h7CijF4QXF9hxKyk";

const app = initializeApp(firebaseConfig);

function isElectronApp(): boolean {
  return typeof window !== "undefined" && Boolean((window as Window & { electronAPI?: unknown }).electronAPI);
}

/** FCM web push needs HTTPS + service worker; Electron/file:// cannot register one. */
export function isFirebaseMessagingSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isElectronApp()) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!window.isSecureContext) return false;
  if (window.location.protocol === "file:") return false;
  return true;
}

let messagingInstance: Messaging | null = null;
function getMessagingInstance(): Messaging | null {
  if (!isFirebaseMessagingSupported()) return null;
  if (!messagingInstance) messagingInstance = getMessaging(app);
  return messagingInstance;
}

export const messaging = typeof window !== "undefined" ? getMessagingInstance() : null;

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let tokenRequestInFlight: Promise<string | null> | null = null;

async function waitForDocumentReady(): Promise<void> {
  if (document.readyState === "complete") return;
  await new Promise<void>((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

async function getMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isFirebaseMessagingSupported()) return null;

  if (!swRegistrationPromise) {
    swRegistrationPromise = (async () => {
      await waitForDocumentReady();

      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (existing?.active) return existing;

        return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      } catch (err) {
        console.warn("Firebase service worker registration failed:", err);
        return null;
      }
    })();
  }

  return swRegistrationPromise;
}

export const requestFirebaseToken = async (userId: string, vapidKey = FIREBASE_VAPID_KEY) => {
  const messagingClient = getMessagingInstance();
  if (!messagingClient) {
    if (isElectronApp()) {
      console.info("FCM skipped in Electron — in-app notifications still work via Supabase realtime.");
    }
    return null;
  }

  if (tokenRequestInFlight) return tokenRequestInFlight;

  tokenRequestInFlight = (async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return null;

      const registration = await getMessagingServiceWorker();
      if (!registration) return null;

      const currentToken = await getToken(messagingClient, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!currentToken) {
        console.log("No registration token available. Request permission to generate one.");
        return null;
      }

      console.log("FCM Token obtained:", currentToken);
      const { error } = await supabase
        .from("employee_profiles")
        .update({ web_fcm_token: currentToken })
        .eq("id", userId);

      if (error) {
        console.error("Failed to save web_fcm_token to Supabase:", error);
      } else {
        console.log("Successfully saved web_fcm_token to Supabase!");
      }
      return currentToken;
    } catch (err) {
      console.error("An error occurred while retrieving token. ", err);
      return null;
    } finally {
      tokenRequestInFlight = null;
    }
  })();

  return tokenRequestInFlight;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    const messagingClient = getMessagingInstance();
    if (!messagingClient) return;
    onMessage(messagingClient, (payload) => {
      resolve(payload);
    });
  });
