function truncate(str, width, left) {
    if (!str) return '';

    if (str.length > width) {
        if (left) {
            return str.slice(0, width) + '...';
        } else {
            return '...' + str.slice(str.length - width, str.length);
        }
    }
    return str;
}

function forEach(array, delegate) {
    for (var i = 0; i < array.length; i++) {
        delegate(i, array[i]);
    }
}

function forProperty(object, callback) {
    for (var key in object) {
        if (object.hasOwnProperty(key)) {
            callback(key, object[key]);
        }
    }
}

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

function matchLabelSelectors(labels, selector) {
    var match = true;
    forProperty(selector, function (key, value) {
        if (labels[key] !== value) {
            match = false;
        }
    });
    return match;
}
