import React, { useState } from 'react';
import { Shield } from 'lucide-react';

interface TeamBadgeProps {
  src?: string;
  teamName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function TeamBadge({ src, teamName, className = '', size = 'md' }: TeamBadgeProps) {
  const [imageError, setImageError] = useState(false);

  // Helper to extract a 2-3 letter team abbreviation
  const getAbbreviation = (name: string): string => {
    if (!name || name === 'TBD') return 'TBD';
    
    // Generic demo teams
    if (name.toLowerCase().includes('local')) {
      const match = name.match(/local\s*([a-z0-9]+)/i);
      return match ? `LOC ${match[1].toUpperCase()}` : 'LOCAL';
    }
    if (name.toLowerCase().includes('visita') || name.toLowerCase().includes('visitante')) {
      const match = name.match(/visita[a-z]*\s*([a-z0-9]+)/i);
      return match ? `VIS ${match[1].toUpperCase()}` : 'VISITA';
    }

    const cleaned = name.replace(/^(FC|CF|FK|SK|ŠK|GNK|BSC|AC|AS|SS|RB|SV|VfB|VfL|1\.\s*FC|SC)\s+/i, '').trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    } else if (words.length === 2) {
      return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
    } else if (cleaned.length >= 3) {
      return cleaned.slice(0, 3).toUpperCase();
    }
    return name.slice(0, 3).toUpperCase();
  };

  // Reset error state if src changes
  React.useEffect(() => {
    setImageError(false);
  }, [src]);

  // Check if src is a valid image URL
  const isValidUrl = (url?: string): boolean => {
    if (!url) return false;
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:') && !trimmed.startsWith('/')) {
      return false;
    }
    // Check for bad patterns like 'undefined' in the path
    if (trimmed.includes('/undefined/') || trimmed.endsWith('/undefined')) {
      return false;
    }
    return true;
  };

  // Normalize URL or convert Sofascore ID/URL to direct CDN URL
  const getNormalizedUrl = (url?: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    
    // Extract team ID from proxy path: /api/team-image/123
    const apiMatch = trimmed.match(/\/api\/team-image\/(\d+)/);
    if (apiMatch && apiMatch[1]) {
      return `https://img.sofascore.com/api/v1/team/${apiMatch[1]}/image`;
    }

    // If it contains a Sofascore team ID like /team/2888/image or similar
    const teamIdMatch = trimmed.match(/\/team\/(\d+)\/image/);
    if (teamIdMatch && teamIdMatch[1]) {
      return `https://img.sofascore.com/api/v1/team/${teamIdMatch[1]}/image`;
    }

    if (trimmed.includes('api.sofascore.app')) {
      return trimmed.replace('https://api.sofascore.app/', 'https://img.sofascore.com/');
    }

    return trimmed;
  };

  const normalizedSrc = getNormalizedUrl(src);
  const valid = isValidUrl(normalizedSrc) && !imageError;

  const sizeClasses = {
    sm: 'w-6 h-6 text-[9px]',
    md: 'w-12 h-12 text-xs',
    lg: 'w-16 h-16 text-sm',
    xl: 'w-20 h-20 text-base',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  }[size];

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none bg-transparent ${sizeClasses} ${className}`}
      title={teamName}
    >
      {valid ? (
        <img
          src={normalizedSrc}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImageError(true)}
          className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] transition-transform duration-200 hover:scale-110"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-zinc-900/90 border border-zinc-750 flex flex-col items-center justify-center text-zinc-400 font-bold uppercase tracking-wider shadow-inner">
          <Shield className={`${iconSizes} text-zinc-700/70 absolute stroke-[1.5]`} />
          <span className="relative z-10 font-mono text-[9px] sm:text-[10px] text-zinc-300 font-extrabold tracking-tighter drop-shadow-sm">{getAbbreviation(teamName)}</span>
        </div>
      )}
    </div>
  );
}
