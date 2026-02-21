import { ArrowRight, Globe } from "lucide-react";
import { LeadForm } from "@/components/ui/lead-form";

export function Hero() {
  return (
    <section className="relative bg-primary text-primary-foreground overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[#1a3d47] opacity-90" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      
      {/* Decorative timezone indicators */}
      <div className="absolute top-32 left-[10%] text-secondary/30 text-sm font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span>NYC 09:00</span>
        </div>
      </div>
      <div className="absolute top-48 right-[15%] text-secondary/30 text-sm font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span>LON 14:00</span>
        </div>
      </div>
      <div className="absolute bottom-40 right-[20%] text-secondary/30 text-sm font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span>TOK 22:00</span>
        </div>
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 py-20 md:py-28 lg:py-36">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 border border-secondary/30 text-secondary text-sm font-medium">
              <Globe className="w-4 h-4" />
              <span>Trusted by 2,000+ distributed teams</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
              Stop the scheduling{" "}
              <span className="text-secondary">back-and-forth</span>
            </h1>

            <p className="text-xl md:text-2xl text-primary-foreground/80 leading-relaxed max-w-xl">
              Automatically find meeting times that work across every time zone. No more endless Slack threads asking "when works for everyone?"
            </p>

            <LeadForm className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <LeadForm.Email 
                placeholder="Enter your work email" 
                className="flex-1 h-14 px-6 text-base bg-background/95 text-foreground border-0 shadow-lg"
              />
              <LeadForm.Submit className="h-14 px-8 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center gap-2">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </LeadForm.Submit>
              <LeadForm.Success>
                <div className="p-4 bg-secondary/20 border border-secondary/30 rounded-lg">
                  <p className="text-secondary font-medium">Thanks! We'll send you access shortly.</p>
                </div>
              </LeadForm.Success>
              <LeadForm.Error />
            </LeadForm>

            <p className="text-sm text-primary-foreground/60">
              Free 14-day trial • No credit card required • Setup in 2 minutes
            </p>
          </div>

          {/* Right: Visual */}
          <div className="relative">
            <div className="relative z-10">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
                alt="TimeSync scheduling interface"
                className="w-full h-auto rounded-2xl shadow-2xl border border-primary-foreground/10"
              />
            </div>
            
            {/* Floating time zone cards */}
            <div className="absolute -top-6 -left-6 bg-card text-card-foreground px-6 py-4 rounded-xl shadow-xl border border-border">
              <div className="text-sm text-muted-foreground">San Francisco</div>
              <div className="text-2xl font-bold text-secondary">9:00 AM</div>
            </div>
            
            <div className="absolute -bottom-6 -right-6 bg-card text-card-foreground px-6 py-4 rounded-xl shadow-xl border border-border">
              <div className="text-sm text-muted-foreground">Singapore</div>
              <div className="text-2xl font-bold text-secondary">12:00 AM</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
