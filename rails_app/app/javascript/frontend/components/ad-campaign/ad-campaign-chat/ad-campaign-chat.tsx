import { Button } from "@components/ui/button";
import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@components/ui/input-group";
import { Separator } from "@components/ui/separator";
import { Spinner } from "@components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePage } from "@inertiajs/react";
import { workflow as adCampaignWorkflow, type AdsBridgeType } from "@shared";
import { useLanggraph } from "langgraph-ai-sdk-react";
import { ArrowUp, FilePlus, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import AdCampaignStep from "../ad-campaign-step";
import type { AdCampaignChatFormType } from "../ad-campaign.types";
import AdCampaignChatBotMessage from "./ad-campaign-chat-bot-message";
import AdCampaignChatUserMessage from "./ad-campaign-chat-user-message";

export default function AdCampaignChat({
  activeStep,
  activeSubstep,
  onRefreshSuggestions = () => {},
}: {
  activeStep?: string;
  activeSubstep?: string;
  onRefreshSuggestions?: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pageProps = usePage<CampaignProps>();
  const { thread_id, jwt, langgraph_path } = pageProps.props;

  const url = new URL("api/ads/stream", langgraph_path).toString();
  const { messages, isLoadingHistory, sendMessage } = useLanggraph<AdsBridgeType>({
    api: url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    getInitialThreadId: () => (thread_id ? thread_id : undefined),
  });

  const adCampaignSteps = adCampaignWorkflow.launch.steps.find(
    (step) => step.name === "ad_campaign"
  )?.steps;

  const messageSchema = z.object({ message: z.string().min(1, "Message is required") }).required();

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<AdCampaignChatFormType>({
    defaultValues: { message: "" },
    resolver: zodResolver(messageSchema),
    mode: "onChange",
  });

  const onSubmit = handleSubmit((data) => {
    sendMessage(data.message);
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <Card className="shadow-none bg-background border-[#D3D2D0] rounded-2xl sticky top-24 z-0">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Ad Campaign</CardTitle>
        <CardDescription className="flex flex-col gap-3">
          <div className="font-medium">Steps</div>
          {adCampaignSteps?.map((step) => (
            <AdCampaignStep
              key={step.name}
              step={step.order}
              stepName={step.label}
              isActive={step.name === "create"}
              subSteps={step.steps?.map((subStep) => ({
                label: subStep.label,
                isSubStepActive: subStep.name === activeSubstep,
              }))}
            />
          ))}
        </CardDescription>
      </CardHeader>
      <Separator className="bg-[#D3D2D0]" />
      <CardContent>
        {!isLoadingHistory && messages ? (
          <div className="space-y-4 max-h-[30vh] overflow-y-auto">
            {messages.map((message, index) => {
              if (message.role === "assistant") {
                return message.blocks.map((block) => (
                  <AdCampaignChatBotMessage
                    key={block.id}
                    message={block.type === "text" ? block.text : JSON.stringify(block)}
                    state={index === messages.length - 1 ? "active" : "inactive"}
                  />
                ));
              }
              if (message.role === "user") {
                return message.blocks.map((block) => (
                  <AdCampaignChatUserMessage
                    key={block.id}
                    message={block.type === "text" ? block.text : JSON.stringify(block)}
                  />
                ));
              }
              return null;
            })}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <Spinner />
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <form onSubmit={onSubmit} className="w-full">
          <InputGroup className="bg-white rounded-2xl">
            <Controller
              control={control}
              name="message"
              render={({ field, fieldState }) => (
                <InputGroupTextarea
                  placeholder="Ask me for changes..."
                  {...field}
                  aria-invalid={!!fieldState.error}
                />
              )}
            />
            <InputGroupAddon align="block-end" className="flex justify-between">
              <InputGroupButton size="icon-sm">
                <FilePlus />
              </InputGroupButton>
              <InputGroupButton
                size="icon-sm"
                variant="destructive"
                className="rounded-full bg-[#DF6D4A]"
                type="submit"
                disabled={!isValid}
              >
                <ArrowUp />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Button
          variant="link"
          className="text-[#74767A] font-normal self-start"
          onClick={onRefreshSuggestions}
        >
          <Sparkles /> Refresh All Suggestions
        </Button>
      </CardFooter>
    </Card>
  );
}
