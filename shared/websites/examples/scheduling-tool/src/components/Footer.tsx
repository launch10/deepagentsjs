export function Footer() {
  return (
    <footer className="bg-primary py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Logo and Brand */}
          <div className="flex flex-col items-center space-y-3">
            <img 
              src="https://r2-upload.launch10.workers.dev/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
              alt="Launch10 Logo" 
              className="h-12 w-12 rounded-full"
            />
            <div>
              <h3 className="text-xl font-semibold text-primary-foreground">
                Launch10
              </h3>
              <p className="text-sm text-primary-foreground/80 mt-1">
                Scheduling made simple
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full max-w-md h-px bg-primary-foreground/20"></div>

          {/* Copyright */}
          <p className="text-sm text-primary-foreground/70">
            © 2024 Launch10. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
