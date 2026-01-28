import { useRef } from "react";
import { cn } from "@lib/utils";
import googleLogo from "@assets/google_logo.png";

interface GoogleOAuthButtonProps {
  csrfToken: string;
  oauthPath: string;
  label: string;
  className?: string;
}

export function GoogleOAuthButton({ csrfToken, oauthPath, label, className }: GoogleOAuthButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} method="post" action={oauthPath} className="hidden">
        <input type="hidden" name="authenticity_token" value={csrfToken} />
      </form>
      <button
        type="button"
        onClick={() => formRef.current?.submit()}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-600 bg-base-600 px-3 text-sm font-medium text-neutral-100 hover:bg-base-500",
          className
        )}
      >
        <img src={googleLogo} alt="" className="h-5 w-5" />
        {label}
      </button>
    </>
  );
}
