import { UserMessage } from "@components/chat";

export default function HumanMessage({ message = "" }: { message: string }) {
  return <UserMessage className="text-xs ml-6">{message}</UserMessage>;
}
