import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Prediction, Match, Stage } from '../types';
import { useMatches } from '../hooks/useMatches';
import { useSettings } from './SettingsProvider';
import { subscribeStages } from '../lib/stages';
import { TeamBadge } from './TeamBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { vibrateTap } from '../lib/haptics';
import { cn } from '../lib/utils';
import { 
  Trophy, 
  Target, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Filter, 
  Flame,
  Award,
  Layers
} from 'lucide-react';

interface UserPredictionsHistoryProps {
  userId: string;
  groupId?: string | null;
  userName?: string;
  initialStageId?: string;
  stages?: Stage[];
}

interface EvaluatedPrediction {
  id: string;
  matchId: string;
  match: Match;
  predHome: number;
  predAway: number;
  matchHome: number | null;
  matchAway: number | null;
  status: 'finished' | 'in_progress' | 'locked';
  type: 'exact' | 'outcome' | 'miss' | 'live' | 'locked';
  points: number;
  date: string;
  group?: string;
}

export function UserPredictionsHistory({
  userId,
  groupId,
  userName = 'este usuario',
  initialStageId,
  stages
}: UserPredictionsHistoryProps) {
  const { matches } = useMatches();
  const { settings } = useSettings();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'exact' | 'outcome' | 'miss' | 'live' | 'locked'>('all');
  const [stageFilter, setStageFilter] = useState<string>(initialStageId || 'all');
  const [internalStages, setInternalStages] = useState<Stage[]>(stages || []);

  // Sincronizar etapas del grupo (por prop o suscripción)
  useEffect(() => {
    if (stages && stages.length > 0) {
      setInternalStages(stages);
      return;
    }
    if (!groupId) return;
    const unsub = subscribeStages(groupId, (fetched) => {
      setInternalStages(fetched);
    });
    return () => unsub();
  }, [groupId, stages]);

  // Si cambia la fase seleccionada en el Ranking o el usuario a inspeccionar, actualizar el filtro
  useEffect(() => {
    if (initialStageId !== undefined) {
      setStageFilter(initialStageId);
    }
  }, [initialStageId, userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const predsRef = collection(db, 'predictions');
    const q = groupId
      ? query(predsRef, where('userId', '==', userId), where('groupId', '==', groupId))
      : query(predsRef, where('userId', '==', userId));

    const unsub = onSnapshot(q, (snap) => {
      const preds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prediction));
      setPredictions(preds);
      setLoading(false);
    }, (err) => {
      console.warn("Could not fetch user predictions history:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [userId, groupId]);

  // Jornadas únicas disponibles entre los partidos
  const availableMatchGroups = useMemo(() => {
    const set = new Set<string>();
    matches.forEach(m => {
      if (m.group) set.add(m.group);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [matches]);

  // Determinar los IDs de partidos correspondientes a la fase/etapa seleccionada
  const stageFilterMatchIds = useMemo(() => {
    if (stageFilter === 'all') return null; // 'all' incluye todo sin filtrar por etapa

    // 1. ¿Es un ID de etapa de internalStages?
    const st = internalStages.find(s => s.id === stageFilter);
    if (st) {
      const groupSet = new Set(st.matchGroups || []);
      return new Set(matches.filter(m => groupSet.has(m.group || 'Fase Regular')).map(m => m.id));
    }

    // 2. ¿Es un grupo de partido directo (ej: 'Jornada 1', 'Jornada 3')?
    return new Set(matches.filter(m => (m.group || 'Fase Regular') === stageFilter).map(m => m.id));
  }, [stageFilter, internalStages, matches]);

  const currentStageLabel = useMemo(() => {
    if (stageFilter === 'all') return 'Todas las Fases (Acumulado)';
    const st = internalStages.find(s => s.id === stageFilter);
    if (st) return `${st.name}${st.status === 'active' ? ' (Fase Actual)' : ''}`;
    return stageFilter;
  }, [stageFilter, internalStages]);

  // Combinar predicciones con partidos y evaluar resultados
  const evaluatedItems = useMemo<EvaluatedPrediction[]>(() => {
    if (predictions.length === 0 || matches.length === 0) return [];

    const now = Date.now();
    const list: EvaluatedPrediction[] = [];

    predictions.forEach(p => {
      // Filtrar según la fase elegida si hay filtro activo
      if (stageFilterMatchIds && !stageFilterMatchIds.has(p.matchId)) {
        return;
      }

      const m = matches.find(match => match.id === p.matchId);
      if (!m) return;

      const matchTime = new Date(m.date).getTime();
      const isLocked = !isNaN(matchTime) && now >= (matchTime - 15 * 60 * 1000);
      
      const estadoLower = (m.estado || '').toLowerCase();
      const isLive = m.status === 'in_progress' || 
                     estadoLower.includes('vivo') || 
                     estadoLower.includes('live') || 
                     estadoLower.includes('curso') || 
                     estadoLower.includes('descanso') || 
                     estadoLower.includes('ht') || 
                     /\d+['’]/.test(estadoLower);
      const isFinished = m.status === 'finished' || 
                         estadoLower.includes('finaliz') || 
                         estadoLower.includes('ft') || 
                         estadoLower.includes('termin');

      // Solo mostrar predicciones de partidos finalizados, en juego, o bloqueados por jugar
      if (!isFinished && !isLive && !isLocked) {
        return;
      }

      const hasScores = m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
      const mHome = hasScores ? m.homeScore! : (isFinished ? 0 : null);
      const mAway = hasScores ? m.awayScore! : (isFinished ? 0 : null);

      let type: 'exact' | 'outcome' | 'miss' | 'live' | 'locked' = 'locked';
      let points = p.pointsEarned ?? 0;

      const pointsExact = settings?.pointsExactMatch ?? 3;
      const pointsWinner = settings?.pointsWinnerTie ?? 1;

      if (isFinished && mHome !== null && mAway !== null) {
        const isExact = p.homeScore === mHome && p.awayScore === mAway;
        const actualDiff = mHome - mAway;
        const predDiff = p.homeScore - p.awayScore;
        const isOutcome = (actualDiff > 0 && predDiff > 0) ||
                          (actualDiff < 0 && predDiff < 0) ||
                          (actualDiff === 0 && predDiff === 0);

        if (isExact) {
          type = 'exact';
          if (!points) points = pointsExact;
        } else if (isOutcome) {
          type = 'outcome';
          if (!points) points = pointsWinner;
        } else {
          type = 'miss';
          points = 0;
        }
      } else if (isLive) {
        type = 'live';
      } else {
        // El partido está bloqueado o por empezar hoy, pero AÚN NO HA COMENZADO NI FINALIZADO
        type = 'locked';
        points = 0;
      }

      list.push({
        id: p.id,
        matchId: m.id,
        match: m,
        predHome: p.homeScore,
        predAway: p.awayScore,
        matchHome: mHome,
        matchAway: mAway,
        status: isFinished ? 'finished' : (isLive ? 'in_progress' : 'locked'),
        type,
        points,
        date: m.date,
        group: m.group
      });
    });

    // Ordenar por fecha descendente (más recientes primero)
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [predictions, matches, stageFilterMatchIds, settings]);

  // Cálculo de estadísticas (estrictamente sobre partidos finalizados con marcador real)
  const stats = useMemo(() => {
    const finishedItems = evaluatedItems.filter(i => i.type === 'exact' || i.type === 'outcome' || i.type === 'miss');
    const totalFinished = finishedItems.length;
    const exact = evaluatedItems.filter(i => i.type === 'exact').length;
    const outcome = evaluatedItems.filter(i => i.type === 'outcome').length;
    const miss = evaluatedItems.filter(i => i.type === 'miss').length;
    const live = evaluatedItems.filter(i => i.type === 'live').length;
    const locked = evaluatedItems.filter(i => i.type === 'locked').length;

    const totalPoints = finishedItems.reduce((acc, curr) => acc + (curr.points || 0), 0);
    const efficiency = totalFinished > 0 ? Math.round(((exact + outcome) / totalFinished) * 100) : 0;

    return { 
      total: totalFinished, 
      totalAll: evaluatedItems.length,
      exact, 
      outcome, 
      miss, 
      live, 
      locked, 
      totalPoints, 
      efficiency 
    };
  }, [evaluatedItems]);

  // Items filtrados por categoría
  const filteredItems = useMemo(() => {
    if (filter === 'exact') return evaluatedItems.filter(i => i.type === 'exact');
    if (filter === 'outcome') return evaluatedItems.filter(i => i.type === 'outcome');
    if (filter === 'miss') return evaluatedItems.filter(i => i.type === 'miss');
    if (filter === 'live') return evaluatedItems.filter(i => i.type === 'live');
    if (filter === 'locked') return evaluatedItems.filter(i => i.type === 'locked');
    return evaluatedItems;
  }, [evaluatedItems, filter]);

  const formatMatchDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, "EEE d MMM · HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-3.5">
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between px-1 border-b border-zinc-800 pb-2">
        <h4 className="text-[11px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-blue-400" />
          <span>Historial de Pronósticos</span>
        </h4>
        <span className="text-[10px] font-mono text-zinc-500 font-bold">
          {stats.total} {stats.total === 1 ? 'partido finalizado' : 'partidos finalizados'}
          {stats.locked > 0 && ` · ${stats.locked} por empezar`}
        </span>
      </div>

      {/* SELECTOR DE FASE / ETAPA */}
      <div className="bg-[#121217] border border-zinc-800/90 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Fase Evaluada:</span>
            <span className="text-[11px] font-bold text-white truncate max-w-[150px] sm:max-w-[200px]" title={currentStageLabel}>
              {currentStageLabel}
            </span>
          </div>
        </div>

        <select
          value={stageFilter}
          onChange={(e) => {
            vibrateTap();
            setStageFilter(e.target.value);
            setFilter('all');
          }}
          className="bg-zinc-900 border border-zinc-700/80 hover:border-amber-400/60 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-amber-400 max-w-[190px] sm:max-w-[240px] truncate cursor-pointer transition-colors shadow-inner"
        >
          <option value="all">🏆 Todas las Fases (Acumulado)</option>
          {internalStages.length > 0 && (
            <optgroup label="Etapas del Torneo">
              {internalStages.map(st => (
                <option key={st.id} value={st.id}>
                  {st.status === 'active' ? '⚡ ' : '🏁 '}
                  {st.name} {st.status === 'active' ? '(Fase Actual)' : ''}
                </option>
              ))}
            </optgroup>
          )}
          {availableMatchGroups.length > 0 && (
            <optgroup label="Por Jornada">
              {availableMatchGroups.map(g => (
                <option key={g} value={g}>
                  📅 {g}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-zinc-500 space-y-1">
          <Clock className="w-5 h-5 mx-auto text-zinc-600 animate-spin" />
          <p>Cargando historial de apuestas...</p>
        </div>
      ) : evaluatedItems.length === 0 ? (
        <div className="bg-zinc-900/30 rounded-2xl p-6 text-center border border-zinc-800/40 border-dashed space-y-1.5">
          <Clock className="w-6 h-6 mx-auto text-zinc-600" />
          <p className="text-xs font-bold text-zinc-400">Sin pronósticos en esta fase</p>
          <p className="text-[11px] text-zinc-600">
            {stageFilter !== 'all' 
              ? 'Este usuario no tiene pronósticos registrados en la fase seleccionada.'
              : 'Los resultados aparecerán aquí una vez que comiencen o finalicen los partidos.'}
          </p>
          {stageFilter !== 'all' && (
            <button
              type="button"
              onClick={() => {
                vibrateTap();
                setStageFilter('all');
              }}
              className="mt-2 text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              Ver todas las fases acumuladas
            </button>
          )}
        </div>
      ) : (
        <>
          {/* STATS PERFORMANCE GRID CON PUNTOS DE LA FASE */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            <div className="bg-[#121217] border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-zinc-500 block truncate">Jugados</span>
              <span className="font-mono font-black text-sm text-white">{stats.total}</span>
            </div>
            <div className="bg-[#121217] border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-emerald-500 block truncate">🎯 Plenos</span>
              <span className="font-mono font-black text-sm text-emerald-400">{stats.exact}</span>
            </div>
            <div className="bg-[#121217] border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-sky-500 block truncate">⚽ Aciertos</span>
              <span className="font-mono font-black text-sm text-sky-400">{stats.outcome}</span>
            </div>
            <div className="bg-[#121217] border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-amber-500 block truncate">🏆 Puntos</span>
              <span className="font-mono font-black text-sm text-amber-400">+{stats.totalPoints}</span>
            </div>
            <div className="bg-[#121217] border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-purple-400 block truncate">Efectiv.</span>
              <span className="font-mono font-black text-sm text-purple-300">{stats.efficiency}%</span>
            </div>
          </div>

          {/* FILTER PILLS */}
          <div className="flex bg-[#121217] p-1 rounded-xl border border-zinc-800 gap-1 text-[10px] font-bold overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                vibrateTap();
                setFilter('all');
              }}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap shrink-0",
                filter === 'all' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              )}
            >
              Todos ({stats.totalAll})
            </button>
            <button
              type="button"
              onClick={() => {
                vibrateTap();
                setFilter('exact');
              }}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap shrink-0",
                filter === 'exact' ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              )}
            >
              🎯 Plenos ({stats.exact})
            </button>
            <button
              type="button"
              onClick={() => {
                vibrateTap();
                setFilter('outcome');
              }}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap shrink-0",
                filter === 'outcome' ? "bg-sky-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              )}
            >
              ⚽ Aciertos ({stats.outcome})
            </button>
            <button
              type="button"
              onClick={() => {
                vibrateTap();
                setFilter('miss');
              }}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap shrink-0",
                filter === 'miss' ? "bg-rose-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              )}
            >
              ❌ Fallos ({stats.miss})
            </button>
            {stats.live > 0 && (
              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setFilter('live');
                }}
                className={cn(
                  "py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap shrink-0",
                  filter === 'live' ? "bg-orange-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                )}
              >
                ⚡ En Vivo ({stats.live})
              </button>
            )}
            {stats.locked > 0 && (
              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setFilter('locked');
                }}
                className={cn(
                  "py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap shrink-0",
                  filter === 'locked' ? "bg-amber-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                )}
              >
                ⏳ Por Empezar ({stats.locked})
              </button>
            )}
          </div>

          {/* PREDICTIONS LIST */}
          <div className="space-y-2">
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500 bg-[#121217] rounded-xl border border-zinc-800">
                No hay pronósticos en esta categoría.
              </div>
            ) : (
              filteredItems.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 rounded-2xl border transition-all text-xs space-y-2 relative overflow-hidden",
                    item.type === 'exact' && "border-emerald-500/40 bg-gradient-to-b from-[#0b1712] to-[#0f1412] shadow-[0_0_15px_rgba(16,185,129,0.1)]",
                    item.type === 'outcome' && "border-sky-500/40 bg-gradient-to-b from-[#0a1726] to-[#0e1218] shadow-[0_0_15px_rgba(56,189,248,0.1)]",
                    item.type === 'miss' && "border-rose-500/30 bg-gradient-to-b from-[#180e11] to-[#121113]",
                    item.type === 'live' && "border-orange-500/50 bg-gradient-to-b from-[#1d120a] to-[#14110e] shadow-[0_0_15px_rgba(249,115,22,0.15)]",
                    item.type === 'locked' && "border-zinc-700/60 bg-gradient-to-b from-[#18181b] to-[#111113]"
                  )}
                >
                  {/* Header: Date + Round + Points Pill */}
                  <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-zinc-800/60">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.2 rounded-md uppercase text-[9px] tracking-wider shrink-0">
                        {item.group || 'Fase de Liga'}
                      </span>
                      <span className="text-zinc-500 truncate flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span>{formatMatchDate(item.date)}</span>
                      </span>
                    </div>

                    {/* Points Badge */}
                    <div className="shrink-0">
                      {item.type === 'exact' ? (
                        <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full shadow-sm">
                          🎯 +{item.points} Pts (Pleno)
                        </span>
                      ) : item.type === 'outcome' ? (
                        <span className="text-[10px] font-black text-sky-300 bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 rounded-full shadow-sm">
                          ⚽ +{item.points} Pts (Ganador)
                        </span>
                      ) : item.type === 'live' ? (
                        <span className="text-[10px] font-black text-orange-300 bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 rounded-full animate-pulse">
                          ⚡ En Juego
                        </span>
                      ) : item.type === 'locked' ? (
                        <span className="text-[10px] font-bold text-amber-300/90 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" /> Por Empezar
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full">
                          ❌ 0 Pts (Fallo)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Matchup & Score Row */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Home Team */}
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <TeamBadge 
                        src={item.match.homeFlag} 
                        teamName={item.match.homeTeam} 
                        className="w-6 h-6 shrink-0 object-contain drop-shadow" 
                      />
                      <span className="font-bold text-white text-[11px] truncate leading-tight">
                        {item.match.homeTeam}
                      </span>
                    </div>

                    {/* Center Scores */}
                    <div className="flex flex-col items-center justify-center shrink-0 px-2">
                      {/* Marcador Real */}
                      <div className="font-mono font-black text-sm text-white bg-black/50 px-2.5 py-0.5 rounded-lg border border-zinc-700/80 shadow-inner">
                        {item.type === 'locked' ? (
                          <span className="text-zinc-500 text-[11px] font-sans font-bold px-1">vs</span>
                        ) : (
                          <>
                            <span>{item.matchHome ?? '-'}</span>
                            <span className="text-zinc-500 px-1">-</span>
                            <span>{item.matchAway ?? '-'}</span>
                          </>
                        )}
                      </div>

                      {/* Apuesta del Usuario */}
                      <span className="text-[9.5px] font-mono text-zinc-400 mt-1">
                        Apuesta: <strong className="text-zinc-200">{item.predHome}-{item.predAway}</strong>
                      </span>
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0 text-right">
                      <span className="font-bold text-white text-[11px] truncate leading-tight">
                        {item.match.awayTeam}
                      </span>
                      <TeamBadge 
                        src={item.match.awayFlag} 
                        teamName={item.match.awayTeam} 
                        className="w-6 h-6 shrink-0 object-contain drop-shadow" 
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
