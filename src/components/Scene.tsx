'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Scanline } from '@react-three/postprocessing';
import Moon from './Moon';
import CameraController from './CameraController';
import { useGameStore } from '@/store/useGameStore';

export default function Scene() {
  const autoRotate = useGameStore((state) => state.autoRotate);

  return (
    <div className="absolute inset-0 z-0">
      <Canvas 
        camera={{ position: [0, 0, 15], fov: 45, far: 3000 }}
        onPointerMissed={() => {
          useGameStore.getState().setSelectedCell(null);
          useGameStore.getState().setSelectedTeam(null);
        }}
      >
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <Suspense fallback={null}>
          <Moon />
        </Suspense>
        <CameraController />
        <OrbitControls 
          makeDefault
          enablePan={false} 
          minDistance={6} 
          maxDistance={2000} 
          autoRotate={autoRotate}
          autoRotateSpeed={0.5} 
        />
        <EffectComposer>
          <Bloom 
            luminanceThreshold={0.1} 
            luminanceSmoothing={0.9} 
            intensity={1.5} 
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
          <Scanline density={1.5} opacity={0.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
