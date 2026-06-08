export interface Mare {
  id: string;
  name: string;
  lat: number;
  lon: number;
  diameterKm: number;
}

export const LUNAR_MARES: Mare[] = [
  { id: 'mare_tranquillitatis', name: 'MARE TRANQUILLITATIS', lat: 8.5, lon: 31.4, diameterKm: 873 },
  { id: 'mare_imbrium', name: 'MARE IMBRIUM', lat: 32.8, lon: -15.6, diameterKm: 1123 },
  { id: 'mare_serenitatis', name: 'MARE SERENITATIS', lat: 28.0, lon: 17.5, diameterKm: 707 },
  { id: 'mare_crisium', name: 'MARE CRISIUM', lat: 17.0, lon: 59.1, diameterKm: 555 },
  { id: 'mare_fecunditatis', name: 'MARE FECUNDITATIS', lat: -7.8, lon: 51.3, diameterKm: 909 },
  { id: 'mare_nectaris', name: 'MARE NECTARIS', lat: -15.2, lon: 35.5, diameterKm: 333 },
  { id: 'mare_nubium', name: 'MARE NUBIUM', lat: -21.3, lon: -16.6, diameterKm: 715 },
  { id: 'mare_humorum', name: 'MARE HUMORUM', lat: -24.4, lon: -38.6, diameterKm: 419 },
  { id: 'oceanus_procellarum', name: 'OCEANUS PROCELLARUM', lat: 18.4, lon: -57.4, diameterKm: 2592 },
  { id: 'mare_frigoris', name: 'MARE FRIGORIS', lat: 56.0, lon: 1.4, diameterKm: 1596 },
  { id: 'mare_orientale', name: 'MARE ORIENTALE', lat: -19.4, lon: -92.8, diameterKm: 327 }
];
