// Renders <time class="local-datetime" datetime="<ISO-8601 instant>"> elements in the
// browser's time zone, e.g. "22 Nov 2026 - 10:32:11". The server-rendered text is kept
// if the value can't be parsed.
(function () {
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
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        root.querySelectorAll('time.local-datetime[datetime]').forEach(el => {
            const date = new Date(el.getAttribute('datetime'));
            if (isNaN(date.getTime())) return;
            el.textContent = formatLocal(date);
            el.title = `${el.getAttribute('datetime')} (shown in ${zone})`;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => localizeDateTimes(document));
    } else {
        localizeDateTimes(document);
    }
})();
