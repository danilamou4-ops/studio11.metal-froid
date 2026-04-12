import type { Metadata } from "next";
import { LandingContent } from "./LandingContent";
import "./landing.css";

export const metadata: Metadata = {
  title: "Métal Froid",
  description:
    "Trouve les playlists curatées les plus compatibles avec ton morceau.",
};

export default function LandingPage() {
  return <LandingContent />;
}
