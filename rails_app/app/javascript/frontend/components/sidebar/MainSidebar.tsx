import { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import {
  Plus,
  Rocket,
  Megaphone,
  UserPlus,
  BarChart3,
  Settings,
  ArrowLeftFromLine,
  ArrowRightFromLine,
} from "lucide-react";
import { twMerge } from "tailwind-merge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Projects", href: "/", icon: Rocket },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Leads", href: "/leads", icon: UserPlus },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

interface MainSidebarProps {
  defaultCollapsed?: boolean;
}

export default function MainSidebar({ defaultCollapsed = false }: MainSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { url } = usePage();

  const isActive = (href: string) => {
    if (href === "/") {
      return url === "/" || url.startsWith("/projects");
    }
    return url.startsWith(href);
  };

  return (
    <aside
      style={{ backgroundColor: "#12183d" }}
      className={twMerge(
        "h-screen flex flex-col transition-all duration-300 sticky top-0",
        isCollapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Collapse button */}
      <div className="p-4 flex justify-end">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white hover:opacity-70 transition-opacity"
        >
          {isCollapsed ? (
            <ArrowRightFromLine className="w-6 h-6" />
          ) : (
            <ArrowLeftFromLine className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Divider below collapse button */}
      <div
        className="h-px"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          marginLeft: "1px",
          marginRight: "1px",
        }}
      />

      {/* New Project button */}
      <div className="p-6">
        <Link
          href="/projects/new"
          className={twMerge(
            "flex items-center gap-3 text-white font-sans",
            isCollapsed && "justify-center"
          )}
        >
          <span className="flex items-center justify-center w-6 h-6 bg-white rounded-full">
            <Plus className="w-4 h-4" style={{ color: "#12183d" }} strokeWidth={2.5} />
          </span>
          {!isCollapsed && <span>New Project</span>}
        </Link>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={active ? { backgroundColor: "#2e3c99" } : undefined}
              className={twMerge(
                "flex items-center gap-3 px-6 py-3 text-white font-sans relative transition-colors",
                !active && "hover:bg-white/10",
                isCollapsed && "justify-center px-0"
              )}
            >
              {/* Active indicator - 4px orange bar */}
              {active && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: "#df6d4a" }}
                />
              )}
              <Icon className="w-6 h-6" strokeWidth={1.5} />
              {!isCollapsed && <span className={active ? "font-semibold" : ""}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Divider above Settings */}
      <div
        className="h-px"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          marginLeft: "1px",
          marginRight: "1px",
        }}
      />

      {/* Settings */}
      <div className="p-6">
        <Link
          href="/settings"
          className={twMerge(
            "flex items-center gap-3 text-white font-sans",
            isCollapsed && "justify-center"
          )}
        >
          <Settings className="w-6 h-6" strokeWidth={1.5} />
          {!isCollapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
