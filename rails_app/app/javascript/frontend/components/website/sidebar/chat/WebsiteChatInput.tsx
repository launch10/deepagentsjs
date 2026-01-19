import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@components/ui/input-group";
import { useChatContext } from "@components/shared/chat/Chat";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUp, FilePlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

const messageSchema = z.object({ message: z.string().min(1, "Message is required") }).required();

type WebsiteChatFormType = z.infer<typeof messageSchema>;

export default function WebsiteChatInput() {
  const { sendMessage, isStreaming } = useChatContext();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<WebsiteChatFormType>({
    defaultValues: { message: "" },
    resolver: zodResolver(messageSchema),
    mode: "onChange",
  });

  const handleFormSubmit = handleSubmit((data) => {
    sendMessage(data.message);
    reset();
  });

  return (
    <form onSubmit={handleFormSubmit} className="w-full">
      <InputGroup className="bg-white rounded-2xl border border-neutral-300">
        <Controller
          control={control}
          name="message"
          render={({ field, fieldState }) => (
            <InputGroupTextarea
              placeholder="Ask me for changes..."
              className="min-h-[40px] text-xs"
              {...field}
              aria-invalid={!!fieldState.error}
              disabled={isStreaming}
            />
          )}
        />
        <InputGroupAddon align="block-end" className="flex justify-between">
          <InputGroupButton size="icon-sm" disabled={isStreaming}>
            <FilePlus className="size-4" />
          </InputGroupButton>
          <InputGroupButton
            size="icon-sm"
            variant="destructive"
            className="rounded-full bg-secondary-500 size-6"
            type="submit"
            disabled={!isValid || isStreaming}
          >
            <ArrowUp className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
