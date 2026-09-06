import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Circuit breaker and rate-limiter to protect RapidAPI quota
let rapidApiQuotaExceededUntil = 0;
let lastRapidApiCallTime = 0;
const RAPIDAPI_MIN_INTERVAL = 30 * 60 * 1000; // Minimum 30 minutes between external calls

// Simple in-memory cache to prevent hitting API limits
const cache = {
  busted: Date.now(),
  standings: {
    data: null,
    timestamp: 0,
    TTL: 1000 * 60 * 60 * 24 // 24 hours
  },
  matches: {
    data: null,
    timestamp: 0,
    TTL: 1000 * 60 * 60 * 24 // 24 hours
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API proxy to RapidAPI Sofascore
  app.get("/api/matches", async (req, res) => {
    const force = req.query.force === "true";
    // Check cache
    if (!force && cache.matches.data && (Date.now() - cache.matches.timestamp < cache.matches.TTL)) {
      console.log("Serving /api/matches from cache");
      return res.json(cache.matches.data);
    }
    
    try {
      const apiKey = process.env.RAPIDAPI_KEY || "a23ca9cc5bmshce3587a66049c6dp1befd4jsnd62cedd02401";
      const apiHost = "sportapi7.p.rapidapi.com";
      let finalEvents: any[] = [];
      const eventsPath = path.join(process.cwd(), "real_events.json");
      if (fs.existsSync(eventsPath)) {
        try {
          finalEvents = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
          console.log(`Loaded ${finalEvents.length} official 2026/2027 matches from store`);
        } catch (e) {
          console.error("Error reading real_events.json:", e);
        }
      }

      // Check if RapidAPI is in circuit-breaker cooldown or rate-limited
      const isQuotaExceeded = Date.now() < rapidApiQuotaExceededUntil;
      const isRateLimited = (Date.now() - lastRapidApiCallTime) < RAPIDAPI_MIN_INTERVAL;

      if (!isQuotaExceeded && (!isRateLimited || force)) {
        try {
          lastRapidApiCallTime = Date.now();
          console.log("Attempting single RapidAPI matches query...");
          const targetSeasonId = 96518; // UCL 26/27
          
          const eventsRes = await fetch(`https://${apiHost}/api/v1/unique-tournament/7/season/${targetSeasonId}/events/next/0`, {
            headers: {
              "x-rapidapi-key": apiKey,
              "x-rapidapi-host": apiHost
            }
          });

          if (eventsRes.status === 429) {
            console.warn("RapidAPI quota limit reached (429). Enabling 24h circuit breaker to prevent extra calls.");
            rapidApiQuotaExceededUntil = Date.now() + 24 * 60 * 60 * 1000;
          } else if (eventsRes.ok) {
            const evData = await eventsRes.json();
            if (evData.events && evData.events.length > 0) {
              if (finalEvents.length === 0) {
                finalEvents = evData.events;
              } else {
                const liveMap = new Map<number, any>();
                evData.events.forEach((ev: any) => liveMap.set(ev.id, ev));
                finalEvents = finalEvents.map((existing: any) => {
                  if (liveMap.has(existing.id)) {
                    return { ...existing, ...liveMap.get(existing.id) };
                  }
                  return existing;
                });
              }
              console.log(`RapidAPI: received ${evData.events.length} live matches, merged with ${finalEvents.length} total fixtures`);
            }
          }
        } catch (apiErr) {
          console.warn("RapidAPI fetch exception:", apiErr);
        }
      } else {
        console.log(`Skipping RapidAPI network call (QuotaExceeded: ${isQuotaExceeded}, RateLimited: ${isRateLimited})`);
      }

      const formattedFixtures = finalEvents.map((match: any) => ({
        id: match.id,
        startTimestamp: match.startTimestamp,
        roundInfo: match.roundInfo,
        status: {
          type: match.status?.type || "notstarted",
          description: match.status?.description || "Not started"
        },
        homeTeam: {
          id: match.homeTeam?.id,
          name: match.homeTeam?.name || match.homeTeam?.shortName || "TBD",
          shortName: match.homeTeam?.shortName,
          logo: match.homeTeam?.id ? `/api/team-image/${match.homeTeam.id}` : ""
        },
        awayTeam: {
          id: match.awayTeam?.id,
          name: match.awayTeam?.name || match.awayTeam?.shortName || "TBD",
          shortName: match.awayTeam?.shortName,
          logo: match.awayTeam?.id ? `/api/team-image/${match.awayTeam.id}` : ""
        },
        homeScore: {
          current: match.homeScore?.current
        },
        awayScore: {
          current: match.awayScore?.current
        }
      }));

      const responseData = { events: formattedFixtures };
      cache.matches.data = responseData;
      cache.matches.timestamp = Date.now();
      res.json(responseData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Team logo proxy endpoint
  app.get("/api/team-image/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || id === "undefined" || id === "null") {
        return res.status(404).send("Invalid team id");
      }
      const imgRes = await fetch(`https://img.sofascore.com/api/v1/team/${id}/image`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*"
        }
      });
      if (!imgRes.ok) {
        return res.status(imgRes.status).send("Image fetch failed");
      }
      const contentType = imgRes.headers.get("content-type") || "image/webp";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=604800, immutable"); // Cache for 7 days
      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Error proxying team image:", error);
      res.status(500).send("Error fetching image");
    }
  });

  // Proxy player images from Sofascore to avoid CORS/403
  app.get("/api/player-image/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const imgRes = await fetch(`https://api.sofascore.app/api/v1/player/${id}/image`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          "Origin": "https://www.sofascore.com",
          "Referer": "https://www.sofascore.com/"
        }
      });
      if (!imgRes.ok) {
        return res.status(imgRes.status).send("Image not found");
      }
      const contentType = imgRes.headers.get("content-type") || "image/webp";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=604800, immutable"); // Cache for 7 days
      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Error proxying player image:", error);
      res.status(500).send("Error fetching image");
    }
  });

  // Champions League Standings and Cup Tree (Brackets)
  app.get("/api/standings", async (req, res) => {
    const force = req.query.force === "true";
    if (!force && cache.standings.data && (Date.now() - cache.standings.timestamp < cache.standings.TTL)) {
      console.log("Serving /api/standings from cache");
      return res.json(cache.standings.data);
    }
    if (force && cache.standings.data && (Date.now() - cache.standings.timestamp < RAPIDAPI_MIN_INTERVAL)) {
      console.log("Serving /api/standings from cache (cooldown active)");
      return res.json(cache.standings.data);
    }
    try {
      const apiKey = process.env.RAPIDAPI_KEY || "a23ca9cc5bmshce3587a66049c6dp1befd4jsnd62cedd02401";
      const apiHost = "sportapi7.p.rapidapi.com";

      const seasonId = 96518; // 26/27
      const seasonName = "UEFA Champions League 26/27";
      let standingsRows: any[] = [];
      let tournamentPhaseName = "Fase de Liga (36 Equipos)";
      let cupTrees: any[] = [];

      const isQuotaExceeded = Date.now() < rapidApiQuotaExceededUntil;
      const isRateLimited = (Date.now() - lastRapidApiCallTime) < RAPIDAPI_MIN_INTERVAL;

      if (!isQuotaExceeded && (!isRateLimited || force)) {
        try {
          lastRapidApiCallTime = Date.now();
          console.log("Attempting RapidAPI standings query...");
          
          // Standings Table (36 teams)
          const standingsRes = await fetch(`https://${apiHost}/api/v1/unique-tournament/7/season/${seasonId}/standings/total`, {
            headers: { "x-rapidapi-key": apiKey }
          });

          if (standingsRes.status === 429) {
            console.warn("RapidAPI quota limit reached on standings (429). Enabling 24h circuit breaker.");
            rapidApiQuotaExceededUntil = Date.now() + 24 * 60 * 60 * 1000;
          } else if (standingsRes.ok) {
            const standingsData = await standingsRes.json();
            const mainStandings = standingsData.standings?.[0];
            if (mainStandings && mainStandings.rows && mainStandings.rows.length > 0) {
              tournamentPhaseName = mainStandings.name || tournamentPhaseName;
              standingsRows = mainStandings.rows.map((row: any) => ({
                position: row.position,
                team: {
                  id: row.team?.id,
                  name: row.team?.name || row.team?.shortName || "TBD",
                  shortName: row.team?.shortName || row.team?.name || "",
                  nameCode: row.team?.nameCode || "",
                  logo: row.team?.id ? `/api/team-image/${row.team.id}` : "",
                  country: row.team?.country?.name || ""
                },
                matches: row.matches ?? 0,
                wins: row.wins ?? 0,
                draws: row.draws ?? 0,
                losses: row.losses ?? 0,
                scoresFor: row.scoresFor ?? 0,
                scoresAgainst: row.scoresAgainst ?? 0,
                scoreDiff: (row.scoresFor ?? 0) - (row.scoresAgainst ?? 0),
                points: row.points ?? 0,
                promotion: row.promotion?.text || (row.position <= 8 ? "Octavos de Final" : row.position <= 24 ? "Playoffs 16avos" : "Eliminado")
              }));
            }
          }
        } catch (apiErr) {
          console.warn("RapidAPI fetch issue, using fallback data:", apiErr);
        }
      } else {
        console.log(`Skipping RapidAPI standings call (QuotaExceeded: ${isQuotaExceeded}, RateLimited: ${isRateLimited})`);
      }

      // If standings table is empty (e.g. rate-limit or preseason), provide official 36-team lineup for 26/27
      if (standingsRows.length === 0) {
        const standings26Path = path.join(process.cwd(), "standings_26_27.json");
        if (fs.existsSync(standings26Path)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(standings26Path, "utf8"));
            const sRows = parsed.standings?.[0]?.rows || [];
            if (sRows.length > 0) {
              standingsRows = sRows.map((row: any) => ({
                position: row.position,
                team: {
                  id: row.team?.id,
                  name: row.team?.name || row.team?.shortName || "TBD",
                  shortName: row.team?.shortName || row.team?.name || "",
                  nameCode: row.team?.nameCode || "",
                  logo: row.team?.id ? `/api/team-image/${row.team.id}` : "",
                  country: row.team?.country?.name || ""
                },
                matches: row.matches ?? 0,
                wins: row.wins ?? 0,
                draws: row.draws ?? 0,
                losses: row.losses ?? 0,
                scoresFor: row.scoresFor ?? 0,
                scoresAgainst: row.scoresAgainst ?? 0,
                scoreDiff: (row.scoresFor ?? 0) - (row.scoresAgainst ?? 0),
                points: row.points ?? 0,
                promotion: row.promotion?.text || (row.position <= 8 ? "Octavos de Final" : row.position <= 24 ? "Playoffs 16avos" : "Eliminado")
              }));
            }
          } catch (e) {
            console.warn("Error reading standings_26_27.json:", e);
          }
        }
      }

      const responseData = {
        season: {
          id: seasonId,
          name: seasonName,
          phase: tournamentPhaseName
        },
        standings: standingsRows,
        cupTrees: cupTrees
      };
      
      cache.standings.data = responseData;
      cache.standings.timestamp = Date.now();
      
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching standings:", error);
      res.status(500).json({ error: "Failed to fetch standings and brackets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
