import { EnvelopeIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import { useDeployChatActions, useDeployChatState } from "@hooks/useDeployChat";

export interface InviteAcceptViewProps {
  googleEmail?: string;
  onResendInvite?: () => void;
  onAccepted?: () => void;
}

/** Pure presentational component — no hooks, fully testable in Storybook */
export function InviteAcceptView({
  googleEmail,
  onResendInvite,
  onAccepted,
}: InviteAcceptViewProps) {
  return (
    <div className="flex flex-col h-full p-10">
      {/* Header — top-left aligned */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-base-500">
          Finish setting up your new Google Ads account
        </h2>
        <p className="text-xs text-base-300">
          An email was sent to {googleEmail ?? "your email"}. Accept the Google invitation and
          return to this screen to finish setup.
        </p>
      </div>

      {/* Centered content — fills remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center mx-auto w-full max-w-[506px]">
        {/* Invitation card */}
        <div className="w-full border border-neutral-200 rounded-lg bg-white flex flex-col gap-5 px-[30px] py-[26px]">
          {/* Invitation sent to + badge */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <EnvelopeIcon className="size-7 text-base-300 shrink-0" />
              <div className="flex flex-col text-base leading-5">
                <span className="font-semibold text-base-300">Invitation sent to:</span>
                <span className="font-medium text-base-600">
                  {googleEmail ?? "your email"}
                </span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-[#faecdb] px-3 py-1 text-xs text-[#bf873f]">
              External action needed
            </span>
          </div>

          {/* What to do */}
          <div className="bg-neutral-50 rounded-lg p-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-base-600">What to do</h3>
            <ol className="flex flex-col gap-2 list-decimal list-inside text-sm text-base-600">
              <li>Open your email inbox</li>
              <li>Find an email from Google Ads</li>
              <li>Click &ldquo;Accept Invitation&rdquo;</li>
              <li className="font-semibold">Come back here and confirm</li>
            </ol>
          </div>

          {/* Resend link */}
          <p className="text-sm text-base-500">
            Didn&apos;t receive it?{" "}
            <button
              type="button"
              onClick={onResendInvite}
              className="text-primary-600 underline hover:text-primary-700"
            >
              Resend Invite
            </button>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5 w-full">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => window.open("https://mail.google.com", "_blank")}
          >
            <ArrowTopRightOnSquareIcon className="size-4" />
            Open Gmail
          </Button>
          <Button
            className="flex-1 bg-base-500 text-white hover:bg-base-600 border-base-500"
            onClick={onAccepted}
          >
            I accepted the invite
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Connected component — reads from deploy chat state */
export default function InviteAcceptScreen() {
  const { updateState } = useDeployChatActions();
  const tasks = useDeployChatState("tasks");
  const connectTask = tasks?.find((t) => t.name === "ConnectingGoogle");
  const googleEmail = connectTask?.result?.google_email as string | undefined;

  return (
    <InviteAcceptView
      googleEmail={googleEmail}
      onResendInvite={() => updateState({})}
      onAccepted={() => updateState({})}
    />
  );
}
