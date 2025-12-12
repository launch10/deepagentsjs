import { twMerge } from "tailwind-merge";

export default function AIMessage({
  state = "active",
  message = "",
}: {
  state?: "active" | "inactive" | "loading";
  message: string;
}) {
  return (
    <div className={twMerge("text-xs", state === "inactive" && "text-base-300")}>{message}</div>
  );
}
