/* ===== LOGIN ===== */
console.log("JS cargado");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = document.getElementById("emailInput").value;
        const password = document.getElementById("passwordInput").value;

        const res = await fetch("http://localhost:3000/api/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            message.textContent = data.error;
            return;
        }

        localStorage.setItem("loggedUser", JSON.stringify(data));

        message.textContent = "Access granted";

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1000);
    });
}

/* ===== FRASES MOTIVACIONALES ===== */
const frases = [
    "Bienvenido a SIGAD, tu rendimiento comienza hoy.",
    "La disciplina supera al talento.",
    "Cada entrenamiento cuenta.",
    "El éxito se construye con constancia.",
    "Actívate hoy, mejora mañana.",
    "Tu mejor versión te está esperando."
];

let index = 0;
const textElement = document.getElementById("motivationalText");

if (textElement) {
    function cambiarFrase() {
        textElement.style.opacity = 0;

        setTimeout(() => {
            textElement.textContent = frases[index];
            textElement.style.opacity = 1;
            index = (index + 1) % frases.length;
        }, 500);
    }

    cambiarFrase();
    setInterval(cambiarFrase, 4000);
}

/* ===== PARTÍCULAS PREMIUM ===== */
document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(".particles");

    if (!container) return;

    for (let i = 0; i < 35; i++) {
        const p = document.createElement("span");

        p.style.left = Math.random() * 100 + "%";
        p.style.animationDuration = (4 + Math.random() * 4) + "s";

        if (Math.random() > 0.7) {
            p.style.background = "rgba(0,102,255,0.9)";
        }

        container.appendChild(p);
    }
});