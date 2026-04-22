const API_URL = "/api";
const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));

if (!loggedUser) {
    window.location.href = "index.html";
}

document.getElementById("userInfo").textContent =
    `${loggedUser.nombre} (${loggedUser.rol})`;

/* ===================== VISIBILIDAD POR ROL ===================== */

if (loggedUser.rol === "admin" || loggedUser.rol === "instructor") {
    const eventPanel = document.getElementById("eventPanel");
    if (eventPanel) eventPanel.style.display = "block";
    loadEvents();
}

if (loggedUser.rol === "admin") {
    const userPanel = document.getElementById("userPanel");
    const statsPanel = document.getElementById("statsPanel");

    if (userPanel) userPanel.style.display = "block";
    if (statsPanel) statsPanel.style.display = "block";

    cargarTodosLosUsuarios();
    loadStats();

    const searchBtn = document.getElementById("searchBtn");
    const resetBtn = document.getElementById("resetBtn");
    const searchInput = document.getElementById("searchInput");

    if (searchBtn) searchBtn.addEventListener("click", buscarSocios);

    if (resetBtn) {
        resetBtn.addEventListener("click", function () {
            if (searchInput) searchInput.value = "";
            cargarTodosLosUsuarios();
        });
    }

    if (searchInput) {
        searchInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") buscarSocios();
        });
    }
} else if (loggedUser.rol === "instructor") {
    const userPanel = document.getElementById("userPanel");
    const statsPanel = document.getElementById("statsPanel");

    if (userPanel) userPanel.style.display = "block";
    if (statsPanel) statsPanel.style.display = "none";

    cargarTodosLosUsuarios();
} else {
    const userList = document.getElementById("userList");
    if (userList) {
        userList.innerHTML = `
            <div class="emptyState">
                <h3>No tienes permisos para ver usuarios</h3>
            </div>
        `;
    }
}

/* ===================== EVENTOS ===================== */

async function createEvent() {
    const nombre = document.getElementById("eventName").value.trim();
    const fecha_evento = document.getElementById("eventDate").value;
    const descripcion = document.getElementById("eventDesc").value.trim();

    if (!nombre || !fecha_evento || !descripcion) {
        alert("Completa todos los campos.");
        return;
    }

    try {
        if (window.currentEventId) {
            await fetch(`${API_URL}/eventos/${window.currentEventId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, descripcion, fecha_evento })
            });

            window.currentEventId = null;
        } else {
            await fetch(`${API_URL}/eventos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre,
                    descripcion,
                    fecha_evento,
                    creado_por: loggedUser.id
                })
            });
        }

        document.getElementById("eventName").value = "";
        document.getElementById("eventDate").value = "";
        document.getElementById("eventDesc").value = "";

        loadEvents();
        if (loggedUser.rol === "admin") loadStats();

    } catch (error) {
        console.error(error);
        alert("No se pudo guardar el evento.");
    }
}

async function loadEvents() {
    try {
        const res = await fetch(`${API_URL}/eventos`);
        const eventos = await res.json();

        const list = document.getElementById("eventList");
        if (!list) return;

        list.innerHTML = "";

        if (!eventos.length) {
            list.innerHTML = `
                <div class="emptyState">
                    <h3>No hay eventos registrados</h3>
                    <p>Agrega un evento para comenzar.</p>
                </div>
            `;
            return;
        }

        eventos.forEach(e => {
            const card = document.createElement("article");
            card.className = "eventItem";

            const fecha = e.fecha_evento
                ? new Date(e.fecha_evento).toLocaleDateString("es-MX")
                : "Sin fecha";

            const safeNombre = JSON.stringify(e.nombre);
            const safeDescripcion = JSON.stringify(e.descripcion);
            const safeFecha = JSON.stringify(
                e.fecha_evento ? e.fecha_evento.split("T")[0] : ""
            );

            card.innerHTML = `
                <h3>${e.nombre}</h3>
                <p class="eventMeta">${fecha}</p>
                <p class="eventText">${e.descripcion}</p>
                <div class="eventActions">
                    <button class="secondaryBtn" onclick='editEvent(${e.id_evento}, ${safeNombre}, ${safeDescripcion}, ${safeFecha})'>Editar</button>
                    <button class="dangerBtn" onclick="deleteEvent(${e.id_evento})">Eliminar</button>
                </div>
            `;

            list.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        const list = document.getElementById("eventList");
        if (list) {
            list.innerHTML = `
                <div class="emptyState">
                    <h3>Error al cargar eventos</h3>
                    <p>Verifica el servidor o la base de datos.</p>
                </div>
            `;
        }
    }
}

function editEvent(id, nombre, descripcion, fecha) {
    document.getElementById("eventName").value = nombre;
    document.getElementById("eventDesc").value = descripcion;
    document.getElementById("eventDate").value = fecha;
    window.currentEventId = id;
}

async function deleteEvent(id) {
    try {
        await fetch(`${API_URL}/eventos/${id}`, {
            method: "DELETE"
        });

        loadEvents();
        if (loggedUser.rol === "admin") loadStats();
    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar el evento.");
    }
}

/* ===================== USUARIOS ===================== */

async function cargarTodosLosUsuarios() {
    const userList = document.getElementById("userList");
    if (!userList) return;

    try {
        const res = await fetch(`${API_URL}/usuarios/except/${loggedUser.id}`);
        const usuarios = await res.json();

        let html = '<table border="1" cellpadding="8">';
        html += '<tr>';
        html += '<th>ID</th><th>Nombre</th><th>Apellido</th><th>INE</th><th>Email</th><th>Telefono</th><th>Rol</th>';

        if (loggedUser.rol === "admin") {
            html += '<th>Acciones</th>';
        }

        html += '</tr>';

        usuarios.forEach(u => {
            html += '<tr>';
            html += `<td>${u.id}</td>`;
            html += `<td>${u.nombre || "-"}</td>`;
            html += `<td>${u.apellido || "-"}</td>`;
            html += `<td>${u.ine || "-"}</td>`;
            html += `<td>${u.email || "-"}</td>`;
            html += `<td>${u.telefono || "-"}</td>`;
            html += `<td>${u.rol}</td>`;

            if (loggedUser.rol === "admin") {
                html += '<td>';
                html += `<button onclick="editarUsuario(${u.id})">Editar</button> `;
                html += `<button onclick="eliminarUsuario(${u.id})">Eliminar</button> `;
                html += `<button onclick="abrirPago(${u.id})">Pago</button>`;
                html += '</td>';
            }

            html += '</tr>';
        });

        html += '</table>';
        userList.innerHTML = html;

    } catch (error) {
        console.error(error);
        userList.innerHTML = "Error al cargar usuarios";
    }
}

async function buscarSocios() {
    const searchInput = document.getElementById("searchInput");
    const termino = searchInput ? searchInput.value.trim() : "";

    if (!termino) {
        cargarTodosLosUsuarios();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/socios/buscar?q=${encodeURIComponent(termino)}`);
        const socios = await res.json();

        let html = '<table border="1" cellpadding="8"><tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>INE</th><th>Email</th><th>Telefono</th></tr>';

        socios.forEach(s => {
            html += '<tr>';
            html += `<td>${s.id}</td>`;
            html += `<td>${s.nombre}</td>`;
            html += `<td>${s.apellido}</td>`;
            html += `<td>${s.ine}</td>`;
            html += `<td>${s.email}</td>`;
            html += `<td>${s.telefono}</td>`;
            html += '</tr>';
        });

        html += '</table>';

        const userList = document.getElementById("userList");
        if (userList) userList.innerHTML = html;
    } catch (error) {
        console.error(error);
    }
}

/* ===================== ESTADÍSTICAS ===================== */

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/estadisticas`);
        const data = await res.json();

        const totalEventos = document.getElementById("totalEventos");
        const totalUsuarios = document.getElementById("totalUsuarios");
        const stats = document.getElementById("stats");

        if (totalEventos) totalEventos.textContent = data.eventos;
        if (totalUsuarios) totalUsuarios.textContent = data.usuarios;

        if (stats) {
            stats.innerHTML =
                '<ul>' +
                `<li>Eventos: ${data.eventos}</li>` +
                `<li>Usuarios: ${data.usuarios}</li>` +
                `<li>Socios: ${data.socios ?? "-"}</li>` +
                `<li>Instructores: ${data.instructores ?? "-"}</li>` +
                '</ul>';
        }
    } catch (error) {
        console.error(error);
    }
}

/* ===================== EDITAR USUARIO ===================== */

async function editarUsuario(id) {
    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`);
        const u = await res.json();

        document.getElementById("editId").value = u.id;
        document.getElementById("editNombre").value = u.nombre || "";
        document.getElementById("editApellido").value = u.apellido || "";
        document.getElementById("editEmail").value = u.email || "";
        document.getElementById("editTelefono").value = u.telefono || "";

        document.getElementById("editPanel").style.display = "block";
    } catch (error) {
        console.error(error);
    }
}

async function guardarCambios() {
    const id = document.getElementById("editId").value;

    const data = {
        nombre: document.getElementById("editNombre").value,
        apellido: document.getElementById("editApellido").value,
        email: document.getElementById("editEmail").value,
        telefono: document.getElementById("editTelefono").value
    };

    try {
        await fetch(`${API_URL}/usuarios/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        document.getElementById("editPanel").style.display = "none";
        cargarTodosLosUsuarios();
    } catch (error) {
        console.error(error);
    }
}

let usuarioAEliminar = null;

function eliminarUsuario(id) {
    usuarioAEliminar = id;
    document.getElementById("deletePanel").style.display = "block";
}

const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async function () {
        const password = document.getElementById("deletePassword").value;

        try {
            await fetch(`${API_URL}/usuarios/${usuarioAEliminar}/seguro`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    admin_id: loggedUser.id,
                    password
                })
            });

            document.getElementById("deletePanel").style.display = "none";
            cargarTodosLosUsuarios();
        } catch (error) {
            console.error(error);
        }
    });
}

const guardarBtn = document.getElementById("guardarBtn");
if (guardarBtn) {
    guardarBtn.addEventListener("click", guardarCambios);
}

/* ===================== PAGOS ===================== */

function abrirPago(id) {
    document.getElementById("pagoPanel").style.display = "block";
    document.getElementById("pagoUsuario").value = id;
}

const registrarPagoBtn = document.getElementById("registrarPagoBtn");
if (registrarPagoBtn) {
    registrarPagoBtn.addEventListener("click", async function () {
        const pago = {
            usuario_id: document.getElementById("pagoUsuario").value,
            monto: document.getElementById("pagoMonto").value,
            fecha: document.getElementById("pagoFecha").value,
            metodo_pago: document.getElementById("pagoMetodo").value,
            estado: document.getElementById("pagoEstado").value
        };

        if (!pago.usuario_id || !pago.monto || !pago.fecha) {
            alert("Completa todos los campos");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/pagos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pago)
            });

            if (res.ok) {
                alert("Pago registrado correctamente");
                document.getElementById("pagoPanel").style.display = "none";
                document.getElementById("pagoMonto").value = "";
                document.getElementById("pagoFecha").value = "";
            } else {
                const data = await res.json();
                alert(data.error || "Error al registrar pago");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        }
    });
}

/* ===================== LOGOUT ===================== */

function logout() {
    localStorage.removeItem("loggedUser");
    window.location.href = "index.html";
}