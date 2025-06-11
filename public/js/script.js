console.log("script chargé"); // test de chargement
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("analyzeBtn");
  const resultBox = document.getElementById("result");

  button.addEventListener("click", async () => {
    const repoUrl = document.getElementById("repoUrl").value.trim();

    if (!repoUrl) {
      resultBox.textContent = "Veuillez saisir un lien GitHub valide.";
      return;
    }

    resultBox.textContent = "Analyse en cours...";

    try {
      console.log("try chargé"); 
      const response = await fetch("http://localhost:3000/analyze-repo-with-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepoUrl: repoUrl,
          instructions: "Fais une revue complète CI/CD & DevOps en français. Donne un score et Analyse ce code généré par une IA, identifie et explique toutes les incohérences, erreurs ou mauvaises pratiques, puis propose des corrections claires."
          
        })
      });
      

      const data = await response.json();

      if (response.ok) {
        resultBox.textContent = data.aiAnalysis;
      } else {
        resultBox.textContent = `Erreur : ${data.error}\n\n${data.details || ""}`;
      }
    } catch (err) {
      resultBox.textContent = `Erreur de connexion : ${err.message}`;
    }
  });
});
