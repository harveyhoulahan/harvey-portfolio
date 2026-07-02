import { ArrowUpRight, Calendar } from "lucide-react";
import ByronMap from "@/components/ByronMap";
import ContourField from "@/components/ContourField";
import GridReadout from "@/components/GridReadout";
import { profile } from "@/data/metadata";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Signature: live contour field the cursor perturbs (click for rain).
          Homepage only. */}
      <ContourField className="absolute inset-0 h-full w-full" />
      <GridReadout />
      <div className="col-shell relative max-w-work pb-20 pt-16 md:pt-24">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr] md:items-center">
        {/* Content */}
        <div className="animate-enter">
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

          {/* CTA */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a href={profile.bookCall} className="btn-primary">
              <Calendar size={16} />
              Book an intro call
            </a>
            <a href={`mailto:${profile.email}`} className="btn-secondary">
              Email me
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

        {/* Live Byron Bay map — real coastline, caldera-teal grade */}
        <div className="animate-enter aspect-square w-full md:aspect-auto md:h-[340px]">
          <ByronMap />
        </div>
      </div>
      </div>
    </section>
  );
}
