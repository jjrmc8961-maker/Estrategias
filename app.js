// CATÁLOGO DE ÁREAS CLÍNICAS ESTÁNDAR
const AREAS_CLINICAS = [
  "Hospitalización",
  "Urgencias",
  "Quirófano",
  "UCI / Terapia Intensiva",
  "Oncología",
  "Pediatría",
  "Tococirugía",
  "CEyE"
];

// TARIFAS BASE INSTITUCIONALES DE REFERENCIA
const TABULADOR_BASE = {
  Diurno: 650,
  Nocturno: 1300
};

// BASE DE DATOS LOCAL
let usuarios = JSON.parse(localStorage.getItem('usuarios_db')) || [
  { 
    user: "enfermeria01", 
    pass: "1234", 
    nombre: "Lic. Manuel Huerta", 
    whatsapp: "2281000001",
    zona: "Xalapa",
    institucion: "IMSS HGZ 11",
    perfil: "Enfermero General", 
    areas: ["UCI / Terapia Intensiva", "Urgencias"], 
    honorarioDiurno: 650, 
    honorarioNocturno: 1300,
    foto: ""
  }
];

let guardias = JSON.parse(localStorage.getItem('guardias_db')) || [
  { 
    id: 101, 
    creadaEn: Date.now() - 3600000 * 4,
    solicitante: "Lic. Manuel Huerta", 
    solicitanteUser: "enfermeria01",
    zona: "Xalapa",
    institucion: "IMSS HGZ 11",
    fecha: "2026-11-25", 
    turno: "Diurno", 
    servicio: "Oncología", 
    estado: "Pendiente",
    postulantes: [],
    asignadoA: null, 
    asignadoUser: null,
    honorario: 650,
    montoPactado: 650
  }
];

guardias.forEach(g => {
  if (!Array.isArray(g.postulantes)) g.postulantes = [];
});

let insumos = JSON.parse(localStorage.getItem('insumos_db')) || [];
let fotoTempReg = "";
let fotoTempEdit = null;

let fechaActual = new Date();
let usuarioActivo = JSON.parse(localStorage.getItem('guardia_user_obj')) || null;

function guardarDatos() {
  localStorage.setItem('guardias_db', JSON.stringify(guardias));
  localStorage.setItem('usuarios_db', JSON.stringify(usuarios));
  localStorage.setItem('insumos_db', JSON.stringify(insumos));
}

// TABULADOR DINÁMICO ANTI-INFLACIÓN
function calcularReglasTabulador(fechaStr, turno) {
  const horaInicio = turno === 'Nocturno' ? '19:00:00' : '07:00:00';
  const fechaTurnoMs = new Date(`${fechaStr}T${horaInicio}`).getTime();
  const ahora = Date.now();
  const horasRestantes = (fechaTurnoMs - ahora) / 3600000;

  const base = turno === 'Nocturno' ? TABULADOR_BASE.Nocturno : TABULADOR_BASE.Diurno;

  let nivel = 'Programada (+48h)';
  let claseUrgencia = 'urg-normal';
  let maxPorcentaje = 15;

  if (horasRestantes < 24) {
    nivel = 'Urgente (-24h)';
    claseUrgencia = 'urg-urgente';
    maxPorcentaje = 35;
  } else if (horasRestantes <= 48) {
    nivel = 'Próxima (24-48h)';
    claseUrgencia = 'urg-proxima';
    maxPorcentaje = 25;
  }

  const montoMaximo = Math.round(base * (1 + maxPorcentaje / 100));

  return {
    horasRestantes: Math.max(0, Math.round(horasRestantes)),
    nivel,
    claseUrgencia,
    base,
    maxPorcentaje,
    montoMaximo
  };
}

function inicializarSelectoresAreas() {
  const regCont = document.getElementById('reg-areas-checkboxes');
  regCont.innerHTML = AREAS_CLINICAS.map(area => `
    <label class="checkbox-item">
      <input type="checkbox" name="reg-area-chk" value="${area}"> ${area}
    </label>
  `).join('');

  const editCont = document.getElementById('edit-areas-checkboxes');
  editCont.innerHTML = AREAS_CLINICAS.map(area => `
    <label class="checkbox-item">
      <input type="checkbox" name="edit-area-chk" value="${area}"> ${area}
    </label>
  `).join('');

  const solSelect = document.getElementById('sol-servicio');
  solSelect.innerHTML = AREAS_CLINICAS.map(area => `<option value="${area}">${area}</option>`).join('');

  const filtroSelect = document.getElementById('filtro-area-tablero');
  filtroSelect.innerHTML = `<option value="TODAS">Todas las áreas</option>` + 
    AREAS_CLINICAS.map(area => `<option value="${area}">${area}</option>`).join('');
}

function obtenerIniciales(nombre) {
  if (!nombre) return 'U';
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function renderAvatarHTML(usuarioObj, clase = 'avatar') {
  if (usuarioObj && usuarioObj.foto) {
    return `<img src="${usuarioObj.foto}" class="${clase}" alt="Foto">`;
  }
  const iniciales = usuarioObj ? obtenerIniciales(usuarioObj.nombre) : 'U';
  return `<div class="${clase}">${iniciales}</div>`;
}

function generarLinkWhatsApp(telefono, mensaje) {
  if (!telefono) return '#';
  const limpio = telefono.replace(/\D/g, '');
  const numeroFinal = limpio.length === 10 ? `52${limpio}` : limpio;
  return `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensaje)}`;
}

function formatearAreasTexto(areas) {
  if (Array.isArray(areas)) return areas.length > 0 ? areas.join(', ') : 'General';
  return areas || 'General';
}

function obtenerInfoRelojGuardia(g) {
  const ahora = Date.now();
  let textoTranscurrido = '';
  if (g.creadaEn) {
    const diffMin = Math.floor((ahora - g.creadaEn) / 60000);
    if (diffMin < 1) textoTranscurrido = 'Hace un momento';
    else if (diffMin < 60) textoTranscurrido = `Hace ${diffMin} min`;
    else if (diffMin < 1440) textoTranscurrido = `Hace ${Math.floor(diffMin / 60)} h`;
    else textoTranscurrido = `Hace ${Math.floor(diffMin / 1440)} d`;
  } else {
    textoTranscurrido = 'Registrada';
  }

  const horaInicio = g.turno === 'Nocturno' ? '19:00:00' : '07:00:00';
  const fechaTurnoMs = new Date(`${g.fecha}T${horaInicio}`).getTime();
  const diffTurnoMs = fechaTurnoMs - ahora;

  let textoRestante = '';
  if (diffTurnoMs <= 0) {
    textoRestante = 'Turno iniciado / pasado';
  } else {
    const horasTotales = Math.floor(diffTurnoMs / 3600000);
    const dias = Math.floor(horasTotales / 24);
    const horas = horasTotales % 24;
    textoRestante = dias > 0 ? `Inicia en ${dias}d ${horas}h` : `Inicia en ${horas}h`;
  }

  return `⏱️ ${textoTranscurrido} • ⏳ ${textoRestante}`;
}

function procesarFoto(event, origen) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxSize = 150;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      
      if (origen === 'reg') fotoTempReg = dataUrl;
      if (origen === 'edit') {
        fotoTempEdit = dataUrl;
        document.getElementById('edit-avatar-preview').innerHTML = `<img src="${dataUrl}" class="avatar-sm">`;
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// AUTENTICACIÓN
function mostrarRegistro(mostrar) {
  document.getElementById('view-login').style.display = mostrar ? 'none' : 'block';
  document.getElementById('view-register').style.display = mostrar ? 'block' : 'none';
  document.getElementById('view-recover').style.display = 'none';
  fotoTempReg = "";
}

function mostrarRecuperar(mostrar) {
  document.getElementById('view-login').style.display = mostrar ? 'none' : 'block';
  document.getElementById('view-recover').style.display = mostrar ? 'block' : 'none';
  document.getElementById('view-register').style.display = 'none';
}

function restablecerPassword() {
  const user = document.getElementById('rec-user').value.trim();
  const nombre = document.getElementById('rec-nombre').value.trim();
  const newPass = document.getElementById('rec-new-pass').value.trim();
  const confirmPass = document.getElementById('rec-confirm-pass').value.trim();

  if (!user || !nombre || !newPass || !confirmPass) {
    alert("Por favor completa todos los campos.");
    return;
  }
  if (newPass !== confirmPass) {
    alert("Las contraseñas nuevas no coinciden.");
    return;
  }

  const usuarioEncontrado = usuarios.find(
    u => u.user.toLowerCase() === user.toLowerCase() && u.nombre.toLowerCase() === nombre.toLowerCase()
  );

  if (!usuarioEncontrado) {
    alert("No se encontró ninguna cuenta que coincida con esa matrícula y nombre completo.");
    return;
  }

  usuarioEncontrado.pass = newPass;
  guardarDatos();
  alert("¡Contraseña actualizada con éxito!");
  mostrarRecuperar(false);
}

function registrarUsuario() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const user = document.getElementById('reg-user').value.trim();
  const pass = document.getElementById('reg-pass').value.trim();
  const whatsapp = document.getElementById('reg-whatsapp').value.trim();
  const zona = document.getElementById('reg-zona').value.trim();
  const institucion = document.getElementById('reg-institucion').value.trim();
  const perfil = document.getElementById('reg-perfil').value;
  const hd = Number(document.getElementById('reg-tarifa-d').value) || 650;
  const hn = Number(document.getElementById('reg-tarifa-n').value) || 1300;

  const areasSeleccionadas = Array.from(document.querySelectorAll('input[name="reg-area-chk"]:checked')).map(cb => cb.value);

  if (!nombre || !user || !pass || !whatsapp || !zona || !institucion) {
    alert("Completa todos los campos obligatorios (*).");
    return;
  }

  if (usuarios.some(u => u.user.toLowerCase() === user.toLowerCase())) {
    alert("Esta matrícula o usuario ya está registrado.");
    return;
  }

  const nuevoUsuario = { 
    user, pass, nombre, whatsapp, zona, institucion, perfil, 
    areas: areasSeleccionadas.length > 0 ? areasSeleccionadas : ["Hospitalización"], 
    honorarioDiurno: hd, honorarioNocturno: hn, foto: fotoTempReg 
  };
  usuarios.push(nuevoUsuario);
  guardarDatos();

  usuarioActivo = nuevoUsuario;
  localStorage.setItem('guardia_user_obj', JSON.stringify(usuarioActivo));
  alert("Registro completado con éxito.");
  mostrarRegistro(false);
  verificarSesion();
}

function iniciarSesion() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();

  const encontrado = usuarios.find(x => x.user.toLowerCase() === u.toLowerCase() && x.pass === p);
  if (!encontrado) {
    alert("Usuario o contraseña no válidos.");
    return;
  }

  usuarioActivo = encontrado;
  localStorage.setItem('guardia_user_obj', JSON.stringify(usuarioActivo));
  verificarSesion();
}

function logout() {
  localStorage.removeItem('guardia_user_obj');
  usuarioActivo = null;
  verificarSesion();
}

function cargarFormularioEditarPerfil() {
  if (!usuarioActivo) return;
  fotoTempEdit = null;
  document.getElementById('edit-avatar-preview').innerHTML = renderAvatarHTML(usuarioActivo, 'avatar-sm');
  document.getElementById('edit-nombre').value = usuarioActivo.nombre || '';
  document.getElementById('edit-whatsapp').value = usuarioActivo.whatsapp || '';
  document.getElementById('edit-zona').value = usuarioActivo.zona || '';
  document.getElementById('edit-institucion').value = usuarioActivo.institucion || '';
  document.getElementById('edit-perfil').value = usuarioActivo.perfil || 'Licenciado en Enfermería';
  document.getElementById('edit-tarifa-d').value = usuarioActivo.honorarioDiurno || 650;
  document.getElementById('edit-tarifa-n').value = usuarioActivo.honorarioNocturno || 1300;

  const userAreas = Array.isArray(usuarioActivo.areas) 
    ? usuarioActivo.areas 
    : (usuarioActivo.areas ? usuarioActivo.areas.split(',').map(s => s.trim()) : []);

  document.querySelectorAll('input[name="edit-area-chk"]').forEach(cb => {
    cb.checked = userAreas.some(a => a.toLowerCase() === cb.value.toLowerCase());
  });
}

function guardarCambiosPerfil() {
  const nombre = document.getElementById('edit-nombre').value.trim();
  const whatsapp = document.getElementById('edit-whatsapp').value.trim();
  const zona = document.getElementById('edit-zona').value.trim();
  const institucion = document.getElementById('edit-institucion').value.trim();
  const perfil = document.getElementById('edit-perfil').value;
  const hd = Number(document.getElementById('edit-tarifa-d').value) || 650;
  const hn = Number(document.getElementById('edit-tarifa-n').value) || 1300;
  const areasSeleccionadas = Array.from(document.querySelectorAll('input[name="edit-area-chk"]:checked')).map(cb => cb.value);

  if (!nombre || !whatsapp || !zona || !institucion) {
    alert("Completa los campos obligatorios (*).");
    return;
  }

  const nombreAnterior = usuarioActivo.nombre;
  usuarioActivo.nombre = nombre;
  usuarioActivo.whatsapp = whatsapp;
  usuarioActivo.zona = zona;
  usuarioActivo.institucion = institucion;
  usuarioActivo.perfil = perfil;
  usuarioActivo.areas = areasSeleccionadas;
  usuarioActivo.honorarioDiurno = hd;
  usuarioActivo.honorarioNocturno = hn;
  if (fotoTempEdit) usuarioActivo.foto = fotoTempEdit;

  const idx = usuarios.findIndex(u => u.user === usuarioActivo.user);
  if (idx !== -1) usuarios[idx] = usuarioActivo;

  guardias.forEach(g => {
    if (g.solicitante === nombreAnterior || g.solicitanteUser === usuarioActivo.user) {
      g.solicitante = nombre;
      g.zona = zona;
      g.institucion = institucion;
      if (!g.honorario) g.honorario = g.turno === 'Diurno' ? hd : hn;
    }
    if (g.asignadoA === nombreAnterior || g.asignadoUser === usuarioActivo.user) {
      g.asignadoA = nombre;
    }
  });

  localStorage.setItem('guardia_user_obj', JSON.stringify(usuarioActivo));
  guardarDatos();
  alert("¡Perfil actualizado correctamente!");
  verificarSesion();
}

function verificarSesion() {
  if (usuarioActivo) {
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-register').style.display = 'none';
    document.getElementById('view-recover').style.display = 'none';
    document.getElementById('view-app').style.display = 'block';
    document.getElementById('bottom-tabs').style.display = 'flex';
    document.getElementById('btn-logout').style.display = 'block';
    
    const zonaTxt = usuarioActivo.zona || 'Sin zona';
    const instTxt = usuarioActivo.institucion || 'Sin institución';

    document.getElementById('header-avatar-container').innerHTML = renderAvatarHTML(usuarioActivo, 'avatar');
    document.getElementById('user-display').innerText = usuarioActivo.nombre;
    document.getElementById('unit-display').innerText = `${instTxt} • ${zonaTxt}`;
    document.getElementById('lbl-unidad-activa').innerText = `${instTxt} (${zonaTxt})`;
    
    cargarFormularioEditarPerfil();
    renderAlertas();
    renderSolicitudes();
    renderBitacora();
    renderCalendario();
    renderPadron();
  } else {
    document.getElementById('view-login').style.display = 'block';
    document.getElementById('view-register').style.display = 'none';
    document.getElementById('view-recover').style.display = 'none';
    document.getElementById('view-app').style.display = 'none';
    document.getElementById('bottom-tabs').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('header-avatar-container').innerHTML = '';
    document.getElementById('user-display').innerText = "No conectado";
    document.getElementById('unit-display').innerText = "";
  }
}

function perteneceAMiUnidad(item) {
  if (!usuarioActivo) return false;
  const mismaZona = (item.zona || '').toLowerCase() === (usuarioActivo.zona || '').toLowerCase();
  const mismaInst = (item.institucion || '').toLowerCase() === (usuarioActivo.institucion || '').toLowerCase();
  return mismaZona && mismaInst;
}

function renderAlertas() {
  const cont = document.getElementById('contenedor-alertas');
  if (!usuarioActivo.zona || !usuarioActivo.institucion) {
    cont.innerHTML = `
      <div class="alert-banner" style="background: #fee2e2; border-color: #ef4444; color: #991b1b;">
        <div><strong>⚠️ Perfil incompleto:</strong> Configura tu Zona e Institución para filtrar tu unidad.</div>
        <button class="btn btn-secondary" style="width: auto; padding: 4px 8px; font-size: 11px; margin: 0;" onclick="cambiarTab('perfil')">Completar</button>
      </div>
    `;
    return;
  }

  const guardiasUnidad = guardias.filter(perteneceAMiUnidad);
  const misConPostulantes = guardiasUnidad.filter(
    g => g.solicitante.toLowerCase() === usuarioActivo.nombre.toLowerCase() && g.estado === 'Pendiente' && g.postulantes.length > 0
  );
  const disponibles = guardiasUnidad.filter(
    g => g.solicitante.toLowerCase() !== usuarioActivo.nombre.toLowerCase() && g.estado === 'Pendiente'
  );

  let html = '';
  if (misConPostulantes.length > 0) {
    const totalCandidatos = misConPostulantes.reduce((acc, g) => acc + g.postulantes.length, 0);
    html += `
      <div class="alert-banner" style="background: #ffedd5; border-color: #f97316; color: #9a3412;">
        <div><strong>🔔 ¡Tienes ${totalCandidatos} postulante(s)!</strong> Elige qué colega cubrirá tu guardia en el tablero.</div>
      </div>
    `;
  } else if (disponibles.length > 0) {
    html += `
      <div class="alert-banner">
        <div><strong>📢 Oferta disponible:</strong> Hay ${disponibles.length} guardia(s) abierta(s) en ${usuarioActivo.institucion}.</div>
      </div>
    `;
  }
  cont.innerHTML = html;
}

function puedeCubrir(nombrePersona, fechaGuardia, tipoTurno) {
  const d = new Date(fechaGuardia + 'T00:00:00');
  const mes = d.getMonth();
  const anio = d.getFullYear();
  const esPrimeraQuincena = d.getDate() <= 15;

  let diurnas = 0;
  let nocturnas = 0;

  guardias.forEach(g => {
    if (g.asignadoA === nombrePersona && (g.estado === 'Asignada' || g.estado === 'Realizada')) {
      const gd = new Date(g.fecha + 'T00:00:00');
      if (gd.getFullYear() === anio && gd.getMonth() === mes) {
        const gPrimera = gd.getDate() <= 15;
        if (esPrimeraQuincena === gPrimera) {
          if (g.turno === 'Diurno') diurnas++;
          if (g.turno === 'Nocturno') nocturnas++;
        }
      }
    }
  });

  let nuevoD = diurnas + (tipoTurno === 'Diurno' ? 1 : 0);
  let nuevoN = nocturnas + (tipoTurno === 'Nocturno' ? 1 : 0);

  if (nuevoN === 0 && nuevoD <= 3) return { valido: true };
  if (nuevoD === 0 && nuevoN <= 2) return { valido: true };
  if (nuevoD === 1 && nuevoN === 1) return { valido: true };

  return {
    valido: false,
    msg: `Límite quincenal alcanzado (${diurnas} D / ${nocturnas} N). Máximo: 3 diurnas, 2 nocturnas o combinación estricta 1 y 1.`
  };
}

function renderSolicitudes() {
  const cont = document.getElementById('lista-solicitudes');
  cont.innerHTML = '';

  const filtroArea = document.getElementById('filtro-area-tablero').value;
  let guardiasUnidad = guardias.filter(perteneceAMiUnidad);

  if (filtroArea !== 'TODAS') {
    guardiasUnidad = guardiasUnidad.filter(g => g.servicio.toLowerCase() === filtroArea.toLowerCase());
  }

  if (guardiasUnidad.length === 0) {
    cont.innerHTML = `<div class="card"><p style="font-size: 12px; color: var(--text-muted); text-align: center;">No hay solicitudes registradas para este filtro.</p></div>`;
    return;
  }

  guardiasUnidad.forEach(g => {
    const esMia = g.solicitante.toLowerCase() === usuarioActivo.nombre.toLowerCase();
    const reglas = calcularReglasTabulador(g.fecha, g.turno);
    const yaMePostule = g.postulantes.some(p => p.user === usuarioActivo.user);

    let badgeClass = 'badge-pending';
    let estadoTexto = g.estado;
    if (g.estado === 'Pendiente' && g.postulantes.length > 0) {
      badgeClass = 'badge-candidates';
      estadoTexto = `${g.postulantes.length} Postulante(s)`;
    }
    if (g.estado === 'Asignada') badgeClass = 'badge-assigned';
    if (g.estado === 'Realizada') badgeClass = 'badge-done';
    if (g.estado === 'Cancelada') badgeClass = 'badge-cancelled';
    
    let card = document.createElement('div');
    card.className = `card ${esMia ? 'card-mine' : ''}`;
    
    let listaPostulantesHTML = '';
    if (g.estado === 'Pendiente' && g.postulantes.length > 0) {
      listaPostulantesHTML = `<div class="candidates-box">
        <div style="font-size: 11px; font-weight: bold; color: var(--primary-dark); margin-bottom: 4px;">
          👥 Colegas postulados (${g.postulantes.length}):
        </div>
        ${g.postulantes.map((p, idx) => {
          const msgWa = `Hola ${p.nombre}, vi tu postulación para mi guardia de ${g.servicio} el ${g.fecha}.`;
          return `
            <div class="candidate-row">
              <div style="font-size: 12px;">
                <strong>${p.nombre}</strong> <span style="font-size: 10px; color: var(--text-muted);">(${p.perfil})</span><br>
                Propone: <strong style="color: var(--success);">$${p.montoPropuesto} MXN</strong>
                ${p.whatsapp && esMia ? ` • <a href="${generarLinkWhatsApp(p.whatsapp, msgWa)}" target="_blank" style="color: #16a34a; font-weight: bold; text-decoration: none;">WhatsApp</a>` : ''}
              </div>
              ${esMia 
                ? `<button class="btn btn-success" onclick="elegirPostulante(${g.id}, ${idx})" style="width: auto; padding: 5px 10px; font-size: 11px; margin: 0;">✓ Elegir</button>` 
                : (p.user === usuarioActivo.user ? `<span class="badge badge-assigned">Tu oferta</span>` : '')}
            </div>
          `;
        }).join('')}
      </div>`;
    }

    let botonAccion = '';
    if (g.estado === 'Pendiente') {
      if (esMia) {
        botonAccion = `
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <button class="btn btn-warning" onclick="incrementarOfertaGuardia(${g.id})" style="font-size: 11px; padding: 6px 8px; margin: 0;">📈 Subir oferta ($)</button>
            <button class="btn btn-danger" onclick="cancelarSolicitud(${g.id})" style="font-size: 11px; padding: 6px 8px; margin: 0;">Cancelar</button>
          </div>
        `;
      } else {
        if (yaMePostule) {
          botonAccion = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
              <span style="font-size: 11px; color: var(--success); font-weight: bold;">✅ Ya estás postulado (en espera de elección)</span>
              <button class="btn btn-secondary" onclick="retirarPostulacion(${g.id})" style="width: auto; padding: 4px 8px; font-size: 11px; margin: 0;">Retirar</button>
            </div>
          `;
        } else {
          botonAccion = `<button class="btn" onclick="postularme(${g.id})" style="font-size: 12px; margin-top: 8px;">🙋‍♂️ Postularme para cubrir ($${g.honorario})</button>`;
        }
      }
    }

    const objSolicitante = usuarios.find(u => u.nombre.toLowerCase() === g.solicitante.toLowerCase());
    let waBtn = '';
    if (!esMia && objSolicitante && objSolicitante.whatsapp && g.estado !== 'Cancelada') {
      const msg = `Hola ${g.solicitante}, te contacto por la guardia en ${g.servicio} (${g.fecha}, turno ${g.turno}).`;
      waBtn = `<a href="${generarLinkWhatsApp(objSolicitante.whatsapp, msg)}" target="_blank" class="btn-wa">💬 WhatsApp a ${g.solicitante.split(' ')[0]}</a>`;
    }

    const relojHTML = g.estado !== 'Cancelada' && g.estado !== 'Realizada' 
      ? `<div class="clock-pill">${obtenerInfoRelojGuardia(g)}</div>` 
      : '';

    const urgenciaHTML = g.estado === 'Pendiente'
      ? `<span class="urgency-pill ${reglas.claseUrgencia}">${reglas.nivel} • Tope máx: $${reglas.montoMaximo} (+${reglas.maxPorcentaje}%)</span>`
      : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
        <div>
          <strong>${g.servicio}</strong> — <span style="font-size: 13px;">Turno ${g.turno}</span><br>
          <span style="font-size: 12px; color: var(--text-muted);">${g.fecha} | Solicita: <strong>${g.solicitante}</strong></span>
        </div>
        <div style="text-align: right;">
          ${esMia ? '<span class="badge badge-mine" style="margin-bottom: 2px;">Mía</span><br>' : ''}
          <span class="badge ${badgeClass}">${estadoTexto}</span>
        </div>
      </div>
      <div>${relojHTML}</div>
      <div>${urgenciaHTML}</div>
      <div style="font-size: 12px; margin-top: 6px;">
        <strong>Oferta actual:</strong> $${g.honorario || 650} MXN
        ${g.montoPactado && (g.estado === 'Asignada' || g.estado === 'Realizada') ? ` | <strong style="color: var(--success);">Pactado final: $${g.montoPactado} MXN</strong>` : ''}
      </div>
      ${g.asignadoA && g.estado !== 'Cancelada' ? `<p style="font-size: 12px; margin: 4px 0;"><strong>Cubre:</strong> ${g.asignadoA}</p>` : ''}
      ${listaPostulantesHTML}
      ${waBtn}
      ${botonAccion}
    `;
    cont.appendChild(card);
  });
}

function incrementarOfertaGuardia(idGuardia) {
  const g = guardias.find(x => x.id === idGuardia);
  if (!g) return;

  const reglas = calcularReglasTabulador(g.fecha, g.turno);
  const nuevoMontoStr = prompt(
    `Nivel actual: ${reglas.nivel}\n` +
    `Oferta actual: $${g.honorario} MXN\n` +
    `Tope máximo permitido (+${reglas.maxPorcentaje}%): $${reglas.montoMaximo} MXN\n\n` +
    `Ingresa el nuevo monto atractivo ($):`,
    Math.min(g.honorario + 100, reglas.montoMaximo)
  );

  if (nuevoMontoStr === null) return;
  const nuevoMonto = Number(nuevoMontoStr);

  if (isNaN(nuevoMonto) || nuevoMonto <= g.honorario) {
    alert(`El nuevo monto debe ser mayor a tu oferta actual ($${g.honorario} MXN).`);
    return;
  }

  if (nuevoMonto > reglas.montoMaximo) {
    alert(`⚠️ Límite anti-inflación excedido.\nPara una guardia ${reglas.nivel}, el incremento máximo permitido es +${reglas.maxPorcentaje}% ($${reglas.montoMaximo} MXN).`);
    return;
  }

  g.honorario = nuevoMonto;
  g.montoPactado = nuevoMonto;
  guardarDatos();
  renderSolicitudes();
  renderBitacora();
  alert(`¡Oferta actualizada a $${nuevoMonto} MXN para atraer relevos!`);
}

function postularme(idGuardia) {
  const g = guardias.find(x => x.id === idGuardia);
  if (!g) return;

  if (g.solicitante.toLowerCase() === usuarioActivo.nombre.toLowerCase()) {
    alert("No puedes postularte a una guardia que tú mismo solicitaste.");
    return;
  }

  const evalRegla = puedeCubrir(usuarioActivo.nombre, g.fecha, g.turno);
  if (!evalRegla.valido) {
    alert(evalRegla.msg);
    return;
  }

  const reglas = calcularReglasTabulador(g.fecha, g.turno);
  const ofertaActual = g.honorario || reglas.base;

  const montoPropuestoStr = prompt(
    `Oferta del solicitante: $${ofertaActual} MXN\n` +
    `Nivel: ${reglas.nivel} — Tope máximo permitido (+${reglas.maxPorcentaje}%): $${reglas.montoMaximo} MXN\n\n` +
    `Confirma o propón tu monto a cobrar ($ MXN):`,
    ofertaActual
  );

  if (montoPropuestoStr === null) return;
  const montoPropuesto = Number(montoPropuestoStr);

  if (isNaN(montoPropuesto) || montoPropuesto < reglas.base) {
    alert(`El monto no puede ser menor al tabulador base ($${reglas.base} MXN).`);
    return;
  }

  if (montoPropuesto > reglas.montoMaximo) {
    alert(`⚠️ Límite anti-inflación excedido.\nEl monto máximo permitido para esta guardia (${reglas.nivel}) es de $${reglas.montoMaximo} MXN.`);
    return;
  }

  g.postulantes.push({
    user: usuarioActivo.user,
    nombre: usuarioActivo.nombre,
    perfil: usuarioActivo.perfil,
    whatsapp: usuarioActivo.whatsapp,
    montoPropuesto: montoPropuesto,
    fechaPostulacion: Date.now()
  });

  guardarDatos();
  renderAlertas();
  renderSolicitudes();
  alert(`¡Te has postulado por $${montoPropuesto} MXN! ${g.solicitante} podrá elegirte entre los candidatos.`);
}

function retirarPostulacion(idGuardia) {
  const g = guardias.find(x => x.id === idGuardia);
  if (!g) return;
  g.postulantes = g.postulantes.filter(p => p.user !== usuarioActivo.user);
  guardarDatos();
  renderAlertas();
  renderSolicitudes();
}

function elegirPostulante(idGuardia, indexPostulante) {
  const g = guardias.find(x => x.id === idGuardia);
  if (!g || !g.postulantes[indexPostulante]) return;

  const elegido = g.postulantes[indexPostulante];
  const evalRegla = puedeCubrir(elegido.nombre, g.fecha, g.turno);
  if (!evalRegla.valido) {
    alert(`No se puede asignar a ${elegido.nombre}: ${evalRegla.msg}`);
    return;
  }

  if (confirm(`¿Confirmas elegir a ${elegido.nombre} para cubrir tu guardia del ${g.fecha} por $${elegido.montoPropuesto} MXN?`)) {
    g.asignadoA = elegido.nombre;
    g.asignadoUser = elegido.user;
    g.montoPactado = elegido.montoPropuesto;
    g.estado = 'Asignada';

    guardarDatos();
    renderAlertas();
    renderSolicitudes();
    renderBitacora();
    renderCalendario();
    alert(`¡Guardia asignada a ${elegido.nombre} por $${elegido.montoPropuesto} MXN!`);
  }
}

function cancelarSolicitud(idGuardia) {
  const g = guardias.find(x => x.id === idGuardia);
  if (!g) return;

  if (confirm(`¿Estás seguro de cancelar tu solicitud del ${g.fecha} en ${g.servicio}?`)) {
    g.estado = 'Cancelada';
    g.asignadoA = null;
    g.asignadoUser = null;
    g.postulantes = [];
    guardarDatos();
    renderAlertas();
    renderSolicitudes();
    renderBitacora();
    renderCalendario();
    alert("La solicitud ha sido cancelada.");
  }
}

function abrirModalSolicitud() {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('sol-fecha').value = hoy;
  document.getElementById('sol-turno').value = 'Diurno';
  actualizarInfoTabuladorModal();
  document.getElementById('modal-solicitud').style.display = 'flex';
}

function cerrarModalSolicitud() {
  document.getElementById('modal-solicitud').style.display = 'none';
}

function actualizarInfoTabuladorModal() {
  const fecha = document.getElementById('sol-fecha').value || new Date().toISOString().split('T')[0];
  const turno = document.getElementById('sol-turno').value;
  const reglas = calcularReglasTabulador(fecha, turno);

  document.getElementById('sol-honorario').value = reglas.base;
  document.getElementById('sol-tabulador-info').innerHTML = `
    <strong>Clasificación: ${reglas.nivel}</strong> (faltan ~${reglas.horasRestantes}h)<br>
    Tarifa base: <strong>$${reglas.base}</strong> • Tope máximo permitido (+${reglas.maxPorcentaje}%): <strong>$${reglas.montoMaximo} MXN</strong>
  `;
}

function guardarNuevaSolicitud() {
  const fecha = document.getElementById('sol-fecha').value;
  const turno = document.getElementById('sol-turno').value;
  const servicio = document.getElementById('sol-servicio').value;
  const honorario = Number(document.getElementById('sol-honorario').value);

  if (!fecha || !servicio) {
    alert("Selecciona la fecha y el servicio clínico.");
    return;
  }

  const reglas = calcularReglasTabulador(fecha, turno);

  if (isNaN(honorario) || honorario < reglas.base) {
    alert(`El honorario ofrecido no puede ser menor al tabulador base ($${reglas.base} MXN).`);
    return;
  }

  if (honorario > reglas.montoMaximo) {
    alert(`⚠️ El monto excede el tope permitido para una guardia ${reglas.nivel} ($${reglas.montoMaximo} MXN máximo).`);
    return;
  }

  guardias.unshift({
    id: Date.now(),
    creadaEn: Date.now(),
    solicitante: usuarioActivo.nombre,
    solicitanteUser: usuarioActivo.user,
    zona: usuarioActivo.zona,
    institucion: usuarioActivo.institucion,
    fecha: fecha,
    turno: turno,
    servicio: servicio,
    estado: 'Pendiente',
    postulantes: [],
    asignadoA: null,
    asignadoUser: null,
    honorario: honorario,
    montoPactado: honorario
  });

  cerrarModalSolicitud();
  guardarDatos();
  renderAlertas();
  renderSolicitudes();
  renderBitacora();
  renderCalendario();
}

function renderTablaEfectividad() {
  const cont = document.getElementById('tabla-efectividad-container');
  const guardiasUnidad = guardias.filter(perteneceAMiUnidad);

  const totalPublicadas = guardiasUnidad.length;
  const cubiertas = guardiasUnidad.filter(g => g.estado === 'Asignada' || g.estado === 'Realizada').length;
  const realizadas = guardiasUnidad.filter(g => g.estado === 'Realizada').length;
  const pendientes = guardiasUnidad.filter(g => g.estado === 'Pendiente').length;
  const canceladas = guardiasUnidad.filter(g => g.estado === 'Cancelada').length;

  const activas = totalPublicadas - canceladas;
  const porcentajeEfectividad = activas > 0 ? Math.round((cubiertas / activas) * 100) : 0;

  cont.innerHTML = `
    <table class="eff-table">
      <thead>
        <tr>
          <th>Indicador</th>
          <th>Cantidad</th>
          <th>Detalle</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Efectividad de Cobertura</strong></td>
          <td><strong style="color: var(--primary); font-size: 13px;">${porcentajeEfectividad}%</strong></td>
          <td>${cubiertas} de ${activas} activas cubiertas</td>
        </tr>
        <tr>
          <td>Guardias Realizadas</td>
          <td><span class="badge badge-done">${realizadas}</span></td>
          <td>Turnos completados</td>
        </tr>
        <tr>
          <td>Asignadas (Agendadas)</td>
          <td><span class="badge badge-assigned">${cubiertas - realizadas}</span></td>
          <td>Por ejecutarse</td>
        </tr>
        <tr>
          <td>Pendientes de Relevo</td>
          <td><span class="badge badge-pending">${pendientes}</span></td>
          <td>En búsqueda / con postulantes</td>
        </tr>
        <tr>
          <td>Canceladas</td>
          <td><span class="badge badge-cancelled">${canceladas}</span></td>
          <td>Anuladas por solicitante</td>
        </tr>
      </tbody>
    </table>
  `;
}

function editarMontoPactado(idGuardia) {
  const g = guardias.find(x => x.id === idGuardia);
  if (!g) return;
  const reglas = calcularReglasTabulador(g.fecha, g.turno);
  const nuevoMonto = prompt(
    `Ingresa el monto final pactado ($) (Tope permitido: $${reglas.montoMaximo}):`,
    g.montoPactado || g.honorario
  );
  if (nuevoMonto !== null && !isNaN(Number(nuevoMonto))) {
    const val = Number(nuevoMonto);
    if (val > reglas.montoMaximo) {
      alert(`No puede superar el tope permitido de $${reglas.montoMaximo} MXN.`);
      return;
    }
    g.montoPactado = val;
    guardarDatos();
    renderSolicitudes();
    renderBitacora();
  }
}

function renderBitacora() {
  renderTablaEfectividad();

  const contPedidos = document.getElementById('bitacora-mis-pedidos');
  const contCoberturas = document.getElementById('bitacora-mis-coberturas');
  const contInsumos = document.getElementById('lista-insumos');

  let totalIngresos = 0;
  let totalEgresos = 0;

  const misPedidos = guardias.filter(g => g.solicitante.toLowerCase() === usuarioActivo.nombre.toLowerCase());
  if (misPedidos.length === 0) {
    contPedidos.innerHTML = '<p style="font-size: 12px; color: var(--text-muted);">No has solicitado coberturas.</p>';
  } else {
    contPedidos.innerHTML = misPedidos.map(g => {
      const monto = Number(g.montoPactado || g.honorario || 650);
      if (g.estado === 'Asignada' || g.estado === 'Realizada') {
        totalEgresos += monto;
      }

      return `
        <div style="font-size: 12px; padding: 8px 0; border-bottom: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between;">
            <strong>${g.fecha} - ${g.servicio} (${g.turno})</strong>
            <strong style="color: ${g.estado === 'Cancelada' ? 'var(--text-muted)' : 'var(--danger)'};">
              ${g.estado === 'Cancelada' ? '$0' : `-$${monto}`}
            </strong>
          </div>
          Estado: <strong>${g.estado}</strong> 
          ${g.asignadoA ? `| Cubre: <strong>${g.asignadoA}</strong>` : (g.estado === 'Pendiente' ? `| Postulantes: <strong>${g.postulantes.length}</strong>` : '')}
          <div style="margin-top: 5px; display: flex; gap: 6px; flex-wrap: wrap;">
            ${g.estado !== 'Cancelada' ? `<button class="btn btn-secondary" style="width: auto; padding: 3px 8px; font-size: 11px; margin: 0;" onclick="editarMontoPactado(${g.id})">✏️ Monto</button>` : ''}
            ${g.estado === 'Pendiente' ? `<button class="btn btn-warning" style="width: auto; padding: 3px 8px; font-size: 11px; margin: 0;" onclick="incrementarOfertaGuardia(${g.id})">📈 Subir oferta</button>` : ''}
            ${g.estado === 'Pendiente' ? `<button class="btn btn-danger" style="width: auto; padding: 3px 8px; font-size: 11px; margin: 0;" onclick="cancelarSolicitud(${g.id})">Cancelar</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  const misCoberturas = guardias.filter(g => g.asignadoA && g.asignadoA.toLowerCase() === usuarioActivo.nombre.toLowerCase() && g.estado !== 'Cancelada');
  if (misCoberturas.length === 0) {
    contCoberturas.innerHTML = '<p style="font-size: 12px; color: var(--text-muted);">No tienes guardias agendadas para cubrir.</p>';
  } else {
    contCoberturas.innerHTML = misCoberturas.map(g => {
      const monto = Number(g.montoPactado || g.honorario || 650);
      totalIngresos += monto;

      return `
        <div style="font-size: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${g.fecha}</strong> - ${g.servicio} (${g.turno})<br>
            Solicitante: ${g.solicitante} | Pactado: <strong style="color: var(--success);">+$${monto}</strong><br>
            Estado: <span class="badge ${g.estado === 'Realizada' ? 'badge-done' : 'badge-assigned'}">${g.estado}</span>
            <button class="btn btn-secondary" style="width: auto; padding: 2px 6px; font-size: 10px; margin-left: 4px;" onclick="editarMontoPactado(${g.id})">✏️ Monto</button>
          </div>
          ${g.estado === 'Asignada' ? `<button class="btn btn-success" style="width: auto; padding: 5px 8px; font-size: 11px;" onclick="marcarRealizada(${g.id})">Realizada</button>` : ''}
        </div>
      `;
    }).join('');
  }

  document.getElementById('total-ingresos').innerText = `$${totalIngresos.toLocaleString('es-MX')}`;
  document.getElementById('total-egresos').innerText = `$${totalEgresos.toLocaleString('es-MX')}`;

  const misInsumos = insumos.filter(i => i.usuario.toLowerCase() === usuarioActivo.nombre.toLowerCase());
  if (misInsumos.length === 0) {
    contInsumos.innerHTML = '<p style="font-size: 12px; color: var(--text-muted);">Sin registros de insumos aún.</p>';
  } else {
    contInsumos.innerHTML = misInsumos.map((item) => `
      <div style="font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <div><strong>${item.fecha}</strong>: ${item.descripcion} (${item.servicio})</div>
        <button onclick="eliminarInsumo(${item.id})" style="background: none; border: none; color: var(--danger); font-size: 14px; cursor: pointer;">✕</button>
      </div>
    `).join('');
  }
}

function marcarRealizada(idGuardia) {
  const g = guardias.find(x => x.id === idGuardia);
  if (g) {
    g.estado = 'Realizada';
    guardarDatos();
    renderSolicitudes();
    renderBitacora();
    renderCalendario();
  }
}

function agregarInsumo() {
  const descripcion = prompt("Descripción del insumo o entrega:");
  if (!descripcion) return;
  const servicio = prompt("Servicio o área del insumo:", "Hospitalización");
  if (!servicio) return;

  insumos.push({
    id: Date.now(),
    usuario: usuarioActivo.nombre,
    fecha: new Date().toISOString().split('T')[0],
    servicio: servicio,
    descripcion: descripcion
  });
  guardarDatos();
  renderBitacora();
}

function eliminarInsumo(idInsumo) {
  insumos = insumos.filter(i => i.id !== idInsumo);
  guardarDatos();
  renderBitacora();
}

function renderCalendario() {
  const calBody = document.getElementById('cal-body');
  calBody.innerHTML = '';
  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  document.getElementById('cal-mes-anio').innerText = `${meses[mes]} ${anio}`;

  const primerDia = new Date(anio, mes, 1).getDay();
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  const guardiasUnidad = guardias.filter(perteneceAMiUnidad).filter(g => g.estado !== 'Cancelada');

  for (let i = 0; i < primerDia; i++) {
    calBody.innerHTML += '<div></div>';
  }

  for (let d = 1; d <= totalDias; d++) {
    const diaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const eventosDia = guardiasUnidad.filter(g => g.fecha === diaStr);

    let dots = '';
    eventosDia.forEach(ev => {
      let color = ev.estado === 'Pendiente' ? '#f59e0b' : (ev.estado === 'Realizada' ? '#10b981' : '#0284c7');
      dots += `<span class="cal-event-dot" style="background:${color};"></span>`;
    });

    let celda = document.createElement('div');
    celda.className = 'cal-day';
    celda.innerHTML = `<div>${d}</div><div>${dots}</div>`;
    celda.onclick = () => mostrarDetallesDia(diaStr, eventosDia);
    calBody.appendChild(celda);
  }
}

function cambiarMes(delta) {
  fechaActual.setMonth(fechaActual.getMonth() + delta);
  renderCalendario();
}

function mostrarDetallesDia(fechaStr, eventos) {
  const cont = document.getElementById('cal-detalle-dia');
  if (eventos.length === 0) {
    cont.innerHTML = `<h4 style="font-size: 13px;">${fechaStr}</h4><p style="font-size: 12px; color: var(--text-muted);">Sin solicitudes activas para este día.</p>`;
    return;
  }
  let html = `<h4 style="font-size: 13px; margin-bottom: 6px;">Turnos: ${fechaStr}</h4>`;
  eventos.forEach(e => {
    html += `<div style="font-size: 12px; border-bottom: 1px solid var(--border); padding: 4px 0;">
      <strong>${e.turno}</strong> en ${e.servicio} (${e.estado}) - $${e.montoPactado || e.honorario || 650}<br>
      <span style="color: var(--text-muted);">Solicitó: ${e.solicitante} ${e.asignadoA ? `| Cubre: ${e.asignadoA}` : ''}</span>
    </div>`;
  });
  cont.innerHTML = html;
}

function renderPadron() {
  const cont = document.getElementById('lista-estrategas');
  cont.innerHTML = '';

  const colegasUnidad = usuarios.filter(perteneceAMiUnidad);

  colegasUnidad.forEach(e => {
    const esYo = e.user === usuarioActivo.user;
    const msgWa = `Hola ${e.nombre}, te contacto desde Control de Guardias de ${e.institucion}.`;
    
    let card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center;">
        ${renderAvatarHTML(e, 'avatar-sm')}
        <div style="flex: 1;">
          <strong>${e.nombre}</strong> ${esYo ? '<span class="badge badge-mine">Tú</span>' : ''}<br>
          <span style="font-size: 12px; color: var(--text-muted);">${e.perfil}</span><br>
          <span style="font-size: 11px; color: var(--primary); font-weight: 600;">${e.institucion || 'Sin unidad'} • ${e.zona || 'Sin zona'}</span>
        </div>
      </div>
      <div style="margin-top: 8px; font-size: 12px;">
        <strong>Áreas:</strong> ${formatearAreasTexto(e.areas)}
      </div>
      <div style="margin-top: 6px; font-size: 12px; background: #f8fafc; padding: 6px; border-radius: 4px;">
        Diurna: <strong>$${e.honorarioDiurno || 650}</strong> | Nocturna: <strong>$${e.honorarioNocturno || 1300}</strong>
      </div>
      ${!esYo && e.whatsapp ? `<a href="${generarLinkWhatsApp(e.whatsapp, msgWa)}" target="_blank" class="btn-wa" style="width: 100%; margin-top: 8px;">💬 Contactar por WhatsApp</a>` : ''}
    `;
    cont.appendChild(card);
  });
}

function cambiarTab(tab) {
  document.getElementById('tab-solicitudes').style.display = tab === 'solicitudes' ? 'block' : 'none';
  document.getElementById('tab-bitacora').style.display = tab === 'bitacora' ? 'block' : 'none';
  document.getElementById('tab-calendario').style.display = tab === 'calendario' ? 'block' : 'none';
  document.getElementById('tab-padron').style.display = tab === 'padron' ? 'block' : 'none';
  document.getElementById('tab-perfil').style.display = tab === 'perfil' ? 'block' : 'none';
  
  const tabNames = ['solicitudes', 'bitacora', 'calendario', 'padron', 'perfil'];
  document.querySelectorAll('.tab-btn').forEach((b, idx) => {
    b.classList.toggle('active', tabNames[idx] === tab);
  });

  if (tab === 'perfil') cargarFormularioEditarPerfil();
}

setInterval(() => {
  if (usuarioActivo && document.getElementById('tab-solicitudes').style.display !== 'none') {
    renderSolicitudes();
  }
}, 60000);

// REGISTRO DEL SERVICE WORKER PARA APP INSTALABLE (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW:', err));
  });
}

inicializarSelectoresAreas();
verificarSesion();
