import { useState, type ReactNode, type FormEvent } from "react";
import { router, usePage, Link } from "@inertiajs/react";
import { AuthLayout } from "~/layouts/auth-layout";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Alert, AlertDescription } from "@components/ui/alert";
import { GoogleOAuthButton } from "@components/auth/GoogleOAuthButton";
import { AuthLegalFooter } from "@components/auth/AuthLegalFooter";
import rocketLaunch from "@assets/rocket-launch.png";

interface SignInProps {
  csrf_token: string;
  google_oauth_path: string;
  errors?: Record<string, string[]>;
}

function SignIn() {
  const { csrf_token, google_oauth_path, errors: serverErrors } = usePage<SignInProps>().props;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>(serverErrors || {});
  const [processing, setProcessing] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setErrors({});

    router.post("/users/sign_in", {
      user: { email, password }
    }, {
      onError: (errs) => setErrors(errs as Record<string, string[]>),
      onFinish: () => setProcessing(false),
    });
  }

  const errorMessage = errors?.base?.[0];

  return (
    <div className="flex w-full max-w-[508px] flex-col items-center">
      <img src={rocketLaunch} alt="" className="mb-6 h-48 w-48" />

      <h1 className="font-serif text-4xl font-semibold leading-10 text-base-500">
        Welcome back to Launch10
      </h1>
      <p className="mt-3 max-w-[589px] text-center font-sans text-lg leading-[22px] text-base-500 opacity-70">
        Sign in to manage your pages, campaigns, and account settings.
      </p>

      <div className="mt-8 w-full">
        <GoogleOAuthButton
          csrfToken={csrf_token}
          oauthPath={google_oauth_path}
          label="Sign in with Google"
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-lg"
          placeholder="Email"
        />

        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 rounded-lg"
          placeholder="Password"
        />

        <Button
          type="submit"
          disabled={processing}
          className="h-12"
        >
          {processing ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="mt-4 font-sans text-base text-base-500">
        Don&apos;t have an account?{" "}
        <Link href="/users/sign_up" className="text-primary-500">
          Sign Up
        </Link>
      </p>

      <AuthLegalFooter />
    </div>
  );
}

SignIn.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;

export default SignIn;
