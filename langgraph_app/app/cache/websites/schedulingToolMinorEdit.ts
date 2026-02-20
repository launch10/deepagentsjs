import { Website } from "@types";
import { getSchedulingToolFiles } from "./readExampleFiles";

const now = new Date().toISOString();

/**
 * Minor edit version - changed headline and subtitle in Hero.tsx
 * Re-uses all other files from the base scheduling tool.
 */
export function getSchedulingToolMinorEditFiles(): Website.FileMap {
  return {
    ...getSchedulingToolFiles(),
    "/src/components/Hero.tsx": {
      content: `import { LeadForm } from '@/components/ui/lead-form';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section
      id="signup"
      className="relative bg-primary text-primary-foreground overflow-hidden py-20 md:py-24 lg:py-32"
    >
      {/* Atmospheric gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-primary-foreground/5 rounded-full blur-2xl"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          {/* Left column - Content (60%) */}
          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight tracking-tight">
                Your Calendar, Your Rules. Finally.
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl leading-relaxed">
                Take control of your schedule and never miss another meeting. Our intelligent scheduling works across all time zones automatically.
              </p>
            </div>

            {/* Email capture form */}
            <LeadForm className="space-y-4 max-w-md">
              <LeadForm.Success>
                <div className="bg-secondary/20 backdrop-blur-sm border border-secondary-foreground/20 rounded-2xl p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-secondary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg mb-1">You're on the list!</h3>
                      <p className="text-primary-foreground/80 text-sm">
                        We'll send you early access details soon. Get ready to reclaim your time.
                      </p>
                    </div>
                  </div>
                </div>
              </LeadForm.Success>
              <div className="flex flex-col sm:flex-row gap-3">
                <LeadForm.Email
                  placeholder="Enter your email"
                  className="flex-1 h-12 bg-background/95 backdrop-blur-sm text-foreground border-primary-foreground/20 placeholder:text-muted-foreground focus:border-secondary focus:ring-secondary"
                />
                <LeadForm.Submit
                  className="h-12 px-8 bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:scale-105 transition-all duration-200 font-semibold group"
                  loadingText="Joining..."
                >
                  Get Started Free
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </LeadForm.Submit>
              </div>
              <LeadForm.Error className="text-sm text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-4 py-2" />
              <p className="text-xs text-primary-foreground/60">
                No credit card required. Free forever for small teams.
              </p>
            </LeadForm>
          </div>

          {/* Right column - Hero image (40%) */}
          <div className="lg:col-span-2">
            <div className="relative">
              {/* Glow effect behind image */}
              <div className="absolute inset-0 bg-secondary/30 rounded-3xl blur-2xl transform scale-95"></div>

              {/* Hero image with floating animation */}
              <img
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Scheduling tool interface showing timezone coordination"
                className="relative rounded-2xl shadow-2xl w-full h-auto animate-float"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Custom floating animation */}
      <style>{\`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      \`}</style>
    </section>
  );
}
`,
      created_at: now,
      modified_at: now,
    },
  };
}
