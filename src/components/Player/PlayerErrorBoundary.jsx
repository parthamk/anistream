import { Component } from 'react';

export default class PlayerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AniStream player rendering error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-black p-6 text-center text-white"
        >
          <h2 className="text-lg font-semibold">The player encountered an error</h2>
          <p className="max-w-lg text-sm text-zinc-400">
            Try reloading the player. If the problem continues, refresh the
            page or choose another source.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-violet-600 px-4 py-2 font-semibold hover:bg-violet-500"
          >
            Retry player
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}