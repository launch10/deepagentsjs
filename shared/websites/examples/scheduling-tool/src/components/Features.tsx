import { Globe, Calendar, MousePointerClick, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Globe,
    title: "Timezone Intelligence Built-In",
    description:
      "Our AI understands that 9 AM in New York is midnight in Tokyo. It automatically suggests times that respect everyone's working hours—no mental math required.",
  },
  {
    icon: Calendar,
    title: "One-Click Calendar Sync",
    description:
      "Connect Google Calendar, Outlook, or iCal in seconds. We read availability in real-time so you're never double-booked or suggesting impossible times.",
  },
  {
    icon: MousePointerClick,
    title: "Instant Team Consensus",
    description:
      "Share a smart link and let your team vote on times that work. Everyone clicks once, and the best slot wins. Meeting scheduled in minutes, not days.",
  },
  {
    icon: Clock,
    title: "15 Hours Saved Weekly",
    description:
      "Stop playing calendar Tetris. Teams using our tool cut scheduling coordination by 80%—that's time back for actual work that matters.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Everything You Need to Schedule Smarter
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built for distributed teams who value their time
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
