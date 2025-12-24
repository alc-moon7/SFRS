// Toggle the mobile sidebar menu
document
    .getElementById("mobileMenuToggle")
    .addEventListener("click", function () {
        document.getElementById("mobileSidebar").classList.add("active");
    });

document.getElementById("closeSidebar").addEventListener("click", function () {
    document.getElementById("mobileSidebar").classList.remove("active");
});

// Parallax effect for the background image
document.addEventListener("DOMContentLoaded", function () {
    const sections = [
        document.querySelector(".home-mission-vision"),
        document.querySelector(".home-counter"),
    ].filter(Boolean);
    const parallaxSpeed = 0.5;

    if (sections.length === 0) return; // Exit early if no section is found

    function updateParallax() {
        const scrolled = window.scrollY;
        sections.forEach((section) => {
            const offsetTop = section.offsetTop;
            const height = section.offsetHeight;

            if (
                scrolled + window.innerHeight > offsetTop &&
                scrolled < offsetTop + height
            ) {
                const yOffset = (scrolled - offsetTop) * parallaxSpeed;
                section.style.backgroundPosition = `center calc(60% + ${yOffset}px)`;
            }
        });

        requestAnimationFrame(updateParallax);
    }

    requestAnimationFrame(updateParallax);
});

//home page slider
document.addEventListener("DOMContentLoaded", function () {
    const mainSplide = document.getElementById("mainSplide");
    if (mainSplide) {
        const slides = mainSplide.querySelectorAll(".splide__slide");
        const isLoop = slides.length > 1;
        new Splide(mainSplide, {
            type: isLoop ? "loop" : "slide",
            pagination: false,
            arrows: isLoop,
            autoplay: isLoop,
            interval: 5000,
            pauseOnHover: false,
            resetProgress: false,
            cover: true,
            drag: isLoop,
        }).mount();
    }
});

// main marquee
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".js-marquee").forEach((el) => {
        const speed = parseFloat(el.dataset.speed) || 1;
        const gap = el.dataset.gap || "4rem";
        const totalItems = el.querySelectorAll(".splide__slide").length;

        new Splide(el, {
            type: "loop",
            perPage: 1,
            gap,
            arrows: false,
            pagination: false,
            drag: false,
            autoWidth: true,
            autoHeight: true,
            clones: totalItems < 6 ? totalItems * 4 : totalItems,
            autoScroll: {
                speed,
            },
        }).mount(window.splide.Extensions);
    });
});
