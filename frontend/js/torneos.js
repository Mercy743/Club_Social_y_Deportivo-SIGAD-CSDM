const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';

document.getElementById('logoutBtn').addEventListener('click', logout);

async function cargarTorneos() {
    try {
        const res = await fetch(API_URL + '/torneos');
        const torneos = await res.json();
        
        let html = '<table border="1" cellpadding="8" style="width:100%;">';
        html += '<tr><th>Nombre</th><th>Estado</th><th>Fecha Inicio</th><th>Acciones</th></tr>';
        
        torneos.forEach(t => {
            html += `<tr>
                <td>${t.nombre}</td>
                <td>${t.estado}</td>
                <td>${t.fecha_inicio}</td>
                <td><button>Editar</button></td>
            </tr>`;
        });
        
        html += '</table>';
        document.getElementById('torneosList').innerHTML = html;
    } catch (error) {
        document.getElementById('torneosList').innerHTML = 'Error cargando torneos';
    }
}

cargarTorneos();

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}