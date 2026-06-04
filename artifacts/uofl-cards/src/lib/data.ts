export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type Player = {
  id: string;
  name: string;
  era: string;          
  eraLabel: string;     
  position: Position;
  jerseyNumber: string;
  ppg: number;
  rpg: number;
  apg: number;
  rating: number;       
  accolades: string;    
}

export const PLAYERS: Player[] = [
  {
    id: "d-griffith",
    name: "Darrell Griffith",
    era: "1970s",
    eraLabel: "The Crum Dynasty",
    position: "SG",
    jerseyNumber: "35",
    ppg: 18.5,
    rpg: 4.6,
    apg: 3.2,
    rating: 98,
    accolades: "1980 NCAA Champion, Wooden Award Winner"
  },
  {
    id: "w-unseld",
    name: "Wes Unseld",
    era: "1960s",
    eraLabel: "The Early Legends",
    position: "C",
    jerseyNumber: "31",
    ppg: 20.6,
    rpg: 18.9,
    apg: 2.1,
    rating: 99,
    accolades: "2x Consensus All-American"
  },
  {
    id: "j-bridgeman",
    name: "Junior Bridgeman",
    era: "1970s",
    eraLabel: "The Crum Dynasty",
    position: "SF",
    jerseyNumber: "10",
    ppg: 15.3,
    rpg: 7.1,
    apg: 2.0,
    rating: 92,
    accolades: "2x MVC Player of the Year"
  },
  {
    id: "p-ellison",
    name: "Pervis Ellison",
    era: "1980s",
    eraLabel: "The Crum Dynasty",
    position: "C",
    jerseyNumber: "43",
    ppg: 15.8,
    rpg: 8.4,
    apg: 2.3,
    rating: 95,
    accolades: "1986 NCAA Champion MOP"
  },
  {
    id: "g-dieng",
    name: "Gorgui Dieng",
    era: "2010s",
    eraLabel: "The Modern Era",
    position: "C",
    jerseyNumber: "10",
    ppg: 8.3,
    rpg: 7.9,
    apg: 1.2,
    rating: 88,
    accolades: "2013 Big East DPOY"
  },
  {
    id: "m-harrell",
    name: "Montrezl Harrell",
    era: "2010s",
    eraLabel: "The Modern Era",
    position: "PF",
    jerseyNumber: "24",
    ppg: 11.6,
    rpg: 6.9,
    apg: 1.0,
    rating: 91,
    accolades: "2015 Karl Malone Award"
  },
  {
    id: "d-mitchell",
    name: "Donovan Mitchell",
    era: "2010s",
    eraLabel: "The Modern Era",
    position: "SG",
    jerseyNumber: "45",
    ppg: 11.7,
    rpg: 4.1,
    apg: 2.2,
    rating: 89,
    accolades: "2017 First-Team All-ACC"
  },
  {
    id: "r-smith",
    name: "Russ Smith",
    era: "2010s",
    eraLabel: "The Modern Era",
    position: "PG",
    jerseyNumber: "2",
    ppg: 14.3,
    rpg: 2.7,
    apg: 2.8,
    rating: 96,
    accolades: "Consensus All-American, 'Russdiculous'"
  },
  {
    id: "l-smith",
    name: "LaBradford Smith",
    era: "1980s",
    eraLabel: "The Crum Dynasty",
    position: "SG",
    jerseyNumber: "21",
    ppg: 13.9,
    rpg: 4.5,
    apg: 4.6,
    rating: 88,
    accolades: "All-Metro Conference"
  },
  {
    id: "f-garcia",
    name: "Francisco Garcia",
    era: "2000s",
    eraLabel: "The Pitino Revival",
    position: "SF",
    jerseyNumber: "32",
    ppg: 14.4,
    rpg: 3.9,
    apg: 3.5,
    rating: 90,
    accolades: "C-USA Rookie of the Year"
  },
  {
    id: "l-hancock",
    name: "Luke Hancock",
    era: "2010s",
    eraLabel: "The Modern Era",
    position: "SF",
    jerseyNumber: "11",
    ppg: 7.9,
    rpg: 2.6,
    apg: 1.4,
    rating: 85,
    accolades: "2013 Final Four MOP"
  },
  {
    id: "r-gaines",
    name: "Reece Gaines",
    era: "2000s",
    eraLabel: "The Pitino Revival",
    position: "PG",
    jerseyNumber: "22",
    ppg: 15.6,
    rpg: 3.2,
    apg: 3.9,
    rating: 90,
    accolades: "Third-Team All-American"
  },
  {
    id: "t-howard",
    name: "Terry Howard",
    era: "1970s",
    eraLabel: "The Crum Dynasty",
    position: "SG",
    jerseyNumber: "14",
    ppg: 12.0,
    rpg: 3.0,
    apg: 2.0,
    rating: 86,
    accolades: "1975 NCAA Final Four"
  },
  {
    id: "a-murphy",
    name: "Allen Murphy",
    era: "1970s",
    eraLabel: "The Crum Dynasty",
    position: "SF",
    jerseyNumber: "23",
    ppg: 15.7,
    rpg: 6.2,
    apg: 1.5,
    rating: 88,
    accolades: "1975 Final Four Team"
  },
  {
    id: "b-thompson",
    name: "Billy Thompson",
    era: "1980s",
    eraLabel: "The Crum Dynasty",
    position: "SF",
    jerseyNumber: "55",
    ppg: 10.2,
    rpg: 6.5,
    apg: 2.4,
    rating: 91,
    accolades: "1986 NCAA Champion"
  },
  {
    id: "h-crook",
    name: "Herbert Crook",
    era: "1980s",
    eraLabel: "The Crum Dynasty",
    position: "SF",
    jerseyNumber: "4",
    ppg: 12.0,
    rpg: 6.0,
    apg: 2.0,
    rating: 85,
    accolades: "1986 NCAA Champion"
  },
  {
    id: "p-siva",
    name: "Peyton Siva",
    era: "2010s",
    eraLabel: "The Modern Era",
    position: "PG",
    jerseyNumber: "3",
    ppg: 8.4,
    rpg: 2.4,
    apg: 4.7,
    rating: 89,
    accolades: "2013 Big East Tourney MVP"
  },
  {
    id: "t-williams",
    name: "Terrence Williams",
    era: "2000s",
    eraLabel: "The Pitino Revival",
    position: "SF",
    jerseyNumber: "1",
    ppg: 11.2,
    rpg: 6.9,
    apg: 3.9,
    rating: 88,
    accolades: "First-Team All-Big East"
  },
  {
    id: "c-rozier",
    name: "Clifford Rozier",
    era: "1990s",
    eraLabel: "The Crum Dynasty",
    position: "PF",
    jerseyNumber: "44",
    ppg: 16.9,
    rpg: 11.0,
    apg: 1.5,
    rating: 90,
    accolades: "Consensus First-Team All-American"
  },
  {
    id: "d-wheat",
    name: "DeJuan Wheat",
    era: "1990s",
    eraLabel: "The Crum Dynasty",
    position: "PG",
    jerseyNumber: "32",
    ppg: 16.1,
    rpg: 2.5,
    apg: 3.7,
    rating: 93,
    accolades: "Third-Team All-American"
  },
  {
    id: "d-smith",
    name: "Derek Smith",
    era: "1980s",
    eraLabel: "The Crum Dynasty",
    position: "SG",
    jerseyNumber: "43",
    ppg: 12.4,
    rpg: 4.7,
    apg: 1.8,
    rating: 92,
    accolades: "1980 NCAA Champion"
  }
];
