const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

// Verificar sesión
if (!loggedUser) {
    window.location.href = 'index.html';
}

// Mostrar información del usuario
const userInfoSpan = document.getElementById('userInfo');
if (userInfoSpan) {
    userInfoSpan.textContent = loggedUser.nombre + ' (' + loggedUser.rol + ')';
}

// ===== CONTROL DE ACCESO POR ROL =====
function controlarAccesoPorRol() {
    const rol = loggedUser.rol;
    
    // Módulos que puede ver cada rol
    const accesos = {
        admin: ['usuarios', 'eventos', 'pagos', 'torneos', 'reservaciones', 'estadisticas', 'actividades'],
        instructor: ['torneos', 'reservaciones', 'actividades'],
        socio: ['pagos', 'torneos', 'reservaciones', 'actividades']
    };
    
    const modulosPermitidos = accesos[rol] || ['actividades'];
    
    // Ocultar/mostrar tiles según el rol
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        const modulo = tile.getAttribute('data-modulo');
        if (modulosPermitidos.includes(modulo)) {
            tile.style.display = 'block';
        } else {
            tile.style.display = 'none';
        }
    });
    
    // Mostrar/ocultar estadísticas (solo admin)
    const statsContainer = document.getElementById('statsContainer');
    if (statsContainer) {
        if (rol === 'admin') {
            statsContainer.style.display = 'block';
            cargarEstadisticas();
            cargarAlertas();
        } else {
            statsContainer.style.display = 'none';
        }
    }
}

// ===== FUNCIONES =====

async function cargarEstadisticas() {
    if (loggedUser.rol !== 'admin') return;
    
    try {
        const res = await fetch(`${API_URL}/estadisticas`);
        const datos = await res.json();
        
        let html = '<div class="quickStats">';
        html += `<div class="statPill"><strong>${datos.eventos}</strong><span>Eventos</span></div>`;
        html += `<div class="statPill"><strong>${datos.usuarios}</strong><span>Usuarios</span></div>`;
        html += `<div class="statPill"><strong>${datos.socios}</strong><span>Socios</span></div>`;
        html += `<div class="statPill"><strong>${datos.instructores}</strong><span>Instructores</span></div>`;
        html += '</div>';
        
        const statsDiv = document.getElementById('dashboardStats');
        if (statsDiv) statsDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error estadísticas:', error);
    }
}

async function cargarAlertas() {
    if (loggedUser.rol !== 'admin') return;
    
    try {
        const res = await fetch(`${API_URL}/usuarios`);
        const usuarios = await res.json();
        
        const inactivos = usuarios.filter(u => !u.activo).length;
        const sinPagos = usuarios.filter(u => !u.ultimo_pago).length;
        
        const inactivosSpan = document.getElementById('inactivos');
        const sinPagosSpan = document.getElementById('sinPagos');
        
        if (inactivosSpan) inactivosSpan.textContent = inactivos;
        if (sinPagosSpan) sinPagosSpan.textContent = sinPagos;
        
    } catch (error) {
        console.error('Error alertas:', error);
    }
}

// Botón de cerrar sesión
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('loggedUser');
        window.location.href = 'index.html';
    });
}

// Inicializar
controlarAccesoPorRol();