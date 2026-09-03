import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        fontFamily: 'Inter, sans-serif',
        padding: 24,
      }}>
        <div style={{
          maxWidth: 420,
          textAlign: 'center',
          background: '#111111',
          border: '1px solid #222222',
          borderRadius: 12,
          padding: 40,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#ededed', marginBottom: 10 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#888888', lineHeight: 1.6, marginBottom: 24 }}>
            The app hit an unexpected error. Reloading usually fixes it. If the problem keeps happening, please try again later.
          </p>
          {this.state.error && (
            <div style={{
              fontSize: 12,
              color: '#ef4444',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 24,
              fontFamily: 'monospace',
              textAlign: 'left',
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={() => this.handleReload()}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 500,
              color: '#ffffff',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
