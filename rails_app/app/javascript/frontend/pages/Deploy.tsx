import { usePage } from "@inertiajs/react";
import { Chat } from "@components/shared/chat/Chat";
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
} from "@components/deploy/screens";
import { PaginationFooter } from "@components/shared/pagination-footer";
import {
  useDeployChatInstance,
  useDeployChatFullState,
  type DeployProps,
} from "@hooks/useDeployChat";
import { useDeployInit } from "@hooks/useDeployInit";
import { useDeployContentScreen, type DeployScreen } from "@hooks/useDeployContentScreen";

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
};

function DeployContent() {
  const { deploy } = usePage<DeployProps>().props;
  useDeployInit();

  const state = useDeployChatFullState();
  const screen = useDeployContentScreen(state, deploy?.status);
  const isComplete = state.status === "completed" || deploy?.status === "completed";

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

      <PaginationFooter.Root layout="full-bleed" canGoForward={isComplete}>
        <PaginationFooter.BackButton />
        <PaginationFooter.Actions>
          <PaginationFooter.ContinueButton disabled={!isComplete} />
        </PaginationFooter.Actions>
      </PaginationFooter.Root>
    </div>
  );
}

export default function DeployPage() {
  const chat = useDeployChatInstance();

  return (
    <Chat.Root chat={chat}>
      <DeployContent />
    </Chat.Root>
  );
}
