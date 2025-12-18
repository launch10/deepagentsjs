import { twMerge } from "tailwind-merge";
import ReactMarkdown from "react-markdown";

export default function AIMessage({
  state = "active",
  message = "",
}: {
  state?: "active" | "inactive" | "loading";
  message: string;
}) {
  return (
    <div className={twMerge("text-xs", state === "inactive" && "text-base-300")}>
      <ReactMarkdown>{message}</ReactMarkdown>
    </div>
  );
}
