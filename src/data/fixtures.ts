import { Match } from "../types";

export interface LeaguePhaseMatch {
  id: string;
  apiId: number;
  round: number;
  group: string;
  date: string;
  homeTeam: string;
  homeId: number;
  awayTeam: string;
  awayId: number;
}

export const UCL_36_TEAMS = [
  {
    "id": 3250,
    "name": "AEK Athens",
    "short": "AEK",
    "country": "Greece"
  },
  {
    "id": 2702,
    "name": "AS Roma",
    "short": "Roma",
    "country": "Italy"
  },
  {
    "id": 42,
    "name": "Arsenal",
    "short": "Arsenal",
    "country": "England"
  },
  {
    "id": 40,
    "name": "Aston Villa",
    "short": "Aston Villa",
    "country": "England"
  },
  {
    "id": 2836,
    "name": "Atlético Madrid",
    "short": "Atl. Madrid",
    "country": "Spain"
  },
  {
    "id": 656,
    "name": "Bodø/Glimt",
    "short": "Bodø/Glimt",
    "country": "Norway"
  },
  {
    "id": 2673,
    "name": "Borussia Dortmund",
    "short": "Dortmund",
    "country": "Germany"
  },
  {
    "id": 2888,
    "name": "Club Brugge KV",
    "short": "Club Brugge",
    "country": "Belgium"
  },
  {
    "id": 2704,
    "name": "Como",
    "short": "Como",
    "country": "Italy"
  },
  {
    "id": 2817,
    "name": "FC Barcelona",
    "short": "Barcelona",
    "country": "Spain"
  },
  {
    "id": 2672,
    "name": "FC Bayern München",
    "short": "Bayern",
    "country": "Germany"
  },
  {
    "id": 3002,
    "name": "FC Porto",
    "short": "Porto",
    "country": "Portugal"
  },
  {
    "id": 3052,
    "name": "Fenerbahçe",
    "short": "Fenerbahçe",
    "country": "Türkiye"
  },
  {
    "id": 2959,
    "name": "Feyenoord",
    "short": "Feyenoord",
    "country": "Netherlands"
  },
  {
    "id": 3061,
    "name": "Galatasaray",
    "short": "Galatasaray",
    "country": "Türkiye"
  },
  {
    "id": 2697,
    "name": "Inter",
    "short": "Inter",
    "country": "Italy"
  },
  {
    "id": 2058,
    "name": "LASK",
    "short": "LASK",
    "country": "Austria"
  },
  {
    "id": 1643,
    "name": "Lille",
    "short": "Lille",
    "country": "France"
  },
  {
    "id": 44,
    "name": "Liverpool FC",
    "short": "Liverpool",
    "country": "England"
  },
  {
    "id": 17,
    "name": "Manchester City",
    "short": "Man City",
    "country": "England"
  },
  {
    "id": 35,
    "name": "Manchester United",
    "short": "Man Utd",
    "country": "England"
  },
  {
    "id": 2952,
    "name": "PSV Eindhoven",
    "short": "PSV",
    "country": "Netherlands"
  },
  {
    "id": 1644,
    "name": "Paris Saint-Germain",
    "short": "PSG",
    "country": "France"
  },
  {
    "id": 36360,
    "name": "RB Leipzig",
    "short": "Leipzig",
    "country": "Germany"
  },
  {
    "id": 1648,
    "name": "RC Lens",
    "short": "Lens",
    "country": "France"
  },
  {
    "id": 2816,
    "name": "Real Betis",
    "short": "Real Betis",
    "country": "Spain"
  },
  {
    "id": 2829,
    "name": "Real Madrid",
    "short": "Real Madrid",
    "country": "Spain"
  },
  {
    "id": 2216,
    "name": "SK Slavia Praha",
    "short": "Slavia Praha",
    "country": "Czechia"
  },
  {
    "id": 2714,
    "name": "SSC Napoli",
    "short": "Napoli",
    "country": "Italy"
  },
  {
    "id": 267828,
    "name": "Sabah FK",
    "short": "Sabah",
    "country": "Azerbaijan"
  },
  {
    "id": 3313,
    "name": "Shakhtar Donetsk",
    "short": "Shakhtar",
    "country": "Ukraine"
  },
  {
    "id": 3001,
    "name": "Sporting CP",
    "short": "Sporting",
    "country": "Portugal"
  },
  {
    "id": 2677,
    "name": "VfB Stuttgart",
    "short": "Stuttgart",
    "country": "Germany"
  },
  {
    "id": 1164,
    "name": "Viking FK",
    "short": "Viking",
    "country": "Norway"
  },
  {
    "id": 2819,
    "name": "Villarreal",
    "short": "Villarreal",
    "country": "Spain"
  },
  {
    "id": 2404,
    "name": "ŠK Slovan Bratislava",
    "short": "Slovan",
    "country": "Slovakia"
  }
];

export const UCL_LEAGUE_PHASE_MATCHES: LeaguePhaseMatch[] = [
  {
    "id": "ucl_26_j1_01",
    "apiId": 16938841,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-08T16:45:00.000Z",
    "homeTeam": "Club Brugge KV",
    "homeId": 2888,
    "awayTeam": "Aston Villa",
    "awayId": 40
  },
  {
    "id": "ucl_26_j1_02",
    "apiId": 16939050,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-08T16:45:00.000Z",
    "homeTeam": "AEK Athens",
    "homeId": 3250,
    "awayTeam": "LASK",
    "awayId": 2058
  },
  {
    "id": "ucl_26_j1_03",
    "apiId": 16938768,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-08T19:00:00.000Z",
    "homeTeam": "Real Madrid",
    "homeId": 2829,
    "awayTeam": "Inter",
    "awayId": 2697
  },
  {
    "id": "ucl_26_j1_04",
    "apiId": 16938854,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-08T19:00:00.000Z",
    "homeTeam": "FC Porto",
    "homeId": 3002,
    "awayTeam": "Manchester City",
    "awayId": 17
  },
  {
    "id": "ucl_26_j1_05",
    "apiId": 16938848,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-08T19:00:00.000Z",
    "homeTeam": "Borussia Dortmund",
    "homeId": 2673,
    "awayTeam": "Villarreal",
    "awayId": 2819
  },
  {
    "id": "ucl_26_j1_06",
    "apiId": 16938991,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-08T19:00:00.000Z",
    "homeTeam": "Lille",
    "homeId": 1643,
    "awayTeam": "Real Betis",
    "awayId": 2816
  },
  {
    "id": "ucl_26_j1_07",
    "apiId": 16938784,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-09T16:45:00.000Z",
    "homeTeam": "FC Barcelona",
    "homeId": 2817,
    "awayTeam": "Feyenoord",
    "awayId": 2959
  },
  {
    "id": "ucl_26_j1_08",
    "apiId": 16939028,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-09T16:45:00.000Z",
    "homeTeam": "VfB Stuttgart",
    "homeId": 2677,
    "awayTeam": "Viking FK",
    "awayId": 1164
  },
  {
    "id": "ucl_26_j1_09",
    "apiId": 16938798,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-09T19:00:00.000Z",
    "homeTeam": "Liverpool FC",
    "homeId": 44,
    "awayTeam": "Atlético Madrid",
    "awayId": 2836
  },
  {
    "id": "ucl_26_j1_10",
    "apiId": 16938985,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-09T19:00:00.000Z",
    "homeTeam": "SSC Napoli",
    "homeId": 2714,
    "awayTeam": "Arsenal",
    "awayId": 42
  },
  {
    "id": "ucl_26_j1_11",
    "apiId": 16938796,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-09T19:00:00.000Z",
    "homeTeam": "Paris Saint-Germain",
    "homeId": 1644,
    "awayTeam": "ŠK Slovan Bratislava",
    "awayId": 2404
  },
  {
    "id": "ucl_26_j1_12",
    "apiId": 16938888,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-09T19:00:00.000Z",
    "homeTeam": "Sporting CP",
    "homeId": 3001,
    "awayTeam": "Galatasaray",
    "awayId": 3061
  },
  {
    "id": "ucl_26_j1_13",
    "apiId": 16938963,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-10T16:45:00.000Z",
    "homeTeam": "Fenerbahçe",
    "homeId": 3052,
    "awayTeam": "AS Roma",
    "awayId": 2702
  },
  {
    "id": "ucl_26_j1_14",
    "apiId": 16938896,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-10T16:45:00.000Z",
    "homeTeam": "PSV Eindhoven",
    "homeId": 2952,
    "awayTeam": "Shakhtar Donetsk",
    "awayId": 3313
  },
  {
    "id": "ucl_26_j1_15",
    "apiId": 16938880,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-10T19:00:00.000Z",
    "homeTeam": "Manchester United",
    "homeId": 35,
    "awayTeam": "Sabah FK",
    "awayId": 267828
  },
  {
    "id": "ucl_26_j1_16",
    "apiId": 16938858,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-10T19:00:00.000Z",
    "homeTeam": "FC Bayern München",
    "homeId": 2672,
    "awayTeam": "Bodø/Glimt",
    "awayId": 656
  },
  {
    "id": "ucl_26_j1_17",
    "apiId": 16939034,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-10T19:00:00.000Z",
    "homeTeam": "Como",
    "homeId": 2704,
    "awayTeam": "RB Leipzig",
    "awayId": 36360
  },
  {
    "id": "ucl_26_j1_18",
    "apiId": 16939012,
    "round": 1,
    "group": "Jornada 1",
    "date": "2026-09-10T19:00:00.000Z",
    "homeTeam": "SK Slavia Praha",
    "homeId": 2216,
    "awayTeam": "RC Lens",
    "awayId": 1648
  },
  {
    "id": "ucl_26_j2_01",
    "apiId": 16939003,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T16:45:00.000Z",
    "homeTeam": "RC Lens",
    "homeId": 1648,
    "awayTeam": "Sporting CP",
    "awayId": 3001
  },
  {
    "id": "ucl_26_j2_02",
    "apiId": 16939017,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T16:45:00.000Z",
    "homeTeam": "Sabah FK",
    "homeId": 267828,
    "awayTeam": "SK Slavia Praha",
    "awayId": 2216
  },
  {
    "id": "ucl_26_j2_03",
    "apiId": 16938979,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T19:00:00.000Z",
    "homeTeam": "Galatasaray",
    "homeId": 3061,
    "awayTeam": "FC Barcelona",
    "awayId": 2817
  },
  {
    "id": "ucl_26_j2_04",
    "apiId": 16938789,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T19:00:00.000Z",
    "homeTeam": "Atlético Madrid",
    "homeId": 2836,
    "awayTeam": "Manchester United",
    "awayId": 35
  },
  {
    "id": "ucl_26_j2_05",
    "apiId": 16938807,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T19:00:00.000Z",
    "homeTeam": "Arsenal",
    "homeId": 42,
    "awayTeam": "Lille",
    "awayId": 1643
  },
  {
    "id": "ucl_26_j2_06",
    "apiId": 16939021,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T19:00:00.000Z",
    "homeTeam": "Viking FK",
    "homeId": 1164,
    "awayTeam": "FC Bayern München",
    "awayId": 2672
  },
  {
    "id": "ucl_26_j2_07",
    "apiId": 16938777,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T19:00:00.000Z",
    "homeTeam": "Inter",
    "homeId": 2697,
    "awayTeam": "Club Brugge KV",
    "awayId": 2888
  },
  {
    "id": "ucl_26_j2_08",
    "apiId": 16938924,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T19:00:00.000Z",
    "homeTeam": "Villarreal",
    "homeId": 2819,
    "awayTeam": "SSC Napoli",
    "awayId": 2714
  },
  {
    "id": "ucl_26_j2_09",
    "apiId": 16938939,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-13T19:00:00.000Z",
    "homeTeam": "RB Leipzig",
    "homeId": 36360,
    "awayTeam": "PSV Eindhoven",
    "awayId": 2952
  },
  {
    "id": "ucl_26_j2_10",
    "apiId": 16939043,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T16:45:00.000Z",
    "homeTeam": "LASK",
    "homeId": 2058,
    "awayTeam": "Liverpool FC",
    "awayId": 44
  },
  {
    "id": "ucl_26_j2_11",
    "apiId": 16938974,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T16:45:00.000Z",
    "homeTeam": "Feyenoord",
    "homeId": 2959,
    "awayTeam": "Como",
    "awayId": 2704
  },
  {
    "id": "ucl_26_j2_12",
    "apiId": 16938872,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T19:00:00.000Z",
    "homeTeam": "AS Roma",
    "homeId": 2702,
    "awayTeam": "Real Madrid",
    "awayId": 2829
  },
  {
    "id": "ucl_26_j2_13",
    "apiId": 16938772,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T19:00:00.000Z",
    "homeTeam": "Manchester City",
    "homeId": 17,
    "awayTeam": "Paris Saint-Germain",
    "awayId": 1644
  },
  {
    "id": "ucl_26_j2_14",
    "apiId": 16938931,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T19:00:00.000Z",
    "homeTeam": "Bodø/Glimt",
    "homeId": 656,
    "awayTeam": "Borussia Dortmund",
    "awayId": 2673
  },
  {
    "id": "ucl_26_j2_15",
    "apiId": 16938852,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T19:00:00.000Z",
    "homeTeam": "Aston Villa",
    "homeId": 40,
    "awayTeam": "Fenerbahçe",
    "awayId": 3052
  },
  {
    "id": "ucl_26_j2_16",
    "apiId": 16938869,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T19:00:00.000Z",
    "homeTeam": "Real Betis",
    "homeId": 2816,
    "awayTeam": "FC Porto",
    "awayId": 3002
  },
  {
    "id": "ucl_26_j2_17",
    "apiId": 16939041,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T19:00:00.000Z",
    "homeTeam": "ŠK Slovan Bratislava",
    "homeId": 2404,
    "awayTeam": "VfB Stuttgart",
    "awayId": 2677
  },
  {
    "id": "ucl_26_j2_18",
    "apiId": 16938918,
    "round": 2,
    "group": "Jornada 2",
    "date": "2026-10-14T19:00:00.000Z",
    "homeTeam": "Shakhtar Donetsk",
    "homeId": 3313,
    "awayTeam": "AEK Athens",
    "awayId": 3250
  },
  {
    "id": "ucl_26_j3_01",
    "apiId": 16939015,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T16:45:00.000Z",
    "homeTeam": "Sabah FK",
    "homeId": 267828,
    "awayTeam": "Borussia Dortmund",
    "awayId": 2673
  },
  {
    "id": "ucl_26_j3_02",
    "apiId": 16938965,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T16:45:00.000Z",
    "homeTeam": "Fenerbahçe",
    "homeId": 3052,
    "awayTeam": "SK Slavia Praha",
    "awayId": 2216
  },
  {
    "id": "ucl_26_j3_03",
    "apiId": 16938793,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T19:00:00.000Z",
    "homeTeam": "Paris Saint-Germain",
    "homeId": 1644,
    "awayTeam": "FC Barcelona",
    "awayId": 2817
  },
  {
    "id": "ucl_26_j3_04",
    "apiId": 16938775,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T19:00:00.000Z",
    "homeTeam": "Manchester City",
    "homeId": 17,
    "awayTeam": "AEK Athens",
    "awayId": 3250
  },
  {
    "id": "ucl_26_j3_05",
    "apiId": 16938800,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T19:00:00.000Z",
    "homeTeam": "Liverpool FC",
    "homeId": 44,
    "awayTeam": "Villarreal",
    "awayId": 2819
  },
  {
    "id": "ucl_26_j3_06",
    "apiId": 16939025,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T19:00:00.000Z",
    "homeTeam": "VfB Stuttgart",
    "homeId": 2677,
    "awayTeam": "Atlético Madrid",
    "awayId": 2836
  },
  {
    "id": "ucl_26_j3_07",
    "apiId": 16938987,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T19:00:00.000Z",
    "homeTeam": "SSC Napoli",
    "homeId": 2714,
    "awayTeam": "Bodø/Glimt",
    "awayId": 656
  },
  {
    "id": "ucl_26_j3_08",
    "apiId": 16938855,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T19:00:00.000Z",
    "homeTeam": "FC Porto",
    "homeId": 3002,
    "awayTeam": "PSV Eindhoven",
    "awayId": 2952
  },
  {
    "id": "ucl_26_j3_09",
    "apiId": 16938875,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-20T19:00:00.000Z",
    "homeTeam": "AS Roma",
    "homeId": 2702,
    "awayTeam": "ŠK Slovan Bratislava",
    "awayId": 2404
  },
  {
    "id": "ucl_26_j3_10",
    "apiId": 16939033,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T16:45:00.000Z",
    "homeTeam": "Como",
    "homeId": 2704,
    "awayTeam": "Manchester United",
    "awayId": 35
  },
  {
    "id": "ucl_26_j3_11",
    "apiId": 16938992,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T16:45:00.000Z",
    "homeTeam": "Lille",
    "homeId": 1643,
    "awayTeam": "Galatasaray",
    "awayId": 3061
  },
  {
    "id": "ucl_26_j3_12",
    "apiId": 16938770,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T19:00:00.000Z",
    "homeTeam": "Real Madrid",
    "homeId": 2829,
    "awayTeam": "RB Leipzig",
    "awayId": 36360
  },
  {
    "id": "ucl_26_j3_13",
    "apiId": 16938859,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T19:00:00.000Z",
    "homeTeam": "FC Bayern München",
    "homeId": 2672,
    "awayTeam": "Arsenal",
    "awayId": 42
  },
  {
    "id": "ucl_26_j3_14",
    "apiId": 16938778,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T19:00:00.000Z",
    "homeTeam": "Inter",
    "homeId": 2697,
    "awayTeam": "Shakhtar Donetsk",
    "awayId": 3313
  },
  {
    "id": "ucl_26_j3_15",
    "apiId": 16938853,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T19:00:00.000Z",
    "homeTeam": "Aston Villa",
    "homeId": 40,
    "awayTeam": "Viking FK",
    "awayId": 1164
  },
  {
    "id": "ucl_26_j3_16",
    "apiId": 16938870,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T19:00:00.000Z",
    "homeTeam": "Real Betis",
    "homeId": 2816,
    "awayTeam": "Feyenoord",
    "awayId": 2959
  },
  {
    "id": "ucl_26_j3_17",
    "apiId": 16938889,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T19:00:00.000Z",
    "homeTeam": "Sporting CP",
    "homeId": 3001,
    "awayTeam": "LASK",
    "awayId": 2058
  },
  {
    "id": "ucl_26_j3_18",
    "apiId": 16938843,
    "round": 3,
    "group": "Jornada 3",
    "date": "2026-10-21T19:00:00.000Z",
    "homeTeam": "Club Brugge KV",
    "homeId": 2888,
    "awayTeam": "RC Lens",
    "awayId": 1648
  },
  {
    "id": "ucl_26_j4_01",
    "apiId": 16938982,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T17:45:00.000Z",
    "homeTeam": "Galatasaray",
    "homeId": 3061,
    "awayTeam": "VfB Stuttgart",
    "awayId": 2677
  },
  {
    "id": "ucl_26_j4_02",
    "apiId": 16938916,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T17:45:00.000Z",
    "homeTeam": "Shakhtar Donetsk",
    "homeId": 3313,
    "awayTeam": "Sporting CP",
    "awayId": 3001
  },
  {
    "id": "ucl_26_j4_03",
    "apiId": 16938783,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T20:00:00.000Z",
    "homeTeam": "FC Barcelona",
    "homeId": 2817,
    "awayTeam": "Aston Villa",
    "awayId": 40
  },
  {
    "id": "ucl_26_j4_04",
    "apiId": 16938878,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T20:00:00.000Z",
    "homeTeam": "Manchester United",
    "homeId": 35,
    "awayTeam": "AS Roma",
    "awayId": 2702
  },
  {
    "id": "ucl_26_j4_05",
    "apiId": 16938788,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T20:00:00.000Z",
    "homeTeam": "Atlético Madrid",
    "homeId": 2836,
    "awayTeam": "FC Bayern München",
    "awayId": 2672
  },
  {
    "id": "ucl_26_j4_06",
    "apiId": 16938922,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T20:00:00.000Z",
    "homeTeam": "Villarreal",
    "homeId": 2819,
    "awayTeam": "Paris Saint-Germain",
    "awayId": 1644
  },
  {
    "id": "ucl_26_j4_07",
    "apiId": 16938971,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T20:00:00.000Z",
    "homeTeam": "Feyenoord",
    "homeId": 2959,
    "awayTeam": "Inter",
    "awayId": 2697
  },
  {
    "id": "ucl_26_j4_08",
    "apiId": 16938932,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T20:00:00.000Z",
    "homeTeam": "Bodø/Glimt",
    "homeId": 656,
    "awayTeam": "Lille",
    "awayId": 1643
  },
  {
    "id": "ucl_26_j4_09",
    "apiId": 16939046,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-03T20:00:00.000Z",
    "homeTeam": "LASK",
    "homeId": 2058,
    "awayTeam": "ŠK Slovan Bratislava",
    "awayId": 2404
  },
  {
    "id": "ucl_26_j4_10",
    "apiId": 16939047,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T17:45:00.000Z",
    "homeTeam": "AEK Athens",
    "homeId": 3250,
    "awayTeam": "Real Madrid",
    "awayId": 2829
  },
  {
    "id": "ucl_26_j4_11",
    "apiId": 16938962,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T17:45:00.000Z",
    "homeTeam": "Fenerbahçe",
    "homeId": 3052,
    "awayTeam": "Liverpool FC",
    "awayId": 44
  },
  {
    "id": "ucl_26_j4_12",
    "apiId": 16938938,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T20:00:00.000Z",
    "homeTeam": "RB Leipzig",
    "homeId": 36360,
    "awayTeam": "Manchester City",
    "awayId": 17
  },
  {
    "id": "ucl_26_j4_13",
    "apiId": 16939009,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T20:00:00.000Z",
    "homeTeam": "SK Slavia Praha",
    "homeId": 2216,
    "awayTeam": "Arsenal",
    "awayId": 42
  },
  {
    "id": "ucl_26_j4_14",
    "apiId": 16938847,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T20:00:00.000Z",
    "homeTeam": "Borussia Dortmund",
    "homeId": 2673,
    "awayTeam": "Real Betis",
    "awayId": 2816
  },
  {
    "id": "ucl_26_j4_15",
    "apiId": 16938856,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T20:00:00.000Z",
    "homeTeam": "FC Porto",
    "homeId": 3002,
    "awayTeam": "SSC Napoli",
    "awayId": 2714
  },
  {
    "id": "ucl_26_j4_16",
    "apiId": 16938895,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T20:00:00.000Z",
    "homeTeam": "PSV Eindhoven",
    "homeId": 2952,
    "awayTeam": "Club Brugge KV",
    "awayId": 2888
  },
  {
    "id": "ucl_26_j4_17",
    "apiId": 16939005,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T20:00:00.000Z",
    "homeTeam": "RC Lens",
    "homeId": 1648,
    "awayTeam": "Como",
    "awayId": 2704
  },
  {
    "id": "ucl_26_j4_18",
    "apiId": 16939024,
    "round": 4,
    "group": "Jornada 4",
    "date": "2026-11-04T20:00:00.000Z",
    "homeTeam": "Viking FK",
    "homeId": 1164,
    "awayTeam": "Sabah FK",
    "awayId": 267828
  },
  {
    "id": "ucl_26_j5_01",
    "apiId": 16938980,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T17:45:00.000Z",
    "homeTeam": "Galatasaray",
    "homeId": 3061,
    "awayTeam": "Aston Villa",
    "awayId": 40
  },
  {
    "id": "ucl_26_j5_02",
    "apiId": 16938933,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T17:45:00.000Z",
    "homeTeam": "Bodø/Glimt",
    "homeId": 656,
    "awayTeam": "LASK",
    "awayId": 2058
  },
  {
    "id": "ucl_26_j5_03",
    "apiId": 16938769,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T20:00:00.000Z",
    "homeTeam": "Real Madrid",
    "homeId": 2829,
    "awayTeam": "PSV Eindhoven",
    "awayId": 2952
  },
  {
    "id": "ucl_26_j5_04",
    "apiId": 16938774,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T20:00:00.000Z",
    "homeTeam": "Manchester City",
    "homeId": 17,
    "awayTeam": "SSC Napoli",
    "awayId": 2714
  },
  {
    "id": "ucl_26_j5_05",
    "apiId": 16938806,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T20:00:00.000Z",
    "homeTeam": "Arsenal",
    "homeId": 42,
    "awayTeam": "Borussia Dortmund",
    "awayId": 2673
  },
  {
    "id": "ucl_26_j5_06",
    "apiId": 16938972,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T20:00:00.000Z",
    "homeTeam": "Feyenoord",
    "homeId": 2959,
    "awayTeam": "FC Porto",
    "awayId": 3002
  },
  {
    "id": "ucl_26_j5_07",
    "apiId": 16939039,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T20:00:00.000Z",
    "homeTeam": "ŠK Slovan Bratislava",
    "homeId": 2404,
    "awayTeam": "Real Betis",
    "awayId": 2816
  },
  {
    "id": "ucl_26_j5_08",
    "apiId": 16938941,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T20:00:00.000Z",
    "homeTeam": "RB Leipzig",
    "homeId": 36360,
    "awayTeam": "RC Lens",
    "awayId": 1648
  },
  {
    "id": "ucl_26_j5_09",
    "apiId": 16939035,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-24T20:00:00.000Z",
    "homeTeam": "Como",
    "homeId": 2704,
    "awayTeam": "AEK Athens",
    "awayId": 3250
  },
  {
    "id": "ucl_26_j5_10",
    "apiId": 16939014,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T17:45:00.000Z",
    "homeTeam": "Sabah FK",
    "homeId": 267828,
    "awayTeam": "FC Barcelona",
    "awayId": 2817
  },
  {
    "id": "ucl_26_j5_11",
    "apiId": 16939011,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T17:45:00.000Z",
    "homeTeam": "SK Slavia Praha",
    "homeId": 2216,
    "awayTeam": "Villarreal",
    "awayId": 2819
  },
  {
    "id": "ucl_26_j5_12",
    "apiId": 16938887,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T20:00:00.000Z",
    "homeTeam": "Sporting CP",
    "homeId": 3001,
    "awayTeam": "Manchester United",
    "awayId": 35
  },
  {
    "id": "ucl_26_j5_13",
    "apiId": 16938840,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T20:00:00.000Z",
    "homeTeam": "Club Brugge KV",
    "homeId": 2888,
    "awayTeam": "Liverpool FC",
    "awayId": 44
  },
  {
    "id": "ucl_26_j5_14",
    "apiId": 16938794,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T20:00:00.000Z",
    "homeTeam": "Paris Saint-Germain",
    "homeId": 1644,
    "awayTeam": "AS Roma",
    "awayId": 2702
  },
  {
    "id": "ucl_26_j5_15",
    "apiId": 16938990,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T20:00:00.000Z",
    "homeTeam": "Lille",
    "homeId": 1643,
    "awayTeam": "FC Bayern München",
    "awayId": 2672
  },
  {
    "id": "ucl_26_j5_16",
    "apiId": 16938791,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T20:00:00.000Z",
    "homeTeam": "Atlético Madrid",
    "homeId": 2836,
    "awayTeam": "Viking FK",
    "awayId": 1164
  },
  {
    "id": "ucl_26_j5_17",
    "apiId": 16938779,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T20:00:00.000Z",
    "homeTeam": "Inter",
    "homeId": 2697,
    "awayTeam": "VfB Stuttgart",
    "awayId": 2677
  },
  {
    "id": "ucl_26_j5_18",
    "apiId": 16938917,
    "round": 5,
    "group": "Jornada 5",
    "date": "2026-11-25T20:00:00.000Z",
    "homeTeam": "Shakhtar Donetsk",
    "homeId": 3313,
    "awayTeam": "Fenerbahçe",
    "awayId": 3052
  },
  {
    "id": "ucl_26_j6_01",
    "apiId": 16938925,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T17:45:00.000Z",
    "homeTeam": "Villarreal",
    "homeId": 2819,
    "awayTeam": "Sabah FK",
    "awayId": 267828
  },
  {
    "id": "ucl_26_j6_02",
    "apiId": 16939023,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T17:45:00.000Z",
    "homeTeam": "Viking FK",
    "homeId": 1164,
    "awayTeam": "Feyenoord",
    "awayId": 2959
  },
  {
    "id": "ucl_26_j6_03",
    "apiId": 16938782,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T20:00:00.000Z",
    "homeTeam": "FC Barcelona",
    "homeId": 2817,
    "awayTeam": "Manchester City",
    "awayId": 17
  },
  {
    "id": "ucl_26_j6_04",
    "apiId": 16938879,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T20:00:00.000Z",
    "homeTeam": "Manchester United",
    "homeId": 35,
    "awayTeam": "RB Leipzig",
    "awayId": 36360
  },
  {
    "id": "ucl_26_j6_05",
    "apiId": 16938850,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T20:00:00.000Z",
    "homeTeam": "Aston Villa",
    "homeId": 40,
    "awayTeam": "Paris Saint-Germain",
    "awayId": 1644
  },
  {
    "id": "ucl_26_j6_06",
    "apiId": 16938861,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T20:00:00.000Z",
    "homeTeam": "FC Bayern München",
    "homeId": 2672,
    "awayTeam": "SK Slavia Praha",
    "awayId": 2216
  },
  {
    "id": "ucl_26_j6_07",
    "apiId": 16938873,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T20:00:00.000Z",
    "homeTeam": "AS Roma",
    "homeId": 2702,
    "awayTeam": "Sporting CP",
    "awayId": 3001
  },
  {
    "id": "ucl_26_j6_08",
    "apiId": 16938986,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T20:00:00.000Z",
    "homeTeam": "SSC Napoli",
    "homeId": 2714,
    "awayTeam": "Club Brugge KV",
    "awayId": 2888
  },
  {
    "id": "ucl_26_j6_09",
    "apiId": 16939049,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-08T20:00:00.000Z",
    "homeTeam": "AEK Athens",
    "homeId": 3250,
    "awayTeam": "Galatasaray",
    "awayId": 3061
  },
  {
    "id": "ucl_26_j6_10",
    "apiId": 16938871,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T17:45:00.000Z",
    "homeTeam": "Real Betis",
    "homeId": 2816,
    "awayTeam": "Como",
    "awayId": 2704
  },
  {
    "id": "ucl_26_j6_11",
    "apiId": 16939040,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T17:45:00.000Z",
    "homeTeam": "ŠK Slovan Bratislava",
    "homeId": 2404,
    "awayTeam": "Shakhtar Donetsk",
    "awayId": 3313
  },
  {
    "id": "ucl_26_j6_12",
    "apiId": 16938805,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T20:00:00.000Z",
    "homeTeam": "Arsenal",
    "homeId": 42,
    "awayTeam": "Real Madrid",
    "awayId": 2829
  },
  {
    "id": "ucl_26_j6_13",
    "apiId": 16938799,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T20:00:00.000Z",
    "homeTeam": "Liverpool FC",
    "homeId": 44,
    "awayTeam": "FC Porto",
    "awayId": 3002
  },
  {
    "id": "ucl_26_j6_14",
    "apiId": 16938894,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T20:00:00.000Z",
    "homeTeam": "PSV Eindhoven",
    "homeId": 2952,
    "awayTeam": "Atlético Madrid",
    "awayId": 2836
  },
  {
    "id": "ucl_26_j6_15",
    "apiId": 16938846,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T20:00:00.000Z",
    "homeTeam": "Borussia Dortmund",
    "homeId": 2673,
    "awayTeam": "Inter",
    "awayId": 2697
  },
  {
    "id": "ucl_26_j6_16",
    "apiId": 16939045,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T20:00:00.000Z",
    "homeTeam": "LASK",
    "homeId": 2058,
    "awayTeam": "Fenerbahçe",
    "awayId": 3052
  },
  {
    "id": "ucl_26_j6_17",
    "apiId": 16939004,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T20:00:00.000Z",
    "homeTeam": "RC Lens",
    "homeId": 1648,
    "awayTeam": "Bodø/Glimt",
    "awayId": 656
  },
  {
    "id": "ucl_26_j6_18",
    "apiId": 16939027,
    "round": 6,
    "group": "Jornada 6",
    "date": "2026-12-09T20:00:00.000Z",
    "homeTeam": "VfB Stuttgart",
    "homeId": 2677,
    "awayTeam": "Lille",
    "awayId": 1643
  },
  {
    "id": "ucl_26_j7_01",
    "apiId": 16938930,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T17:45:00.000Z",
    "homeTeam": "Bodø/Glimt",
    "homeId": 656,
    "awayTeam": "Atlético Madrid",
    "awayId": 2836
  },
  {
    "id": "ucl_26_j7_02",
    "apiId": 16938981,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T17:45:00.000Z",
    "homeTeam": "Galatasaray",
    "homeId": 3061,
    "awayTeam": "Feyenoord",
    "awayId": 2959
  },
  {
    "id": "ucl_26_j7_03",
    "apiId": 16938771,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T20:00:00.000Z",
    "homeTeam": "Real Madrid",
    "homeId": 2829,
    "awayTeam": "LASK",
    "awayId": 2058
  },
  {
    "id": "ucl_26_j7_04",
    "apiId": 16938776,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T20:00:00.000Z",
    "homeTeam": "Inter",
    "homeId": 2697,
    "awayTeam": "Liverpool FC",
    "awayId": 44
  },
  {
    "id": "ucl_26_j7_05",
    "apiId": 16938851,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T20:00:00.000Z",
    "homeTeam": "Aston Villa",
    "homeId": 40,
    "awayTeam": "Borussia Dortmund",
    "awayId": 2673
  },
  {
    "id": "ucl_26_j7_06",
    "apiId": 16939048,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T20:00:00.000Z",
    "homeTeam": "AEK Athens",
    "homeId": 3250,
    "awayTeam": "AS Roma",
    "awayId": 2702
  },
  {
    "id": "ucl_26_j7_07",
    "apiId": 16938857,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T20:00:00.000Z",
    "homeTeam": "FC Porto",
    "homeId": 3002,
    "awayTeam": "SK Slavia Praha",
    "awayId": 2216
  },
  {
    "id": "ucl_26_j7_08",
    "apiId": 16939026,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T20:00:00.000Z",
    "homeTeam": "VfB Stuttgart",
    "homeId": 2677,
    "awayTeam": "Club Brugge KV",
    "awayId": 2888
  },
  {
    "id": "ucl_26_j7_09",
    "apiId": 16938993,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-19T20:00:00.000Z",
    "homeTeam": "Lille",
    "homeId": 1643,
    "awayTeam": "ŠK Slovan Bratislava",
    "awayId": 2404
  },
  {
    "id": "ucl_26_j7_10",
    "apiId": 16939016,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T17:45:00.000Z",
    "homeTeam": "Sabah FK",
    "homeId": 267828,
    "awayTeam": "SSC Napoli",
    "awayId": 2714
  },
  {
    "id": "ucl_26_j7_11",
    "apiId": 16938964,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T17:45:00.000Z",
    "homeTeam": "Fenerbahçe",
    "homeId": 3052,
    "awayTeam": "Villarreal",
    "awayId": 2819
  },
  {
    "id": "ucl_26_j7_12",
    "apiId": 16938886,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T20:00:00.000Z",
    "homeTeam": "Sporting CP",
    "homeId": 3001,
    "awayTeam": "FC Barcelona",
    "awayId": 2817
  },
  {
    "id": "ucl_26_j7_13",
    "apiId": 16938877,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T20:00:00.000Z",
    "homeTeam": "Manchester United",
    "homeId": 35,
    "awayTeam": "FC Bayern München",
    "awayId": 2672
  },
  {
    "id": "ucl_26_j7_14",
    "apiId": 16939002,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T20:00:00.000Z",
    "homeTeam": "RC Lens",
    "homeId": 1648,
    "awayTeam": "Manchester City",
    "awayId": 17
  },
  {
    "id": "ucl_26_j7_15",
    "apiId": 16938868,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T20:00:00.000Z",
    "homeTeam": "Real Betis",
    "homeId": 2816,
    "awayTeam": "Arsenal",
    "awayId": 42
  },
  {
    "id": "ucl_26_j7_16",
    "apiId": 16939032,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T20:00:00.000Z",
    "homeTeam": "Como",
    "homeId": 2704,
    "awayTeam": "Paris Saint-Germain",
    "awayId": 1644
  },
  {
    "id": "ucl_26_j7_17",
    "apiId": 16939022,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T20:00:00.000Z",
    "homeTeam": "Viking FK",
    "homeId": 1164,
    "awayTeam": "PSV Eindhoven",
    "awayId": 2952
  },
  {
    "id": "ucl_26_j7_18",
    "apiId": 16938940,
    "round": 7,
    "group": "Jornada 7",
    "date": "2027-01-20T20:00:00.000Z",
    "homeTeam": "RB Leipzig",
    "homeId": 36360,
    "awayTeam": "Shakhtar Donetsk",
    "awayId": 3313
  },
  {
    "id": "ucl_26_j8_01",
    "apiId": 16938915,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Shakhtar Donetsk",
    "homeId": 3313,
    "awayTeam": "Real Madrid",
    "awayId": 2829
  },
  {
    "id": "ucl_26_j8_02",
    "apiId": 16938785,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "FC Barcelona",
    "homeId": 2817,
    "awayTeam": "Como",
    "awayId": 2704
  },
  {
    "id": "ucl_26_j8_03",
    "apiId": 16938773,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Manchester City",
    "homeId": 17,
    "awayTeam": "Sporting CP",
    "awayId": 3001
  },
  {
    "id": "ucl_26_j8_04",
    "apiId": 16938923,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Villarreal",
    "homeId": 2819,
    "awayTeam": "Manchester United",
    "awayId": 35
  },
  {
    "id": "ucl_26_j8_05",
    "apiId": 16938801,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Liverpool FC",
    "homeId": 44,
    "awayTeam": "RC Lens",
    "awayId": 1648
  },
  {
    "id": "ucl_26_j8_06",
    "apiId": 16938795,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Paris Saint-Germain",
    "homeId": 1644,
    "awayTeam": "Galatasaray",
    "awayId": 3061
  },
  {
    "id": "ucl_26_j8_07",
    "apiId": 16938808,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Arsenal",
    "homeId": 42,
    "awayTeam": "Sabah FK",
    "awayId": 267828
  },
  {
    "id": "ucl_26_j8_08",
    "apiId": 16938860,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "FC Bayern München",
    "homeId": 2672,
    "awayTeam": "Real Betis",
    "awayId": 2816
  },
  {
    "id": "ucl_26_j8_09",
    "apiId": 16938790,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Atlético Madrid",
    "homeId": 2836,
    "awayTeam": "Fenerbahçe",
    "awayId": 3052
  },
  {
    "id": "ucl_26_j8_10",
    "apiId": 16939038,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "ŠK Slovan Bratislava",
    "homeId": 2404,
    "awayTeam": "Inter",
    "awayId": 2697
  },
  {
    "id": "ucl_26_j8_11",
    "apiId": 16938849,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Borussia Dortmund",
    "homeId": 2673,
    "awayTeam": "AEK Athens",
    "awayId": 3250
  },
  {
    "id": "ucl_26_j8_12",
    "apiId": 16938988,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "SSC Napoli",
    "homeId": 2714,
    "awayTeam": "Viking FK",
    "awayId": 1164
  },
  {
    "id": "ucl_26_j8_13",
    "apiId": 16939010,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "SK Slavia Praha",
    "homeId": 2216,
    "awayTeam": "Aston Villa",
    "awayId": 40
  },
  {
    "id": "ucl_26_j8_14",
    "apiId": 16938874,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "AS Roma",
    "homeId": 2702,
    "awayTeam": "Lille",
    "awayId": 1643
  },
  {
    "id": "ucl_26_j8_15",
    "apiId": 16939044,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "LASK",
    "homeId": 2058,
    "awayTeam": "FC Porto",
    "awayId": 3002
  },
  {
    "id": "ucl_26_j8_16",
    "apiId": 16938897,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "PSV Eindhoven",
    "homeId": 2952,
    "awayTeam": "VfB Stuttgart",
    "awayId": 2677
  },
  {
    "id": "ucl_26_j8_17",
    "apiId": 16938973,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Feyenoord",
    "homeId": 2959,
    "awayTeam": "RB Leipzig",
    "awayId": 36360
  },
  {
    "id": "ucl_26_j8_18",
    "apiId": 16938842,
    "round": 8,
    "group": "Jornada 8",
    "date": "2027-01-27T20:00:00.000Z",
    "homeTeam": "Club Brugge KV",
    "homeId": 2888,
    "awayTeam": "Bodø/Glimt",
    "awayId": 656
  }
];

export const UCL_DEMO_SCENARIO_MATCHES = [
  {
    matchId: "ucl_demo_01_exact",
    round: 1,
    group: "Ejemplos Demo",
    date: "2026-09-08T19:00:00Z",
    homeTeam: "Equipo Local A",
    homeId: 0,
    awayTeam: "Equipo Visita A",
    awayId: 0,
    status: "finished" as const,
    homeScore: 3,
    awayScore: 1,
    demoPrediction: { homeScore: 3, awayScore: 1 },
    scenarioTitle: "Acertó Marcador Exacto (+3 pts)"
  },
  {
    matchId: "ucl_demo_02_winner",
    round: 1,
    group: "Ejemplos Demo",
    date: "2026-09-08T19:00:00Z",
    homeTeam: "Equipo Local B",
    homeId: 0,
    awayTeam: "Equipo Visita B",
    awayId: 0,
    status: "finished" as const,
    homeScore: 2,
    awayScore: 1,
    demoPrediction: { homeScore: 1, awayScore: 0 },
    scenarioTitle: "Acertó Ganador Diferencia (+2 pts)"
  },
  {
    matchId: "ucl_demo_03_winner_only",
    round: 1,
    group: "Ejemplos Demo",
    date: "2026-09-08T19:00:00Z",
    homeTeam: "Equipo Local C",
    homeId: 0,
    awayTeam: "Equipo Visita C",
    awayId: 0,
    status: "finished" as const,
    homeScore: 3,
    awayScore: 0,
    demoPrediction: { homeScore: 1, awayScore: 0 },
    scenarioTitle: "Acertó Solo Ganador (+1 pt)"
  },
  {
    matchId: "ucl_demo_04_fail",
    round: 1,
    group: "Ejemplos Demo",
    date: "2026-09-08T19:00:00Z",
    homeTeam: "Equipo Local D",
    homeId: 0,
    awayTeam: "Equipo Visita D",
    awayId: 0,
    status: "finished" as const,
    homeScore: 0,
    awayScore: 2,
    demoPrediction: { homeScore: 1, awayScore: 0 },
    scenarioTitle: "Falló Pronóstico (0 pts)"
  }
];

export function getTeamLogoByName(teamName?: string): string {
  if (!teamName) return '';
  const clean = teamName.toLowerCase().trim();
  const team = UCL_36_TEAMS.find(t => 
    t.name.toLowerCase() === clean ||
    t.short.toLowerCase() === clean ||
    clean.includes(t.name.toLowerCase()) ||
    t.name.toLowerCase().includes(clean)
  );
  if (team?.id) {
    return `https://img.sofascore.com/api/v1/team/${team.id}/image`;
  }
  return '';
}
