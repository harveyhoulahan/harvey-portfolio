import type { Metadata } from "next";
import ContourMotif from "@/components/ContourMotif";
import ExperienceTimeline from "@/components/ExperienceTimeline";

export const metadata: Metadata = {
  title: "Experience — Harvey Houlahan",
  description:
    "Career timeline: ArborMeta, Step One Clothing, FibreTrace, AEMO, Monash University.",
};

export default function Experience() {
  return (
    <div className="py-20 md:py-28">
      <div className="col-shell relative max-w-work overflow-visible">
        <span className="mono-label">Experience</span>
        <div className="relative mt-5 overflow-visible">
          <ContourMotif
            variant="traverse"
            animateOnLoad
            className="contour-motif pointer-events-none absolute right-[clamp(3.5rem,16vw,8.5rem)] top-1/2 z-0 hidden h-36 w-28 -translate-y-1/2 rotate-[13deg] text-ink/[0.1] md:block lg:h-44 lg:w-32 lg:rotate-[11deg]"
          />
          <h1 className="relative z-10 font-display">Timeline</h1>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-work px-6">
        <ExperienceTimeline />
      </div>
    </div>
  );
}
