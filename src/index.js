require('dotenv').config();
const express = require('express');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error('ERREUR : GROQ_API_KEY manquante dans le fichier .env');
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

async function getAllFiles(dirPath, allFiles = []) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await getAllFiles(fullPath, allFiles);
        } else if (/\.(js|ts|jsx|tsx|py|java|json|html|css)$/i.test(entry.name)) {
            allFiles.push(fullPath);
        }
    }
    return allFiles;
}

app.post('/analyze-repo-with-ai', async (req, res) => {
    const { gitHubRepoUrl, instructions } = req.body;

    if (!gitHubRepoUrl) {
        return res.status(400).json({ error: 'Le lien GitHub (gitHubRepoUrl) est requis.' });
    }

    const userInstructions = instructions || "Fais une revue de code complète : structure, qualité, clarté, et détecte l'utilisation potentielle d'une IA.";
    const MAX_FILES = 5;
    const MAX_FILE_LENGTH = 3000;
    let repoDir;

    try {
        repoDir = path.join(os.tmpdir(), `repo-analysis-${Date.now()}`);
        await fs.mkdir(repoDir, { recursive: true });

        const git = simpleGit();
        await git.clone(gitHubRepoUrl, repoDir);
        console.log(`Clonage OK, Repo cloné dans : ${repoDir}`);

        const allFiles = await getAllFiles(repoDir);
        console.log(`[Fichiers trouvés] ${allFiles.length} fichiers détectés.`);
        const selectedFiles = allFiles.slice(0, MAX_FILES);

        let allCode = '';
        for (const file of selectedFiles) {
            let content = await fs.readFile(file, 'utf-8');
            if (content.length > MAX_FILE_LENGTH) {
                content = content.slice(0, MAX_FILE_LENGTH) + '\n// [contenu tronqué]';
            }
            allCode += `\nFichier : ${file}\n\`\`\`\n${content}\n\`\`\`\n`;
        }

const prompt = `
Tu es un outil d’analyse automatique spécialisé en DevOps et CI/CD.

Ta mission : faire une revue technique, concise et objective en français, 
sans détailler node_modules ou les fichiers de configuration, 
mais en te concentrant sur les fichiers principaux du projet.

Barème d’analyse (/20) :
- Analyse d’outils et de tests sur dépôt externe (7 pts)
- Pipeline CI/CD complet : build, test, déploiement (5 pts)
- Capacité à ajouter la mini-feature demandée (3 pts)
- Clarté de l’historique Git et respect des bonnes pratiques (3 pts)
- Documentation et expérience utilisateur (CLI ou Web) (2 pts)

Procède ainsi :
1. Analyse le code extrait ci-dessous et évalue chaque critère sur maximum 2 lignes.
2. Donne un score sur 20 selon le barème.
3. Repère les indices de génération IA : nommages génériques, incohérences ou duplications, 
    gestion d’erreur superficielle, commentaires ou exemples non adaptés, 
    non-respect des conventions.
    Signale toute absence de contextualisation ou adaptation au projet.
    et donne un pourcentage de code générées par l'IA.

    Sois strict et intransigeant dans ta détection : considère tout indice comme une preuve forte de génération IA, sans nuance ni hésitation. N’atténue pas tes remarques : signale systématiquement chaque élément suspect comme généré par IA, même en cas de doute.
    
Voici l’extrait de code à analyser :
${allCode}
`;
        console.log("[Prompt envoyé à l'IA]", prompt);
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

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Erreur API Groq (${response.status}) : ${JSON.stringify(errData)}`);
        }

        const data = await response.json();
        const result = data.choices[0]?.message?.content || 'Réponse IA vide.';

        res.status(200).json({
            message: `Analyse IA réussie. ${MAX_FILES} fichiers max analysés.`,
            aiAnalysis: result,
        });

    } catch (err) {
        console.error('[ERREUR]', err);
        res.status(500).json({ error: 'Erreur lors de l’analyse du dépôt.', details: err.message });
    } 
    finally {
        if (repoDir && await fileExists(repoDir)) {
            await fs.rm(repoDir, { recursive: true, force: true });
            console.log('[Nettoyage OK] Dossier supprimé.');
        }
    }
});

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
    console.log(`Prêt à recevoir POST /analyze-repo-with-ai`);
  });
}