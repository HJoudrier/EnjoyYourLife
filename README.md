# Enjoy your life

Une application simple pour voir où vous en êtes de votre vie.

Vous indiquez votre date de naissance, votre sexe et votre métier. L’application estime votre espérance de vie et dessine votre vie entière : **une ligne par année, un carré par semaine**, de la naissance jusqu’à l’âge estimé du décès. Les semaines vécues sont remplies, la semaine en cours est marquée en rouge, celles qui restent sont vides.

Elle indique aussi combien de ces années vous vivrez en moyenne **sans incapacité** et **sans incapacité forte** : sur la grille, les semaines où l’on vit en moyenne avec une incapacité, puis une incapacité forte, sont teintées. À droite de chaque ligne, un pourcentage donne vos **chances d’atteindre cet âge**. La grille continue au-delà de l’espérance de vie, jusqu’à l’âge que vous avez moins d’une chance sur dix d’atteindre.

Vous pouvez ensuite :

- **ajouter des événements** passés ou à venir (mariage, diplôme, déménagement, voyage, retraite…), ponctuels ou sur une période, qui apparaissent sur la grille ;
- **ajouter vos proches** (enfants, conjoint, parents, frères et sœurs, grands-parents, amis) et voir, pour chacun :
  - la part du temps passé ensemble qui est déjà derrière vous ;
  - le nombre de jours qu’il vous reste à passer ensemble, en années et en jours ;
  - ces semaines sur la grille, plus ou moins foncées selon la fréquence à laquelle vous vous voyez.

Pour chaque proche, vous pouvez indiquer sa date de naissance, son sexe, son métier et son secteur d’activité. Ils servent à estimer son espérance de vie, et donc combien de temps vous aurez ensemble.

Par exemple, un enfant vit à la maison jusqu’à 18 ans, rentre le week-end pendant ses études, puis passe une fois par mois. À 7 ans, il a déjà vécu un tiers du temps que vous passerez ensemble, alors que seulement 12 % de votre relation s’est écoulée. Avec un parent, à 35 ans, c’est souvent plus de 90 %.

## Utilisation

Aucune installation ni dépendance : ouvrez `index.html` dans un navigateur.

Pour la servir en local :

```sh
npm start          # puis http://localhost:8000
```

Au premier lancement, l’application montre un exemple (Camille, infirmière née en 1991). Cliquez sur **Commencer avec ma vie** pour saisir votre profil ; les exemples disparaissent.

Sur la grille, choisissez d’aligner les lignes sur vos anniversaires ou sur les 1er janvier. Survolez ou touchez une semaine pour voir ses dates et ses événements ; touchez-la une seconde fois pour y ajouter un événement. Au clavier : flèches pour se déplacer, Entrée pour ajouter, Échap pour quitter la vue d’un proche.

### Vos données

Tout reste dans votre navigateur (`localStorage`). Rien n’est envoyé sur Internet. Le bouton **Sauvegarde** permet de télécharger vos données dans un fichier JSON, de les réimporter sur un autre appareil ou de tout effacer.

## Comment c’est calculé

### Espérance de vie

La mortalité suit un modèle de Gompertz-Makeham, μ(x) = A + B·e^(c·x), calibré séparément pour les hommes et les femmes sur les chiffres de l’Insee pour la France en 2025 (provisoires) :

| | à la naissance | à 60 ans |
|---|---|---|
| Femmes | 85,9 ans | 27,9 ans |
| Hommes | 80,3 ans | 23,9 ans |

L’espérance de vie est **conditionnelle à votre âge** : une personne de 70 ans a déjà franchi les risques des âges précédents et vivra en moyenne plus longtemps que l’espérance de vie à la naissance.

Le **métier** est rattaché à sa catégorie socioprofessionnelle (nomenclature Insee). L’écart d’espérance de vie à 35 ans entre cette catégorie et l’ensemble de la population (Insee, 2020-2022) est appliqué au modèle. Par exemple, chez les hommes, les cadres vivent en moyenne 5,3 ans de plus que les ouvriers ; chez les femmes, l’écart est de 3,4 ans. Ces écarts se réduisent avec l’âge : à 60 ans, l’Insee ne mesure plus que 3,6 ans d’écart chez les hommes et 2,3 ans chez les femmes. Le modèle reproduit ces deux mesures en atténuant l’effet du métier après 60 ans, ce qui compte surtout pour les parents et grands-parents. Si le métier n’est pas reconnu, choisissez la catégorie à la main. « Non précisé » pour le sexe fait la moyenne des deux.

Le **secteur d’activité** est un ajustement indicatif. Aucune statistique publiée ne donne l’espérance de vie par secteur. Santé publique France (programme Cosmop) observe en revanche davantage de décès dans la construction, l’industrie et les transports, et moins dans l’agriculture, l’enseignement et certains services. Les écarts ci-dessous suivent ce sens, mais leurs valeurs sont des estimations propres à l’application, limitées à un an. Ils s’ajoutent à l’écart du métier.

| Secteur | Écart à 35 ans |
|---|---|
| Construction, BTP | −1 an |
| Industrie, énergie, mines | −0,7 an |
| Transports, logistique | −0,7 an |
| Hôtellerie, restauration | −0,5 an |
| Commerce, réparation automobile ; services aux entreprises ; administration publique, défense ; arts, spectacles, sport, associations | 0 |
| Information, communication, numérique ; banque, assurance, immobilier ; santé, action sociale | +0,3 an |
| Agriculture, forêt, pêche | +0,5 an |
| Enseignement, recherche | +0,7 an |

Le métier saisi propose automatiquement une catégorie et, quand il ne fait guère de doute, un secteur : « maçon » donne ouvrier et construction, « infirmière » donne profession intermédiaire et santé. Les deux restent modifiables.

Le même calcul s’applique à vous et à vos proches. Un curseur d’**ajustement personnel** (de −10 à +10 ans) permet en plus de tenir compte de votre santé ou de votre hygiène de vie.

### Années en bonne santé

L’espérance de vie sans incapacité compte les années vécues sans être limité dans ses activités habituelles depuis au moins six mois à cause d’un problème de santé. L’espérance de vie sans incapacité forte ne compte que les limitations sévères. L’application calcule les deux par la méthode de Sullivan : à chaque âge, la probabilité d’être en vie est multipliée par la part de la population sans incapacité à cet âge. Cette part suit une courbe calée pour retrouver les chiffres de la DREES :

| | Sans incapacité, à la naissance | Sans incapacité, à 65 ans | Sans incapacité forte, à la naissance | Sans incapacité forte, à 65 ans |
|---|---|---|---|---|
| Femmes | 64,1 ans | 11,8 ans | 77,5 ans | 18,5 ans |
| Hommes | 63,7 ans | 10,5 ans | 73,8 ans | 15,8 ans |

Chiffres 2024, sauf l’incapacité forte à la naissance (2023). Comme l’espérance de vie, ces durées tiennent compte de votre âge, de votre sexe, de votre métier, de votre secteur et de l’ajustement personnel. L’application les présente comme des périodes : d’abord les années sans incapacité, puis celles avec une incapacité, dont les dernières avec une incapacité forte. C’est une façon de lire une moyenne : en réalité, une incapacité peut survenir plus tôt, plus tard, ou disparaître.

### Chances d’atteindre un âge

Le pourcentage à droite de chaque ligne est la probabilité d’être encore en vie au début de cette ligne : à votre anniversaire, ou au 1er janvier si la grille suit les années civiles. Il se calcule en enchaînant les risques de décès de chaque tranche d’âge : les chances d’atteindre 80 ans sont les chances de passer l’année suivante, multipliées par celles de passer l’année d’après, et ainsi de suite jusqu’à 80 ans. Les risques viennent du même modèle de mortalité que l’espérance de vie, si bien que la somme de ces chances redonne les années qu’il vous reste. Au survol d’une semaine à venir, l’application affiche ces chances et le risque de décès dans l’année à cet âge.

Sur mobile, seuls les pourcentages des lignes multiples de 5 sont affichés.

### Limites

Ce n’est qu’une moyenne statistique, pas une prédiction. Le modèle utilise la mortalité observée aujourd’hui et ne tient pas compte des progrès futurs, qui allongeront probablement la vie des plus jeunes.

Sources :

- [Espérance de vie à divers âges, 1994-2025](https://www.insee.fr/fr/statistiques/2416631), Insee
- [Bilan démographique 2025](https://www.insee.fr/fr/statistiques/8719824), Insee Première n° 2087
- [Espérance de vie par catégorie socioprofessionnelle, 2020-2022](https://www.insee.fr/fr/statistiques/8220688), Insee Première n° 2005
- [L’espérance de vie par niveau de vie et catégorie sociale](https://www.cor-retraites.fr/sites/default/files/2025-02/1.%20Insee_cor_esperance%20de%20vie_avec%20annexe.pdf), Insee pour le Conseil d’orientation des retraites, 2025 (écarts à 60 ans)
- [L’espérance de vie sans incapacité à 65 ans est de 11,8 ans pour les femmes et de 10,5 ans pour les hommes en 2024](https://drees.solidarites-sante.gouv.fr/sites/default/files/2026-01/ER1363_esperance_de_vie_sans_incapacit%C3%A9_0.pdf), DREES, Études et Résultats n° 1363, 2026
- [Cosmop : analyse de la mortalité par secteurs d’activité économique](https://www.santepubliquefrance.fr/docs/article/cosmop-analyse-de-la-mortalite-par-secteurs-dactivite-economique), Santé publique France

### La grille

Toutes les lignes sont identiques : 52 carrés de même taille, sans espace supplémentaire. Un réglage au-dessus de la grille choisit sur quoi les aligner :

- **vos années de vie** (par défaut) : la semaine *n* de l’année d’âge *a* commence *n* × 7 jours après votre *a*-ième anniversaire. La 52ᵉ semaine dure jusqu’à l’anniversaire suivant, si bien que chaque ligne correspond exactement à une année de votre vie. La marge indique l’âge tous les 5 ans.
- **les années civiles** : chaque ligne va du 1er janvier au 31 décembre, la semaine *n* commence *n* × 7 jours après le 1er janvier et la 52ᵉ va jusqu’au 31 décembre. La première ligne commence à votre semaine de naissance. La marge indique l’année tous les 5 ans et l’en-tête les mois.

Le réglage est enregistré avec vos données. Changer d’alignement garde la semaine sélectionnée.

### Le temps ensemble

Une relation est découpée en **étapes**. Chaque étape dure jusqu’à un âge (celui de la personne, le vôtre, ou un nombre d’années depuis le début de la relation) et compte un nombre de jours passés ensemble par an : tous les jours (365), tous les week-ends (104), une fois par mois (12), etc. Toutes les étapes sont modifiables.

La relation s’arrête à la première de ces dates : la fin de votre vie estimée, la fin de vie estimée de la personne (si vous indiquez sa date de naissance) ou une date de fin que vous choisissez.

| Lien | Étapes proposées |
|---|---|
| Enfant | à la maison jusqu’à ses 18 ans (tous les jours), études jusqu’à 23 ans (week-ends), puis une fois par mois |
| Conjoint ou conjointe | vie commune, tous les jours |
| Parent | à la maison jusqu’à vos 18 ans, études jusqu’à 23 ans (week-ends), puis une fois par mois |
| Frère ou sœur | sous le même toit jusqu’à vos 18 ans, puis tous les deux mois |
| Grand-parent | deux fois par mois jusqu’à vos 18 ans, puis quelques fois par an |
| Ami ou amie | deux fois par mois |

## Structure

```
index.html        la page
css/style.css     la mise en forme (thèmes clair et sombre)
js/life.js        les calculs : dates, espérance de vie (dont sans incapacité), chances de survie, grille, temps ensemble, métiers et secteurs
js/app.js         l’interface
tests/            tests des calculs
```

## Tests

```sh
npm test
```

Les tests (Node 18 ou plus, sans dépendance) vérifient notamment que le modèle retrouve les chiffres de l’Insee (y compris les écarts par catégorie à 35 et 60 ans) et de la DREES, que la somme des chances de survie redonne l’espérance de vie, que chaque date tombe dans la bonne semaine de la grille, que le métier et le secteur d’un proche changent bien la durée de la relation et que le temps passé ensemble est bien réparti entre les étapes.

## Licence

GPL-3.0, voir [LICENSE](LICENSE).
