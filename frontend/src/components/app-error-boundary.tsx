"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-white px-6 py-10 text-[#101828]">
          <div className="mx-auto max-w-3xl rounded-3xl border border-[#d0d5dd] bg-[#fff5f5] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b42318]">
              Runtime Error
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              The app crashed while rendering.
            </h1>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 text-sm leading-6 text-[#344054]">
              {this.state.error.message}
            </pre>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
