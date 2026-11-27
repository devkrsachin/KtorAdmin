// Shows timestamps in the browser's time zone.
//
// List pages: renders <time class="local-datetime" datetime="<ISO-8601 instant>"> elements,
// e.g. "22 Nov 2026 - 10:32:11". The server-rendered text is kept if the value can't be parsed.
//
// Add/edit forms: <input type="datetime-local" class="local-datetime-input" data-server-zone="...">
// holds a wall time in the server's zone. It is shown in the browser's zone and converted back
// to the server's zone when the form is submitted, so the server receives what it always did.
(function () {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const formatter = new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });

    function formatLocal(date) {
        const parts = {};
        formatter.formatToParts(date).forEach(p => { parts[p.type] = p.value; });
        return `${parts.day} ${parts.month} ${parts.year} - ${parts.hour}:${parts.minute}:${parts.second}`;
    }

    function localizeDateTimes(root) {
        root.querySelectorAll('time.local-datetime[datetime]').forEach(el => {
            const date = new Date(el.getAttribute('datetime'));
            if (isNaN(date.getTime())) return;
            el.textContent = formatLocal(date);
            el.title = `${el.getAttribute('datetime')} (shown in ${browserZone})`;
        });
    }

    // --- Wall time <-> instant in a given IANA zone ---

    const zoneFormatters = {};

    function zoneParts(ms, zone) {
        if (!zoneFormatters[zone]) {
            zoneFormatters[zone] = new Intl.DateTimeFormat('en-US', {
                timeZone: zone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hourCycle: 'h23',
            });
        }
        const parts = {};
        zoneFormatters[zone].formatToParts(new Date(ms)).forEach(p => { parts[p.type] = p.value; });
        return parts;
    }

    // Offset of `zone` from UTC at instant `ms`, in milliseconds.
    function zoneOffset(ms, zone) {
        const p = zoneParts(ms, zone);
        const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
        return asUtc - Math.floor(ms / 1000) * 1000;
    }

    // "yyyy-MM-ddTHH:mm" in `zone` -> epoch ms, or null if it can't be parsed.
    function wallToInstant(wall, zone) {
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
        if (!m) return null;
        const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
        const first = guess - zoneOffset(guess, zone);
        // Re-check once in case the guess crossed a DST change.
        return guess - zoneOffset(first, zone);
    }

    // epoch ms -> "yyyy-MM-ddTHH:mm" in `zone`.
    function instantToWall(ms, zone) {
        const p = zoneParts(ms, zone);
        return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
    }

    function convertWall(wall, fromZone, toZone) {
        const ms = wallToInstant(wall, fromZone);
        return ms === null ? null : instantToWall(ms, toZone);
    }

    function localizeDateTimeInputs(root) {
        const inputs = root.querySelectorAll('input.local-datetime-input[data-server-zone]');
        if (!inputs.length) return;

        inputs.forEach(input => {
            const serverZone = input.dataset.serverZone;
            const label = input.nextElementSibling;
            if (label && label.classList.contains('local-datetime-zone')) {
                label.textContent = browserZone;
            }
            if (!serverZone || serverZone === browserZone || !input.value) return;
            const local = convertWall(input.value, serverZone, browserZone);
            if (local) {
                input.value = local;
                input.defaultValue = local;
            }
        });

        // Convert the submitted values only, so the fields keep showing local time
        // if the submit is cancelled.
        const forms = new Set([...inputs].map(input => input.form).filter(Boolean));
        forms.forEach(form => {
            form.addEventListener('formdata', e => {
                form.querySelectorAll('input.local-datetime-input[data-server-zone]').forEach(input => {
                    const serverZone = input.dataset.serverZone;
                    if (!input.name || !input.value || !serverZone || serverZone === browserZone) return;
                    const server = convertWall(input.value, browserZone, serverZone);
                    if (server) e.formData.set(input.name, server);
                });
            });
        });
    }

    function init() {
        localizeDateTimes(document);
        localizeDateTimeInputs(document);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
