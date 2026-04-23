document.addEventListener("DOMContentLoaded", async () => {

const res = await fetch("/api/eventos");
const eventos = await res.json();

contenedorEventos.innerHTML = "";

eventos.forEach(e => {
const div = document.createElement("div");

div.innerHTML = `
<h3>${e.nombre}</h3>
<p>${e.descripcion}</p>
`;

contenedorEventos.appendChild(div);
});

});