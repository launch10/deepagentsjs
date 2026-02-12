import { Users, Clock, TrendingDown } from 'lucide-react';

export function SocialProof() {
  const stats = [
    {
      number: "2,000+",
      label: "Distributed Teams",
      icon: Users,
    },
    {
      number: "80%",
      label: "Less Coordination Time",
      icon: TrendingDown,
    },
    {
      number: "15 hrs",
      label: "Saved Per Week",
      icon: Clock,
    },
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Trusted by Distributed Teams Worldwide
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Companies using our tool have cut meeting coordination time by 80%.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 md:mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl shadow-md p-8 text-center hover:shadow-lg transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <Icon className="w-10 h-10 text-primary" />
                </div>
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                  {stat.number}
                </div>
                <div className="text-base md:text-lg text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Testimonial */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-10 lg:p-12">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
              {/* Quote */}
              <div className="flex-1">
                <svg
                  className="w-10 h-10 text-primary mb-4 opacity-50"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <blockquote className="text-lg md:text-xl mb-6 leading-relaxed">
                  "Before this tool, I spent half my day playing calendar Tetris. Now I just share a link and meetings magically appear on everyone's calendar. It's honestly life-changing."
                </blockquote>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-semibold text-lg">Sarah Chen</div>
                    <div className="text-muted-foreground">Head of Operations, TechCorp</div>
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div className="flex items-center justify-center md:justify-end">
                <img
                  src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png"
                  alt="TechCorp logo"
                  className="h-12 md:h-16 w-auto opacity-70 hover:opacity-100 transition-opacity duration-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
