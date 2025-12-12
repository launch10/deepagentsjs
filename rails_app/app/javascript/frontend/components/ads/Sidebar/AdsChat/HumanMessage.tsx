import { twMerge } from "tailwind-merge";

export default function HumanMessage({ message = "" }: { message: string }) {
  return <div className={twMerge("text-xs bg-neutral-100 p-4 rounded-xl ml-6")}>{message}</div>;
}
