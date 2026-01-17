import React from 'react';
import { Button } from '@/components/ui/button';

export function Header() {
  const scrollToSignup = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const signupSection = document.getElementById('signup');
    if (signupSection) {
      signupSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border shadow-sm transition-all">
      <div className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center transition-opacity hover:opacity-80">
            <img
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png"
              alt="Logo"
              className="h-10 w-auto"
            />
          </a>

          {/* CTA Button */}
          <a href="#signup" onClick={scrollToSignup}>
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Get Started Free
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
