document.addEventListener("DOMContentLoaded", () => {

const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
};

flatpickr("#fecha", {
    dateFormat: "Y-m-d",
    minDate: "today"
});

const lista = document.getElementById('reservacionesList');

function generarHoras() {
    let horas = [];
    for (let h = 6; h <= 22; h++) {
        horas.push((h < 10 ? '0' : '') + h + ":00");
    }
    return horas;
}

function llenarLista(idInput, idLista) {
    const input = document.getElementById(idInput);
    const lista = document.getElementById(idLista);

    generarHoras().forEach(h => {
        const div = document.createElement("div");
        div.textContent = h;
        div.onclick = () => {
            input.value = h;
            lista.style.display = "none";
        };
        lista.appendChild(div);
    });

    input.onclick = () => lista.style.display = "block";
}

llenarLista("horaInicio", "listaInicio");
llenarLista("horaFin", "listaFin");

async function cargarEspacios() {
    const res = await fetch(API_URL + '/espacios');
    const data = await res.json();

    document.getElementById('tablaEspacios').innerHTML = `
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Capacidad</th>
            </tr>
        </thead>
        <tbody>
            ${data.map((e,i)=>`
                <tr onclick="seleccionarEspacio(${e.id}, this)">
                    <td>${i+1}</td>
                    <td>${e.nombre}</td>
                    <td>${e.tipo}</td>
                    <td>${e.capacidad || '-'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    `;
}

window.seleccionarEspacio = (id, fila) => {
    document.getElementById('espacio').value = id;
    document.querySelectorAll('#tablaEspacios tr').forEach(tr=>tr.classList.remove('selectedRow'));
    fila.classList.add('selectedRow');
};

async function cargarReservaciones() {
    const res = await fetch(API_URL + '/reservaciones?usuario_id=' + loggedUser.id);
    const data = await res.json();

    const activas = data.filter(r => r.estado !== 'cancelada');

    lista.innerHTML = activas.length ? `
    <div class="eventListGrid">
        ${activas.map(r=>`
            <div class="eventItem">
                <h3>${r.espacio_nombre}</h3>
                <p>${r.usuario_nombre}</p>
                <p>${new Date(r.fecha_reserva).toLocaleDateString()}</p>
                <p>${r.hora_inicio} - ${r.hora_fin}</p>
                <button onclick="cancelar(${r.id})">Cancelar</button>
            </div>
        `).join('')}
    </div>` : '<p style="opacity:.5;padding:16px">Sin reservaciones activas.</p>';
}

window.cancelar = async (id, btn) => {
    if (!confirm('¿Cancelar esta reservación?')) return;
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/reservaciones/${id}/cancelar`, { method: 'PUT' });
        if (!res.ok) throw new Error();
        await cargarReservaciones();
    } catch {
        alert('No se pudo cancelar. Intenta de nuevo.');
        if (btn) { btn.disabled = false; }
    }
};

document.getElementById('guardarBtn').onclick = async () => {

    const body = {
        usuario_id: loggedUser.id,
        espacio_id: document.getElementById('espacio').value,
        fecha_reserva: document.getElementById('fecha').value,
        hora_inicio: document.getElementById('horaInicio').value,
        hora_fin: document.getElementById('horaFin').value
    };

    if (!body.espacio_id || !body.fecha_reserva || !body.hora_inicio || !body.hora_fin) {
        alert('Completa todo');
        return;
    }

    const res = await fetch(API_URL + '/reservaciones', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
    }

    cargarReservaciones();
};

cargarEspacios();
cargarReservaciones();

});