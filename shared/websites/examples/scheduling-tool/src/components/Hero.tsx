import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function Hero() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      await L10.createLead(email);
      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="relative bg-primary text-primary-foreground overflow-hidden">
      {/* Orbital rings background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border-2 border-primary-foreground animate-[spin_60s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border-2 border-primary-foreground animate-[spin_80s_linear_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full border border-primary-foreground animate-[spin_100s_linear_infinite]" />
      </div>

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[#2A9D8F] opacity-90" />

      <div className="container relative z-10 px-4 md:px-6 py-20 md:py-28 lg:py-36">
        <div className="max-w-4xl mx-auto text-center">
          {/* Floating globe icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#E9C46A] mb-8 animate-[float_6s_ease-in-out_infinite]">
            <Globe className="w-10 h-10 md:w-12 md:h-12 text-[#264653]" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Stop Playing Calendar Tetris{' '}
            <span className="text-[#E9C46A]">Across Time Zones</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl mb-10 text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed">
            Our AI instantly finds meeting times that work for everyone on your distributed team—no more endless message threads or timezone math.
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="max-w-md mx-auto bg-[#2A9D8F] text-white p-6 rounded-2xl">
              <p className="text-lg font-semibold mb-2">🎉 You're on the list!</p>
              <p className="text-sm opacity-90">We'll send you early access details soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 h-14 px-6 text-base bg-white/95 text-foreground border-0 focus-visible:ring-2 focus-visible:ring-[#E9C46A]"
                  disabled={status === 'loading'}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={status === 'loading'}
                  className="h-14 px-8 bg-[#E76F51] hover:bg-[#E76F51]/90 text-white font-semibold text-base transition-all hover:scale-105"
                >
                  {status === 'loading' ? 'Joining...' : 'Get Early Access'}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-[#E76F51] bg-white/90 px-4 py-2 rounded-lg mt-3">{error}</p>
              )}
            </form>
          )}

          {/* Trust indicator */}
          <p className="text-sm text-primary-foreground/70">
            Trusted by 2,000+ remote teams worldwide
          </p>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
