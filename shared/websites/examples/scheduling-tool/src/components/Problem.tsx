import { MessageSquare, Clock, Users, AlertCircle } from "lucide-react";

export function Problem() {
  const painPoints = [
    {
      icon: MessageSquare,
      title: "Endless Slack threads",
      description: "\"What time works for everyone?\" followed by 47 messages and still no answer.",
      color: "text-accent"
    },
    {
      icon: Clock,
      title: "Timezone math nightmares",
      description: "Is 3pm EST too early for Tokyo? Too late for London? You're tired of calculating.",
      color: "text-secondary"
    },
    {
      icon: Users,
      title: "Scheduling paralysis",
      description: "The bigger your team, the harder it gets. 8 people across 6 timezones? Good luck.",
      color: "text-[#E9C46A]"
    },
    {
      icon: AlertCircle,
      title: "Meetings that never happen",
      description: "By the time everyone agrees, the moment has passed and priorities have shifted.",
      color: "text-accent"
    }
  ];

  return (
    <section id="problem" className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <div className="inline-block px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-semibold mb-6">
            The Problem
          </div>
          <h2 className="font-['Outfit'] font-bold text-4xl md:text-5xl lg:text-6xl text-foreground mb-6">
            Scheduling shouldn't be{" "}
            <span className="text-accent">this hard</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            If you're managing a distributed team, you know the pain. Every meeting request turns into a coordination nightmare.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div 
                key={index}
                className="group bg-card border border-border rounded-2xl p-6 md:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4 ${point.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-['Outfit'] font-semibold text-xl md:text-2xl text-card-foreground mb-3">
                  {point.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Call-out box */}
        <div className="max-w-3xl mx-auto mt-12 md:mt-16 bg-primary/5 border-l-4 border-primary rounded-lg p-6 md:p-8">
          <p className="text-lg md:text-xl text-foreground font-medium">
            <span className="text-primary font-bold">Project managers waste 15+ hours per week</span> just trying to find meeting times that work. That's nearly 2 full workdays lost to calendar Tetris.
          </p>
        </div>
      </div>
    </section>
  );
}
