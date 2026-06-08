'use client';

import dynamic from 'next/dynamic';
import TerminalUI from '@/components/TerminalUI';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import SearchUI from '@/components/SearchUI';

const Scene = dynamic(() => import('@/components/Scene'), { ssr: false });

export default function Home() {
  return (
    <ErrorBoundary>
      <main className="w-screen h-screen bg-black overflow-hidden relative">
        <Scene />
        <SearchUI />
        <TerminalUI />
      </main>
    </ErrorBoundary>
  );
}
