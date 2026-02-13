import { CheckCircleIcon } from "@heroicons/react/24/solid";

const ACCESS_ITEMS = [
  "Manage your Google Ads campaigns",
  "View campaign performance data",
  "Enable and pause your campaigns",
];

export default function GoogleConnectScreen() {
  const oauthUrl = `/auth/google_oauth2?redirect_to=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-md w-full">
        <h2 className="text-xl font-semibold text-base-900 text-center">
          Connect Your Google Account
        </h2>
        <p className="text-sm text-base-500 text-center mt-2">
          To deploy your Google Ads campaign, we need access to your Google Ads account.
        </p>

        <div className="mt-6 border border-neutral-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-base-700 mb-3">What we&apos;ll access</h3>
          <ul className="space-y-2.5">
            {ACCESS_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircleIcon className="size-5 text-success-500 shrink-0 mt-0.5" />
                <span className="text-sm text-base-600">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <a
          href={oauthUrl}
          className="mt-6 flex items-center justify-center gap-3 w-full px-6 py-3 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="size-5">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span className="text-sm font-medium text-base-700">Sign in with Google</span>
        </a>
      </div>
    </div>
  );
}
