"use client";

import { Timeline } from "@/components/ui/timeline";

export default function Experience() {
  const timelineData = [
    {
      title: "2025",
      content: (
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">Friday Technologies & Step One Clothing</h3>
            <p className="text-red-400 font-medium mb-1">AI/ML Engineer & Backend Systems Developer</p>
            <p className="text-neutral-500 text-sm mb-4">Melbourne, Australia • Remote</p>
            <p className="text-neutral-300 text-sm md:text-base mb-4">
              Architecting production-grade machine learning systems and semantic search infrastructure for enterprise fashion e-commerce platforms serving 100k+ monthly active users. Leading backend development initiatives focused on scalable AI/ML microservices architecture.
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-400">
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Engineered semantic search engine using BERT embeddings, improving product discovery conversion rates by 34%</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Developed CoreML prototypes for on-device AI inference, reducing cloud compute costs by 40%</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Built real-time data pipelines processing 1M+ events daily using Apache Kafka and PostgreSQL</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Deployed microservices architecture on Kubernetes achieving 99.9% uptime SLA</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "2024",
      content: (
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">FibreTrace Pty Ltd</h3>
            <p className="text-red-400 font-medium mb-1">iOS Software Engineer</p>
            <p className="text-neutral-500 text-sm mb-4">Sydney, Australia • Hybrid</p>
            <p className="text-neutral-300 text-sm md:text-base mb-4">
              Spearheaded development of blockchain-integrated iOS application providing end-to-end supply chain transparency for the global textile industry. Platform now tracks 50M+ products across 12 countries for major luxury fashion brands.
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-400">
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Architected Swift/SwiftUI application with Core ML integration for real-time product authentication</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Implemented QR/NFC scanning system with ML-powered fraud detection achieving 99.2% accuracy</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Integrated Hyperledger Fabric blockchain processing 2M+ daily transactions with sub-second latency</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Reduced counterfeit product incidents by 78% through advanced authentication algorithms</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Collaborated with cross-functional teams across 3 continents to deliver enterprise features</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "2023-2024",
      content: (
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">Australian Energy Market Operator (AEMO)</h3>
            <p className="text-red-400 font-medium mb-1">Software Engineering Intern</p>
            <p className="text-neutral-500 text-sm mb-4">Melbourne, Australia • On-site</p>
            <p className="text-neutral-300 text-sm md:text-base mb-4">
              Developed advanced analytics and forecasting systems for Australia&apos;s national electricity grid, supporting critical infrastructure managing 200+ GW of generation capacity and serving 20M+ customers across the National Electricity Market.
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-400">
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Built time-series forecasting models (Prophet, XGBoost, Transformers) achieving 97.2% accuracy on day-ahead demand predictions</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Engineered real-time analytics dashboard in React displaying 5-minute granularity grid load data</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Deployed ML pipeline on Azure processing 288 predictions per day per region for grid stability optimization</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Integrated renewable energy forecasting to support Australia&apos;s clean energy transition goals</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "2023-Present",
      content: (
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">Monash University</h3>
            <p className="text-red-400 font-medium mb-1">Bachelor of Advanced Computer Science (Honours) - Artificial Intelligence</p>
            <p className="text-neutral-500 text-sm mb-4">Clayton, Australia • WAM: 78.5 (Distinction)</p>
            <p className="text-neutral-300 text-sm md:text-base mb-4">
              Pursuing advanced degree specializing in machine learning, natural language processing, and intelligent systems. Focused on practical applications of AI to solve real-world problems in healthcare, agriculture, and sustainable technology.
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-400">
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Advanced coursework: Deep Learning, NLP, Computer Vision, Distributed Systems, Algorithm Design</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Research focus: Time-series forecasting for agricultural applications and edge ML deployment</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Developed multiple production-deployed ML systems as capstone projects (AgrIQ, Neural Cotton Predictor)</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Active member of Monash DeepNeuron AI research group and hackathon participant</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "2021-2023",
      content: (
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">James Cook University</h3>
            <p className="text-red-400 font-medium mb-1">Bachelor of Medicine, Bachelor of Surgery (MBBS) - 6 Months</p>
            <p className="text-neutral-500 text-sm mb-4">Townsville, Australia • 2021 • Transferred to Computer Science</p>
            <p className="text-neutral-300 text-sm md:text-base mb-4">
              Completed first semester of medical training before transitioning to computer science. Early exposure to clinical data analysis and biostatistics informed decision to pursue healthcare technology and AI-driven diagnostics at scale rather than direct patient care.
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-400">
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Introductory training in clinical decision-making and evidence-based practice methodology</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Foundation in biostatistics and medical research applicable to ML healthcare applications</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Recognized greater impact potential through building AI tools for healthcare providers</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Pivoted to computer science to combine analytical skills with technical implementation</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Origins",
      content: (
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">Pathway to Global Tech</h3>
            <p className="text-neutral-300 text-sm md:text-base mb-4">
              Grew up in northern NSW&apos;s cotton belt. Spent time around farms, saw how agriculture and textiles actually work. Started med school, switched to computer science. Now building ML systems for fashion, energy, and agriculture — industries I understand from the ground up.
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-400">
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Agricultural background: hands-on with cotton farming, textile production, supply chains</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Medical training: analytical approach to data, research methodology, evidence-based thinking</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>CS degree: technical skills to build production systems that scale</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-red-400 mt-1">▸</span>
              <span>Focus: shipping working AI for real industries, not proof-of-concept demos</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="section-container">
      <Timeline data={timelineData} />
    </div>
  );
}
