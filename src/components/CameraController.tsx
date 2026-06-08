'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '@/store/useGameStore';
import { useEffect, useRef } from 'react';

export default function CameraController() {
  const { camera, controls } = useThree();
  const cameraTarget = useGameStore((state) => state.cameraTarget);
  const gameTime = useGameStore((state) => state.gameTime);
  const isFlying = useRef(false);
  const lastTargetId = useRef<string | null>(null);

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

  useFrame(() => {
    if (!controls || !cameraTarget) return;
    
    // If the target changed in the store, start flying!
    if (cameraTarget.id !== lastTargetId.current) {
      isFlying.current = true;
      lastTargetId.current = cameraTarget.id;
    }

    const orbitControls = controls as any;
    let targetPos = new THREE.Vector3();
    let idealCameraPos = new THREE.Vector3();

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
    } else if (cameraTarget.type === 'ENTITY' && cameraTarget.pos) {
      targetPos.set(cameraTarget.pos.x, cameraTarget.pos.y, cameraTarget.pos.z);
      // Place camera 2.5 units away from the surface entity, looking down
      const normal = targetPos.clone().normalize();
      idealCameraPos.copy(targetPos).add(normal.multiplyScalar(2.5));
    }

    if (isFlying.current) {
      // Smoothly interpolate current target and camera position
      orbitControls.target.lerp(targetPos, 0.05);
      camera.position.lerp(idealCameraPos, 0.05);
      
      // If we are close enough, stop flying so the user can manually rotate freely without snapping
      if (orbitControls.target.distanceTo(targetPos) < 0.1 && camera.position.distanceTo(idealCameraPos) < 0.1) {
        isFlying.current = false;
        orbitControls.target.copy(targetPos);
      }
    } else {
      // If not flying, ensure the pivot STAYS exactly at the entity's true position!
      // This solves the issue where interrupting the flight leaves you orbiting a weird empty space
      orbitControls.target.lerp(targetPos, 0.1); 
    }
    
    orbitControls.update();
  });

  return null;
}
