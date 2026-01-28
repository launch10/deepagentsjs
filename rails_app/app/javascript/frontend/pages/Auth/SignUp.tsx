import { useState, type ReactNode, type FormEvent } from "react";
import { router, usePage } from "@inertiajs/react";
import { AuthLayout } from "~/layouts/auth-layout";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Field, FieldError } from "@components/ui/field";
import { GoogleOAuthButton } from "@components/auth/GoogleOAuthButton";
import { AuthLegalFooter } from "@components/auth/AuthLegalFooter";
import { toFieldErrors } from "@components/auth/utils";
import rocketLaunch from "@assets/rocket-launch.png";

interface SignUpProps {
  csrf_token: string;
  google_oauth_path: string;
  captcha_field_name: string;
  minimum_password_length: number;
  spinner: string;
  errors?: Record<string, string[]>;
}

function SignUp() {
  const { csrf_token, google_oauth_path, captcha_field_name, spinner, errors: serverErrors } =
    usePage<SignUpProps>().props;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>(serverErrors || {});
  const [processing, setProcessing] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setErrors({});

    router.post("/users", {
      user: {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        terms_of_service: "1",
        owned_accounts_attributes: [{ name }],
      },
      [captcha_field_name]: "",
      spinner,
    }, {
      onError: (errs) => setErrors(errs as Record<string, string[]>),
      onFinish: () => setProcessing(false),
    });
  }

  return (
    <div className="flex w-full max-w-[508px] flex-col items-center">
      <img src={rocketLaunch} alt="" className="mb-6 h-48 w-48" />

      <h1 className="font-serif text-4xl font-semibold leading-10 text-base-500">
        Start building with Launch10
      </h1>
      <p className="mt-3 max-w-[589px] text-center font-sans text-lg leading-[22px] text-base-500 opacity-70">
        Set up your account to start building landing pages and launching
        ads, all in one place. No technical setup required.
      </p>

      <div className="mt-8 w-full">
        <GoogleOAuthButton
          csrfToken={csrf_token}
          oauthPath={google_oauth_path}
          label="Sign up with Google"
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
        <Field>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors?.name}
            className="h-12 rounded-lg"
            placeholder="Full Name"
          />
          <FieldError errors={toFieldErrors(errors, "name")} />
        </Field>

        <Field>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors?.email}
            className="h-12 rounded-lg"
            placeholder="Email"
          />
          <FieldError errors={toFieldErrors(errors, "email")} />
        </Field>

        <Field>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors?.password}
            className="h-12 rounded-lg"
            placeholder="Password"
          />
          <FieldError errors={toFieldErrors(errors, "password")} />
        </Field>

        <Field>
          <Input
            id="password_confirmation"
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            aria-invalid={!!errors?.password_confirmation}
            className="h-12 rounded-lg"
            placeholder="Confirm Password"
          />
          <FieldError errors={toFieldErrors(errors, "password_confirmation")} />
        </Field>

        <Button
          type="submit"
          disabled={processing}
          className="h-12"
        >
          {processing ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <p className="mt-4 font-sans text-base text-base-500">
        Already have an account?{" "}
        <a href="/users/sign_in" className="text-primary-500">
          Sign In
        </a>
      </p>

      <AuthLegalFooter />
    </div>
  );
}

SignUp.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;

export default SignUp;
