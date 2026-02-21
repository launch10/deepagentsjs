import { ArrowRight, CheckCircle } from "lucide-react";
import { LeadForm } from "@/components/ui/lead-form";

export function CTA() {
  const benefits = [
    "14-day free trial, no credit card required",
    "Setup in under 2 minutes",
    "Cancel anytime, no questions asked",
    "Join 2,000+ distributed teams",
  ];

  return (
    <section id="cta" className="relative py-20 md:py-28 lg:py-32 bg-primary text-primary-foreground overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[#1a3d47]" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Ready to stop wasting time on{" "}
              <span className="text-secondary">scheduling?</span>
            </h2>
            <p className="text-xl md:text-2xl text-primary-foreground/80 leading-relaxed max-w-2xl mx-auto">
              Join thousands of distributed teams who've eliminated the back-and-forth. Start your free trial today.
            </p>
          </div>

          {/* Form */}
          <div className="max-w-2xl mx-auto mb-10">
            <LeadForm className="flex flex-col sm:flex-row gap-4">
              <LeadForm.Email 
                placeholder="Enter your work email" 
                className="flex-1 h-14 px-6 text-base bg-background/95 text-foreground border-0 shadow-xl"
              />
              <LeadForm.Submit className="h-14 px-8 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold text-base shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center gap-2 whitespace-nowrap">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </LeadForm.Submit>
              <LeadForm.Success>
                <div className="p-6 bg-secondary/20 border border-secondary/30 rounded-xl text-center">
                  <CheckCircle className="w-12 h-12 text-secondary mx-auto mb-3" />
                  <p className="text-secondary font-semibold text-lg mb-2">You're all set!</p>
                  <p className="text-primary-foreground/80">Check your email for next steps. We'll have you up and running in minutes.</p>
                </div>
              </LeadForm.Success>
              <LeadForm.Error />
            </LeadForm>
          </div>

          {/* Benefits */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 text-primary-foreground/90">
                <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0" />
                <span className="text-sm md:text-base">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Trust line */}
          <div className="mt-12 text-center">
            <p className="text-sm text-primary-foreground/60">
              Trusted by teams at TechCorp, Global Innovations, and 2,000+ other companies worldwide
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
