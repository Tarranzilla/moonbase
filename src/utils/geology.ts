import { LUNAR_MARES } from '../data/mares';
import { LUNAR_CRATERS } from '../data/craters';

const MOON_RADIUS_KM = 1737.4;

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = MOON_RADIUS_KM;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

export interface SectorResources {
  water: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  minerals: 'LOW' | 'MEDIUM' | 'HIGH';
  waterMultiplier: number;
  mineralsMultiplier: number;
}

export function getSectorResources(lat: number, lon: number): SectorResources {
  let waterMultiplier = 0.1;
  let waterLevel: SectorResources['water'] = 'NONE';
  
  let mineralsMultiplier = 1.0;
  let mineralsLevel: SectorResources['minerals'] = 'LOW';

  // Water logic: Poles have higher water
  const absLat = Math.abs(lat);
  if (absLat > 80) {
    waterMultiplier = 5.0;
    waterLevel = 'HIGH';
  } else if (absLat > 70) {
    waterMultiplier = 2.0;
    waterLevel = 'MEDIUM';
  } else if (absLat > 60) {
    waterMultiplier = 0.5;
    waterLevel = 'LOW';
  }

  // Check if inside a Mare (Seas) - High minerals
  let inMare = false;
  for (const mare of LUNAR_MARES) {
    const dist = getDistanceKm(lat, lon, mare.lat, mare.lon);
    if (dist <= mare.diameterKm / 2) {
      inMare = true;
      break;
    }
  }

  if (inMare) {
    mineralsMultiplier = 3.0;
    mineralsLevel = 'HIGH';
  } else {
    // Check if inside a crater for medium minerals and slightly better water
    let inCrater = false;
    for (const crater of LUNAR_CRATERS) {
      const dist = getDistanceKm(lat, lon, crater.lat, crater.lon);
      if (dist <= crater.diameterKm / 2) {
        inCrater = true;
        break;
      }
    }
    
    if (inCrater) {
      mineralsMultiplier = 1.5;
      mineralsLevel = 'MEDIUM';
      if (waterMultiplier < 1.0) {
        waterMultiplier = 1.0;
        waterLevel = 'LOW';
      }
    }
  }

  return {
    water: waterLevel,
    minerals: mineralsLevel,
    waterMultiplier,
    mineralsMultiplier
  };
}
