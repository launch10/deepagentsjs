import { Component, type ReactNode } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class DeployErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("DeployErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <ExclamationTriangleIcon className="size-7 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-base-900">
              Something went wrong
            </h2>
            <p className="text-sm text-base-500 mt-2">
              An unexpected error occurred while loading the deploy page.
            </p>
            <Button onClick={() => window.location.reload()} className="mt-6">
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
