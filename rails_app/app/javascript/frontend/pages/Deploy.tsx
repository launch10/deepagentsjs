import { router, usePage } from "@inertiajs/react";
import { Chat } from "@components/shared/chat/Chat";
import { DeployErrorBoundary } from "@components/deploy/DeployErrorBoundary";
import { useNavigateIntentHandler } from "@hooks/useNavigateIntentHandler";
import { DeploySidebar } from "@components/deploy";
import {
  InProgressScreen,
  GoogleConnectScreen,
  InviteAcceptScreen,
  PaymentRequiredScreen,
  CheckingPaymentScreen,
  PaymentConfirmedScreen,
  WaitingGoogleScreen,
  DeployCompleteScreen,
  DeployErrorScreen,
  ConnectionErrorScreen,
} from "@components/deploy/screens";
import { PaginationFooter } from "@components/shared/pagination-footer";
import { useDeployChatInstance, useDeployChat, type DeployProps } from "@hooks/useDeployChat";
import { useDeployInit } from "@hooks/useDeployInit";
import { useDeployContentScreen, type DeployScreen } from "@hooks/useDeployContentScreen";
import { useDeployInstructions, useDeployType } from "@hooks/useDeployInstructions";
import FullResetButton from "@components/deploy/FullResetButton";

const SCREENS: Record<DeployScreen, React.ComponentType> = {
  "in-progress": InProgressScreen,
  "google-connect": GoogleConnectScreen,
  "invite-accept": InviteAcceptScreen,
  "payment-required": PaymentRequiredScreen,
  "checking-payment": CheckingPaymentScreen,
  "payment-confirmed": PaymentConfirmedScreen,
  "waiting-google": WaitingGoogleScreen,
  "deploy-complete": DeployCompleteScreen,
  "deploy-error": DeployErrorScreen,
  "connection-error": ConnectionErrorScreen,
};

function DeployContent() {
  useNavigateIntentHandler();

  const { deploy, project } = usePage<DeployProps>().props;
  const pollingFailed = useDeployInit();

  // Select only the fields needed for screen resolution.
  // isLoadingHistory ensures we subscribe to loading callbacks so
  // historyFailed transitions are detected (it's a derived property).
  const screenState = useDeployChat((s) => ({
    tasks: s.state.tasks,
    status: s.state.status,
    instructions: s.state.instructions,
    historyFailed: s.historyFailed,
    isLoadingHistory: s.isLoadingHistory,
  }));
  const pageInstructions = useDeployInstructions();
  const deployType = useDeployType();
  const isCampaignDeploy = deployType === "campaign";
  const screen = useDeployContentScreen(
    screenState,
    deploy?.status,
    deploy?.instructions,
    pageInstructions,
    screenState.historyFailed || pollingFailed
  );
  const isComplete = screen === "deploy-complete";

  const DeployScreen = SCREENS[screen];

  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 min-h-0 grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] py-[2.5%]">
        <div className="min-h-0 overflow-hidden">
          <DeploySidebar />
        </div>
        <div className="min-h-0 overflow-auto border border-neutral-300 bg-white rounded-2xl">
          <DeployScreen />
        </div>
      </main>

      <PaginationFooter.Root layout="full-bleed" canGoBack={isComplete} canGoForward={isComplete}>
        <PaginationFooter.BackButton />
        <PaginationFooter.Actions>
          <FullResetButton />
          <PaginationFooter.ContinueButton
            disabled={!isComplete}
            onClick={
              isCampaignDeploy
                ? () => router.visit(`/projects/${project!.uuid}/performance`)
                : undefined // Fallback behavior uses regular continue logic
            }
          >
            {isCampaignDeploy ? "See Performance" : "Continue"}
          </PaginationFooter.ContinueButton>
        </PaginationFooter.Actions>
      </PaginationFooter.Root>
    </div>
  );
}

export default function DeployPage() {
  const chat = useDeployChatInstance();

  return (
    <Chat.Root chat={chat}>
      <DeployErrorBoundary>
        <DeployContent />
      </DeployErrorBoundary>
    </Chat.Root>
  );
}
