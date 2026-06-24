import type { Metadata } from "next";
import { about, profile } from "@/data/metadata";

export const metadata: Metadata = {
  title: "About — Harvey Houlahan",
  description: about.paragraphs[0],
};

export default function About() {
  return (
    <div className="py-20 md:py-28">
      <div className="col-shell max-w-prose">
        <span className="mono-label">About</span>
        <h1 className="mt-5 font-display">From a cotton farm to carbon policy.</h1>
      </div>

      <div className="mx-auto max-w-prose px-6">
        <div className="mt-10 space-y-7">
          {about.paragraphs.map((para, i) => (
            <p key={i} className="text-lg leading-relaxed text-ink/80">
              {para}
            </p>
          ))}
        </div>

        <div className="mt-12 border-t border-hairline pt-8">
        <span className="mono-label">Currently</span>
        <p className="mt-3 text-ink/80">
          {profile.locationNow} <span className="text-sand">→</span>{" "}
          {profile.locationNext} · {profile.timezone} · remote
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href={profile.calendly}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Book an intro call
          </a>
          <a href={`mailto:${profile.email}`} className="btn-secondary">
            Email me
          </a>
        </div>
        </div>
      </div>
    </div>
  );
}
