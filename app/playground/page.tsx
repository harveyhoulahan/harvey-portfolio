import type { Metadata } from "next";
import Playground from "@/components/Playground";

export const metadata: Metadata = {
  title: "Playground — Spatial + ML demos | Harvey Houlahan",
  description:
    "Live, client-side spatial-ML demos: describe terrain in plain English and rank a DEM-derived grid in real time, or teach an in-browser geospatial foundation model to map any concept from a handful of clicks. No API keys.",
};

export default function PlaygroundPage() {
  return <Playground />;
}
