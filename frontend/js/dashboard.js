const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

// Inicializar dashboard
if (loggedUser.rol === 'admin') {
    cargarDashboard();
} else {
    document.getElementById('dashboardStats').innerHTML = '';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

async function cargarDashboard() {
    await Promise.all([
        cargarEstadisticas(),
        cargarAlertas()
    ]);
}

async function cargarEstadisticas() {
    try {
        const res = await fetch(API_URL + '/estadisticas');
        const datos = await res.json();

        document.getElementById('dashboardStats').innerHTML =
            '<div class="statBox"><span>Eventos</span><strong>'     + datos.eventos      + '</strong></div>' +
            '<div class="statBox"><span>Usuarios</span><strong>'    + datos.usuarios     + '</strong></div>' +
            '<div class="statBox"><span>Socios</span><strong>'      + datos.socios       + '</strong></div>' +
            '<div class="statBox"><span>Instructores</span><strong>'+ datos.instructores + '</strong></div>';

    } catch (error) {
        console.error('Error estadísticas:', error);
        document.getElementById('dashboardStats').innerHTML = '';
    }
}

async function cargarAlertas() {
    try {
        const res = await fetch(API_URL + '/usuarios');
        const usuarios = await res.json();

        document.getElementById('inactivos').textContent = usuarios.filter(u => !u.activo).length;
        document.getElementById('sinPagos').textContent  = usuarios.filter(u => !u.ultimo_pago).length || 0;

    } catch (error) {
        console.error('Error alertas:', error);
    }
}

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}