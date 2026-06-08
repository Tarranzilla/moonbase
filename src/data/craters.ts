export interface Crater {
  id: string;
  name: string;
  lat: number;
  lon: number;
  diameterKm: number;
}

export const LUNAR_CRATERS: Crater[] = [
  { id: 'tycho', name: 'TYCHO', lat: -43.3, lon: -11.2, diameterKm: 85 },
  { id: 'copernicus', name: 'COPERNICUS', lat: 9.6, lon: -20.0, diameterKm: 93 },
  { id: 'kepler', name: 'KEPLER', lat: 8.1, lon: -38.0, diameterKm: 31 },
  { id: 'plato', name: 'PLATO', lat: 51.6, lon: -9.3, diameterKm: 101 },
  { id: 'aristarchus', name: 'ARISTARCHUS', lat: 23.7, lon: -47.4, diameterKm: 40 },
  { id: 'ptolemaeus', name: 'PTOLEMAEUS', lat: -9.2, lon: -1.8, diameterKm: 153 },
  { id: 'clavius', name: 'CLAVIUS', lat: -58.4, lon: -14.4, diameterKm: 231 },
  { id: 'grimaldi', name: 'GRIMALDI', lat: -5.2, lon: -68.6, diameterKm: 173 },
  { id: 'langrenus', name: 'LANGRENUS', lat: -8.9, lon: 61.0, diameterKm: 132 },
  { id: 'theophilus', name: 'THEOPHILUS', lat: -11.4, lon: 28.9, diameterKm: 100 },
  { id: 'archimedes', name: 'ARCHIMEDES', lat: 29.7, lon: -4.0, diameterKm: 81 },
  { id: 'posidonius', name: 'POSIDONIUS', lat: 31.8, lon: 29.9, diameterKm: 95 },
  { id: 'endymion', name: 'ENDYMION', lat: 53.6, lon: 56.5, diameterKm: 125 },
  { id: 'petavius', name: 'PETAVIUS', lat: -25.3, lon: 60.4, diameterKm: 177 },
  { id: 'schickard', name: 'SCHICKARD', lat: -44.4, lon: -55.3, diameterKm: 212 },
  { id: 'gassendi', name: 'GASSENDI', lat: -17.5, lon: -39.9, diameterKm: 110 },
  { id: 'tsiolkovskiy', name: 'TSIOLKOVSKIY', lat: -20.4, lon: 129.0, diameterKm: 180 },
  { id: 'apollo', name: 'APOLLO', lat: -35.7, lon: -151.5, diameterKm: 524 },
  { id: 'hertzsprung', name: 'HERTZSPRUNG', lat: 1.4, lon: -128.7, diameterKm: 536 },
  { id: 'mendeleev', name: 'MENDELEEV', lat: 5.7, lon: 140.9, diameterKm: 325 },
  { id: 'eratosthenes', name: 'ERATOSTHENES', lat: 14.5, lon: -11.3, diameterKm: 59 },
  { id: 'bullialdus', name: 'BULLIALDUS', lat: -20.7, lon: -22.2, diameterKm: 61 },
  { id: 'fra_mauro', name: 'FRA MAURO', lat: -6.0, lon: -17.0, diameterKm: 96 },
  { id: 'mersenius', name: 'MERSENIUS', lat: -21.5, lon: -49.3, diameterKm: 84 },
  { id: 'letronne', name: 'LETRONNE', lat: -10.6, lon: -42.5, diameterKm: 119 },
  { id: 'billy', name: 'BILLY', lat: -13.8, lon: -50.1, diameterKm: 45 },
  { id: 'bailly', name: 'BAILLY', lat: -66.8, lon: -69.1, diameterKm: 303 },
  { id: 'pythagoras', name: 'PYTHAGORAS', lat: 63.5, lon: -62.8, diameterKm: 144 }
];
