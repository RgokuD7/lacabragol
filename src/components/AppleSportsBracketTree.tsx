import React, { useRef, useState } from 'react';
import { IRoundProps } from 'react-brackets';
import { Trophy, Calendar, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { TeamBadge } from './TeamBadge';
import { StageInfo } from './AppleSportsRangeScrubber';

interface AppleSportsBracketTreeProps {
  rounds: IRoundProps[];
  stages: StageInfo[];
  startIdx: number;
  endIdx: number;
  onShiftRange: (direction: 'left' | 'right') => void;
}

// Map of common team names to official 3-letter abbreviation
const TEAM_ABBREV_MAP: Record<string, { code: string; bg?: string }> = {
  'Real Madrid': { code: 'RMA' },
  'Liverpool': { code: 'LIV' },
  'Barcelona': { code: 'BAR' },
  'FC Barcelona': { code: 'BAR' },
  'Bayern München': { code: 'BAY' },
  'Bayern Munich': { code: 'BAY' },
  'Manchester City': { code: 'MCI' },
  'Arsenal': { code: 'ARS' },
  'Inter': { code: 'INT' },
  'Inter Milan': { code: 'INT' },
  'Paris Saint-Germain': { code: 'PSG' },
  'PSG': { code: 'PSG' },
  'Borussia Dortmund': { code: 'BVB' },
  'Dortmund': { code: 'BVB' },
  'Atlético Madrid': { code: 'ATM' },
  'Atletico Madrid': { code: 'ATM' },
  'Bayer Leverkusen': { code: 'B04' },
  'Leverkusen': { code: 'B04' },
  'Juventus': { code: 'JUV' },
  'AC Milan': { code: 'MIL' },
  'Milan': { code: 'MIL' },
  'Aston Villa': { code: 'AVL' },
  'Sporting CP': { code: 'SCP' },
  'Sporting': { code: 'SCP' },
  'Benfica': { code: 'BEN' },
  'Monaco': { code: 'ASM' },
  'Atalanta': { code: 'ATA' },
  'Feyenoord': { code: 'FEY' },
  'Lille': { code: 'LIL' },
  'Celtic': { code: 'CEL' },
  'Brest': { code: 'SB29' },
  'PSV Eindhoven': { code: 'PSV' },
  'PSV': { code: 'PSV' },
  'VfB Stuttgart': { code: 'VFB' },
  'Stuttgart': { code: 'VFB' },
  'Girona': { code: 'GIR' },
  'Bologna': { code: 'BOL' },
  'Sparta Praha': { code: 'SPA' },
  'Shakhtar Donetsk': { code: 'SHK' },
  'Dinamo Zagreb': { code: 'ZAG' },
  'Crvena Zvezda': { code: 'CZV' },
  'Red Star': { code: 'CZV' },
  'Salzburg': { code: 'RBS' },
  'Sturm Graz': { code: 'STU' },
  'Young Boys': { code: 'YB' },
  'Slovan Bratislava': { code: 'SLO' },
  'Club Brugge': { code: 'CLU' },
  'Leipzig': { code: 'RBL' },
  'RB Leipzig': { code: 'RBL' },
};

function getTeamCode(name: string): string {
  if (!name || name === 'TBD' || name.startsWith('Por determ') || name.startsWith('Ganador') || name.includes('Fase de Liga') || name.startsWith('Finalista')) {
    if (name.includes('Fase de Liga')) {
      const match = name.match(/(\d+)°/);
      return match ? `#${match[1]}` : 'TBD';
    }
    return 'TBD';
  }
  if (TEAM_ABBREV_MAP[name]) {
    return TEAM_ABBREV_MAP[name].code;
  }
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.substring(0, 3).toUpperCase() || 'TBD';
}

export const AppleSportsBracketTree: React.FC<AppleSportsBracketTreeProps> = ({
  rounds,
  stages,
  startIdx,
  endIdx,
  onShiftRange,
}) => {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Filter visible rounds slice
  const visibleRounds = rounds.slice(startIdx, endIdx + 1);
  const visibleStages = stages.slice(startIdx, endIdx + 1);
  const visibleCount = visibleRounds.length;

  // Touch handlers for horizontal swipe between phases
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = touchStartXRef.current - endX;
    const diffY = (touchStartYRef.current || 0) - endY;

    // Detect intentional horizontal swipe (more horizontal than vertical)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      if (diffX > 0) {
        // Swiped left -> move window to next phase on the right
        onShiftRange('right');
      } else {
        // Swiped right -> move window to prev phase on the left
        onShiftRange('left');
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full select-none"
    >
      {/* ========================================================================= */}
      {/* CASE 1: 1 PHASE (ZOOMED IN - DENSE PHONE DESIGN)                          */}
      {/* ========================================================================= */}
      {visibleCount === 1 && (
        <div className="space-y-2">
          {/* Phase Header */}
          <div className="flex items-center justify-between px-1 py-1 border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                {visibleStages[0]?.full}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
              <span>{visibleRounds[0]?.seeds?.length || 0} Cruces</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">Desliza ⟷</span>
            </div>
          </div>

          {/* Compact Match Cards */}
          <div className="space-y-2">
            {visibleRounds[0]?.seeds?.map((seed, sIdx) => {
              const team1 = seed.teams[0];
              const team2 = seed.teams[1];
              const isTbd1 = !team1?.name || team1.name === 'TBD' || team1.name.includes('Fase de Liga') || team1.name.startsWith('Ganador');
              const isTbd2 = !team2?.name || team2.name === 'TBD' || team2.name.includes('Fase de Liga') || team2.name.startsWith('Ganador');

              return (
                <div
                  key={seed.id || sIdx}
                  className="bg-[#18181b] border border-zinc-800 rounded-xl p-2.5 shadow-sm space-y-1.5"
                >
                  {/* Match Timing */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-1 border-b border-zinc-800/60">
                    <span className="flex items-center gap-1 font-medium truncate">
                      <Calendar className="w-3 h-3 text-zinc-500 shrink-0" />
                      {seed.date || 'Por disputar'}
                    </span>
                    <span className="font-mono text-zinc-400 text-[9px] bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 shrink-0">
                      Cruce {sIdx + 1}
                    </span>
                  </div>

                  {/* Team 1 */}
                  <div className="flex items-center justify-between py-0.5 px-1 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      {isTbd1 ? (
                        <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[9px] text-zinc-400 font-bold shrink-0">
                          {team1?.name?.includes('°') ? team1.name.split('°')[0] + '°' : '?'}
                        </div>
                      ) : (
                        <TeamBadge src={team1?.logo} teamName={team1?.name || ''} size="sm" className="w-5 h-5 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${isTbd1 ? 'text-zinc-400 italic' : 'text-white font-semibold'}`}>
                        {team1?.name || 'Por determinar'}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-zinc-300 shrink-0 ml-2">
                      {team1?.score ?? '-'}
                    </span>
                  </div>

                  {/* Team 2 */}
                  <div className="flex items-center justify-between py-0.5 px-1 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      {isTbd2 ? (
                        <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[9px] text-zinc-400 font-bold shrink-0">
                          {team2?.name?.includes('°') ? team2.name.split('°')[0] + '°' : '?'}
                        </div>
                      ) : (
                        <TeamBadge src={team2?.logo} teamName={team2?.name || ''} size="sm" className="w-5 h-5 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${isTbd2 ? 'text-zinc-400 italic' : 'text-white font-semibold'}`}>
                        {team2?.name || 'Por determinar'}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-zinc-300 shrink-0 ml-2">
                      {team2?.score ?? '-'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE 2: MULTI-COLUMN TREE VIEW (2 TO 5 COLUMNS FITTING 100% WIDTH)        */}
      {/* ========================================================================= */}
      {visibleCount > 1 && (
        <div className="w-full space-y-2">
          {/* Column Header Titles */}
          <div
            className="grid w-full text-center px-0.5 pb-1 border-b border-zinc-800 gap-1"
            style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}
          >
            {visibleStages.map((st) => (
              <div key={st.id} className="text-center truncate">
                <span className="text-[10px] sm:text-xs font-black text-zinc-300 tracking-tight">
                  {st.short}
                </span>
              </div>
            ))}
          </div>

          {/* Multi-column Grid */}
          <div
            className="grid w-full gap-1 sm:gap-2 items-stretch relative"
            style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}
          >
            {visibleRounds.map((round, colIdx) => {
              const seeds = round.seeds || [];
              const isLastCol = colIdx === visibleCount - 1;

              return (
                <div
                  key={round.title || colIdx}
                  className="flex flex-col justify-around py-0.5 gap-1.5 relative min-w-0"
                >
                  {seeds.map((seed, sIdx) => {
                    const t1 = seed.teams[0];
                    const t2 = seed.teams[1];
                    const code1 = getTeamCode(t1?.name || '');
                    const code2 = getTeamCode(t2?.name || '');
                    const isTbd1 = code1 === 'TBD' || code1.startsWith('#');
                    const isTbd2 = code2 === 'TBD' || code2.startsWith('#');

                    return (
                      <div key={seed.id || sIdx} className="relative group flex flex-col justify-center">
                        {/* Match Node Capsule (Dark Zinc Clean Pill) */}
                        <div className="bg-[#18181b] border border-zinc-800 rounded-lg sm:rounded-xl p-1 sm:p-1.5 shadow-sm hover:border-zinc-600 transition-all">
                          {/* Team 1 Slot */}
                          <div className="flex items-center justify-between gap-1 py-0.5 px-0.5">
                            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                              {isTbd1 ? (
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[8px] sm:text-[9px] text-zinc-400 font-bold shrink-0">
                                  {code1.startsWith('#') ? code1.replace('#', '') : '?'}
                                </div>
                              ) : (
                                <TeamBadge src={t1?.logo} teamName={t1?.name || ''} size="sm" className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                              )}
                              <span className={`text-[9px] sm:text-[11px] font-bold truncate ${isTbd1 ? 'text-zinc-500 font-normal' : 'text-white'}`}>
                                {visibleCount <= 2 ? (t1?.name?.split(' ')[0] || code1) : code1}
                              </span>
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-zinc-400 shrink-0">
                              {t1?.score !== '-' ? t1?.score : ''}
                            </span>
                          </div>

                          {/* Line Divider */}
                          <div className="h-[1px] bg-zinc-800/80 my-0.5" />

                          {/* Team 2 Slot */}
                          <div className="flex items-center justify-between gap-1 py-0.5 px-0.5">
                            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                              {isTbd2 ? (
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[8px] sm:text-[9px] text-zinc-400 font-bold shrink-0">
                                  {code2.startsWith('#') ? code2.replace('#', '') : '?'}
                                </div>
                              ) : (
                                <TeamBadge src={t2?.logo} teamName={t2?.name || ''} size="sm" className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                              )}
                              <span className={`text-[9px] sm:text-[11px] font-bold truncate ${isTbd2 ? 'text-zinc-500 font-normal' : 'text-white'}`}>
                                {visibleCount <= 2 ? (t2?.name?.split(' ')[0] || code2) : code2}
                              </span>
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-zinc-400 shrink-0">
                              {t2?.score !== '-' ? t2?.score : ''}
                            </span>
                          </div>
                        </div>

                        {/* Connector Line to Next Round */}
                        {!isLastCol && (
                          <div
                            className="hidden sm:block absolute top-1/2 -right-1 sm:-right-2 w-1 sm:w-2 h-[1px] bg-zinc-700/60"
                            style={{ zIndex: 0 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
