import { usePage } from "@inertiajs/react";
import { Chat } from "@components/shared/chat/Chat";
import { DeploySidebar, DeployFooter } from "@components/deploy";
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
import { useDeployChatInstance, type DeployProps } from "@hooks/useDeployChat";
import { useDeployInit } from "@hooks/useDeployInit";
import { useDeployContentScreen } from "@hooks/useDeployContentScreen";
import { Deploy as DeployTypes } from "@shared";

function DeployContent() {
  const { deploy_type } = usePage<DeployProps>().props;
  const polling = useDeployInit();
  const { state, startDeploy } = polling;
  const screen = useDeployContentScreen(state);

  // Find the currently running task for the in-progress label
  const currentTask = state.tasks?.find((t) => t.status === "running");
  const currentTaskLabel = currentTask
    ? (DeployTypes.TaskDescriptionMap[currentTask.name as DeployTypes.TaskName] ?? currentTask.name)
    : undefined;

  // Find google email for invite screen
  const connectTask = state.tasks?.find((t) => t.name === "ConnectingGoogle");
  const googleEmail = connectTask?.result?.google_email as string | undefined;

  const isComplete = state.status === "completed";

  return (
    <main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8 py-8">
      <DeploySidebar deployType={deploy_type} tasks={state.tasks} />
      <div className="flex flex-col">
        <div className="border border-neutral-300 bg-white rounded-2xl flex-1 min-h-[500px]">
          {screen === "in-progress" && (
            <InProgressScreen deployType={deploy_type} currentTaskLabel={currentTaskLabel} />
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
            <DeployCompleteScreen deployType={deploy_type} result={state.result} />
          )}
          {screen === "deploy-error" && (
            <DeployErrorScreen consoleErrors={state.consoleErrors} onRetry={startDeploy} />
          )}
        </div>
        <DeployFooter isComplete={isComplete} />
      </div>
    </main>
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
