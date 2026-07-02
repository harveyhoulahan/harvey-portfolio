import type { Metadata } from "next";
import Genesis from "@/components/genesis/Genesis";

export const metadata: Metadata = {
  title: "Genesis — a browser-native artificial-life lab | Harvey Houlahan",
  description:
    "Continuous cellular automata (Lenia) evolving live on the GPU with WebGPU — with in-browser CLIP and separable CMA-ES search that summons artificial life from a text prompt. Entirely client-side.",
};

export default function GenesisPage() {
  return <Genesis />;
}
