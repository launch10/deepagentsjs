import { useState } from 'react';
import { Globe, ArrowRight } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function Hero() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      await L10.createLead(email);
      setStatus('success');
      setName('');
      setEmail('');
      setPhone('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="relative bg-primary text-primary-foreground py-20 md:py-24 lg:py-32 overflow-hidden">
      {/* Atmospheric background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-foreground/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-primary-foreground/3 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column: Content */}
          <div className="max-w-3xl">
            {/* Icon accent */}
            <div className="inline-flex items-center gap-2 mb-6 text-primary-foreground/80">
              <Globe className="w-8 h-8" />
              <span className="text-sm font-medium tracking-wide uppercase">Global Scheduling</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Stop Playing Calendar Tetris Across Time Zones
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 leading-relaxed">
              Automatically find meeting times that work for everyone on your distributed team. No more endless Slack threads asking "when works for you?"
            </p>

            {/* Email capture form */}
            {status === 'success' ? (
              <div className="bg-primary-foreground/10 border border-primary-foreground/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 text-primary-foreground">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">You're on the list!</p>
                    <p className="text-primary-foreground/80 text-sm">We'll be in touch soon with early access.</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    disabled={status === 'loading'}
                    className="px-6 py-4 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30 backdrop-blur-sm text-lg disabled:opacity-50 transition-all"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    required
                    disabled={status === 'loading'}
                    className="px-6 py-4 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30 backdrop-blur-sm text-lg disabled:opacity-50 transition-all"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your work email"
                    required
                    disabled={status === 'loading'}
                    className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30 backdrop-blur-sm text-lg disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="px-8 py-4 bg-primary-foreground text-primary rounded-xl font-semibold text-lg hover:scale-105 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {status === 'loading' ? 'Joining...' : 'Start Scheduling Smarter'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
                {status === 'error' && (
                  <p className="text-primary-foreground/90 text-sm bg-primary-foreground/10 border border-primary-foreground/20 rounded-lg px-4 py-2">
                    {errorMessage}
                  </p>
                )}
              </form>
            )}

            {/* Social proof */}
            <p className="text-primary-foreground/70 text-sm mt-4">
              Join 2,000+ distributed teams
            </p>
          </div>

          {/* Right column: Decorative badge */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative">
              <img
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Rocket badge"
                className="w-72 h-72 object-contain animate-float drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Custom animation for floating effect */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(3deg);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
