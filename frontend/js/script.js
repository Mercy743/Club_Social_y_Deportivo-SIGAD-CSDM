const API_URL = '/api';

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

if (loginForm) {
    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        
        // Ocultar mensaje anterior si existía
        if (message) {
            message.classList.remove('visible');
            message.textContent = "Conectando...";
            message.style.color = "#54cfe0";
            message.classList.add('visible');
        }
        
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                let errorMsg = data.error || "Error al iniciar sesión";
                if (res.status === 409) {
                    errorMsg = data.error || "Ya hay una sesión activa en otro dispositivo. Ciérrala primero.";
                } else if (res.status === 401) {
                    errorMsg = "Credenciales incorrectas. Verifica tu email y contraseña.";
                }
                if (message) {
                    message.textContent = errorMsg;
                    message.style.color = "#ff6b6b";
                    message.classList.add('visible');
                }
                return;
            }
            
            // Login exitoso
            if (message) {
                message.textContent = "¡Éxito! Redirigiendo...";
                message.style.color = "#54cfe0";
                message.classList.add('visible');
            }
            
            localStorage.setItem("token", data.token);
            localStorage.setItem("loggedUser", JSON.stringify(data));
            
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1000);
            
        } catch (error) {
            console.error("Error:", error);
            if (message) {
                message.textContent = "Error de conexión con el servidor.";
                message.style.color = "#ff6b6b";
                message.classList.add('visible');
            }
        }
    });
}

// Frases motivacionales (sin cambios)
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

document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input.type === 'password') {
            input.type = 'text';
            this.textContent = '🙈';
        } else {
            input.type = 'password';
            this.textContent = '👁️';
        }
    });
});