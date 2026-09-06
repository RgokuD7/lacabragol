import React, { useState } from 'react';
import { Trophy, Crown, Medal, Flame, Zap, AlertTriangle, Save, Edit3, Search, CheckCircle2, ArrowRight, UserCheck } from 'lucide-react';
import { Podium } from '../types';
import { UCL_36_TEAMS, getTeamLogoByName } from '../data/fixtures';
import { BaseBottomSheet } from './BaseBottomSheet';
import { TeamBadge } from './TeamBadge';
import { vibrateSuccess, vibrateError, vibratePop } from '../lib/haptics';
import { cn } from '../lib/utils';

export const POPULAR_PLAYERS = [
  { name: 'K. Mbappé', id: 351860 },
  { name: 'E. Haaland', id: 839956 },
  { name: 'V. Júnior', id: 843926 },
  { name: 'H. Kane', id: 170323 },
  { name: 'J. Bellingham', id: 954060 },
  { name: 'M. Salah', id: 159665 },
  { name: 'R. Lewandowski', id: 66986 },
  { name: 'L. Yamal', id: 1478144 },
  { name: 'F. Wirtz', id: 981995 },
  { name: 'K. De Bruyne', id: 104523 },
  { name: 'Rodri', id: 839955 },
  { name: 'P. Foden', id: 883506 },
  { name: 'B. Saka', id: 934389 },
  { name: 'L. Martínez', id: 825700 },
  { name: 'A. Griezmann', id: 41856 }
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
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [localData, setLocalData] = useState<Partial<Podium>>({
    champion: podium?.champion || '',
    runnerUp: podium?.runnerUp || '',
    topScorer: podium?.topScorer || '',
    mostAssists: podium?.mostAssists || '',
    mvp: podium?.mvp || '',
  });

  // Sep 7, 2026, 23:59:59 UTC
  const DEADLINE_TIMESTAMP = new Date('2026-09-07T23:59:59Z').getTime();
  const isLocked = Date.now() > DEADLINE_TIMESTAMP;

  const hasSelections = !!(
    podium?.champion ||
    podium?.runnerUp ||
    podium?.topScorer ||
    podium?.mostAssists ||
    podium?.mvp
  );

  const openEdit = () => {
    if (isLocked) return;
    vibratePop();
    setLocalData({
      champion: podium?.champion || '',
      runnerUp: podium?.runnerUp || '',
      topScorer: podium?.topScorer || '',
      mostAssists: podium?.mostAssists || '',
      mvp: podium?.mvp || '',
    });
    setWizardStep(1);
    setSearchTerm('');
    setIsModalOpen(true);
  };

  const handleSavePodium = async () => {
    if (!onSave || isLocked) return;
    try {
      await onSave({
        champion: (localData.champion || '').trim(),
        championLogo: getTeamLogoByName(localData.champion),
        runnerUp: (localData.runnerUp || '').trim(),
        runnerUpLogo: getTeamLogoByName(localData.runnerUp),
        topScorer: (localData.topScorer || '').trim(),
        mostAssists: (localData.mostAssists || '').trim(),
        mvp: (localData.mvp || '').trim(),
      });
      vibrateSuccess();
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      vibrateError();
    }
  };

  const championLogo = podium?.championLogo || getTeamLogoByName(podium?.champion);
  const runnerUpLogo = podium?.runnerUpLogo || getTeamLogoByName(podium?.runnerUp);

  const filteredTeams = UCL_36_TEAMS.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPlayers = POPULAR_PLAYERS.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showCustomPlayer = searchTerm.trim().length > 0 && !POPULAR_PLAYERS.some(
    p => p.name.toLowerCase() === searchTerm.toLowerCase()
  );

  const currentSelectedPlayer = wizardStep === 3 
    ? localData.topScorer 
    : (wizardStep === 4 ? localData.mostAssists : localData.mvp);
  const isCustomAlreadySelected = !!currentSelectedPlayer && !POPULAR_PLAYERS.some(
    p => p.name.toLowerCase() === currentSelectedPlayer.toLowerCase()
  );

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
                <span className="text-[11px] text-zinc-400 font-medium">Campeón, Subcampeón, Goleador, Asistidor y MVP</span>
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

            {/* Individual Awards: Goleador, Asistidor y MVP */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-4 pt-3 border-t border-zinc-800/80">
              {/* Top Scorer / Goleador */}
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2 sm:p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30 shrink-0">
                    <Flame className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-wider truncate">
                    Goleador
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-emerald-100 truncate pl-0.5" title={podium.topScorer}>
                  {podium.topScorer || 'Sin definir'}
                </p>
              </div>

              {/* Most Assists / Asistidor */}
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-2 sm:p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30 shrink-0">
                    <Zap className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-wider truncate">
                    Asistidor
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-blue-100 truncate pl-0.5" title={podium.mostAssists}>
                  {podium.mostAssists || 'Sin definir'}
                </p>
              </div>

              {/* MVP del Torneo */}
              <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-xl p-2 sm:p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30 shrink-0">
                    <UserCheck className="w-3 h-3 text-indigo-400" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-wider truncate">
                    MVP
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-indigo-100 truncate pl-0.5" title={podium.mvp}>
                  {podium.mvp || 'Sin definir'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Podium Bottom Sheet Wizard */}
      {canEdit && (
        <BaseBottomSheet
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Configurar tu Podio"
        >
          <div className="pb-4">
            {isLocked ? (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-200">El tiempo límite para editar el podio ha finalizado.</p>
              </div>
            ) : (
              <div className="flex flex-col h-[70vh]">
                {/* Header & Steps */}
                <div className="shrink-0 space-y-3 pb-3">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                    <span className="uppercase tracking-widest">Tus Candidatos</span>
                    <span>Paso {wizardStep} de 5</span>
                  </div>

                  <div className="w-full bg-zinc-800/80 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${(wizardStep / 5) * 100}%` }}
                    />
                  </div>

                  <div className="text-center space-y-1.5 pt-1">
                    {wizardStep === 1 && <Crown className="w-10 h-10 text-amber-400 mx-auto drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />}
                    {wizardStep === 2 && <Medal className="w-10 h-10 text-zinc-300 mx-auto drop-shadow-[0_0_15px_rgba(212,212,216,0.2)]" />}
                    {wizardStep === 3 && <Flame className="w-10 h-10 text-emerald-400 mx-auto drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />}
                    {wizardStep === 4 && <Zap className="w-10 h-10 text-blue-400 mx-auto drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />}
                    {wizardStep === 5 && <UserCheck className="w-10 h-10 text-indigo-400 mx-auto drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]" />}
                    
                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                      {wizardStep === 1 && '¿Quién crees que será campeón?'}
                      {wizardStep === 2 && '¿Quién será el Subcampeón?'}
                      {wizardStep === 3 && '¿Quién será el Máximo Goleador?'}
                      {wizardStep === 4 && '¿Quién dará Más Asistencias?'}
                      {wizardStep === 5 && '¿Quién será el MVP del Torneo?'}
                    </h2>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={wizardStep <= 2 ? "Buscar equipo (Ej: Real Madrid)..." : "Buscar o escribir jugador..."}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white placeholder:text-zinc-500 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1 custom-scrollbar">
                  {wizardStep <= 2 ? (
                    filteredTeams.map(team => {
                      const isSelected = wizardStep === 1 ? localData.champion === team.name : localData.runnerUp === team.name;
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => {
                            vibratePop();
                            setLocalData(p => wizardStep === 1 ? { ...p, champion: team.name } : { ...p, runnerUp: team.name });
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                            isSelected 
                              ? "bg-blue-500/15 border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                              : "bg-[#141418] border-zinc-800/80 hover:bg-zinc-900/80 hover:border-zinc-700"
                          )}
                        >
                          <TeamBadge src={`https://img.sofascore.com/api/v1/team/${team.id}/image`} teamName={team.name} size="md" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={cn("text-xs font-bold truncate", isSelected ? "text-blue-400" : "text-white")}>{team.name}</span>
                            <span className="text-[10px] text-zinc-500 font-medium">{team.country}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <>
                      {/* Show current custom choice if not in popular list */}
                      {isCustomAlreadySelected && (!searchTerm.trim() || currentSelectedPlayer?.toLowerCase().includes(searchTerm.toLowerCase())) && (
                        <button
                          type="button"
                          onClick={() => {
                            vibratePop();
                            setLocalData(p => {
                              if (wizardStep === 3) return { ...p, topScorer: currentSelectedPlayer };
                              if (wizardStep === 4) return { ...p, mostAssists: currentSelectedPlayer };
                              return { ...p, mvp: currentSelectedPlayer };
                            });
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left bg-blue-500/15 border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                        >
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentSelectedPlayer || '')}&background=27272a&color=3b82f6&size=128&bold=true`} 
                            alt={currentSelectedPlayer} 
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-blue-500/40" 
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs font-bold text-blue-400 truncate">{currentSelectedPlayer}</span>
                            <span className="text-[10px] text-zinc-400 font-medium">Selección personalizada</span>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                        </button>
                      )}

                      {filteredPlayers.map(player => {
                        const isSelected = (wizardStep === 3 && localData.topScorer === player.name) ||
                                           (wizardStep === 4 && localData.mostAssists === player.name) ||
                                           (wizardStep === 5 && localData.mvp === player.name);
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              vibratePop();
                              setLocalData(p => {
                                if (wizardStep === 3) return { ...p, topScorer: player.name };
                                if (wizardStep === 4) return { ...p, mostAssists: player.name };
                                return { ...p, mvp: player.name };
                              });
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                              isSelected 
                                ? "bg-blue-500/15 border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                : "bg-[#141418] border-zinc-800/80 hover:bg-zinc-900/80 hover:border-zinc-700"
                            )}
                          >
                            <img 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=27272a&color=fff&size=128&bold=true`} 
                              alt={player.name} 
                              className="w-10 h-10 rounded-full object-cover shrink-0 border border-zinc-700/50" 
                            />
                            <div className="flex-1 min-w-0">
                              <span className={cn("text-xs font-bold truncate", isSelected ? "text-blue-400" : "text-white")}>{player.name}</span>
                            </div>
                            {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}

                      {showCustomPlayer && (
                        <button
                          type="button"
                          onClick={() => {
                            vibratePop();
                            const val = searchTerm.trim();
                            setLocalData(p => {
                              if (wizardStep === 3) return { ...p, topScorer: val };
                              if (wizardStep === 4) return { ...p, mostAssists: val };
                              return { ...p, mvp: val };
                            });
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left bg-zinc-900 border-zinc-700 hover:border-blue-500/50"
                        >
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(searchTerm.trim())}&background=27272a&color=3b82f6&size=128&bold=true`} 
                            alt="Custom" 
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-blue-500/30" 
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs font-bold text-white truncate">{searchTerm.trim()}</span>
                            <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">Usar este nombre personalizado</span>
                          </div>
                        </button>
                      )}
                    </>
                  )}

                  {(wizardStep <= 2 ? filteredTeams.length === 0 : (filteredPlayers.length === 0 && !showCustomPlayer && !isCustomAlreadySelected)) && (
                    <div className="text-center py-8">
                      <p className="text-xs text-zinc-500 font-medium">No se encontraron resultados para "{searchTerm}"</p>
                    </div>
                  )}
                </div>

                {/* Bottom Navigation Controls */}
                <div className="pt-3 border-t border-zinc-800 flex gap-2 shrink-0">
                  {wizardStep > 1 && (
                    <button 
                      type="button"
                      onClick={() => {
                        vibratePop();
                        setWizardStep(w => w - 1);
                        setSearchTerm('');
                      }} 
                      className="px-5 py-3 bg-[#141418] hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-700 transition-colors"
                    >
                      Atrás
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => {
                      vibratePop();
                      if (wizardStep < 5) {
                        setWizardStep(w => w + 1);
                        setSearchTerm('');
                      } else {
                        handleSavePodium();
                      }
                    }} 
                    disabled={
                      isSaving ||
                      (wizardStep === 1 && !localData.champion) ||
                      (wizardStep === 2 && !localData.runnerUp) ||
                      (wizardStep === 3 && !localData.topScorer) ||
                      (wizardStep === 4 && !localData.mostAssists) ||
                      (wizardStep === 5 && !localData.mvp)
                    }
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2"
                  >
                    {wizardStep < 5 ? 'Siguiente' : (isSaving ? 'Guardando...' : 'Guardar Podio')}
                    {wizardStep < 5 ? <ArrowRight className="w-4 h-4" /> : (!isSaving && <Save className="w-4 h-4" />)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </BaseBottomSheet>
      )}
    </div>
  );
}
