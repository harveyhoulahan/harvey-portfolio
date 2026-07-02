import type { Metadata } from "next";
import Catchment from "@/components/catchment/Catchment";

export const metadata: Metadata = {
  title: "Catchment — a browser-native neural Earth engine | Harvey Houlahan",
  description:
    "A real catchment on your GPU: shallow-water hydrology, erosion and wind-driven fire in raw WebGPU — with a trained convolutional neural operator emulating the solver as WGSL compute passes, raced against the physics with a live error field.",
};

export default function CatchmentPage() {
  return <Catchment />;
}
