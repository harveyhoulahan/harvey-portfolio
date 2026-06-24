import type { Metadata } from "next";
import ExperienceTimeline from "@/components/ExperienceTimeline";

export const metadata: Metadata = {
  title: "Experience — Harvey Houlahan",
  description:
    "Career timeline: ArborMeta, Step One Clothing, FibreTrace, AEMO, Monash University.",
};

export default function Experience() {
  return (
    <div className="py-20 md:py-28">
      <div className="col-shell max-w-work">
        <span className="mono-label">Experience</span>
        <h1 className="mt-5 font-display">Timeline</h1>
      </div>

      <div className="mx-auto mt-12 max-w-work px-6">
        <ExperienceTimeline />
      </div>
    </div>
  );
}
