import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import ByronMap from "@/components/ByronMapLazy";
import ContourField from "@/components/ContourField";
import GridReadout from "@/components/GridReadout";
import { profile } from "@/data/metadata";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Signature: live contour field the cursor perturbs (click for rain).
          Homepage only. */}
      <ContourField className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="col-shell relative z-10 max-w-work pb-14 pt-16 md:pb-16 md:pt-24">
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_min(36vw,400px)] md:items-start md:gap-x-[clamp(1.5rem,4vw,3rem)]">
          <div>
            <div className="animate-enter md:max-w-[42rem]">
              <span className="mono-label">{profile.title}</span>

              <h1 className="mt-5 font-display">{profile.name}</h1>

              <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/80">
                {profile.descriptor}
              </p>

              <p className="mt-6 font-mono text-sm text-ink/60">
                {profile.locationNow} <span className="text-infra">→</span>{" "}
                {profile.locationNext}
              </p>

              {/* Availability */}
              <div className="mt-8 flex flex-col gap-4 border-t border-contour pt-8 sm:flex-row sm:items-center">
                <span className="inline-flex items-center gap-2 font-mono text-sm text-ink">
                  <span className="h-2 w-2 rounded-full bg-flow" aria-hidden />
                  {profile.availability}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink/50">
                  {profile.timezone}
                </span>
              </div>

              {/* CTA — a buyer's path first, the CV second */}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <a href={profile.startProject} className="btn-primary">
                  Start a project <ArrowRight size={16} />
                </a>
                <a
                  href={profile.resume}
                  download={profile.resumeFilename}
                  className="btn-secondary"
                >
                  <Download size={15} />
                  Resume
                </a>
              </div>

              {/* Links */}
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
                <a
                  href={profile.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-ink/70 hover:text-flow"
                >
                  LinkedIn <ArrowUpRight size={13} />
                </a>
                <a
                  href={profile.social.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-ink/70 hover:text-flow"
                >
                  GitHub <ArrowUpRight size={13} />
                </a>
                <a
                  href={profile.social.portfolio}
                  className="inline-flex items-center gap-1 text-ink/70 hover:text-flow"
                >
                  hjhportfolio.com
                </a>
              </div>
            </div>

            {/* Mobile — map below copy */}
            <div className="animate-enter mt-12 w-full md:hidden">
              <div className="aspect-square w-full">
                <ByronMap />
              </div>
              <GridReadout />
            </div>
          </div>

          {/* Desktop — map in the grid, not absolutely positioned */}
          <div className="hidden animate-enter md:block">
            <div className="aspect-square w-full">
              <ByronMap />
            </div>
            <GridReadout />
          </div>
        </div>
      </div>
    </section>
  );
}
