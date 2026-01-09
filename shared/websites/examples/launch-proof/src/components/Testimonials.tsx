import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const testimonials = [
  {
    quote: "I was about to spend 4 months building an invoicing tool. LaunchProof's competitive analysis showed 47 funded competitors and declining search interest. I pivoted to expense automation and got my first paying customer in 6 weeks.",
    author: "Marcus Chen",
    role: "Founder, ExpenseFlow",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    metric: "6 weeks to first customer"
  },
  {
    quote: "Sarah used LaunchProof and decided NOT to launch. She saved $30k and her sanity. Sometimes the best validation is knowing when to walk away.",
    author: "Sarah Mitchell",
    role: "Former Founder",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    metric: "$30k saved"
  },
  {
    quote: "We evaluate 50+ ideas monthly for our portfolio. LaunchProof replaced three analysts and gives us consistent, data-driven scores we can compare across ventures.",
    author: "David Park",
    role: "Partner, Velocity Ventures",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    metric: "50+ ideas/month"
  }
];

export const Testimonials = () => {
  return (
    <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">Testimonials</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Founders trust LaunchProof to make hard decisions
          </h2>
          <p className="text-lg text-muted-foreground">
            Real stories from founders who validated (or invalidated) their ideas.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-2">
              <CardContent className="p-6">
                <Badge className="mb-4 bg-secondary/10 text-secondary border-0">{testimonial.metric}</Badge>
                <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.author}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center items-center gap-8 opacity-60">
          <p className="text-sm text-muted-foreground">Trusted by founders from:</p>
          <div className="flex flex-wrap justify-center gap-8">
            <span className="font-semibold text-lg">Y Combinator</span>
            <span className="font-semibold text-lg">Techstars</span>
            <span className="font-semibold text-lg">On Deck</span>
            <span className="font-semibold text-lg">Indie Hackers</span>
          </div>
        </div>
      </div>
    </section>
  );
};
