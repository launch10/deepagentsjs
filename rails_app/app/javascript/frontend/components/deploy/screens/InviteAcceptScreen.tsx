import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import { useDeployChatActions, useDeployChatState } from "@hooks/useDeployChat";

export default function InviteAcceptScreen() {
  const { updateState } = useDeployChatActions();
  const tasks = useDeployChatState("tasks");
  const connectTask = tasks?.find((t) => t.name === "ConnectingGoogle");
  const googleEmail = connectTask?.result?.google_email as string | undefined;

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <EnvelopeIcon className="size-7 text-amber-600" />
        </div>

        <h2 className="text-xl font-semibold text-base-900">Accept Google Ads Invitation</h2>
        <p className="text-sm text-base-500 mt-2">
          We&apos;ve sent an invitation to{" "}
          {googleEmail ? (
            <span className="font-medium text-base-700">{googleEmail}</span>
          ) : (
            "your email"
          )}
          . Please check your inbox and accept the invitation to continue.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() =>
              window.open("https://ads.google.com/aw/accountaccess/invitations", "_blank")
            }
          >
            Open Google Ads
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open("https://mail.google.com", "_blank")}
          >
            Open Gmail
          </Button>
          <Button onClick={() => updateState({})}>I accepted the invite</Button>
        </div>
      </div>
    </div>
  );
}
