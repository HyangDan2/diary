/**
 * HD2's Diary — search box + `#tag` filtering.
 *
 * The whole index is one small static file (/search.json, built by search.11ty.js), so
 * there is no search service to run: the page fetches it once and filters in the browser.
 *
 *  - Home:      the box sits above the recent list. While a query or a category chip is
 *               active, the recent list is replaced by the matching posts from the index.
 *  - Category:  the box filters the rows already on the page, so it only ever searches
 *               inside that category.
 *  - Tag chips: every list row ends with its `#tags`. Pressing one drops `#tag` into the
 *               search box (pressing it again removes it), so the same list narrows at once.
 *
 * Matching: space separated terms, all of them must match (AND), case-insensitive,
 * partial match against title · summary · category · tags · subheadings and the opening
 * of the body text. A leading `#` is optional.
 */
(function () {
    "use strict";

    const bars = document.querySelectorAll("[data-diary-search]");
    if (!bars.length) return;

    /* ---------- text helpers ---------- */

    const norm = (value) =>
        String(value == null ? "" : value)
            .normalize("NFKC")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

    function termsOf(query) {
        return norm(query)
            .split(" ")
            .map((term) => {
                const tagged = term.startsWith("#");
                const text = term.replace(/^#+/, "").replace(/[.,;:!?·]+$/, "");
                return { text, tagged };
            })
            .filter((term) => term.text);
    }

    function prepare(post) {
        const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];
        const hay = norm(
            [
                post.title,
                post.summary,
                post.category,
                post.categoryLabel,
                post.keywords,
                post.date,
                post.dateLabel,
                tags.join(" "),
                tags.map((tag) => "#" + tag).join(" "),
            ].join(" "),
        );
        return { ...post, tags, hay };
    }

    /* ---------- row markup (same shape as parts/post-list.njk) ---------- */

    function tagsRow(tags) {
        const row = document.createElement("div");
        row.className = "post-row-tags";
        if (!tags || !tags.length) row.dataset.empty = "true";
        (tags || []).forEach((tag) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "post-tag";
            chip.dataset.tag = tag;
            chip.setAttribute("aria-pressed", "false");
            const hash = document.createElement("span");
            hash.className = "post-tag-hash";
            hash.setAttribute("aria-hidden", "true");
            hash.textContent = "#";
            chip.append(hash, document.createTextNode(tag));
            row.append(chip);
        });
        return row;
    }

    function resultRow(post, state) {
        const item = document.createElement("li");
        item.className = "post-row";
        item.dataset.postUrl = post.url || "";
        if (post.lang === "en" || post.lang === "ko") item.lang = post.lang;

        const link = document.createElement("a");
        link.className = "post-row-link";
        link.href = state.base + String(post.url || "").replace(/^\//, "");

        const meta = document.createElement("span");
        meta.className = "post-row-meta";
        const time = document.createElement("time");
        time.dateTime = post.date || "";
        time.textContent = post.dateLabel || post.date || "";
        meta.append(time);
        if (post.categoryLabel) {
            const badge = document.createElement("span");
            badge.className = "badge";
            badge.textContent = post.categoryLabel;
            meta.append(badge);
        }

        const body = document.createElement("span");
        body.className = "post-row-body";
        const title = document.createElement("strong");
        title.className = "post-row-title";
        title.textContent = post.title || "";
        body.append(title);
        if (post.summary) {
            const summary = document.createElement("span");
            summary.className = "post-row-summary";
            summary.textContent = post.summary;
            body.append(summary);
        }

        const arrow = document.createElement("span");
        arrow.className = "post-row-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↗";

        link.append(meta, body, arrow);
        item.append(link);
        item.append(tagsRow(post.tags));
        return item;
    }

    /* ---------- status line ---------- */

    function paintStatus(state, bits) {
        if (!state.status) return;
        const next = document.createDocumentFragment();
        bits.forEach(([text, kind]) => {
            const node = document.createElement(kind === "strong" ? "strong" : "span");
            node.textContent = text;
            next.append(node);
        });
        state.status.textContent = "";
        state.status.append(next);
    }

    function idleStatus(state) {
        if (state.lang === "en") {
            paintStatus(state, [
                [state.label + " · ", null],
                [String(totalOf(state)), "strong"],
                [" notes · search titles, summaries, tags", null],
            ]);
            return;
        }
        paintStatus(state, [
            [state.label + " ", null],
            [String(totalOf(state)), "strong"],
            ["편 · 제목·요약·태그로 검색", null],
        ]);
    }

    function matchStatus(state, matched, terms) {
        if (state.lang === "en") {
            const bits = [];
            const scopeChip = state.scopes.find((chip) => chip.dataset.scope === state.scope);
            if (state.scope && scopeChip) bits.push([scopeChip.textContent.trim() + " · ", null]);
            else if (state.mode === "category") bits.push([state.label + " · ", null]);
            if (terms.length) bits.push(["“" + state.input.value.trim() + "” · ", null]);
            bits.push([String(matched), "strong"]);
            bits.push([" of " + totalOf(state) + " notes", null]);
            paintStatus(state, bits);
            return;
        }
        const bits = [];
        const scopeChip = state.scopes.find((chip) => chip.dataset.scope === state.scope);
        if (state.scope && scopeChip) bits.push([scopeChip.textContent.trim() + " · ", null]);
        else if (state.mode === "category") bits.push([state.label + " · ", null]);
        if (terms.length) bits.push(["“" + state.input.value.trim() + "” ", null]);
        bits.push([String(matched), "strong"]);
        bits.push(["편 / " + state.label + " " + totalOf(state) + "편", null]);
        paintStatus(state, bits);
    }

    /* ---------- state ---------- */

    function totalOf(state) {
        if (state.mode === "category" && state.category) {
            const scoped = state.index.filter((post) => !post.categorySlug || post.categorySlug === state.category);
            return state.index.length ? scoped.length : state.defaultRows.length;
        }
        return state.index.length || state.defaultRows.length;
    }

    function isActive(state) {
        return Boolean(state.input.value.trim() || state.scope);
    }

    function matches(post, terms) {
        return terms.every((term) =>
            term.tagged ? post.tags.some((tag) => norm(tag) === term.text) : post.hay.includes(term.text),
        );
    }

    function inScope(post, state) {
        if (state.mode === "category" && state.category && post.categorySlug && post.categorySlug !== state.category) {
            return false;
        }
        if (state.scope && post.categorySlug !== state.scope) return false;
        return true;
    }

    /* ---------- rendering ---------- */

    function renderIdle(state) {
        if (state.clear) state.clear.hidden = !isActive(state);
        if (state.defaultRows.length) state.defaultRows.forEach((row) => { row.hidden = false; });
        if (state.defaultBox) state.defaultBox.hidden = false;
        if (state.resultsBox) state.resultsBox.hidden = true;
        if (state.resultList) {
            state.resultList.textContent = "";
            state.resultList.hidden = false;
        }
        if (state.emptyBox) state.emptyBox.hidden = true;
        if (state.heading) state.heading.textContent = state.defaultHeading;
        if (state.ready) idleStatus(state);
        syncTagChips(state, []);
        state.scopes.forEach((chip) => {
            chip.setAttribute("aria-pressed", String((chip.dataset.scope || "") === state.scope));
        });
    }

    function syncTagChips(state, terms) {
        const active = new Set(terms.map((term) => term.text));
        state.panel.querySelectorAll("[data-tag]").forEach((chip) => {
            chip.setAttribute("aria-pressed", String(active.has(norm(chip.dataset.tag))));
        });
    }

    function apply(state) {
        if (!isActive(state)) {
            renderIdle(state);
            return;
        }
        // Until the index arrives, typing must not pretend there are no matches.
        if (!state.ready) {
            if (state.clear) state.clear.hidden = false;
            paintStatus(state, [[state.lang === "en" ? "Getting the search ready…" : "검색 준비 중…", null]]);
            return;
        }

        const terms = termsOf(state.input.value);
        const matched = state.index.filter((post) => inScope(post, state) && matches(post, terms));

        if (state.clear) state.clear.hidden = false;
        if (state.heading) state.heading.textContent = state.lang === "en" ? "Search results." : "검색 결과.";

        if (state.mode === "home") {
            if (state.defaultBox) state.defaultBox.hidden = true;
            if (state.resultList) {
                const next = document.createDocumentFragment();
                matched.forEach((post) => next.append(resultRow(post, state)));
                state.resultList.textContent = "";
                state.resultList.append(next);
                state.resultList.hidden = matched.length === 0;
            }
        } else {
            const urls = new Set(matched.map((post) => post.url));
            state.defaultRows.forEach((row) => {
                row.hidden = !urls.has(row.dataset.postUrl);
            });
            if (state.resultList) {
                state.resultList.textContent = "";
                state.resultList.hidden = true;
            }
        }

        if (state.resultsBox) state.resultsBox.hidden = false;
        if (state.emptyBox) {
            state.emptyBox.hidden = matched.length > 0;
            if (state.emptyText && matched.length === 0) {
                const query = state.input.value.trim();
                if (state.lang === "en") {
                    state.emptyText.textContent = query
                        ? `No notes match “${query}”. Try another word.`
                        : "No notes match that yet.";
                } else {
                    state.emptyText.textContent = query
                        ? `“${query}”에 해당하는 기록이 없다. 다른 단어로 찾아보자.`
                        : "이 조건에 해당하는 기록이 없다.";
                }
            }
        }

        matchStatus(state, matched.length, terms);
        syncTagChips(state, terms);
        state.scopes.forEach((chip) => {
            chip.setAttribute("aria-pressed", String((chip.dataset.scope || "") === state.scope));
        });
    }

    function schedule(state) {
        if (state.frame) return;
        state.frame = window.requestAnimationFrame(() => {
            state.frame = 0;
            apply(state);
        });
    }

    /* ---------- actions ---------- */

    function setQuery(state, value) {
        state.input.value = value;
        apply(state);
    }

    function toggleTag(state, tag) {
        const target = norm(tag);
        const terms = norm(state.input.value).split(" ").filter(Boolean);
        const on = terms.some((term) => term.replace(/^#+/, "") === target);
        const next = on
            ? terms.filter((term) => term.replace(/^#+/, "") !== target)
            : terms.concat("#" + tag);
        setQuery(state, next.join(" "));
    }

    function setScope(state, scope) {
        state.scope = state.scope === scope ? "" : scope;
        apply(state);
    }

    function clearAll(state) {
        state.scope = "";
        state.input.value = "";
        apply(state);
    }

    function goFirst(state) {
        if (!isActive(state)) return;
        let link = null;
        if (state.mode === "home") {
            link = state.resultList ? state.resultList.querySelector(".post-row-link") : null;
        } else {
            const row = state.defaultRows.find((item) => !item.hidden);
            link = row ? row.querySelector(".post-row-link") : null;
        }
        if (link) window.location.href = link.getAttribute("href");
    }

    /* ---------- index ---------- */

    function indexFromDom(rows) {
        return rows.map((row) =>
            prepare({
                title: row.querySelector(".post-row-title")?.textContent ?? "",
                summary: row.querySelector(".post-row-summary")?.textContent ?? "",
                categoryLabel: row.querySelector(".badge")?.textContent ?? "",
                category: "",
                categorySlug: "",
                tags: Array.from(row.querySelectorAll("[data-tag]")).map((chip) => chip.dataset.tag),
                date: row.querySelector("time")?.getAttribute("datetime") ?? "",
                dateLabel: row.querySelector("time")?.textContent ?? "",
                url: row.dataset.postUrl,
                lang: row.getAttribute("lang") || "",
                keywords: "",
            }),
        );
    }

    async function loadIndex(state) {
        try {
            const response = await fetch(state.indexUrl, { headers: { accept: "application/json" } });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            const posts = Array.isArray(data && data.posts) ? data.posts : [];
            if (!posts.length) throw new Error("empty index");
            state.index = posts.map(prepare);
        } catch {
            state.index = indexFromDom(state.defaultRows);
        }
        state.ready = true;
        apply(state);
    }

    /* ---------- init ---------- */

    function init(root) {
        const panel = root.parentElement || root;
        const state = {
            root,
            panel,
            lang: root.dataset.lang === "en" ? "en" : "ko",
            mode: root.dataset.mode === "category" ? "category" : "home",
            category: root.dataset.category || "",
            label: root.dataset.totalLabel || (root.dataset.lang === "en" ? "All" : "전체"),
            indexUrl: root.dataset.indexUrl || "/diary/search.json",
            base: root.dataset.base || "",
            scope: "",
            index: [],
            frame: 0,
            ready: false,
            input: root.querySelector("[data-search-input]"),
            clear: root.querySelector("[data-search-clear]"),
            status: root.querySelector("[data-search-status]"),
            scopes: Array.from(root.querySelectorAll("[data-scope]")),
            defaultBox: panel.querySelector("[data-search-default]"),
            defaultRows: [],
            resultsBox: panel.querySelector("[data-search-results]"),
            resultList: panel.querySelector("[data-search-result-list]"),
            emptyBox: panel.querySelector("[data-search-empty]"),
            emptyText: panel.querySelector("[data-search-empty-text]"),
            heading: panel.querySelector(".section-heading h2"),
            defaultHeading: "",
        };
        if (!state.input || !state.status) return;

        state.base = state.base
            ? (state.base.endsWith("/") ? state.base : state.base + "/")
            : state.indexUrl.replace(/[^/]*$/, "");
        state.defaultRows = state.defaultBox ? Array.from(state.defaultBox.querySelectorAll(".post-row")) : [];
        state.defaultHeading = state.heading ? state.heading.textContent : "";

        state.input.addEventListener("input", () => schedule(state));
        state.input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                goFirst(state);
            } else if (event.key === "Escape") {
                event.preventDefault();
                clearAll(state);
            }
        });
        state.clear?.addEventListener("click", () => {
            clearAll(state);
            state.input.focus();
        });
        root.addEventListener("click", (event) => {
            const chip = event.target.closest("[data-scope]");
            if (!chip) return;
            event.preventDefault();
            setScope(state, chip.dataset.scope || "");
        });
        panel.addEventListener("click", (event) => {
            const chip = event.target.closest("[data-tag]");
            if (!chip) return;
            event.preventDefault();
            toggleTag(state, chip.dataset.tag);
        });
        // Escape clears the search even while focus sits on a tag chip or a scope chip.
        panel.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || event.target === state.input || !isActive(state)) return;
            event.preventDefault();
            clearAll(state);
        });

        apply(state);
        loadIndex(state);
    }

    bars.forEach(init);
})();
