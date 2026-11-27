function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function handleFilterInputs() {
    const urlParams = new URLSearchParams(window.location.search);
    let isAnyFilter = false;

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
                isAnyFilter = true;
            } else if (startInput.type === 'datetime-local') {
                startInput.value = startDate.toISOString().slice(0, 16);  // Format to 'yyyy-mm-ddTHH:mm'
                isAnyFilter = true;
            }
        }

        // Handle date or datetime-local end input
        if (endInput && urlParams.has(endParam)) {
            const endTimestamp = parseInt(urlParams.get(endParam));
            const endDate = new Date(endTimestamp);

            if (endInput.type === 'date') {
                endInput.value = endDate.toISOString().split('T')[0];  // Format to 'yyyy-mm-dd'
                isAnyFilter = true;
            } else if (endInput.type === 'datetime-local') {
                endInput.value = endDate.toISOString().slice(0, 16);  // Format to 'yyyy-mm-ddTHH:mm'
                isAnyFilter = true;
            }
        }

        // Handle select input
        if (selectInput && urlParams.has(`filters.${paramName}`)) {
            selectInput.value = urlParams.get(`filters.${paramName}`);
            isAnyFilter = true;
        }
    });

    if (isAnyFilter) {
        toggleFilter();
    }
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


function toggleFilter() {
    const topBox = document.getElementById("top-box");
    let rows = document.getElementsByClassName("actions-row")
    let filters = document.getElementById("filters-container")
    if (filters.classList.contains("show")) {
        topBox.style.height = "55px"
        for (let row of rows) {
            row.classList.remove("hide")
        }
        topBox.classList.remove("show-filters")
        filters.classList.remove("show")
    } else {
        let filtersSize = filters.getBoundingClientRect();
        for (let row of rows) {
            row.classList.add("hide")
        }
        filters.classList.add("show")
        topBox.classList.add("show-filters")
        topBox.style.height = `${filtersSize.height + 24 + 55}px`;
    }
}


function closeFiltersOrNavigateToAdd() {
    let topBox = document.getElementById("top-box")
    let filters = document.getElementById("filters-container")
    let rows = document.getElementsByClassName("actions-row")
    if (filters.classList.contains("show")) {
        filters.classList.remove("show")
        topBox.classList.remove("show-filters")
        topBox.style.height = "55px"
        for (let row of rows) {
            row.classList.remove("hide")
        }
    } else {
        saveListPosition(null)
        window.location.href = cleanUrl().toString() + "/add" + returnToQuery()
    }
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