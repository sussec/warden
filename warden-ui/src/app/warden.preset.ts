import {definePreset} from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Warden brand preset — Techanv design tokens.
 * Primary: copper  oklch(0.6716 0.1368 48.51) light / oklch(0.7214 0.1337 49.98) dark
 * Secondary: muted teal oklch(0.536 0.0398 196)
 * Radius: 0.75rem base. Surfaces: gray (light) / near-black neutral (dark).
 */
export const WardenPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: '8px',
      md: '10px',
      lg: '12px',
      xl: '16px'
    },
    copper: {
      50: '#fff2eb',
      100: '#ffe4d4',
      200: '#ffcbaf',
      300: '#f5a981',
      400: '#e78a53',
      500: '#d87943',
      600: '#bd6533',
      700: '#9b522c',
      800: '#7e4327',
      900: '#653723',
      950: '#3a1e12'
    },
    teal: {
      50: '#eef7f7',
      100: '#d9ecec',
      200: '#bfdbdb',
      300: '#9ac0c0',
      400: '#7ba4a4',
      500: '#5f8787',
      600: '#527575',
      700: '#415e5e',
      800: '#324a4a',
      900: '#263a3a',
      950: '#112020'
    }
  },
  semantic: {
    primary: {
      50: '{copper.50}',
      100: '{copper.100}',
      200: '{copper.200}',
      300: '{copper.300}',
      400: '{copper.400}',
      500: '{copper.500}',
      600: '{copper.600}',
      700: '{copper.700}',
      800: '{copper.800}',
      900: '{copper.900}',
      950: '{copper.950}'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712'
        },
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}'
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.700}',
          focusColor: '{primary.800}'
        }
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f6f6f6',
          100: '#ececec',
          200: '#d9d9d9',
          300: '#c1c1c1',
          400: '#8a8a8a',
          500: '#626262',
          600: '#444444',
          700: '#333333',
          800: '#222222',
          900: '#161516',
          950: '#121113'
        },
        primary: {
          color: '{primary.400}',
          contrastColor: '{surface.950}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}'
        },
        highlight: {
          background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
          focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
          color: 'rgba(255,255,255,.87)',
          focusColor: 'rgba(255,255,255,.87)'
        }
      }
    }
  }
});
