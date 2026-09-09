import React, { useState } from 'react';
import { Achievement, getRarityColor } from '../data/achievements';
import { Sparkles, Lock, CheckCircle2, X } from 'lucide-react';
import { vibratePop } from '../lib/haptics';

interface AchievementBadgeProps {
  key?: React.Key;
  achievement: Achievement;
  isUnlocked: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTitle?: boolean;
}

export function AchievementBadge({
  achievement,
  isUnlocked,
  size = 'md',
  showTitle = true
}: AchievementBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const rarityColors = getRarityColor(achievement.rarity);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    vibratePop();
    setShowDetails(true);
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  }[size];

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center rounded-lg border font-bold transition-all active:scale-95 cursor-pointer select-none ${sizeClasses} ${
          isUnlocked 
            ? `${rarityColors.badge} hover:brightness-125 shadow-sm` 
            : 'bg-zinc-900/60 text-zinc-600 border-zinc-800/80 grayscale opacity-60 hover:opacity-90'
        }`}
        title={`${achievement.title} - ${isUnlocked ? 'Desbloqueado' : 'Bloqueado'} (Tocar para ver detalles)`}
      >
        <span className="shrink-0">{achievement.emoji}</span>
        {showTitle && (
          <span className="truncate max-w-[120px]">
            {achievement.name}
          </span>
        )}
        {!isUnlocked && (
          <Lock className="w-2.5 h-2.5 shrink-0 text-zinc-500 ml-0.5" />
        )}
      </button>

      {/* Interactive Tooltip Popover Modal */}
      {showDetails && (
        <div 
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowDetails(false)}
        >
          <div 
            className="bg-[#141418] border border-zinc-700/80 rounded-2xl w-full max-w-xs p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Top header */}
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${rarityColors.badge}`}>
                {achievement.rarity}
              </span>

              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Badge Icon & Name */}
            <div className="flex flex-col items-center text-center space-y-2 pt-1">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border ${
                isUnlocked ? `${rarityColors.badge} ${rarityColors.glow}` : 'bg-zinc-900 border-zinc-800 text-zinc-600 grayscale'
              }`}>
                {achievement.emoji}
              </div>
              <h3 className="text-base font-black text-white">
                {achievement.name}
              </h3>
              <p className="text-[11px] font-bold text-zinc-400 font-mono">
                {achievement.shortCondition}
              </p>
            </div>

            {/* Description Challenge */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 text-center">
              <p className="text-xs text-zinc-300 leading-relaxed">
                {achievement.description}
              </p>
            </div>

            {/* Status Footer */}
            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs font-bold">
              {isUnlocked ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡Trofeo Desbloqueado!</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Desafío Bloqueado</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
