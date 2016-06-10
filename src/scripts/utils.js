/**
 * Truncate string length with '...'.
 * If left is true, the truncation is done at the end of the string.
 * Otherwise it is done at the beginning.
 *
 * @param str {string} The string.
 * @param length {number} The maximum length.
 * @param left {boolean} If true truncate at the end.
 */
function truncate(str, length, left) {
    if (!str) return '';

    if (str.length > length) {
        if (left) {
            return str.slice(0, length) + '...';
        } else {
            return '...' + str.slice(str.length - length, str.length);
        }
    }
    return str;
}

/**
 * For each object in array.
 *
 * @param array The array.
 * @param delegate The delegate (index, value).
 */
function forEach(array, delegate) {
    if (!array) {
        return;
    }

    for (var i = 0; i < array.length; i++) {
        delegate(i, array[i]);
    }
}

/**
 * For each property in object.
 */
function forProperty(object, callback) {
    for (var key in object) {
        if (object.hasOwnProperty(key)) {
            callback(key, object[key]);
        }
    }
}

/**
 * Extract version number from image name.
 * If no version number is present, return 'latest'.
 */
function extractVersion(image) {
    var temp = image.split(':');
    if (temp.length > 2) {
        return temp[2];
    }
    else if (temp.length > 1) {
        return temp[1];
    }
    return 'latest'
}

/**
 * Match object properties.
 * Return true if all properties are equal.
 */
function matchObjects(objectA, objectB) {
    var match = true;
    forProperty(objectB, function (key, value) {
        if (objectA[key] !== value) {
            match = false;
        }
    });
    return match;
}
