import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Github } from 'lucide-react';
import { projectsData } from '@/data/projects';
import FlowingBackground from '@/components/FlowingBackground';

export async function generateStaticParams() {
  return projectsData.map((project) => ({
    id: project.id,
  }));
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = projectsData.find((p) => p.id === params.id);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      <FlowingBackground variant="medium" />
      
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-black" />
        
        {/* Flowing red overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-red-900/10" />
        
        {/* Back Button */}
        <Link 
          href="/projects"
          className="absolute top-8 left-8 flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
        >
          <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
          Back to Projects
        </Link>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-16">
          <div className="max-w-5xl mx-auto">
            {project.wip && (
              <span className="inline-block px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-400 text-sm font-mono rounded mb-4">
                WORK IN PROGRESS
              </span>
            )}
            <h1 className="text-4xl lg:text-6xl font-bold mb-4">{project.title}</h1>
            <p className="text-xl text-neutral-300 max-w-3xl">{project.description}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8 lg:px-16 py-16 relative z-10">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg p-4 hover:border-red-500/50 transition-colors">
            <div className="text-sm text-neutral-400 mb-1">Year</div>
            <div className="text-2xl font-bold text-red-400">{project.year}</div>
          </div>
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg p-4 hover:border-red-500/50 transition-colors">
            <div className="text-sm text-neutral-400 mb-1">Category</div>
            <div className="text-lg font-semibold">{project.category}</div>
          </div>
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg p-4 hover:border-red-500/50 transition-colors">
            <div className="text-sm text-neutral-400 mb-1">Status</div>
            <div className="text-lg font-semibold">
              {project.wip ? '🚧 Beta' : '✅ Live'}
            </div>
          </div>
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg p-4 hover:border-red-500/50 transition-colors">
            <div className="text-sm text-neutral-400 mb-1">Stack</div>
            <div className="text-lg font-semibold">{project.tags.length}+ Tech</div>
          </div>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-red-400">Overview</h2>
          <p className="text-lg leading-relaxed text-neutral-300 whitespace-pre-line">
            {project.longDescription}
          </p>
        </section>

        {/* Key Features */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-red-400">Key Features</h2>
          <ul className="space-y-3">
            {project.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="text-red-400 mt-1">▸</span>
                <span className="text-neutral-300">{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tech Stack */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-red-400">Tech Stack</h2>
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tech, idx) => (
              <span
                key={idx}
                className="px-4 py-2 bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg text-sm font-mono hover:border-red-500/50 hover:bg-red-500/5 transition-all cursor-default"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* Links */}
        <section className="flex flex-wrap gap-4">
          {project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-lg transition-all duration-300 hover:scale-105 font-medium"
            >
              <ExternalLink size={18} />
              View Live Project
            </a>
          )}
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-700 hover:border-red-500/50 transition-all duration-300 font-medium"
            >
              <Github size={18} />
              View Source
            </a>
          )}
        </section>

        {/* Footer Navigation */}
        <div className="mt-16 pt-8 border-t border-neutral-800">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
            Back to All Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
