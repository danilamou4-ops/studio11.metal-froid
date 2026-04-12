# Base UX - Ameliorations Structurelles (v1)

Date: 12 avril 2026
Perimetre: application curator-match (Next.js)
Objectif: cadrer flows, hierarchie visuelle, et etats UI pour reduire les regressions.

## 1) Flows produits cibles

### Flow A - Matching depuis fichier local
- Entree: onglet Matching
- Etape 1: selection fichier audio
- Etape 2: analyse locale
- Etape 3: affichage des features
- Etape 4: lancement matching
- Etape 5: affichage des resultats et actions (contact, export, filtres)
- Sortie: shortlist actionnable

### Flow B - Matching depuis profil artiste
- Entree: onglet Matching (carte profil)
- Etape 1: lancer matching profil
- Etape 2: calcul/requete
- Etape 3: resultats + filtres
- Sortie: shortlist sans upload fichier

### Flow C - Ajouter une playlist
- Entree: onglet Ajouter une playlist
- Etape 1: formulaire metadata + contact
- Etape 2: profil audio + presets genres
- Etape 3: soumission
- Etape 4: feedback succes/erreur
- Sortie: playlist disponible et redirection vers Toutes les playlists

### Flow D - Explorer le catalogue
- Entree: onglet Toutes les playlists
- Etape 1: chargement liste
- Etape 2: recherche/filtrage
- Etape 3: details (avis/signalements)
- Sortie: consultation + action contact

### Flow E - Profil et admin
- Entree: onglet Mon profil
- Etape 1: edition profil musical + compte
- Etape 2: sauvegarde ou reset
- Etape 3 (admin): revue contribution + controles gouvernance
- Sortie: profil a jour / moderation effectuee

## 2) Contrat de hierarchie visuelle

Regle 1 - Une action dominante par ecran
- Chaque vue definit un CTA principal explicite.
- Les CTA secondaires restent visuellement secondaires.

Regle 2 - Ordre stable du contenu
- Header contexte (titre + description courte)
- Contenu principal (formulaire/liste/resultats)
- Actions
- Feedback systeme

Regle 3 - Densite et lisibilite
- Un seul niveau de contraste fort par section.
- Les informations meta (compteurs, notes, aide) en style muted.

Regle 4 - Cohabitation des panneaux
- Les zones critiques (erreur, succes, warning) utilisent un style coherent:
  - Erreur: destructive
  - Succes: positif
  - Info: secondaire
- Pas de style ad hoc hors tokens sans justification.

## 3) Matrice d'etats UI obligatoire

Pour chaque vue interactive, documenter au minimum:
- loading
- empty
- success
- error

### 3.1 Matching (TrackFeatureTester + TopPlaylistsView)
- loading: analyse en cours / matching en cours
- empty: aucune feature analysee et aucun resultat
- success: features detectees et/ou resultats disponibles
- error: echec analyse locale

### 3.2 Toutes les playlists (AllPlaylistsView)
- loading: chargement de la liste
- empty: liste vide ou filtrage sans resultat
- success: liste affichee
- error: echec fetch /api/playlists

### 3.3 Ajout playlist (AddPlaylistFormView)
- loading: soumission en cours
- empty: etat formulaire initial
- success: playlist enregistree
- error: validation ou erreur API

### 3.4 Profil musical / compte (ArtistProfileForm, AccountSettingsCard)
- loading: chargement profil
- empty: profil vide
- success: sauvegarde confirmee
- error: echec sauvegarde

### 3.5 Console admin (AdminContributionPanel)
- loading: chargement files + controles
- empty: aucune playlist dans la file
- success: file affichee et actions disponibles
- error: echec gouvernance/fetch

## 4) Regles anti-regression design (DoD UX)

1. Chaque ecran declare son CTA principal.
2. Les etats loading/empty/success/error sont couverts explicitement.
3. Les messages systeme sont actionnables (pas seulement descriptifs).
4. Les composants utilisent les tokens de theme existants (globals.css + tailwind).
5. Les variantes critiques (erreur/succes) n'introduisent pas de style incoherent.
6. Les interactions invalides sont desactivees pendant loading.
7. Les actions irreversibles ont une confirmation ou un feedback explicite.
8. Mobile: pas de debordement horizontal, CTA principal visible sans effort.
9. Accessibilite minimum: labels, focus visible, textes d'erreur lisibles.
10. Toute nouvelle vue a sa mini-matrice d'etats en PR.

## 5) Priorites d'amelioration (ordre recommande)

P1 - Unifier les composants d'etat
- Creer des primitives UI re-utilisables pour loading/empty/error/success.

P1 - Standardiser les messages de feedback
- Harmoniser ton, longueur, et structure (cause -> impact -> action).

P2 - Stabiliser la navigation par onglets
- Ajouter indicateurs de contexte (titre de section + objectif) par onglet actif.

P2 - Clarifier les etats vides
- Ajouter CTA clair dans les etats vides critiques.

P3 - Checklist de review UX en CI documentaire
- Exiger une checklist UX cochee dans chaque PR touchant l'UI.

## 6) Gouvernance

- Owner produit/UX: valide les regles.
- Dev: applique et documente les etats.
- QA: verifie la checklist anti-regression.
- Cadence: revue mensuelle de la base UX + ajustements incremental.
