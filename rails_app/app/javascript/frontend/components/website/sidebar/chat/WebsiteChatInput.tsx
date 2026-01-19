import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@components/ui/input-group";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUp, FilePlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

const messageSchema = z.object({ message: z.string().min(1, "Message is required") }).required();

type WebsiteChatFormType = z.infer<typeof messageSchema>;

export interface WebsiteChatInputProps {
  onSubmit?: (message: string) => void;
}

export default function WebsiteChatInput({ onSubmit }: WebsiteChatInputProps) {
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
    onSubmit?.(data.message);
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
            />
          )}
        />
        <InputGroupAddon align="block-end" className="flex justify-between">
          <InputGroupButton size="icon-sm">
            <FilePlus className="size-4" />
          </InputGroupButton>
          <InputGroupButton
            size="icon-sm"
            variant="destructive"
            className="rounded-full bg-secondary-500 size-6"
            type="submit"
            disabled={!isValid}
          >
            <ArrowUp className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
