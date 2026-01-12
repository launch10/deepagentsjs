import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { L10 } from "@/lib/tracking";

export function Hero() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      await L10.createLead(email);
      setStatus("success");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="relative overflow-hidden bg-background py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          <div className="flex flex-col gap-6 text-center lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Stop Scheduling.{" "}
              <span className="text-primary">Start Meeting.</span>
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto lg:mx-0">
              The AI-powered scheduling tool that finds the perfect meeting time across every time zone—instantly. No more endless email chains or Slack threads asking "when works for everyone?"
            </p>

            {status === "success" ? (
              <div className="flex items-center justify-center lg:justify-start gap-2 text-primary">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">You're on the list! We'll be in touch soon.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                  disabled={status === "loading"}
                />
                <Button type="submit" size="lg" disabled={status === "loading"}>
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Get Early Access
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {status === "error" && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}

            <p className="text-sm text-muted-foreground">
              🚀 Join 2,000+ distributed teams already scheduling smarter
            </p>
          </div>

          <div className="relative lg:pl-8">
            <img
              src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
              alt="Scheduling made easy"
              className="w-full max-w-lg mx-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
