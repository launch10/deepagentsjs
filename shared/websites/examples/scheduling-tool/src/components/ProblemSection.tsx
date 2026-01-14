import React from 'react';
import { MessageSquare, Clock, UserX } from 'lucide-react';

const problems = [
  {
    icon: MessageSquare,
    title: "The 47-Message Scheduling Thread",
    description: "You send out meeting requests. Someone in Tokyo can't make it. Someone in London has a conflict. You propose new times. Repeat. What should take 30 seconds takes 3 days and 47 Slack messages."
  },
  {
    icon: Clock,
    title: "The 'Sorry, I Thought That Was 3pm My Time' No-Show",
    description: "Time zone math is hard. Someone inevitably converts wrong, misses the meeting, and now you're scheduling a makeup meeting. Which means another 47-message thread."
  },
  {
    icon: UserX,
    title: "The Project Manager Who's Actually a Full-Time Scheduler",
    description: "You didn't sign up to be a human calendar coordinator. But here you are, spending 15+ hours a week just trying to get people in the same (virtual) room."
  }
];

export function ProblemSection() {
  return (
    <section className="py-20 md:py-24 lg:py-32 bg-muted">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Sound Familiar?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            If you're nodding along, you're not alone. Here's what distributed teams deal with every single day.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 animate-slide-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-card-foreground mb-4">
                  {problem.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
