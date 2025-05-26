
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				"background": 'hsl(var(--background))',
				"background-foreground": 'hsl(var(--background-foreground))',
				"background-foreground-muted": 'hsl(var(--background-foreground-muted))',
				"foreground": 'hsl(var(--foreground))',

				"primary": 'hsl(var(--primary))',
				"primary-foreground": 'hsl(var(--primary-foreground))',
				"primary-foreground-muted": 'hsl(var(--primary-foreground-muted))',

				"secondary": 'hsl(var(--secondary))',
				"secondary-foreground": 'hsl(var(--secondary-foreground))',
				"secondary-foreground-muted": 'hsl(var(--secondary-foreground-muted))',

				"neutral": 'hsl(var(--neutral))',
				"neutral-foreground": 'hsl(var(--neutral-foreground))',
				"neutral-foreground-muted": 'hsl(var(--neutral-foreground-muted))',

				"card": 'hsl(var(--card))',
				"card-foreground": 'hsl(var(--card-foreground))',
				"card-foreground-muted": 'hsl(var(--card-foreground-muted))',

				"popover": 'hsl(var(--popover))',
				"popover-foreground": 'hsl(var(--popover-foreground))',
				"popover-foreground-muted": 'hsl(var(--popover-foreground-muted))',

				"muted": 'hsl(var(--muted))',
				"muted-foreground": 'hsl(var(--muted-foreground))',
				"muted-foreground-muted": 'hsl(var(--muted-foreground-muted))',

				"accent": 'hsl(var(--accent))',
				"accent-foreground": 'hsl(var(--accent-foreground))',
				"accent-foreground-muted": 'hsl(var(--accent-foreground-muted))',

				"input": 'hsl(var(--input))',
				"border": 'hsl(var(--border))',
				"ring": 'hsl(var(--ring))',
				"ring-foreground": 'hsl(var(--ring-foreground))',
				"ring-foreground-muted": 'hsl(var(--ring-foreground-muted))',

				"success": 'hsl(var(--success))',
				"success-foreground": 'hsl(var(--success-foreground))',
				"success-foreground-muted": 'hsl(var(--success-foreground-muted))',

				"warning": 'hsl(var(--warning))',
				"warning-foreground": 'hsl(var(--warning-foreground))',
				"warning-foreground-muted": 'hsl(var(--warning-foreground-muted))',

				"destructive": 'hsl(var(--destructive))',
				"destructive-foreground": 'hsl(var(--destructive-foreground))',
				"destructive-foreground-muted": 'hsl(var(--destructive-foreground-muted))',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' }
                },
                'subtle-float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' }
                },
                'pulse-subtle': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.8' }
                },
                'slide-up': {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                'zoom-in': {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' }
                },
                'spin-slow': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                },
                'rocket-launch': {
                    '0%': { transform: 'translateY(0) scale(1)' },
                    '50%': { transform: 'translateY(-15px) scale(1.05)' },
                    '100%': { transform: 'translateY(-60px) scale(0.9)', opacity: '0' }
                }
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
                'float': 'float 5s ease-in-out infinite',
                'subtle-float': 'subtle-float 6s ease-in-out infinite',
                'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
                'slide-up': 'slide-up 0.5s ease-out',
                'fade-in': 'fade-in 0.6s ease-out',
                'zoom-in': 'zoom-in 0.5s cubic-bezier(0.2, 0.7, 0.4, 1)',
                'spin-slow': 'spin-slow 10s linear infinite',
                'rocket-launch': 'rocket-launch 1.5s ease-in forwards'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
