import React, { useState } from 'react';
import { useTopAssists } from '../hooks/useTopAssists';
import { TeamBadge } from './TeamBadge';
import { Search, Trophy, RefreshCw, Award, Info } from 'lucide-react';

export function TopAssistsView() {
  const { assisters, loading } = useTopAssists();
  const [search, setSearch] = useState('');

  const filtered = assisters.filter(s => 
    s.player.toLowerCase().includes(search.toLowerCase()) ||
    s.team.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] space-y-3 text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
        <p className="text-xs font-bold uppercase tracking-wider">Cargando asistidores...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-2">
      {/* Disclaimer Box */}
      <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-2.5 flex items-start gap-2.5 shrink-0 text-purple-200/90 text-xs shadow-sm">
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          <strong>Aviso:</strong> Esta lista está basada en los datos recuperados de partidos en vivo y archivos JSON importados; puede que contenga discrepancias o esté incompleta.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar asistidor o club (De Bruyne, Yamal, Bayern)..."
          className="w-full bg-[#121215] border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {/* Assisters Table Container (Internal Scroll) */}
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
                <th className="py-2.5 px-3 text-center w-24 min-w-[80px] bg-purple-950 font-black text-white border-l border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                  Asistencias
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filtered.map((assister, idx) => {
                const isLeader = assister.position === 1;
                const isTop3 = assister.position <= 3;
                const rowBg = isLeader 
                  ? 'bg-purple-500/10' 
                  : isTop3 
                    ? 'bg-[#15151a]' 
                    : 'bg-[#121215]';

                const badgeStyle = assister.position === 1
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : assister.position === 2
                    ? 'bg-zinc-700/40 text-zinc-200 border-zinc-600'
                    : assister.position === 3
                      ? 'bg-amber-900/30 text-amber-500 border-amber-800/50'
                      : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50';

                return (
                  <tr 
                    key={`${assister.player}-${assister.team}-${idx}`}
                    className={`hover:bg-zinc-800/40 transition-colors ${rowBg}`}
                  >
                    {/* Position Column */}
                    <td className="py-2 px-1 text-center sticky left-0 z-10 bg-[#141418] border-r border-zinc-800/60 font-mono">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black border ${badgeStyle}`}>
                        {assister.position}
                      </span>
                    </td>

                    {/* Player & Club Column */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        {/* Player Photo with Miniature Club Badge */}
                        <div className="relative shrink-0">
                          {assister.playerPhoto ? (
                            <img 
                              src={assister.playerPhoto} 
                              alt={assister.player} 
                              className="w-8 h-8 rounded-full object-cover border border-purple-500/40 bg-zinc-800 shadow"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(assister.player)}&background=27272a&color=fff&size=128&bold=true`;
                              }}
                            />
                          ) : (
                            <img 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(assister.player)}&background=27272a&color=fff&size=128&bold=true`}
                              alt={assister.player}
                              className="w-8 h-8 rounded-full object-cover border border-zinc-700 bg-zinc-800 shadow"
                            />
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-zinc-950 rounded-full p-0.5 border border-zinc-700/80 shadow">
                            <TeamBadge 
                              src={assister.teamLogo || ''} 
                              teamName={assister.team} 
                              size="sm" 
                              className="w-3.5 h-3.5" 
                            />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-xs truncate" title={assister.player}>
                              {assister.player}
                            </span>
                            {isLeader && (
                              <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1 py-0.2 rounded font-black inline-flex items-center gap-0.5 shrink-0">
                                👟 Líder Asistencias
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {assister.team}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Assists Column */}
                    <td className="py-2 px-3 text-center font-mono font-black text-sm text-purple-300 bg-purple-950/70 border-l border-zinc-800">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs select-none">👟</span>
                        <span>{assister.assists}</span>
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
              {search ? `No se encontraron resultados para "${search}"` : 'Aún no hay asistencias registradas'}
            </p>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto leading-relaxed">
              {search 
                ? 'Prueba buscando con otro nombre o club.' 
                : 'A medida que se disputen los partidos y se sincronicen las asistencias, los futbolistas aparecerán clasificados automáticamente aquí.'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="shrink-0 pt-1">
        <div className="bg-[#121215] border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center justify-between text-[10px] text-zinc-400 shadow-sm">
          <span>Total de futbolistas con asistencia: <strong>{assisters.length}</strong></span>
          <span className="flex items-center gap-1 text-purple-400 font-bold">
            <Trophy className="w-3 h-3" />
            <span>UCL 2026/27</span>
          </span>
        </div>
      </div>
    </div>
  );
}
