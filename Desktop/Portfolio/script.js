document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav-links');

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
        toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });

    nav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            nav.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open navigation');
        });
    });

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.14 });

    document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
});