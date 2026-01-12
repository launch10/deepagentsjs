import { Link2, Settings, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Link2,
    number: 1,
    title: "Connect Your Calendar",
    description:
      "Link your calendar in one click—we'll automatically detect your availability and working hours across any timezone.",
  },
  {
    icon: Settings,
    number: 2,
    title: "Set Your Preferences",
    description:
      "Tell us when you prefer meetings, your focus time blocks, and any scheduling rules your team follows.",
  },
  {
    icon: Sparkles,
    number: 3,
    title: "Let AI Find the Perfect Time",
    description:
      "We analyze everyone's calendars instantly and suggest optimal times—your team just clicks 'yes' and it's done.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            From Chaos to Scheduled in 3 Steps
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Set it up once, schedule effortlessly forever
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative text-center">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-border" />
              )}

              <div className="relative z-10 flex flex-col items-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 border-4 border-background">
                  <step.icon className="h-10 w-10 text-primary" />
                </div>
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-2 bg-primary text-primary-foreground text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
