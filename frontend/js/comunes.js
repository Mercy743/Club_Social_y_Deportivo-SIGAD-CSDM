// ===== FUNCIONES COMPARTIDAS PARA TODO EL SITIO =====

// Generar partículas flotantes
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
    console.log("Partículas generadas");
}

// Cargar footer dinámicamente
function cargarFooter() {
    console.log("Intentando cargar footer...");
    
    // Verificar si ya existe un footer
    if (document.getElementById('footer-container')) {
        console.log("Footer ya existe, no se duplica");
        return;
    }
    
    // Crear el footer directamente sin fetch
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
    
    console.log("Footer agregado al final del body");
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM cargado - Inicializando comunes.js");
    
    // Generar partículas si existe el contenedor
    if (document.querySelector(".particles")) {
        generarParticulas();
    } else {
        console.log("No se encontró .particles");
    }
    
    // Cargar footer en todas las páginas EXCEPTO login y main
    const currentPage = window.location.pathname.split('/').pop();
    console.log("Página actual:", currentPage);
    
    const noFooterPages = ['index.html', 'main.html'];
    
    if (!noFooterPages.includes(currentPage)) {
        console.log("Cargando footer para esta página");
        cargarFooter();
    } else {
        console.log("Footer no cargado (página excluida)");
    }
});