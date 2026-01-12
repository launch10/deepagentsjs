import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

const stats = [
  {
    number: "80%",
    label: "Less Time Scheduling",
    description: "Average reduction in meeting coordination time",
  },
  {
    number: "15 hrs",
    label: "Saved Per Week",
    description: "Time reclaimed by teams like TechCorp",
  },
  {
    number: "2,000+",
    label: "Teams Worldwide",
    description: "Distributed companies scheduling smarter",
  },
];

const testimonials = [
  {
    quote:
      "We went from 47 Slack messages to schedule one meeting to literally zero. This tool paid for itself in the first week.",
    author: "Sarah Chen",
    title: "Engineering Manager",
    company: "TechCorp",
  },
  {
    quote:
      "With team members in 6 countries, scheduling was my full-time job. Now it takes 30 seconds. I actually get to do project management again.",
    author: "Marcus Rodriguez",
    title: "Senior Project Manager",
    company: "GlobalScale Inc.",
  },
];

export function SocialProof() {
  return (
    <section id="testimonials" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Trusted by 2,000+ Distributed Teams Worldwide
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join the companies that stopped wasting time on scheduling
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-8 md:grid-cols-3 mb-16 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                {stat.number}
              </div>
              <div className="text-lg font-semibold mb-1">{stat.label}</div>
              <div className="text-sm text-muted-foreground">{stat.description}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 shadow-md">
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/20 mb-4" />
                <blockquote className="text-lg mb-6">"{testimonial.quote}"</blockquote>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {testimonial.author.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.title}, {testimonial.company}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
