import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CRMProvider } from './context/CRMContext';
import { CopilotProvider } from './context/CopilotContext';
import { CopilotMainView } from './components/CopilotMainView';
import { DataViewerModal } from './components/crm/modals/DataViewerModal';

const MainLayout: React.FC = () => {
  const [isDataViewerOpen, setIsDataViewerOpen] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#07090e] text-slate-100 overflow-hidden">
      {/* Centered Dedicated AI Copilot Experience */}
      <CopilotMainView onOpenDataViewer={() => setIsDataViewerOpen(true)} />

      {/* Lightweight Data Explorer Modal when needed */}
      <DataViewerModal
        isOpen={isDataViewerOpen}
        onClose={() => setIsDataViewerOpen(false)}
      />
    </div>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Copilot App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-rose-400">Application Error</h2>
            <p className="text-xs text-slate-400">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-semibold text-white transition"
            >
              Clear Cache & Reload Copilot
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CRMProvider>
          <CopilotProvider>
            <MainLayout />
          </CopilotProvider>
        </CRMProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
