const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';

// ====================== ADMIN ======================

if (loggedUser.rol === 'admin') {
    cargarTodosLosUsuarios();
    cargarEstadisticas();

    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('statsPanel').style.display = 'block';

    document.getElementById('searchBtn').addEventListener('click', buscarSocios);
    document.getElementById('resetBtn').addEventListener('click', function () {
        document.getElementById('searchInput').value = '';
        cargarTodosLosUsuarios();
    });

    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') buscarSocios();
    });
}

// ====================== INSTRUCTOR ======================

else if (loggedUser.rol === 'instructor') {
    cargarTodosLosUsuarios();
    document.getElementById('stats').innerHTML = 'No tienes acceso a las estadisticas.';
    document.getElementById('statsPanel').style.display = 'none';
}

// ====================== SOCIO ======================

else {
    document.getElementById('userList').innerHTML = 'No tienes permisos para ver usuarios.';
    document.getElementById('stats').innerHTML = 'No tienes permisos para ver estadisticas.';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

// ====================== USUARIOS ======================

async function cargarTodosLosUsuarios() {
    try {
        const res = await fetch(API_URL + '/usuarios/except/' + loggedUser.id);
        const usuarios = await res.json();

        let html = '<table border="1" cellpadding="8">';
        html += '<tr>';
        html += '<th>ID</th><th>Nombre</th><th>Apellido</th><th>INE</th><th>Email</th><th>Telefono</th><th>Rol</th>';

        if (loggedUser.rol === 'admin') {
            html += '<th>Acciones</th>';
        }

        html += '</tr>';

        usuarios.forEach(u => {
            html += '<tr>';
            html += '<td>' + u.id + '</td>';
            html += '<td>' + (u.nombre || '-') + '</td>';
            html += '<td>' + (u.apellido || '-') + '</td>';
            html += '<td>' + (u.ine || '-') + '</td>';
            html += '<td>' + (u.email || '-') + '</td>';
            html += '<td>' + (u.telefono || '-') + '</td>';
            html += '<td>' + u.rol + '</td>';

            if (loggedUser.rol === 'admin') {
                html += '<td>';
                html += '<button onclick="editarUsuario(' + u.id + ')">Editar</button> ';
                html += '<button onclick="eliminarUsuario(' + u.id + ')">Eliminar</button> ';
                html += '<button onclick="abrirPago(' + u.id + ')">Pago</button>';
                html += '</td>';
            }

            html += '</tr>';
        });

        html += '</table>';
        document.getElementById('userList').innerHTML = html;

    } catch (error) {
        console.error(error);
        document.getElementById('userList').innerHTML = 'Error al cargar usuarios';
    }
}


function abrirPago(id) {
    document.getElementById('pagoPanel').style.display = 'block';
    document.getElementById('pagoUsuario').value = id;
}


document.getElementById('registrarPagoBtn').addEventListener('click', async function () {

    const pago = {
        usuario_id: document.getElementById('pagoUsuario').value,
        monto: document.getElementById('pagoMonto').value,
        fecha: document.getElementById('pagoFecha').value,
        metodo_pago: document.getElementById('pagoMetodo').value,
        estado: document.getElementById('pagoEstado').value
    };

    if (!pago.usuario_id || !pago.monto || !pago.fecha) {
        alert('Completa todos los campos');
        return;
    }

    try {
        const res = await fetch(API_URL + '/pagos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pago)
        });

        if (res.ok) {
            alert('Pago registrado correctamente');
            document.getElementById('pagoPanel').style.display = 'none';
            document.getElementById('pagoMonto').value = '';
            document.getElementById('pagoFecha').value = '';
        } else {
            const data = await res.json();
            alert(data.error || 'Error al registrar pago');
        }

    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
});

async function buscarSocios() {
    const termino = document.getElementById('searchInput').value.trim();
    if (!termino) return cargarTodosLosUsuarios();

    const res = await fetch(API_URL + '/socios/buscar?q=' + encodeURIComponent(termino));
    const socios = await res.json();

    let html = '<table border="1" cellpadding="8"><tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>INE</th><th>Email</th><th>Telefono</th></tr>';

    socios.forEach(s => {
        html += '<tr>';
        html += '<td>' + s.id + '</td>';
        html += '<td>' + s.nombre + '</td>';
        html += '<td>' + s.apellido + '</td>';
        html += '<td>' + s.ine + '</td>';
        html += '<td>' + s.email + '</td>';
        html += '<td>' + s.telefono + '</td>';
        html += '</tr>';
    });

    html += '</table>';
    document.getElementById('userList').innerHTML = html;
}

async function cargarEstadisticas() {
    const res = await fetch(API_URL + '/estadisticas');
    const datos = await res.json();

    document.getElementById('stats').innerHTML =
        '<ul>' +
        '<li>Eventos: ' + datos.eventos + '</li>' +
        '<li>Usuarios: ' + datos.usuarios + '</li>' +
        '<li>Socios: ' + datos.socios + '</li>' +
        '<li>Instructores: ' + datos.instructores + '</li>' +
        '</ul>';
}

async function editarUsuario(id) {
    const res = await fetch(API_URL + '/usuarios/' + id);
    const u = await res.json();

    document.getElementById('editId').value = u.id;
    document.getElementById('editNombre').value = u.nombre || '';
    document.getElementById('editApellido').value = u.apellido || '';
    document.getElementById('editEmail').value = u.email || '';
    document.getElementById('editTelefono').value = u.telefono || '';

    document.getElementById('editPanel').style.display = 'block';
}

async function guardarCambios() {
    const id = document.getElementById('editId').value;

    const data = {
        nombre: document.getElementById('editNombre').value,
        apellido: document.getElementById('editApellido').value,
        email: document.getElementById('editEmail').value,
        telefono: document.getElementById('editTelefono').value
    };

    await fetch(API_URL + '/usuarios/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    document.getElementById('editPanel').style.display = 'none';
    cargarTodosLosUsuarios();
}

let usuarioAEliminar = null;

function eliminarUsuario(id) {
    usuarioAEliminar = id;
    document.getElementById('deletePanel').style.display = 'block';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async function () {

    const password = document.getElementById('deletePassword').value;

    await fetch(API_URL + '/usuarios/' + usuarioAEliminar + '/seguro', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            admin_id: loggedUser.id,
            password
        })
    });

    document.getElementById('deletePanel').style.display = 'none';
    cargarTodosLosUsuarios();
});

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}

document.getElementById('guardarBtn').addEventListener('click', guardarCambios);