import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: (reset: () => void, message: string) => ReactNode;
}
interface State {
  error: Error | null;
}

/** A rendering failure in the canvas must never take down the app or block access to export. */
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Canvas failed to render', error, info.componentStack);
  }
  render(): ReactNode {
    if (this.state.error) return this.props.fallback(() => this.setState({ error: null }), this.state.error.message);
    return this.props.children;
  }
}
