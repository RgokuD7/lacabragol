import React, { useState, useEffect, useMemo } from 'react';
import { IRoundProps } from 'react-brackets';
import { TeamBadge } from '../components/TeamBadge';
import { AppleSportsRangeScrubber, StageInfo } from '../components/AppleSportsRangeScrubber';
import { AppleSportsBracketTree } from '../components/AppleSportsBracketTree';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { 
  Trophy, 
  Search, 
  RefreshCw, 
  Table2, 
  GitFork, 
  RotateCcw,
  Info
} from 'lucide-react';

interface StandingTeam {
  id?: number;
  name: string;
  shortName: string;
  nameCode?: string;
  logo: string;
  country?: string;
}

interface StandingRow {
  position: number;
  team: StandingTeam;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  scoresFor: number;
  scoresAgainst: number;
  scoreDiff: number;
  points: number;
  promotion: string;
}

interface CupParticipant {
  team?: StandingTeam;
  winner?: boolean;
  order?: number;
}

interface CupBlock {
  id: number;
  result?: string;
  homeTeamScore?: string;
  awayTeamScore?: string;
  finished?: boolean;
  eventInProgress?: boolean;
  participants?: CupParticipant[];
}

interface CupRound {
  id?: number;
  name?: string;
  description?: string;
  blocks?: CupBlock[];
}

interface CupTree {
  id: number;
  name: string;
  rounds?: CupRound[];
}

// Official Standard Knockout Bracket Structure for UCL (Projected / TBD - No fake scores)
const DEFAULT_UCL_ROUNDS: IRoundProps[] = [
  {
    title: '16avos / Playoffs',
    seeds: [
      {
        id: 'po_1',
        date: 'Ida: 16 Feb · Vuelta: 23 Feb',
        teams: [
          { name: '9° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '24° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'po_2',
        date: 'Ida: 16 Feb · Vuelta: 23 Feb',
        teams: [
          { name: '10° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '23° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'po_3',
        date: 'Ida: 17 Feb · Vuelta: 24 Feb',
        teams: [
          { name: '11° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '22° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'po_4',
        date: 'Ida: 17 Feb · Vuelta: 24 Feb',
        teams: [
          { name: '12° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '21° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'po_5',
        date: 'Ida: 16 Feb · Vuelta: 23 Feb',
        teams: [
          { name: '13° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '20° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'po_6',
        date: 'Ida: 16 Feb · Vuelta: 23 Feb',
        teams: [
          { name: '14° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '19° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'po_7',
        date: 'Ida: 17 Feb · Vuelta: 24 Feb',
        teams: [
          { name: '15° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '18° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'po_8',
        date: 'Ida: 17 Feb · Vuelta: 24 Feb',
        teams: [
          { name: '16° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: '17° Fase de Liga', score: '-', isWinner: false, logo: '' }
        ]
      }
    ]
  },
  {
    title: 'Octavos de Final',
    seeds: [
      {
        id: 'r16_1',
        date: 'Ida: 4 Mar · Vuelta: 11 Mar',
        teams: [
          { name: '1° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 1', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'r16_2',
        date: 'Ida: 4 Mar · Vuelta: 11 Mar',
        teams: [
          { name: '2° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 2', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'r16_3',
        date: 'Ida: 5 Mar · Vuelta: 12 Mar',
        teams: [
          { name: '3° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 3', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'r16_4',
        date: 'Ida: 5 Mar · Vuelta: 12 Mar',
        teams: [
          { name: '4° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 4', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'r16_5',
        date: 'Ida: 4 Mar · Vuelta: 11 Mar',
        teams: [
          { name: '5° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 5', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'r16_6',
        date: 'Ida: 4 Mar · Vuelta: 11 Mar',
        teams: [
          { name: '6° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 6', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'r16_7',
        date: 'Ida: 5 Mar · Vuelta: 12 Mar',
        teams: [
          { name: '7° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 7', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'r16_8',
        date: 'Ida: 5 Mar · Vuelta: 12 Mar',
        teams: [
          { name: '8° Fase de Liga', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Playoff 8', score: '-', isWinner: false, logo: '' }
        ]
      }
    ]
  },
  {
    title: 'Cuartos de Final',
    seeds: [
      {
        id: 'qf_1',
        date: 'Ida: 8 Abr · Vuelta: 15 Abr',
        teams: [
          { name: 'Ganador Octavos 1', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Octavos 2', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'qf_2',
        date: 'Ida: 8 Abr · Vuelta: 15 Abr',
        teams: [
          { name: 'Ganador Octavos 3', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Octavos 4', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'qf_3',
        date: 'Ida: 9 Abr · Vuelta: 16 Abr',
        teams: [
          { name: 'Ganador Octavos 5', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Octavos 6', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'qf_4',
        date: 'Ida: 9 Abr · Vuelta: 16 Abr',
        teams: [
          { name: 'Ganador Octavos 7', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Octavos 8', score: '-', isWinner: false, logo: '' }
        ]
      }
    ]
  },
  {
    title: 'Semifinales',
    seeds: [
      {
        id: 'sf_1',
        date: 'Ida: 29 Abr · Vuelta: 6 May',
        teams: [
          { name: 'Ganador Cuartos 1', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Cuartos 2', score: '-', isWinner: false, logo: '' }
        ]
      },
      {
        id: 'sf_2',
        date: 'Ida: 30 Abr · Vuelta: 7 May',
        teams: [
          { name: 'Ganador Cuartos 3', score: '-', isWinner: false, logo: '' },
          { name: 'Ganador Cuartos 4', score: '-', isWinner: false, logo: '' }
        ]
      }
    ]
  },
  {
    title: 'Gran Final',
    seeds: [
      {
        id: 'final_1',
        date: '30 Mayo 2027 · Munich Arena',
        teams: [
          { name: 'Finalista 1', score: '-', isWinner: false, logo: '' },
          { name: 'Finalista 2', score: '-', isWinner: false, logo: '' }
        ]
      }
    ]
  }
];

export function StandingsTab() {
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [cupTrees, setCupTrees] = useState<CupTree[]>([]);
  const [seasonInfo, setSeasonInfo] = useState<{ id: number; name: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'brackets'>('table');

  // Apple Sports Scrubber Stage Range State
  const [startRoundIdx, setStartRoundIdx] = useState<number>(0);
  const [endRoundIdx, setEndRoundIdx] = useState<number>(4);
  const [activePreset, setActivePreset] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'system', 'standings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.standings && Array.isArray(data.standings)) {
          setStandings(data.standings);
        }
        if (data.season) {
          setSeasonInfo(data.season);
        }
        if (data.cupTrees && Array.isArray(data.cupTrees)) {
          setCupTrees(data.cupTrees);
        }
      }
      setLoading(false);
    }, (err) => {
      console.error("Failed to load standings from DB:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredStandings = useMemo(() => {
    if (!searchQuery.trim()) return standings;
    const q = searchQuery.toLowerCase();
    return standings.filter(s => 
      s.team.name.toLowerCase().includes(q) || 
      s.team.shortName.toLowerCase().includes(q)
    );
  }, [standings, searchQuery]);

  const parsedBracketRounds = useMemo<IRoundProps[]>(() => {
    if (!cupTrees || cupTrees.length === 0) {
      return DEFAULT_UCL_ROUNDS;
    }

    const primaryTree = cupTrees[0];
    if (!primaryTree.rounds || primaryTree.rounds.length === 0) {
      return DEFAULT_UCL_ROUNDS;
    }

    try {
      const mappedRounds: IRoundProps[] = primaryTree.rounds.map((rnd, rIdx) => {
        const roundTitle = rnd.name || rnd.description || `Ronda ${rIdx + 1}`;
        const seeds = (rnd.blocks || []).map((block, bIdx) => {
          const p1 = block.participants?.[0];
          const p2 = block.participants?.[1];

          const t1Name = p1?.team?.name || 'Por determinar';
          const t2Name = p2?.team?.name || 'Por determinar';

          const t1Logo = p1?.team?.logo || (p1?.team?.id ? `https://img.sofascore.com/api/v1/team/${p1.team.id}/image` : '');
          const t2Logo = p2?.team?.logo || (p2?.team?.id ? `https://img.sofascore.com/api/v1/team/${p2.team.id}/image` : '');

          const score1 = block.homeTeamScore !== undefined && block.homeTeamScore !== '' ? block.homeTeamScore : '-';
          const score2 = block.awayTeamScore !== undefined && block.awayTeamScore !== '' ? block.awayTeamScore : '-';

          return {
            id: block.id || `${rIdx}_${bIdx}`,
            date: block.finished ? 'Finalizado' : block.eventInProgress ? 'En Vivo' : 'Programado',
            teams: [
              {
                name: t1Name,
                score: score1,
                isWinner: p1?.winner ?? false,
                logo: t1Logo
              },
              {
                name: t2Name,
                score: score2,
                isWinner: p2?.winner ?? false,
                logo: t2Logo
              }
            ]
          };
        });

        return {
          title: roundTitle,
          seeds: seeds.length > 0 ? seeds : DEFAULT_UCL_ROUNDS[rIdx]?.seeds || []
        };
      });

      if (mappedRounds.length === 5) {
        return mappedRounds;
      }
      return DEFAULT_UCL_ROUNDS;
    } catch (e) {
      console.warn("Could not parse live cup tree, using official UCL layout:", e);
      return DEFAULT_UCL_ROUNDS;
    }
  }, [cupTrees]);

  // Stage info for Apple Sports Scrubber
  const roundStages = useMemo<StageInfo[]>(() => {
    return [
      { id: 0, short: '16avos', full: '16avos de Final (Playoffs)', count: 8 },
      { id: 1, short: 'Octavos', full: 'Octavos de Final', count: 8 },
      { id: 2, short: 'Cuartos', full: 'Cuartos de Final', count: 4 },
      { id: 3, short: 'Semis', full: 'Semifinales', count: 2 },
      { id: 4, short: 'Final', full: 'Gran Final', count: 1 },
    ];
  }, []);

  const handleRangeChange = (start: number, end: number) => {
    setStartRoundIdx(start);
    setEndRoundIdx(end);
    setActivePreset('custom');
  };

  const handleShiftRange = (direction: 'left' | 'right') => {
    const windowSpan = endRoundIdx - startRoundIdx;
    if (direction === 'right') {
      if (endRoundIdx < roundStages.length - 1) {
        setStartRoundIdx(prev => prev + 1);
        setEndRoundIdx(prev => prev + 1);
      }
    } else {
      if (startRoundIdx > 0) {
        setStartRoundIdx(prev => prev - 1);
        setEndRoundIdx(prev => prev - 1);
      }
    }
    setActivePreset('custom');
  };

  const bracketPresets = [
    { id: 'all', label: 'Todo', start: 0, end: 4 },
    { id: 'playoffs', label: 'Playoffs', start: 0, end: 1 },
    { id: 'final', label: 'Fase Final', start: 2, end: 4 },
  ];

  const handleSelectPreset = (preset: typeof bracketPresets[0]) => {
    setActivePreset(preset.id);
    setStartRoundIdx(preset.start);
    setEndRoundIdx(preset.end);
  };

  // Position badge colors based on UEFA Champions League rules
  const getPositionBadge = (pos: number) => {
    if (pos <= 8) {
      return {
        bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        label: 'Octavos',
        dot: 'bg-emerald-400'
      };
    }
    if (pos <= 24) {
      return {
        bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
        label: 'Playoffs',
        dot: 'bg-blue-400'
      };
    }
    return {
      bg: 'bg-zinc-800 text-zinc-500 border-zinc-700/60',
      label: 'Eliminado',
      dot: 'bg-zinc-600'
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-bold uppercase tracking-widest">Cargando posiciones...</p>
      </div>
    );
  }

  return (
    <div 
      className="w-full flex-1 flex flex-col min-h-0 overflow-hidden max-w-4xl mx-auto font-sans text-[#e4e4e7] px-2 sm:px-4 pt-1 h-full"
    >
      {/* Title & Search bar: Flex-shrink 0 */}
      <div className="flex-shrink-0 space-y-2 pb-2">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                UEFA Champions League
              </h1>
              <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider shrink-0">
                {seasonInfo?.name ? seasonInfo.name.replace('UEFA Champions League', '').trim() : '2026/27'}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-400 truncate">
              Tabla de Posiciones Oficial · Fase de Liga (36 clubes)
            </p>
          </div>
        </div>

        {/* Search filter denso */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar club (Real Madrid, City, Bayern)..."
            className="w-full bg-[#121215] border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Table Container: flex: 1; overflow-y: auto; SOLO ESTE CONTENEDOR HACE SCROLL */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-[#121215] rounded-xl border border-zinc-800 shadow-lg relative overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <table className="w-full text-left whitespace-nowrap text-xs border-collapse">
          <thead 
            className="bg-[#18181b] text-[10px] uppercase font-black text-zinc-400 border-b border-zinc-800 sticky top-0 z-30 shadow-md rounded-t-xl"
          >
            <tr>
              {/* Sticky Pos */}
              <th className="py-2.5 px-1 text-center w-7 min-w-[28px] max-w-[28px] sticky left-0 top-0 z-50 bg-[#18181b] border-r border-b border-zinc-800/80">
                #
              </th>
              {/* Sticky Club */}
              <th className="py-2.5 px-2.5 sticky left-[28px] top-0 z-50 bg-[#18181b] border-r border-b border-zinc-800 w-[130px] min-w-[130px] max-w-[130px]">
                Club
              </th>
              {/* Sticky PTS */}
              <th className="py-2.5 px-2 text-center w-12 min-w-[48px] max-w-[48px] font-black text-white bg-blue-950 border-r border-b border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)] sticky left-[158px] top-0 z-50">
                PTS
              </th>
              {/* Scrollable Stats */}
              <th className="py-2.5 px-2 text-center w-9 sticky top-0 z-40 bg-[#18181b] border-b border-zinc-800">PJ</th>
              <th className="py-2.5 px-2 text-center w-9 sticky top-0 z-40 bg-[#18181b] border-b border-zinc-800">G</th>
              <th className="py-2.5 px-2 text-center w-9 sticky top-0 z-40 bg-[#18181b] border-b border-zinc-800">E</th>
              <th className="py-2.5 px-2 text-center w-9 sticky top-0 z-40 bg-[#18181b] border-b border-zinc-800">P</th>
              <th className="py-2.5 px-2 text-center w-10 sticky top-0 z-40 bg-[#18181b] border-b border-zinc-800">GF</th>
              <th className="py-2.5 px-2 text-center w-10 sticky top-0 z-40 bg-[#18181b] border-b border-zinc-800">GC</th>
              <th className="py-2.5 px-2 text-center w-10 sticky top-0 z-40 bg-[#18181b] border-b border-zinc-800">DG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-sans">
            {filteredStandings.map((row) => {
              const badge = getPositionBadge(row.position);
              const rowBg = row.position <= 8 ? 'bg-[#0a1712]' : row.position <= 24 ? 'bg-[#0d1624]' : 'bg-[#121215]';
              const stickyBg = row.position <= 8 ? 'bg-[#0c1d17]' : row.position <= 24 ? 'bg-[#0f1b2d]' : 'bg-[#141418]';

              return (
                <tr 
                  key={row.position} 
                  className={`hover:bg-zinc-800/40 transition-colors ${rowBg}`}
                >
                  {/* Sticky Position column */}
                  <td className={`py-1.5 px-1 text-center sticky left-0 z-10 w-7 min-w-[28px] max-w-[28px] ${stickyBg} border-r border-zinc-800/60`}>
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black border ${badge.bg}`}>
                      {row.position}
                    </span>
                  </td>

                  {/* Sticky Club column */}
                  <td className={`py-1.5 px-2.5 font-bold text-white sticky left-[28px] z-10 w-[130px] min-w-[130px] max-w-[130px] ${stickyBg} border-r border-zinc-800`}>
                    <div className="flex items-center gap-2">
                      <TeamBadge src={row.team.logo} teamName={row.team.name} size="sm" className="w-5 h-5 shrink-0" />
                      <span className="truncate text-xs" title={row.team.name}>
                        {row.team.name}
                      </span>
                    </div>
                  </td>

                  {/* Sticky PTS column */}
                  <td className="py-1.5 px-2 text-center font-mono font-black text-xs text-white bg-blue-950/95 backdrop-blur-sm border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)] sticky left-[158px] z-10 w-12 min-w-[48px] max-w-[48px]">
                    {row.points}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-zinc-300 text-[11px]">{row.matches}</td>
                  <td className="py-1.5 px-2 text-center font-mono text-zinc-300 text-[11px]">{row.wins}</td>
                  <td className="py-1.5 px-2 text-center font-mono text-zinc-300 text-[11px]">{row.draws}</td>
                  <td className="py-1.5 px-2 text-center font-mono text-zinc-300 text-[11px]">{row.losses}</td>
                  <td className="py-1.5 px-2 text-center font-mono text-zinc-400 text-[11px]">{row.scoresFor}</td>
                  <td className="py-1.5 px-2 text-center font-mono text-zinc-400 text-[11px]">{row.scoresAgainst}</td>
                  <td className="py-1.5 px-2 text-center font-mono font-bold text-[11px]">
                    <span className={row.scoreDiff > 0 ? 'text-emerald-400' : row.scoreDiff < 0 ? 'text-rose-400' : 'text-zinc-400'}>
                      {row.scoreDiff > 0 ? `+${row.scoreDiff}` : row.scoreDiff}
                    </span>
                  </td>
                </tr>
              );
            })}

            {filteredStandings.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-zinc-500 text-xs">
                  No se encontraron equipos para "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Legend: flex-shrink: 0 */}
      <div className="flex-shrink-0 pt-2 pb-1">
        <div className="bg-[#121215] border border-zinc-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-emerald-400"></span>
            <span><strong>1°-8°</strong>: Octavos directos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-blue-400"></span>
            <span><strong>9°-24°</strong>: Playoffs (16avos)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-zinc-600"></span>
            <span><strong>25°-36°</strong>: Eliminados</span>
          </div>
        </div>
      </div>
    </div>
  );
};
