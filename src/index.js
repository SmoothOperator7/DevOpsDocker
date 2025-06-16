require('dotenv').config();
const express = require('express');
const simpleGit = require('simple-git');
const path = require('path');
const fileSystem = require('fs/promises');
const operatingSystem = require('os');
const fetch = require('node-fetch');

const NODE_ENV = process.env;


const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GROQ_API_KEY && NODE_ENV !== 'test') {
  console.error('ERREUR : GROQ_API_KEY manquante dans le fichier .env');
  process.exit(1);
}

if (!GITHUB_TOKEN && NODE_ENV !== 'test' ) {
    console.error('ERREUR : GITHUB_TOKEN manquant');
    process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Fonction pour récupérer tous les fichiers d'un répertoire
async function getAllFiles(dirPath, allFiles = []) {
    const entries = await fileSystem.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await getAllFiles(fullPath, allFiles);
        }
        else if (
        /\.(js|ts|jsx|tsx|py|java|json|html|css|yml|yaml)$/i.test(entry.name) ||
        entry.name.toLowerCase() === 'Dockerfile' ||
        entry.name.toLowerCase() === 'docker-compose.yml'
    ) {
        allFiles.push(fullPath);
    }

    }
    return allFiles;
}

async function getGitHubAPI(gitHubRepoUrl) 
{
    try {
    const [, , , owner, repo] = gitHubRepoUrl.split('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const headers = {
        'User-Agent': 'ci-analyzer',
        'Authorization': `token ${GITHUB_TOKEN}`
    };
    const repoInfo = await (await fetch(apiUrl, { headers })).json();
    const branches = await (await fetch(`${apiUrl}/branches`, { headers })).json();
    const workflows = await (await fetch(`${apiUrl}/actions/workflows`, { headers })).json();
    const commits = await (await fetch(`${apiUrl}/commits?per_page=100`, { headers })).json();

    return {
        repoName: repoInfo.name || 'Inconnu',
        branches: branches.map(branche => branche.name),
        workflows: workflows.workflows?.map(workflow => workflow.name),
        commits: commits.map(commit => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: commit.commit.author.name,
            date: commit.commit.author.date
        }))
    };
    } catch (err) {
    console.error('[GitHub API ERROR]', err.message);
    return {
      repoName: 'Inconnu',
      branches: [],
      workflows: [],
      commits: []
    };
  }
}


async function fileExists(filePath) {
    try {
        await fileSystem.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function findExpressEntryFile(repoDir) {
    const files = await getAllFiles(repoDir);
    for (const file of files) {
        if (!file.endsWith('.js')) continue;
        const content = await fileSystem.readFile(file, 'utf-8');
        if (content.includes('express()') && content.includes('app.listen')) {
            return file;
        }
    }
    return null;
}


async function injectHealthCheck(filePath) {
    if (!filePath) {
      console.log("[Injection] Échec : index.js introuvable.");
      return false;
    }

    try {
        let content = await fileSystem.readFile(filePath, 'utf-8');

        if (!content.includes('/health')) {
            content += '\napp.get("/health", (req, res) => res.send("OK"));\n';
            await fileSystem.writeFile(filePath, content, 'utf-8');
            console.log("[Injection] Route /health ajoutée.");
            return true;
        } else {
            console.log("[Injection] Route /health déjà présente.");
            return false;
        }
    } catch (err) {
        console.log("[Injection] Échec :", err.message);
        return false;
    }
}

// Partie pour analyser un dépôt GitHub avec l'IA
app.post('/analyze-repo-with-ai', async (req, res) => {
    const { gitHubRepoUrl } = req.body;

    if (!gitHubRepoUrl) {
        return res.status(400).json({ error: 'Le lien GitHub (gitHubRepoUrl) est requis.' });
    }

    const MAX_FILES = 5;
    const MAX_FILE_LENGTH = 3000;
    let repoDir;

    try {
         const gitData = await getGitHubAPI(gitHubRepoUrl);
        repoDir = path.join(operatingSystem.tmpdir(), `repo-analysis-${Date.now()}`);
        await fileSystem.mkdir(repoDir, { recursive: true });

        const git = simpleGit();
        await git.clone(gitHubRepoUrl, repoDir);
        console.log(`Clonage OK, Repo cloné dans : ${repoDir}`);
        
        const entryFile = await findExpressEntryFile(repoDir);
        const healthOK = await injectHealthCheck(entryFile);

        const allFiles = await getAllFiles(repoDir);
        console.log(`[Fichiers trouvés] ${allFiles.length} fichiers détectés.`);
        const selectedFiles = allFiles.slice(0, MAX_FILES);

        const hasDockerfile = allFiles.some(file => path.basename(file).toLowerCase() === 'dockerfile');
        const hasCompose = allFiles.some(file => path.basename(file).toLowerCase() === 'docker-compose.yml');
        console.log(`[Docker] Dockerfile : ${hasDockerfile}, Docker-compose : ${hasCompose}`);
        if (!hasDockerfile && !hasCompose) {
            console.log("[Docker] Aucun fichier Dockerfile ou docker-compose.yml trouvé.");
        }

        let allCode = '';
        for (const file of selectedFiles) 
        {
            let content = await fileSystem.readFile(file, 'utf-8');
            if (content.length > MAX_FILE_LENGTH) {
                content = content.slice(0, MAX_FILE_LENGTH) + '\n// [contenu tronqué]';
            }
            allCode += `\nFichier : ${file}\n\`\`\`\n${content}\n\`\`\`\n`;
        }
        const summary = {
                    repoName: gitData.repoName,
                    branches: gitData.branches,
                    workflows: gitData.workflows,
                    commitCount: gitData.commits.length,
                    files: selectedFiles.map(file => path.relative(repoDir, file)),
                    docker: {
                        hasDockerfile,
                        hasCompose
                    },
                    healthInjected: healthOK,
                };

const prompt = `
Nous communiquons en français.
Tu es un outil d’analyse DevOps/CI-CD. Analyse ce code extrait d’un dépôt GitHub.

Objectifs :
- Évaluer la qualité du code (lisibilité, structure, logique)
- Vérifier la présence d’un pipeline CI/CD fonctionnel
- Détecter si du code a été généré par une IA
- Juger si le projet est maintenable (testé avec une route /health injectée)

Barème (/20) :
1. Compréhension du code + pipeline CI/CD : /13
2. Qualité de l’environnement (structure, lisibilité, Docker, .env) : /4
3. Pipeline CI/CD (build, test, déploiement) : /3

Détection IA :
Signale toute trace suspecte (noms vagues, commentaires génériques, copier-coller, logique douteuse).  
Donne un verdict clair (Oui / Non / Peut-être), un % estimé, et une justification.

Les métadonnées suivantes sont fiables et générées automatiquement par un outil d’analyse :
- Dockerfile présent : ${hasDockerfile}
- Docker-compose présent : ${hasCompose}

Même si ces fichiers ne sont pas visibles ci-dessous, considère leur existence pour ta notation.

Format de la réponse :
  "Difficulté estimée": "Débutant" | "Avancé" (+ % difficulté),
  "Compréhension du code": "X / 13",
  "Qualité de l’environnement": "X / 4",
  "Note pipeline CI/CD": "X / 3",
  "IA détectée": "Oui" | "Non" | "Peut-être",
  "Pourcentage IA": "X %",
  "Justification IA": "..."

Renvoie moi également le Résumé du dépôt :
- Lien GitHub : ${gitHubRepoUrl}
- Nom : ${gitData.repoName}
- Branches : ${JSON.stringify(gitData.branches)}
- Workflows : ${JSON.stringify(gitData.workflows)}
- Commits : ${gitData.commits.length}
- Dockerfile : ${hasDockerfile}
- Docker-compose : ${hasCompose}
- Route /health injectée : ${healthOK}
- Fichiers analysés : ${JSON.stringify(selectedFiles.map(f => path.relative(repoDir, f)))}

Pour finir une note globale sur 20, en expliquant les points forts et faibles du projet.
Voici l’extrait de code à analyser :
${allCode}
`;

        //console.log("[Prompt envoyé à l'IA]", prompt);
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama3-70b-8192',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) 
        {
            const errData = await response.json();
            throw new Error(`Erreur API Groq (${response.status}) : ${JSON.stringify(errData)}`);
        }

        const data = await response.json();
        const result = data.choices[0]?.message?.content || 'Réponse IA vide.';

        res.status(200).json({
            message: `Analyse IA réussie. ${MAX_FILES} fichiers max analysés.`, 
            summary,
            aiAnalysis: result,
        });

    } catch (err) 
    {
        console.error('[ERREUR]', err);
        res.status(500).json({ error: 'Erreur lors de l’analyse du dépôt.', details: err.message });
    } 
    finally 
    {
        if (repoDir && await fileExists(repoDir)) 
            {
            await fileSystem.rm(repoDir, { recursive: true, force: true });
            console.log('[Nettoyage OK] Dossier supprimé.');
        }
    }
});


//Partie pour générer un QCM à partir du code d’un dépôt GitHub
const nodeFetch = require('node-fetch');

app.post('/generate-quiz', async (req, res) => {
    const { gitHubRepoUrl } = req.body;
    if (!gitHubRepoUrl) {
        return res.status(400).json({ error: 'Le lien GitHub est requis.' });
    }

    const MAX_FILES = 5;
    const MAX_FILE_LENGTH = 3000;
    const repoDir = path.join(operatingSystem.tmpdir(), `quiz-analysis-${Date.now()}`);

    try {
        await fileSystem.mkdir(repoDir, { recursive: true });
        const git = simpleGit();
        await git.clone(gitHubRepoUrl, repoDir);

        const allFiles = await getAllFiles(repoDir);
        const selectedFiles = allFiles.slice(0, MAX_FILES);

        let allCode = '';
        for (const file of selectedFiles) {
            let content = await fileSystem.readFile(file, 'utf-8');
            if (content.length > MAX_FILE_LENGTH) {
                content = content.slice(0, MAX_FILE_LENGTH);
            }
            allCode += `\nFichier : ${file}\n\n\`\`\`\n${content}\n\`\`\`\n`;
        }

        const prompt = `
Tu es un formateur en DevOps.

Lis le code ci-dessous, et génère un tableau JSON contenant 10 questions à choix multiple (QCM) pour tester la compréhension du développeur.

Tu dois OBLIGATOIREMENT renvoyer uniquement du JSON valide, au format suivant :
[
  {
    "question": "Quel est le rôle de la route /health ?",
    "choices": ["Elle vérifie l’état du serveur", "Elle teste le port 3000", "Elle supprime le cache"],
    "answer": "Elle vérifie l’état du serveur"
  },
  ...
]
Voici le code à analyser :
${allCode}
`;

        const response = await nodeFetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama3-70b-8192',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GROQ API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        let output = data.choices?.[0]?.message?.content || '';


        const jsonMatch = output.match(/(\[.*\])/s);
        if (jsonMatch) 
        {
            output = jsonMatch[1];
        } 
        else 
        {
            throw new Error("Aucun tableau JSON détecté dans la réponse IA.");
        }

        output = output.replace(/,\s*"[^"]*"\s*(?=})/g, '');

        let quiz;
        try
        {
            quiz = JSON.parse(output);
        } catch (err) {
            console.error('JSON invalide renvoyé par l’IA :', output);
            return res.status(500).json({ error: "Réponse IA non valide (JSON attendu)", details: err.message });
        }

        res.json({ quiz });

    } 
    catch (err) 
    {
        console.error('[ERREUR GENERATION QCM]', err);
        res.status(500).json({ error: 'Erreur génération QCM', details: err.message });
    } 
    finally 
    {
        if (repoDir && await fileExists(repoDir)) {
            await fileSystem.rm(repoDir, { recursive: true, force: true });
        }
    }
});

module.exports = app;

if (require.main === module) 
{
  app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
    console.log(`Prêt à recevoir POST /analyze-repo-with-ai`);
  });
}