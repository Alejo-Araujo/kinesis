import { mostrar } from './ui.js';

function navItemActive(divId) {
    document.querySelectorAll('.navbar-nav a.nav-link, .navbar-nav a.dropdown-item')
        .forEach(link => {
            link.classList.remove('active-nav-link');
            link.classList.remove('active'); 
        });

    const activeLink = document.querySelector(`.navbar-nav a[data-target="${divId}"]`);

    if (activeLink) {
        activeLink.classList.add('active-nav-link');

        if (activeLink.classList.contains('dropdown-item')) {
            const dropdownParentLi = activeLink.closest('.dropdown');
            if (dropdownParentLi) {
                const dropdownToggle = dropdownParentLi.querySelector('.dropdown-toggle'); 
                if (dropdownToggle) {
                    dropdownToggle.classList.add('active-nav-link'); 
                    dropdownToggle.classList.add('active'); 
                }
            }
        }
    }
}

function adjustBodyPadding() {
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar.offsetHeight;
    document.body.style.paddingTop = (navbarHeight * 1.5) + 'px';
};

function inicializarNavbar(cambioDeVista) {
    const navbar = document.getElementById('navbar');
    navbar.classList.remove('d-none');
    const navLinks = document.querySelectorAll('.navbar-nav a[data-target]'); 
    
    navLinks.forEach(link => { 
        link.addEventListener('click', async (event) => { 
            event.preventDefault(); 

            const divId = link.dataset.target;
            const resultado = await mostrar(divId);
            if(resultado === false){
                return;
            }
            navItemActive(divId);
            adjustBodyPadding();
            if (cambioDeVista && typeof cambioDeVista === 'function') {
                cambioDeVista(divId);
            }
        });
    });
}

export { inicializarNavbar, adjustBodyPadding, navItemActive };
