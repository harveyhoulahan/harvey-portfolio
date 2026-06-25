import type { Metadata } from "next";
import Genesis from "@/components/genesis/Genesis";

export const metadata: Metadata = {
  title: "Genesis — a browser-native artificial-life lab | Harvey Houlahan",
  description:
    "An in-progress flagship: continuous cellular automata (Lenia) evolving live on the GPU with WebGPU, building toward foundation-model-guided search that summons artificial life from a text prompt.",
};

export default function GenesisPage() {
  return <Genesis />;
}
