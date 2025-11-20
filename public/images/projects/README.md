# Project Images Guide

Add your project screenshots to this directory to showcase your work in the portfolio gallery.

## 📁 Recommended Structure

```
/public/images/projects/
├── modaics/
│   ├── modaics-dashboard.png
│   ├── modaics-ai-styling.png
│   └── modaics-mobile.png
├── agriq/
│   ├── agriq-dashboard.png
│   ├── agriq-predictions.png
│   └── agriq-analytics.png
├── fibretrace/
│   ├── fibretrace-app.png
│   ├── fibretrace-scanning.png
│   └── fibretrace-verification.png
└── other-projects/
    └── ...
```

## 🖼️ Image Specifications

### Aspect Ratio
- **16:9** (recommended for gallery consistency)
- Examples: 1600x900px, 1920x1080px, 800x450px

### Format
- **PNG**: For UI screenshots with transparency
- **WebP**: Best compression for modern browsers
- **JPEG**: For photographic content (80-90% quality)

### File Size
- Aim for **< 500KB** per image
- Use tools like TinyPNG, Squoosh, or ImageOptim

## 📸 What to Screenshot

### For Each Project, Include:

1. **Hero Shot** - Main dashboard/interface
   - Clean, no sensitive data
   - Show the primary value proposition
   
2. **Key Features** - 2-3 feature highlights
   - Modaics: AI styling interface, wardrobe view
   - AgrIQ: Prediction models, analytics dashboard
   - FibreTrace: QR scanning, verification flow

3. **Mobile Views** (if applicable)
   - Responsive design
   - iOS app screenshots

4. **Data Visualization** (for data-heavy projects)
   - Charts, graphs, metrics
   - Use real or realistic mock data

## 🎨 Screenshot Best Practices

### Do ✅
- Use high-resolution displays (Retina)
- Clean browser chrome (or hide it)
- Realistic demo data
- Show the app in action
- Include UI states (loading, success, etc.)
- Use consistent window sizes

### Don't ❌
- Include sensitive user data
- Show error states (unless intentional)
- Use Lorem Ipsum text
- Include your desktop background
- Screenshot at odd resolutions

## 🔄 Updating Image References

After adding your images, update `/data/project-images.ts`:

```typescript
export const projectImages = [
  {
    src: "/images/projects/modaics/modaics-dashboard.png",
    alt: "Modaics - Digital Wardrobe Platform",
    title: "Modaics",
    project: "modaics",
  },
  {
    src: "/images/projects/agriq/agriq-dashboard.png",
    alt: "AgrIQ - Livestock Intelligence Dashboard",
    title: "AgrIQ",
    project: "agriq",
  },
  // ... more images
];
```

## 🚀 Quick Screenshot Tools

### macOS
- **Cmd + Shift + 4**: Area selection
- **Cmd + Shift + 5**: Screenshot menu
- **CleanShot X**: Professional screenshot app

### Windows
- **Win + Shift + S**: Snipping tool
- **ShareX**: Free screenshot utility

### Browser Extensions
- **Full Page Screen Capture**: For long pages
- **Awesome Screenshot**: Annotations

## 🎯 Example Screenshots Per Project

### Modaics (Fashion Tech)
- Digital wardrobe grid view
- AI styling recommendation interface
- Item detail with community styling
- Mobile app browse experience

### AgrIQ (AgTech ML)
- Livestock dashboard overview
- Pregnancy prediction interface (94% accuracy callout)
- Health index visualization
- Multi-species data views

### FibreTrace (Supply Chain)
- Product passport interface
- QR/NFC scanning flow
- Chain-of-custody timeline
- Anomaly detection alerts

### Step One (E-commerce)
- Semantic search interface
- Product discovery experience
- Navigation redesign

### Friday Technologies (AI/ML)
- CoreML prototypes
- VisionOS demos
- LLM evaluation tools

## 📐 Canvas Size Template

Use this Figma/Sketch template for consistent mockups:
- **Desktop**: 1440 x 900px
- **Tablet**: 834 x 1194px
- **Mobile**: 375 x 812px

## 🔍 SEO Tips

### File Naming
```
✅ modaics-dashboard-ai-styling.png
❌ Screenshot 2024-03-15 at 3.45.12 PM.png
```

### Alt Text (in project-images.ts)
```typescript
alt: "Modaics dashboard showing AI-powered outfit recommendations"
// Not just: "Modaics"
```

## 📦 Next.js Image Optimization

The portfolio uses Next.js Image component, which automatically:
- ✅ Optimizes image size
- ✅ Lazy loads images
- ✅ Serves WebP when supported
- ✅ Responsive image sizing

No additional optimization needed in most cases!

---

**Need Help?**
Placeholder images are already set up using Unsplash. Replace them with your actual project screenshots whenever ready!
