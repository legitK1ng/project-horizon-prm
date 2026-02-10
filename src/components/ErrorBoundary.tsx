import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error,
            errorInfo,
        });

        // Log error to console for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="min-h-96 flex items-center justify-center">
                    <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="text-red-500" size={24} />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Something went wrong
                            </h3>
                        </div>

                        <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
                            We encountered an error while loading this component. This is usually caused by invalid data or a temporary issue.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <RefreshCw size={16} />
                                Try Again
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                                    Error Details (Development)
                                </summary>
                                <pre className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded text-xs overflow-auto max-h-32">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;