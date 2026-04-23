const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';

if (loggedUser.rol === 'admin') {
    document.getElementById('welcomeMessage').textContent = '¿Qué quieres hacer hoy?';
    cargarDashboard();
    document.getElementById('statsPanel').style.display = 'block';
} else {
    document.getElementById('welcomeMessage').textContent = 'Bienvenido al panel';
    document.getElementById('statsPanel').style.display = 'none';
    document.getElementById('dashboardStats').innerHTML = 'No tienes acceso a estadísticas';
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

        const html = 
            '<div class="statBox"><span>Eventos</span><strong>' + datos.eventos + '</strong></div>' +
            '<div class="statBox"><span>Usuarios</span><strong>' + datos.usuarios + '</strong></div>' +
            '<div class="statBox"><span>Socios</span><strong>' + datos.socios + '</strong></div>' +
            '<div class="statBox"><span>Instructores</span><strong>' + datos.instructores + '</strong></div>';
        
        document.getElementById('dashboardStats').innerHTML = html;
    } catch (error) {
        console.error('Error estadísticas:', error);
        document.getElementById('dashboardStats').innerHTML = 'Error cargando estadísticas';
    }
}

async function cargarAlertas() {
    try {
        const res = await fetch(API_URL + '/usuarios');
        const usuarios = await res.json();
        
        const inactivos = usuarios.filter(u => !u.activo).length;
        const sinPagos = usuarios.filter(u => !u.ultimo_pago).length || 0;
        
        document.getElementById('inactivos').textContent = inactivos;
        document.getElementById('sinPagos').textContent = sinPagos;
    } catch (error) {
        console.error('Error alertas:', error);
    }
}

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}