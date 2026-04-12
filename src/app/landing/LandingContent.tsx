"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import localFont from "next/font/local";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

const gimbalExtended = localFont({
  src: "../fonts/GimbalExtended-Regular.ttf",
  display: "swap",
});

const BRAND_LABEL = "Métal Froid";
const LETTER_INDICES = BRAND_LABEL
  .split("")
  .map((c, i) => (/[a-zA-ZÀ-ÿ]/.test(c) ? i : -1))
  .filter((i) => i >= 0);

function getInitialPattern(label: string) {
  return label.split("").map((c) =>
    /[a-zA-ZÀ-ÿ]/.test(c)
      ? c === c.toLocaleUpperCase("fr-FR") && c !== c.toLocaleLowerCase("fr-FR")
      : false
  );
}

function mutatePattern(p: boolean[]) {
  const next = [...p];
  const count = Math.random() > 0.72 ? 2 : 1;
  [...LETTER_INDICES]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .forEach((i) => { next[i] = !next[i]; });
  return next;
}

type Tab = "presentation" | "apropos";

const TABS: { key: Tab; label: string }[] = [
  { key: "presentation", label: "Présentation" },
  { key: "apropos", label: "À propos" },
];

const stats = [
  { value: "+1.8M", label: "playlists analysables" },
  { value: "-60%", label: "temps de recherche manuel" },
  { value: "3x", label: "plus de contacts qualifiés" },
];

const pillars = [
  {
    title: "Signal audio + humain",
    text: "On combine des features sonores et des signaux éditoriaux pour éviter les faux positifs.",
  },
  {
    title: "Matching transparent",
    text: "Chaque suggestion affiche pourquoi elle apparaît, avec des critères lisibles.",
  },
  {
    title: "Workflow actionnable",
    text: "Passe de la recherche à la soumission en quelques clics sans changer d'outil.",
  },
];

const forWho = [
  {
    title: "Artistes indé",
    text: "Tu sors régulièrement, tu veux maximiser chaque release sans passer des jours en recherche manuelle.",
  },
  {
    title: "Managers & producteurs",
    text: "Tu gères plusieurs artistes. Métal Froid te permet de centraliser et de scaler la recherche de playlists.",
  },
  {
    title: "Labels indie",
    text: "Tu veux systématiser le pitch playlist sur tout ton roster avec un process reproductible et traçable.",
  },
];

const tutorial = [
  {
    title: "Analyse audio locale",
    text: "Importe ton fichier audio directement dans l'interface. L'analyse extrait les features sonores (BPM, énergie, valence, tonalité…) en local, sans upload vers un serveur externe.",
  },
  {
    title: "Génération du matching",
    text: "L'algorithme compare ton profil sonore à des milliers de playlists indexées. Il croise les features audio avec des signaux éditoriaux (genre déclaré, historique de curation, activité récente).",
  },
  {
    title: "Exploration des suggestions",
    text: "Parcours les résultats triés par score de compatibilité. Chaque carte de playlist affiche les critères qui ont déclenché le match — pas de boîte noire.",
  },
  {
    title: "Filtres et priorisation",
    text: "Affine les résultats par genre, taille d'audience, ou activité du curateur. Enregistre tes favoris pour constituer une liste de soumissions ciblée.",
  },
  {
    title: "Soumission aux curateurs",
    text: "Accède directement aux canaux de contact depuis chaque fiche playlist. Rédige un message court et pertinent grâce au contexte affiché — taux de réponse plus élevé, effort réduit.",
  },
];

const differentiators = [
  {
    title: "Non-fiduciaire",
    text: "La valeur du ranking ne dépend pas d'un paiement de soumission. Accès curatoriel pertinent d'abord — pas de biais lié au budget, pas de filtre économique avant l'évaluation artistique.",
  },
  {
    title: "Explicable",
    text: "Chaque suggestion affiche les signaux qui ont déclenché le match. Tu comprends pourquoi une playlist est recommandée avant d'agir — pas de boîte noire.",
  },
  {
    title: "Actionnable",
    text: "Contact exploitable = critère de qualité numéro un. Le quality gate rejette automatiquement toute entrée sans canal de soumission vérifiable.",
  },
  {
    title: "Communautaire et gouvernée",
    text: "Le catalogue grandit via contributions de l'équipe avec quality gate automatisé, cold-start penalty et rollback batch. Volume et qualité ne sont pas des opposés.",
  },
];

const journeyStories = [
  {
    persona: "Nassim — Parcours standard",
    badge: "success path",
    steps: [
      {
        label: "Situation",
        text: "Artiste indé francophone, prépare la sortie d'un single. Refuse de payer pour tenter sa chance sur des plateformes où le budget dicte la visibilité.",
      },
      {
        label: "Ce qu'il fait",
        text: "Ouvre Métal Froid, charge son morceau, lance une recherche. Filtre par pays, genre, taille de playlist. Lit les raisons de score, repère les badges de confiance.",
      },
      {
        label: "Résultat",
        text: "8 curateurs cohérents, contacts exploitables, pitches envoyés sans friction financière. Sentiment de contrôle et de pertinence.",
      },
    ],
    aha: "\"Je peux agir maintenant, sans payer, et je comprends mes options.\"",
  },
  {
    persona: "Maya — Parcours expérimental",
    badge: "recovery path",
    steps: [
      {
        label: "Situation",
        text: "Artiste indé déjà active, teste un titre plus expérimental. Premiers résultats peu convaincants — peu de playlists au-dessus du seuil de confiance.",
      },
      {
        label: "Ce qu'elle fait",
        text: "Utilise les suggestions de relance : ajustement profil (ambiance, langue), élargissement contrôlé des filtres, second run. L'échec initial est expliqué, pas punitif.",
      },
      {
        label: "Résultat",
        text: "Moins de volume mais de meilleurs fit qualitatifs avec contacts valides. Une shortlist réduite mais exploitable, confiance dans l'outil maintenue.",
      },
    ],
    aha: "\"L'outil m'explique pourquoi c'est difficile, pas seulement que c'est difficile.\"",
  },
];

const qualityAccepted = [
  "Identité éditoriale claire — genre, ambiance, public cible définis",
  "Contact vérifiable et canal de soumission explicite (HTTP ou email valide)",
  "Activité playlist récente ou signaux d'engagement mesurables",
  "Cohérence entre description annoncée et contenu observable",
];

const qualityRejected = [
  "Contact mort, introuvable ou canal de soumission opaque",
  "Playlist dupliquée ou quasi-dupliquée d'une entrée existante (fingerprint URL)",
  "Contenu trompeur, spam ou mismatch évident avec le positionnement annoncé",
  "Signaux insuffisants pour établir un score de confiance minimum (< 0.60)",
];

export function LandingContent() {
  const [tab, setTab] = useState<Tab>("presentation");
  const [brandPattern, setBrandPattern] = useState(() => getInitialPattern(BRAND_LABEL));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setBrandPattern((p) => mutatePattern(p)), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="landing-root bg-background text-foreground">
      <div className="landing-aurora" aria-hidden="true" />
      <div className="landing-grid" aria-hidden="true" />

      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-[88px] items-center px-6 md:px-12" style={{ maxWidth: "80rem" }}>
          <div className="flex flex-1 items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Métal Froid"
              width={60}
              height={60}
              priority
              className="h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <span
                aria-label={BRAND_LABEL}
                className={`${gimbalExtended.className} block shrink-0 text-lg font-bold tracking-wider leading-none text-foreground`}
              >
                {BRAND_LABEL.split("").map((char, index) => {
                  const isLetter = /[a-zA-ZÀ-ÿ]/.test(char);
                  const isUpper = brandPattern[index];
                  const display = !isLetter
                    ? char
                    : isUpper
                      ? char.toLocaleUpperCase("fr-FR")
                      : char.toLocaleLowerCase("fr-FR");
                  return (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={`mf-brand-char ${
                        isLetter ? (isUpper ? "mf-brand-char--upper" : "mf-brand-char--lower") : ""
                      }`}
                    >
                      {display}
                    </span>
                  );
                })}
              </span>
              <p className="hidden truncate text-sm text-muted-foreground md:block">
                Analyse ton morceau et trouve les playlists curatées les plus compatibles.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-8 shrink-0 px-4 text-xs">
            <Link href="/login">Connexion</Link>
          </Button>
        </div>
      </header>

      {/* ── Tabs nav ──────────────────────────────────────────────── */}
      <div className="sticky top-[88px] z-20 border-b border-border bg-background">
        <nav className="mx-auto flex px-6 md:px-12" style={{ maxWidth: "80rem" }}>
          <ul className="flex h-11 items-end gap-0">
            {TABS.map(({ key, label }) => (
              <li key={key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setTab(key)}
                  className={`whitespace-nowrap px-4 pb-2.5 pt-2 text-sm font-medium transition-colors ${
                    tab === key
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <main id="main-content" className="relative">
        {tab === "presentation" && (
          <PresentationTab onGoToAbout={() => setTab("apropos")} />
        )}
        {tab === "apropos" && <AboutTab />}
      </main>
    </div>
  );
}

function PresentationTab({ onGoToAbout }: { onGoToAbout: () => void }) {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section
        className="relative mx-auto flex w-full flex-col px-6 pb-12 pt-10 md:px-12 md:pt-14"
        style={{ maxWidth: "80rem" }}
      >
        <span className="landing-reveal inline-flex w-fit items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Workflow de découverte pour artistes
        </span>

        <h1 className="landing-reveal mt-6 max-w-4xl text-balance font-sans text-4xl font-bold leading-[0.95] text-foreground md:text-6xl">
          Trouve les bonnes playlists.
          <br />
          <span className="text-primary">Pas juste les plus visibles.</span>
        </h1>

        <p className="landing-reveal-delay mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Métal Froid t&apos;aide à cibler les curateurs qui ont une vraie probabilité de matcher ton son,
          avec une interface claire, des critères explicites et un rythme adapté aux sorties indé.
        </p>

        <div className="landing-reveal-delay2 mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={onGoToAbout}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-75"
          >
            En savoir plus
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="landing-reveal-delay2 mt-12 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.value} className="bg-card/80">
              <CardContent className="p-5">
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Piliers ─────────────────────────────────────────────── */}
      <section
        className="mx-auto grid w-full gap-4 px-6 pb-12 md:grid-cols-3 md:px-12"
        style={{ maxWidth: "80rem" }}
      >
        <div className="col-span-full mb-2">
          <h2 className="text-xl font-semibold text-foreground">Ce qui rend le matching utile</h2>
        </div>
        {pillars.map((pillar, idx) => (
          <Card
            key={pillar.title}
            className="landing-card bg-card/80"
            style={{ animationDelay: `${idx * 120}ms` }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-foreground">{pillar.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{pillar.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ── Pour qui ────────────────────────────────────────────── */}
      <section
        className="mx-auto w-full px-6 pb-20 md:px-12"
        style={{ maxWidth: "80rem" }}
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Pour qui</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un outil pensé pour ceux qui prennent les sorties au sérieux.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {forWho.map((item) => (
            <Card key={item.title} className="bg-card/80">
              <CardContent className="p-5">
                <p className="mb-2 text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

function AboutTab() {
  return (
    <div
      className="mx-auto w-full px-6 pb-24 pt-10 md:px-12"
      style={{ maxWidth: "80rem" }}
    >
      {/* ── Vision & positionnement ─────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-foreground">Vision</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Les canaux traditionnels de promotion musicale sont instables et biaisés. Les plateformes
          de soumission payantes imposent un filtre économique qui oriente les choix avant même
          l&apos;évaluation artistique. Métal Froid part d&apos;un constat simple&nbsp;: le problème
          n&apos;est pas le manque d&apos;opportunités, c&apos;est le manque de signal.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Le cœur différenciant de Métal Froid est son positionnement{" "}
          <strong className="text-foreground">non-fiduciaire</strong>&nbsp;: la valeur du ranking
          ne dépend pas d&apos;un paiement de soumission, mais de la qualité des données et de la
          compatibilité réelle entre morceau et playlist. Là où les alternatives monétisent l&apos;accès,
          Métal Froid priorise la confiance, l&apos;autonomie et la liberté d&apos;action de l&apos;artiste.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          La promesse est doctrinale&nbsp;: un accès curatoriel honnête, actionnable et créatif,
          sans barrière économique immédiate — avec un score explicable à chaque étape.
          L&apos;acte simple d&apos;ajouter une playlist devient un levier de liberté collective.
        </p>
      </section>

      <div className="mb-16 h-px w-full bg-border" />

      {/* ── Différenciateurs ────────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Ce qui rend Métal Froid différent</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {differentiators.map((item) => (
            <Card key={item.title} className="bg-card/80">
              <CardContent className="p-5">
                <p className="mb-2 text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="mb-16 h-px w-full bg-border" />

      {/* ── Parcours concrets ───────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="mb-2 text-2xl font-bold text-foreground">En pratique</h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Deux scénarios réels pour comprendre comment l&apos;outil répond sous pression.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {journeyStories.map((story) => (
            <Card key={story.persona} className="bg-card/80">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base text-foreground">{story.persona}</CardTitle>
                  <span className="shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {story.badge}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {story.steps.map((s) => (
                  <div key={s.label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                ))}
                <p className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground">
                  <span className="font-semibold">Moment clé&nbsp;: </span>{story.aha}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="mb-16 h-px w-full bg-border" />

      {/* ── Comment ça marche ───────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="mb-2 text-2xl font-bold text-foreground">Comment ça marche</h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Cinq étapes, de l&apos;analyse de ton titre à la soumission aux curateurs.
        </p>
        <ol className="space-y-5">
          {tutorial.map((step, idx) => (
            <li key={step.title} className="flex gap-5">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {idx + 1}
              </span>
              <Card className="flex-1 bg-card/80">
                <CardContent className="p-5">
                  <h3 className="mb-1.5 text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <div className="mb-16 h-px w-full bg-border" />

      {/* ── Standards qualité ───────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="mb-2 text-2xl font-bold text-foreground">Standards qualité</h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Chaque playlist passe un quality gate automatisé avant d&apos;être exposée au ranking.
          Les critères sont publics et non-négociables.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-foreground">Ce qui est accepté</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {qualityAccepted.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 shrink-0 text-primary">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-foreground">Ce qui est rejeté</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {qualityRejected.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 shrink-0 text-destructive">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
          Un rollback automatique est déclenché si le taux de feedback négatif sur les nouvelles
          activations dépasse{" "}
          <strong className="text-foreground">40 % sur 7 jours glissants</strong>.
          La protection de la pertinence est non-négociable.
        </p>
      </section>

      <div className="mb-16 h-px w-full bg-border" />

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="flex flex-col items-start gap-4">
        <p className="text-base font-medium text-foreground">Prêt à accéder à l&apos;app&nbsp;?</p>
        <p className="max-w-md text-sm text-muted-foreground">
          L&apos;accès est restreint à l&apos;équipe. Connecte-toi avec ton compte pour commencer.
        </p>
        <Button asChild>
          <Link href="/login">Se connecter</Link>
        </Button>
      </section>
    </div>
  );
}
