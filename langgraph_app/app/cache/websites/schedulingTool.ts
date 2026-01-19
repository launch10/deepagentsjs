import { Website } from "@types";

const now = new Date().toISOString();

export const schedulingToolFiles: Website.FileMap = {
  "/index.html": {
    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ScheduleFlow - Smart Scheduling Made Simple</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <nav class="navbar">
        <div class="container">
            <div class="logo">ScheduleFlow</div>
            <div class="nav-links">
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
                <a href="#" class="btn btn-primary">Get Started</a>
            </div>
        </div>
    </nav>

    <header class="hero">
        <div class="container">
            <h1>Smart Scheduling Made Simple</h1>
            <p class="hero-subtitle">Stop the back-and-forth emails. Let your clients book meetings when it works for both of you.</p>
            <div class="hero-cta">
                <a href="#" class="btn btn-primary btn-lg">Start Free Trial</a>
                <a href="#" class="btn btn-secondary btn-lg">Watch Demo</a>
            </div>
        </div>
    </header>

    <section id="features" class="features">
        <div class="container">
            <h2>Everything you need to schedule smarter</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">📅</div>
                    <h3>Calendar Sync</h3>
                    <p>Automatically syncs with Google Calendar, Outlook, and iCal to show your real availability.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔗</div>
                    <h3>Custom Booking Links</h3>
                    <p>Share your personalized link and let clients pick a time that works.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔔</div>
                    <h3>Smart Reminders</h3>
                    <p>Automated email and SMS reminders reduce no-shows by 90%.</p>
                </div>
            </div>
        </div>
    </section>

    <section id="pricing" class="pricing">
        <div class="container">
            <h2>Simple, transparent pricing</h2>
            <div class="pricing-grid">
                <div class="pricing-card">
                    <h3>Starter</h3>
                    <div class="price">$0<span>/month</span></div>
                    <ul>
                        <li>1 calendar connection</li>
                        <li>Unlimited bookings</li>
                        <li>Email reminders</li>
                    </ul>
                    <a href="#" class="btn btn-secondary">Get Started</a>
                </div>
                <div class="pricing-card featured">
                    <h3>Pro</h3>
                    <div class="price">$12<span>/month</span></div>
                    <ul>
                        <li>Unlimited calendars</li>
                        <li>SMS reminders</li>
                        <li>Team scheduling</li>
                        <li>Custom branding</li>
                    </ul>
                    <a href="#" class="btn btn-primary">Start Free Trial</a>
                </div>
            </div>
        </div>
    </section>

    <footer class="footer">
        <div class="container">
            <p>&copy; 2024 ScheduleFlow. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`,
    created_at: now,
    modified_at: now,
  },
  "/styles.css": {
    content: `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Navbar */
.navbar {
    background: white;
    padding: 1rem 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 1000;
}

.navbar .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: #6366f1;
}

.nav-links {
    display: flex;
    gap: 2rem;
    align-items: center;
}

.nav-links a {
    text-decoration: none;
    color: #666;
    transition: color 0.3s;
}

.nav-links a:hover {
    color: #6366f1;
}

/* Buttons */
.btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.3s;
    cursor: pointer;
    border: none;
}

.btn-primary {
    background: #6366f1;
    color: white;
}

.btn-primary:hover {
    background: #4f46e5;
}

.btn-secondary {
    background: #f3f4f6;
    color: #333;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

.btn-lg {
    padding: 1rem 2rem;
    font-size: 1.1rem;
}

/* Hero */
.hero {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 8rem 0 6rem;
    text-align: center;
    margin-top: 60px;
}

.hero h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.hero-subtitle {
    font-size: 1.25rem;
    opacity: 0.9;
    max-width: 600px;
    margin: 0 auto 2rem;
}

.hero-cta {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.hero-cta .btn-secondary {
    background: rgba(255,255,255,0.2);
    color: white;
}

.hero-cta .btn-secondary:hover {
    background: rgba(255,255,255,0.3);
}

/* Features */
.features {
    padding: 5rem 0;
    background: #f9fafb;
}

.features h2 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 3rem;
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.feature-card {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    text-align: center;
}

.feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.feature-card h3 {
    margin-bottom: 0.5rem;
    color: #333;
}

.feature-card p {
    color: #666;
}

/* Pricing */
.pricing {
    padding: 5rem 0;
}

.pricing h2 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 3rem;
}

.pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    max-width: 800px;
    margin: 0 auto;
}

.pricing-card {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    border: 2px solid #e5e7eb;
    text-align: center;
}

.pricing-card.featured {
    border-color: #6366f1;
    transform: scale(1.05);
}

.pricing-card h3 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
}

.price {
    font-size: 3rem;
    font-weight: bold;
    color: #6366f1;
    margin-bottom: 1.5rem;
}

.price span {
    font-size: 1rem;
    color: #666;
}

.pricing-card ul {
    list-style: none;
    margin-bottom: 2rem;
}

.pricing-card li {
    padding: 0.5rem 0;
    color: #666;
}

/* Footer */
.footer {
    background: #1f2937;
    color: #9ca3af;
    padding: 2rem 0;
    text-align: center;
}`,
    created_at: now,
    modified_at: now,
  },
};
