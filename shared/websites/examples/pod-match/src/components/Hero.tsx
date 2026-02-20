"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { L10 } from "@/lib/tracking";
import { CheckCircle, ArrowRight } from "lucide-react";

export function Hero() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      await L10.createLead(email);
      setStatus("success");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <section className="relative bg-primary text-primary-foreground py-24 md:py-32 lg:py-40 overflow-hidden grain">
      {/* Retro broadcast wave pattern background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            currentColor 2px,
            currentColor 4px
          )`,
          transform: 'skewY(-12deg)',
          transformOrigin: 'top left'
        }} />
      </div>

      {/* Circular broadcast rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[2px] border-primary-foreground/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[2px] border-primary-foreground/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border-[2px] border-primary-foreground/5 rounded-full" />
      </div>

      {/* Diagonal accent stripe */}
      <div className="absolute top-0 right-0 w-full h-32 bg-secondary/20 transform rotate-[-3deg] translate-y-[-50%]" />

      {/* Content */}
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Eyebrow text */}
          <div className="text-center mb-6">
            <span className="inline-block bg-secondary text-secondary-foreground px-6 py-2 font-display text-xl md:text-2xl tracking-wider border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-[-1deg]">
              PODCAST MATCHMAKING
            </span>
          </div>

          {/* Headline - HUGE and bold */}
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-[0.9] mb-8 md:mb-10 text-center text-shadow-lg">
            STOP COLD-EMAILING.
            <span className="block text-secondary mt-2">START BOOKING</span>
            <span className="block mt-2">GUESTS WHO</span>
            <span className="block text-secondary mt-2">ACTUALLY SHOW UP.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl lg:text-3xl text-primary-foreground/90 mb-12 md:mb-16 max-w-3xl mx-auto leading-relaxed text-center font-body">
            Connect with a curated network of experts who <span className="text-secondary font-bold">want</span> to be on your show. Book engaged guests in days—not weeks.
          </p>

          {/* Email capture form */}
          {status === "success" ? (
            <div className="max-w-lg mx-auto bg-background text-foreground p-10 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <CheckCircle className="w-10 h-10 text-secondary" />
                <h3 className="text-3xl font-display">YOU'RE ON THE LIST!</h3>
              </div>
              <p className="text-lg text-center font-body">
                We'll reach out soon with your early access invite.
              </p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                  className="flex-1 h-16 md:h-20 text-lg md:text-xl bg-background text-foreground placeholder:text-foreground/40 border-4 border-foreground focus-visible:ring-0 focus-visible:ring-offset-0 font-body shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  required
                />
                <Button
                  type="submit"
                  disabled={status === "loading"}
                  className="h-16 md:h-20 px-10 bg-secondary text-secondary-foreground hover:bg-secondary border-4 border-foreground hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 font-display text-xl md:text-2xl tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group"
                >
                  {status === "loading" ? (
                    "JOINING..."
                  ) : (
                    <>
                      GET EARLY ACCESS
                      <ArrowRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </form>

              {status === "error" && errorMessage && (
                <p className="text-base text-center bg-background text-foreground border-4 border-foreground px-6 py-4 mb-6 font-body shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {errorMessage}
                </p>
              )}

              <p className="text-lg md:text-xl text-primary-foreground/80 text-center font-body">
                <span className="font-bold text-secondary">500+</span> producers ditched the cold email grind
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
