import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, logout: async () => {} });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as User;
          const updates: Partial<User> = {};
          if (firebaseUser.email === 'richarddiaz0107@gmail.com' && !data.isAdmin) {
            updates.isAdmin = true;
            data.isAdmin = true;
          }
          if (firebaseUser.photoURL && data.photoURL !== firebaseUser.photoURL) {
            updates.photoURL = firebaseUser.photoURL;
            data.photoURL = firebaseUser.photoURL;
          }
          if (firebaseUser.displayName && data.displayName !== firebaseUser.displayName) {
            updates.displayName = firebaseUser.displayName;
            data.displayName = firebaseUser.displayName;
          }
          if (Object.keys(updates).length > 0) {
            try {
              await updateDoc(userRef, { ...updates, updatedAt: Date.now() });
            } catch(e) {
              console.error("Failed to update user profile info", e);
            }
          }
          setProfile(data);
        } else {
          // Create new user profile
          const newProfile: User = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            points: 0,
            exactMatches: 0,
            paid: false,
            isAdmin: firebaseUser.email === 'richarddiaz0107@gmail.com',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          // Try creating
          try {
             await setDoc(userRef, newProfile);
             setProfile(newProfile);
          } catch(e) {
             console.error("Failed to create user profile", e);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
