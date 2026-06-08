'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-red-500 font-mono p-10">
          <div className="border border-red-500 p-4 w-full h-full overflow-auto bg-black/80">
            <h1 className="text-2xl font-bold mb-4">SYSTEM FAILURE // RENDER CRASH</h1>
            <pre className="whitespace-pre-wrap">{this.state.error?.toString()}</pre>
            <pre className="whitespace-pre-wrap mt-4 text-xs opacity-80">{this.state.error?.stack}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
