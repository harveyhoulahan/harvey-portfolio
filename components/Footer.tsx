import Link from "next/link";
import ElevationProfile from "@/components/ElevationProfile";
import { profile } from "@/data/metadata";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-contour">
      <ElevationProfile />
      <div className="col-shell max-w-work py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-prose">
            <span className="mono-label">{profile.availability}</span>
            <h3 className="mt-3 font-display text-2xl">Let&apos;s build something spatial.</h3>
            <p className="mt-3 text-ink/70">{profile.footerSubtitle}</p>
          </div>

          <div className="flex flex-col gap-2 font-mono text-sm">
            <a href={`mailto:${profile.email}`} className="hover:text-flow">
              {profile.email}
            </a>
            <a
              href={profile.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-flow"
            >
              LinkedIn {profile.social.linkedinHandle}
            </a>
            <a
              href={profile.social.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-flow"
            >
              GitHub /{profile.social.githubHandle}
            </a>
            <Link href="/contact" className="hover:text-flow">
              Contact →
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-contour pt-6 font-mono text-xs text-ink/50 sm:flex-row sm:justify-between">
          <span>© {year} {profile.name}</span>
          <span>{profile.title}</span>
        </div>
      </div>
    </footer>
  );
}
