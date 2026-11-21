/* HD2's Diary — mobile navigation drawer (right unfolding sidebar) */
(function () {
    'use strict';

    var menuButton = document.querySelector('.menu-button');
    var mobileDrawer = document.getElementById('mobile-drawer');
    var drawerBackdrop = document.querySelector('.drawer-backdrop');
    var drawerClose = document.querySelector('.drawer-close');
    if (!menuButton || !mobileDrawer || !drawerBackdrop || !drawerClose) return;

    function openDrawer() {
        drawerBackdrop.hidden = false;
        window.requestAnimationFrame(function () {
            drawerBackdrop.classList.add('is-visible');
            mobileDrawer.classList.add('is-open');
        });
        mobileDrawer.setAttribute('aria-hidden', 'false');
        menuButton.setAttribute('aria-expanded', 'true');
        document.body.classList.add('drawer-open');
        drawerClose.focus();
    }

    function closeDrawer(restoreFocus) {
        if (!mobileDrawer.classList.contains('is-open')) return;
        mobileDrawer.classList.remove('is-open');
        drawerBackdrop.classList.remove('is-visible');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        menuButton.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('drawer-open');
        window.setTimeout(function () {
            if (!mobileDrawer.classList.contains('is-open')) drawerBackdrop.hidden = true;
        }, 260);
        if (restoreFocus) menuButton.focus();
    }

    menuButton.addEventListener('click', openDrawer);
    drawerClose.addEventListener('click', function () { closeDrawer(true); });
    drawerBackdrop.addEventListener('click', function () { closeDrawer(true); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && mobileDrawer.classList.contains('is-open')) closeDrawer(true);
    });
    // Returning through bfcache should never restore an unfolded sidebar.
    window.addEventListener('pageshow', function () { closeDrawer(false); });

    // Section accordions (Apps, Play, Diary, Info): the row label links to the hub
    // page, the caret unfolds that group's sections — and unfolding one group folds
    // the others, so a long section such as Apps never pushes About off the drawer.
    // A page can start with its own group open by setting is-open /
    // aria-expanded="true" in the markup.
    var groups = Array.prototype.slice.call(document.querySelectorAll('.drawer-group'));
    var setOpen = function (group, open) {
        var toggle = group.querySelector('.drawer-toggle');
        var panel = group.querySelector('.drawer-sub');
        if (!toggle || !panel) return;
        group.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        // A collapsed panel keeps its height transition, so its links have to
        // leave the tab order another way than display:none.
        panel.inert = !open;
        if (open) {
            panel.removeAttribute('aria-hidden');
            // Reopening a scrolled section starts it at its first row again.
            var list = panel.querySelector('.drawer-sub-inner') || panel;
            list.scrollTop = 0;
        } else {
            panel.setAttribute('aria-hidden', 'true');
        }
    };
    groups.forEach(function (group) {
        var toggle = group.querySelector('.drawer-toggle');
        if (!toggle) return;
        setOpen(group, toggle.getAttribute('aria-expanded') === 'true');
        toggle.addEventListener('click', function () {
            var open = toggle.getAttribute('aria-expanded') !== 'true';
            if (open) groups.forEach(function (other) { if (other !== group) setOpen(other, false); });
            setOpen(group, open);
        });
    });
})();
