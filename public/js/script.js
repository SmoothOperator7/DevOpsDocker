console.log("script chargé"); 

document.addEventListener("DOMContentLoaded", () => {
const repoUrlInput = document.getElementById('repoUrlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultOutputDiv = document.getElementById('resultOutput');
const loadingIndicator = document.createElement('div');
loadingIndicator.className = 'flex flex-col items-center justify-center mt-10 text-white';
loadingIndicator.innerHTML = `<span class="loader mr-3 w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span><span class="text-xl mt-4">Analyse en cours...</span>`;

const style = document.createElement('style');
style.innerHTML = `.loader { display: inline-block; border-radius: 9999px; border-top-color: transparent; border-style: solid; border-width: 4px; animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

if (analyzeBtn && repoUrlInput && resultOutputDiv) {
analyzeBtn.addEventListener("click", async (e) => {
  e.preventDefault(); 
  const repoUrl = repoUrlInput.value.trim();

  if (!repoUrl) {
    resultOutputDiv.innerHTML = '<h2 class="text-2xl font-bold text-red-400 mb-6">Erreur</h2><p class="text-red-300">Veuillez saisir une URL de dépôt GitHub valide.</p>';
    return;
  }

  resultOutputDiv.innerHTML = ''; 
  resultOutputDiv.appendChild(loadingIndicator);

  try {
    console.log("try chargé"); 
    const response = await fetch("http://localhost:3000/analyze-repo-with-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gitHubRepoUrl: repoUrl,
        instructions: "Fais une revue complète CI/CD & DevOps en français. Donne un score et Analyse ce code généré par une IA, identifie et explique toutes les incohérences, erreurs ou mauvaises pratiques, puis propose des corrections claires."
      })
    });
    
    const data = await response.json();

    resultOutputDiv.innerHTML = ''; 

    if (response.ok) {
      let html = `<h2 class="text-3xl font-bold text-white mb-6">Résultats de l'Analyse</h2>`;
      html += `<div class="bg-gray-700 shadow-xl rounded-lg p-6 max-w-3xl mx-auto text-left">`;
      

      html += `<pre class="text-gray-200 whitespace-pre-wrap font-sans">${data.aiAnalysis}</pre>`;
      html += `</div>`;
      resultOutputDiv.innerHTML = html;
    } else {
      let errorMessage = `Erreur : ${data.error || 'Une erreur inconnue est survenue.'}`;
      if (data.details) {
        errorMessage += `\n\nDétails : ${data.details}`;
      }
      resultOutputDiv.innerHTML = `<h2 class="text-2xl font-bold text-red-400 mb-6">Erreur d'Analyse du Dépôt</h2><pre class="text-red-300 mt-4 whitespace-pre-wrap">${errorMessage}</pre>`;
    }
  } catch (err) {
    console.error('Erreur de connexion ou de parsing JSON:', err);
    resultOutputDiv.innerHTML = `<h2 class="text-2xl font-bold text-red-400 mb-6">Erreur de Connexion</h2><p class="text-red-300 mt-4">Impossible de contacter le serveur d'analyse ou de traiter sa réponse. Vérifiez votre connexion et la console du navigateur pour plus de détails.</p><pre class="text-xs text-gray-400 mt-2 whitespace-pre-wrap">${err.message}</pre>`;
  }
});
} else {
if (!analyzeBtn) console.error("Bouton #analyzeBtn non trouvé!");
if (!repoUrlInput) console.error("Input #repoUrlInput non trouvé!");
if (!resultOutputDiv) console.error("Div #resultOutput non trouvé!");
}
});
