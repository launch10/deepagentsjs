import { getMockAdsChatState, getMockPageProps, type MockAdsChatState } from "./MockProviders";

export function createMockUseAdsChat(overrides?: Partial<MockAdsChatState>) {
  const state = { ...getMockAdsChatState(), ...overrides };

  return function useAdsChat<TSelected = typeof state>(
    selector?: (snapshot: typeof state) => TSelected
  ): TSelected {
    const snapshot = {
      messages: state.messages ?? [],
      state: state.state ?? {},
      status: state.isLoading ? "streaming" : "idle",
      isLoading: state.isLoading ?? false,
      isLoadingHistory: state.isLoadingHistory ?? false,
      threadId: state.threadId,
      sendMessage: () => console.log("[Storybook] sendMessage called"),
      updateState: () => console.log("[Storybook] updateState called"),
      setState: () => console.log("[Storybook] setState called"),
      stop: () => console.log("[Storybook] stop called"),
    };

    if (selector) {
      return selector(snapshot as any) as TSelected;
    }
    return snapshot as TSelected;
  };
}

export function createMockUsePage<T extends Record<string, unknown>>(overrides?: Partial<T>) {
  return function usePage() {
    return {
      props: { ...getMockPageProps(), ...overrides },
    };
  };
}
