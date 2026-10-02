# Comptes de test, accueil, fiche du jour et reporting mensuel

## 1. Comptes de test (mot de passe)

Aujourd'hui la connexion se fait uniquement par lien e-mail. J'ajoute la connexion par mot de passe (le lien e-mail reste disponible) et je crée trois comptes de test :

| Compte | Adresse | Mot de passe | Rôle |
|---|---|---|---|
| Locataire | fab@nova.fr | 111111 | locataire |
| Administrateur | admin@nova.fr | 111111 | admin |
| Accueil (super admin) | accueil@nova.fr | 111111 | accueil |

Le domaine `nova.fr` est ajouté aux domaines autorisés et rattaché à une entreprise de démonstration avec un quota d'heures.

## 2. Rôle « accueil » (super admin)

- réserver au nom de quelqu'un d'autre (nom, e-mail, entreprise, salle, date, créneau, durée, objet, confidentiel), sans blocage de quota ;
- annuler n'importe quelle réservation, avec re-crédit automatique du quota ;
- voir le planning global et télécharger la fiche du jour.

## 3. Notification à l'accueil à chaque réservation

Chaque réservation envoie un e-mail à **seineavenue@yahoo.fr** : salle, localisation, date, créneau, durée, objet (ou « confidentiel »), nom et e-mail du réservant, entreprise.

## 4. Fiche récapitulative quotidienne à 5h

Chaque matin à 5h (Paris), la fiche du jour est générée et envoyée à l'accueil ; elle reste téléchargeable à tout moment depuis l'espace admin/accueil, pour n'importe quelle date.

Contenu, une page par salle, format paysage :
- en haut à gauche le logo Seine Avenue vectorisé ;
- en-tête : la date et « Bienvenue dans la Salle {nom de la salle} » ;
- tableau des créneaux réservés : horaire, durée, réservé par, entreprise, objet (« Confidentiel » si coché).

Sortie au format Word paysage.

## 5. Reporting mensuel

### Page « Reporting » en ligne (admin / accueil)

Tableau de bord dynamique avec filtres : période (mois, trimestre, plage libre), société, salle.

Contenu :
- **Par société** : heures réservées, nombre de réservations, quota du mois, heures restantes, part réelle vs quote-part théorique, dépassements demandés/accordés.
- **Vue site complète** : total des heures réservées toutes sociétés confondues, répartition en pourcentage par société (graphique en anneau), évolution mois par mois (graphique en barres).
- **Taux d'occupation** : par salle et global, calculé sur les créneaux ouvrables (8h–20h), avec pourcentage d'occupation et heures creuses.
- Export CSV et Word paysage du rapport affiché.

### Reporting complémentaire proposé

- heures moyennes par réservation et durée la plus fréquente ;
- jours et créneaux les plus demandés (carte de chaleur jour × heure) ;
- salle la plus et la moins utilisée ;
- taux d'annulation par société ;
- part de réservations confidentielles ;
- classement des sociétés par consommation de leur quota (sous-utilisation / sur-utilisation) ;
- alerte visuelle sur les sociétés au-dessus de 80 % de leur quota.

### Envoi automatique

Le dernier jour du mois, un e-mail de reporting part vers l'accueil (et les administrateurs) : synthèse du mois, tableau par société, taux d'occupation, plus un lien vers la version en ligne et le document.

## 6. Logo

Le logo Seine Avenue envoyé est vectorisé (SVG) et utilisé en haut à gauche des fiches et rapports.

## Point bloquant : domaine d'envoi

Les envois d'e-mails (notification accueil, fiche de 5h, reporting mensuel) nécessitent un domaine d'expédition qui vous appartient, à configurer une fois. Je construis tout le reste en attendant ; les envois s'activent dès la configuration terminée. À noter : les e-mails ne peuvent pas porter de pièce jointe — ils contiendront un lien de téléchargement du document.

## Détails techniques

- Auth : `enable_email_auth`, création des 3 utilisateurs via l'API admin (e-mails confirmés), `app_role` étendu avec `accueil`, entrées `allowed_domains` pour `nova.fr`.
- Réservations : rôle `accueil` traité comme `admin` (bypass quota, suppression), champ « réservé pour le compte de ».
- Documents : génération `.docx` paysage avec la librairie `docx` dans une server function ; logo SVG converti en PNG intégré ; routes de téléchargement protégées par rôle.
- Reporting : server functions d'agrégation SQL (heures par société/salle/mois, occupation sur capacité ouvrable), page `/_authenticated/reporting` avec recharts et filtres URL.
- Planification : `pg_cron` → `/api/public/hooks/daily-sheet` (03:00 UTC) et `/api/public/hooks/monthly-report` (dernier jour du mois), protégés par en-tête secret.
- E-mails : templates React Email + Lovable Emails, une fois le domaine vérifié.
