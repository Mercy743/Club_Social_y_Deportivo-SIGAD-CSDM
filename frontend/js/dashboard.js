const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));

if (!loggedUser) {
    window.location.href = "index.html";
}

document.getElementById("userInfo").textContent =
    `${loggedUser.nombre} (${loggedUser.rol})`;

if (loggedUser.rol === "admin" || loggedUser.rol === "instructor") {
    document.getElementById("eventPanel").style.display = "block";
    loadEvents();
}

if (loggedUser.rol === "admin") {
    document.getElementById("statsPanel").style.display = "block";
    loadStats();
}

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
            await fetch(`/api/eventos/${window.currentEventId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, descripcion, fecha_evento })
            });

            window.currentEventId = null;
        } else {
            await fetch("/api/eventos", {
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
        const res = await fetch("/api/eventos");
        const eventos = await res.json();

        const list = document.getElementById("eventList");
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
        document.getElementById("eventList").innerHTML = `
            <div class="emptyState">
                <h3>Error al cargar eventos</h3>
                <p>Verifica el servidor o la base de datos.</p>
            </div>
        `;
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
        await fetch(`/api/eventos/${id}`, {
            method: "DELETE"
        });

        loadEvents();
        if (loggedUser.rol === "admin") loadStats();
    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar el evento.");
    }
}

async function loadStats() {
    try {
        const res = await fetch("/api/estadisticas");
        const data = await res.json();

        document.getElementById("totalEventos").textContent = data.eventos;
        document.getElementById("totalUsuarios").textContent = data.usuarios;
    } catch (error) {
        console.error(error);
    }
}

function logout() {
    localStorage.removeItem("loggedUser");
    window.location.href = "index.html";
}