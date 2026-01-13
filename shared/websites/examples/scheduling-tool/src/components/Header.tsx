import React from 'react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img 
            src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
            alt="Logo" 
            className="h-8 w-auto"
          />
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#social-proof" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Why Us
          </a>
          <Button asChild size="sm">
            <a href="#hero">Get Started</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
