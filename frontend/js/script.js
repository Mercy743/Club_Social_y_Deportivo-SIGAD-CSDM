const API_URL = '/api';

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

if (loginForm) {
    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        
        message.textContent = "Conectando...";
        message.style.color = "#54cfe0";
        
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                if (res.status === 409) {
                    message.textContent = data.error || "Ya hay una sesión activa en otro dispositivo. Ciérrala primero.";
                } else {
                    message.textContent = data.error || "Error al iniciar sesión";
                }
                message.style.color = "#ff6b6b";
                return;
            }
            
            message.textContent = "¡Éxito! Redirigiendo...";
            message.style.color = "#54cfe0";
            
            // Guardar token y datos del usuario
            localStorage.setItem("token", data.token);
            localStorage.setItem("loggedUser", JSON.stringify(data));
            
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1000);
            
        } catch (error) {
            console.error("Error:", error);
            message.textContent = "Error de conexión con el servidor.";
            message.style.color = "#ff6b6b";
        }
    });
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
    motivationalText.textContent = frases[index];
    setInterval(() => {
        motivationalText.style.opacity = "0";
        setTimeout(() => {
            index = (index + 1) % frases.length;
            motivationalText.textContent = frases[index];
            motivationalText.style.opacity = "0.7";
        }, 600);
    }, 5000);
}