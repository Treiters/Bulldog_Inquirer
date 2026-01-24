// firebase-config.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAgD8oHQ2MHoKD3B60pNi_giKO9lcft4Gs",
  authDomain: "bulldoginquirer.firebaseapp.com",
  projectId: "bulldoginquirer",
  storageBucket: "bulldoginquirer.firebasestorage.app",
  messagingSenderId: "69389144325",
  appId: "1:69389144325:web:fdcf8ef7eeeaa46280276c",
  measurementId: "G-EFESP30LZX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services you need
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;