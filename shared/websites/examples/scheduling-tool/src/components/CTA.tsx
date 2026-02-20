import { ArrowRight, CheckCircle } from "lucide-react";
import { LeadForm } from "@/components/ui/lead-form";

export function CTA() {
  const benefits = [
    "14-day free trial",
    "No credit card required",
    "Cancel anytime",
    "Setup in under 2 minutes"
  ];

  return (
    <section id="cta" className="relative bg-primary text-primary-foreground overflow-hidden py-16 md:py-20 lg:py-24">
      {/* Atmospheric background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }}></div>
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#E9C46A]/10 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-['Outfit'] font-bold text-4xl md:text-5xl lg:text-6xl mb-6">
            Ready to stop wasting time on{" "}
            <span className="text-secondary">scheduling?</span>
          </h2>
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 leading-relaxed">
            Join 2,000+ distributed teams who've reclaimed their time. Start scheduling smarter today.
          </p>

          {/* Benefits list */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-10">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-primary-foreground/90">
                <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0" />
                <span className="font-medium">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Form */}
          <div className="max-w-2xl mx-auto">
            <LeadForm className="flex flex-col sm:flex-row gap-4 mb-6">
              <LeadForm.Email 
                placeholder="Enter your work email" 
                className="flex-1 bg-background/95 backdrop-blur-sm border-primary-foreground/20 text-foreground placeholder:text-muted-foreground h-14 text-lg"
              />
              <LeadForm.Submit className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold px-10 py-6 text-lg whitespace-nowrap shadow-2xl hover:shadow-secondary/50 transition-all hover:scale-105 h-14">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </LeadForm.Submit>
              <LeadForm.Success>
                <div className="p-6 bg-background/95 backdrop-blur-sm rounded-xl border border-secondary/30 shadow-xl">
                  <p className="text-foreground font-semibold text-lg mb-2">🎉 You're all set!</p>
                  <p className="text-muted-foreground">Check your email for access details. Welcome to TimeSync!</p>
                </div>
              </LeadForm.Success>
              <LeadForm.Error />
            </LeadForm>

            <p className="text-sm text-primary-foreground/70">
              By signing up, you agree to our terms. We respect your privacy and will never spam you.
            </p>
          </div>

          {/* Trust badges */}
          <div className="mt-12 pt-8 border-t border-primary-foreground/20">
            <p className="text-sm text-primary-foreground/70 mb-4">Trusted by teams at</p>
            <div className="flex flex-wrap justify-center gap-8 items-center opacity-80">
              <div className="px-6 py-2 bg-background/10 backdrop-blur-sm rounded-lg font-semibold text-primary-foreground">
                TechCorp
              </div>
              <div className="px-6 py-2 bg-background/10 backdrop-blur-sm rounded-lg font-semibold text-primary-foreground">
                Global Innovations
              </div>
              <div className="px-6 py-2 bg-background/10 backdrop-blur-sm rounded-lg font-semibold text-primary-foreground">
                DistributedCo
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
