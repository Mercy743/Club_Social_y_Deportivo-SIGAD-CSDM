const lista = document.getElementById("lista");

// cargar
async function cargar() {
  const res = await fetch("/api/actividades");
  const data = await res.json();

  lista.innerHTML = "";

  data.forEach(a => {
    lista.innerHTML += `
      <li>
        ${a.nombre} (${a.capacidad})
        <button onclick="eliminar(${a.id})">X</button>
      </li>
    `;
  });
}

// crear
document.getElementById("formActividad").addEventListener("submit", async (e) => {
  e.preventDefault();

  await fetch("/api/actividades", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      nombre: nombre.value,
      descripcion: descripcion.value,
      capacidad: capacidad.value
    })
  });

  cargar();
});

// eliminar
async function eliminar(id) {
  await fetch(`/api/actividades/${id}`, {
    method: "DELETE"
  });
  cargar();
}

cargar();