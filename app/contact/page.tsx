"use client";

import { motion } from "framer-motion";
import { Mail, MapPin, Linkedin, FileText } from "lucide-react";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import { useState, useRef } from "react";

export default function Contact() {
  const headerRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    // Simulate form submission (replace with actual implementation)
    setTimeout(() => {
      setStatus("sent");
      setFormData({ name: "", email: "", message: "" });
      setTimeout(() => setStatus("idle"), 3000);
    }, 1000);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="section-container">
      <div ref={headerRef} className="mb-16">
        <TextCursorProximity
          label="GET IN TOUCH"
          className="text-5xl md:text-7xl font-black text-white tracking-tight uppercase block mb-4"
          styles={{
            transform: {
              from: "scale(1)",
              to: "scale(1.1)",
            },
            color: { 
              from: "#FFFFFF", 
              to: "#FF0000"
            },
          }}
          falloff="gaussian"
          radius={120}
          containerRef={headerRef}
        />
        <p className="text-xl text-neutral-400 max-w-3xl mt-6">
          Let&apos;s build something.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Info */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div>
            <h3 className="text-2xl font-semibold mb-6">Contact Information</h3>
            
            <div className="space-y-4">
              <a
                href="mailto:harveyhoulahan@outlook.com"
                className="flex items-center gap-4 text-neutral-300 hover:text-white transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <Mail className="text-red-400" size={20} />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Email</p>
                  <p className="font-medium">harveyhoulahan@outlook.com</p>
                </div>
              </a>

              <div className="flex items-center gap-4 text-neutral-300">
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <MapPin className="text-red-400" size={20} />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Location</p>
                  <p className="font-medium">NYC, USA</p>
                </div>
              </div>

              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 text-neutral-300 hover:text-white transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <Linkedin className="text-red-400" size={20} />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">LinkedIn</p>
                  <p className="font-medium"></p>
                </div>
              </a>
            </div>
          </div>

          <div className="card-glass p-6 bg-red-500/5 border-red-500/20 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <FileText className="text-red-400 mt-1" size={20} />
              <div>
                <h4 className="font-semibold mb-2 text-white">Work Authorization</h4>
                <p className="text-sm text-neutral-300">
                  E-3 Visa
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <form onSubmit={handleSubmit} className="card-glass p-8 space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-red-500 transition-colors"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-red-500 transition-colors"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-red-500 transition-colors resize-none"
                placeholder=""
              />
            </div>

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {status === "sending" && "Sending..."}
              {status === "sent" && "Message Sent!"}
              {(status === "idle" || status === "error") && "Send Message"}
            </button>

            {status === "sent" && (
              <p className="text-green-400 text-sm text-center">
                Thanks! I&apos;ll get back to you soon.
              </p>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
