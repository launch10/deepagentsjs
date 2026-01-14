import React from 'react';
import { Quote } from 'lucide-react';

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
    number: "80%",
    description: "Less time spent on meeting coordination"
  },
  {
    number: "15 hours",
    description: "Average hours saved per team per week"
  },
  {
    number: "2,000+",
    description: "Distributed teams scheduling smarter"
  }
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 md:py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Join 2,000+ Teams Who've Ditched the Scheduling Chaos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real teams, real results, real time saved.
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-20">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center p-8 bg-primary/5 rounded-3xl border-2 border-primary/10 hover:border-primary/30 transition-all duration-300 animate-zoom-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="text-4xl md:text-5xl font-bold text-primary mb-3">
                {stat.number}
              </div>
              <div className="text-muted-foreground font-medium">
                {stat.description}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card rounded-3xl p-8 shadow-md hover:shadow-xl transition-all duration-300 relative animate-slide-up"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <Quote className="w-10 h-10 text-primary/20 mb-4" />
              <p className="text-card-foreground leading-relaxed mb-6 italic">
                "{testimonial.quote}"
              </p>
              <div className="border-t border-border pt-4">
                <div className="font-semibold text-card-foreground">
                  {testimonial.author}
                </div>
                <div className="text-sm text-muted-foreground">
                  {testimonial.role}
                </div>
                <div className="text-sm text-primary font-medium">
                  {testimonial.company}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
