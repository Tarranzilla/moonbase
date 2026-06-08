'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Scanline } from '@react-three/postprocessing';
import Moon from './Moon';

export default function Scene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <Suspense fallback={null}>
          <Moon />
        </Suspense>
        <OrbitControls 
          enablePan={false} 
          minDistance={6} 
          maxDistance={25} 
          autoRotate 
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
