import { createContext, useContext, useState, useRef, type RefObject } from "react";

interface BrainstormInputContextType {
  input: string;
  setInput: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

const BrainstormInputContext = createContext<BrainstormInputContextType | null>(null);

/**
 * Provider for local input state.
 * Shared between BrainstormInput and components that need to set input (example clicks, command buttons).
 */
export function BrainstormInputProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <BrainstormInputContext.Provider value={{ input, setInput, textareaRef }}>
      {children}
    </BrainstormInputContext.Provider>
  );
}

/**
 * Hook to access input state and setter.
 */
export function useBrainstormInput() {
  const context = useContext(BrainstormInputContext);
  if (!context) {
    throw new Error("useBrainstormInput must be used within BrainstormInputProvider");
  }
  return context;
}
