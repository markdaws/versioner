var Fs = require('fs'),
    should = require('should'),
    Versioner = require('../'),
    _ = require('underscore');

// Change this to true to get the versioner to print out
// extra debug information during the tests
var useLog = false;
var log;
if (useLog) {
    log = {
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

// Setup where test files should be loaded from and the
// URL to use for versioned assets
var options = {

    // Determines the URL to use when creating versioned
    // asset urls
    urlRoot: 'http://localhost/static',

    // Log object to provide extra debug/error logging
    log: log,

    // Specify options for the various asset types
    types: {
        image: {
            // Root directory to load images from
            root: __dirname + '/images'
        },
        javascript: {
            // Root directory to load javascript from
            root: __dirname + '/javascript'
        },
        style: {
            // Root directory to load styles from
            root: __dirname + '/less',
            compiler: 'less'
        }
    }
};

describe('versioner', function() {

    it('recursive folders are processed correctly', function(done) {
        var versioner = new Versioner(options);
        versioner.build(function(error) {
            if (error) throw error;

            // Make sure assets in sub folders have been loaded
            versioner
                .imageUrl('dir1/abc.jpg')
                .should
                .equal(options.urlRoot + '/abc.629f545a3f7cea350715263cd5ef3012.jpg');
            
            versioner
                .jsUrl('dir1/baz.js')
                .should
                .equal(options.urlRoot + '/baz.244bdf7481a02452864b59c4984dc72a.js');

            versioner
                .cssUrl('dir1/baz.css')
                .should
                .equal(options.urlRoot + '/baz.063294d2868a7c8b9653da78840f0963.css');

            done();
        });
    });

    it('fileinfo for a versioned file has expected fields', function(done) {
        var versioner = new Versioner(options);
        versioner.build(function(error) {
            if (error) throw error;

            var imagePath = options.types.image.root + '/dir1/abc.jpg';

            // Make sure assets in sub folders have been loaded
            var fileInfo = versioner.get(versioner._getKeyForPath(imagePath));

            // By default, once the files have been loaded into 
            // the versioner and processed they should be unloaded
            should.not.exist(fileInfo.data);
            should.exist(fileInfo.mtime);
            done();
        });
    });

    it('url for non existant asset should return null', function(done) {
        var versioner = new Versioner(options);
        versioner.build(function(error) {
            if (error) throw error;
            should.not.exist(versioner.imageUrl('dir1/abcxxx.jpg'));
            should.not.exist(versioner.jsUrl('dir1/bazxxx.js'));
            should.not.exist(versioner.cssUrl('dir1/bazxxx.css'));
            done();
        });
    });

    it('image references in style files are replaced', function(done) {
        var versioner = new Versioner(_.extend({}, options, { cacheFiles: true }));
        versioner.build(function(error) {
            if (error) throw error;

            // The paths to the images in the less file should have
            // been replaced with the absolute paths
            var lessString = versioner
                    .get('url-replace.0482bde34d2de2654190164022008174.css')
                    .data
                    .toString('utf8');

            lessString.should.equal('.foo {\n\
  background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg);\n\
}\n\
.bar {\n\
  background-image: url(' + options.urlRoot + '/img2.912d44c4ddb55d3dc54c18ced24fe4c3.jpg);\n\
}\n\
.baz {\n\
  background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg);\n\
}\n\
.foobar {\n\
  background-image: url(' + options.urlRoot + '/abc.629f545a3f7cea350715263cd5ef3012.jpg);\n\
}\n\
');
            done();
        });
    });

    it('data uri references in style file are replaced', function(done) {
        var versioner = new Versioner(_.extend({}, options, { cacheFiles: true }));
        versioner.build(function(error) {
            if (error) throw error;

            var lessString = versioner
                    .get('datauri-replace.b792cf32238630e8b563e60db7d5bb4a.css')
                    .data
                    .toString('utf8');

            lessString.should.equal('.bar {\n' +
'  background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg);\n' +
'  background-image: url(data:image/jpeg;base64,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);\n}\n');
            done();
        });       
    });

    it('setting cacheFiles to true should load buffers', function(done) {
        var customOptions = _.extend(
            {},
            options,
            { cacheFiles: true }
        );

        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            var imagePath = options.types.image.root + '/dir1/abc.jpg';

            // Make sure assets in sub folders have been loaded
            var fileInfo = versioner.get(versioner._getKeyForPath(imagePath));
            should.exist(fileInfo.data);
            should.exist(fileInfo.mtime);
            done();
        });
    });

    it('overriding urlRoot in type section', function(done) {
        var customOptions = {
            // This should be ignored and the specific overrides
            // should be used
            urlRoot: 'http://localhost/static',
            log: log,
            types: {
                image: {
                    urlRoot: 'http://localhost/images',
                    root: __dirname + '/images'
                },
                javascript: {
                    urlRoot: 'http://localhost/javascript',
                    root: __dirname + '/javascript'
                },
                style: {
                    urlRoot: 'htto://localhost/style',
                    root: __dirname + '/less',
                    compiler: 'less'
                }
            }
        };

        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            // Make sure assets in sub folders have been loaded
            versioner
                .imageUrl('dir1/abc.jpg')
                .should
                .equal(customOptions.types.image.urlRoot + 
                       '/abc.629f545a3f7cea350715263cd5ef3012.jpg');
            
            versioner
                .jsUrl('dir1/baz.js')
                .should
                .equal(customOptions.types.javascript.urlRoot + 
                       '/baz.244bdf7481a02452864b59c4984dc72a.js');
            
            versioner
                .cssUrl('dir1/baz.css')
                .should
                .equal(customOptions.types.style.urlRoot + 
                       '/baz.063294d2868a7c8b9653da78840f0963.css');
            
            done();
        });
    });

    it('urlRoot without trailing slash works', function(done) {
        var customOptions = _.extend({}, options, { urlRoot: 'http://localhost/static' });
        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            // Make sure assets in sub folders have been loaded
            versioner
                .imageUrl('dir1/abc.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/abc.629f545a3f7cea350715263cd5ef3012.jpg');
            
            versioner
                .jsUrl('dir1/baz.js')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.244bdf7481a02452864b59c4984dc72a.js');
            
            versioner
                .cssUrl('dir1/baz.css')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.063294d2868a7c8b9653da78840f0963.css');
            
            done();
        });
    });

    it('urlRoot with trailing slash works', function(done) {
        var customOptions = _.extend({}, options, { urlRoot: 'http://localhost/static/' });
        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            // Make sure assets in sub folders have been loaded
            versioner
                .imageUrl('dir1/abc.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       'abc.629f545a3f7cea350715263cd5ef3012.jpg');
            
            versioner
                .jsUrl('dir1/baz.js')
                .should
                .equal(customOptions.urlRoot + 
                       'baz.244bdf7481a02452864b59c4984dc72a.js');
            
            versioner
                .cssUrl('dir1/baz.css')
                .should
                .equal(customOptions.urlRoot + 
                       'baz.063294d2868a7c8b9653da78840f0963.css');
            
            done();
        });
    });

    it('roots with trailing slashes work', function(done) {

        // If the root fields have trailing slashes or not it should 
        // work as expected, handling bot the trailing and non trailing case
        var customOptions = {
            urlRoot: 'http://localhost/static',
            log: log,
            types: {
                image: {
                    root: __dirname + '/images/'
                },
                javascript: {
                    root: __dirname + '/javascript/'
                },
                style: {
                    root: __dirname + '/less/',
                    compiler: 'less'
                }
            }
        };

        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            versioner
                .imageUrl('dir1/abc.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/abc.629f545a3f7cea350715263cd5ef3012.jpg');
            
            versioner
                .jsUrl('dir1/baz.js')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.244bdf7481a02452864b59c4984dc72a.js');
            
            versioner
                .cssUrl('dir1/baz.css')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.063294d2868a7c8b9653da78840f0963.css');
            
            done();
        });
    });

    it('getting url by a path with leading / works', function(done) {

        var customOptions = {
            urlRoot: 'http://localhost/static',
            log: log,
            types: {
                image: {
                    root: __dirname + '/images/'
                },
                javascript: {
                    root: __dirname + '/javascript/'
                },
                style: {
                    root: __dirname + '/less/',
                    compiler: 'less'
                }
            }
        };

        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            // If we pass in a / to the url functions, they should work just as
            // if the / was not added.  Everything is always relative to the root
            // field under the hood
            versioner
                .imageUrl('/dir1/abc.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/abc.629f545a3f7cea350715263cd5ef3012.jpg');

            versioner
                .imageUrl('dir1/abc.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/abc.629f545a3f7cea350715263cd5ef3012.jpg');
            
            versioner
                .jsUrl('/dir1/baz.js')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.244bdf7481a02452864b59c4984dc72a.js');

            versioner
                .jsUrl('dir1/baz.js')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.244bdf7481a02452864b59c4984dc72a.js');
            
            versioner
                .cssUrl('/dir1/baz.css')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.063294d2868a7c8b9653da78840f0963.css');

            versioner
                .cssUrl('dir1/baz.css')
                .should
                .equal(customOptions.urlRoot + 
                       '/baz.063294d2868a7c8b9653da78840f0963.css');
            
            done();
        });
    });

    it('explicit image file is loaded with and without leading slash', function(done) {
        var customOptions = {
            urlRoot: 'http://localhost/static',
            log: log,
            types: {
                image: {
                    files: [
                        { source: __dirname + '/images/img1.jpg', path: 'img1.jpg' },
                        { source: __dirname + '/images/img2.jpg', path: '/img2.jpg' }
                    ]
                }
            }
        };

        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            versioner
                .imageUrl('img1.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/img1.48165169d86a762465007f6679d5e553.jpg');

            versioner
                .imageUrl('img2.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/img2.912d44c4ddb55d3dc54c18ced24fe4c3.jpg');

            done();
        });
    });

    it('explicit image loaded from buffer with and without leading slash', function(done) {

        var img1Buffer = Fs.readFileSync(__dirname + '/images/img1.jpg'),
            img2Buffer = Fs.readFileSync(__dirname + '/images/img2.jpg'),
            abcBuffer = Fs.readFileSync(__dirname + '/images/dir1/abc.jpg'),
            imgSmallBuffer = Fs.readFileSync(__dirname + '/images/img_small.jpg');

        var customOptions = {
            urlRoot: 'http://localhost/static',
            log: log,
            cacheFiles: true,
            types: {
                image: {
                    files: [
                        { data: img1Buffer, path: 'img1.jpg' },
                        { data: img2Buffer, path: '/img2.jpg' },
                        { data: abcBuffer, path: 'dir1/abc.jpg' },
                        { data: imgSmallBuffer, path: 'img_small.jpg' }
                    ]
                },
                style: {
                    files: [
                        { source: __dirname + '/less/url-replace.less', 
                          path: 'url-replace.css' },
                        { source: __dirname + '/less/datauri-replace.less', 
                          path: 'datauri-replace.css' }
                    ],
                    compiler: 'less'
                }
            }
        };

        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            versioner
                .imageUrl('img1.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/img1.48165169d86a762465007f6679d5e553.jpg');

            versioner
                .imageUrl('img2.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/img2.912d44c4ddb55d3dc54c18ced24fe4c3.jpg');

            versioner
                .imageUrl('dir1/abc.jpg')
                .should
                .equal(customOptions.urlRoot + 
                       '/abc.629f545a3f7cea350715263cd5ef3012.jpg');


            // The paths to the images in the less file should have
            // been replaced with the absolute paths
            var lessString = versioner
                    .get('url-replace.0482bde34d2de2654190164022008174.css')
                    .data
                    .toString('utf8');

            lessString.should.equal('.foo {\n\
  background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg);\n\
}\n\
.bar {\n\
  background-image: url(' + options.urlRoot + '/img2.912d44c4ddb55d3dc54c18ced24fe4c3.jpg);\n\
}\n\
.baz {\n\
  background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg);\n\
}\n\
.foobar {\n\
  background-image: url(' + options.urlRoot + '/abc.629f545a3f7cea350715263cd5ef3012.jpg);\n\
}\n\
');

            lessString = versioner
                .get('datauri-replace.b792cf32238630e8b563e60db7d5bb4a.css')
                .data
                .toString('utf8');
            
            lessString.should.equal('.bar {\n' +
'  background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg);\n' +
'  background-image: url(data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2ODApLCBxdWFsaXR5ID0gOTUK/9sAQwACAQEBAQECAQEBAgICAgIEAwICAgIFBAQDBAYFBgYGBQYGBgcJCAYHCQcGBggLCAkKCgoKCgYICwwLCgwJCgoK/9sAQwECAgICAgIFAwMFCgcGBwoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK/8AAEQgAMgAyAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A/fvn2qnr+v6T4Y0mfXNdvo7a1toy80z9AB+pPsOTVTUvGOgQ6XfXtjrtnM9nFIZEjukYqyqSVODweOlfAn7SX7SvxM8feALm/wBRu7t/7MgkydNgaNZQ0oChvLbD4CE4AGRnnGDX5zx14iZfwfhoQhH2taqpezSacbpqL5mm7JN3tu7NaMic1BD/APgoL+2g/jqym8D+D9cs4tLadls5zMcy7eDOVHzPj5sKobABJHUV5P8AsPf8FGNZ/Z78eHwZ4lvptS8G3UpfV7Xy90mkuzyqsuWZQjMUGU53DrhuB4J8RvFGraV4h1EeIbwraPaRXLX8mmC1tooZVLGZQJIzdgGN41XCp++ZmxmvMv8AhKLG58PX+peJtR1LTIVeG6SGKDyX1eeQswu5UkVlSHYHKqnVVYhuC5/AMvz3P5Zu85nWbrSd79LPaNv5UtOXtq+sjnjUvK5/Q34M8a+FviF4btPF/grX7XU9MvohJa3tnMHjkX2I/UdQRg1qfNjoK/GD/gnb/wAFL/iJ8ANU074cXwsNR8L6xqSsyyXJWK1DyAbtx/1bbCXKqNvHfHH7JeHfEWheLdCtfEvhnWbe/wBPvoVms720mEkc0Z5DKw4IPqK/pvhXijDcSYRtLlqwtzx8+8e8flo9H59MZKSLuX9BRRt/2j+dFfVFH5m+PfFs1p411iez8X20f2eadXtg7yTysoYsgA4DZGOvfnGcj5s/ar8aeMbyHwz4HXU5Ir5Z40jQ3oCqlzKo3ykYAUAqeGZ8bRgZYJt3Hgbxt8Rvi3rC6DrVjCo1UvcC+bewjaYGUFGjBlUAFPlKbmMgLFRzzPxR8H+FX+LemeH/ABf8ULS7sLCJl1ae1lUXJkTBSBWjYlJdw3l1ZVRVZQuGcn/P/C0qEcwde907ytq7Xu7PR33+djhs5K6MLwwdb8WanrvhHwvrH27XJraHT7vX9RUWiWlpGMMoDNI6pkJkh2dv3YKnBY+WeN7Hwn8NtQ8Q6h4l8SaV4z1Z5k021urq2MqWhd0XEUcgy7E7cPgkBMKFON+n8V/2n/D/AIe1vxD4X+GXgNdBnti7W8emDzLi78vDjf5iuEk2q4LkLt3tzgsG8R0zwN8Z/jPqOo614C0tFtrK6ibUb64DbFRR5jqNwjYsgBVsfIw28cZr7jKsvrPmrV2qVN8u9k+nVbJ9FH0d9QUXc9c+G/w9+J/h3wNcfFPwp4ei061niAWJr/y7pbcbgFRHJJOCGAyMKPusxr9D/wDglF/wU08d/E/x94Z/Zu1zRLH+wTp/9n6ZMoEJs0toJCjcrud5Sighj16Bc4P5IfEL4/6/ca1YeH5r64S9gv40SyDvsWcBiYQ8igFgpjBO5txJbJB49K+C3xI8K+G9Jtb/AF0XOm3kUkckd9pV2YDFJHIzrhxlCN6suOQVUDkdPossxea8O42GOu/ekrqH2oJ6xd78yts+/nqWpuJ/SoGXHT9KK/F3w9/wV4/ay0zQLHTdK+KVxc2tvZxRW1xe2NjJNLGqAK0jsmWcgAknkkkmiv17/iKPD3WFT/wFf/JG3tonmkv7Vuu6j4Y1DULGw06E2URvJdQsbpZ7qRHmiCb4IpCqxqJyRlnbeWO3cSw+VNQvvizrHxBufDnw9u5LvXNZNybmATSwCGfIWWKUkjZIVLsAGkAT+H5uNz4ueJofEOi3ugaPJpN9Jqnh1bHSIGsJrS9jhSNDGI0RwsZLIv3lG7IJ6iqXhPTbvwv8R9K0y6+HPk3epST3VskeqTGzsttuUldwu0SOV3knPIZBnjn8cpZCuH4yUoR5pJtR0ekVfXVOye+3U4qdaNTY6/4gfsbfFDV/CF74x1vxKLO0mlmLpPaOzKrjdImWkUNKnmOiMFCbQxKkkGvIvFnxoj+HnhCT4I6Zq97AkCMl3FbWqqkrbjvA2rnaCJMsCzMwUbPmJrof2oPj18SfEegaNpVz4juk0+3jcxWBEca7AisZBCjtlAMDf904IBrz3wD43s9f+IdvoWtfDq/e5SBHXVbC2VppZ2ZDBbsMbUQfe5B4VemSa78rweOlgvbYxKcY3koxtG3Lpd33/Pt1N9LaGn4A0L46Pquq6w/wzgu3nhjsrdb+EeZEzBPMfOM4B25BPy7uh3E1n3t34i0nWx4K1i3sYV05Pst2mnQtGQIQ+ZJfl3PvE2Nykctzmvp/wr8QvhB4O0S61nxTphmhLSy26yWLorkOSf8AWAn5nx1ZuFU9sD5b+KP7QOha/wCKbiy0h5bDS2nULapKnlAE7uVCDc+QD5jEk4weua6MhxOIzTNWp4a1NW1SdtFbq3+CRjVvyO2515uNTgPkR62qKnyqiwAhQOwPeiu60rwnYy6ZbSyWEMjNAhaQI+GO0c9KK+9+qUP5F9y/yPM5X3f3m98JbCxnhv8AUZrOJ7iMSMk7RgupWadVIbqCAqgegAHauB8byyw/F/RrCKVlguXuluIVbCSjyVbDDow3EnnuSe9FFfE5+k8/d/8AnyvykdeF6ny9aXt5qPga6uNQu5Z5LeW7it5JpCzRRgghFJ+6oPOBxXZfCe8u2+C8lw11IZJNfG9y5y37u3HJ78cUUV9fmkY/U5K3/LyH5M7mdl4wggg+FNhPBCiPLdaakjooBdSs+VJ7g4GR7V806/NMNe09xK2cSHO7uETBoorbgzWVS/8ANIR9r+Fb69PhfTSbyUk2EOSZD/cFFFFezJLmZxWR/9k=);\n}\n');

            done();
        });
    });

    it('css files are versioned correctly, no less compilation', function(done) {
        var customOptions = {
            urlRoot: 'http://localhost/static',
            log: log,
            cacheFiles: true,
            types: {
                image: {
                    root: __dirname + '/images'
                },
                style: {
                    root: __dirname + '/css'
                }
            }
        };

        var versioner = new Versioner(customOptions);
        versioner.build(function(error) {
            if (error) throw error;

            // The paths to the images in the css file should have
            // been replaced with the absolute paths
            var cssString = versioner
                    .get('url-replace.735b737e61e08f8826989b82c48e0c70.css')
                    .data
                    .toString('utf8');

            cssString.should.equal('.foo { background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg); }\n\
.bar { background-image: url(' + options.urlRoot + '/img2.912d44c4ddb55d3dc54c18ced24fe4c3.jpg); }\n\
.baz { background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg); }\n\
.foobar { background-image: url(' + options.urlRoot + '/abc.629f545a3f7cea350715263cd5ef3012.jpg); }');

            cssString = versioner
                .get('datauri-replace.9d938e34636c132e4f38c514590fbae3.css')
                .data
                .toString('utf8');
            cssString.should.equal('.bar {\n' +
'    background-image: url(' + options.urlRoot + '/img1.48165169d86a762465007f6679d5e553.jpg);\n' +
'    background-image: url(data:image/jpeg;base64,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);\n}');
            done();
        });
    });
});
