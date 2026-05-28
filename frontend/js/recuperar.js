const API_URL = '/api';
emailjs.init("LwEfGdDK4QnjF6dtr");
let emailUsuario = '';

function showMessage(elementId, text, isError = true) {
    const msgDiv = document.getElementById(elementId);
    const className = isError ? 'error' : 'success';
    msgDiv.innerHTML = `<div class="${className}">${text}</div>`;
    setTimeout(() => {
        if (msgDiv.innerHTML) msgDiv.innerHTML = '';
    }, 5000);
}

// Toggle de visibilidad de contraseña
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const svg = this.querySelector('svg');
        const isHidden = input.type === 'password';

        if (isHidden) {
            input.type = 'text';
            this.setAttribute('aria-label', 'Ocultar contraseña');
            this.style.opacity = '1';
            if (svg) {
                svg.innerHTML = `
                    <path d="M1 12 C5 5, 19 5, 23 12" stroke="#54cfe0" stroke-width="2" fill="none" stroke-linecap="round"/>
                    <path d="M1 12 C5 19, 19 19, 23 12" stroke="#54cfe0" stroke-width="2" fill="none" stroke-linecap="round"/>
                    <circle cx="12" cy="12" r="3.5" stroke="#54cfe0" stroke-width="2" fill="none"/>
                    <line x1="3" y1="3" x2="21" y2="21" stroke="#54cfe0" stroke-width="2" stroke-linecap="round"/>
                `;
            }
        } else {
            input.type = 'password';
            this.setAttribute('aria-label', 'Mostrar contraseña');
            this.style.opacity = '0.6';
            if (svg) {
                svg.innerHTML = `
                    <path d="M1 12 C5 5, 19 5, 23 12" stroke="#54cfe0" stroke-width="2" fill="none" stroke-linecap="round"/>
                    <path d="M1 12 C5 19, 19 19, 23 12" stroke="#54cfe0" stroke-width="2" fill="none" stroke-linecap="round"/>
                    <circle cx="12" cy="12" r="3.5" stroke="#54cfe0" stroke-width="2" fill="none"/>
                `;
            }
        }
    });

    btn.addEventListener('mouseenter', function() { this.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function() {
        const input = document.getElementById(this.getAttribute('data-target'));
        if (input.type === 'password') this.style.opacity = '0.6';
    });
});

// Paso 1: Solicitar PIN
document.getElementById('sendPinBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    if (!email) {
        showMessage('step1Message', 'Ingresa tu correo electrónico', true);
        return;
    }

    const btn = document.getElementById('sendPinBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60000);
    const timeStr = expires.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    sessionStorage.setItem('sigad_pin', pin);
    sessionStorage.setItem('sigad_pin_expires', expires.getTime());

    try {
        await emailjs.send("service_vrne29x", "template_2v1xrja", {
            to_email: email,
            nombre: email,
            passcode: pin,
            time: timeStr
        });
        showMessage('step1Message', 'Revisa tu correo (incluyendo spam)', false);
        emailUsuario = email;
        document.getElementById('step1').classList.remove('active');
        document.getElementById('step2').classList.add('active');
    } catch (error) {
        console.error('EmailJS error:', error);
        showMessage('step1Message', 'Error al enviar el código. Intenta de nuevo.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar código PIN';
    }
});

// Paso 2: Restablecer contraseña
document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const pin = document.getElementById('pin').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!pin || !newPassword || !confirmPassword) {
        showMessage('step2Message', 'Completa todos los campos', true);
        return;
    }
    if (newPassword.length < 6) {
        showMessage('step2Message', 'La contraseña debe tener al menos 6 caracteres', true);
        return;
    }
    if (newPassword !== confirmPassword) {
        showMessage('step2Message', 'Las contraseñas no coinciden', true);
        return;
    }

    const pinGuardado = sessionStorage.getItem('sigad_pin');
    const expires = sessionStorage.getItem('sigad_pin_expires');

    if (!pinGuardado) {
        showMessage('step2Message', 'El código expiró. Solicita uno nuevo.', true);
        return;
    }
    if (Date.now() > parseInt(expires)) {
        showMessage('step2Message', 'El código expiró. Solicita uno nuevo.', true);
        sessionStorage.clear();
        return;
    }
    if (pin !== pinGuardado) {
        showMessage('step2Message', 'Código incorrecto', true);
        return;
    }

    const btn = document.getElementById('resetPasswordBtn');
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    try {
        const res = await fetch(`${API_URL}/recuperar/restablecer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailUsuario, pin, nueva_password: newPassword })
        });
        const data = await res.json();
        if (res.ok) {
            sessionStorage.clear();
            showMessage('step2Message', 'Contraseña actualizada. Redirigiendo...', false);
            setTimeout(() => window.location.href = 'index.html', 2000);
        } else {
            showMessage('step2Message', data.error || 'Error al actualizar', true);
        }
    } catch (error) {
        showMessage('step2Message', 'Error de conexión', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Restablecer contraseña';
    }
});

// Volver al paso 1
document.getElementById('backToStep1Btn').addEventListener('click', () => {
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step1').classList.add('active');
    document.getElementById('pin').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('step2Message').innerHTML = '';
});