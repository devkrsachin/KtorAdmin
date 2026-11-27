function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function handleFilterInputs() {
    const urlParams = new URLSearchParams(window.location.search);

    let hasFilters = [...urlParams.keys()].some(key => key.startsWith('filters.'));
    if (!hasFilters) return;

    // Iterate over all filter containers
    document.querySelectorAll('.filter').forEach(filterContainer => {
        const paramName = filterContainer.querySelector('input, select').name;
        const startParam = `filters.${paramName}-start`;
        const endParam = `filters.${paramName}-end`;

        const startInput = filterContainer.querySelector('input[id$="-start"]');
        const endInput = filterContainer.querySelector('input[id$="-end"]');
        const selectInput = filterContainer.querySelector('select');

        // Handle date or datetime-local start input
        if (startInput && urlParams.has(startParam)) {
            const startTimestamp = parseInt(urlParams.get(startParam));
            const startDate = new Date(startTimestamp);

            if (startInput.type === 'date') {
                startInput.value = startDate.toISOString().split('T')[0];  // Format to 'yyyy-mm-dd'
            } else if (startInput.type === 'datetime-local') {
                startInput.value = startDate.toISOString().slice(0, 16);  // Format to 'yyyy-mm-ddTHH:mm'
            }
        }

        // Handle date or datetime-local end input
        if (endInput && urlParams.has(endParam)) {
            const endTimestamp = parseInt(urlParams.get(endParam));
            const endDate = new Date(endTimestamp);

            if (endInput.type === 'date') {
                endInput.value = endDate.toISOString().split('T')[0];  // Format to 'yyyy-mm-dd'
            } else if (endInput.type === 'datetime-local') {
                endInput.value = endDate.toISOString().slice(0, 16);  // Format to 'yyyy-mm-ddTHH:mm'
            }
        }

        // Handle select input
        if (selectInput && urlParams.has(`filters.${paramName}`)) {
            selectInput.value = urlParams.get(`filters.${paramName}`);
        }
    });

}

// Call the function when page loads

function handleClicks() {
    const rows = document.querySelectorAll(".row");

    rows.forEach(row => {
        row.addEventListener("click", function (event) {
            if (!event.target.closest('.file-link, .checkbox-input, .checkmark, .inline-editable-cell, .inline-edit-input')) {
                redirectToEdit(row.dataset.primaryKey);
            }
        });
    });
}

function handleInlineBooleanEdits() {
    const checkboxes = document.querySelectorAll('.inline-boolean-checkbox:not([disabled])');
    checkboxes.forEach(cb => {
        cb.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        cb.addEventListener('change', async function (e) {
            e.stopPropagation();
            const primaryKey = cb.dataset.primaryKey;
            const fieldName = cb.dataset.fieldName;
            const isChecked = cb.checked;
            const newValue = isChecked ? "true" : "false";

            const result = await sendPatchRequest(primaryKey, fieldName, newValue);
            if (!result || result.status !== 'success') {
                cb.checked = !isChecked;
            }
        });
    });
}

function handleInlineCellEdits() {
    const editableCells = document.querySelectorAll('.inline-editable-cell');
    editableCells.forEach(cell => {
        cell.addEventListener('click', function (e) {
            e.stopPropagation();
            if (cell.classList.contains('inline-editing') || cell.classList.contains('inline-saving')) return;
            startInlineEdit(cell);
        });
    });
}

function startInlineEdit(cell) {
    const originalValue = cell.dataset.value || '';
    const fieldName = cell.dataset.fieldName;
    const fieldType = cell.dataset.fieldType;
    const primaryKey = cell.dataset.primaryKey;

    cell.classList.add('inline-editing');

    const input = document.createElement('input');
    input.type = (fieldType === 'INTEGER' || fieldType === 'UINTEGER' || fieldType === 'SHORT' ||
                  fieldType === 'USHORT' || fieldType === 'LONG' || fieldType === 'ULONG' ||
                  fieldType === 'DOUBLE' || fieldType === 'FLOAT' || fieldType === 'BIG_DECIMAL' ||
                  fieldType === 'DECIMAL128') ? 'number' : 'text';
    input.className = 'inline-edit-input';
    input.value = originalValue;

    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    let committed = false;

    async function commitEdit() {
        if (committed) return;
        committed = true;

        const newValue = input.value;
        if (newValue === originalValue) {
            finishEdit(originalValue, originalValue);
            return;
        }

        cell.classList.remove('inline-editing');
        cell.classList.add('inline-saving');
        cell.innerHTML = `<div class="item-text inline-editable-text">${escapeHtml(newValue)}</div>`;

        const result = await sendPatchRequest(primaryKey, fieldName, newValue);
        cell.classList.remove('inline-saving');
        if (result && result.status === 'success') {
            cell.dataset.value = newValue;
            cell.classList.add('inline-success');
            setTimeout(() => cell.classList.remove('inline-success'), 1200);
            finishEdit(newValue, result.displayValue !== undefined ? result.displayValue : newValue);
        } else {
            cell.classList.add('inline-error');
            setTimeout(() => cell.classList.remove('inline-error'), 1200);
            finishEdit(originalValue, originalValue);
        }
    }

    function cancelEdit() {
        if (committed) return;
        committed = true;
        finishEdit(originalValue, originalValue);
    }

    function finishEdit(val, displayVal) {
        cell.classList.remove('inline-editing');
        cell.dataset.value = val;
        cell.innerHTML = `<div class="item-text inline-editable-text">${escapeHtml(displayVal)}</div>`;
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });

    input.addEventListener('blur', function () {
        commitEdit();
    });

    input.addEventListener('click', function (e) {
        e.stopPropagation();
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function sendPatchRequest(primaryKey, fieldName, value) {
    try {
        const token = (typeof csrfToken !== 'undefined') ? csrfToken : '';
        const plural = (typeof pluralNameBase !== 'undefined') ? pluralNameBase : cleanUrl().pathname.split('/').filter(Boolean).pop();
        const response = await fetch(`/${adminPath}/resources/${plural}/${primaryKey}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': token
            },
            body: JSON.stringify({
                field: fieldName,
                value: value,
                _csrf: token
            })
        });

        const json = await response.json();
        if (response.ok && json.status === 'success') {
            return json;
        } else {
            const errorMsg = json.message || 'Failed to update field';
            showAlert(`ERROR: ${errorMsg}`, 'error');
            return null;
        }
    } catch (err) {
        console.error(err);
        showAlert(`ERROR: ${err.message || 'Network error'}`, 'error');
        return null;
    }
}

function handleSearches() {
    const searchValue = getQueryParam('search');
    for (let element of document.getElementsByClassName('search-input')) {
        if (searchValue) {
            element.value = searchValue;
        }
        element.addEventListener('keydown', function (event) {
            if (event.keyCode === 13) {
                performSearch(element);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    handleFilterInputs()
    updateFilterCount()
    handleFilterSidebar()
    handleCellViewer()
    handleClicks()
    handleInlineBooleanEdits()
    handleInlineCellEdits()
    handleSearches()
});

// Hides the header while the table is scrolled down and shows it again as soon as it is
// scrolled up, like Android's top app bar with "enterAlways". Collapsing it hands its height
// to the table, which is the scroller.
function handleCollapsingHeader() {
    const container = document.getElementById("container");
    const header = document.getElementById("header");
    const scroller = document.getElementById("bottom-box");
    if (!container || !header || !scroller) return;

    const threshold = 8;          // px of scrolling before reacting, to ignore jitter
    const settleMs = 250;         // a bit longer than the CSS transition
    let last = scroller.scrollTop;
    let settling = false;

    function setCollapsed(collapsed) {
        if (container.classList.contains("header-collapsed") === collapsed) return;
        container.classList.toggle("header-collapsed", collapsed);
        // The table's height changes while the header animates, which can clamp scrollTop
        // and fire scroll events of its own. Ignore those until the layout settles.
        settling = true;
        setTimeout(() => {
            settling = false;
            last = scroller.scrollTop;
        }, settleMs);
    }

    scroller.addEventListener("scroll", () => {
        const top = scroller.scrollTop;
        if (settling) {
            last = top;
            return;
        }
        if (top <= 0) {
            setCollapsed(false);
            last = top;
            return;
        }
        const delta = top - last;
        if (Math.abs(delta) < threshold) return;
        last = top;

        if (delta > 0) {
            // Keep it while something in the header (e.g. search) has focus.
            if (top > header.offsetHeight && !header.contains(document.activeElement)) setCollapsed(true);
        } else {
            setCollapsed(false);
        }
    }, {passive: true});
}

function initListPosition() {
    restoreListPosition()
    // Start after the restored scroll has been dispatched, so returning to the list
    // doesn't collapse the header by itself.
    requestAnimationFrame(() => requestAnimationFrame(handleCollapsingHeader))
}

// Restore after layout is final (fonts, images), so the saved offsets line up.
if (document.readyState === "complete") {
    initListPosition()
} else {
    window.addEventListener("load", initListPosition, {once: true})
}

function performSearch(element) {
    const query = element.value;
    if (query) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('search', query);
        window.location.href = currentUrl.toString();
    } else {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has("search")) {
            currentUrl.searchParams.delete("search")
            window.location.href = currentUrl.toString();
        }
    }
}

// Query string passed to the add/edit page so saving returns to this exact list view
// (page, search, filters, ordering). The server reads it back in respondBack().
function returnToQuery() {
    return window.location.search
        ? "?returnTo=" + encodeURIComponent(window.location.search)
        : "";
}

// Remembers where the list was scrolled (and which row was opened) so coming back to the same
// list view restores it. Kept in sessionStorage, so it's per tab and one-shot.
const LIST_POSITION_KEY = "ktorAdmin.listPosition";
const LIST_POSITION_MAX_AGE_MS = 60 * 60 * 1000;

// Identifies a list view by path + query, ignoring parameter order and encoding differences
// (the server re-encodes the query when redirecting back after a save).
function listViewKey() {
    const params = new URLSearchParams(window.location.search);
    params.sort();
    return window.location.pathname.replace(/\/+$/, "") + "?" + params.toString();
}

function saveListPosition(primaryKey) {
    const scroller = document.getElementById("bottom-box");
    try {
        sessionStorage.setItem(LIST_POSITION_KEY, JSON.stringify({
            view: listViewKey(),
            top: scroller ? scroller.scrollTop : 0,
            left: scroller ? scroller.scrollLeft : 0,
            windowTop: window.scrollY,
            primaryKey: primaryKey ?? null,
            savedAt: Date.now(),
        }));
    } catch (_) {
        // Storage unavailable (e.g. privacy mode): just don't restore.
    }
}

function restoreListPosition() {
    let saved;
    try {
        saved = JSON.parse(sessionStorage.getItem(LIST_POSITION_KEY));
        sessionStorage.removeItem(LIST_POSITION_KEY);
    } catch (_) {
        return;
    }
    if (!saved || saved.view !== listViewKey() || Date.now() - saved.savedAt > LIST_POSITION_MAX_AGE_MS) return;

    const scroller = document.getElementById("bottom-box");
    if (scroller) {
        scroller.scrollTop = saved.top;
        scroller.scrollLeft = saved.left;
    }
    window.scrollTo(0, saved.windowTop || 0);

    if (saved.primaryKey == null) return;
    const row = document.querySelector(`tr.row[data-primary-key="${CSS.escape(String(saved.primaryKey))}"]`);
    if (!row) return;
    // If the row moved (e.g. edited values changed the sort order), bring it into view.
    row.scrollIntoView({block: "nearest"});
    row.classList.add("row-returned");
    row.addEventListener("animationend", () => row.classList.remove("row-returned"), {once: true});
}

function redirectToEdit(id) {
    saveListPosition(id);
    window.location.href = cleanUrl().toString() + "/" + id + returnToQuery();
}


function redirectToEditWithPluralName(pluralName, id) {
    window.location.href = `/${adminPath}/resources/${pluralName}/${id}`;
}

function redirectToPage(page) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('page', page);
    window.location.href = currentUrl.toString();
}

function onFilterApply() {
    const filters = [];

    document.querySelectorAll('.filter').forEach(filterContainer => {
        filterContainer.querySelectorAll('input, select').forEach(input => {
            if (input.value) {
                if (input.type === 'date' || input.type === 'datetime-local') {
                    const date = new Date(input.value);
                    const timestamp = input.id.includes('-end')
                        ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
                        : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
                    filters.push(`filters.${input.id}=${timestamp}`);
                } else if (input.type === 'select-one') {
                    filters.push(`filters.${input.id}=${encodeURIComponent(input.value)}`);
                }
            }
        });
    });

    window.location.href = `${window.location.pathname}?${filters.join('&')}`;
}

function handleSortClick(columnName, currentOrder, currentDirection) {
    const url = new URL(window.location.href);
    console.log(`${columnName} ${currentDirection}`)
    if (columnName === currentOrder) {
        if (currentDirection === "asc") {
            url.searchParams.set('orderDirection', "desc");
        } else {
            url.searchParams.set('orderDirection', "asc");
        }
    } else {
        url.searchParams.set('orderDirection', "asc");
        url.searchParams.set('order', columnName);
    }
    window.location.replace(url);
}

function getSelectedItems() {
    return Array.from(document.querySelectorAll('.select-field-checkbox:checked'))
        .map(checkbox => checkbox.dataset.primaryKey)
}


function performSelectedAction(pluralName) {
    const actionRows = document.querySelectorAll(".actions-row");

    const visibleRow = Array.from(actionRows).find(row =>
        getComputedStyle(row).display !== "none"
    );

    const actionSelect = visibleRow.querySelector(".actions-input");
    const selectedActionKey = actionSelect.value;

    if (!selectedActionKey) {
        showAlert("Please select an action!");
        return;
    }

    const selectedItemsArray = getSelectedItems();

    if (selectedItemsArray.length === 0) {
        showAlert("Please select at least one item.");
        return;
    }

    document.getElementById("action-key").value = selectedActionKey;
    document.getElementById("ids").value = JSON.stringify(selectedItemsArray);

    const form = document.getElementById("action-form");
    form.action = `/${adminPath}/actions/${pluralName}/${selectedActionKey}`;
    form.submit();
}


function generateUrl(fileName, pluralName, fieldName) {
    const form = new FormData()
    form.append("fileName", fileName)
    form.append("field", `${pluralName}.${fieldName}`)
    const loading = document.getElementById("loading");
    loading.style.visibility = "visible";
    const options = {
        method: "POST",
        body: form,
    }
    fetch(`/${adminPath}/file_handler/generate/`, options).then(
        async response => {
            const json = await response.json()
            if (response.ok) {
                const url = json.url
                if (url) {
                    window.location.href = url
                }
            } else {
                const error = json.error
                if (error) {
                    loading.style.visibility = "hidden";
                    showAlert(`ERROR: ${error}`, "error")
                }
            }
        }
    ).catch(error => {
        console.log(error.message)
    }).finally(() => {
        loading.style.visibility = "hidden";
    })
}


// --- Filters side panel ---
// Slides in from the right like the menu does from the left. It floats over the table, or,
// once docked with its pin icon, stays open and takes its width from the page (remembered).

const filtersDockedKey = "filtersDocked"
const filterDockMinWidth = 850 // below this the panel only floats

function getFilterSidebar() {
    return document.getElementById("filter-sidebar")
}

function canDockFilters() {
    return window.innerWidth > filterDockMinWidth
}

// Reserves room on the right of #container for a docked panel, next to whatever the
// left menu reserves (its margin-left; see expandSidebar in common.js).
function applyFilterInset() {
    const container = document.getElementById("container")
    const panel = getFilterSidebar()
    if (!container) return
    const right = panel && panel.classList.contains("docked") ? 16 + panel.getBoundingClientRect().width : 0
    const left = parseFloat(container.style.marginLeft) || 0
    container.style.marginRight = right ? `${right}px` : ""
    container.style.width = (left || right) ? `calc(100vw - ${left + right + 32}px)` : "100%"
}

function setFilterSidebar(open, docked) {
    const panel = getFilterSidebar()
    if (!panel) return
    docked = docked && canDockFilters()
    panel.classList.toggle("open", open || docked)
    panel.classList.toggle("docked", docked)
    document.querySelectorAll(".filter-button").forEach(b => b.classList.toggle("active", open || docked))
    applyFilterInset()
}

function toggleFilter() {
    const panel = getFilterSidebar()
    if (!panel) return
    if (panel.classList.contains("open")) {
        closeFilterSidebar()
    } else {
        setFilterSidebar(true, false)
    }
}

function closeFilterSidebar() {
    localStorage.removeItem(filtersDockedKey)
    setFilterSidebar(false, false)
}

function toggleFilterDock() {
    const panel = getFilterSidebar()
    if (!panel) return
    if (panel.classList.contains("docked")) {
        localStorage.removeItem(filtersDockedKey)
        setFilterSidebar(true, false)
    } else {
        localStorage.setItem(filtersDockedKey, "true")
        setFilterSidebar(true, true)
    }
}

function handleFilterSidebar() {
    const panel = getFilterSidebar()
    if (!panel) return

    // Open docked without animating, like the left menu does.
    if (localStorage.getItem(filtersDockedKey) === "true" && canDockFilters()) {
        const container = document.getElementById("container")
        const animated = [panel, container]
        animated.forEach(el => el && el.classList.add("no-animation"))
        setFilterSidebar(true, true)
        setTimeout(() => animated.forEach(el => el && el.classList.remove("no-animation")), 500)
    }

    // A floating panel closes on Escape or a click outside it.
    document.addEventListener("click", event => {
        if (!panel.classList.contains("open") || panel.classList.contains("docked")) return
        if (panel.contains(event.target) || event.target.closest(".filter-button")) return
        setFilterSidebar(false, false)
    })
    document.addEventListener("keydown", event => {
        // The cell viewer sits on top, so Escape closes that first.
        if (document.querySelector("#cell-viewer.open")) return
        if (event.key === "Escape" && panel.classList.contains("open") && !panel.classList.contains("docked")) {
            setFilterSidebar(false, false)
        }
    })

    // Dock or undock when the window crosses the width where docking is allowed.
    let wasWide = canDockFilters()
    window.addEventListener("resize", () => {
        const wide = canDockFilters()
        if (wide === wasWide) return
        wasWide = wide
        if (localStorage.getItem(filtersDockedKey) === "true") setFilterSidebar(wide, wide)
    })
}

// Shows how many filters the current URL applies on the filter buttons.
function updateFilterCount() {
    const urlParams = new URLSearchParams(window.location.search)
    const names = new Set()
    urlParams.forEach((value, key) => {
        if (key.startsWith("filters.") && value !== "") names.add(key.slice(8).replace(/-(start|end)$/, ""))
    })
    document.querySelectorAll(".filter-button .filter-count").forEach(badge => {
        badge.textContent = names.size ? String(names.size) : ""
        badge.classList.toggle("show", names.size > 0)
    })
}


// --- Full cell content viewer ---
// Cells cut off with an ellipsis get an expand button on hover that opens the whole value
// in a panel on the right (pretty-printed when it is JSON).

let cellViewerSource = null // the cell being shown, highlighted while the viewer is open

function isCellTruncated(text) {
    return text.scrollWidth > text.clientWidth + 1
}

function columnNameForCell(td) {
    const th = document.querySelectorAll("thead tr th")[td.cellIndex]
    const name = th && th.querySelector(".column-name")
    return name ? name.textContent.replace(/\s+/g, " ").trim() : ""
}

function formatCellValue(value) {
    const trimmed = value.trim()
    if (/^[\[{]/.test(trimmed)) {
        try {
            return JSON.stringify(JSON.parse(trimmed), null, 2)
        } catch (_) {
        }
    }
    return value
}

function openCellViewer(td) {
    const viewer = document.getElementById("cell-viewer")
    const text = td.querySelector(".item-text")
    if (!viewer || !text) return
    document.getElementById("cell-viewer-title").textContent = columnNameForCell(td)
    document.getElementById("cell-viewer-content").textContent = formatCellValue(text.textContent)
    if (cellViewerSource) cellViewerSource.classList.remove("cell-viewer-source")
    cellViewerSource = td
    td.classList.add("cell-viewer-source")
    viewer.classList.add("open")
}

function closeCellViewer() {
    const viewer = document.getElementById("cell-viewer")
    if (viewer) viewer.classList.remove("open")
    if (cellViewerSource) cellViewerSource.classList.remove("cell-viewer-source")
    cellViewerSource = null
}

function copyCellViewerContent() {
    const content = document.getElementById("cell-viewer-content").textContent
    navigator.clipboard.writeText(content).then(
        () => showAlert("Copied", "success", 1500),
        () => showAlert("Couldn't copy to the clipboard", "error"),
    )
}

function handleCellViewer() {
    const viewer = document.getElementById("cell-viewer")
    const tbody = document.querySelector("#bottom-box tbody")
    if (!viewer || !tbody) return

    const button = document.createElement("button")
    button.type = "button"
    button.className = "cell-expand-button"
    button.title = "View full cell content"
    button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M14 3H21V10M10 21H3V14M21 3L13.5 10.5M3 21L10.5 13.5" stroke="#292D32" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg>'
    button.addEventListener("click", event => {
        event.stopPropagation() // don't open the row's edit page
        const td = button.closest("td")
        if (td) openCellViewer(td)
    })

    // Show the button only on cells whose text is cut off.
    tbody.addEventListener("mouseover", event => {
        const td = event.target.closest("td")
        if (!td || td === button.parentElement) return
        const text = td.querySelector(".item-text")
        if (text && !td.querySelector(".inline-edit-input") && isCellTruncated(text)) {
            td.appendChild(button)
        } else if (button.parentElement) {
            button.remove()
        }
    })
    tbody.addEventListener("mouseleave", () => button.remove())

    document.addEventListener("click", event => {
        if (!viewer.classList.contains("open")) return
        if (viewer.contains(event.target) || event.target.closest(".cell-expand-button")) return
        closeCellViewer()
    })
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && viewer.classList.contains("open")) closeCellViewer()
    })
}


function closeFiltersOrNavigateToAdd() {
    saveListPosition(null)
    window.location.href = cleanUrl().toString() + "/add" + returnToQuery()
}

function openActionDialog() {
    const actionRows = document.querySelectorAll(".actions-row");

    const visibleRow = Array.from(actionRows).find(row =>
        getComputedStyle(row).display !== "none"
    );

    const actionSelect = visibleRow.querySelector(".actions-input");
    const selectedActionKey = actionSelect.value;
    if (!selectedActionKey) {
        showAlert("Please select an action!");
        return;
    }
    if (getSelectedItems().length === 0) {
        showAlert("Please select at least one item.");
        return;
    }
    document.getElementById('dialog').classList.add('active');
    document.getElementById('action-dialog-title').textContent = `Are you sure to confirm '${selectedActionKey}' action?`;
}

function closeActionDialog() {
    document.getElementById('dialog').classList.remove('active');
}

async function downloadFile(pluralName, csrfToken) {
    const url = `/${adminPath}/downloads/${pluralName}/csv?_csrf=${encodeURIComponent(csrfToken)}`;

    const link = document.createElement("a");
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}