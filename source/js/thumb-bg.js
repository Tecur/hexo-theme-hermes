/* Match each thumbnail frame colour to the edges of its image, so the box
   blends with the picture (white for screenshots/diagrams, similar for photos). */
(function () {
    'use strict';

    var thumbs = document.querySelectorAll('.post-thumb');
    if (!thumbs.length) {
        return;
    }

    var SIZE = 20;

    function averageEdgeColor(img) {
        var canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;

        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        // Transparent areas are treated as paper white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.drawImage(img, 0, 0, SIZE, SIZE);

        var data;
        try {
            data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        } catch (error) {
            return null;
        }

        var rgb = [0, 0, 0];
        var count = 0;

        // Most frequent edge colour (quantised), so a white page in a screenshot
        // stays white instead of being averaged down by dark lines.
        var buckets = {};

        function sample(x, y) {
            var index = (y * SIZE + x) * 4;
            var r = data[index];
            var g = data[index + 1];
            var b = data[index + 2];
            var key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
            if (!buckets[key]) {
                buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
            }
            var bucket = buckets[key];
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
            bucket.n += 1;
            count += 1;
        }

        for (var x = 0; x < SIZE; x += 1) {
            sample(x, 0);
            sample(x, SIZE - 1);
        }
        for (var y = 1; y < SIZE - 1; y += 1) {
            sample(0, y);
            sample(SIZE - 1, y);
        }

        if (!count) {
            return null;
        }

        var best = null;
        Object.keys(buckets).forEach(function (key) {
            if (!best || buckets[key].n > best.n) {
                best = buckets[key];
            }
        });

        rgb[0] = best.r / best.n;
        rgb[1] = best.g / best.n;
        rgb[2] = best.b / best.n;

        return 'rgb(' +
            Math.round(rgb[0]) + ', ' +
            Math.round(rgb[1]) + ', ' +
            Math.round(rgb[2]) + ')';
    }

    function applyColor(thumb) {
        var img = thumb.querySelector('.post-thumb-image');
        if (!img) {
            return;
        }

        var run = function () {
            var color = averageEdgeColor(img);
            if (color) {
                thumb.style.backgroundColor = color;
            }
        };

        if (img.complete && img.naturalWidth) {
            run();
        } else {
            img.addEventListener('load', run);
        }
    }

    Array.prototype.forEach.call(thumbs, applyColor);

    // Safety net: images restored from cache / bfcache may finish before the
    // listeners above are attached.
    window.addEventListener('load', function () {
        Array.prototype.forEach.call(thumbs, applyColor);
    });
    window.addEventListener('pageshow', function () {
        Array.prototype.forEach.call(thumbs, applyColor);
    });
})();
