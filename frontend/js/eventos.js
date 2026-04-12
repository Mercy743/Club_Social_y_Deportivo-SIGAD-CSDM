document.addEventListener("DOMContentLoaded", async () => {
    const contenedor = document.getElementById("contenedorEventos");

    try {
        const res = await fetch("/api/eventos");

        if (!res.ok) throw new Error("Error");

        const eventos = await res.json();

        contenedor.innerHTML = "";

        if (!eventos.length) {
            contenedor.innerHTML = `
                <div class="emptyState">
                    <h3>No hay eventos</h3>
                    <p>Aún no hay actividades registradas</p>
                </div>
            `;
            return;
        }

        eventos.forEach(e => {
            const fecha = new Date(e.fecha_evento).toLocaleDateString("es-MX");

            const card = document.createElement("div");
            card.classList.add("eventCard");

            card.innerHTML = `
                <h3>${e.nombre}</h3>
                <p class="date">${fecha}</p>
                <p class="desc">${e.descripcion}</p>
            `;

            contenedor.appendChild(card);
        });

    } catch (error) {
        contenedor.innerHTML = `
            <div class="emptyState">
                <h3>Error al cargar eventos</h3>
            </div>
        `;
    }
});