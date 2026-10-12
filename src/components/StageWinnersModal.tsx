import React, { useState } from 'react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { Stage, StageStandingItem } from '../types';
import { UserAvatar } from './UserAvatar';
import { Trophy, Crown, Medal, Calendar, ChevronDown, ChevronUp, Layers, Target, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StageWinnersModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: Stage[];
  onSelectUser?: (userId: string) => void;
}

export function StageWinnersModal({
  isOpen,
  onClose,
  stages,
  onSelectUser,
}: StageWinnersModalProps) {
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  if (!isOpen) return null;

  const closedStages = stages
    .filter(s => s.status === 'closed')
    .sort((a, b) => (b.closedAt || b.createdAt) - (a.closedAt || a.createdAt));

  const activeStage = stages.find(s => s.status === 'active');

  const toggleExpand = (stageId: string) => {
    setExpandedStageId(prev => (prev === stageId ? null : stageId));
  };

  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), "d 'de' MMMM, yyyy · HH:mm", { locale: es });
    } catch {
      return '';
    }
  };

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Registro de Ganadores por Etapa"
      zIndexClassName="z-[1050]"
      contentClassName="p-4"
    >
      <div className="space-y-4 pb-28 max-h-[78vh] overflow-y-auto px-1 scrollbar-hide">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-amber-500/20 via-zinc-900 to-[#121215] border border-amber-500/40 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl shadow-[0_0_15px_rgba(245,158,11,0.25)] shrink-0">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                Salón de la Fama
              </h3>
              <p className="text-xs text-zinc-400 leading-tight">
                Historial oficial de podios y campeones de cada etapa del torneo.
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-[11px] font-medium text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{closedStages.length} {closedStages.length === 1 ? 'etapa finalizada' : 'etapas finalizadas'}</span>
            </div>
            {activeStage && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-bold">1 en juego: {activeStage.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* List of Closed Stages */}
        {closedStages.length === 0 ? (
          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-8 text-center text-zinc-400 space-y-2">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-300">Aún no hay etapas finalizadas</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
              Cuando el administrador cierre una etapa, aquí quedará registrado el podio oficial de ganadores.
            </p>
          </div>
        ) : (
          closedStages.map((stage) => {
            const winners = stage.winners || [];
            const top1 = winners.find(w => w.rank === 1);
            const top2 = winners.find(w => w.rank === 2);
            const top3 = winners.find(w => w.rank === 3);
            const isExpanded = expandedStageId === stage.id;
            const fullStandings = stage.fullStandings || [];

            return (
              <div
                key={stage.id}
                className="bg-[#121215] border border-zinc-800/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-md transition-all hover:border-zinc-700/80"
              >
                {/* Stage Info Header */}
                <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                        Finalizada
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                        {stage.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-zinc-500" />
                        {stage.matchGroups.join(', ')}
                      </span>
                      {stage.closedAt && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            {formatDate(stage.closedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Podium Cards (1st, 2nd, 3rd) */}
                <div className="grid grid-cols-3 gap-1.5 items-end pt-1">
                  {/* 2nd Place */}
                  <div
                    onClick={() => top2 && onSelectUser?.(top2.userId)}
                    className={`bg-zinc-900/60 border border-zinc-700/60 rounded-xl p-2 text-center flex flex-col items-center order-1 shadow-sm transition-transform ${
                      top2 ? 'cursor-pointer hover:bg-zinc-800/80 hover:scale-[1.02]' : 'opacity-40'
                    }`}
                  >
                    <div className="relative mb-1">
                      <UserAvatar
                        src={top2?.photoURL}
                        name={top2?.nickname || top2?.displayName || ''}
                        size="md"
                        className="border-zinc-400"
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-zinc-100 border border-zinc-500 flex items-center justify-center font-black text-[8px]">
                        2
                      </span>
                    </div>
                    <span className="font-bold text-[11px] text-zinc-200 truncate max-w-full block leading-tight">
                      {top2?.nickname || top2?.displayName || '—'}
                    </span>
                    <span className="font-mono font-black text-zinc-300 text-xs mt-1">
                      {top2?.points || 0} <span className="text-[8px] font-normal text-zinc-500">PTS</span>
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono">
                      {top2?.exactMatches || 0} exactos
                    </span>
                  </div>

                  {/* 1st Place */}
                  <div
                    onClick={() => top1 && onSelectUser?.(top1.userId)}
                    className={`bg-gradient-to-b from-amber-500/20 to-zinc-900 border border-amber-500/60 rounded-xl p-2.5 text-center flex flex-col items-center order-2 shadow-lg transition-transform ${
                      top1 ? 'cursor-pointer hover:from-amber-500/30 hover:scale-[1.03]' : 'opacity-40'
                    }`}
                  >
                    <Crown className="w-4 h-4 text-amber-400 mb-0.5 drop-shadow-md" />
                    <div className="relative mb-1">
                      <UserAvatar
                        src={top1?.photoURL}
                        name={top1?.nickname || top1?.displayName || ''}
                        size="lg"
                        className="border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 font-black text-[9px] flex items-center justify-center">
                        1
                      </span>
                    </div>
                    <span className="font-black text-xs text-amber-100 truncate max-w-full block leading-tight">
                      {top1?.nickname || top1?.displayName || '—'}
                    </span>
                    <span className="font-mono font-black text-amber-400 text-sm mt-1">
                      {top1?.points || 0} <span className="text-[9px] font-bold text-amber-500/80">PTS</span>
                    </span>
                    <span className="text-[9px] text-amber-300 font-bold font-mono">
                      🎯 {top1?.exactMatches || 0} exactos
                    </span>
                  </div>

                  {/* 3rd Place */}
                  <div
                    onClick={() => top3 && onSelectUser?.(top3.userId)}
                    className={`bg-zinc-900/60 border border-amber-900/40 rounded-xl p-2 text-center flex flex-col items-center order-3 shadow-sm transition-transform ${
                      top3 ? 'cursor-pointer hover:bg-zinc-800/80 hover:scale-[1.02]' : 'opacity-40'
                    }`}
                  >
                    <div className="relative mb-1">
                      <UserAvatar
                        src={top3?.photoURL}
                        name={top3?.nickname || top3?.displayName || ''}
                        size="md"
                        className="border-amber-700/80"
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-900 text-amber-200 border border-amber-700 flex items-center justify-center font-black text-[8px]">
                        3
                      </span>
                    </div>
                    <span className="font-bold text-[11px] text-zinc-200 truncate max-w-full block leading-tight">
                      {top3?.nickname || top3?.displayName || '—'}
                    </span>
                    <span className="font-mono font-black text-amber-600 text-xs mt-1">
                      {top3?.points || 0} <span className="text-[8px] font-normal text-zinc-500">PTS</span>
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono">
                      {top3?.exactMatches || 0} exactos
                    </span>
                  </div>
                </div>

                {/* Expand Full Standings Button */}
                {fullStandings.length > 0 && (
                  <div className="pt-1 border-t border-zinc-800/60">
                    <button
                      onClick={() => toggleExpand(stage.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Ocultar clasificación completa' : `Ver tabla completa (${fullStandings.length} participantes)`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 bg-zinc-950/70 rounded-xl border border-zinc-800/80 overflow-hidden">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-zinc-900/90 text-[10px] uppercase font-black text-zinc-400 border-b border-zinc-800">
                            <tr>
                              <th className="px-2.5 py-1.5 text-center w-8">#</th>
                              <th className="px-2.5 py-1.5">Participante</th>
                              <th className="px-2.5 py-1.5 text-center">PTS</th>
                              <th className="px-2.5 py-1.5 text-center">Exactos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/40">
                            {fullStandings.map((item, idx) => (
                              <tr
                                key={item.userId}
                                onClick={() => onSelectUser?.(item.userId)}
                                className="hover:bg-zinc-800/30 cursor-pointer transition-colors"
                              >
                                <td className="px-2.5 py-1.5 text-center font-bold">
                                  {item.rank === 1 ? (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-black text-[9px] border border-amber-500/40">1</span>
                                  ) : item.rank === 2 ? (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700/30 text-zinc-300 font-black text-[9px] border border-zinc-600">2</span>
                                  ) : item.rank === 3 ? (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-900/30 text-amber-600 font-black text-[9px] border border-amber-800/50">3</span>
                                  ) : (
                                    <span className="text-zinc-500 font-mono text-[10px]">{item.rank}</span>
                                  )}
                                </td>
                                <td className="px-2.5 py-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <UserAvatar
                                      src={item.photoURL}
                                      name={item.nickname || item.displayName}
                                      size="sm"
                                    />
                                    <span className="font-bold text-white text-[11px] truncate max-w-[140px]">
                                      {item.nickname || item.displayName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2.5 py-1.5 text-center font-mono font-black text-amber-400 text-xs">
                                  {item.points}
                                </td>
                                <td className="px-2.5 py-1.5 text-center font-mono text-zinc-400 text-xs">
                                  <div className="inline-flex items-center gap-0.5 justify-center">
                                    <Target className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>{item.exactMatches}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </BaseBottomSheet>
  );
}
