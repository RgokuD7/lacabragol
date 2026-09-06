import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Setting } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { useAuth } from './AuthProvider';
import { useGroups } from './GroupsProvider';

export const DEFAULT_SETTINGS: Setting = {
  groupName: 'Oficial',
  adminId: '',
  rulesText: '',
  blockMinutesBeforeMatch: 15,
  pointsExactMatch: 3,
  pointsWinnerTie: 1,
  pointsTeamGoals: 0,
  pointsGoalDiff: 0,
  pointsChampion: 10,
  pointsRunnerUp: 5,
  pointsThirdPlace: 0,
  pointsSpecial: 3,
  updatedAt: Date.now()
};

interface SettingsContextType {
  settings: Setting | null;
}

const SettingsContext = createContext<SettingsContextType>({ settings: null });

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Setting | null>(DEFAULT_SETTINGS);
  const { user } = useAuth();
  const { activeGroupId } = useGroups();

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      return;
    }

    const docId = activeGroupId || 'global';
    const unsub = onSnapshot(doc(db, 'settings', docId), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() } as Setting);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${docId}`);
      setSettings(DEFAULT_SETTINGS);
    });

    return () => unsub();
  }, [user, activeGroupId]);

  return (
    <SettingsContext.Provider value={{ settings }}>
      {children}
    </SettingsContext.Provider>
  );
}
