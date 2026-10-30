import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Bedrock] Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-[60vh] w-full flex items-center justify-center p-6 bg-[#050505] text-white font-sans"
      >
        <div className="w-full max-w-md bg-zinc-950/90 border border-white/10 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <h2 className="text-2xl font-display font-bold tracking-tight">Something went wrong</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            This page hit an unexpected problem. Your saved work is not affected. Reloading usually fixes it.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-11 px-5 rounded-xl text-sm font-medium bg-copper-500 text-white hover:bg-copper-400 border border-copper-400/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="h-11 px-5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/15 border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
