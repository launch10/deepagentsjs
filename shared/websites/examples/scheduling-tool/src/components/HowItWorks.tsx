import { Calendar, Settings, Zap, CheckCircle } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: Calendar,
      title: "Connect your calendar",
      description: "Link your Google Calendar, Outlook, or any calendar provider in seconds. We sync your availability automatically.",
    },
    {
      number: "02",
      icon: Settings,
      title: "Set your preferences",
      description: "Tell us your working hours, preferred meeting times, and buffer preferences. We respect your boundaries.",
    },
    {
      number: "03",
      icon: Zap,
      title: "Share your link",
      description: "Send your personalized scheduling link to anyone. They see times that work for everyone, in their own timezone.",
    },
    {
      number: "04",
      icon: CheckCircle,
      title: "Meetings scheduled instantly",
      description: "No back-and-forth. No timezone confusion. Just click and confirm. Calendar invites sent automatically.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 lg:py-32 bg-muted">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-block px-4 py-2 bg-secondary/20 text-secondary rounded-full text-sm font-semibold mb-6">
            Simple Process
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            From chaos to scheduled in{" "}
            <span className="text-secondary">4 easy steps</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Setup takes 2 minutes. Your team saves hours every week.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative group"
              >
                {/* Connector line for desktop */}
                {index < steps.length - 1 && index % 2 === 0 && (
                  <div className="hidden md:block absolute top-1/2 left-full w-12 h-0.5 bg-gradient-to-r from-secondary/50 to-transparent -translate-y-1/2 z-0" />
                )}

                <div className="relative bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border">
                  {/* Step number */}
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-secondary text-secondary-foreground rounded-xl flex items-center justify-center font-bold text-xl shadow-lg">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="mb-6 mt-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                      <step.icon className="w-7 h-7 text-primary" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold text-card-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground mb-6">
            Ready to eliminate scheduling chaos?
          </p>
          <a 
            href="#cta" 
            className="inline-flex items-center px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-xl text-lg"
          >
            Start Your Free Trial
          </a>
        </div>
      </div>
    </section>
  );
}
