import { Search, Mail, XCircle } from "lucide-react";

export function Problem() {
  const problems = [
    {
      icon: Search,
      title: "Hours of Research",
      description: "Scrolling LinkedIn and Twitter to find experts who might be a fit for your show",
      color: "bg-[#E76F51]",
    },
    {
      icon: Mail,
      title: "Ghosted Emails",
      description: "Crafting personalized pitches that disappear into inboxes, never to be seen again",
      color: "bg-[#E9C46A]",
    },
    {
      icon: XCircle,
      title: "Last-Minute Cancellations",
      description: "Finally booking someone, only to have them bail 24 hours before recording",
      color: "bg-[#2A9D8F]",
    },
  ];

  return (
    <section className="bg-background py-20 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Diagonal background split */}
      <div className="absolute inset-0 bg-muted transform origin-top-left rotate-[-2deg] scale-110" />
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Asymmetric header */}
        <div className="max-w-6xl mx-auto mb-16 md:mb-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex-1">
              <div className="inline-block mb-4">
                <span className="font-display text-7xl md:text-8xl lg:text-9xl text-primary/10 leading-none">
                  PROBLEM
                </span>
              </div>
              <h2 className="font-display text-5xl md:text-6xl lg:text-7xl leading-tight text-foreground">
                THE COLD EMAIL
                <span className="block text-primary">NIGHTMARE</span>
              </h2>
            </div>
            <div className="md:max-w-md">
              <p className="text-xl md:text-2xl text-foreground/70 font-body leading-relaxed">
                Podcast producers waste <span className="font-bold text-primary">countless hours</span> on guest outreach that goes nowhere
              </p>
            </div>
          </div>
        </div>

        {/* Problem cards - staggered layout */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={index}
                className={`bg-background border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 transition-all duration-300 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] ${
                  index === 1 ? 'md:translate-y-8' : ''
                }`}
              >
                {/* Icon with colored background */}
                <div className={`mb-6 inline-flex items-center justify-center w-16 h-16 ${problem.color} border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                  <Icon className="w-8 h-8 text-foreground" strokeWidth={2.5} />
                </div>
                
                {/* Title */}
                <h3 className="font-display text-3xl md:text-4xl mb-4 text-foreground leading-tight">
                  {problem.title}
                </h3>
                
                {/* Description */}
                <p className="text-foreground/70 leading-relaxed text-lg font-body">
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
