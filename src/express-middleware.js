var BufferReadStream = require('./buffer-read-stream'),
    Mime = require('mime'),
    Path = require('path'),
    Url = require('url');

/**
 * Sets various headers on the response
 */
function setHeader(res, fileInfo, maxAge){
    if (!res.getHeader('Date')) { 
        res.setHeader('Date', new Date().toUTCString());
    }
    var type = Mime.lookup(fileInfo.fileName);
    var charset = Mime.charsets.lookup(type);
    res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
    res.setHeader('Cache-Control', 'public, max-age=' + maxAge);
    res.setHeader('Content-Length', fileInfo.data.length);
}

/**
 * Streams the content of the bufer to the caller
 */
function sendFile(req, res, fileInfo){
    // Since files are versioned we always just set the cache to max
    setHeader(res, fileInfo, 31536000);
    
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    
    streamFile(req, res, fileInfo);
}

/**
 * Streams the content of the buffer to the caller
 */
function streamFile(req, res, bufferInfo) {
    var self = this;
    var stream = new BufferReadStream(bufferInfo.data);
    stream.pipe(res);

    // This just writes the underlying buffer to the piped listener
    stream.write();

    // We send all the buffer at once, indicate the file has been
    // completely written
    stream.end();
};

module.exports = function(versioner) {
    if (!versioner.isCachingFiles()) {
        throw 'set cacheFiles to true in the versioner constructor options';
    }

    return function(req, res, next) {
        var pathname = Url.parse(req.url).pathname;

        // Each versioned file has a unique name due to the
        // hashing so all we need is the last part of the 
        // url path, that is unique for each file
        var filename = Path.basename(pathname);
        var versionedFile = versioner.get(filename);
        if (!versionedFile) {
            versioner._log.verbose('Version miss: ' + pathname);
            next();
            return;
        }
        sendFile(req, res, versionedFile);
    };
};

/**
 * Add mime types as needed
 */
exports.Mime = Mime;