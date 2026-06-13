'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '@/store/useGameStore';
import { useEffect, useRef } from 'react';

export default function CameraController() {
  const { camera, controls, scene } = useThree();
  const cameraTarget = useGameStore((state) => state.cameraTarget);
  const gameTime = useGameStore((state) => state.gameTime);
  const isFlying = useRef(false);
  const flyingTimer = useRef(0);
  const lastTargetId = useRef<string | null>(null);
  const cameraShipProgress = useRef(0);
  const lastShipStatus = useRef<string>('');

  // Listen for manual user interaction to break the camera lock
  useEffect(() => {
    if (!controls) return;
    const orbitControls = controls as any;

    const handleInteractionStart = () => {
      isFlying.current = false;
    };

    orbitControls.addEventListener('start', handleInteractionStart);
    return () => {
      orbitControls.removeEventListener('start', handleInteractionStart);
    };
  }, [controls]);

  useFrame((_, delta) => {
    if (!controls || !cameraTarget) return;
    
    // When target changes, initiate flight
    if (lastTargetId.current !== cameraTarget.id) {
      lastTargetId.current = cameraTarget.id;
      isFlying.current = true;
      flyingTimer.current = 0;
    }

    const orbitControls = controls as any;
    const targetPos = new THREE.Vector3();
    const idealCameraPos = new THREE.Vector3();
    let isShipDynamic = false;

    if (cameraTarget.type === 'CELESTIAL') {
      if (cameraTarget.id === 'moon') {
        targetPos.set(0, 0, 0);
        idealCameraPos.set(0, 0, 15); // Default viewing distance
      } else if (cameraTarget.id === 'earth') {
        targetPos.set(-400, 0, 0);
        idealCameraPos.set(-375, 0, 0); // View from 25 units away (within maxDistance)
      } else if (cameraTarget.id === 'sun') {
        // Calculate sun position based on Moon.tsx exact formula
        const LUNAR_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;
        const theta = ((gameTime % LUNAR_CYCLE_MS) / LUNAR_CYCLE_MS) * Math.PI * 2;
        
        targetPos.set(Math.cos(theta) * 1000, 0, Math.sin(theta) * 1000);
        
        // Place camera 25 units away from the sun, towards the moon (within maxDistance)
        idealCameraPos.copy(targetPos).sub(targetPos.clone().normalize().multiplyScalar(25));
      }
    } else if (cameraTarget.type === 'ENTITY') {
      if (cameraTarget.id.startsWith('ship-')) {
        const ship = useGameStore.getState().spaceships.find(s => s.id === cameraTarget.id);
        if (ship) {
          const { getSpaceshipCurve, shipVisualProgress } = require('./Spaceships');
          const curve = getSpaceshipCurve(ship.targetFaceIndex);
          
          if (ship.status === 'DOCKED') {
             targetPos.copy(curve.getPointAt(1));
          } else {
             const exactProgress = shipVisualProgress.get(ship.id) ?? ship.progress;
             const t = ship.status === 'EN_ROUTE_TO_EARTH' ? 1 - exactProgress : exactProgress;
             targetPos.copy(curve.getPointAt(t));
          }
          
          idealCameraPos.copy(targetPos).add(new THREE.Vector3(2.5, 2.5, 2.5));
          isShipDynamic = true;
        }
      }
      
      if (!isShipDynamic && cameraTarget.pos) {
        targetPos.set(cameraTarget.pos.x, cameraTarget.pos.y, cameraTarget.pos.z);
        // Place camera 2.5 units away from the surface entity, looking down
        const normal = targetPos.clone().normalize();
        idealCameraPos.copy(targetPos).add(normal.multiplyScalar(2.5));
      }
    }

    if (isFlying.current) {
      flyingTimer.current += delta;
      
      // Increase lerp speed over time so it eventually catches fast-moving targets
      const speed = 5 + (flyingTimer.current * 15);
      const tLerp = Math.min(1, speed * delta);
      
      // Smoothly interpolate current target and camera position
      orbitControls.target.lerp(targetPos, tLerp);
      camera.position.lerp(idealCameraPos, tLerp);
      
      // If we are close enough, or if it's been trying to catch a fast ship for over 1.5 seconds, lock it!
      const distThreshold = isShipDynamic ? 0.5 : 0.1;
      if ((orbitControls.target.distanceTo(targetPos) < distThreshold && camera.position.distanceTo(idealCameraPos) < distThreshold) || flyingTimer.current > 1.5) {
        isFlying.current = false;
        orbitControls.target.copy(targetPos);
        flyingTimer.current = 0;
      }
    } else {
      // If not flying, ensure the pivot smoothly follows the entity's true position
      const oldTarget = orbitControls.target.clone();
      
      // Since targetPos is perfectly extrapolated and smooth, we lock directly to it!
      orbitControls.target.copy(targetPos); 
      
      // Calculate how much the target moved visually
      const diff = orbitControls.target.clone().sub(oldTarget);
      
      // Move the camera by the exact same amount so it stays glued to the moving target
      camera.position.add(diff);
    }
    
    orbitControls.update();
  });

  return null;
}
