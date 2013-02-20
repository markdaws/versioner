var Async = require('async'),
    Crypto = require('crypto'),
    Fs = require('fs'),
    Glob = require('glob'),
    Less = require('less'),
    Mime = require('mime'),
    Path = require('path'),
    Url = require('url'),
    _ = require('underscore');

/**
 * Versioner wraps all of the functionality necessary to
 * version assets such as css, js and images.
 * 
 * @param {Object} options
 * @param {Boolean|Object} [options.log=undefined] If set to true, a simple internal
 * logger is used that just prints verbose/warn/error messages to the console. You can
 * also specify an object that has three methods verbose(message), warn(message) and
 * error(message, error) that can be used for custom logging.
 * @param {String} options.urlRoot A string that defines the root url where assets
 * will be referenced from when using the imageUrl, cssUrl, jsUrl functions
 * @param {Object} options.types Specific type information
 * @param {Boolean} [options.cacheFiles=false] By default once the versioned information
 * has been processed all files are unloaded from memory.  If you set the flag to true
 * then the buffers remain in memory and you can use the versioner module to serve the 
 * file contents to callers of your app.
 */
function Versioner(options) {
    this._keyToFileInfo = {};
    this._pathToKey = {};
    this._options = options || { types: {} };

    // By default we don't want to leave files loaded into memory
    // you can change this using the cacheFiles option
    if(this._options.cacheFiles == null) {
        this._options.cacheFiles = false;
    }

    // By default all style files will have a .css extension in the
    // versioned url e.g. .less files end up as .css, callers can 
    // explicitly provide a file suffix for the style files
    if (this._options.types.style) {
        this._options.types.style.versionedExtension = '.css';
    }

    this._log = this._options.log;
    if (this._log === true) {
        // A simple logger used throughout the code
        this._log = {
            verbose: function(message) {
                console.log('[VERBOSE]: ' + message);
            },
            warn: function(message) {
                console.log('[WARN]: ' + message);
            },
            error: function(message, error) {
                error = error || {};
                console.error('[ERROR]: ' + message + ' : ' + JSON.stringify(error));
            }
        };
    }
    else if (this._log === false || !this._log) {
        this._log = {};
    }

    // Incase caller provided own log with missing methods
    this._log.verbose = this._log.verbose || function(){};
    this._log.warn = this._log.warn || function(){};
    this._log.error = this._log.error || function(){};
}

/**
 * Returns true if versioner is caching files
 * @returns {Boolean}
 */
Versioner.prototype.isCachingFiles = function() {
    return this._options.cacheFiles;
};

/**
 * Writes the versioned files to disk, you can use this in a build step
 * to pre version your assets and then serve from a static location. NOTE:
 * you must make sure you set the cacheFiles option in the Versioner constructor
 * to true if you want to use this function, otherwise it will throw an error
 * 
 * @param {String} outputDir Path where files should be written to
 * @param {Function} callback (error) Will be called once all of the versioned
 * files have been written to disk
 */
Versioner.prototype.save = function(outputDir, callback) {

    if (!this._options.cacheFiles) {
        throw 'set cacheFiles to true in the constructor options';
    }

    var self = this,
        keys = Object.keys(this._keyToFileInfo);

    self._log.verbose('Saving versioned files to: ' + outputDir);

    Async.forEachLimit(
        keys,
        100,
        function(key, callback) {
            var fileInfo = self._keyToFileInfo[key],
                outputPath = Path.join(outputDir, key);
            Fs.open(outputPath, 'w', function(error, fd) {
                if (error) {
                    callback(error);
                    return;
                }

                Fs.write(
                    fd, fileInfo.data, 0, fileInfo.data.length, null,
                    function(error) {
                        if (!error) {
                            self._log.verbose('Saved: ' + outputPath);
                        }
                        callback(error);
                    }
                );
            });
        },
        function(error) {
            if (error) {
                self._log.error('Failed to save versioned assets', error);
            }
            callback(error);
        }
    );
};

/**
 * Returns the versioned file information associated with the specified key
 * 
 * @param {string} key The is the name.<hash>.<extension> format
 * @return {Object}
 */
Versioner.prototype.get = function(key) {
    return this._keyToFileInfo[key];
};

/**
 * Returns the URL associated with the specified type. 
 */
Versioner.prototype.url = function(path, type) {
    var typeInfo = this._options.types[type];
    if (!typeInfo) {
        throw 'url unknown type: ' + type + ' for ' + path;
    }
    var key = this._getKeyForPath(this._getFullPath(typeInfo, path));
    if (!key) return null;

    var urlRoot = this._options.types[type].urlRoot || this._options.urlRoot;
    if (urlRoot[urlRoot.length - 1] !== '/') {
        urlRoot += '/';
    }
    return urlRoot + key;
};

/**
 * Given the path of an image, returns the version URL
 * @param {String} path e.g. dir1/foo.jpg
 * @return {String} The versioned URL of the resource
 */
Versioner.prototype.imageUrl = function(path) {
    return this.url(path, 'image');
};

/**
 * Given the path of a javascript file, returns the versioned URL
 * @param {String} path e.g. dir1/foo.js
 * @return {String} The versioned URL of the resource
 */
Versioner.prototype.jsUrl = function(path) {
    return this.url(path, 'javascript');
};

/**
 * Given the path of a css file, returns the versioned URL
 * @param {String} path e.g. dir1/foo.css
 * @return {String} The versioned URL of the resource
 */
Versioner.prototype.cssUrl = function(path) {
    return this.url(path, 'style');
};

/**
 * Loads all of the files and creates verioned information.
 * @param {Function(Object=)} callback called once all the files have been processed
*/
Versioner.prototype.build = function(callback) {

    var imageType = this._options.types.image || {},
        javascriptType = this._options.types.javascript || {},
        styleType = this._options.types.style || {},
        startTime = new Date().getTime(),
        totalSize = 0,
        versioner = this;

    function loadFiles(versioner, typeInfo, processors, callback) {
        if (typeInfo.root) {
            // Load all of the files recursively under the specified root folder
            Glob(typeInfo.root + '/**/*', {}, function (error, files) {
                if (error) {
                    callback(error);
                    return;
                }
                
                // Map paths into one object format that we pass to addFile
                files = files.map(function(source) {
                    return {
                        source: source,
                        path: source,
                        data: null
                    };
                });

                versioner._log.verbose('Loading: ' + typeInfo.root + 
                                       ', files:' + files.length);

                processFiles(files);
            });    
        }
        else {
            // No root folder, user has specified files explicitly in the files: [] folder
            processFiles([]);
        }

        function processFiles(files) {
            // Users can list an explicit set of files and buffers rather 
            // than just a high level directory to pull files in from
            var explicitFiles = typeInfo.files || [];
            explicitFiles = explicitFiles.map(function(fileInfo) {
                return {
                    source: fileInfo.source,
                    path: versioner._getFullPath(null, fileInfo.path),
                    data: fileInfo.data
                };
            });
            files = files.concat(explicitFiles);

            Async.forEachLimit(files, 50, function(fileInfo, callback) {                
                processors = processors || [];

                versioner._addFile(fileInfo, typeInfo, processors, function(error, info) {
                    if (error) {
                        versioner._log.error('Versioning file: ' + fileInfo.path +
                                             'failed', error);
                    }
                    else {
                        totalSize += info.size;
                    }

                    callback(error);
                });
            }, function(error) {
                callback(error);
            });
        }
    }
    
    Async.series([
        // Process Images - these have to be processed before style because
        // stylesheets can reference images, so we need to have them loaded
        // and versioned
        function(callback) { 
            loadFiles(versioner, imageType, null, callback); 
        },

        // Process javascript
        function(callback) {
            loadFiles(versioner, javascriptType, null, callback);
        },

        // Process style
        function(callback) {
            loadFiles(
                versioner, 
                styleType,
                [
                    function(data, path, callback) {
                        replaceStyleValues(
                            data, path, versioner, styleType, callback);
                    }
                ],
                callback
            );
        }
    ], function(error) {
        if (!error) {
            versioner._log.verbose('Build duration: ' + 
                                   (new Date().getTime() - startTime) + 'ms' +
                                  ', size: ' + totalSize + ' bytes');
        }

        // Unload buffers if not needed
        if (!versioner._options.cacheFiles) {
            Object.keys(versioner._keyToFileInfo).forEach(function(key) {
                versioner._keyToFileInfo[key].data = null;
            });
        }
        callback(error);
    });
};

/**
 * Processes a file to get the versioned information.
 */
Versioner.prototype._addFile = function(fileInfo, typeInfo, processors, callback) {

    var self = this;

    function addBuffer(fileInfo, typeInfo, processors, callback) {
        // Run all of the processors on the data before
        // we store it in the cache. Processors are just
        // a chain of functions you can run on the data
        // loaded from disk before it is stored in the cache
        processors = processors || [];
        function executeProcessor(data, index) {
            if (index >= processors.length) {
                
                // Can override the ext you want to store the file as in the 
                // cache options e.g. for .less files we actually want to serve
                // them as .css files
                var extension = typeInfo.versionedExtension || 
                        Path.extname(fileInfo.path);
                var fileHash = Crypto.createHash('md5').update(data).digest('hex');       
                var key =  Path.basename(
                    fileInfo.path, 
                    Path.extname(fileInfo.path)
                ) + '.' + fileHash + extension;
                
                self._log.verbose('Added source: ' + fileInfo.source + ', key: ' + 
                                  key + ', size:' + data.length);

                // Make sure the url we store the file with is updated to use
                // the new extension
                var finalPath = fileInfo.path.replace(
                    Path.extname(fileInfo.path), extension);
                self._pathToKey[finalPath] = key;
                
                self._keyToFileInfo[key] = {
                    // TODO: Be smarter with this value
                    // have to be careful since css files
                    // depend on other files which may have
                    // change independantly of the css
                    mtime: new Date(),
                    data: data,
                    fileName: Path.basename(finalPath)
                };
                
                process.nextTick(function() {
                    callback(null, { key: key, size: data.length });
                });
                return;
            }
            
            processors[index](data, fileInfo.path, function(error, newData) {
                if (error) {
                    callback(error);
                    return;
                }
                executeProcessor(newData, index + 1);
            });
        }
        executeProcessor(fileInfo.data, 0);
    };

    if (fileInfo.data) {
        // User specified the buffer, no need to load the file
        addBuffer(fileInfo, typeInfo, processors, callback);
    }
    else {
        var stream = Fs.ReadStream(fileInfo.source),
            buffers = [];
        stream.on('data', function(data) {
            buffers.push(data);
        });
        stream.on('end', function() {
            fileInfo.data = Buffer.concat(buffers);
            buffers = null;
            addBuffer(fileInfo, typeInfo, processors, callback);
        });
        stream.on('error', function(error) {
            error = error || {};
            
            if (error.code === 'EISDIR') {
                // Glob returns dirs as well, ignore
                callback(null, { size: 0 });
                return;
            }
            else {
                self._log.error('Failed to add file: ' + fileInfo.source, error);
            }
            callback(error);
        });
    }
};

/**
 * Returns the Buffer associated with the path and type
 * 
 * @param {string} path
 * @param {string} type The name of the type in the types hash
 * of the cache options e.g. 'image' or 'javascript'
 * 
 * @return {Buffer}
 */
Versioner.prototype._getByPath = function(path, type) {
    var typeInfo = this._options.types[type];
    if (!typeInfo) {
        throw '_getByPath unknown type: ' + type;
    }
    
    var key = this._getKeyForPath(this._getFullPath(typeInfo, path));
    return this._keyToFileInfo[key];
};

/**
 * Returns the full path for a resource either appending the root path
 * or placeholder path for assets loaded from a buffer
*/
Versioner.prototype._getFullPath = function(typeInfo, path) {
    if (path[0] === '/') {
        path = path.substr(1);
    }
    if (typeInfo && typeInfo.root) { 
        return Path.resolve(typeInfo.root, path);
    }
    else {
        return Path.resolve(EXPLICIT_FILE_ROOT, path);
    }
};

/**
 * Given a path, returns the versioned key associated with the file
 */
Versioner.prototype._getKeyForPath = function(path) {
    return this._pathToKey[path];
};

/**
 * Processes css and less files and replaces the verionerUrl and 
 * versionerDataUri placeholders with actual versioned paths
*/
function replaceStyleValues(data, filePath, versioner, styleType, callback) {
    var styleString = data.toString('utf8');

    var matcher = new RegExp([
            /"versionerUrl\(([\s\S]+?)\)"/g.source,
            /"versionerDataUri\(([\s\S]+?)\)"/g.source
    ].join('|') + '|$', 'g');

    // Replace any inline image / dataUri references to paths
    // to items in the cache
    styleString = styleString.replace(
        matcher,
        function(match, imagePath, dataUriPath, offset) {
            if (imagePath) {
                var url = versioner.url(imagePath, 'image');
                if (!url) {
                    versioner._log.error('Missing image: ' + imagePath);
                }
                return url;
            }
            if (dataUriPath) {
                var fileInfo = versioner._getByPath(dataUriPath, 'image');
                if (!fileInfo) {
                    versioner._log.error('Missing datauri image: ' + 
                                         dataUriPath);
                }
                return 'data:' + Versioner.Mime.lookup(dataUriPath) + 
                    ';base64,' + fileInfo.data.toString('base64');
            }
            return '';
        });

    // If the compiler value is a string, then we check one 
    // of the built in types
    var compilerType = typeof styleType.compiler;
    switch(compilerType) {
    case 'string':
        if (styleType.compiler !== 'less') {
            callback('Unsupported compiler type: ' + 
                     styleType.compiler);
            return;
        }

        Less.render(
            styleString,
            { paths: [ styleType.root ] },
            function(error, compiledCss) {
                var buffer;
                if (!error) {
                    buffer = new Buffer(compiledCss);
                }
                else {
                    versioner._log.error('LESS compilation failed: ' +
                                         filePath + ' : ' + 
                                         styleString, error);
                }

                callback(error, buffer);
            }
        );
        break;

    case 'function':
        // Caller has chosen to use their own compiler function
        styleType.compiler(styleString, function(error, compiledCss) {
            var buffer;
            if (!error) {
                buffer = new Buffer(compiledCss);
            }
            callback(error, buffer);
        });

    default:
        // Regular CSS, doesn't need any compilation
        callback(null, new Buffer(styleString));
        break;
    }
}

/**
 * Provides mime type functionality.  You can modify this object
 * if you need a value that is not provided by the default implementation
 */
Versioner.Mime = Mime;

// When the caller gives an explicit list of files, there may not be a full path
// to the file e.g. if they specify a buffer.  When you use one of the methods to
// retrieve the asset e.g. imageUrl we need a way to distinguish between a file that
// has a full path and once that doesn't so we use this value to prepend to the path
var EXPLICIT_FILE_ROOT = '/__buffer_root__';

module.exports = Versioner;
