import { CardContent, CardFooter } from "@components/ui/card";
import AdsChatMessages from "./AdsChat/AdsChatMessages";
import AdsChatInput from "./AdsChat/AdsChatInput";

export default function AdsChat() {
  return (
    <div className="bg-background rounded-b-2xl  flex flex-col">
      <CardContent className="flex-1 overflow-y-auto px-4 py-4 max-h-[300px]">
        <AdsChatMessages />
      </CardContent>
      <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 items-start">
        <AdsChatInput />
      </CardFooter>
    </div>
  );
}
