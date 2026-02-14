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
import { useDeployChatInstance, type DeployProps } from "@hooks/useDeployChat";
import { useDeployInit } from "@hooks/useDeployInit";
import { useDeployContentScreen } from "@hooks/useDeployContentScreen";

function DeployContent() {
  const { deploy, deploy_type, website_url, deploy_environment } = usePage<DeployProps>().props;
  const polling = useDeployInit();
  const { state, startDeploy } = polling;
  const screen = useDeployContentScreen(state, deploy?.status);

  // Find google email for invite screen
  const connectTask = state.tasks?.find((t) => t.name === "ConnectingGoogle");
  const googleEmail = connectTask?.result?.google_email as string | undefined;

  const isComplete = state.status === "completed" || deploy?.status === "completed";

  return (
    <div className="h-full flex flex-col">
      {/* Main content area - matches Website grid pattern */}
      <main className="flex-1 min-h-0 grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] py-[2.5%]">
        <div className="min-h-0 overflow-hidden">
          <DeploySidebar deployType={deploy_type} tasks={state.tasks} />
        </div>
        <div className="min-h-0 overflow-auto border border-neutral-300 bg-white rounded-2xl">
          {screen === "in-progress" && (
            <InProgressScreen
              deployType={deploy_type}
              tasks={state.tasks}
              isStuck={polling.isStuck}
            />
          )}
          {screen === "google-connect" && <GoogleConnectScreen />}
          {screen === "invite-accept" && (
            <InviteAcceptScreen
              googleEmail={googleEmail}
              onAccepted={() => polling.updateState({ polling: true })}
            />
          )}
          {screen === "payment-required" && (
            <PaymentRequiredScreen onPaymentAdded={() => polling.updateState({ polling: true })} />
          )}
          {screen === "checking-payment" && <CheckingPaymentScreen />}
          {screen === "payment-confirmed" && <PaymentConfirmedScreen />}
          {screen === "waiting-google" && (
            <WaitingGoogleScreen onCheckAgain={() => polling.updateState({ polling: true })} />
          )}
          {screen === "deploy-complete" && (
            <DeployCompleteScreen
              deployType={deploy_type}
              result={state.result}
              websiteUrl={website_url}
              deployEnvironment={deploy_environment}
            />
          )}
          {screen === "deploy-error" && (
            <DeployErrorScreen
              error={state.error?.message}
              consoleErrors={state.consoleErrors}
              onRetry={startDeploy}
            />
          )}
        </div>
      </main>

      {/* Pagination Footer - full-bleed matches Website grid alignment */}
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
