# UX Review Checklist - Anti-regression

Usage: a remplir dans chaque PR qui modifie une vue, un flow, ou un composant UI.

## 1) Flow
- [ ] Le flow impacte est identifie (A/B/C/D/E ou nouveau).
- [ ] Le point d'entree et la sortie utilisateur sont explicites.
- [ ] L'action principale du flow est unique et claire.

## 2) Hierarchie visuelle
- [ ] Le titre de section et le contexte sont lisibles immediatement.
- [ ] Le CTA principal est visuellement dominant.
- [ ] Les actions secondaires ne concurrencent pas le CTA principal.
- [ ] Les informations meta restent en niveau visuel secondaire.

## 3) Etats UI
- [ ] loading defini et testable.
- [ ] empty defini et actionnable.
- [ ] success defini avec feedback clair.
- [ ] error defini avec message utile.
- [ ] Les actions bloquantes sont desactivees pendant loading.

## 4) Coherence design system
- [ ] Les couleurs utilisent les tokens existants (primary, muted, destructive, etc.).
- [ ] Les rayons/bordures/espacements suivent les patterns existants.
- [ ] Aucun style ad hoc non documente n'est introduit.

## 5) Accessibilite et ergonomie
- [ ] Les inputs ont des labels explicites.
- [ ] Le focus clavier est visible.
- [ ] Les erreurs sont percevables sans ambiguite.
- [ ] Le layout reste exploitable en mobile.

## 6) Validation finale
- [ ] Le comportement est coherent entre etats (pas de saut de CTA).
- [ ] Les textes systeme suivent un ton uniforme.
- [ ] Les cas limites (reponse vide, erreur API lente) ont ete verifies.
- [ ] La PR inclut une note sur les etats couverts.
