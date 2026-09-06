import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Podium } from '../types';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { getPodiumDocId, saveGroupPodium } from '../lib/podium';
import { PodiumDisplay } from '../components/PodiumDisplay';

export function PodiumSection() {
  const { user } = useAuth();
  const { activeGroupId } = useGroups();
  const [podium, setPodium] = useState<Podium | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const currentDocId = getPodiumDocId(activeGroupId, user.uid);
    const unsub = onSnapshot(doc(db, 'podiums', currentDocId), (snap) => {
      if (snap.exists()) {
        setPodium(snap.data() as Podium);
      } else {
        setPodium(null);
      }
    });
    return () => unsub();
  }, [user, activeGroupId]);

  const handleSave = async (data: Partial<Podium>) => {
    if (!user) return;
    setSaving(true);
    try {
      await saveGroupPodium(activeGroupId, user.uid, data);
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      <PodiumDisplay
        podium={podium}
        canEdit={true}
        onSave={handleSave}
        title="Mi Podio"
        isSaving={saving}
      />
    </div>
  );
}