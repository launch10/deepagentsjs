import { MessageSquare, Globe, Calendar } from 'lucide-react';

export function Problem() {
  const painPoints = [
    {
      icon: MessageSquare,
      title: "Endless Back-and-Forth",
      description: "Twelve messages later and you still don't have a meeting time. Sound familiar?"
    },
    {
      icon: Globe,
      title: "Time Zone Math Headaches",
      description: "Is 3pm EST too early for the Sydney team? Too late for London? Who knows anymore."
    },
    {
      icon: Calendar,
      title: "Calendar Chaos",
      description: "Juggling five different calendars, three scheduling tools, and someone's 'I'm flexible' that means nothing."
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16">
          The Scheduling Nightmare Every Remote Team Knows
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-3 text-card-foreground">
                  {point.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
