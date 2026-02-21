import { MessageSquare, Clock, Users, AlertCircle } from "lucide-react";

export function Problem() {
  const painPoints = [
    {
      icon: MessageSquare,
      title: "Endless Slack threads",
      description: "\"What time works for everyone?\" followed by 47 messages and still no answer.",
    },
    {
      icon: Clock,
      title: "Timezone math nightmares",
      description: "Is 3pm EST too early for Tokyo? Too late for London? You're tired of calculating.",
    },
    {
      icon: Users,
      title: "Calendar Tetris",
      description: "Juggling 8 people's availability across 5 time zones feels like an impossible puzzle.",
    },
    {
      icon: AlertCircle,
      title: "Wasted productivity",
      description: "Your team spends hours every week just trying to schedule meetings instead of having them.",
    },
  ];

  return (
    <section className="py-20 md:py-28 lg:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Scheduling shouldn't be{" "}
            <span className="text-accent">this hard</span>
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
            If you're managing a distributed team, you know the pain. Every meeting requires a coordination dance that wastes everyone's time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-10 max-w-5xl mx-auto">
          {painPoints.map((point, index) => (
            <div
              key={index}
              className="group p-8 bg-card rounded-2xl border border-border shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-300">
                  <point.icon className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-card-foreground mb-2">
                    {point.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {point.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-accent/10 border border-accent/20 rounded-xl">
            <div className="text-5xl font-bold text-accent">15</div>
            <div className="text-left">
              <div className="text-sm text-muted-foreground">Average hours wasted</div>
              <div className="text-base font-semibold text-foreground">per team, per week</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
