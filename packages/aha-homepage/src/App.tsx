import { useState } from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Marquee } from "./components/Marquee";
import { Shelf } from "./components/Shelf";
import { Gallery } from "./components/Gallery";
import { Fable } from "./components/Fable";
import { Layers } from "./components/Layers";
import { PresetLab } from "./components/PresetLab";
import { Cli } from "./components/Cli";
import { Gates } from "./components/Gates";
import { Footer } from "./components/Footer";
import { EXAMPLE_WORD, UsageModal } from "./components/UsageModal";

export default function App() {
  const [usage, setUsage] = useState<{ word: string; source: "fall" | "marquee" | "menu" } | null>(null);

  return (
    <div className="grain min-h-screen bg-ink-900 text-cream-1">
      <Nav onStart={() => setUsage({ word: EXAMPLE_WORD, source: "menu" })} />
      <main>
        <Hero onStart={() => setUsage({ word: EXAMPLE_WORD, source: "menu" })} onWordClick={(w) => setUsage({ word: w, source: "fall" })} />
        <Marquee onConcept={(c) => setUsage({ word: c, source: "marquee" })} />
        <Shelf />
        <Gallery onMore={() => setUsage({ word: EXAMPLE_WORD, source: "menu" })} />
        <Fable />
        <Layers />
        <PresetLab />
        <Cli />
        <Gates />
      </main>
      <Footer />
      <UsageModal usage={usage} onClose={() => setUsage(null)} />
    </div>
  );
}
