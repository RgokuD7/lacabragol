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
  const { groups, loadingGroups } = useGroups();
  const [hasPodium, setHasPodium] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setHasPodium(null);
      return;
    }
    getDoc(doc(db, 'podiums', user.uid)).then(snap => {
      setHasPodium(snap.exists());
    });
  }, [user]);
  
  if (loading || (user && !profile) || (user && loadingGroups) || (user && hasPodium === null)) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-[#e4e4e7] uppercase tracking-widest text-xs font-bold">CARGANDO...</div>;
  if (!user) return <Login />;
  
  if (!profile?.nickname) return <NicknameOnboarding />;
  
  // Si no tiene grupos o si no tiene podio, mostramos el Onboarding
  if (groups.length === 0 || !hasPodium) {
    return <GroupOnboarding forcePodiumStep={groups.length > 0 && !hasPodium} onPodiumSaved={() => setHasPodium(true)} />;
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
