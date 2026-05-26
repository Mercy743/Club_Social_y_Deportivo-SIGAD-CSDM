// ===== API REQUEST CON TOKEN =====
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "index.html";
        throw new Error("No hay sesión activa");
    }

    options.headers = options.headers || {};
    options.headers["Authorization"] = `Bearer ${token}`;

    if (!options.headers["Content-Type"] && !(options.body instanceof FormData)) {
        options.headers["Content-Type"] = "application/json";
    }

    try {
        const res = await fetch(url, options);
        if (res.status === 401) {
            alert("Tu sesión ha expirado. Inicia sesión nuevamente.");
            localStorage.removeItem("token");
            localStorage.removeItem("loggedUser");
            window.location.href = "index.html";
            throw new Error("Sesión expirada");
        }
        return res;
    } catch (error) {
        console.error("apiRequest error:", error);
        throw error;
    }
}

// ===== LOGOUT =====
async function logout() {
    const token = localStorage.getItem("token");
    if (token) {
        try {
            await fetch("/api/logout", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
        } catch(e) {
            console.error("Error cerrando sesión en servidor", e);
        }
    }
    localStorage.removeItem("token");
    localStorage.removeItem("loggedUser");
    window.location.href = "index.html";
}

// ===== PARTÍCULAS =====
function generarParticulas() {
    const particlesContainer = document.querySelector(".particles");
    if (!particlesContainer) return;
    particlesContainer.innerHTML = "";
    const total = 40;
    for (let i = 0; i < total; i++) {
        const span = document.createElement("span");
        span.style.left = Math.random() * 100 + "%";
        const size = Math.random() * 3 + 2 + "px";
        span.style.width = size;
        span.style.height = size;
        span.style.animationDuration = (Math.random() * 10 + 6) + "s";
        span.style.animationDelay = (Math.random() * 8) + "s";
        span.style.opacity = Math.random() * 0.6 + 0.2;
        particlesContainer.appendChild(span);
    }
}

// ===== FOOTER =====
function cargarFooter() {
    if (document.getElementById('footer-container')) return;
    const footerHTML = `
        <footer class="footer-sigad">
            <div class="footer-content">
                <div class="footer-brand">
                    <h3>SIGAD</h3>
                    <p>Sistema de Gestión Deportiva</p>
                </div>
                <div class="footer-links">
                    <a href="dashboard.html">Dashboard</a>
                    <a href="actividades.html">Actividades</a>
                    <a href="eventos.html">Eventos</a>
                </div>
                <div class="footer-copyright">
                    <p>&copy; 2025 SIGAD - Todos los derechos reservados</p>
                </div>
            </div>
        </footer>
    `;
    const footerContainer = document.createElement('div');
    footerContainer.id = 'footer-container';
    footerContainer.innerHTML = footerHTML;
    document.body.appendChild(footerContainer);
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector(".particles")) generarParticulas();
    const currentPage = window.location.pathname.split('/').pop();
    const noFooterPages = ['index.html', 'main.html'];
    if (!noFooterPages.includes(currentPage)) cargarFooter();
    
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.removeEventListener("click", logout);
        logoutBtn.addEventListener("click", logout);
    }
});