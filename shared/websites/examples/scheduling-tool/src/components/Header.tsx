import React from 'react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center space-x-2">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
                alt="Logo" 
                className="h-8 w-auto"
              />
            </a>
          </div>

          {/* CTA Button */}
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => {
                const heroSection = document.getElementById('hero');
                heroSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
