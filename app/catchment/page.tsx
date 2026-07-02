import type { Metadata } from "next";
import Catchment from "@/components/catchment/Catchment";

export const metadata: Metadata = {
  title: "Catchment — a browser-native neural Earth engine | Harvey Houlahan",
  description:
    "A real catchment on your GPU: shallow-water hydrology, erosion and wind-driven fire in raw WebGPU, plus a trained convolutional neural operator that emulates the solver as WGSL compute passes, raced against the physics with a live error field.",
};

export default function CatchmentPage() {
  return <Catchment />;
}
