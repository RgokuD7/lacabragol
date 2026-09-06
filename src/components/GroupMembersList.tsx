import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, documentId, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { User, Group } from '../types';
import { UserMinus, ShieldAlert, Shield } from 'lucide-react';

export function GroupMembersList({ group }: { group: Group }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!group.members?.length) return;
      setLoading(true);
      try {
        const chunks = [];
        for (let i = 0; i < group.members.length; i += 10) {
          chunks.push(group.members.slice(i, i + 10));
        }
        const allUsers: User[] = [];
        for (const chunk of chunks) {
          const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const snap = await getDocs(q);
          snap.docs.forEach(d => allUsers.push(d.data() as User));
        }
        setMembers(allUsers);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchMembers();
  }, [group.members]);

  const isOwner = user?.uid === group.adminId;
  const isCoAdmin = group.coAdmins?.includes(user?.uid || '');

  const canManage = isOwner || isCoAdmin;

  const toggleCoAdmin = async (memberId: string) => {
    if (!isOwner) return; // Only owner can promote/demote
    try {
      const isAlready = group.coAdmins?.includes(memberId);
      await updateDoc(doc(db, 'groups', group.id), {
        coAdmins: isAlready ? arrayRemove(memberId) : arrayUnion(memberId)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!canManage) return;
    if (memberId === group.adminId) return; // Cannot remove owner
    if (isCoAdmin && group.coAdmins?.includes(memberId)) return; // CoAdmins cannot remove other CoAdmins
    
    if (confirm('¿Seguro que quieres eliminar a este usuario?')) {
      try {
        await updateDoc(doc(db, 'groups', group.id), {
          members: arrayRemove(memberId),
          coAdmins: arrayRemove(memberId)
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!canManage && !isOwner) return null;

  return (
    <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-4 shadow-sm space-y-4 mt-4">
      <div className="border-b border-zinc-800/50 pb-3">
        <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
          Gestión de Miembros
        </h2>
      </div>
      
      {loading ? (
        <p className="text-xs text-zinc-500">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {members.map(m => {
            const memberIsOwner = m.uid === group.adminId;
            const memberIsCoAdmin = group.coAdmins?.includes(m.uid);
            
            return (
              <div key={m.uid} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-white">{m.nickname || m.displayName}</span>
                  <div className="flex gap-1 mt-1">
                    {memberIsOwner && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded uppercase font-black tracking-widest">El Cabrón</span>}
                    {!memberIsOwner && memberIsCoAdmin && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 rounded uppercase font-black tracking-widest">Cabra</span>}
                    {!memberIsOwner && !memberIsCoAdmin && <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 rounded uppercase font-black tracking-widest">Chivo</span>}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* CoAdmin Toggle (Only for owner, not on himself) */}
                  {isOwner && !memberIsOwner && (
                    <button 
                      onClick={() => toggleCoAdmin(m.uid)}
                      className={`p-1.5 rounded-lg transition-colors ${memberIsCoAdmin ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                      title={memberIsCoAdmin ? "Quitar rol de Cabra" : "Hacer Cabra"}
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  )}
                  
                  {/* Remove Button */}
                  {canManage && !memberIsOwner && (isOwner || (!isOwner && !memberIsCoAdmin)) && (
                    <button 
                      onClick={() => removeMember(m.uid)}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      title="Expulsar"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
