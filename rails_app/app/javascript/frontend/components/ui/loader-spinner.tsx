import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function LoaderSpinner({ ...props }: React.ComponentProps<typeof DotLottieReact>) {
  return (
    <DotLottieReact
      src="https://lottie.host/75177f38-b736-4dff-8312-dcbdd6a85347/x0rMJyJg90.lottie"
      loop
      autoplay
      {...props}
    />
  );
}
