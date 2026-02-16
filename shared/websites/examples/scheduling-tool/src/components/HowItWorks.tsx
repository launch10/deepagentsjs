export function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Connect Your Calendar",
      description: "Link your Google, Outlook, or Apple calendar in seconds",
      imagePosition: "right" as const,
    },
    {
      number: "2",
      title: "Set Your Preferences",
      description: "Tell us your working hours and timezone preferences",
      imagePosition: "left" as const,
    },
    {
      number: "3",
      title: "Share & Schedule",
      description: "We instantly suggest optimal times that work for everyone",
      imagePosition: "right" as const,
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16 md:mb-20 lg:mb-24">
          Three Steps to Perfect Scheduling
        </h2>

        {/* Steps */}
        <div className="space-y-20 md:space-y-24 lg:space-y-32">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center ${
                step.imagePosition === "left" ? "lg:flex-row-reverse" : ""
              }`}
            >
              {/* Text Content */}
              <div
                className={`space-y-4 md:space-y-6 ${
                  step.imagePosition === "left" ? "lg:order-2" : "lg:order-1"
                }`}
              >
                {/* Large Step Number */}
                <div className="flex items-start gap-4 md:gap-6">
                  <span className="text-6xl md:text-7xl lg:text-8xl font-bold text-accent leading-none">
                    {step.number}
                  </span>
                  <div className="pt-2 md:pt-3 lg:pt-4">
                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 md:mb-4">
                      {step.title}
                    </h3>
                    <p className="text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Image */}
              <div
                className={`${
                  step.imagePosition === "left" ? "lg:order-1" : "lg:order-2"
                }`}
              >
                <div className="relative group">
                  <img
                    src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png"
                    alt={`${step.title} illustration`}
                    className="w-full rounded-xl shadow-2xl transition-all duration-300 group-hover:shadow-3xl group-hover:-translate-y-1"
                  />
                  {/* Decorative accent behind image */}
                  <div className="absolute -inset-4 bg-accent/10 rounded-2xl -z-10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
