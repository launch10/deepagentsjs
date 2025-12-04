import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "One free validation to experience the magic",
    features: [
      "1 idea validation",
      "Basic Validation Score",
      "Landing page template",
      "7-day experiment window",
      "Email support"
    ],
    cta: "Start Free",
    highlighted: false
  },
  {
    name: "Founder",
    price: "$49",
    period: "/month",
    description: "Unlimited validations for serious founders",
    features: [
      "Unlimited idea validations",
      "Full Validation Score breakdown",
      "Unlimited landing pages",
      "A/B testing & fake-door experiments",
      "Competitive moat analysis",
      "Signal dashboard with benchmarks",
      "Validation playbooks & templates",
      "Priority support"
    ],
    cta: "Start 14-Day Trial",
    highlighted: true
  },
  {
    name: "Studio",
    price: "$299",
    period: "/month",
    description: "For teams validating multiple ventures",
    features: [
      "Everything in Founder",
      "Up to 10 team members",
      "Portfolio-wide analytics",
      "API access",
      "White-label reports",
      "Custom scoring rubrics",
      "Dedicated account manager",
      "SSO & advanced security"
    ],
    cta: "Contact Sales",
    highlighted: false
  }
];

export const Pricing = () => {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free. Upgrade when you're ready to validate unlimited ideas.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`border-2 ${plan.highlighted ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              <CardContent className="p-6">
                {plan.highlighted && (
                  <Badge className="mb-4 bg-primary">Most Popular</Badge>
                )}
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-muted-foreground mb-6">{plan.description}</p>
                <Button 
                  className="w-full mb-6" 
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
