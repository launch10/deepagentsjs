import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeployErrorBoundary } from "../DeployErrorBoundary";

// Suppress React error boundary console output during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function ThrowingComponent(): never {
  throw new Error("render crash");
}

function SafeComponent() {
  return <div>OK</div>;
}

describe("DeployErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <DeployErrorBoundary>
        <SafeComponent />
      </DeployErrorBoundary>
    );

    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("catches render error and shows fallback", () => {
    render(
      <DeployErrorBoundary>
        <ThrowingComponent />
      </DeployErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Reload page")).toBeInTheDocument();
    expect(
      screen.getByText(
        "An unexpected error occurred while loading the deploy page."
      )
    ).toBeInTheDocument();
  });

  it("does not affect sibling content outside the boundary", () => {
    render(
      <div>
        <div>Sibling content</div>
        <DeployErrorBoundary>
          <ThrowingComponent />
        </DeployErrorBoundary>
      </div>
    );

    expect(screen.getByText("Sibling content")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
