export interface PlayerItem {
  id?: number | string;
  name: string;
  team?: string;
  position?: string;
  nationality?: string;
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
 * If a player with matching normalized name already exists, it enriches team/position/nationality.
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
      // Update fields if missing or cleaner
      const existing = merged[existingIndex];
      const preferredName = cleanName.length >= existing.name.length ? cleanName : existing.name;
      merged[existingIndex] = {
        ...existing,
        name: preferredName,
        team: inc.team || existing.team,
        position: inc.position || existing.position,
        nationality: inc.nationality || existing.nationality,
        id: existing.id || inc.id || Math.floor(100000 + Math.random() * 900000)
      };
      updatedCount++;
    } else {
      merged.push({
        id: inc.id || Math.floor(100000 + Math.random() * 900000),
        name: cleanName,
        team: inc.team || '',
        position: inc.position || '',
        nationality: inc.nationality || ''
      });
      addedCount++;
    }
  }

  // Sort alphabetically by name
  merged.sort((a, b) => a.name.localeCompare(b.name));

  return { merged, addedCount, updatedCount };
}

export const DEFAULT_PLAYERS: PlayerItem[] = [
  {
    id: 351860,
    name: "Kylian Mbappé",
    team: "Real Madrid C.F.",
    position: "Forward",
    nationality: "France"
  },
  {
    id: 954060,
    name: "Jude Bellingham",
    team: "Real Madrid C.F.",
    position: "Midfielder",
    nationality: "England"
  },
  {
    id: 843926,
    name: "Vinícius Júnior",
    team: "Real Madrid C.F.",
    position: "Forward",
    nationality: "Brazil"
  },
  {
    id: 1478144,
    name: "Lamine Yamal",
    team: "FC Barcelona",
    position: "Forward",
    nationality: "Spain"
  },
  {
    id: 981995,
    name: "Pedri",
    team: "FC Barcelona",
    position: "Midfielder",
    nationality: "Spain"
  },
  {
    id: 988562,
    name: "Michael Olise",
    team: "Bayern Munich",
    position: "Forward",
    nationality: "France"
  },
  {
    id: 981996,
    name: "Jamal Musiala",
    team: "Bayern Munich",
    position: "Midfielder",
    nationality: "Germany"
  },
  {
    id: 170323,
    name: "Harry Kane",
    team: "Bayern Munich",
    position: "Forward",
    nationality: "England"
  },
  {
    id: 839956,
    name: "Erling Haaland",
    team: "Manchester City",
    position: "Forward",
    nationality: "Norway"
  },
  {
    id: 883506,
    name: "Phil Foden",
    team: "Manchester City",
    position: "Midfielder",
    nationality: "England"
  },
  {
    id: 994512,
    name: "Enzo Fernández",
    team: "Manchester City",
    position: "Midfielder",
    nationality: "Argentina"
  },
  {
    id: 934389,
    name: "Bukayo Saka",
    team: "Arsenal Football Club",
    position: "Forward",
    nationality: "England"
  },
  {
    id: 345091,
    name: "Martin Ødegaard",
    team: "Arsenal Football Club",
    position: "Midfielder",
    nationality: "Norway"
  },
  {
    id: 843927,
    name: "Declan Rice",
    team: "Arsenal Football Club",
    position: "Midfielder",
    nationality: "England"
  },
  {
    id: 954061,
    name: "Khvicha Kvaratskhelia",
    team: "Paris Saint-Germain",
    position: "Forward",
    nationality: "Georgia"
  },
  {
    id: 345092,
    name: "Ousmane Dembélé",
    team: "Paris Saint-Germain",
    position: "Forward",
    nationality: "France"
  },
  {
    id: 825700,
    name: "Lautaro Martínez",
    team: "Inter de Milán",
    position: "Forward",
    nationality: "Argentina"
  },
  {
    id: 839957,
    name: "Nicolò Barella",
    team: "Inter de Milán",
    position: "Midfielder",
    nationality: "Italy"
  },
  {
    id: 159665,
    name: "Mohamed Salah",
    team: "Liverpool",
    position: "Forward",
    nationality: "Egypt"
  },
  {
    id: 981997,
    name: "Florian Wirtz",
    team: "Bayer Leverkusen",
    position: "Midfielder",
    nationality: "Germany"
  },
  {
    id: 839955,
    name: "Rodri",
    team: "Manchester City",
    position: "Midfielder",
    nationality: "Spain"
  },
  {
    id: 104523,
    name: "Kevin De Bruyne",
    team: "Manchester City",
    position: "Midfielder",
    nationality: "Belgium"
  },
  {
    id: 41856,
    name: "Antoine Griezmann",
    team: "Atlético Madrid",
    position: "Forward",
    nationality: "France"
  },
  {
    id: 988563,
    name: "Cole Palmer",
    team: "Chelsea",
    position: "Midfielder",
    nationality: "England"
  }
];
