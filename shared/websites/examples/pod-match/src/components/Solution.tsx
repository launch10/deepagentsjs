import { Mic2, Users, Calendar, ArrowRight } from "lucide-react";

export function Solution() {
  const steps = [
    {
      number: 1,
      icon: Mic2,
      title: "Tell Us Your Show",
      description: "Share your podcast topic, audience, and the kind of guests you're looking for",
      color: "bg-secondary",
    },
    {
      number: 2,
      icon: Users,
      title: "We Match You",
      description: "Our curated network of experts who want to be on podcasts—matched to your show's topic and audience",
      color: "bg-primary",
    },
    {
      number: 3,
      icon: Calendar,
      title: "Book & Record",
      description: "Connect directly with engaged guests who've already said yes to podcast appearances",
      color: "bg-[#2A9D8F]",
    },
  ];

  return (
    <section id="how-it-works" className="bg-primary text-primary-foreground py-20 md:py-28 lg:py-36 relative overflow-hidden grain">
      {/* Retro circles pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-64 h-64 border-4 border-current rounded-full" />
        <div className="absolute bottom-10 right-10 w-96 h-96 border-4 border-current rounded-full" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 border-4 border-current rounded-full" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 md:mb-24">
          <div className="inline-block mb-6">
            <span className="font-display text-2xl md:text-3xl tracking-widest bg-secondary text-secondary-foreground px-8 py-3 border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-[1deg]">
              HOW IT WORKS
            </span>
          </div>
          <h2 className="font-display text-5xl md:text-7xl lg:text-8xl leading-tight mb-6">
            WE'VE BUILT
            <span className="block text-secondary">THE NETWORK.</span>
            <span className="block">YOU JUST PICK</span>
            <span className="block text-secondary">YOUR GUEST.</span>
          </h2>
        </div>

        {/* Steps - Vertical layout with huge numbers */}
        <div className="max-w-5xl mx-auto space-y-12 md:space-y-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`relative flex flex-col md:flex-row gap-8 md:gap-12 items-start ${
                  index % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* Huge number */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <span className="font-display text-[180px] md:text-[240px] lg:text-[300px] leading-none text-primary-foreground/10 select-none">
                      {step.number}
                    </span>
                    <div className={`absolute top-8 md:top-12 ${index % 2 === 1 ? 'right-8 md:right-12' : 'left-8 md:left-12'}`}>
                      <div className={`${step.color} border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 md:p-8`}>
                        <Icon className="w-12 h-12 md:w-16 md:h-16 text-foreground" strokeWidth={2.5} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-background text-foreground border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 md:p-10 mt-8 md:mt-16">
                  <h3 className="font-display text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-xl md:text-2xl text-foreground/70 leading-relaxed font-body">
                    {step.description}
                  </p>
                </div>

                {/* Arrow connector */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute left-1/2 -bottom-8 transform -translate-x-1/2">
                    <ArrowRight className="w-12 h-12 text-secondary rotate-90" strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
