# Comptes de test, notifications accueil et fiche du jour

## 1. Comptes de test (mot de passe)

Aujourd'hui la connexion se fait uniquement par lien e-mail. J'ajoute la connexion par mot de passe sur la page de connexion (le lien e-mail reste disponible), et je crée trois comptes de test :

| Compte | Adresse | Mot de passe | Rôle |
|---|---|---|---|
| Locataire | fab@nova.fr | 111111 | locataire |
| Administrateur | admin@nova.fr | 111111 | admin |
| Accueil (super admin) | accueil@nova.fr | 111111 | accueil |

Le domaine `nova.fr` est ajouté aux domaines autorisés et rattaché à une entreprise de démonstration avec un quota d'heures.

## 2. Rôle « accueil » (super admin)

Nouveau rôle qui permet de :
- réserver au nom de quelqu'un d'autre (nom, e-mail, entreprise, salle, date, créneau, durée, objet, confidentiel), sans blocage de quota ;
- annuler n'importe quelle réservation, avec re-crédit automatique du quota ;
- voir le planning global de toutes les entreprises ;
- télécharger la fiche du jour.

## 3. Notification à l'accueil à chaque réservation

Chaque réservation créée envoie automatiquement un e-mail d'information à **seineavenue@yahoo.fr** : salle, localisation, date, créneau, durée, objet (ou « confidentiel »), nom et e-mail du réservant, entreprise.

## 4. Fiche récapitulative quotidienne à 5h

Chaque matin à 5h (heure de Paris), l'application génère la fiche du jour et envoie un e-mail à l'accueil. Elle est aussi téléchargeable à tout moment depuis l'espace admin/accueil pour n'importe quelle date.

Contenu de la fiche, une page par salle, format paysage :
- en haut à gauche : le logo Seine Avenue vectorisé ;
- en-tête : la date et « Bienvenue dans la Salle {nom de la salle} » ;
- tableau des créneaux réservés de la journée : horaire, durée, réservé par, entreprise, objet (« Confidentiel » si la case est cochée).

Le document sort au format Word en paysage. À noter : les e-mails envoyés par l'application ne peuvent pas contenir de pièce jointe — l'e-mail de 5h contiendra donc un **lien de téléchargement** de la fiche du jour, ce qui revient au même côté usage.

## 5. Logo

Le logo Seine Avenue que vous venez d'envoyer est vectorisé (SVG) et utilisé en haut à gauche des fiches.

## Point bloquant : domaine d'envoi

L'envoi d'e-mails (notification accueil + fiche de 5h) nécessite un domaine d'expédition qui vous appartient, à configurer une fois. Tant que ce n'est pas fait, je construis tout le reste (comptes, rôle accueil, fiche téléchargeable, génération Word, tâche de 5h) et les envois s'activent dès la configuration terminée.

## Détails techniques

- Auth : activation du provider e-mail/mot de passe, création des 3 utilisateurs via l'API admin dans un script serveur, e-mails confirmés d'office ; `app_role` étendu avec `accueil`, entrées `allowed_domains` pour `nova.fr`.
- Réservations : rôle `accueil` traité comme `admin` pour bypass quota et suppression ; nouveau champ « pour le compte de » côté serveur.
- Fiche : génération `.docx` paysage A3 avec `docx` (npm) dans une server function ; logo SVG converti en PNG intégré ; route de téléchargement protégée par rôle admin/accueil.
- Planification : `pg_cron` à 03:00 UTC (5h Paris en été) appelant `/api/public/hooks/daily-sheet`, protégé par en-tête secret, qui génère la fiche et envoie l'e-mail.
- E-mails : templates React Email + envoi Lovable Emails, une fois le domaine d'expédition vérifié.
