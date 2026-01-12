import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle, Loader2, Rocket } from "lucide-react";
import { useState } from "react";
import { L10 } from "@/lib/tracking";

export function CTA() {
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
    <section id="cta" className="py-20 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Your Team's Time Is Too Valuable for Calendar Chaos
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Join 2,000+ distributed teams who've already eliminated scheduling headaches. Early access is free—and your sanity will thank you.
          </p>

          {status === "success" ? (
            <div className="flex items-center justify-center gap-2 bg-primary-foreground/10 rounded-lg p-4">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">You're on the list! We'll be in touch soon.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-primary-foreground text-foreground"
                disabled={status === "loading"}
              />
              <Button
                type="submit"
                size="lg"
                variant="secondary"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Start Scheduling Smarter
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {status === "error" && (
            <p className="text-sm mt-4 opacity-90">{errorMessage}</p>
          )}

          <p className="text-sm mt-6 opacity-75 flex items-center justify-center gap-2">
            <Rocket className="h-4 w-4" />
            Early access spots are limited
          </p>
        </div>
      </div>
    </section>
  );
}
