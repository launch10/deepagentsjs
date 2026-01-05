import { createInertiaApp } from "@inertiajs/react";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
// import { AppLayout } from '../frontend/layouts/app'
import { SiteLayout } from "../frontend/layouts/site-layout";

// Import global styles here for Vite to process
import "@styles/index.scss";
import "@xterm/xterm/css/xterm.css";
import "react-toastify/dist/ReactToastify.css";

// Temporary type definition, until @inertiajs/react provides one
type PageComponent = React.ComponentType & {
  layout?: (page: ReactNode) => ReactNode;
};

type ResolvedComponent = {
  default: PageComponent;
  layout?: (page: ReactNode) => ReactNode;
};

const appName = "Launch10";

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    const pages = import.meta.glob<ResolvedComponent>("../frontend/pages/**/*.tsx", {
      eager: true,
    });
    const page = pages[`../frontend/pages/${name}.tsx`];
    if (!page) {
      console.error(`Missing Inertia page component: '${name}.tsx'`);
    }

    if (page?.default) {
      page.default.layout ||= (p: ReactNode) => createElement(SiteLayout, null, p);
    }

    return page;
  },
  setup({ el, App, props }) {
    if (el) {
      createRoot(el).render(createElement(App, props));
    } else {
      console.error(
        "Missing root element.\n\n" +
          "If you see this error, it probably means you load Inertia.js on non-Inertia pages.\n" +
          'Consider moving <%= vite_typescript_tag "inertia" %> to the Inertia-specific layout instead.'
      );
    }
  },
  progress: {
    color: "#4B5563",
    showSpinner: true,
  },
});
