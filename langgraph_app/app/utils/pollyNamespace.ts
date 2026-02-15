// Global namespace state for Polly recordings.
// Set automatically by test setup based on test file path.
// Used by withPolly middleware to prefix recording names.

const globalAny = global as any;

export function setPollyNamespace(namespace: string): void {
  globalAny.__pollyNamespace = namespace;
}

export function getPollyNamespace(): string | undefined {
  return globalAny.__pollyNamespace;
}

export function clearPollyNamespace(): void {
  globalAny.__pollyNamespace = undefined;
}
