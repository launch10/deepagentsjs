import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const CTA = () => {
  const [email, setEmail] = useState('');

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Stop guessing. Start validating.
        </h2>
        <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
          Your first validation is free. Find out if your idea has what it takes before you invest months building it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <Input 
            type="email" 
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/60"
          />
          <Button size="lg" variant="secondary" className="h-12 px-8">
            Get Started Free
          </Button>
        </div>
        <p className="text-sm opacity-70 mt-4">
          No credit card required. Takes 2 minutes to start.
        </p>
      </div>
    </section>
  );
};
