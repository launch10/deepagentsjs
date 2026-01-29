import { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import {
  HomeIcon,
  RocketLaunchIcon,
  Cog8ToothIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { NewProjectButton } from "./NewProjectButton";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { label: "Projects", href: "/projects/new", icon: RocketLaunchIcon },
];

export default function AppSidebar() {
  const { url } = usePage();
  const [isCollapsed, setIsCollapsed] = useState(() => url !== "/");

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return url === "/dashboard";
    }
    if (href === "/projects/new") {
      return url === "/projects/new" || url.startsWith("/projects/");
    }
    return url.startsWith(href);
  };

  return (
    <aside
      style={{
        backgroundColor: "#12183d",
        width: isCollapsed ? 72 : 220,
        minWidth: isCollapsed ? 72 : 220,
      }}
      className="h-screen flex flex-col transition-all duration-300 sticky top-0 shrink-0"
    >
      {/* Collapse button */}
      <div className={twMerge("p-4 flex", isCollapsed ? "justify-center" : "justify-end")}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white hover:opacity-70 transition-opacity"
        >
          <ArrowRightStartOnRectangleIcon
            className={twMerge("w-6 h-6", !isCollapsed && "rotate-180")}
          />
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
      <div className={twMerge("p-6", isCollapsed && "p-4 flex justify-center")}>
        <NewProjectButton isCollapsed={isCollapsed} />
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
              className={twMerge(
                "flex items-center gap-3 px-6 py-3 font-sans relative transition-colors",
                active ? "text-secondary-500" : "text-white hover:bg-white/10",
                isCollapsed && "justify-center px-0"
              )}
            >
              <Icon className="w-6 h-6 shrink-0" strokeWidth={1.5} />
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
      <div className={twMerge("p-6", isCollapsed && "p-4 flex justify-center")}>
        <Link
          href="/settings"
          className={twMerge(
            "flex items-center gap-3 text-white font-sans",
            isCollapsed && "justify-center"
          )}
        >
          <Cog8ToothIcon className="w-6 h-6 shrink-0" strokeWidth={1.5} />
          {!isCollapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
