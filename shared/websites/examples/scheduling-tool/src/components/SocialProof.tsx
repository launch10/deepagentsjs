import React from 'react';
import { Quote, TrendingUp, Clock, Users } from 'lucide-react';

export function SocialProof() {
  const testimonials = [
    {
      quote: "We went from spending 2 hours a week on scheduling to literally 15 minutes. It's like having a personal assistant for the entire team.",
      author: 'Sarah Chen',
      role: 'Head of Operations',
      company: 'TechCorp',
      color: 'border-[#2A9D8F]',
    },
    {
      quote: "As an engineering manager with a team across 5 time zones, this tool is a lifesaver. No more mental math or accidentally scheduling 3am meetings.",
      author: 'Marcus Rodriguez',
      role: 'Engineering Manager',
      company: 'CloudScale',
      color: 'border-[#F4A261]',
    },
    {
      quote: "The one-click rescheduling is a game-changer. Plans change constantly in product development, and this keeps us agile without the coordination headache.",
      author: 'Priya Patel',
      role: 'Product Lead',
      company: 'InnovateLabs',
      color: 'border-[#E76F51]',
    },
  ];

  const stats = [
    {
      icon: TrendingUp,
      value: '80%',
      label: 'Less time coordinating',
      color: 'text-[#2A9D8F]',
      bgColor: 'bg-[#2A9D8F]/10',
    },
    {
      icon: Clock,
      value: '15 hrs',
      label: 'Saved per week',
      color: 'text-[#F4A261]',
      bgColor: 'bg-[#F4A261]/10',
    },
    {
      icon: Users,
      value: '2,000+',
      label: 'Distributed teams',
      color: 'text-[#E76F51]',
      bgColor: 'bg-[#E76F51]/10',
    },
  ];

  return (
    <section className="py-20 md:py-24 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="text-center space-y-4 animate-zoom-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`inline-flex items-center justify-center w-16 h-16 ${stat.bgColor} rounded-2xl mx-auto`}>
                  <Icon className={`w-8 h-8 ${stat.color}`} />
                </div>
                <div className="text-4xl md:text-5xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-lg text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Section header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            Loved by Teams Worldwide
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of distributed teams who've reclaimed their time
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={`group bg-card rounded-3xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-l-4 ${testimonial.color} animate-slide-up`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Quote className="w-10 h-10 text-muted/30 mb-6" />
              <p className="text-card-foreground leading-relaxed mb-6 italic">
                "{testimonial.quote}"
              </p>
              <div className="border-t border-border pt-6">
                <p className="font-semibold text-card-foreground">
                  {testimonial.author}
                </p>
                <p className="text-sm text-muted-foreground">
                  {testimonial.role}
                </p>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  {testimonial.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}