import React, { useState, useEffect } from 'react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { Group, Match } from '../types';
import { Users, CheckCircle2, CopyCheck, ArrowRight, Loader2 } from 'lucide-react';

interface MultiGroupPredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  homeScore: number;
  awayScore: number;
  otherGroups: Group[];
  onConfirm: (selectedGroupIds: string[]) => Promise<void>;
  isSaving: boolean;
}

export function MultiGroupPredictionModal({
  isOpen,
  onClose,
  match,
  homeScore,
  awayScore,
  otherGroups,
  onConfirm,
  isSaving
}: MultiGroupPredictionModalProps) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Default to selecting all other groups whenever modal opens or otherGroups changes
  useEffect(() => {
    if (isOpen && otherGroups.length > 0) {
      setSelectedGroupIds(otherGroups.map(g => g.id));
    }
  }, [isOpen, otherGroups]);

  if (!isOpen || !match || otherGroups.length === 0) return null;

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedGroupIds.length === otherGroups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(otherGroups.map(g => g.id));
    }
  };

  const handleConfirm = async () => {
    if (selectedGroupIds.length === 0) {
      onClose();
      return;
    }
    await onConfirm(selectedGroupIds);
  };

  return (
    <BaseBottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title="¿Guardar en otros grupos?"
      zIndexClassName="z-[1050]"
    >
      <div className="space-y-4 pb-24 sm:pb-28">
        {/* Match and Score pill */}
        <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Pronóstico guardado</span>
            <span className="text-xs font-black text-white truncate">{match.homeTeam} vs {match.awayTeam}</span>
          </div>
          <div className="px-3 py-1 bg-blue-950/70 border border-blue-500/50 rounded-lg text-blue-300 font-mono font-black text-sm tracking-wider shrink-0 shadow-inner">
            {homeScore} - {awayScore}
          </div>
        </div>

        {/* Explanatory text */}
        <div className="flex items-center justify-between text-xs px-0.5">
          <p className="text-zinc-400 text-xs">
            Selecciona los grupos donde quieras replicar este mismo resultado:
          </p>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider shrink-0 ml-2"
          >
            {selectedGroupIds.length === otherGroups.length ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        </div>

        {/* List of groups with checkboxes */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
          {otherGroups.map(group => {
            const isChecked = selectedGroupIds.includes(group.id);
            return (
              <label
                key={group.id}
                onClick={() => toggleGroup(group.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-sm'
                    : 'bg-[#121215] border-zinc-800/80 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                    isChecked ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-bold truncate ${isChecked ? 'text-white' : 'text-zinc-300'}`}>
                      {group.name}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {group.members?.length || 1} participante{(group.members?.length || 1) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // Handled by container label click
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-950 cursor-pointer accent-blue-600 shrink-0 ml-2"
                />
              </label>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="w-1/3 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer text-center"
          >
            Solo en este
          </button>
          <button
            type="button"
            disabled={isSaving || selectedGroupIds.length === 0}
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <CopyCheck className="w-4 h-4" />
                <span>Confirmar ({selectedGroupIds.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </BaseBottomSheet>
  );
}
