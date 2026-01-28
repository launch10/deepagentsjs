import { useState, useRef, type ReactNode, type FormEvent } from "react";
import { usePage, Link } from "@inertiajs/react";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { AuthLayout } from "~/layouts/auth-layout";
import rocketLaunch from "@assets/rocket-launch.png";
import googleLogo from "@assets/google_logo.png";

interface SignInProps {
  csrf_token: string;
  google_oauth_path: string;
}

function SignIn() {
  const { csrf_token, google_oauth_path } = usePage<SignInProps>().props;
  const [showForm, setShowForm] = useState(false);
  const googleFormRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  function handleGoogleSignIn() {
    googleFormRef.current?.submit();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setError("");

    const body = new FormData();
    body.append("user[email]", email);
    body.append("user[password]", password);

    try {
      const res = await fetch("/users/sign_in", {
        method: "POST",
        body,
        headers: {
          "X-CSRF-Token": csrf_token,
          "X-Inertia": "true",
        },
      });

      if (res.redirected) {
        window.location.href = res.url;
        return;
      }

      // Failed sign-in — Warden redirects back to sign_in with flash alert
      const data = await res.json();
      const flash = data.props?.flash;
      if (flash?.length) {
        setError(flash.find((f: { type: string }) => f.type === "alert")?.message || "Invalid email or password.");
      } else {
        setError("Invalid email or password.");
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex w-full max-w-[508px] flex-col items-center">
      <img src={rocketLaunch} alt="" className="mb-6 h-48 w-48" />

      {/* Hidden Google OAuth form */}
      <form ref={googleFormRef} method="post" action={google_oauth_path} className="hidden">
        <input type="hidden" name="authenticity_token" value={csrf_token} />
      </form>

      {!showForm ? (
        /* Welcome state */
        <>
          <h1 className="font-['IBM_Plex_Serif'] text-4xl font-semibold leading-10 text-[#2E3238]">
            Start building with Launch10
          </h1>
          <p className="mt-3 max-w-[589px] text-center font-['Plus_Jakarta_Sans',sans-serif] text-lg leading-[22px] text-[#2E3238] opacity-70">
            Set up your account to start building landing pages and launching
            ads, all in one place. No technical setup required.
          </p>

          <div className="mt-8 flex w-full flex-col gap-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-[#8E918F] bg-[#131314] px-3 text-sm font-medium text-[#E3E3E3] hover:bg-[#2a2a2b]"
            >
              <img src={googleLogo} alt="" className="h-5 w-5" />
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#D3D2D0] bg-[#FAFAF9] px-3 font-['Plus_Jakarta_Sans',sans-serif] text-base text-[#2E3238] hover:bg-[#F0EFEE]"
            >
              <EnvelopeIcon className="h-6 w-6" />
              Continue with Email
            </button>
          </div>

          <p className="mt-4 font-['Plus_Jakarta_Sans',sans-serif] text-base text-[#2E3238]">
            Already have an account?{" "}
            <Link href="/users/sign_up" className="text-[#3748B8]">
              Sign in
            </Link>
          </p>

          <p className="mt-6 max-w-[508px] text-center font-['Plus_Jakarta_Sans',sans-serif] text-xs leading-4 text-[#74767A]">
            By clicking Log In or Sign Up, you agree to the{" "}
            <a href="https://launch10.ai/terms" className="underline">Launch10 Terms of Service</a>{" "}
            and{" "}
            <a href="https://launch10.ai/privacy" className="underline">Privacy Notice</a>.
          </p>
        </>
      ) : (
        /* Sign In form state */
        <>
          <h1 className="font-['IBM_Plex_Serif'] text-4xl font-semibold leading-10 text-[#2E3238]">
            Welcome back to Launch10
          </h1>
          <p className="mt-3 max-w-[589px] text-center font-['Plus_Jakarta_Sans',sans-serif] text-lg leading-[22px] text-[#2E3238] opacity-70">
            Sign in to manage your pages, campaigns, and account settings.
          </p>

          <div className="mt-8 w-full">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-[#8E918F] bg-[#131314] px-3 text-sm font-medium text-[#E3E3E3] hover:bg-[#2a2a2b]"
            >
              <img src={googleLogo} alt="" className="h-5 w-5" />
              Sign in with Google
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-lg border border-[#D3D2D0] bg-white px-3 text-sm text-[#2E3238] placeholder:text-[#74767A] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Email"
            />

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-lg border border-[#D3D2D0] bg-white px-3 text-sm text-[#2E3238] placeholder:text-[#74767A] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Password"
            />

            <button
              type="submit"
              disabled={processing}
              className="h-12 rounded-lg bg-[#131314] text-sm font-medium text-[#E3E3E3] hover:bg-[#2a2a2b] disabled:opacity-50"
            >
              {processing ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-4 font-['Plus_Jakarta_Sans',sans-serif] text-base text-[#2E3238]">
            Don&apos;t have an account?{" "}
            <Link href="/users/sign_up" className="text-[#3748B8]">
              Sign Up
            </Link>
          </p>

          <p className="mt-6 max-w-[508px] text-center font-['Plus_Jakarta_Sans',sans-serif] text-xs leading-4 text-[#74767A]">
            By clicking Log In or Sign Up, you agree to the{" "}
            <a href="https://launch10.ai/terms" className="underline">Launch10 Terms of Service</a>{" "}
            and{" "}
            <a href="https://launch10.ai/privacy" className="underline">Privacy Notice</a>.
          </p>
        </>
      )}
    </div>
  );
}

SignIn.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;

export default SignIn;
