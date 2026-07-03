"use client";

import { useState } from "react";
import ContourMotif from "@/components/ContourMotif";
import { profile } from "@/data/metadata";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("sent");
        setFormData({ name: "", email: "", message: "" });
        setTimeout(() => setStatus("idle"), 5000);
      } else {
        setStatus("error");
        setErrorMessage(data.error || data.details || "Unknown error");
        setTimeout(() => setStatus("idle"), 5000);
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error — please try again");
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const inputClass =
    "w-full border border-contour bg-paper px-4 py-3 text-ink outline-none transition-colors focus:border-flow placeholder:text-ink/40";

  return (
    <div className="py-20 md:py-28">
      <div className="col-shell relative max-w-work">
        <ContourMotif
          variant="channels"
          className="contour-motif pointer-events-none absolute -top-8 right-6 hidden h-40 w-52 text-ink/10 md:block"
        />
        <span className="mono-label">{profile.availability}</span>
        <h1 className="mt-5 font-display">Get in touch.</h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/80">
          Contract engagements in applied ML/AI systems: RAG pipelines,
          fine-tuned open-source models, model deployment. Climate tech: carbon
          MRV, biodiversity monitoring, precision agriculture and environmental
          data infrastructure.
        </p>
        <p className="mt-4 font-mono text-sm text-ink/60">
          {profile.locationNow}{" "}
          <span className="text-infra">→</span>{" "}
          {profile.locationNext} · {profile.timezone} · remote
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-work grid-cols-1 gap-12 px-6 md:grid-cols-2">
        {/* Direct channels */}
        <div className="space-y-6">
          <div className="case-block">
            <span className="mono-label text-ink/60">Direct</span>
            <ul className="mt-4 space-y-3 font-mono text-sm">
              <li>
                <a href={`mailto:${profile.email}`} className="hover:text-flow">
                  {profile.email}
                </a>
              </li>
              <li>
                <a
                  href={profile.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-flow"
                >
                  LinkedIn {profile.social.linkedinHandle}
                </a>
              </li>
              <li>
                <a
                  href={profile.social.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-flow"
                >
                  GitHub /{profile.social.githubHandle}
                </a>
              </li>
            </ul>
          </div>

          <a href={profile.bookCall} className="btn-primary">
            Book an intro call
          </a>
        </div>

        {/* Minimal message form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Name"
            aria-label="Name"
            className={inputClass}
          />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="Email"
            aria-label="Email"
            className={inputClass}
          />
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={6}
            placeholder="What are you building?"
            aria-label="Message"
            className={`${inputClass} resize-none`}
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className={`btn-primary w-full justify-center disabled:opacity-80 ${
              status === "sending" ? "btn-sending" : ""
            }`}
          >
            {status === "sending" && "Sending…"}
            {status === "sent" && "Message sent"}
            {(status === "idle" || status === "error") && "Send message"}
          </button>
          {status === "sent" && (
            <p className="font-mono text-sm text-flow">
              Thanks — I&apos;ll get back to you soon.
            </p>
          )}
          {status === "error" && (
            <p className="font-mono text-sm text-red-700">
              {errorMessage || "Failed to send. Email me directly instead."}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
