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
import { getGroupPodium, findAnyUserPodium } from './lib/podium';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const { groups, loadingGroups, activeGroupId } = useGroups();
  const [checkingPodium, setCheckingPodium] = useState<boolean>(true);
  const [hasPodium, setHasPodium] = useState<boolean>(false);

  const currentGroupId = activeGroupId || (groups.length > 0 ? groups[0]?.id : null);

  useEffect(() => {
    if (!user) {
      setHasPodium(false);
      setCheckingPodium(false);
      return;
    }

    if (loadingGroups) {
      setCheckingPodium(true);
      return;
    }

    if (groups.length === 0) {
      setHasPodium(false);
      setCheckingPodium(false);
      return;
    }

    if (!currentGroupId) {
      setHasPodium(false);
      setCheckingPodium(false);
      return;
    }

    let isMounted = true;
    setCheckingPodium(true);

    const checkGroupPodium = async () => {
      try {
        // 1. Check active group podium (with legacy fallback)
        const p = await getGroupPodium(currentGroupId, user.uid);
        if (p && (p.champion || p.runnerUp)) {
          if (isMounted) {
            setHasPodium(true);
            setCheckingPodium(false);
          }
          return;
        }

        // 2. Check any existing podium across user records
        const anyPodium = await findAnyUserPodium(user.uid);
        if (anyPodium && (anyPodium.champion || anyPodium.runnerUp)) {
          if (isMounted) {
            setHasPodium(true);
            setCheckingPodium(false);
          }
          return;
        }

        if (isMounted) {
          setHasPodium(false);
          setCheckingPodium(false);
        }
      } catch (err) {
        console.warn("Error checking group podium:", err);
        if (isMounted) {
          setHasPodium(true); // Don't lock users out on connection error
          setCheckingPodium(false);
        }
      }
    };

    checkGroupPodium();

    return () => {
      isMounted = false;
    };
  }, [user, currentGroupId, groups.length, loadingGroups]);
  
  if (loading || (user && !profile) || (user && loadingGroups) || (user && checkingPodium)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0b] text-[#e4e4e7] gap-3">
        <img src="/logo.png" alt="La Cabra Gol" className="w-16 h-16 animate-pulse" />
        <div className="uppercase tracking-widest text-xs font-bold text-zinc-400">CARGANDO...</div>
      </div>
    );
  }

  if (!user) return <Login />;
  
  if (!profile?.nickname) return <NicknameOnboarding />;
  
  // Si no tiene grupos o si no tiene podio en el grupo activo, mostramos el Onboarding
  if (groups.length === 0 || !hasPodium) {
    return (
      <GroupOnboarding 
        forcePodiumStep={groups.length > 0 && !hasPodium} 
        targetGroupId={currentGroupId || undefined}
        onPodiumSaved={() => {
          setHasPodium(true);
          setCheckingPodium(false);
        }} 
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
