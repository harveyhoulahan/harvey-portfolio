# Harvey J. Houlahan - Portfolio Website

A modern, dark-themed portfolio website built with Next.js 14, TypeScript, Tailwind CSS, and Framer Motion.

## 🚀 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 📦 Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Project Structure

```
harvey-portfolio/
├── app/                    # Next.js app directory
│   ├── about/             # About page
│   ├── contact/           # Contact page
│   ├── experience/        # Experience page
│   ├── projects/          # Projects page
│   ├── skills/            # Skills page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # Reusable components
│   ├── ExperienceCard.tsx
│   ├── Footer.tsx
│   ├── Hero.tsx
│   ├── Navbar.tsx
│   ├── ProjectCard.tsx
│   └── SectionTitle.tsx
├── data/                  # Content data files
│   ├── experience.ts
│   ├── projects.ts
│   └── skills.ts
└── public/               # Static assets
    └── resume.pdf        # Resume file
```

## ✏️ Updating Content

All content is centralized in the `/data` directory for easy updates:

- **Experience**: Edit `/data/experience.ts`
- **Projects**: Edit `/data/projects.ts`
- **Skills**: Edit `/data/skills.ts`

Simply modify the TypeScript objects to update the content across the site.

## 🎨 Customization

### Colors
Update the color scheme in `tailwind.config.ts`:
```typescript
colors: {
  background: "#0a0a0a",
  foreground: "#fafafa",
  border: "#27272a",
  accent: "#3b82f6",
}
```

### Typography
Modify typography in `app/globals.css` under the `@layer base` section.

## 📝 Build for Production

```bash
npm run build
npm start
```

## 🚢 Deployment

This project can be deployed to:
- **Vercel** (recommended for Next.js)
- **Netlify**
- **AWS Amplify**
- Any platform supporting Next.js

### Vercel Deployment
```bash
vercel
```

## 📄 Resume

Add your resume PDF to `/public/resume.pdf` to make it downloadable from the site.

## 📧 Contact Form

The contact form currently uses a simulated submission. To integrate a real form:

1. **Formspree**: Add your Formspree endpoint
2. **Email.js**: Integrate Email.js
3. **API Route**: Create a Next.js API route with your email service

## 🌟 Features

- ✅ Dark mode first design
- ✅ Fully responsive
- ✅ Smooth animations with Framer Motion
- ✅ SEO optimized
- ✅ TypeScript for type safety
- ✅ Easy content management
- ✅ Apple-level polish and design
- ✅ Accessible components

## 📱 Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🔧 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 📄 License

© 2025 Harvey J. Houlahan. All rights reserved.
