import { twMerge } from "tailwind-merge";

export default function AdCampaignChatUserMessage({ message = "" }: { message: string }) {
  return <div className={twMerge("text-xs bg-[#EDEDEC] p-4 rounded-xl ml-6")}>{message}</div>;
}
