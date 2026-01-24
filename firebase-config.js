// Firebase Client SDK - NO STORAGE, NO FUNCTIONS!
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
export const auth = getAuth(app);
export const db = getFirestore(app);

// Auth state observer
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Authentication
export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return await signOut(auth);
}

// Firestore - Articles
export async function getArticles() {
  const q = query(collection(db, 'articles'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addArticle(articleData) {
  return await addDoc(collection(db, 'articles'), articleData);
}

export async function deleteArticle(articleId) {
  return await deleteDoc(doc(db, 'articles', articleId));
}