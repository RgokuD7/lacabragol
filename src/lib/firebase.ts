import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDDO9xR7qJlKETag8kpXUHwdYMArEIsAhY",
  authDomain: "lacabragol.firebaseapp.com",
  projectId: "lacabragol",
  storageBucket: "lacabragol.firebasestorage.app",
  messagingSenderId: "908751231296",
  appId: "1:908751231296:web:f8675b529f084292ce82a5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
