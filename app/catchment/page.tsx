import type { Metadata } from "next";
import Catchment from "@/components/catchment/Catchment";

export const metadata: Metadata = {
  title: "Catchment — a browser-native neural Earth engine | Harvey Houlahan",
  description:
    "An in-progress flagship: a real catchment rendered in 3D on the GPU with WebGPU, building toward live hydrology, fire, and a neural surrogate that emulates the simulation in real time.",
};

export default function CatchmentPage() {
  return <Catchment />;
}
