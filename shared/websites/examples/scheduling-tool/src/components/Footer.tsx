import React from 'react';
import { Globe, Mail, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-12 md:py-16 border-t border-primary-foreground/10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-4 gap-8 md:gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="Logo" 
              className="h-10 w-auto mb-4"
            />
            <p className="text-primary-foreground/80 leading-relaxed max-w-md">
              The scheduling tool that actually understands time zones—so you don't have to.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-bold text-lg mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <a href="#features" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#testimonials" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Testimonials
                </a>
              </li>
              <li>
                <a href="#cta" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Get Started
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-bold text-lg mb-4">Connect</h3>
            <div className="flex gap-4">
              <a 
                href="#" 
                className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href="#" 
                className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a 
                href="#" 
                className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-primary-foreground/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-primary-foreground/60">
            © {new Date().getFullYear()} All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary-foreground/60">
            <Globe className="w-4 h-4" />
            <span>Scheduling made simple for distributed teams worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
