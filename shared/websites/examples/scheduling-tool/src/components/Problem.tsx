import { MessageSquare, Calendar, Moon } from 'lucide-react';

export function Problem() {
  const painPoints = [
    {
      icon: MessageSquare,
      title: "15 Messages Later...",
      description: "Endless back-and-forth in Slack trying to find a time that works for your team in SF, London, and Singapore."
    },
    {
      icon: Calendar,
      title: "Calendar Chaos",
      description: "Juggling multiple time zones in your head, converting UTC to PST to GMT, and still getting it wrong."
    },
    {
      icon: Moon,
      title: "Meeting Fatigue",
      description: "Someone always gets stuck with the 6am or 11pm slot because 'it's the only time that works.'"
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            The Timezone Coordination Nightmare
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground">
            Sound familiar?
          </p>
        </div>

        {/* Pain Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 md:p-8 shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                {/* Icon */}
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                  <Icon className="w-6 h-6 text-primary" />
                </div>

                {/* Title */}
                <h3 className="text-xl md:text-2xl font-semibold mb-3">
                  {point.title}
                </h3>

                {/* Description */}
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
