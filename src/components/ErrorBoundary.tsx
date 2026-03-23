import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary
 *
 * Catches uncaught React errors and displays a recovery UI
 * instead of crashing the entire app. Production-grade.
 */
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

    // Log to console in development
    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);

    // TODO: Send to Sentry or other error tracking service
    // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif", padding: "24px",
        }}>
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              Algo salio mal
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px 0", lineHeight: 1.5 }}>
              Ha ocurrido un error inesperado. Puedes intentar recargar la pagina o volver al inicio.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details style={{
                textAlign: "left", marginBottom: "24px", padding: "12px",
                background: "#fef2f2", borderRadius: "8px", fontSize: "12px", color: "#991b1b",
              }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Detalles del error</summary>
                <pre style={{ marginTop: "8px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={this.handleReload} style={{
                padding: "10px 20px", background: "#3b82f6", color: "white", border: "none",
                borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
              }}>
                Recargar pagina
              </button>
              <button onClick={this.handleGoHome} style={{
                padding: "10px 20px", background: "white", color: "#374151", border: "1px solid #d1d5db",
                borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
              }}>
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
