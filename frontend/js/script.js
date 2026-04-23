const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const submitBtn = loginForm?.querySelector("button[type='submit']");

if (loginForm) {
    loginForm.addEventListener("submit", async e => {
        e.preventDefault();

        // Feedback: deshabilitar botón
        submitBtn.disabled = true;
        submitBtn.textContent = "Iniciando...";
        message.className = "";
        message.classList.remove("visible");

        const email = document.getElementById("emailInput").value;
        const password = document.getElementById("passwordInput").value;

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                message.textContent = data.error;
                message.classList.add("visible");
                // Restaurar botón
                submitBtn.disabled = false;
                submitBtn.textContent = "Iniciar sesión";
                return;
            }

            // Éxito
            message.textContent = "¡Acceso concedido!";
            message.classList.add("visible", "success");
            submitBtn.textContent = "✓ Entrando...";

            localStorage.setItem("loggedUser", JSON.stringify(data));

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 800);

        } catch (err) {
            message.textContent = "Error de conexión. Intenta de nuevo.";
            message.classList.add("visible");
            submitBtn.disabled = false;
            submitBtn.textContent = "Iniciar sesión";
        }
    });
}

// ===== PARTÍCULAS =====
const particlesContainer = document.querySelector(".particles");

if (particlesContainer) {
    const total = 40;

    for (let i = 0; i < total; i++) {
        const span = document.createElement("span");

        // Posición horizontal aleatoria
        span.style.left = Math.random() * 100 + "%";

        // Tamaño aleatorio entre 2px y 5px
        const size = Math.random() * 3 + 2 + "px";
        span.style.width = size;
        span.style.height = size;

        // Duración y retraso aleatorio para que no suban todas juntas
        span.style.animationDuration = (Math.random() * 10 + 6) + "s";
        span.style.animationDelay   = (Math.random() * 8) + "s";

        // Opacidad inicial aleatoria
        span.style.opacity = Math.random() * 0.6 + 0.2;

        particlesContainer.appendChild(span);
    }
}

// ===== FRASES MOTIVACIONALES =====
const frases = [
    "Cada entrenamiento cuenta.",
    "Tu mejor versión empieza hoy.",
    "El esfuerzo de hoy es el resultado de mañana.",
    "Supera tus límites, uno a la vez.",
    "Constancia es la clave del éxito.",
];

const motivationalText = document.getElementById("motivationalText");

if (motivationalText) {
    let index = 0;

    // Muestra la primera frase inmediatamente
    motivationalText.textContent = frases[index];

    setInterval(() => {
        // Fade out
        motivationalText.style.opacity = "0";
        motivationalText.style.transition = "opacity 0.6s ease";

        setTimeout(() => {
            index = (index + 1) % frases.length;
            motivationalText.textContent = frases[index];

            // Fade in
            motivationalText.style.opacity = "0.7";
        }, 600);

    }, 5000);
}