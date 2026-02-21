import { useState } from "react";
import { L10 } from "@/lib/tracking";
import { ArrowRight, CheckCircle } from "lucide-react";

export function CTA() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setError("");

    try {
      await L10.createLead(email);
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <section id="signup" className="relative bg-[#E9C46A] py-20 md:py-28 lg:py-36 overflow-hidden">
      {/* Retro sunburst pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-full h-1 bg-foreground origin-left"
            style={{
              transform: `rotate(${i * 22.5}deg)`,
            }}
          />
        ))}
      </div>

      {/* Diagonal accent */}
      <div className="absolute top-0 left-0 w-full h-32 bg-primary transform rotate-[-3deg] translate-y-[-50%]" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Headline */}
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-display text-6xl md:text-7xl lg:text-8xl text-foreground leading-tight mb-6">
              READY TO STOP
              <span className="block text-primary">WASTING TIME</span>
              <span className="block">ON COLD EMAILS?</span>
            </h2>
            <p className="text-2xl md:text-3xl text-foreground/80 font-body font-semibold">
              Join the waitlist and get matched with your first guest{" "}
              <span className="text-primary">for free</span>
            </p>
          </div>

          {/* Email Form */}
          {status === "success" ? (
            <div className="bg-background border-8 border-foreground shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-12 max-w-2xl mx-auto">
              <div className="flex flex-col items-center gap-6 mb-6">
                <div className="bg-secondary border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 rounded-full">
                  <CheckCircle className="w-16 h-16 text-foreground" strokeWidth={3} />
                </div>
                <h3 className="font-display text-5xl text-foreground text-center">
                  YOU'RE ON THE LIST!
                </h3>
              </div>
              <p className="text-2xl text-foreground/70 text-center font-body">
                We'll be in touch soon with your early access invite.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 mb-8">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={status === "loading"}
                  className="flex-1 px-8 py-6 bg-background text-foreground placeholder:text-foreground/40 text-xl font-body border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] focus:translate-x-[-2px] focus:translate-y-[-2px] transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-10 py-6 bg-primary text-primary-foreground font-display text-2xl tracking-wider border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all duration-200 disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex items-center justify-center gap-3 whitespace-nowrap"
                >
                  {status === "loading" ? (
                    "JOINING..."
                  ) : (
                    <>
                      GET EARLY ACCESS
                      <ArrowRight className="w-7 h-7" strokeWidth={3} />
                    </>
                  )}
                </button>
              </form>

              {/* Error message */}
              {status === "error" && (
                <p className="text-lg text-center bg-background text-foreground border-4 border-foreground px-6 py-4 mb-6 font-body shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {error}
                </p>
              )}

              {/* Fine print */}
              <div className="text-center space-y-2">
                <p className="text-xl text-foreground/70 font-body font-semibold">
                  No credit card required. Cancel anytime.
                </p>
                <p className="text-lg text-foreground/60 font-body">
                  Join <span className="font-bold text-primary">500+</span> producers already on the list
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
