import type { Metadata } from "next";
import Genesis from "@/components/genesis/Genesis";

export const metadata: Metadata = {
  title: "Genesis — particle life in the browser | Harvey Houlahan",
  description:
    "Particle Life on the GPU with WebGPU — summon a swarm from a text prompt using in-browser CLIP and separable CMA-ES search. Entirely client-side.",
};

export default function GenesisPage() {
  return <Genesis />;
}
