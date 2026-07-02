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
      <div className="col-shell relative max-w-work">
        <ContourMotif
          variant="basin"
          className="contour-motif pointer-events-none absolute -top-8 right-6 hidden h-40 w-52 text-ink/10 md:block"
        />
        <span className="mono-label">Experience</span>
        <h1 className="mt-5 font-display">Timeline</h1>
      </div>

      <div className="mx-auto mt-12 max-w-work px-6">
        <ExperienceTimeline />
      </div>
    </div>
  );
}
