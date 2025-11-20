/**
 * Project data for portfolio gallery
 * Using icon-based visual identification instead of placeholder images
 */

export const projectImages = [
  {
    icon: "👗",
    alt: "Modaics - Fashion Marketplace & AI Styling",
    title: "Modaics",
    project: "modaics",
    gradient: "from-pink-500 to-purple-500",
  },
  {
    icon: "🐄",
    alt: "AgrIQ - Smart Livestock Intelligence [WIP]",
    title: "AgrIQ [WIP]",
    project: "agriq",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: "🔗",
    alt: "FibreTrace - Blockchain Supply Chain",
    title: "FibreTrace",
    project: "blockchain-trace",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: "🚀",
    alt: "Production ML - Friday Tech & Step One",
    title: "Friday & Step One",
    project: "friday-stepone",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: "🌾",
    alt: "Neural Cotton Yield Predictor",
    title: "Cotton ML",
    project: "neural-cotton",
    gradient: "from-yellow-500 to-green-500",
  },
  {
    icon: "📡",
    alt: "Rural IoT Mesh Network",
    title: "IoT Mesh",
    project: "mesh-network",
    gradient: "from-purple-500 to-indigo-500",
  },
];

/**
 * Instructions for adding your own project images:
 * 
 * 1. Add project screenshots to /public/images/projects/
 * 2. Update the src paths to point to your local images:
 *    src: "/images/projects/modaics-dashboard.png"
 * 
 * 3. Organize by project:
 *    - modaics-01.png, modaics-02.png
 *    - agriq-01.png, agriq-02.png
 *    - etc.
 * 
 * 4. Recommended image specs:
 *    - Aspect ratio: 16:9 (1600x900px or 800x450px)
 *    - Format: PNG or WebP for screenshots, JPEG for photos
 *    - Optimize for web (use Next.js Image component)
 * 
 * 5. For each project, showcase:
 *    - Main dashboard/interface
 *    - Key features in action
 *    - Mobile responsive views
 *    - Data visualizations (for AgrIQ)
 *    - AI/ML outputs (for Modaics styling)
 */
