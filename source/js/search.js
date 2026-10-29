/* Local search overlay: filters content.json client-side (no server needed) */
(function () {
    'use strict';

    var modal = document.getElementById('search-modal');
    if (!modal) {
        return;
    }

    var input = document.getElementById('search-input');
    var resultsEl = document.getElementById('search-results');
    var emptyEl = document.getElementById('search-empty');
    var indexUrl = modal.getAttribute('data-index') || '/content.json';
    // Derive the site root from the index URL so links work in sub-directories too
    var root = indexUrl.replace(/content\.json$/, '');
    var entries = null;
    var lastFocus = null;

    function normalize(value) {
        return (value || '').toLowerCase();
    }

    function toEntry(item, type) {
        var tags = (item.tags || []).map(function (tag) { return tag.name; });
        var categories = (item.categories || []).map(function (category) { return category.name; });
        return {
            type: type,
            title: item.title || '',
            url: item.path ? root + item.path : item.permalink,
            text: cleanText(item.excerpt || item.text),
            tags: tags,
            categories: categories,
            haystack: normalize([
                item.title,
                cleanText(item.excerpt || item.text),
                tags.join(' '),
                categories.join(' ')
            ].join(' '))
        };
    }

    // Strip markdown images, bare URLs and link syntax so snippets stay readable
    function cleanText(value) {
        return (value || '')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function load() {
        if (entries) {
            return Promise.resolve(entries);
        }
        return fetch(indexUrl)
            .then(function (response) { return response.json(); })
            .then(function (data) {
                entries = [];
                (data.posts || []).forEach(function (post) { entries.push(toEntry(post, 'Post')); });
                (data.pages || []).forEach(function (page) {
                    if (!page.title || !page.path || page.path === 'index.html') {
                        return;
                    }
                    entries.push(toEntry(page, 'Page'));
                });
                return entries;
            })
            .catch(function () {
                entries = [];
                return entries;
            });
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function highlight(text, terms) {
        var fragment = document.createDocumentFragment();
        if (!text) {
            return fragment;
        }
        if (!terms.length) {
            fragment.appendChild(document.createTextNode(text));
            return fragment;
        }

        var pattern = new RegExp('(' + terms.map(escapeRegExp).join('|') + ')', 'gi');
        var last = 0;
        var match;
        while ((match = pattern.exec(text)) !== null) {
            if (match.index > last) {
                fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
            }
            var mark = document.createElement('mark');
            mark.textContent = match[0];
            fragment.appendChild(mark);
            last = match.index + match[0].length;
            if (!match[0]) {
                pattern.lastIndex += 1;
            }
        }
        if (last < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(last)));
        }
        return fragment;
    }

    function snippet(entry, term) {
        var text = entry.text;
        if (!text) {
            return '';
        }
        var index = normalize(text).indexOf(term);
        var start = index > 40 ? index - 40 : 0;
        var part = text.slice(start, start + 150);
        return (start > 0 ? '… ' : '') + part + (start + 150 < text.length ? ' …' : '');
    }

    function renderItem(entry, terms) {
        var item = document.createElement('li');
        item.className = 'search-result';

        var link = document.createElement('a');
        link.href = entry.url;

        var type = document.createElement('span');
        type.className = 'search-result-type';
        type.textContent = entry.type;
        link.appendChild(type);

        var title = document.createElement('span');
        title.className = 'search-result-title';
        title.appendChild(highlight(entry.title, terms));
        link.appendChild(title);

        var text = snippet(entry, terms[0]);
        if (text) {
            var preview = document.createElement('span');
            preview.className = 'search-result-snippet';
            preview.appendChild(highlight(text, terms));
            link.appendChild(preview);
        }

        item.appendChild(link);
        return item;
    }

    function render(query) {
        resultsEl.textContent = '';
        var terms = normalize(query).trim().split(/\s+/).filter(Boolean);

        if (!entries || !terms.length) {
            emptyEl.hidden = true;
            return;
        }

        var matches = [];
        entries.forEach(function (entry) {
            var score = 0;
            var matchesAll = terms.every(function (term) {
                var inTitle = normalize(entry.title).indexOf(term) !== -1;
                var inTags = normalize(entry.tags.join(' ') + ' ' + entry.categories.join(' ')).indexOf(term) !== -1;
                var inText = entry.haystack.indexOf(term) !== -1;
                if (!inTitle && !inTags && !inText) {
                    return false;
                }
                score += inTitle ? 4 : 0;
                score += inTags ? 2 : 0;
                score += inText ? 1 : 0;
                return true;
            });
            if (matchesAll) {
                matches.push({ entry: entry, score: score });
            }
        });

        matches.sort(function (a, b) { return b.score - a.score; });
        matches.slice(0, 10).forEach(function (match) {
            resultsEl.appendChild(renderItem(match.entry, terms));
        });
        emptyEl.hidden = matches.length > 0;
    }

    function open() {
        lastFocus = document.activeElement;
        modal.hidden = false;
        document.body.classList.add('search-open');
        load().then(function () {
            input.focus();
            input.select();
            render(input.value);
        });
    }

    function close() {
        modal.hidden = true;
        document.body.classList.remove('search-open');
        if (lastFocus && lastFocus.focus) {
            lastFocus.focus();
        }
    }

    document.addEventListener('click', function (event) {
        if (event.target.closest('.search-toggle')) {
            event.preventDefault();
            open();
            return;
        }
        if (event.target.closest('[data-search-close]')) {
            close();
        }
    });

    input.addEventListener('input', function () { render(input.value); });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !modal.hidden) {
            close();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            open();
        }
    });
})();
