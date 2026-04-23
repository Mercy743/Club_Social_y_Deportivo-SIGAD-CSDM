const user = JSON.parse(localStorage.getItem('loggedUser'));

function irLogin() {
    window.location.href = 'index.html';
}

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}

// Navbar se oscurece al hacer scroll
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 60) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Scroll suave para los links del navbar
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});