import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

export function SocialProof() {
  const stats = [
    {
      value: '2,000+',
      label: 'Distributed Teams',
    },
    {
      value: '80%',
      label: 'Less Coordination Time',
    },
    {
      value: '15 hrs/week',
      label: 'Saved Per Team',
    },
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Title */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            Trusted by Distributed Teams Worldwide
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16 md:mb-20">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center space-y-2 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary">
                {stat.value}
              </div>
              <div className="text-base md:text-lg text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonial Card */}
        <div className="max-w-3xl mx-auto">
          <Card className="bg-card shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl border-border">
            <CardContent className="p-8 md:p-10 lg:p-12">
              <div className="flex flex-col items-center text-center space-y-6">
                {/* Quote Icon */}
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Quote className="w-6 h-6 text-primary" />
                </div>

                {/* Quote Text */}
                <blockquote className="text-lg md:text-xl lg:text-2xl text-foreground leading-relaxed">
                  "We used to spend hours every week just trying to find meeting times. 
                  Now it's instant. Game changer for our remote team."
                </blockquote>

                {/* Author */}
                <div className="space-y-1">
                  <div className="font-semibold text-foreground text-base md:text-lg">
                    Sarah Chen
                  </div>
                  <div className="text-sm md:text-base text-muted-foreground">
                    Project Manager at TechCorp
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
