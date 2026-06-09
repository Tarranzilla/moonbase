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
  { id: 'pythagoras', name: 'PYTHAGORAS', lat: 63.5, lon: -62.8, diameterKm: 144 },
  
  // --- Far Side Craters ---
  { id: 'aitken', name: 'AITKEN', lat: -16.8, lon: 173.4, diameterKm: 135 },
  { id: 'antoniadi', name: 'ANTONIADI', lat: -69.3, lon: -172.0, diameterKm: 138 },
  { id: 'birkhoff', name: 'BIRKHOFF', lat: 58.4, lon: -146.1, diameterKm: 330 },
  { id: 'campbell', name: 'CAMPBELL', lat: 45.3, lon: 152.4, diameterKm: 222 },
  { id: 'chebyshev', name: 'CHEBYSHEV', lat: -34.0, lon: -132.4, diameterKm: 178 },
  { id: 'coulomb', name: 'COULOMB', lat: 54.5, lon: -115.0, diameterKm: 90 },
  { id: 'daedalus', name: 'DAEDALUS', lat: -5.9, lon: 179.4, diameterKm: 93 },
  { id: 'doppler', name: 'DOPPLER', lat: -12.6, lon: -159.6, diameterKm: 102 },
  { id: 'gagarin', name: 'GAGARIN', lat: -19.9, lon: 149.4, diameterKm: 265 },
  { id: 'galileo', name: 'GALILEO', lat: 10.5, lon: -62.8, diameterKm: 15 },
  { id: 'icarus', name: 'ICARUS', lat: -5.3, lon: -173.2, diameterKm: 94 },
  { id: 'jackson', name: 'JACKSON', lat: 22.4, lon: -163.1, diameterKm: 71 },
  { id: 'korolev', name: 'KOROLEV', lat: -4.0, lon: -157.4, diameterKm: 423 },
  { id: 'leibniz', name: 'LEIBNIZ', lat: -38.2, lon: 179.3, diameterKm: 237 },
  { id: 'mach', name: 'MACH', lat: 18.1, lon: -149.2, diameterKm: 175 },
  { id: 'ohm', name: 'OHM', lat: 18.3, lon: -113.8, diameterKm: 62 },
  { id: 'oppenheimer', name: 'OPPENHEIMER', lat: -35.2, lon: -166.3, diameterKm: 201 },
  { id: 'pasteur', name: 'PASTEUR', lat: -11.6, lon: 104.9, diameterKm: 233 },
  { id: 'planck', name: 'PLANCK', lat: -57.3, lon: 135.3, diameterKm: 319 },
  { id: 'poincare', name: 'POINCARÉ', lat: -56.9, lon: 163.9, diameterKm: 346 },
  { id: 'schrodinger', name: 'SCHRÖDINGER', lat: -74.7, lon: 132.9, diameterKm: 316 },
  { id: 'von_karman', name: 'VON KÁRMÁN', lat: -44.5, lon: 176.2, diameterKm: 180 },
  { id: 'zeeman', name: 'ZEEMAN', lat: -75.0, lon: -135.2, diameterKm: 187 },
  { id: 'zwicky', name: 'ZWICKY', lat: -16.1, lon: 167.1, diameterKm: 126 },

  // --- Polar Craters ---
  { id: 'amundsen', name: 'AMUNDSEN', lat: -84.4, lon: 83.1, diameterKm: 103 },
  { id: 'peary', name: 'PEARY', lat: 88.6, lon: 33.0, diameterKm: 79 },
  { id: 'shackleton', name: 'SHACKLETON', lat: -89.7, lon: 129.8, diameterKm: 21 },
  { id: 'shoemaker', name: 'SHOEMAKER', lat: -88.1, lon: 45.9, diameterKm: 51 },
  { id: 'faustini', name: 'FAUSTINI', lat: -87.3, lon: 84.3, diameterKm: 39 },
  { id: 'nobile', name: 'NOBILE', lat: -85.2, lon: 53.3, diameterKm: 73 },
  { id: 'cabeus', name: 'CABEUS', lat: -84.9, lon: -35.5, diameterKm: 100 },
  { id: 'hermite', name: 'HERMITE', lat: 86.2, lon: -93.3, diameterKm: 109 },
  { id: 'rozhdestvenskiy', name: 'ROZHDESTVENSKIY', lat: 85.2, lon: -155.4, diameterKm: 181 },
  { id: 'plaskett', name: 'PLASKETT', lat: 81.6, lon: 176.7, diameterKm: 114 }
];
