# 🚀 Quick Start Guide

## Get Started in 3 Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Your Browser
Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📝 Next Steps

### Customize Your Content

1. **Update Experience**
   - Edit `data/experience.ts`
   - Add/remove positions as needed

2. **Update Projects**
   - Edit `data/projects.ts`
   - Add project links and GitHub repos

3. **Update Skills**
   - Edit `data/skills.ts`
   - Organize by categories

4. **Add Your Resume**
   - Replace `public/resume.txt` with your `resume.pdf`

5. **Add Images**
   - Add professional portrait to `public/images/`
   - Update About page to reference it

6. **Update Links**
   - Add LinkedIn URL in `components/Footer.tsx`
   - Add GitHub URL if desired
   - Update email if needed

### Customize Design

- **Colors**: `tailwind.config.ts`
- **Fonts**: `app/layout.tsx`
- **Animations**: Adjust Framer Motion variants in components

---

## 🚢 Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Connect repo to Vercel
3. Deploy automatically

Or use Vercel CLI:
```bash
npm install -g vercel
vercel
```

---

## 📧 Setup Contact Form

Replace the simulated form in `app/contact/page.tsx`:

**Option 1: Formspree**
```tsx
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

**Option 2: Create API Route**
Create `app/api/contact/route.ts` and integrate your email service.

---

## ✨ Features Included

✅ Fully responsive design  
✅ Dark mode optimized  
✅ Smooth animations  
✅ SEO ready  
✅ TypeScript  
✅ Easy content updates  
✅ Production ready  

---

## 🆘 Need Help?

- Check `README.md` for full documentation
- All content is in `/data` folder
- Components are in `/components` folder
- Pages are in `/app` folder

Enjoy your new portfolio! 🎉
