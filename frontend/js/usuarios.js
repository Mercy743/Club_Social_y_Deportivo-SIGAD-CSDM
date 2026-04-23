const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';
document.getElementById('logoutBtn').addEventListener('click', logout);

cargarTodosLosUsuarios();

document.getElementById('searchBtn').addEventListener('click', buscarSocios);
document.getElementById('resetBtn').addEventListener('click', function () {
    document.getElementById('searchInput').value = '';
    cargarTodosLosUsuarios();
});
document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') buscarSocios();
});

async function cargarTodosLosUsuarios() {
    try {
        const res = await fetch(API_URL + '/usuarios/except/' + loggedUser.id);
        const usuarios = await res.json();

        let html = '<table border="1" cellpadding="8">';
        html += '<tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>INE</th><th>Email</th><th>Teléfono</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>';

        usuarios.forEach(u => {
            const estado = u.activo ? 'Activo' : 'Inactivo';
            html += '<tr data-user-id="' + u.id + '">';
            html += '<td>' + u.id + '</td>';
            html += '<td>' + (u.nombre   || '-') + '</td>';
            html += '<td>' + (u.apellido || '-') + '</td>';
            html += '<td>' + (u.ine      || '-') + '</td>';
            html += '<td>' + (u.email    || '-') + '</td>';
            html += '<td>' + (u.telefono || '-') + '</td>';
            html += '<td>' + u.rol + '</td>';
            html += '<td>' + estado + '</td>';
            html += '<td>';
            html += '<button class="editBtn primaryBtn"> Editar</button> ';
            html += '<button class="deleteBtn" style="background:#e74c3c;color:white;"> Eliminar</button>';
            html += '</td>';
            html += '</tr>';
        });

        html += '</table>';
        document.getElementById('userList').innerHTML = html;

        // Listeners de editar
        document.querySelectorAll('.editBtn').forEach(btn => {
            btn.addEventListener('click', function () {
                const userId = this.closest('tr').dataset.userId;
                editarUsuario(userId);
            });
        });

        // Listeners de eliminar — igual que editar
        document.querySelectorAll('.deleteBtn').forEach(btn => {
            btn.addEventListener('click', function () {
                const userId = this.closest('tr').dataset.userId;
                confirmarEliminar(userId);
            });
        });

    } catch (error) {
        console.error(error);
        document.getElementById('userList').innerHTML = 'Error al cargar usuarios';
    }
}

async function buscarSocios() {
    const termino = document.getElementById('searchInput').value.trim();
    if (!termino) return cargarTodosLosUsuarios();

    const res = await fetch(API_URL + '/socios/buscar?q=' + encodeURIComponent(termino));
    const socios = await res.json();

    let html = '<table border="1" cellpadding="8"><tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>INE</th><th>Email</th><th>Teléfono</th></tr>';
    socios.forEach(s => {
        html += '<tr>';
        html += '<td>' + s.id       + '</td>';
        html += '<td>' + s.nombre   + '</td>';
        html += '<td>' + s.apellido + '</td>';
        html += '<td>' + s.ine      + '</td>';
        html += '<td>' + s.email    + '</td>';
        html += '<td>' + s.telefono + '</td>';
        html += '</tr>';
    });
    html += '</table>';
    document.getElementById('userList').innerHTML = html;
}

async function editarUsuario(id) {
    const res = await fetch(API_URL + '/usuarios/' + id);
    const u = await res.json();

    document.getElementById('editId').value       = u.id;
    document.getElementById('editNombre').value   = u.nombre   || '';
    document.getElementById('editApellido').value = u.apellido || '';
    document.getElementById('editEmail').value    = u.email    || '';
    document.getElementById('editTelefono').value = u.telefono || '';

    document.getElementById('editPanel').style.display    = 'block';
    document.getElementById('modalBackdrop').style.display = 'block';
}

async function guardarCambios() {
    const id = document.getElementById('editId').value;
    const data = {
        nombre:   document.getElementById('editNombre').value,
        apellido: document.getElementById('editApellido').value,
        email:    document.getElementById('editEmail').value,
        telefono: document.getElementById('editTelefono').value
    };

    await fetch(API_URL + '/usuarios/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    cerrarEditar();
    cargarTodosLosUsuarios();
}

function cerrarEditar() {
    document.getElementById('editPanel').style.display    = 'none';
    document.getElementById('modalBackdrop').style.display = 'none';
}

function cerrarTodo() {
    cerrarEditar();
    cerrarEliminar();
}

let usuarioAEliminar = null;

function confirmarEliminar(id) {
    usuarioAEliminar = id;
    document.getElementById('deletePassword').value        = '';
    document.getElementById('deletePanel').style.display   = 'block';
    document.getElementById('modalBackdrop').style.display = 'block';
}

function cerrarEliminar() {
    usuarioAEliminar = null;
    document.getElementById('deletePanel').style.display   = 'none';
    document.getElementById('modalBackdrop').style.display = 'none';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async function () {
    const password = document.getElementById('deletePassword').value;

    if (!password) {
        alert('Ingresa la contraseña');
        return;
    }

    try {
        const res = await fetch(API_URL + '/usuarios/' + usuarioAEliminar + '/seguro', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: loggedUser.id,
                password: password
            })
        });

        if (res.ok) {
            alert('Usuario eliminado correctamente');
            cerrarEliminar();
            cargarTodosLosUsuarios();
        } else {
            const data = await res.json();
            alert(JSON.stringify(data));
        }

    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
});

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}