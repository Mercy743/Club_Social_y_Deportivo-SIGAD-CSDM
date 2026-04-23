const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

//document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';
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

        if (!usuarios.length) {
            document.getElementById('userList').innerHTML = '<div class="emptyState">No hay usuarios registrados.</div>';
            return;
        }

        let html = `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            ${['ID','Nombre','Apellido','INE','Email','Teléfono','Rol','Estado','Acciones'].map(h => `
                                <th style="padding:12px 14px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.4); font-size:11px; letter-spacing:1px; text-transform:uppercase; white-space:nowrap;">${h}</th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${usuarios.map(u => `
                            <tr data-user-id="${u.id}" style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                <td style="padding:12px 14px; color:rgba(255,255,255,0.35); font-size:13px;">${u.id}</td>
                                <td style="padding:12px 14px; color:white; font-weight:600; font-size:14px;">${u.nombre || '—'}</td>
                                <td style="padding:12px 14px; color:rgba(255,255,255,0.7); font-size:13px;">${u.apellido || '—'}</td>
                                <td style="padding:12px 14px; color:rgba(255,255,255,0.5); font-size:13px;">${u.ine || '—'}</td>
                                <td style="padding:12px 14px; color:rgba(255,255,255,0.7); font-size:13px;">${u.email || '—'}</td>
                                <td style="padding:12px 14px; color:rgba(255,255,255,0.5); font-size:13px;">${u.telefono || '—'}</td>
                                <td style="padding:12px 14px;">
                                    <span style="background:rgba(14,104,115,0.2); color:#54cfe0; border:1px solid rgba(14,104,115,0.3); border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600;">
                                        ${u.rol}
                                    </span>
                                </td>
                                <td style="padding:12px 14px;">
                                    <span style="background:${u.activo ? 'rgba(14,104,115,0.15)' : 'rgba(228,32,27,0.15)'}; color:${u.activo ? '#54cfe0' : '#ff6b6b'}; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600;">
                                        ${u.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td style="padding:12px 14px;">
                                    <div style="display:flex; gap:8px;">
                                        <button class="editBtn secondaryBtn" style="margin:0; max-width:none; padding:8px 14px; font-size:12px;">Editar</button>
                                        <button class="deleteBtn dangerBtn" style="margin:0; max-width:none; padding:8px 14px; font-size:12px;">Eliminar</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        document.getElementById('userList').innerHTML = html;

        document.querySelectorAll('.editBtn').forEach(btn => {
            btn.addEventListener('click', function() {
                editarUsuario(this.closest('tr').dataset.userId);
            });
        });

        document.querySelectorAll('.deleteBtn').forEach(btn => {
            btn.addEventListener('click', function() {
                confirmarEliminar(this.closest('tr').dataset.userId);
            });
        });

    } catch (error) {
        console.error(error);
        document.getElementById('userList').innerHTML = '<div class="emptyState">Error al cargar usuarios.</div>';
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