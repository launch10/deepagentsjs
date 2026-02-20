import { ArrowRight, Globe } from "lucide-react";
import { LeadForm } from "@/components/ui/lead-form";

export function Hero() {
  return (
    <section className="relative bg-primary text-primary-foreground overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs representing time zones */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-[#E9C46A]/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }}></div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, #FAFAFA 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-20 md:py-28 lg:py-36 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Hero copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 border border-secondary/30 backdrop-blur-sm">
              <Globe className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium text-secondary">Trusted by 2,000+ distributed teams</span>
            </div>

            <h1 className="font-['Outfit'] font-bold text-5xl md:text-6xl lg:text-7xl leading-tight">
              Stop the{" "}
              <span className="text-secondary">timezone chaos.</span>
              <br />
              Start meeting.
            </h1>

            <p className="text-xl md:text-2xl text-primary-foreground/90 leading-relaxed max-w-xl">
              Automatically find meeting times that work across continents. No more endless Slack threads asking "when works for everyone?"
            </p>

            {/* CTA Form */}
            <div className="pt-4">
              <LeadForm className="flex flex-col sm:flex-row gap-3 max-w-md">
                <LeadForm.Email 
                  placeholder="Enter your work email" 
                  className="flex-1 bg-background/95 backdrop-blur-sm border-primary-foreground/20 text-foreground placeholder:text-muted-foreground"
                />
                <LeadForm.Submit className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold px-8 py-6 text-lg whitespace-nowrap shadow-lg hover:shadow-xl transition-all hover:scale-105">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </LeadForm.Submit>
                <LeadForm.Success>
                  <div className="p-4 bg-background/95 backdrop-blur-sm rounded-lg border border-secondary/30">
                    <p className="text-foreground font-medium">Thanks! We'll send you access details shortly.</p>
                  </div>
                </LeadForm.Success>
                <LeadForm.Error />
              </LeadForm>
              <p className="text-sm text-primary-foreground/70 mt-3">Free 14-day trial • No credit card required</p>
            </div>

            {/* Social proof stats */}
            <div className="flex flex-wrap gap-8 pt-6 border-t border-primary-foreground/20">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-secondary">80%</div>
                <div className="text-sm text-primary-foreground/80">Less coordination time</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-secondary">15hrs</div>
                <div className="text-sm text-primary-foreground/80">Saved per week</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-secondary">2,000+</div>
                <div className="text-sm text-primary-foreground/80">Teams worldwide</div>
              </div>
            </div>
          </div>

          {/* Right: Visual element */}
          <div className="relative lg:block hidden">
            <div className="relative">
              {/* Main image with glow effect */}
              <div className="absolute inset-0 bg-secondary/20 rounded-3xl blur-2xl"></div>
              <img 
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
                alt="TimeSync scheduling visualization"
                className="relative rounded-3xl shadow-2xl w-full transform hover:scale-105 transition-transform duration-500"
              />
              
              {/* Floating time zone badges */}
              <div className="absolute -top-4 -left-4 bg-background text-foreground px-4 py-2 rounded-full shadow-lg border border-secondary/30 animate-bounce" style={{ animationDuration: '3s' }}>
                <span className="font-semibold">🇺🇸 PST 9:00 AM</span>
              </div>
              <div className="absolute top-1/4 -right-6 bg-background text-foreground px-4 py-2 rounded-full shadow-lg border border-secondary/30 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
                <span className="font-semibold">🇬🇧 GMT 5:00 PM</span>
              </div>
              <div className="absolute bottom-8 -left-6 bg-background text-foreground px-4 py-2 rounded-full shadow-lg border border-secondary/30 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                <span className="font-semibold">🇯🇵 JST 2:00 AM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
