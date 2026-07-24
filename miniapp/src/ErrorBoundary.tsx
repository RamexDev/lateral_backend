// ErrorBoundary — catches React render errors and shows a fallback UI.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-surface-alt p-6 text-center">
          <div className="text-2xl">😵</div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-ink">Something went wrong</h1>
            <p className="text-sm text-ink-muted">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
