const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));

if (!loggedUser) window.location.href = "index.html";

document.getElementById("userInfo").textContent =
`${loggedUser.nombre} (${loggedUser.rol})`;

if (loggedUser.rol === "admin" || loggedUser.rol === "instructor") {
document.getElementById("eventPanel").style.display = "block";
loadEvents();
}

if (loggedUser.rol === "admin") {
document.getElementById("statsPanel").style.display = "block";
document.getElementById("userPanel").style.display = "block";

loadStats();
loadUsers();
}

/* EVENTOS */

async function createEvent() {
const nombre = eventName.value;
const fecha_evento = eventDate.value;
const descripcion = eventDesc.value;

await fetch("/api/eventos", {
method: "POST",
headers: {"Content-Type": "application/json"},
body: JSON.stringify({
nombre,
descripcion,
fecha_evento,
creado_por: loggedUser.id
})
});

loadEvents();
loadStats();
}

async function loadEvents() {
const res = await fetch("/api/eventos");
const eventos = await res.json();

eventList.innerHTML = "";

eventos.forEach(e => {
const div = document.createElement("div");

div.innerHTML = `
<h3>${e.nombre}</h3>
<p>${e.descripcion}</p>
<button onclick="deleteEvent(${e.id_evento})">Eliminar</button>
`;

eventList.appendChild(div);
});
}

async function deleteEvent(id) {
await fetch(`/api/eventos/${id}`, { method: "DELETE" });
loadEvents();
loadStats();
}

/* STATS */

async function loadStats() {
const res = await fetch("/api/estadisticas");
const data = await res.json();

totalEventos.textContent = data.eventos;
totalUsuarios.textContent = data.usuarios;
}

/* USUARIOS */

async function loadUsers() {
const res = await fetch("/api/usuarios");
const usuarios = await res.json();

userList.innerHTML = "";

usuarios.forEach(u => {
const div = document.createElement("div");

div.innerHTML = `
<h3>${u.nombre}</h3>
<p>${u.rol}</p>

<select onchange="changeRole(${u.id}, this.value)">
<option value="1" ${u.rol_id==1?"selected":""}>Admin</option>
<option value="2" ${u.rol_id==2?"selected":""}>Instructor</option>
<option value="3" ${u.rol_id==3?"selected":""}>Socio</option>
</select>
`;

userList.appendChild(div);
});
}

async function changeRole(usuario_id, rol_id) {
await fetch("/api/actualizar-rol", {
method: "PUT",
headers: {"Content-Type": "application/json"},
body: JSON.stringify({ usuario_id, rol_id })
});

loadUsers();
}

/* LOGOUT */

function logout() {
localStorage.removeItem("loggedUser");
window.location.href = "index.html";
}