import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function Hero() {
  const [email, setEmail] = useState('');
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
      setEmail('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="relative bg-primary overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary-foreground/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative container mx-auto px-4 md:px-6 py-20 md:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column - Copy and CTA */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight">
                Stop Playing Calendar Tetris
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl leading-relaxed">
                Automatically find meeting times that work across every time zone. No more endless Slack threads asking "when works for everyone?"
              </p>
            </div>

            {/* Email capture form */}
            <div className="space-y-4">
              {status === 'success' ? (
                <div className="bg-primary-foreground/10 border border-primary-foreground/20 rounded-xl p-6 backdrop-blur-sm">
                  <p className="text-primary-foreground font-semibold text-lg">
                    🎉 You're on the list!
                  </p>
                  <p className="text-primary-foreground/80 mt-2">
                    We'll be in touch soon with early access.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      disabled={status === 'loading'}
                      className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30 backdrop-blur-sm transition-all disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      className="px-8 py-4 bg-primary-foreground text-primary rounded-xl font-semibold hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {status === 'loading' ? (
                        'Submitting...'
                      ) : (
                        <>
                          Start Scheduling Smarter
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                  {status === 'error' && (
                    <p className="text-primary-foreground/90 text-sm bg-primary-foreground/10 border border-primary-foreground/20 rounded-lg px-4 py-2">
                      {errorMessage}
                    </p>
                  )}
                </form>
              )}

              <p className="text-primary-foreground/70 text-sm">
                Join 2,000+ distributed teams
              </p>
            </div>
          </div>

          {/* Right column - Product image */}
          <div className="relative lg:order-last order-first">
            <div className="relative animate-float">
              <img
                src="https://pub-c86c1f6b5aeb47bb9c3561a5c2ef2c76.r2.dev/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Calendar scheduling interface"
                className="w-full h-auto rounded-2xl shadow-2xl transform hover:scale-[1.02] transition-transform duration-500"
              />
              {/* Glow effect behind image */}
              <div className="absolute inset-0 bg-primary-foreground/10 rounded-2xl blur-2xl transform scale-95 -z-10" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
