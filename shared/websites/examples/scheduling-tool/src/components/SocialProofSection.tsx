import React from 'react';
import { Quote, TrendingUp, Users, Clock } from 'lucide-react';

const testimonials = [
  {
    quote: "We used to spend the first 10 minutes of every project kickoff just trying to schedule the next meeting. Now it's instant. Our team saves at least 15 hours a week—that's almost half a full-time employee just on scheduling.",
    author: "Sarah Chen",
    role: "Head of Operations",
    company: "TechCorp"
  },
  {
    quote: "Managing a team across San Francisco, London, and Singapore was a nightmare. I was basically a full-time calendar coordinator. This tool gave me my job back. And my sanity.",
    author: "Marcus Rodriguez",
    role: "Engineering Manager",
    company: "CloudScale"
  },
  {
    quote: "The time zone conversion alone is worth it. No more 'wait, is that 3am for me?' panic. Everyone sees their local time automatically. Game changer for our distributed team.",
    author: "Priya Patel",
    role: "Product Manager",
    company: "DataFlow"
  }
];

const stats = [
  {
    icon: TrendingUp,
    number: "80%",
    description: "Less time spent on meeting coordination"
  },
  {
    icon: Clock,
    number: "15 hours",
    description: "Average hours saved per team per week"
  },
  {
    icon: Users,
    number: "2,000+",
    description: "Distributed teams scheduling smarter"
  }
];

export function SocialProofSection() {
  return (
    <section id="testimonials" className="py-16 md:py-20 lg:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Join 2,000+ Teams Who've{' '}
            <span className="text-primary">Ditched the Scheduling Chaos</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real teams. Real results. Real time saved.
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16 max-w-5xl mx-auto">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div 
                key={index}
                className="bg-primary text-primary-foreground rounded-3xl p-8 text-center shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-zoom-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <Icon className="w-10 h-10 mx-auto mb-4 text-[#E9C46A]" />
                <div className="text-4xl md:text-5xl font-bold mb-2">
                  {stat.number}
                </div>
                <p className="text-primary-foreground/90">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-card rounded-3xl p-6 md:p-8 shadow-md hover:shadow-xl transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${(index + 3) * 0.1}s` }}
            >
              <Quote className="w-10 h-10 text-accent mb-4" />
              <p className="text-card-foreground leading-relaxed mb-6 italic">
                "{testimonial.quote}"
              </p>
              <div className="border-t border-border pt-4">
                <p className="font-bold text-card-foreground">
                  {testimonial.author}
                </p>
                <p className="text-sm text-muted-foreground">
                  {testimonial.role}, {testimonial.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
