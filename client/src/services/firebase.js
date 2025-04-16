import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCr2tE4vEhySOdtlinFoLmWjSqiZFJVurw",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "mina-healthcare.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "mina-healthcare",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "mina-healthcare.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "374882762240",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:374882762240:web:6730f6971d23c92a3022e5",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-3EYZS0NGZR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;