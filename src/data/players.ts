export interface PlayerItem {
  id?: number | string;
  name: string;
  team?: string;
  position?: string;
  nationality?: string;
}

export const NATIONALITY_TRANSLATIONS: Record<string, string> = {
  'france': 'Francia 🇫🇷',
  'francia': 'Francia 🇫🇷',
  'england': 'Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'inglaterra': 'Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'brazil': 'Brasil 🇧🇷',
  'brasil': 'Brasil 🇧🇷',
  'spain': 'España 🇪🇸',
  'españa': 'España 🇪🇸',
  'germany': 'Alemania 🇩🇪',
  'alemania': 'Alemania 🇩🇪',
  'norway': 'Noruega 🇳🇴',
  'noruega': 'Noruega 🇳🇴',
  'argentina': 'Argentina 🇦🇷',
  'italy': 'Italia 🇮🇹',
  'italia': 'Italia 🇮🇹',
  'egypt': 'Egipto 🇪🇬',
  'egipto': 'Egipto 🇪🇬',
  'belgium': 'Bélgica 🇧🇪',
  'belgica': 'Bélgica 🇧🇪',
  'bélgica': 'Bélgica 🇧🇪',
  'colombia': 'Colombia 🇨🇴',
  'portugal': 'Portugal 🇵🇹',
  'united states': 'Estados Unidos 🇺🇸',
  'estados unidos': 'Estados Unidos 🇺🇸',
  'usa': 'Estados Unidos 🇺🇸',
  'serbia': 'Serbia 🇷🇸',
  'sweden': 'Suecia 🇸🇪',
  'suecia': 'Suecia 🇸🇪',
  'turkey': 'Turquía 🇹🇷',
  'turquia': 'Turquía 🇹🇷',
  'turquía': 'Turquía 🇹🇷',
  'uruguay': 'Uruguay 🇺🇾',
  'morocco': 'Marruecos 🇲🇦',
  'marruecos': 'Marruecos 🇲🇦',
  'netherlands': 'Países Bajos 🇳🇱',
  'paises bajos': 'Países Bajos 🇳🇱',
  'países bajos': 'Países Bajos 🇳🇱',
  'holland': 'Países Bajos 🇳🇱',
  'holanda': 'Países Bajos 🇳🇱',
  'nigeria': 'Nigeria 🇳🇬',
  'guinea': 'Guinea 🇬🇳',
  'slovenia': 'Eslovenia 🇸🇮',
  'eslovenia': 'Eslovenia 🇸🇮',
  'south korea': 'Corea del Sur 🇰🇷',
  'corea del sur': 'Corea del Sur 🇰🇷',
  'georgia': 'Georgia 🇬🇪',
  'croatia': 'Croacia 🇭🇷',
  'croacia': 'Croacia 🇭🇷',
  'austria': 'Austria 🇦🇹',
  'switzerland': 'Suiza 🇨🇭',
  'suiza': 'Suiza 🇨🇭',
  'denmark': 'Dinamarca 🇩🇰',
  'dinamarca': 'Dinamarca 🇩🇰',
  'poland': 'Polonia 🇵🇱',
  'polonia': 'Polonia 🇵🇱',
  'ukraine': 'Ucrania 🇺🇦',
  'ucrania': 'Ucrania 🇺🇦',
  'scotland': 'Escocia 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'escocia': 'Escocia 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'wales': 'Gales 🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'gales': 'Gales 🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'chile': 'Chile 🇨🇱',
  'mexico': 'México 🇲🇽',
  'méxico': 'México 🇲🇽',
  'japan': 'Japón 🇯🇵',
  'japon': 'Japón 🇯🇵',
  'ecuador': 'Ecuador 🇪🇨',
  'peru': 'Perú 🇵🇪',
  'perú': 'Perú 🇵🇪',
  'venezuela': 'Venezuela 🇻🇪',
  'paraguay': 'Paraguay 🇵🇾',
  'canada': 'Canadá 🇨🇦',
  'canadá': 'Canadá 🇨🇦',
  'greece': 'Grecia 🇬🇷',
  'grecia': 'Grecia 🇬🇷',
  'czechia': 'República Checa 🇨🇿',
  'republica checa': 'República Checa 🇨🇿',
  'república checa': 'República Checa 🇨🇿',
  'azerbaijan': 'Azerbaiyán 🇦🇿',
  'azerbaiyan': 'Azerbaiyán 🇦🇿',
  'azerbaiyán': 'Azerbaiyán 🇦🇿',
  'slovakia': 'Eslovaquia 🇸🇰',
  'eslovaquia': 'Eslovaquia 🇸🇰',
  'türkiye': 'Turquía 🇹🇷'
};

export const POSITION_TRANSLATIONS: Record<string, string> = {
  'forward': 'Delantero',
  'delantero': 'Delantero',
  'midfielder': 'Centrocampista',
  'centrocampista': 'Centrocampista',
  'medio': 'Centrocampista',
  'defender': 'Defensa',
  'defensa': 'Defensa',
  'goalkeeper': 'Portero',
  'portero': 'Portero',
  'arquero': 'Portero'
};

export function formatNationality(nat?: string): string {
  if (!nat) return '';
  const clean = nat.trim();
  const lower = clean.toLowerCase();
  if (NATIONALITY_TRANSLATIONS[lower]) {
    return NATIONALITY_TRANSLATIONS[lower];
  }
  return clean;
}

export function formatPosition(pos?: string): string {
  if (!pos) return '';
  const clean = pos.trim();
  const lower = clean.toLowerCase();
  if (POSITION_TRANSLATIONS[lower]) {
    return POSITION_TRANSLATIONS[lower];
  }
  return clean;
}

export function normalizePlayerKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip diacritics / accents
    .replace(/[^a-z0-9]/g, "") // Remove spaces, dots, dashes
    .trim();
}

/**
 * Deduplicate and merge player lists without creating duplicates.
 * Automatically translates nationalities with flag emojis and positions to Spanish.
 */
export function deduplicatePlayers(
  existingList: PlayerItem[],
  incomingList: PlayerItem[]
): { merged: PlayerItem[]; addedCount: number; updatedCount: number } {
  const merged: PlayerItem[] = [...existingList];
  let addedCount = 0;
  let updatedCount = 0;

  for (const inc of incomingList) {
    if (!inc.name || !inc.name.trim()) continue;
    const cleanName = inc.name.trim();
    const key = normalizePlayerKey(cleanName);
    const formattedNat = formatNationality(inc.nationality);
    const formattedPos = formatPosition(inc.position);

    const existingIndex = merged.findIndex(p => {
      const pKey = normalizePlayerKey(p.name);
      if (pKey === key) return true;
      // Also match if one is abbreviated version e.g. "K. Mbappé" and "Kylian Mbappé"
      const pWords = p.name.toLowerCase().split(/\s+/);
      const incWords = cleanName.toLowerCase().split(/\s+/);
      if (pWords.length > 1 && incWords.length > 1) {
        const pLastName = pWords[pWords.length - 1];
        const incLastName = incWords[incWords.length - 1];
        if (pLastName === incLastName && pWords[0][0] === incWords[0][0]) {
          return true;
        }
      }
      return false;
    });

    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      const preferredName = cleanName.length >= existing.name.length ? cleanName : existing.name;
      merged[existingIndex] = {
        ...existing,
        name: preferredName,
        team: inc.team || existing.team,
        position: formattedPos || existing.position,
        nationality: formattedNat || existing.nationality,
        id: existing.id || inc.id || Math.floor(100000 + Math.random() * 900000)
      };
      updatedCount++;
    } else {
      merged.push({
        id: inc.id || Math.floor(100000 + Math.random() * 900000),
        name: cleanName,
        team: inc.team || '',
        position: formattedPos || '',
        nationality: formattedNat || ''
      });
      addedCount++;
    }
  }

  // Sort alphabetically by name
  merged.sort((a, b) => a.name.localeCompare(b.name));

  return { merged, addedCount, updatedCount };
}

// Initial 10 players present in early app version to identify custom names
export const ORIGINAL_10_PLAYERS = [
  'k. mbappé', 'kylian mbappé',
  'e. haaland', 'erling haaland',
  'v. júnior', 'vinícius júnior', 'vinicius junior',
  'h. kane', 'harry kane',
  'j. bellingham', 'jude bellingham',
  'm. salah', 'mohamed salah',
  'r. lewandowski', 'robert lewandowski',
  'l. yamal', 'lamine yamal',
  'f. wirtz', 'florian wirtz',
  'k. de bruyne', 'kevin de bruyne'
];

export function hasUserCustomPlayer(podium: {
  topScorer?: string;
  mostAssists?: string;
  mvp?: string;
  hasCustomPlayer?: boolean;
} | null | undefined): boolean {
  if (!podium) return false;
  if (podium.hasCustomPlayer) return true;

  const isCustom = (name?: string) => {
    if (!name || !name.trim()) return false;
    const clean = name.trim().toLowerCase();
    return !ORIGINAL_10_PLAYERS.includes(clean);
  };

  return isCustom(podium.topScorer) || isCustom(podium.mostAssists) || isCustom(podium.mvp);
}

export const DEFAULT_PLAYERS: PlayerItem[] = [
  // 18 Originales Champions 2026/27
  {
    id: 351860,
    name: "Kylian Mbappé",
    team: "Real Madrid C.F.",
    position: "Delantero",
    nationality: "Francia 🇫🇷"
  },
  {
    id: 954060,
    name: "Jude Bellingham",
    team: "Real Madrid C.F.",
    position: "Centrocampista",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 843926,
    name: "Vinícius Júnior",
    team: "Real Madrid C.F.",
    position: "Delantero",
    nationality: "Brasil 🇧🇷"
  },
  {
    id: 1478144,
    name: "Lamine Yamal",
    team: "FC Barcelona",
    position: "Delantero",
    nationality: "España 🇪🇸"
  },
  {
    id: 981995,
    name: "Pedri",
    team: "FC Barcelona",
    position: "Centrocampista",
    nationality: "España 🇪🇸"
  },
  {
    id: 988562,
    name: "Michael Olise",
    team: "Bayern Munich",
    position: "Delantero",
    nationality: "Francia 🇫🇷"
  },
  {
    id: 981996,
    name: "Jamal Musiala",
    team: "Bayern Munich",
    position: "Centrocampista",
    nationality: "Alemania 🇩🇪"
  },
  {
    id: 170323,
    name: "Harry Kane",
    team: "Bayern Munich",
    position: "Delantero",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 839956,
    name: "Erling Haaland",
    team: "Manchester City",
    position: "Delantero",
    nationality: "Noruega 🇳🇴"
  },
  {
    id: 883506,
    name: "Phil Foden",
    team: "Manchester City",
    position: "Centrocampista",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 994512,
    name: "Enzo Fernández",
    team: "Chelsea",
    position: "Centrocampista",
    nationality: "Argentina 🇦🇷"
  },
  {
    id: 934389,
    name: "Bukayo Saka",
    team: "Arsenal Football Club",
    position: "Delantero",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 345091,
    name: "Martin Ødegaard",
    team: "Arsenal Football Club",
    position: "Centrocampista",
    nationality: "Noruega 🇳🇴"
  },
  {
    id: 843927,
    name: "Declan Rice",
    team: "Arsenal Football Club",
    position: "Centrocampista",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 954061,
    name: "Khvicha Kvaratskhelia",
    team: "Paris Saint-Germain",
    position: "Delantero",
    nationality: "Georgia 🇬🇪"
  },
  {
    id: 345092,
    name: "Ousmane Dembélé",
    team: "Paris Saint-Germain",
    position: "Delantero",
    nationality: "Francia 🇫🇷"
  },
  {
    id: 825700,
    name: "Lautaro Martínez",
    team: "Inter de Milán",
    position: "Delantero",
    nationality: "Argentina 🇦🇷"
  },
  {
    id: 839957,
    name: "Nicolò Barella",
    team: "Inter de Milán",
    position: "Centrocampista",
    nationality: "Italia 🇮🇹"
  },

  // 6 Estrellas adicionales reconocidas
  {
    id: 159665,
    name: "Mohamed Salah",
    team: "Liverpool",
    position: "Delantero",
    nationality: "Egipto 🇪🇬"
  },
  {
    id: 981997,
    name: "Florian Wirtz",
    team: "Bayer Leverkusen",
    position: "Centrocampista",
    nationality: "Alemania 🇩🇪"
  },
  {
    id: 839955,
    name: "Rodri",
    team: "Manchester City",
    position: "Centrocampista",
    nationality: "España 🇪🇸"
  },
  {
    id: 104523,
    name: "Kevin De Bruyne",
    team: "Manchester City",
    position: "Centrocampista",
    nationality: "Bélgica 🇧🇪"
  },
  {
    id: 41856,
    name: "Antoine Griezmann",
    team: "Atlético de Madrid",
    position: "Delantero",
    nationality: "Francia 🇫🇷"
  },
  {
    id: 988563,
    name: "Cole Palmer",
    team: "Chelsea",
    position: "Centrocampista",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },

  // 50 Nuevas estrellas solicitadas
  {
    id: 843928,
    name: "Rodrygo",
    team: "Real Madrid C.F.",
    position: "Delantero",
    nationality: "Brasil 🇧🇷"
  },
  {
    id: 839958,
    name: "Luis Díaz",
    team: "Liverpool",
    position: "Delantero",
    nationality: "Colombia 🇨🇴"
  },
  {
    id: 954062,
    name: "Julián Álvarez",
    team: "Atlético de Madrid",
    position: "Delantero",
    nationality: "Argentina 🇦🇷"
  },
  {
    id: 843929,
    name: "Raphinha",
    team: "FC Barcelona",
    position: "Delantero",
    nationality: "Brasil 🇧🇷"
  },
  {
    id: 839959,
    name: "Dani Olmo",
    team: "FC Barcelona",
    position: "Centrocampista",
    nationality: "España 🇪🇸"
  },
  {
    id: 843930,
    name: "Kai Havertz",
    team: "Arsenal Football Club",
    position: "Delantero",
    nationality: "Alemania 🇩🇪"
  },
  {
    id: 843931,
    name: "Marcus Thuram",
    team: "Inter de Milán",
    position: "Delantero",
    nationality: "Francia 🇫🇷"
  },
  {
    id: 988564,
    name: "Bradley Barcola",
    team: "Paris Saint-Germain",
    position: "Delantero",
    nationality: "Francia 🇫🇷"
  },
  {
    id: 988565,
    name: "Savinho",
    team: "Manchester City",
    position: "Delantero",
    nationality: "Brasil 🇧🇷"
  },
  {
    id: 843932,
    name: "Rafael Leão",
    team: "AC Milan",
    position: "Delantero",
    nationality: "Portugal 🇵🇹"
  },
  {
    id: 839960,
    name: "Christian Pulisic",
    team: "AC Milan",
    position: "Delantero",
    nationality: "Estados Unidos 🇺🇸"
  },
  {
    id: 843933,
    name: "Dušan Vlahović",
    team: "Juventus",
    position: "Delantero",
    nationality: "Serbia 🇷🇸"
  },
  {
    id: 843934,
    name: "Viktor Gyökeres",
    team: "Sporting CP",
    position: "Delantero",
    nationality: "Suecia 🇸🇪"
  },
  {
    id: 981998,
    name: "Gavi",
    team: "FC Barcelona",
    position: "Centrocampista",
    nationality: "España 🇪🇸"
  },
  {
    id: 1478145,
    name: "Endrick",
    team: "Real Madrid C.F.",
    position: "Delantero",
    nationality: "Brasil 🇧🇷"
  },
  {
    id: 988566,
    name: "Arda Güler",
    team: "Real Madrid C.F.",
    position: "Centrocampista",
    nationality: "Turquía 🇹🇷"
  },
  {
    id: 843935,
    name: "Federico Valverde",
    team: "Real Madrid C.F.",
    position: "Centrocampista",
    nationality: "Uruguay 🇺🇾"
  },
  {
    id: 843936,
    name: "Brahim Díaz",
    team: "Real Madrid C.F.",
    position: "Centrocampista",
    nationality: "Marruecos 🇲🇦"
  },
  {
    id: 839961,
    name: "Bernardo Silva",
    team: "Manchester City",
    position: "Centrocampista",
    nationality: "Portugal 🇵🇹"
  },
  {
    id: 988567,
    name: "Jérémy Doku",
    team: "Manchester City",
    position: "Delantero",
    nationality: "Bélgica 🇧🇪"
  },
  {
    id: 839962,
    name: "Leroy Sané",
    team: "Bayern Munich",
    position: "Delantero",
    nationality: "Alemania 🇩🇪"
  },
  {
    id: 843937,
    name: "Darwin Núñez",
    team: "Liverpool",
    position: "Delantero",
    nationality: "Uruguay 🇺🇾"
  },
  {
    id: 843938,
    name: "Gabriel Martinelli",
    team: "Arsenal Football Club",
    position: "Delantero",
    nationality: "Brasil 🇧🇷"
  },
  {
    id: 981999,
    name: "Xavi Simons",
    team: "RB Leipzig",
    position: "Centrocampista",
    nationality: "Países Bajos 🇳🇱"
  },
  {
    id: 839963,
    name: "Bruno Fernandes",
    team: "Manchester United",
    position: "Centrocampista",
    nationality: "Portugal 🇵🇹"
  },
  {
    id: 988568,
    name: "Alejandro Garnacho",
    team: "Manchester United",
    position: "Delantero",
    nationality: "Argentina 🇦🇷"
  },
  {
    id: 843939,
    name: "Cody Gakpo",
    team: "Liverpool",
    position: "Delantero",
    nationality: "Países Bajos 🇳🇱"
  },
  {
    id: 843940,
    name: "Diogo Jota",
    team: "Liverpool",
    position: "Delantero",
    nationality: "Portugal 🇵🇹"
  },
  {
    id: 839964,
    name: "Trent Alexander-Arnold",
    team: "Liverpool",
    position: "Defensa",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 988569,
    name: "Fermín López",
    team: "FC Barcelona",
    position: "Centrocampista",
    nationality: "España 🇪🇸"
  },
  {
    id: 843941,
    name: "Victor Boniface",
    team: "Bayer Leverkusen",
    position: "Delantero",
    nationality: "Nigeria 🇳🇬"
  },
  {
    id: 843942,
    name: "Alejandro Grimaldo",
    team: "Bayer Leverkusen",
    position: "Defensa",
    nationality: "España 🇪🇸"
  },
  {
    id: 843943,
    name: "Jeremie Frimpong",
    team: "Bayer Leverkusen",
    position: "Defensa",
    nationality: "Países Bajos 🇳🇱"
  },
  {
    id: 843944,
    name: "Vitinha",
    team: "Paris Saint-Germain",
    position: "Centrocampista",
    nationality: "Portugal 🇵🇹"
  },
  {
    id: 839965,
    name: "Hakan Çalhanoğlu",
    team: "Inter de Milán",
    position: "Centrocampista",
    nationality: "Turquía 🇹🇷"
  },
  {
    id: 988570,
    name: "Kenan Yıldız",
    team: "Juventus",
    position: "Delantero",
    nationality: "Turquía 🇹🇷"
  },
  {
    id: 843945,
    name: "Ollie Watkins",
    team: "Aston Villa",
    position: "Delantero",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 843946,
    name: "Serhou Guirassy",
    team: "Borussia Dortmund",
    position: "Delantero",
    nationality: "Guinea 🇬🇳"
  },
  {
    id: 843947,
    name: "Karim Adeyemi",
    team: "Borussia Dortmund",
    position: "Delantero",
    nationality: "Alemania 🇩🇪"
  },
  {
    id: 839966,
    name: "Julian Brandt",
    team: "Borussia Dortmund",
    position: "Centrocampista",
    nationality: "Alemania 🇩🇪"
  },
  {
    id: 843948,
    name: "Loïs Openda",
    team: "RB Leipzig",
    position: "Delantero",
    nationality: "Bélgica 🇧🇪"
  },
  {
    id: 988571,
    name: "Benjamin Šeško",
    team: "RB Leipzig",
    position: "Delantero",
    nationality: "Eslovenia 🇸🇮"
  },
  {
    id: 839967,
    name: "Leandro Trossard",
    team: "Arsenal Football Club",
    position: "Delantero",
    nationality: "Bélgica 🇧🇪"
  },
  {
    id: 839968,
    name: "Alexander Sørloth",
    team: "Atlético de Madrid",
    position: "Delantero",
    nationality: "Noruega 🇳🇴"
  },
  {
    id: 843949,
    name: "Nico Williams",
    team: "Athletic Club",
    position: "Delantero",
    nationality: "España 🇪🇸"
  },
  {
    id: 843950,
    name: "Oihan Sancet",
    team: "Athletic Club",
    position: "Centrocampista",
    nationality: "España 🇪🇸"
  },
  {
    id: 839969,
    name: "Son Heung-min",
    team: "Tottenham Hotspur",
    position: "Delantero",
    nationality: "Corea del Sur 🇰🇷"
  },
  {
    id: 843951,
    name: "Dominic Solanke",
    team: "Tottenham Hotspur",
    position: "Delantero",
    nationality: "Inglaterra 🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 839970,
    name: "Serge Gnabry",
    team: "Bayern Munich",
    position: "Delantero",
    nationality: "Alemania 🇩🇪"
  },
  {
    id: 843952,
    name: "Ademola Lookman",
    team: "Atalanta",
    position: "Delantero",
    nationality: "Nigeria 🇳🇬"
  }
];
