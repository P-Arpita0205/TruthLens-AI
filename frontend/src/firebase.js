import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxSCoLLlrUML2NULeEgFpjnk9l7usgbcc",
  authDomain: "truthlens-ai-964e1.firebaseapp.com",
  projectId: "truthlens-ai-964e1",
  storageBucket: "truthlens-ai-964e1.firebasestorage.app",
  messagingSenderId: "164186159420",
  appId: "1:164186159420:web:ab5db78cc00fcbfbbec639"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configure auth settings for phone authentication
auth.settings = {
  appVerificationDisabledForTesting: false, // Enable reCAPTCHA for production
  operationTimeout: 30000 // 30 seconds timeout
};

// Export RecaptchaVerifier for phone authentication
export { RecaptchaVerifier };
