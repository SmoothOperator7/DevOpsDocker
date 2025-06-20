# DevOpsDocker

Ce projet permet d'analyser automatiquement un dépôt GitHub selon des critères "DevOps", "CI/CD", "qualité du code" et "détection IA".
Il est accessible en production sur https://devopsdocker.onrender.com
Et le quiz sur https://devopsdocker.onrender.com/quiz.html

# Structure du projet

- "src/index.js" : Serveur Node.js + Express pour l’analyse
- "public/" : Interface web (HTML + JS)
- ".env" : Contient la clé d'API IA (Groq) && Clé API GITHUB
- "Dockerfile" + "docker-compose.yml" : Conteneurisation complète du projet

# Prérequis

- Docker installé et fonctionnel
- Une clé API valide :
  - "GROQ_API_KEY" → à obtenir sur https://console.groq.com
- Un Token GitHub personnel pour accéder à l’API GitHub :
  - À générer ici : https://github.com/settings/tokens (Générer un nouveau token classic)

# Lancer le projet avec Docker

git clone https://github.com/SmoothOperator7/DevOpsDocker

cd DevOpsDocker

ajouter les clés "GROQ_API_KEY=ta_clé" & "GITHUB_TOKEN=ton_token" dans le .env

docker-compose up --build

# Lancer les tests manuellement

npm install
npm test

Les tests utilisent Jest et valident le bon fonctionnement de l’analyse IA, la gestion des erreurs, et l'intégration GitHub.

# Convention de commits

Chaque message de commit doit suivre la structure :

"type: description claire en français"

# Types autorisés

build    -> modifications du système de build ou des dépendances  
ci       -> intégration continue, GitHub Actions  
feat     -> nouvelle fonctionnalité  
fix      -> correction de bug  
perf     -> amélioration de performances  
refactor -> refactoring sans modification fonctionnelle  
style    -> mise en forme (indentation, renommage…)  
docs     -> documentation  
test     -> ajout ou modification de tests

# Exemples de commits

feat: ajout d’une route /health  
fix: correction du bug lors du clonage  
build: ajout de node-fetch pour les tests  
test: mock node-fetch pour GitHub Actions  
docs: ajout du guide de contribution  
ci: ajout du fichier ci.yml pour GitHub Actions

# Contribuer au projet

Voici les étapes à suivre pour un nouveau contributeur :

## 1. Cloner le dépôt
git clone https://github.com/SmoothOperator7/DevOpsDocker
cd DevOpsDocker

## 2. Créer une branche à ta feature
git checkout -b feature/nom-de-la-feature

## 3. Faire les modifications nécessaires (code, tests, docs, etc.)

## 4. Lancer le projet en local (au choix)

### Avec npm :
npm install
npm start

### Avec Docker :
docker-compose up --build (avec une gestion des volumes automatiquement)

Sinon une gestion manuel des volumes
#### 1. Créer un volume persistant
docker volume create volume-app

##### 2. Construire l'image Docker
docker build -t DevOpsDocker . 

##### 3. Lancer le conteneur avec le volume monté
docker run -d -p 3000:3000 -v volume-app:/app/data DevOpsDocker

## 5. Ajouter les fichiers modifiés
git add .

## 6. Commit avec un message clair (conventional commit)
git commit -m "type: description"

### Exemples :
git commit -m "feat: ajout de la route /health"
git commit -m "fix: correction d’un bug dans les tests"

## 7. Pousser la branche vers GitHub
git push origin nom-de-ta-branche

# Merci pour ta contribution
