import { useState } from 'react';
import { Check } from 'lucide-react';
import { L10 } from '@/lib/tracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PricingTier {
  name: string;
  price: string;
  priceValue: number;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  isEnterprise?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    price: 'Free',
    priceValue: 0,
    description: 'Perfect for small teams getting started',
    features: [
      'Up to 10 team members',
      'Unlimited meetings',
      'Basic calendar integration',
      'Email support',
    ],
    cta: 'Start Free',
  },
  {
    name: 'Professional',
    price: '$29/month',
    priceValue: 29,
    description: 'For growing teams that need more power',
    features: [
      'Up to 50 team members',
      'Advanced time zone logic',
      'Priority support',
      'Custom branding',
      'Analytics dashboard',
    ],
    cta: 'Start 14-Day Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$99/month',
    priceValue: 99,
    description: 'For large organizations with complex needs',
    features: [
      'Unlimited team members',
      'Dedicated account manager',
      'SSO & advanced security',
      'API access',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    isEnterprise: true,
  },
];

export function Pricing() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (tier: PricingTier, e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      await L10.createLead(email, { value: tier.priceValue });
      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const handleTierClick = (tierName: string) => {
    if (status === 'success' && selectedTier === tierName) {
      // Reset if clicking the same tier after success
      setStatus('idle');
      setSelectedTier(null);
    } else {
      setSelectedTier(tierName);
      setStatus('idle');
      setError('');
    }
  };

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple Pricing for Teams of All Sizes
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade when you're ready. No credit card required.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`bg-card rounded-3xl p-8 shadow-lg transition-all duration-300 flex flex-col ${
                tier.popular ? 'ring-2 ring-secondary scale-105 md:scale-110' : 'hover:scale-105'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="flex justify-center mb-4">
                  <span className="bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                    POPULAR
                  </span>
                </div>
              )}

              {/* Tier Name */}
              <h3 className="text-2xl font-bold text-foreground mb-2">{tier.name}</h3>

              {/* Price */}
              <div className="mb-4">
                <span className="text-5xl font-bold text-foreground">{tier.price}</span>
              </div>

              {/* Description */}
              <p className="text-muted-foreground mb-6">{tier.description}</p>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-grow">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Form */}
              {selectedTier === tier.name && status !== 'success' ? (
                <form onSubmit={(e) => handleSubmit(tier, e)} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                    disabled={status === 'loading'}
                  />
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full"
                    variant={tier.popular ? 'default' : 'secondary'}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Processing...' : tier.cta}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelectedTier(null)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              ) : selectedTier === tier.name && status === 'success' ? (
                <div className="text-center space-y-3">
                  <div className="bg-secondary/10 text-secondary rounded-lg p-4">
                    <Check className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">Success!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check your email for next steps.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTierClick(tier.name)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Sign up another email
                  </button>
                </div>
              ) : (
                <Button
                  onClick={() => handleTierClick(tier.name)}
                  className="w-full"
                  variant={tier.popular ? 'default' : 'secondary'}
                >
                  {tier.cta}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
