    document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("quizForm");
  const input = document.getElementById("quizRepoUrl");
  const results = document.getElementById("quizResults");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    results.innerHTML = "<p class='text-gray-300'>Génération du QCM...</p>";
    const url = input.value.trim();

    try {
      const res = await fetch("/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gitHubRepoUrl: url })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      results.innerHTML = '';
      let index = 0;
      const quiz = data.quiz;
      let score = 0;

      const questionContainer = document.createElement("div");
      questionContainer.className = "space-y-4";
      results.appendChild(questionContainer);

      const validateButton = document.createElement("button");
      validateButton.textContent = "Valider";
      validateButton.className = "mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700";

      function showQuestion(i) {
        questionContainer.innerHTML = '';
        const q = quiz[i];
        const bloc = document.createElement("div");
        bloc.className = "bg-gray-800 p-4 rounded";

        const choices = q.choices.map((c, idx) => `
          <label class='block bg-gray-700 hover:bg-gray-600 p-2 rounded cursor-pointer'>
            <input type='radio' name='choice' value='${c}' class='mr-2' /> ${c}
          </label>
        `).join('');

        bloc.innerHTML = `
          <h2 class='font-bold mb-4'>${i + 1}. ${q.question}</h2>
          <form id='quizForm${i}'>
            ${choices}
          </form>
          <p id='feedback' class='mt-4 font-bold hidden'></p>
        `;

        questionContainer.appendChild(bloc);
        questionContainer.appendChild(validateButton);

        validateButton.onclick = () => {
          const selected = document.querySelector("input[name='choice']:checked");
          const feedback = document.getElementById("feedback");
          if (!selected) {
            feedback.textContent = "Veuillez choisir une réponse.";
            feedback.className = "mt-4 font-bold text-yellow-400";
            feedback.classList.remove("hidden");
            return;
          }

          const isCorrect = selected.value === q.answer;
          if (isCorrect) {
            score++;
            feedback.textContent = "Bonne réponse !";
            feedback.className = "mt-4 font-bold text-green-400";
          } else {
            feedback.textContent = `Mauvaise réponse. La bonne réponse était : ${q.answer}`;
            feedback.className = "mt-4 font-bold text-red-400";
          }

          feedback.classList.remove("hidden");
          validateButton.textContent = i < quiz.length - 1 ? "Suivant" : "Voir la note";

          validateButton.onclick = () => {
            if (i < quiz.length - 1) showQuestion(i + 1);
            else {
              questionContainer.innerHTML = `<p class='text-2xl text-center text-white'>🧠 Score final : <span class='text-green-400 font-bold'>${score} / ${quiz.length}</span></p>`;
            }
          };
        };
      }

      showQuestion(index);

    } catch (err) {
      results.innerHTML = `<p class='text-red-500'>Erreur : ${err.message}</p>`;
    }
  });
});
