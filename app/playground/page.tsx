import type { Metadata } from "next";
import Playground from "@/components/Playground";

export const metadata: Metadata = {
  title: "Playground — live GPU demos | Harvey Houlahan",
  description:
    "Two flagship browser-native simulations, GPU-accelerated with WebGPU and entirely client-side: Genesis, an artificial-life lab that summons lifeforms by prompt, and Catchment, a living terrain of water, fire, and a neural surrogate. No servers, no API keys.",
};

export default function PlaygroundPage() {
  return <Playground />;
}
