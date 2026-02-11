import { Quote } from 'lucide-react';

export function SocialProof() {
  const stats = [
    { number: '2,000+', label: 'Distributed Teams' },
    { number: '80%', label: 'Less Coordination Time' },
    { number: '15 hrs/week', label: 'Saved Per Company' },
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16">
          Trusted by Distributed Teams Worldwide
        </h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16 md:mb-20">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                {stat.number}
              </div>
              <div className="text-lg md:text-xl text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonial Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-3xl shadow-lg p-8 md:p-12 relative transition-all duration-300 hover:shadow-xl">
            {/* Quote Icon */}
            <div className="absolute -top-4 left-8 bg-secondary text-secondary-foreground rounded-full p-3 shadow-md">
              <Quote className="w-6 h-6" />
            </div>

            {/* Quote Text */}
            <blockquote className="text-lg md:text-xl text-foreground leading-relaxed mb-6 mt-4">
              "We went from spending 2 hours a week on scheduling to literally zero. 
              It's like having a personal assistant for the entire team."
            </blockquote>

            {/* Author Info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold text-lg">SC</span>
              </div>
              <div>
                <div className="font-semibold text-foreground">Sarah Chen</div>
                <div className="text-sm text-muted-foreground">
                  Head of Operations, TechCorp
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
