import { CardContent, CardFooter } from "@components/ui/card";
import AdsChatMessages from "./AdsChat/AdsChatMessages";
import AdsChatInput from "./AdsChat/AdsChatInput";

export default function AdsChat() {
  return (
    <>
      <CardContent>
        <AdsChatMessages />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <AdsChatInput />
      </CardFooter>
    </>
  );
}
