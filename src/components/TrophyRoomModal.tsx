import React, { useState } from 'react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { User } from '../types';
import { ACHIEVEMENTS, AchievementCategory, getRarityColor, isAchievementUnlocked } from '../data/achievements';
import { Trophy, Lock, CheckCircle2, Award, Sparkles, Filter } from 'lucide-react';

interface TrophyRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

type FilterType = 'all' | 'unlocked' | 'locked';
type CategoryFilter = 'all' | AchievementCategory;

export function TrophyRoomModal({ isOpen, onClose, user }: TrophyRoomModalProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  if (!isOpen) return null;

  // Calculate stats
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter(a => isAchievementUnlocked(a, user)).length;
  const percentage = Math.round((unlockedCount / total) * 100);

  const filteredAchievements = ACHIEVEMENTS.filter(a => {
    const unlocked = isAchievementUnlocked(a, user);
    if (filter === 'unlocked' && !unlocked) return false;
    if (filter === 'locked' && unlocked) return false;
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    return true;
  });

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Sala de Trofeos"
      zIndexClassName="z-[1050]"
      contentClassName="p-4"
    >
      <div className="space-y-4 pb-28 max-h-[75vh] overflow-y-auto px-1">
        {/* Header Progress Hero */}
        <div className="bg-gradient-to-br from-amber-500/15 via-zinc-900/80 to-[#141418] border border-amber-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                🏆
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Vitrina de Logros
                </h3>
                <p className="text-xs text-zinc-400">
                  {user?.nickname || user?.displayName || 'Participante'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-mono font-black text-amber-400">
                {unlockedCount} / {total}
              </div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Desbloqueados
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden border border-zinc-700/50">
            <div 
              className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold mt-1.5 px-0.5">
            <span>{percentage}% completado</span>
            <span>{total - unlockedCount} restantes</span>
          </div>
        </div>

        {/* Filters Controls */}
        <div className="space-y-2">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer select-none ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Todos ({total})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unlocked')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer select-none ${
                filter === 'unlocked' 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Conseguidos ({unlockedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('locked')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer select-none ${
                filter === 'locked' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Bloqueados ({total - unlockedCount})
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                categoryFilter === 'all' 
                  ? 'bg-zinc-700 text-white border border-zinc-600' 
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800/80 hover:text-zinc-300'
              }`}
            >
              Todas las categorías
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('match')}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                categoryFilter === 'match' 
                  ? 'bg-blue-600/40 text-blue-300 border border-blue-500/50' 
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800/80 hover:text-zinc-300'
              }`}
            >
              Partidos
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('jornada')}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                categoryFilter === 'jornada' 
                  ? 'bg-purple-600/40 text-purple-300 border border-purple-500/50' 
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800/80 hover:text-zinc-300'
              }`}
            >
              Jornadas
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('streak')}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                categoryFilter === 'streak' 
                  ? 'bg-amber-600/40 text-amber-300 border border-amber-500/50' 
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800/80 hover:text-zinc-300'
              }`}
            >
              Rachas
            </button>
          </div>
        </div>

        {/* Trophies Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {filteredAchievements.map(achievement => {
            const unlocked = isAchievementUnlocked(achievement, user);
            const rarity = getRarityColor(achievement.rarity);

            return (
              <div
                key={achievement.id}
                className={`relative rounded-2xl p-3.5 border transition-all ${
                  unlocked
                    ? `bg-[#16161b] ${rarity.border} ${rarity.glow} shadow-md`
                    : 'bg-[#101013] border-zinc-800/80 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${
                    unlocked ? rarity.badge : 'bg-zinc-900 border-zinc-800 text-zinc-600 grayscale'
                  }`}>
                    {achievement.emoji}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className={`text-xs font-black truncate ${unlocked ? 'text-white' : 'text-zinc-400'}`}>
                        {achievement.name}
                      </h4>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border shrink-0 ${
                        unlocked ? rarity.badge : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        {achievement.rarity}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-tight mb-2">
                      {achievement.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px]">
                      <span className="font-mono text-zinc-500 truncate">
                        {achievement.shortCondition}
                      </span>
                      {unlocked ? (
                        <span className="flex items-center gap-1 font-bold text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Conseguido</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-bold text-zinc-600 shrink-0">
                          <Lock className="w-3 h-3" />
                          <span>Bloqueado</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredAchievements.length === 0 && (
          <div className="py-8 text-center text-zinc-500 text-xs">
            No se encontraron trofeos con los filtros seleccionados.
          </div>
        )}
      </div>
    </BaseBottomSheet>
  );
}
