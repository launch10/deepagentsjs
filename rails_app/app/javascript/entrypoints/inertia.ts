import { createInertiaApp } from '@inertiajs/react'
import { createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppLayout } from '../frontend/layouts/app'

// Import global styles here for Vite to process
import 'virtual:uno.css';
import '@unocss/reset/tailwind-compat.css';
import '@styles/index.scss';
import '@xterm/xterm/css/xterm.css';
import 'react-toastify/dist/ReactToastify.css';

// Temporary type definition, until @inertiajs/react provides one
type ResolvedComponent = {
  default: ReactNode
  layout?: (page: ReactNode) => ReactNode
}

const appName = "NicheFinder";

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    const pages = import.meta.glob<ResolvedComponent>('../frontend/pages/**/*.tsx', {
      eager: true,
    })
    const page = pages[`../frontend/pages/${name}.tsx`]
    if (!page) {
      console.error(`Missing Inertia page component: '${name}.tsx'`)
    }

    page.default.layout ||= (page) => createElement(AppLayout, null, page)

    return page
  },
  setup({ el, App, props }) {
    if (el) {
      console.log(`hello`)
      console.log(props.initialPage.props)
      createRoot(el).render(createElement(App, props))
    } else {
      console.error(
        'Missing root element.\n\n' +
          'If you see this error, it probably means you load Inertia.js on non-Inertia pages.\n' +
          'Consider moving <%= vite_typescript_tag "inertia" %> to the Inertia-specific layout instead.',
      )
    }
  },
  progress: {
    color: '#4B5563',
    showSpinner: true,
  },
})
