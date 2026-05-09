const API = "http://localhost:3000/api/torneos";

// =============================
// HELPERS
// =============================
function escapeHTML(str = "") {

  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJSON(url, options = {}) {

  const res = await fetch(url, options);

  let data;

  try {

    data = await res.json();

  } catch {

    data = {};
  }

  if (!res.ok) {

    throw new Error(
      data.error || "Error en la petición"
    );
  }

  return data;
}

function getIdFromURL() {

  const id =
    new URLSearchParams(
      window.location.search
    ).get("id");

  return id && !isNaN(id)
    ? Number(id)
    : null;
}

function getUsuarioId() {

  const usuarioId =
    Number(
      localStorage.getItem(
        "usuario_id"
      )
    );

  return usuarioId || null;
}


// =============================
// ACTIVIDADES
// =============================
async function cargarActividades() {

  const select =
    document.getElementById(
      "actividad_id"
    );

  if (!select) return;

  try {

    const data = await fetchJSON(
      "http://localhost:3000/api/actividades"
    );

    select.innerHTML = `
      <option value="">
        Selecciona una actividad
      </option>
    `;

    data.forEach(a => {

      // ocultar ludoteca
      if (
        a.nombre.toLowerCase() ===
        "ludoteca"
      ) {
        return;
      }

      select.innerHTML += `
        <option value="${a.id}">
          ${escapeHTML(a.nombre)}
        </option>
      `;
    });

  } catch (error) {

    console.error(error);
  }
}
// =============================
// LISTAR TORNEOS
// =============================

async function cargarTorneos() {

  const contenedor =
    document.getElementById(
      "contenedorTorneos"
    );

  if (!contenedor) return;

  contenedor.innerHTML =
    "<p>Cargando...</p>";

  try {

    const data =
      await fetchJSON(API);

    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {

      contenedor.innerHTML =
        "<p>No hay torneos</p>";

      return;
    }

    let html = "";

    data.forEach(t => {

      let color = "#444";

      switch (
        (t.actividad_nombre || "")
          .toLowerCase()
      ) {

        case "futbol":
          color = "#2e7d32";
          break;

        case "tenis":
          color = "#1565c0";
          break;

        case "padel":
          color = "#6a1b9a";
          break;

        case "natacion":
          color = "#00838f";
          break;

        case "basquetbol":
          color = "#ef6c00";
          break;

        case "voleibol":
          color = "#ad1457";
          break;

        case "squash":
          color = "#5d4037";
          break;

        case "fronton":
          color = "#455a64";
          break;
      }

      let estadoColor = "#777";

      switch (
        (t.estado || "")
          .toLowerCase()
      ) {

        case "programado":
          estadoColor = "#f9a825";
          break;

        case "en curso":
          estadoColor = "#2e7d32";
          break;

        case "finalizado":
          estadoColor = "#616161";
          break;

        case "cancelado":
          estadoColor = "#c62828";
          break;
      }

      html += `
        <div
          class="card"
          style="
            border:1px solid #ccc;
            border-radius:12px;
            padding:20px;
            margin-bottom:20px;
            background:white;
            box-shadow:0 2px 8px rgba(0,0,0,0.1);
          "
        >

          <div
            style="
              display:inline-block;
              background:${color};
              color:white;
              padding:5px 12px;
              border-radius:20px;
              font-size:12px;
              margin-bottom:10px;
              font-weight:bold;
            "
          >
            ${escapeHTML(
              t.actividad_nombre || "General"
            )}
          </div>

          <h2
            style="
              margin-top:0;
            "
          >
            ${escapeHTML(t.nombre)}
          </h2>

          <p>
            ${escapeHTML(
              t.descripcion || ""
            )}
          </p>

          <p>

            <strong>
              Estado:
            </strong>

            <select
              onchange="
                cambiarEstado(
                  ${t.id},
                  this.value
                )
              "
              style="
                padding:5px 10px;
                border-radius:8px;
                border:none;
                background:${estadoColor};
                color:white;
                font-weight:bold;
                cursor:pointer;
              "
            >

              <option
                value="programado"
                ${
                  t.estado === "programado"
                    ? "selected"
                    : ""
                }
              >
                Programado
              </option>

              <option
                value="en curso"
                ${
                  t.estado === "en curso"
                    ? "selected"
                    : ""
                }
              >
                En curso
              </option>

              <option
                value="finalizado"
                ${
                  t.estado === "finalizado"
                    ? "selected"
                    : ""
                }
              >
                Finalizado
              </option>

              <option
                value="cancelado"
                ${
                  t.estado === "cancelado"
                    ? "selected"
                    : ""
                }
              >
                Cancelado
              </option>

            </select>

          </p>

          <p>

            <strong>
              Inicio:
            </strong>

            ${new Date(
              t.fecha_inicio
            ).toLocaleDateString()}

          </p>

          <p>

            <strong>
              Fin:
            </strong>

            ${new Date(
              t.fecha_fin
            ).toLocaleDateString()}

          </p>

          <p>

            <strong>
              Organizador:
            </strong>

            ${
              escapeHTML(
                t.creador_nombre || "N/A"
              )
            }

          </p>

          <div
            style="
              display:flex;
              gap:10px;
              margin-top:15px;
              flex-wrap:wrap;
            "
          >

            <button onclick="verDetalle(${t.id})">
              Ver
            </button>

            <button onclick="editar(${t.id})">
              Editar
            </button>

            <button onclick="eliminar(${t.id})">
              Eliminar
            </button>

          </div>

        </div>
      `;
    });

    contenedor.innerHTML = html;

  } catch (error) {

    console.error(error);

    contenedor.innerHTML =
      "<p>Error al cargar torneos</p>";
  }
}
// =============================
// CREAR / EDITAR
// =============================
async function guardarTorneo(e) {

  e.preventDefault();

  const id =
    getIdFromURL();

  const usuarioId =
    getUsuarioId();

  if (!usuarioId) {

    alert(
      "Debes iniciar sesión"
    );

    return;
  }

  const nombre =
    document.getElementById(
      "nombre"
    ).value.trim();

  const descripcion =
    document.getElementById(
      "descripcion"
    ).value.trim();

  const fechaInicio =
    document.getElementById(
      "fecha_inicio"
    ).value;

  const fechaFin =
    document.getElementById(
      "fecha_fin"
    ).value;

  const actividad_id =
    document.getElementById(
      "actividad_id"
    ).value;

  if (
    !nombre ||
    !fechaInicio ||
    !fechaFin ||
    !actividad_id
  ) {

    alert(
      "Datos incompletos"
    );

    return;
  }

  if (
    new Date(fechaFin) <
    new Date(fechaInicio)
  ) {

    alert(
      "Fecha inválida"
    );

    return;
  }

  const data = {

    nombre,
    descripcion,

    fecha_inicio:
      fechaInicio,

    fecha_fin:
      fechaFin,

    actividad_id:
      Number(actividad_id),

    creado_por:
      usuarioId
  };

  const url = id
    ? `${API}/${id}`
    : API;

  const method = id
    ? "PUT"
    : "POST";

  try {

    await fetchJSON(url, {

      method,

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify(data)
    });

    alert(
      "Guardado correctamente"
    );

    window.location.href =
      "torneos.html";

  } catch (error) {

    alert(error.message);
  }
}


// =============================
// ELIMINAR TORNEO
// =============================
async function eliminar(id) {

  if (
    !confirm(
      "¿Eliminar torneo?"
    )
  ) return;

  try {

    await fetchJSON(
      `${API}/${id}`,
      {
        method: "DELETE"
      }
    );

    cargarTorneos();

  } catch (error) {

    alert(error.message);
  }
}

// =============================
// CAMBIAR ESTADO
// =============================
async function cambiarEstado(
  id,
  estado
) {

  try {

    await fetchJSON(
      `${API}/${id}/estado`,
      {

        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          estado
        })
      }
    );

    // refrescar lista
    if (
      document.getElementById(
        "contenedorTorneos"
      )
    ) {

      cargarTorneos();
    }

    // refrescar detalle
    if (
      document.getElementById(
        "detalle"
      )
    ) {

      cargarDetalle();
    }

  } catch (error) {

    console.error(error);

    alert(
      error.message || "Error"
    );
  }
}


// =============================
// GENERAR BRACKET
// =============================
async function generarBracket() {

  const id =
    getIdFromURL();

  if (!id) return;

  try {

    const data =
      await fetchJSON(
        `${API}/${id}/generar-bracket`,
        {
          method: "POST"
        }
      );

    alert(data.mensaje);

    cargarDetalle();

  } catch (error) {

    alert(error.message);
  }
}


// =============================
// SIGUIENTE RONDA
// =============================
async function generarSiguienteRonda() {

  const id =
    getIdFromURL();

  if (!id) return;

  try {

    const data =
      await fetchJSON(
        `${API}/${id}/siguiente-ronda`,
        {
          method: "POST"
        }
      );

    alert(data.mensaje);

    cargarDetalle();

  } catch (error) {

    alert(error.message);
  }
}


// =============================
// DETALLE TORNEO
// =============================
async function cargarDetalle() {

  const contenedor =
    document.getElementById(
      "detalle"
    );

  if (!contenedor) return;

  const id =
    getIdFromURL();

  if (!id) return;

  contenedor.innerHTML =
    "<p>Cargando...</p>";

  try {

    const t =
      await fetchJSON(
        `${API}/${id}`
      );

    let participantes = [];

    try {

      participantes =
        await fetchJSON(
          `${API}/${id}/participantes`
        );

    } catch {}

    // =====================================
    // BOTÓN PARTICIPAR
    // =====================================
    const botonParticipar =

      (
        t.estado === "programado" ||
        t.estado === "en curso"
      )

      ? `
        <button
          id="btnParticipar"
          onclick="inscribirme(${id})"
        >
          Participar
        </button>
      `

      : `
        <button disabled>
          Torneo cerrado
        </button>
      `;

    // =====================================
    // BOTONES ADMIN
    // =====================================
    const botonesAdmin = `

      <div
        style="
          margin-top:20px;
          margin-bottom:20px;
        "
      >

        <button
          onclick="generarBracket()"
        >
          Generar Bracket
        </button>

        <button
          onclick="generarSiguienteRonda()"
        >
          Siguiente Ronda
        </button>

      </div>

    `;

    // =====================================
    // LISTA PARTICIPANTES
    // =====================================
    const lista = participantes.length

      ? participantes.map(p => `

        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            border:1px solid #ccc;
            padding:10px;
            margin-bottom:10px;
            max-width:600px;
            background:white;
          "
        >

          <div>

            <strong>

  ${
    p.nombre
      ? `
        ${escapeHTML(
          p.nombre
        )}

        ${
          escapeHTML(
            p.apellido || ""
          )
        }
      `
      : escapeHTML(
          p.nombre_invitado ||
          "Invitado"
        )
  }

</strong>

${
  p.resultado
    ? `
      <div>
        Resultado:
        ${escapeHTML(
          p.resultado
        )}
      </div>
    `
    : ""
}

            ${
              p.resultado
                ? `
                  <div>
                    Resultado:
                    ${escapeHTML(
                      p.resultado
                    )}
                  </div>
                `
                : ""
            }

          </div>

          <button
            style="
              background:red;
              color:white;
              border:none;
              padding:8px 15px;
              cursor:pointer;
            "
            onclick="
              eliminarParticipante(
                ${id},
                ${p.id}
              )
            "
          >
            Eliminar
          </button>

        </div>

      `).join("")

      : `
        <p>
          No hay participantes
        </p>
      `;

    // =====================================
    // RENDER
    // =====================================
    contenedor.innerHTML = `

      <h1>
        ${escapeHTML(t.nombre)}
      </h1>

      <p>
        ${escapeHTML(
          t.descripcion || ""
        )}
      </p>

      <p>

        <strong>
          Estado:
        </strong>

        <select
          onchange="
            cambiarEstado(
              ${id},
              this.value
            )
          "
        >

          <option
            value="programado"
            ${
              t.estado === "programado"
                ? "selected"
                : ""
            }
          >
            Programado
          </option>

          <option
            value="en curso"
            ${
              t.estado === "en curso"
                ? "selected"
                : ""
            }
          >
            En Curso
          </option>

          <option
            value="finalizado"
            ${
              t.estado === "finalizado"
                ? "selected"
                : ""
            }
          >
            Finalizado
          </option>

        </select>

      </p>

      <p>

        <strong>
          Participantes:
        </strong>

        ${participantes.length}
        /
        ${t.max_participantes || 16}

      </p>

      ${botonParticipar}

      ${botonesAdmin}

    `;

    // =====================================
    // RENDER PARTICIPANTES
    // =====================================
    document.getElementById(
      "participantes"
    ).innerHTML = lista;

    // =====================================
    // BRACKET
    // =====================================
    cargarBracket(id);

    // =====================================
    // TOP 3
    // =====================================
    cargarTop3(id);

    // =====================================
    // USUARIOS
    // =====================================
    cargarUsuarios(id);

  } catch (error) {

    console.error(error);

    contenedor.innerHTML = `
      <p>Error al cargar detalle</p>
    `;
  }
}


// =============================
// INSCRIBIRSE
// =============================
async function inscribirme(id) {

  const usuarioId =
    getUsuarioId();

  if (!usuarioId) {

    alert(
      "Debes iniciar sesión"
    );

    return;
  }

  const btn =
    document.getElementById(
      "btnParticipar"
    );

  if (btn) {

    btn.disabled = true;
  }

  try {

    await fetchJSON(
      `${API}/${id}/participantes`,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          usuario_id:
            usuarioId
        })
      }
    );

    alert(
      "Inscripción exitosa"
    );

    cargarDetalle();

  } catch (error) {

    alert(error.message);

    if (btn) {

      btn.disabled = false;
    }
  }
}


// =============================
// CARGAR USUARIOS
// =============================
async function cargarUsuarios(
  idTorneo
) {

  const contenedor =
    document.getElementById(
      "listaUsuarios"
    );

  if (!contenedor) return;

  try {

    const usuarios =
      await fetchJSON(
        "http://localhost:3000/api/usuarios"
      );

    // 🔹 ocultar admins y trabajadores
    const usuariosFiltrados =
      usuarios.filter(u => {

        const rol =
          (u.rol || "")
          .toLowerCase();

        return (
          rol !== "admin" &&
          rol !== "administrador" &&
          rol !== "trabajador" &&
          rol !== "empleado"
        );
      });

    renderUsuarios(
      usuariosFiltrados,
      idTorneo
    );

    const buscador =
      document.getElementById(
        "buscarUsuario"
      );

    if (!buscador) return;

    buscador.addEventListener(
      "input",
      () => {

        const texto =
          buscador.value
          .toLowerCase();

        const filtrados =
          usuariosFiltrados.filter(u => {

            const nombre =
              `
                ${u.nombre || ""}
                ${u.apellido || ""}
              `
              .toLowerCase();

            return nombre.includes(
              texto
            );
          });

        renderUsuarios(
          filtrados,
          idTorneo
        );
      }
    );

  } catch (error) {

    console.error(error);
  }
}
// =============================
// RENDER USUARIOS
// =============================
function renderUsuarios(
  usuarios,
  idTorneo
) {

  const contenedor =
    document.getElementById(
      "listaUsuarios"
    );

  if (!contenedor) return;

  contenedor.innerHTML = "";

  usuarios.forEach(u => {

    contenedor.innerHTML += `

      <div
        style="
          display:flex;
          gap:10px;
          margin-bottom:10px;
          align-items:center;
        "
      >

        <span>

          ${escapeHTML(
            `${u.nombre || ""} ${u.apellido || ""}`
          )}

        </span>

        <button
          style="
            background:green;
            color:white;
            border:none;
            padding:5px 10px;
            cursor:pointer;
          "
          onclick="
            agregarParticipante(
              ${idTorneo},
              ${u.id}
            )
          "
        >
          Agregar
        </button>

      </div>

    `;
  });
}

// =============================
// AGREGAR PARTICIPANTE
// =============================
async function agregarParticipante(
  torneoId,
  usuarioId
) {

  try {

    await fetchJSON(
      `${API}/${torneoId}/participantes`,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          usuario_id:
            usuarioId
        })
      }
    );

    alert(
      "Participante agregado"
    );

    cargarDetalle();

  } catch (error) {

    alert(error.message);
  }
}


// =============================
// ELIMINAR PARTICIPANTE
// =============================
async function eliminarParticipante(
  torneoId,
  participanteId
) {

  if (
    !confirm(
      "¿Eliminar participante?"
    )
  ) return;

  try {

    await fetchJSON(
      `${API}/${torneoId}/participantes/${participanteId}`,
      {
        method: "DELETE"
      }
    );

    alert(
      "Participante eliminado"
    );

    cargarDetalle();

  } catch (error) {

    alert(error.message);
  }
}

// =============================
// BRACKET
// =============================
async function cargarBracket(id) {

  const contenedor =
    document.getElementById(
      "bracket"
    );

  if (!contenedor) return;

  try {

    const data =
      await fetchJSON(
        `${API}/${id}/bracket`
      );

    let html = "";

    Object.keys(data).forEach(
      ronda => {

        html += `
          <div class="ronda">

            <h3>
              ${escapeHTML(ronda)}
            </h3>
        `;

        data[ronda].forEach(p => {

          html += `

            <div class="partido">

              <p>

                <strong>

                  ${
                    escapeHTML(
                      p.jugador1
                    )
                  }

                </strong>

                vs

                <strong>

                  ${
                    escapeHTML(
                      p.jugador2
                    )
                  }

                </strong>

              </p>

              <p>

                Marcador:

                ${
                  p.marcador1 ?? 0
                }

                -

                ${
                  p.marcador2 ?? 0
                }

              </p>

              <p>

                Estado:
                ${escapeHTML(
                  p.estado || "pendiente"
                )}

              </p>

            </div>

          `;
        });

        html += `
          </div>
        `;
      }
    );

    contenedor.innerHTML = html;

  } catch (error) {

    console.error(error);

    contenedor.innerHTML = `
      <p>No hay bracket disponible</p>
    `;
  }
}

// =============================
// TOP 3
// =============================
async function cargarTop3(id) {

  const contenedor =
    document.getElementById(
      "top3"
    );

  if (!contenedor) return;

  try {

    const data =
      await fetchJSON(
        `${API}/${id}/top3`
      );

    contenedor.innerHTML = `

      <div class="podio">

        <p>

          🥇

          ${
            escapeHTML(
              data.primer_nombre ||
              `Usuario ${data.primer_usuario}`
            )
          }

        </p>

        <p>

          🥈

          ${
            escapeHTML(
              data.segundo_nombre ||
              `Usuario ${data.segundo_usuario}`
            )
          }

        </p>

        <p>

          🥉

          ${
            escapeHTML(
              data.tercer_nombre ||
              `Usuario ${data.tercer_usuario}`
            )
          }

        </p>

      </div>

    `;

  } catch (error) {

    console.error(error);

    contenedor.innerHTML = `
      <p>Top 3 no disponible</p>
    `;
  }
}


// =============================
// NAV
// =============================
function editar(id) {

  window.location.href =
    `torneos-form.html?id=${id}`;
}

function verDetalle(id) {

  window.location.href =
    `torneos-detalle.html?id=${id}`;
}

function volver() {

  window.history.back();
}


// =============================
// INIT
// =============================
document.addEventListener(
  "DOMContentLoaded",
  () => {

    cargarActividades();

    if (
      document.getElementById(
        "contenedorTorneos"
      )
    ) {

      cargarTorneos();
    }

    if (
      document.getElementById(
        "detalle"
      )
    ) {

      cargarDetalle();
    }

    const form =
      document.getElementById(
        "formTorneo"
      );

    if (form) {

      form.addEventListener(
        "submit",
        guardarTorneo
      );
    }

    const btn =
      document.getElementById(
        "btnCrear"
      );

    if (btn) {

      btn.onclick = () => {

        window.location.href =
          "torneos-form.html";
      };
    }
  }
);


// =============================
// MOSTRAR / OCULTAR PANEL
// =============================
function togglePanelUsuarios() {

  const panel =
    document.getElementById(
      "panelUsuarios"
    );

  if (!panel) return;

  panel.style.display =

    panel.style.display === "none"

      ? "block"

      : "none";
}