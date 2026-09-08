import React from 'react';
import { Home, Table2, Users, Shield, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unpredictedCount: number;
}

export function BottomNav({ activeTab, setActiveTab, unpredictedCount }: BottomNavProps) {
  const tabs = [
    { id: 'predictions', label: 'Partidos', icon: Home, domId: 'nav-matches' },
    { id: 'standings', label: 'Tabla', icon: Table2, domId: 'nav-standings' },
    { id: 'ranking', label: 'Ranking', icon: Users, domId: 'nav-ranking' },
    { id: 'settings', label: 'Grupo', icon: Shield, domId: 'nav-settings' },
    { id: 'profile', label: 'Perfil', icon: UserIcon, domId: 'nav-profile' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 w-full z-[999] m-0 bg-[#111114]/95 backdrop-blur-2xl border-t border-zinc-800/80 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-4xl mx-auto flex justify-between px-1 py-1">
        {/* Main 2 Tabs: Partidos y Tabla */}
        {tabs.slice(0, 2).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={tab.domId || ''}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-tight transition-all relative cursor-pointer",
                isActive ? "text-blue-400 font-black" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
              )}
              <div className={cn(
                "p-1 rounded-lg transition-all relative",
                isActive ? "text-blue-400" : ""
              )}>
                <Icon className={cn("w-4 h-4", isActive ? "stroke-[2.5px]" : "stroke-[1.75px]")} />
                {tab.id === 'predictions' && unpredictedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-[#111114] rounded-full animate-pulse" />
                )}
              </div>
              <span className="mt-0.5 leading-none truncate">{tab.label}</span>
            </button>
          );
        })}

        {/* Grouping for Ranking, Grupo and Perfil */}
        <div id="nav-group-ranking-profile" className="flex flex-[3] justify-between">
          {tabs.slice(2).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={tab.domId || ''}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-tight transition-all relative cursor-pointer",
                  isActive ? "text-blue-400 font-black" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                )}
                <div className={cn(
                  "p-1 rounded-lg transition-all relative",
                  isActive ? "text-blue-400" : ""
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "stroke-[2.5px]" : "stroke-[1.75px]")} />
                </div>
                <span className="mt-0.5 leading-none truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
