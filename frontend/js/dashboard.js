const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

// Mostrar información del usuario
const userInfoSpan = document.getElementById('userInfo');
if (userInfoSpan) {
    userInfoSpan.textContent = loggedUser.nombre + ' (' + loggedUser.rol + ')';
}

// Avatar con iniciales
const avatarEl = document.getElementById('userAvatar');
if (avatarEl && loggedUser.nombre) {
    const partes = loggedUser.nombre.trim().split(' ');
    const iniciales = partes.length >= 2
        ? partes[0][0] + partes[1][0]
        : partes[0][0];
    avatarEl.textContent = iniciales.toUpperCase();
}

// ===== CONTROL DE ACCESO POR ROL =====
function controlarAccesoPorRol() {
    const rol = loggedUser.rol;

    const accesos = {
    admin:      ['usuarios', 'eventos', 'pagos', 'torneos', 'horarios', 'reservaciones', 'estadisticas', 'actividades'],
    instructor: ['torneos', 'horarios', 'reservaciones', 'actividades'],
    socio:      ['reservaciones', 'actividades', 'torneos', 'horarios', 'eventos']
    };

    const modulosPermitidos = accesos[rol] || ['actividades'];

    document.querySelectorAll('.tile').forEach(tile => {
        const modulo = tile.getAttribute('data-modulo');
        tile.style.display = modulosPermitidos.includes(modulo) ? 'block' : 'none';
    });

    if (rol === 'admin') {
        cargarEstadisticas();
        cargarAlertas();
    } else {
        // Ocultar pills de admin si no es admin
        const sinPagosEl = document.getElementById('sinPagos');
        const inactivosEl = document.getElementById('inactivos');
        if (sinPagosEl) sinPagosEl.closest('.statPill').style.display = 'none';
        if (inactivosEl) inactivosEl.closest('.statPill').style.display = 'none';
    }

    if (rol !== 'admin') {
    document.querySelector('.quickStats--alertas')?.style.setProperty('display', 'none');
    document.getElementById('dashboardStats').style.display = 'none';
    document.querySelectorAll('.section-label').forEach(label => {
        if (label.textContent.includes('Alertas') || label.textContent.includes('Resumen')) {
            label.style.display = 'none';
        }
    });
    }

}

// ===== ESTADÍSTICAS =====
async function cargarEstadisticas() {
    try {
        const res = await fetch(`${API_URL}/estadisticas`);
        const datos = await res.json();

        const statsDiv = document.getElementById('dashboardStats');
        if (!statsDiv) return;

        statsDiv.innerHTML = `
            <div class="statPill">
                <strong>${datos.eventos ?? 0}</strong>
                <span>Eventos</span>
            </div>
            <div class="statPill">
                <strong>${datos.usuarios ?? 0}</strong>
                <span>Usuarios</span>
            </div>
            <div class="statPill">
                <strong>${datos.socios ?? 0}</strong>
                <span>Socios</span>
            </div>
            <div class="statPill">
                <strong>${datos.instructores ?? 0}</strong>
                <span>Instructores</span>
            </div>
            <div class="statPill">
                <strong>${datos.reservacionesHoy ?? 0}</strong>
                <span>Reservaciones hoy</span>
            </div>
            <div class="statPill">
                <strong>${datos.invitadosHoy ?? 0}</strong>
                <span>Invitados hoy</span>
            </div>
            <div class="statPill">
                <strong>${datos.ludotecaActivos ?? 0}</strong>
                <span>Ludoteca activa</span>
            </div>
            <div class="statPill">
                <strong>$${Number(datos.ingresosTotales ?? 0).toLocaleString('es-MX')}</strong>
                <span>Ingresos totales</span>
            </div>
        `;

    } catch (error) {
        console.error('Error estadísticas:', error);
        const statsDiv = document.getElementById('dashboardStats');
        if (statsDiv) statsDiv.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:12px;">No se pudieron cargar las estadísticas</p>';
    }
}

// ===== ALERTAS =====
async function cargarAlertas() {
    try {
        const res = await fetch(`${API_URL}/socios`);
        const socios = await res.json();

        const inactivos = socios.filter(u => !u.activo).length;
        const sinPagos  = socios.filter(u => !u.ultimo_pago).length;

        const inactivosEl = document.getElementById('inactivos');
        const sinPagosEl  = document.getElementById('sinPagos');

        if (inactivosEl) inactivosEl.textContent = inactivos;
        if (sinPagosEl)  sinPagosEl.textContent  = sinPagos;

    } catch (error) {
        console.error('Error alertas:', error);
    }
}

// ===== CERRAR SESIÓN =====
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        localStorage.removeItem('loggedUser');
        window.location.href = 'index.html';
    });
}

// ===== INICIALIZAR =====
controlarAccesoPorRol();