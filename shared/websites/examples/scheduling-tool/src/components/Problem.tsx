import { Clock, Globe, Calendar } from 'lucide-react';

export function Problem() {
  const painPoints = [
    {
      icon: Clock,
      title: "Endless Back-and-Forth",
      description: "12 messages later and you still don't have a meeting time. Sound familiar?"
    },
    {
      icon: Globe,
      title: "Time Zone Math Nightmares",
      description: "Is 3pm EST too early for the Sydney team? Too late for London? Who knows anymore."
    },
    {
      icon: Calendar,
      title: "Calendar Chaos",
      description: "Juggling availability across 6 people and 4 time zones shouldn't require a PhD."
    }
  ];

  return (
    <section className="bg-muted py-20 md:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            The Hidden Cost of "Finding a Time"
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Your team wastes hours every week on scheduling logistics instead of actual work.
          </p>
        </div>

        {/* Pain Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-8 shadow-md hover:shadow-lg transition-all"
              >
                <Icon className="text-primary mb-6" size={40} />
                <h3 className="text-2xl font-semibold text-foreground mb-4">
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
