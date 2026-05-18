const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';

// ADMIN: Ve todo
if (loggedUser.rol === 'admin') {
    cargarTodosLosUsuarios();
    cargarEstadisticas();

    const statsPanel = document.getElementById('statsPanel');
    if (statsPanel) {
        statsPanel.style.display = 'block';
    }
    
    document.getElementById('searchBtn').addEventListener('click', buscarSocios);
    document.getElementById('resetBtn').addEventListener('click', function() {
        document.getElementById('searchInput').value = '';
        cargarTodosLosUsuarios();
    });
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarSocios();
        }
    });
}

// INSTRUCTOR: Ve usuarios, NO estadísticas, NO cambiar roles
else if (loggedUser.rol === 'instructor') {
    cargarTodosLosUsuarios();
    document.getElementById('stats').innerHTML = 'No tienes acceso a las estadisticas.';
    document.getElementById('statsPanel').style.display = 'none';
}

// SOCIO: No ve usuarios, no ve estadisticas
else {
    document.getElementById('userList').innerHTML = 'No tienes permisos para ver la lista de usuarios.';
    document.getElementById('stats').innerHTML = 'No tienes permisos para ver estadisticas.';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

// FUNCIONES
async function cargarTodosLosUsuarios() {
    try {
        const res = await fetch(API_URL + '/usuarios/except/' + loggedUser.id);
        const usuarios = await res.json();
        
        if (usuarios.length === 0) {
            document.getElementById('userList').innerHTML = 'No hay otros usuarios registrados';
            return;
        }
        
        let html = '<table border="1" cellpadding="8">';
        html += '<thead><tr>';
        html += '<th>ID</th>';
        html += '<th>Nombre</th>';
        html += '<th>Apellido</th>';
        html += '<th>INE</th>';
        html += '<th>Email</th>';
        html += '<th>Telefono</th>';
        html += '<th>Rol</th>';
        
        // Solo admin puede cambiar roles
        if (loggedUser.rol === 'admin') {
            html += '<th>Accion</th>';
        }
        
        html += '</tr></thead><tbody>';
        
        for (let i = 0; i < usuarios.length; i++) {
            const u = usuarios[i];
            html += '<tr>';
            html += '<td>' + u.id + '</td>';
            html += '<td>' + (u.nombre || '-') + '</td>';
            html += '<td>' + (u.apellido || '-') + '</td>';
            html += '<td>' + (u.ine || '-') + '</td>';
            html += '<td>' + (u.email || '-') + '</td>';
            html += '<td>' + (u.telefono || '-') + '</td>';
            html += '<td>' + u.rol + '</td>';
            
            // Solo admin puede cambiar roles
            if (loggedUser.rol === 'admin') {
                html += '<td>';
                html += '<select data-id="' + u.id + '" class="rol-select">';
                html += '<option value="1"' + (u.rol_id === 1 ? ' selected' : '') + '>Socio</option>';
                html += '<option value="2"' + (u.rol_id === 2 ? ' selected' : '') + '>Instructor</option>';
                html += '<option value="3"' + (u.rol_id === 3 ? ' selected' : '') + '>Admin</option>';
                html += '</select>';
                html += '</td>';
            }
            
            html += '</tr>';
        }
        
        html += '</tbody></table>';
        document.getElementById('userList').innerHTML = html;
        
        if (loggedUser.rol === 'admin') {
            document.querySelectorAll('.rol-select').forEach(function(select) {
                select.addEventListener('change', function(e) {
                    const usuarioId = parseInt(select.getAttribute('data-id'));
                    const nuevoRolId = parseInt(select.value);
                    cambiarRol(usuarioId, nuevoRolId);
                });
            });
        }
        
    } catch (error) {
        console.error(error);
        document.getElementById('userList').innerHTML = 'Error al cargar usuarios';
    }
}

async function buscarSocios() {
    if (loggedUser.rol !== 'admin') return;
    
    const termino = document.getElementById('searchInput').value.trim();
    
    if (termino === '') {
        cargarTodosLosUsuarios();
        return;
    }
    
    try {
        const res = await fetch(API_URL + '/socios/buscar?q=' + encodeURIComponent(termino));
        const socios = await res.json();
        
        if (socios.length === 0) {
            document.getElementById('userList').innerHTML = 'No se encontró socio con ese ID, INE o Correo';
            return;
        }
        
        let html = '<table border="1" cellpadding="8">';
        html += '<thead><tr>';
        html += '<th>ID</th>';
        html += '<th>Nombre</th>';
        html += '<th>Apellido</th>';
        html += '<th>INE</th>';
        html += '<th>Correo</th>';
        html += '<th>Teléfono</th>';
        html += '</tr></thead><tbody>';
        
        for (let i = 0; i < socios.length; i++) {
            const s = socios[i];
            html += '<tr>';
            html += '<td>' + s.id + '</td>';
            html += '<td>' + (s.nombre || '-') + '</td>';
            html += '<td>' + (s.apellido || '-') + '</td>';
            html += '<td>' + (s.ine || '-') + '</td>';
            html += '<td>' + (s.email || '-') + '</td>';
            html += '<td>' + (s.telefono || '-') + '</td>';
            html += '</tr>';
        }
        
        html += '</tbody></table>';
        document.getElementById('userList').innerHTML = html;
        
    } catch (error) {
        console.error(error);
        document.getElementById('userList').innerHTML = 'Error al buscar socio';
    }
}

async function cargarEstadisticas() {
    if (loggedUser.rol !== 'admin') return;
    
    try {
        const res = await fetch(API_URL + '/estadisticas');
        const datos = await res.json();
        
        let html = '<ul>';
        html += '<li>Total de eventos: ' + datos.eventos + '</li>';
        html += '<li>Total de usuarios: ' + datos.usuarios + '</li>';
        html += '<li>Total de socios: ' + datos.socios + '</li>';
        html += '<li>Total de instructores: ' + datos.instructores + '</li>';
        html += '</ul>';
        
        document.getElementById('stats').innerHTML = html;
        
    } catch (error) {
        console.error(error);
        document.getElementById('stats').innerHTML = 'Error al cargar estadisticas';
    }
}

async function cambiarRol(usuarioId, nuevoRolId) {
    if (loggedUser.rol !== 'admin') return;
    
    const confirmar = confirm('¿Estas seguro de cambiar el rol de este usuario?');
    if (!confirmar) {
        cargarTodosLosUsuarios();
        return;
    }
    
    try {
        const res = await fetch(API_URL + '/usuarios/' + usuarioId + '/rol', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rol_id: nuevoRolId,
                admin_id: loggedUser.id
            })
        });
        
        if (res.ok) {
            alert('Rol actualizado correctamente');
            cargarTodosLosUsuarios();
            cargarEstadisticas();
        } else {
            const data = await res.json();
            alert('Error: ' + data.error);
            cargarTodosLosUsuarios();
        }
        
    } catch (error) {
        alert('Error de conexion con el servidor');
        cargarTodosLosUsuarios();
    }
}

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}