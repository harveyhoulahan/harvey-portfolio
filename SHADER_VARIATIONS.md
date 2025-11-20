# Shader Hero Variations

The Professional Hero component supports different shader patterns. Here are the available options:

## 🎨 Available Shader Shapes

Edit `/components/ProfessionalHeroShaders.tsx` and change the `shape` prop to any of these:

### 1. **"wave"** (Current - Recommended)
```tsx
shape="wave"
```
**Best for**: Professional, dynamic feel  
**Vibe**: Flowing, continuous motion  
**Use case**: AI/ML engineer - represents data flow

### 2. **"ripple"**
```tsx
shape="ripple"
```
**Best for**: Impact, emanating energy  
**Vibe**: Concentric circles expanding  
**Use case**: Represents spreading influence/innovation

### 3. **"swirl"**
```tsx
shape="swirl"
```
**Best for**: Complexity, interconnection  
**Vibe**: Rotating, spiral patterns  
**Use case**: ML models, neural networks visualization

### 4. **"dots"**
```tsx
shape="dots"
```
**Best for**: Minimal, tech-focused  
**Vibe**: Data points, pixelated  
**Use case**: Data science, analytical work

### 5. **"simplex"**
```tsx
shape="simplex"
```
**Best for**: Organic, natural patterns  
**Vibe**: Perlin noise, flowing textures  
**Use case**: Cotton → AI journey (organic to digital)

### 6. **"sphere"**
```tsx
shape="sphere"
```
**Best for**: 3D depth, modern  
**Vibe**: Dimensional, globe-like  
**Use case**: Global perspective (Australia → NYC)

---

## 🎨 Color Customization

### Current Setup (Professional Red)
```tsx
colorBack="hsl(0, 0%, 4%)"      // Almost black
colorFront="hsl(0, 85%, 60%)"   // Professional red
```

### Alternative Color Schemes

#### Option 1: Blue (Brand Primary)
```tsx
colorBack="hsl(0, 0%, 4%)"
colorFront="hsl(217, 91%, 60%)"  // Blue #3b82f6
```

#### Option 2: Cyan (Brand Accent)
```tsx
colorBack="hsl(0, 0%, 4%)"
colorFront="hsl(189, 94%, 55%)"  // Cyan #22d3ee
```

#### Option 3: Blue→Cyan Gradient Effect
Use two shader layers (requires wrapper component)

#### Option 4: Subtle White (Minimal)
```tsx
colorBack="hsl(0, 0%, 4%)"
colorFront="hsl(0, 0%, 85%)"     // Subtle white
```

#### Option 5: Purple (Creative)
```tsx
colorBack="hsl(0, 0%, 4%)"
colorFront="hsl(280, 80%, 65%)"  // Purple
```

---

## ⚙️ Animation Speed

### Current: 0.08 (Subtle, professional)
```tsx
speed={0.08}
```

### Alternatives:
- **0.05**: Very slow, meditative
- **0.08**: Subtle, professional ✅ (current)
- **0.12**: Medium, noticeable
- **0.18**: Fast, energetic
- **0.25**: Very fast, dynamic

---

## 📏 Scale & Size

### Pixel Size (Dithering granularity)
```tsx
pxSize={2}  // Current: Fine detail
pxSize={3}  // Medium detail
pxSize={4}  // Chunky, retro
pxSize={1}  // Very fine (performance impact)
```

### Scale (Pattern size)
```tsx
scale={0.9}   // Current
scale={0.7}   // Zoomed in
scale={1.2}   // Zoomed out
```

---

## 🎯 Recommended Combinations

### Professional AI/ML Engineer (Current)
```tsx
shape="wave"
colorFront="hsl(0, 85%, 60%)"  // Red
speed={0.08}
pxSize={2}
```

### Data Scientist Minimal
```tsx
shape="dots"
colorFront="hsl(217, 91%, 60%)"  // Blue
speed={0.05}
pxSize={3}
```

### Creative Tech Innovation
```tsx
shape="swirl"
colorFront="hsl(189, 94%, 55%)"  // Cyan
speed={0.12}
pxSize={2}
```

### Cotton → Digital Journey
```tsx
shape="simplex"
colorFront="hsl(0, 85%, 60%)"  // Red
speed={0.08}
pxSize={2}
```

### Global Perspective (NYC)
```tsx
shape="sphere"
colorFront="hsl(217, 91%, 60%)"  // Blue
speed={0.10}
pxSize={2}
```

---

## 🔄 How to Change

1. Open `/components/ProfessionalHeroShaders.tsx`

2. Find the `<Dithering>` component (around line 146)

3. Change the props:
```tsx
<Dithering
  style={{ height: "100%", width: "100%" }}
  colorBack="hsl(0, 0%, 4%)"
  colorFront="hsl(0, 85%, 60%)"  // ← Change color here
  shape="wave"                    // ← Change shape here
  type="4x4"
  pxSize={2}                      // ← Change detail here
  scale={0.9}                     // ← Change size here
  speed={0.08}                    // ← Change speed here
/>
```

4. Save and refresh to see changes instantly

---

## 🎨 Pro Tips

1. **Match your brand**: Red works for professional impact, blue for tech trust
2. **Consider readability**: Left panel text needs good contrast
3. **Test on mobile**: Shader renders on both desktop and mobile
4. **Performance**: Lower `pxSize` (1-2) = smoother, higher (3-4) = retro feel
5. **Speed sweet spot**: 0.05-0.12 for professional sites

---

**Current Setup**: Professional red wave pattern at 0.08 speed ✅  
**Want to experiment?** Try "swirl" with blue for ML/neural network vibe!
