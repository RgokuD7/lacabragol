import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Group } from '../types';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../lib/utils';

interface GroupsContextType {
  groups: Group[];
  loadingGroups: boolean;
  activeGroupId: string | null;
  setActiveGroupId: (id: string) => void;
}

const GroupsContext = createContext<GroupsContextType>({ groups: [], loadingGroups: true, activeGroupId: null, setActiveGroupId: () => {} });

export const useGroups = () => useContext(GroupsContext);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setGroups([]);
      setLoadingGroups(false);
      return;
    }
    
    setLoadingGroups(true);
    const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const g = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Group));
      setGroups(g);
      if (g.length > 0 && !activeGroupId) {
        setActiveGroupId(g[0].id);
      }
      setLoadingGroups(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
      setLoadingGroups(false);
    });

    return () => unsub();
  }, [user, authLoading]);

  return (
    <GroupsContext.Provider value={{ groups, loadingGroups, activeGroupId, setActiveGroupId }}>
      {children}
    </GroupsContext.Provider>
  );
}
