import React, { useState } from 'react';
import { Trophy, Crown, Medal, Flame, Zap, AlertTriangle, Save, Edit3 } from 'lucide-react';
import { Podium } from '../types';
import { UCL_36_TEAMS, getTeamLogoByName } from '../data/fixtures';
import { BaseBottomSheet } from './BaseBottomSheet';
import { TeamBadge } from './TeamBadge';
import { vibrateSuccess, vibrateError, vibratePop } from '../lib/haptics';

export const POPULAR_PLAYERS = [
  'Kylian Mbappé',
  'Erling Haaland',
  'Vinícius Júnior',
  'Harry Kane',
  'Jude Bellingham',
  'Mohamed Salah',
  'Robert Lewandowski',
  'Lamine Yamal',
  'Florian Wirtz',
  'Kevin De Bruyne',
  'Rodri',
  'Phil Foden',
  'Bukayo Saka',
  'Lautaro Martínez',
  'Antoine Griezmann'
];

interface PodiumDisplayProps {
  podium: Partial<Podium> | null;
  canEdit?: boolean;
  onSave?: (data: Partial<Podium>) => Promise<void>;
  title?: string;
  isSaving?: boolean;
}

export function PodiumDisplay({
  podium,
  canEdit = false,
  onSave,
  title = "Podio de la Temporada",
  isSaving = false
}: PodiumDisplayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localData, setLocalData] = useState<Partial<Podium>>({
    champion: podium?.champion || '',
    runnerUp: podium?.runnerUp || '',
    topScorer: podium?.topScorer || '',
    mostAssists: podium?.mostAssists || '',
  });
  const [customScorer, setCustomScorer] = useState('');
  const [customAssists, setCustomAssists] = useState('');

  // Sep 7, 2026, 23:59:59 UTC
  const DEADLINE_TIMESTAMP = new Date('2026-09-07T23:59:59Z').getTime();
  const isLocked = Date.now() > DEADLINE_TIMESTAMP;

  const hasSelections = !!(podium?.champion || podium?.runnerUp || podium?.topScorer || podium?.mostAssists);

  const openEdit = () => {
    if (isLocked) return;
    vibratePop();
    setLocalData({
      champion: podium?.champion || '',
      runnerUp: podium?.runnerUp || '',
      topScorer: podium?.topScorer || '',
      mostAssists: podium?.mostAssists || '',
    });
    setCustomScorer('');
    setCustomAssists('');
    setIsModalOpen(true);
  };

  const handleSavePodium = async () => {
    if (!onSave || isLocked) return;
    const finalScorer = (customScorer.trim() || localData.topScorer || '').trim();
    const finalAssists = (customAssists.trim() || localData.mostAssists || '').trim();

    try {
      await onSave({
        champion: localData.champion,
        championLogo: getTeamLogoByName(localData.champion),
        runnerUp: localData.runnerUp,
        runnerUpLogo: getTeamLogoByName(localData.runnerUp),
        topScorer: finalScorer,
        mostAssists: finalAssists,
      });
      vibrateSuccess();
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      vibrateError();
    }
  };

  // Team list sorted alphabetically
  const teamsList = [...UCL_36_TEAMS].sort((a, b) => a.name.localeCompare(b.name));
  const championLogo = podium?.championLogo || getTeamLogoByName(podium?.champion);
  const runnerUpLogo = podium?.runnerUpLogo || getTeamLogoByName(podium?.runnerUp);

  return (
    <div className="w-full">
      {!hasSelections ? (
        canEdit ? (
          <div
            onClick={openEdit}
            className="w-full bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.1)] cursor-pointer hover:bg-amber-500/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-400/30 group-hover:scale-105 transition-transform">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-amber-400 uppercase tracking-wider">¡Elige tu Podio!</span>
                <span className="text-[11px] text-zinc-400 font-medium">Campeón, Subcampeón, Goleador y Asistidor</span>
              </div>
            </div>
            <span className="text-xs font-black text-white bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:bg-amber-500/30">
              <Edit3 className="w-3.5 h-3.5" /> ELEGIR
            </span>
          </div>
        ) : (
          <div className="bg-zinc-900/50 rounded-2xl p-6 text-center border border-zinc-800/60">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Sin podio registrado</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Header & Edit Button */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {title}
            </h3>
            {canEdit && (
              isLocked ? (
                <span className="text-[9px] font-black text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded uppercase tracking-widest border border-zinc-800">
                  Bloqueado
                </span>
              ) : (
                <button
                  onClick={openEdit}
                  className="text-[10px] font-black text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider border border-blue-500/30 transition-all flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Editar
                </button>
              )
            )}
          </div>

          {/* Visual Podium Pedestals: Champion (1st) & Runner-Up (2nd) */}
          <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-end justify-center h-38 gap-3 sm:gap-4 max-w-sm mx-auto pt-2 pb-1">
              {/* Runner Up (2nd Place) */}
              <div className="w-32 bg-gradient-to-t from-zinc-800/90 via-zinc-800/60 to-zinc-700/40 rounded-t-xl h-[80%] flex flex-col items-center justify-between p-2.5 border-t-2 border-l border-r border-zinc-600/60 shadow-lg relative">
                <div className="flex flex-col items-center gap-1 w-full">
                  <div className="w-6 h-6 rounded-full bg-zinc-400/20 flex items-center justify-center border border-zinc-400/40">
                    <span className="text-[11px] font-black text-zinc-300">2</span>
                  </div>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Subcampeón</span>
                </div>
                <div className="flex flex-col items-center w-full gap-1">
                  {podium.runnerUp && (
                    <div className="w-8 h-8 rounded-full bg-zinc-900/90 border border-zinc-600/80 p-0.5 flex items-center justify-center shadow-md overflow-hidden shrink-0">
                      {runnerUpLogo ? (
                        <img 
                          src={runnerUpLogo} 
                          alt={podium.runnerUp}
                          className="w-full h-full object-contain rounded-full"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <TeamBadge teamName={podium.runnerUp} size="sm" className="w-5 h-5 shrink-0" />
                      )}
                    </div>
                  )}
                  <span className="text-[11px] font-bold text-white text-center leading-tight line-clamp-2 w-full">
                    {podium.runnerUp || 'Sin definir'}
                  </span>
                </div>
              </div>

              {/* Champion (1st Place) */}
              <div className="w-36 bg-gradient-to-t from-amber-600/90 via-amber-500/60 to-yellow-500/40 rounded-t-xl h-full flex flex-col items-center justify-between p-2.5 border-t-2 border-l border-r border-yellow-400/70 shadow-[0_-8px_24px_rgba(245,158,11,0.25)] relative z-10">
                <div className="flex flex-col items-center gap-1 w-full">
                  <div className="w-7 h-7 rounded-full bg-yellow-400/20 flex items-center justify-center border border-yellow-400/50 shadow-inner">
                    <Crown className="w-4 h-4 text-yellow-300 drop-shadow-md animate-pulse" />
                  </div>
                  <span className="text-[9px] font-black text-yellow-300 uppercase tracking-widest drop-shadow">Campeón</span>
                </div>
                <div className="flex flex-col items-center w-full gap-1">
                  {podium.champion && (
                    <div className="w-10 h-10 rounded-full bg-amber-950/80 border-2 border-yellow-400 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.4)] overflow-hidden shrink-0">
                      {championLogo ? (
                        <img 
                          src={championLogo} 
                          alt={podium.champion}
                          className="w-full h-full object-contain rounded-full"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <TeamBadge teamName={podium.champion} size="md" className="w-7 h-7 shrink-0 drop-shadow" />
                      )}
                    </div>
                  )}
                  <span className="text-xs font-black text-white text-center leading-tight uppercase drop-shadow line-clamp-2 w-full">
                    {podium.champion || 'Sin definir'}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual Awards: Goleador y Asistidor */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800/80">
              {/* Top Scorer / Goleador */}
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30">
                    <Flame className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                    Goleador
                  </span>
                </div>
                <p className="text-xs font-bold text-emerald-100 truncate pl-0.5">
                  {podium.topScorer || 'Sin definir'}
                </p>
              </div>

              {/* Most Assists / Asistidor */}
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                    <Zap className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                    Asistidor
                  </span>
                </div>
                <p className="text-xs font-bold text-blue-100 truncate pl-0.5">
                  {podium.mostAssists || 'Sin definir'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Podium Bottom Sheet Modal */}
      {canEdit && (
        <BaseBottomSheet
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Configurar tu Podio"
        >
          <div className="space-y-4 pb-8 px-1">
            {isLocked ? (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-200">El tiempo límite para editar el podio ha finalizado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Campeón Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Campeón del Torneo
                  </label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none focus:border-yellow-500 transition-colors"
                    value={localData.champion || ''}
                    onChange={(e) => setLocalData({ ...localData, champion: e.target.value })}
                  >
                    <option value="">Selecciona un equipo...</option>
                    {teamsList.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcampeón Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Medal className="w-3.5 h-3.5" />
                    Subcampeón
                  </label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none focus:border-zinc-500 transition-colors"
                    value={localData.runnerUp || ''}
                    onChange={(e) => setLocalData({ ...localData, runnerUp: e.target.value })}
                  >
                    <option value="">Selecciona un equipo...</option>
                    {teamsList.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Goleador Selection / Free text */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    Goleador (Top Scorer)
                  </label>
                  <div className="space-y-1.5">
                    <select
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                      value={localData.topScorer || ''}
                      onChange={(e) => {
                        setLocalData({ ...localData, topScorer: e.target.value });
                        setCustomScorer('');
                      }}
                    >
                      <option value="">Selecciona un jugador sugerido...</option>
                      {POPULAR_PLAYERS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="__other__">Otro jugador (escribir abajo)</option>
                    </select>

                    {(localData.topScorer === '__other__' || (!POPULAR_PLAYERS.includes(localData.topScorer || '') && !!localData.topScorer)) && (
                      <input
                        type="text"
                        value={customScorer || (localData.topScorer === '__other__' ? '' : localData.topScorer)}
                        onChange={(e) => {
                          setCustomScorer(e.target.value);
                          setLocalData({ ...localData, topScorer: e.target.value });
                        }}
                        placeholder="Escribe el nombre del goleador..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                      />
                    )}
                  </div>
                </div>

                {/* Asistidor Selection / Free text */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Asistidor (Máximo Asistente)
                  </label>
                  <div className="space-y-1.5">
                    <select
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-blue-500 transition-colors"
                      value={localData.mostAssists || ''}
                      onChange={(e) => {
                        setLocalData({ ...localData, mostAssists: e.target.value });
                        setCustomAssists('');
                      }}
                    >
                      <option value="">Selecciona un jugador sugerido...</option>
                      {POPULAR_PLAYERS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="__other__">Otro jugador (escribir abajo)</option>
                    </select>

                    {(localData.mostAssists === '__other__' || (!POPULAR_PLAYERS.includes(localData.mostAssists || '') && !!localData.mostAssists)) && (
                      <input
                        type="text"
                        value={customAssists || (localData.mostAssists === '__other__' ? '' : localData.mostAssists)}
                        onChange={(e) => {
                          setCustomAssists(e.target.value);
                          setLocalData({ ...localData, mostAssists: e.target.value });
                        }}
                        placeholder="Escribe el nombre del asistente..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-blue-500 transition-colors"
                      />
                    )}
                  </div>
                </div>

                <button
                  disabled={isSaving || (!localData.champion && !localData.runnerUp && !localData.topScorer && !localData.mostAssists)}
                  onClick={handleSavePodium}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Podio'}
                  {!isSaving && <Save className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </BaseBottomSheet>
      )}
    </div>
  );
}
