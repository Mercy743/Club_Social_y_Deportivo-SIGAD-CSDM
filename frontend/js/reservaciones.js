const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';

document.getElementById('logoutBtn').addEventListener('click', logout);

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}

// Funcionalidad próximamente
document.getElementById('reservacionesContent').innerHTML = `
    <div style="text-align:center; padding:50px;">
        <h3>🎾 Reservaciones</h3>
        <p>Esta funcionalidad estará disponible próximamente</p>
        <p>¡Pronto podrás gestionar todas las reservaciones de canchas!</p>
    </div>
`;