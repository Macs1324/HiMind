# UI Design Specification

## Overview

This document outlines the design system, patterns, and guidelines for the HiMind application UI. All developers and AI models should follow these specifications when building new features or modifying existing components.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Layout System](#layout-system)
4. [Component Architecture](#component-architecture)
5. [Responsive Design](#responsive-design)
6. [Accessibility Guidelines](#accessibility-guidelines)
7. [Development Guidelines](#development-guidelines)
8. [Component Patterns](#component-patterns)

---

## Design Principles

### Core Values
- **Mobile-First**: All designs start from mobile breakpoints and scale up
- **Accessibility**: WCAG 2.1 AA compliance for all interactive elements
- **Performance**: Minimal bundle size, optimal loading, no layout shifts
- **Consistency**: Uniform patterns across all components and pages
- **Maintainability**: Clean, modular, production-ready code

### Visual Design
- **Minimalist**: Clean interfaces with purposeful use of whitespace
- **Professional**: Subtle shadows, consistent spacing, refined typography
- **Functional**: Every element serves a clear purpose

---

## Color System

### Nord Color Palette
We use the [Nord color palette](https://www.nordtheme.com/) for consistent, professional theming.

#### Light Theme Colors
```css
/* Backgrounds */
--background: #eceff4;     /* nord6 - Snow Storm */
--card: #e5e9f0;          /* nord5 */
--secondary: #d8dee9;     /* nord4 */

/* Foregrounds */
--foreground: #2e3440;    /* nord0 - Polar Night */
--muted-foreground: #4c566a; /* nord3 */

/* Accents */
--primary: #5e81ac;       /* nord10 - Frost */
--accent: #88c0d0;        /* nord8 - Frost */
--destructive: #bf616a;   /* nord11 - Aurora Red */
```

#### Dark Theme Colors
```css
/* Backgrounds */
--background: #2e3440;    /* nord0 - Polar Night */
--card: #3b4252;         /* nord1 */
--secondary: #434c5e;    /* nord2 */

/* Foregrounds */
--foreground: #eceff4;   /* nord6 - Snow Storm */
--muted-foreground: #8fbcbb; /* nord7 - Frost */

/* Accents */
--primary: #88c0d0;      /* nord8 - Frost */
--accent: #a3be8c;       /* nord14 - Aurora Green */
--destructive: #bf616a;  /* nord11 - Aurora Red */
```

#### Color Usage Rules
1. **Never hardcode colors** - Always use CSS variables
2. **Maintain contrast ratios** - Ensure 4.5:1 minimum for text
3. **Use semantic naming** - `primary`, `secondary`, `accent`, `destructive`
4. **Test both themes** - All components must work in light and dark modes

---

## Layout System

### App Shell Architecture
The application uses a consistent shell layout:

```
┌─────────────────────────────────┐
│            Header               │
├──────────┬──────────────────────┤
│          │                      │
│ Sidebar  │    Main Content      │
│          │                      │
│          │                      │
└──────────┴──────────────────────┘
```

#### Key Layout Rules
1. **Fixed Header**: Sticky positioned, 64px height
2. **Collapsible Sidebar**: 256px desktop, 288px mobile, overlay on mobile
3. **Fullscreen Application**: Uses `h-screen` and proper flex layouts
4. **No Body Overflow**: Scrolling contained within main content area
5. **Responsive Breakpoints**: Mobile-first with `sm:`, `md:`, `lg:` prefixes

### Spacing System
Use Tailwind's spacing scale consistently:

```css
/* Preferred spacing values */
gap-3 sm:gap-4          /* Component gaps */
px-3 sm:px-6 lg:px-8    /* Horizontal padding */
py-4 sm:py-6            /* Vertical padding */
space-y-6 sm:space-y-8  /* Vertical spacing between sections */
```

---

## Component Architecture

### File Structure
```
src/components/
├── layout/          # App shell components
│   ├── app-shell.tsx
│   ├── app-header.tsx
│   └── app-sidebar.tsx
├── dashboard/       # Page-specific components
│   ├── page-header.tsx
│   ├── stats-grid.tsx
│   └── content-grid.tsx
├── ui/             # Base UI components (shadcn)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── lightswitch.tsx
└── theme-provider.tsx
```

### Component Rules
1. **Use shadcn components** - Always prefer official shadcn components
2. **Single responsibility** - Each component has one clear purpose
3. **Composition over inheritance** - Build complex UIs by composing simple components
4. **TypeScript interfaces** - All props must be properly typed
5. **Forwardable refs** - Use `React.forwardRef` for interactive components

---

## Responsive Design

### Breakpoint Strategy
```css
/* Mobile-first breakpoints */
default:  320px+    /* Mobile phones */
sm:       640px+    /* Large phones / small tablets */
md:       768px+    /* Tablets */
lg:       1024px+   /* Small laptops */
xl:       1280px+   /* Large laptops */
2xl:      1536px+   /* Desktops */
```

### Responsive Patterns

#### Grid Systems
```tsx
/* Stats Grid */
className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4"

/* Content Grid */
className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2"

/* Form Grid */
className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
```

#### Typography
```tsx
/* Page Headers */
className="text-xl font-bold sm:text-2xl"

/* Descriptions */
className="text-sm text-muted-foreground sm:text-base"
```

#### Navigation
```tsx
/* Hide on mobile, show on desktop */
className="hidden sm:flex"

/* Show on mobile, hide on desktop */
className="sm:hidden"

/* Mobile-specific button sizing */
className="w-full sm:w-auto"
```

### Mobile-First Rules
1. **Start with mobile layout** - Design for 320px screens first
2. **Progressive enhancement** - Add complexity at larger breakpoints
3. **Touch-friendly targets** - 44px minimum touch targets
4. **Readable text** - 16px base font size minimum
5. **Simplified navigation** - Collapsible sidebar, mobile-specific patterns

---

## Accessibility Guidelines

### Required Standards
- **WCAG 2.1 AA compliance** for all interactive elements
- **Keyboard navigation** support for all interactive components
- **Screen reader compatibility** with proper ARIA labels
- **Color contrast** minimum 4.5:1 for normal text, 3:1 for large text

### Implementation Rules
```tsx
/* Always include screen reader text */
<span className="sr-only">Toggle menu</span>

/* Use semantic HTML */
<main>, <nav>, <header>, <aside>

/* Proper button labels */
<Button>
  <Plus className="mr-2 h-4 w-4" />
  <span>Create New Project</span>
</Button>

/* Form accessibility */
<Input 
  aria-label="Search projects"
  aria-describedby="search-help"
/>
```

---

## Development Guidelines

### Code Quality Standards
1. **TypeScript strict mode** - No `any` types, proper interface definitions
2. **ESLint compliance** - Follow project linting rules
3. **Component documentation** - JSDoc comments for complex components
4. **Performance optimization** - Use React.memo, useMemo, useCallback appropriately

### Naming Conventions
```tsx
/* Component names: PascalCase */
export function PageHeader() {}

/* Props interfaces: ComponentNameProps */
interface PageHeaderProps {
  title: string;
  description?: string;
}

/* CSS classes: kebab-case (handled by Tailwind) */
className="flex-col space-y-3"
```

### Import Organization
```tsx
/* React imports first */
import * as React from "react"

/* Third-party libraries */
import { useTheme } from "next-themes"
import { Plus, Search } from "lucide-react"

/* Internal components */
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

### Component Template
```tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ComponentNameProps {
  children: React.ReactNode
  className?: string
  // ... other props
}

export function ComponentName({ 
  children, 
  className,
  ...props 
}: ComponentNameProps) {
  return (
    <div 
      className={cn(
        "base-styles",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
```

---

## Component Patterns

### Layout Components

#### AppShell
```tsx
<AppShell>
  {/* Page content */}
</AppShell>
```
- Provides consistent header + sidebar + main content layout
- Handles responsive sidebar behavior
- Manages overflow and scrolling

#### PageHeader
```tsx
<PageHeader
  title="Page Title"
  description="Optional description"
>
  <Button>Action Button</Button>
</PageHeader>
```
- Consistent page title formatting
- Optional action buttons
- Responsive text sizing

### Content Layouts

#### StatsGrid
```tsx
<StatsGrid>
  <StatCard 
    title="Metric Name"
    value="1,234"
    trend={{ value: 12.5, positive: true }}
    icon={IconComponent}
  />
</StatsGrid>
```
- 1 column mobile, 2 tablet, 4 desktop
- Consistent metric display
- Trend indicators

#### ContentGrid
```tsx
<ContentGrid cols={2}>
  <Card>Content</Card>
  <Card>Content</Card>
</ContentGrid>
```
- Flexible column counts
- Responsive gap sizing
- Consistent card layouts

### Form Patterns

#### Search Input
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input 
    type="search" 
    placeholder="Search..." 
    className="pl-10" 
  />
</div>
```

#### Button Groups
```tsx
<div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
  <Button variant="default">Primary</Button>
  <Button variant="outline">Secondary</Button>
</div>
```

### Theme Integration

#### Lightswitch Component
```tsx
<Lightswitch />
```
- Automatic theme detection and persistence
- Smooth icon transitions
- Proper accessibility labels

#### Theme-Aware Components
```tsx
const { theme } = useTheme()

<div className={cn(
  "base-styles",
  theme === "dark" && "dark-specific-styles"
)}>
```

---

## Testing Requirements

### Component Testing
1. **Render tests** - Verify components render without errors
2. **Interaction tests** - Test click, keyboard, and focus behaviors
3. **Responsive tests** - Verify layout at different screen sizes
4. **Theme tests** - Test both light and dark themes
5. **Accessibility tests** - Automated a11y testing

### Visual Regression
1. **Screenshot tests** - Component visual consistency
2. **Cross-browser testing** - Chrome, Firefox, Safari, Edge
3. **Mobile device testing** - iOS Safari, Chrome Android

---

## Performance Guidelines

### Bundle Optimization
1. **Dynamic imports** - Lazy load non-critical components
2. **Tree shaking** - Import only used functions from libraries
3. **Image optimization** - Use Next.js Image component
4. **CSS-in-JS** - Use Tailwind for optimal CSS bundling

### Runtime Performance
1. **React.memo** - Prevent unnecessary re-renders
2. **useMemo/useCallback** - Optimize expensive calculations
3. **Virtualization** - For large lists (future consideration)
4. **Code splitting** - Route-based splitting

---

## Future Considerations

### Planned Enhancements
1. **Animation system** - Consistent micro-interactions
2. **Form components** - Advanced form handling with validation
3. **Data visualization** - Chart components for analytics
4. **Notification system** - Toast and alert components
5. **Advanced layouts** - Dashboard builder, drag-and-drop

### Extensibility
- Component slots for customization
- Plugin architecture for third-party integrations
- Theme customization system
- Component composition patterns

---

## Questions and Support

For questions about this specification or clarification on implementation details, refer to:
1. **Component examples** in `/src/components`
2. **Tailwind documentation** for styling utilities
3. **shadcn/ui documentation** for base components
4. **Nord theme colors** for color palette references

This specification should be updated as the design system evolves and new patterns are established.