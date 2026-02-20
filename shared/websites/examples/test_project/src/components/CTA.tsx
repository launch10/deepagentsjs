import { useState } from 'react';
import { Rocket, Check } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function CTA() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setError('');

    try {
      await L10.createLead(email);
      setStatus('success');
      setName('');
      setEmail('');
      setPhone('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="relative bg-primary py-20 md:py-24 lg:py-28 overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
      </div>

      {/* Rocket badge decorative element */}
      <div className="absolute top-8 right-8 md:top-12 md:right-16 lg:top-16 lg:right-24 opacity-20 animate-pulse">
        <img 
          src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
          alt="" 
          className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 rotate-12"
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-primary-foreground/10 p-4 rounded-2xl backdrop-blur-sm">
              <Rocket className="w-12 h-12 md:w-14 md:h-14 text-primary-foreground" />
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
            Ready to Stop Wasting Time on Scheduling?
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 mb-10 max-w-3xl mx-auto">
            Join 2,000+ teams who've eliminated calendar chaos. Start scheduling smarter in under 2 minutes.
          </p>

          {/* Form */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto border border-primary-foreground/20">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-primary-foreground/20 p-3 rounded-full">
                  <Check className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-primary-foreground mb-2">
                You're In! 🎉
              </h3>
              <p className="text-primary-foreground/80">
                Check your inbox for next steps. Get ready to transform your scheduling!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  disabled={status === 'loading'}
                  className="px-6 py-4 md:py-5 text-lg rounded-xl bg-background text-foreground border-2 border-transparent focus:border-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary-foreground/20 disabled:opacity-50 transition-all"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  required
                  disabled={status === 'loading'}
                  className="px-6 py-4 md:py-5 text-lg rounded-xl bg-background text-foreground border-2 border-transparent focus:border-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary-foreground/20 disabled:opacity-50 transition-all"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  required
                  disabled={status === 'loading'}
                  className="flex-1 px-6 py-4 md:py-5 text-lg rounded-xl bg-background text-foreground border-2 border-transparent focus:border-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary-foreground/20 disabled:opacity-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-8 py-4 md:py-5 text-lg font-semibold bg-primary-foreground text-primary rounded-xl hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200 whitespace-nowrap"
                >
                  {status === 'loading' ? 'Starting...' : 'Get Started Free'}
                </button>
              </div>

              {error && (
                <p className="text-primary-foreground/90 text-sm mb-4 bg-primary-foreground/10 backdrop-blur-sm py-2 px-4 rounded-lg">
                  {error}
                </p>
              )}

              {/* Fine print */}
              <p className="text-primary-foreground/70 text-sm md:text-base">
                No credit card required • Free for teams up to 10
              </p>
            </form>
          )}

          {/* Additional urgency elements */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-primary-foreground/80 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span>Setup in 2 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span>No training needed</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
