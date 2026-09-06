/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider, useAuth } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SettingsProvider } from './components/SettingsProvider';
import { GroupsProvider, useGroups } from './components/GroupsProvider';
import { GroupOnboarding } from './pages/GroupOnboarding';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

import { NicknameOnboarding } from './pages/NicknameOnboarding';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const { groups, loadingGroups, activeGroupId } = useGroups();
  const [hasPodium, setHasPodium] = useState<boolean | null>(null);

  const currentGroupId = activeGroupId || (groups.length > 0 ? groups[0]?.id : null);

  useEffect(() => {
    if (!user) {
      setHasPodium(null);
      return;
    }
    if (loadingGroups) return;
    if (groups.length === 0) {
      setHasPodium(false);
      return;
    }

    if (!currentGroupId) {
      setHasPodium(false);
      return;
    }

    let isMounted = true;
    const checkGroupPodium = async () => {
      try {
        const groupPodiumRef = doc(db, 'podiums', `${currentGroupId}_${user.uid}`);
        const snap = await getDoc(groupPodiumRef);
        if (snap.exists()) {
          if (isMounted) setHasPodium(true);
          return;
        }

        // Automatic migration for single-group existing users with legacy podium
        if (groups.length === 1) {
          const legacySnap = await getDoc(doc(db, 'podiums', user.uid));
          if (legacySnap.exists()) {
            await setDoc(groupPodiumRef, {
              ...legacySnap.data(),
              groupId: currentGroupId,
              updatedAt: Date.now()
            });
            if (isMounted) setHasPodium(true);
            return;
          }
        }

        // For new groups or missing podiums, require setup
        if (isMounted) setHasPodium(false);
      } catch (err) {
        console.warn("Error checking group podium:", err);
        if (isMounted) setHasPodium(true);
      }
    };

    checkGroupPodium();

    return () => {
      isMounted = false;
    };
  }, [user, currentGroupId, groups.length, loadingGroups]);
  
  if (loading || (user && !profile) || (user && loadingGroups) || (user && hasPodium === null)) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-[#e4e4e7] uppercase tracking-widest text-xs font-bold">CARGANDO...</div>;
  if (!user) return <Login />;
  
  if (!profile?.nickname) return <NicknameOnboarding />;
  
  // Si no tiene grupos o si no tiene podio en el grupo activo, mostramos el Onboarding
  if (groups.length === 0 || !hasPodium) {
    return (
      <GroupOnboarding 
        forcePodiumStep={groups.length > 0 && !hasPodium} 
        targetGroupId={currentGroupId || undefined}
        onPodiumSaved={() => setHasPodium(true)} 
      />
    );
  }
  
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <GroupsProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </GroupsProvider>
    </AuthProvider>
  );
}
