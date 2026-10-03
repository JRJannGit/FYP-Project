
(function () {

    function bindBuddy(el) {
        if (el.dataset.buddyBound === "true") return;
        el.dataset.buddyBound = "true";

        el.addEventListener("click", () => {
            el.classList.remove("happy");
            void el.offsetWidth;
            el.classList.add("happy");
            setTimeout(() => el.classList.remove("happy"), 600);
        });
    }

    function bindAll(root = document) {
        root.querySelectorAll(".buddy").forEach(bindBuddy);
    }

    document.addEventListener("DOMContentLoaded", () => bindAll());

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                if (node.classList && node.classList.contains("buddy")) bindBuddy(node);
                else node.querySelectorAll?.(".buddy").forEach(bindBuddy);
            });
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });

})();