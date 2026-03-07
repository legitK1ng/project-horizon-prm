import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50 m-4">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">Something went wrong</h2>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md">
                        The application encountered an unexpected error.
                        {this.state.error && (
                            <span className="block mt-2 text-sm font-mono text-red-600 dark:text-red-400 opacity-80 break-words">
                                {this.state.error.message}
                            </span>
                        )}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
