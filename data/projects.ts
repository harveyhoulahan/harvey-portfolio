export interface Project {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  features: string[];
  tags: string[];
  link: string;
  github: string;
  category: string;
  featured: boolean;
  year: number;
  wip?: boolean;
  icon?: string; // Emoji or icon identifier
  color?: string; // Theme color for the project
}

export const projectsData: Project[] = [
  {
    id: 'modaics',
    title: "Modaics",
    description: "Digital wardrobe and fashion marketplace platform. Launched through RMIT Activator accelerator program, exploring AI-powered styling recommendations and sustainable fashion discovery.",
    longDescription: "Modaics is a digital fashion platform developed through the Royal Melbourne Institute of Technology (RMIT) Activator accelerator program. The platform combines computer vision, natural language processing, and collaborative filtering to create a marketplace and personal styling experience. Features include wardrobe digitization, AI-powered outfit suggestions, and peer-to-peer fashion trading. Built with a mobile-first approach, the platform bridges sustainable fashion practices with modern e-commerce. Successfully completed the RMIT Activator program, receiving mentorship and validation from industry leaders in fashion tech.",
    features: [
      "AI-powered styling recommendations using computer vision and NLP",
      "Digital wardrobe management with automated item categorization",
      "Peer-to-peer marketplace for sustainable fashion trading",
      "Community-driven curation and trend discovery",
      "iOS app in active development (React Native + Swift)",
      "Graduated from RMIT Activator accelerator program",
    ],
    tags: ["iOS", "Swift", "React Native", "AI/ML", "Computer Vision", "NLP", "Product Design", "E-commerce"],
    link: "/projects/modaics.html",
    github: "",
    category: "AI/ML • Fashion Tech",
    featured: true,
    year: 2024,
    color: "from-pink-500 to-purple-500",
  },
  {
    id: 'agriq',
    title: "AgrIQ - Smart Livestock Intelligence",
    description: "Next-generation livestock health monitoring platform using ML-powered smart ear tags. Research focused on pregnancy prediction and health indexing across multiple species. [WORK IN PROGRESS]",
    longDescription: "AgrIQ explores a new approach to livestock management, combining IoT hardware (smart ear tags) with machine learning for agricultural operations. The research focuses on ultra-early pregnancy detection using biosensor data and time-series ML models, targeting 90%+ accuracy from 7 days post-conception. Beyond pregnancy detection, the platform explores comprehensive health monitoring through continuous vital sign tracking, behavioral pattern analysis, and predictive health indexing. The multi-species data model supports cattle, sheep, and goats with species-specific ML pipelines. Designed for potential large-scale automation of livestock operations. Currently in research and development phase with plans for commercial testing.",
    features: [
      "WORK IN PROGRESS - Research and development phase",
      "Pregnancy prediction research targeting 90%+ accuracy from day 7",
      "Real-time health indexing and anomaly detection prototypes",
      "Multi-species support (cattle, sheep, goats) with dedicated ML models",
      "IoT smart ear tag prototypes with biosensors",
      "Behavioral pattern analysis for early disease detection",
      "Automation research aiming to reduce manual checks",
      "Mobile + web dashboard concepts for farm management",
    ],
    tags: ["Machine Learning", "IoT", "Computer Vision", "Python", "Edge ML", "Agriculture", "Data Science", "Time Series"],
    link: "/projects/agriq.html",
    github: "",
    category: "AI/ML • AgTech",
    featured: true,
    year: 2025,
    wip: true,
    color: "from-green-500 to-emerald-500",
  },
  {
    id: 'blockchain-trace',
    title: "FibreTrace - Supply Chain Transparency",
    description: "iOS application leveraging blockchain for end-to-end supply chain transparency in the textile industry. Tracks 50M+ items across 12 countries with ML-based product authentication.",
    longDescription: "FibreTrace is an enterprise iOS application that brings unprecedented transparency to the global textile supply chain using blockchain technology. The app enables brands and consumers to trace products from raw materials to final garments, combating counterfeit goods and ensuring ethical sourcing. Built with Swift/SwiftUI and integrating Hyperledger Fabric for blockchain operations, the system processes 2M+ daily transactions while maintaining sub-second response times. The application features ML-powered QR code authentication using Core ML for on-device verification, reducing counterfeit incidents by 78% for luxury fashion brands. Real-time tracking provides visibility across 12 countries and hundreds of suppliers, creating an immutable record of product journey. The platform serves major fashion brands seeking to validate sustainability claims and combat supply chain fraud.",
    features: [
      "Blockchain-based product tracking (Hyperledger Fabric)",
      "ML-powered QR authentication with Core ML",
      "Tracks 50M+ items across 12 countries",
      "2M+ daily transaction processing",
      "78% reduction in counterfeit goods for luxury brands",
      "Real-time supply chain visibility and reporting",
      "Swift/SwiftUI native iOS implementation",
    ],
    tags: ["Swift", "SwiftUI", "Blockchain", "Hyperledger Fabric", "Core ML", "iOS", "Supply Chain", "PostgreSQL"],
    link: "https://fibretrace.io",
    github: "",
    category: "Blockchain • Mobile",
    featured: true,
    year: 2024,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: 'friday-stepone',
    title: "Production ML Systems - Friday Tech & Step One",
    description: "Building production machine learning systems for e-commerce. Semantic search, recommendation engines, and NLP pipelines for fashion platforms.",
    longDescription: "Architecting production-grade ML systems for Friday Technologies and Step One Clothing, two Australian e-commerce platforms. Work spans semantic search infrastructure, product recommendation engines, and NLP pipelines for customer service automation. Implemented vector embeddings using sentence transformers for semantic product search. Built real-time recommendation system utilizing collaborative filtering and content-based approaches. Developed customer service automation using language models. Systems deployed on AWS with auto-scaling infrastructure. Responsible for end-to-end ML lifecycle including data pipelines, model training, deployment, and monitoring.",
    features: [
      "Semantic search with vector embeddings and transformers",
      "Real-time recommendation system with collaborative filtering",
      "NLP-powered customer service automation",
      "Auto-scaling AWS infrastructure for production workloads",
      "Content-based and collaborative filtering approaches",
      "End-to-end ML pipeline: data → training → deployment → monitoring",
    ],
    tags: ["Python", "ML/AI", "NLP", "Semantic Search", "AWS", "TensorFlow", "Vector Embeddings", "Production Systems"],
    link: "/projects/friday-stepone.html",
    github: "",
    category: "AI/ML • E-commerce",
    featured: true,
    year: 2025,
    color: "from-orange-500 to-red-500",
  },
];
