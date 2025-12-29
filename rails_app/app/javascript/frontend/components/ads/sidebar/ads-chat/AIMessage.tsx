import { AIMessage as SharedAIMessage } from "@components/chat";

export default function AIMessage({
  state = "active",
  message = "",
}: {
  state?: "active" | "inactive" | "loading";
  message: string;
}) {
  // Map loading state to active for shared component (loading handled separately)
  const mappedState = state === "loading" ? "active" : state;

  return (
    <SharedAIMessage.Content state={mappedState} className="text-xs">
      {message}
    </SharedAIMessage.Content>
  );
}
