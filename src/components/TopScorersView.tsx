import React, { useState } from 'react';
import { useTopScorers } from '../hooks/useTopScorers';
import { TeamBadge } from './TeamBadge';
import { Search, Trophy, RefreshCw, Award } from 'lucide-react';

export function TopScorersView() {
  const { scorers, loading } = useTopScorers();
  const [search, setSearch] = useState('');

  const filtered = scorers.filter(s => 
    s.player.toLowerCase().includes(search.toLowerCase()) ||
    s.team.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] space-y-3 text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs font-bold uppercase tracking-wider">Cargando goleadores...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-2">
      {/* Search Input */}
      <div className="relative shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar goleador o club (Mbappé, Haaland, Real Madrid)..."
          className="w-full bg-[#121215] border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Scorers Table Container (Internal Scroll) */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-[#121215] rounded-xl border border-zinc-800 shadow-lg relative overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {filtered.length > 0 ? (
          <table className="w-full text-left whitespace-nowrap text-xs border-collapse">
            <thead className="bg-[#18181b] text-[10px] uppercase font-black text-zinc-400 border-b border-zinc-800 sticky top-0 z-20 shadow-md">
              <tr>
                <th className="py-2.5 px-2 text-center w-8 min-w-[32px] sticky left-0 z-30 bg-[#18181b] border-r border-zinc-800">
                  #
                </th>
                <th className="py-2.5 px-3">
                  Jugador / Club
                </th>
                <th className="py-2.5 px-3 text-center w-24 min-w-[80px] bg-blue-950 font-black text-white border-l border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                  Goles
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filtered.map((scorer, idx) => {
                const isLeader = scorer.position === 1;
                const isTop3 = scorer.position <= 3;
                const rowBg = isLeader 
                  ? 'bg-amber-500/10' 
                  : isTop3 
                    ? 'bg-[#15151a]' 
                    : 'bg-[#121215]';

                const badgeStyle = scorer.position === 1
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : scorer.position === 2
                    ? 'bg-zinc-700/40 text-zinc-200 border-zinc-600'
                    : scorer.position === 3
                      ? 'bg-amber-900/30 text-amber-500 border-amber-800/50'
                      : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50';

                return (
                  <tr 
                    key={`${scorer.player}-${scorer.team}-${idx}`}
                    className={`hover:bg-zinc-800/40 transition-colors ${rowBg}`}
                  >
                    {/* Position Column */}
                    <td className="py-2 px-1 text-center sticky left-0 z-10 bg-[#141418] border-r border-zinc-800/60 font-mono">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black border ${badgeStyle}`}>
                        {scorer.position}
                      </span>
                    </td>

                    {/* Player & Club Column */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        <TeamBadge 
                          src={scorer.teamLogo || ''} 
                          teamName={scorer.team} 
                          size="sm" 
                          className="w-5 h-5 shrink-0" 
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-xs truncate" title={scorer.player}>
                              {scorer.player}
                            </span>
                            {isLeader && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-black inline-flex items-center gap-0.5 shrink-0">
                                👑 Pichichi
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {scorer.team}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Goals Column */}
                    <td className="py-2 px-3 text-center font-mono font-black text-sm text-amber-400 bg-blue-950/70 border-l border-zinc-800">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs select-none">⚽</span>
                        <span>{scorer.goals}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-12 px-4 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mx-auto text-zinc-500">
              <Award className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-white">
              {search ? `No se encontraron resultados para "${search}"` : 'Aún no hay goles registrados'}
            </p>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto leading-relaxed">
              {search 
                ? 'Prueba buscando con otro nombre o club.' 
                : 'A medida que se disputen los partidos y se sincronicen los resultados, los goleadores aparecerán clasificados automáticamente aquí.'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="shrink-0 pt-1">
        <div className="bg-[#121215] border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center justify-between text-[10px] text-zinc-400 shadow-sm">
          <span>Total de futbolistas con gol: <strong>{scorers.length}</strong></span>
          <span className="flex items-center gap-1 text-blue-400 font-bold">
            <Trophy className="w-3 h-3" />
            <span>UCL 2026/27</span>
          </span>
        </div>
      </div>
    </div>
  );
}
