import React from 'react';
import { Calendar, Mail, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
                alt="Logo" 
                className="h-8 w-auto"
              />
            </div>
            <p className="text-[#E9C46A] max-w-md leading-relaxed">
              The scheduling tool that actually understands time zones—so you don't have to.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-[#FAFAFA] mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-[#E9C46A] hover:text-[#F4A261] transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-[#E9C46A] hover:text-[#F4A261] transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#testimonials" className="text-[#E9C46A] hover:text-[#F4A261] transition-colors">
                  Testimonials
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-[#FAFAFA] mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-[#E9C46A] hover:text-[#F4A261] transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="text-[#E9C46A] hover:text-[#F4A261] transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="text-[#E9C46A] hover:text-[#F4A261] transition-colors">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#E9C46A]/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#E9C46A]/80">
            © 2024 All rights reserved. Built for distributed teams who value their time.
          </p>

          <div className="flex items-center gap-4">
            <a 
              href="#" 
              className="w-10 h-10 bg-[#E9C46A]/10 hover:bg-[#E9C46A]/20 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5 text-[#E9C46A]" />
            </a>
            <a 
              href="#" 
              className="w-10 h-10 bg-[#E9C46A]/10 hover:bg-[#E9C46A]/20 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5 text-[#E9C46A]" />
            </a>
            <a 
              href="#" 
              className="w-10 h-10 bg-[#E9C46A]/10 hover:bg-[#E9C46A]/20 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              aria-label="Email"
            >
              <Mail className="w-5 h-5 text-[#E9C46A]" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
