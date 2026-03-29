import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const msg = String(this.state.error?.message || 'Error desconocido');
      const stk = String(this.state.error?.stack || 'No stack trace');
      return React.createElement('div', { style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', padding: '24px' } },
        React.createElement('div', { style: { maxWidth: '400px', textAlign: 'center', color: '#e2e8f0' } },
          React.createElement('h1', { style: { fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0' } }, 'MexiChat Error'),
          React.createElement('p', { style: { fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' } }, msg),
          React.createElement('pre', { style: { textAlign: 'left', padding: '12px', background: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f87171', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, stk),
          React.createElement('button', { onClick: function() { window.location.reload(); }, style: { marginTop: '16px', padding: '10px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' } }, 'Recargar')
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
