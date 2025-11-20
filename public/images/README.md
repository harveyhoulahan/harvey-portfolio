# Portfolio Images

Add your images to this directory:

- `portrait.jpg` - Professional portrait for About page
- `hero-bg.jpg` - Optional hero background image
- `project-*.jpg` - Project screenshots

Images can be referenced in components using Next.js Image component:

```tsx
import Image from "next/image";

<Image 
  src="/images/portrait.jpg" 
  alt="Harvey Houlahan"
  width={500}
  height={500}
/>
```
