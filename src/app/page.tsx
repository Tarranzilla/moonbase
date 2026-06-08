'use client';

import dynamic from 'next/dynamic';
import TerminalUI from '@/components/TerminalUI';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Scene = dynamic(() => import('@/components/Scene'), { ssr: false });

export default function Home() {
  return (
    <ErrorBoundary>
      <main className="relative w-full h-screen overflow-hidden bg-black text-green-500">
        <Scene />
        <TerminalUI />
      </main>
    </ErrorBoundary>
  );
}
