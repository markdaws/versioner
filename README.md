# versioner

##Overview
Versioning static assets such as images, css, javascript etc. is an important part
of any website. This node module easily allows you to add versioned assets to your
website with minimal steps, removing tedious work that is constantly repeated when
you want to get a website up and running in the real world.

versioner uses the hash of the file contents, this means the URL of the asset will
only change if the contents of the file changes.  This is beneficial vs. just using
a version number since assets will only cache bust when they really change vs. every
time you do a new release of your website to your servers.

For example, versioner will generate URLs like:

    http://localhost/assets/style.fa92255da9e98dd0b09188fb982213ec.css
    http://localhost/assets/main.b1c7fc379fb437c54ef5981337e623b7.js

Instead of:

    http://localhost/assets/style-1.2.1.css
    http://localhost/assets/main-1.2.1.js

If the contents of main.js changes but style.css doesn't the versioner approach
will only cause clients to redownload main.js, whereas the simple version number will
cause all of the files to be downloaded by the client.

## Installation
`npm install versioner`

## Creating a versioner instance
In order to create versioned assets you need to provide the location on disk where
the assets live, plus provide a URL where the versioned assets will be referenced
from. The options that can be passed to the Versioner constructor are:

```javascript
{
    // Determines the URL to use when creating versioned
    // asset urls e.g. when calling imageUrl('foo.jpg') the
    // result will be http://localhost/static/foo.<HASH>.jpg
    urlRoot: 'http://localhost/static',

    // Log object to provide extra debug/error logging. If true is
    // specified a simple console logger will be used, useful for
    // debugging. Otherwise a custom object can be specified that contains
    // verbose(message), warning(message), error(message, errorObj) as
    // functions.  This is useful for custom logging.
    log: true,

    // If true once the files have been versioned they will remain in memory
    // which is useful if you want to then save the files to disk as part of
    // a build step, or you want to serve the versioned files directly from
    // the versioner module in your HTTP server. Defalts to false.
    cacheFiles: true,

    // Specify options for the various asset types
    types: {
        image: {
            // Root directory to load images from on disk. All files will be loaded
            // recursively from this directory
            root: __dirname + '/images',

            // OPTIONAL: overrides the global urlRoot, all image
            // files will reference this root.
            urlRoot: 'http://localhost/static/images',

            // You can specify explicit file or provide a node Buffer instance
            // as the source of the file.  The path is the value you will give
            // to the url functions e.g. imageUrl, cssUrl, jsUrl to retrieve the
            // versioned URL of the asset.
            files: [
                { data: img1Buffer, path: 'img1.jpg' },
                { source: __dirname + '/images/img2.jpg', path: 'dir1/img2.jpg' }
            ]
        },
        javascript: {
            // Root directory to load javascript from
            root: __dirname + '/javascript',

            // OPTIONAL: overrides the global urlRoot, all javscript
            // files will reference this root.
            urlRoot: 'http://localhost/static/js',

            files: [ ... ]
        },
        style: {
            // Root directory to load styles from
            root: __dirname + '/less',

            // OPTIONAL: overrides the global urlRoot, all image
            // files will reference this root.
            urlRoot: 'http://localhost/static/css',

            // Indicates the style files are less files. If nothing
            // is specified the files are assumed to be CSS files.
            compiler: 'less',

            files: [ ... ],
        }
    }
}
```

##Fetching the versioned URL of an asset
Once you have specified the urlRoot and sources of all the files you can use
the following methods on the versioner instance:

```javascript
imageUrl(path)
jsUrl(path)
cssUrl(path)
```

If you specify a root path, then the path you pass into the methods above is relative
to the root path. For example, if you specify the root of images to be:
/Users/mark/projectA/images

Then to retrieve the file that lives at: /Users/mark/projectA/images/dir1/foo.jpg you
would call:

```javascript
versioner.imageUrl('dir1/foo.jpg')
```

The value returned will be the versioned image name appended to the urlRoot value, so if
urlRoot is: http://localhost/static then imageUrl('dir1/foo.jpg') will return
http://localhost/static/foo.&lt;UNIQUE_HASH&gt;.jpg.

NOTE: the path has been flattened to only use the file name, not including the dir1
reference.

##Explicit buffers
If you specify an explicit path for a file or specify a buffer in the files:[] property
of the Versioner options, then to retrieve the versioned URL, you give the "path" value
you entered in the explicit file information.  For example:

```javascript
var img1Buffer = require('fs').readFileSync('/Users/mark/projectA/images/img1.jpg');

var options = {
    urlRoot: 'http://localhost/static',
    types: {
        image: {
            files: [
                { data: img1Buffer, path: 'dir1/img1.jpg' },
                { source: '/Users/mark/projectA/images/img2.jpg', path: 'dir2/img2.jpg' }
            ]
        },
        style: {
            files: [
                { source: '/Users/mark/projectA/less/url-replace.less',
                  path: 'url-replace.css' }
            ],
            compiler: 'less'
        }
    }
};
```

To retrieve the versioned URL references you would call:
```javascript
versioner.imageUrl('dir1/img2.jpg');
```

The reason you may have a buffer is that files in your project may not actually exist
on disk. For example, you may have files a.js, b.js and c.js on disk that you
concatenate together and want to serve as mysite-min.js If you wanted to version this
you could concatentate the files and store the concatenated data in a buffer, then pass
the buffer to versioner along with the path of 'mysite-min.js'

##Versioning assets referenced from css/less files
It is very common to reference images from stylesheets. For example:

```css
.foo { background-image: url(img1.jpg); }
```

versioner provides an easy way to update the assets to point to their versioned equivalent.
You simply wrap the path in either versionerUrl or versionerDataUri wrappers, then when
versioner loads the stylesheet, the image path updates e.g.

```css
.foo { background-image: url("versionerUrl(img1.jpg)"); }
.bar { background-image: url("versionerDataUri(img2.jpg)"); }
```

This will then be converted to something like:

```css
.foo { background-image: url(http://localhost/assets/img1.629f545a3f7cea350715263cd5ef3012.jpg);
.bar { background-image: url(data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q=); }
```

Pretty neat :)

##less
less http://lesscss.org/ support is built directly into versioner.  Simply specify the compiler
as less in the options to the Versioner constructor and the files will automatically be compiled e.g.

```javascript
{
    types: {
        style: {
            compiler: 'less'
        }
    }
}
```

If you don't specify a compiler value the style files will assume to be CSS.  You can also specify
a custom compiler to use.  Instead of passing the string 'less' specify a function with the following
signature:

```javascript
function(styleString, callback);

//callback(error, compiledCss);
```

Where styleString will be the contents of the style file and the callback should be passed the compiled
CSS string after it has been processed.

NOTE: Currently versioner does not support CSS files that reference other CSS files,
you can either just include multiple CSS files in your webpage or concatentate all of
your CSS files into a single CSS file.

#Example of using versioner in your webapp

Below is a quick example of how you can us versioner in your app:

```javascript

// 1. Specify where to load assets from
var versioner = new Versioner({
    urlRoot: 'http://localhost/assets',
    types: {
        image: {
            root: __dirname + '/public/images',
        },
        javascript: {
            root: __dirname + '/public/javascripts',
        },
        style: {
            root: __dirname + '/public/stylesheets',
            compiler: 'less'
        }
    }
});

// 2. Build the version information, then start listening for requests
versioner.build(function(error) {
    if(error) {
        console.error('Failed to load versioned assets');
        process.exit(1);
    }

    http.createServer(app).listen(port, function(){
        console.log("Express server listening on port " + port);
    });
});
```

In your backend templates you can now use the versioner instance that
you created above, e.g. mytemplate.ejs

```html
<!DOCTYPE html>
<html>
  <head>
    <title><%= title %></title>
    <!-- IMPORTANT: Note how you reference the file as style.css even if
         it was initially style.less, since after compilation the .less
         files are now .css file -->
    <link rel="stylesheet" href="<%= versioner.cssUrl('style.css') %>"/>
  </head>
  <body>
    <h1><%= title %></h1>
    <img src="<%= versioner.imageUrl('img_small.jpg') %>" />
    <script src="<%= versioner.jsUrl('dir1/main.js') %>" ></script>
  </body>
</html>
```

This will end up generating something like:
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Versioner Example</title>
    <link rel="stylesheet" href="http://localhost/assets/style.fa92255da9e98dd0b09188fb982213ec.css"/>
  </head>
  <body>
    <h1>Versioner Example</h1>
    <img src="http://localhost/assets/img_small.629f545a3f7cea350715263cd5ef3012.jpg" />
    <script src="http://localhost/assets/main.b1c7fc379fb437c54ef5981337e623b7.js" ></script>
  </body>
</html>
```

This example assumes that your server is capable of serving the versioned assets from
the http://localhost/assets URL root. You can do this by calling the save() method on
the versioner instance which will write all of the versioned assets to disk.

Note: Although you can use versioner to server files directly, you should really be
using one of those fancy CDN things that are capable of serving large amounts of
traffic.

##Creating versioned assets in a build step
Simply caller the build() method then save() all of the versioned assets will
then be written to yhe specified output directory

##Express Support
There is a simple to use express middleware provided as part of versioner.  This allows you to
easily plug versioner into your existing express apps with minimal effort.

```javascript
var Versioner = require('versioner');

// 1. Create the versioner instance
var vers = new Versioner({ //options ... });

// 2. Add the versioner middleware
app.configure(function(){
    // ...

    // Add express middleware that will check each incoming request
    // and see if it is a versioned asset. If it is then this piece
    // of middleware will serve the file, otherwise the next piece
    // of middleware will be called.
    app.use(Versioner.Express(vers));

    // Might be other assets we haven't versioned, serve those as normal
    app.use(express.static(path.join(__dirname, 'public')));
});

// 3. Build version information and start listening for
// requests on success
vers.build(function(error) {
    if(error) {
        console.error('Failed to load versioned assets');
        process.exit(1);
    }

    var port = app.get('port');
    http.createServer(app).listen(port, function(){
        console.log("Express server listening on port " + port);
    });
});
```

For a full working express example see examples/express/app.js
`node examples/express/app.js`

You can then view http://localhost:5678/ and see a page that is serving
versioned assets.

##API
```javascript

/**
 * @constructor
 * Versioner wraps all of the functionality necessary to
 * version assets such as css, js and images.
 *
 * @param {Object} options
 * @param {Boolean|Object} [options.log] If set to true, a simple internal
 * logger is used that just prints verbose/warn/error messages to the console. You can
 * also specify an object that has three methods verbose(message), warn(message) and
 * error(message, error) that can be used for custom logging.
 * @param {String} options.urlRoot A string that defines the root url where assets
 * will be referenced from when using the imageUrl, cssUrl, jsUrl functions. For example
 * setting urlRoot=http://localhost/assets then calling imageUrl('foo.jpg') will
 * return the versioned asset http://localhost/assets/foo.<HASH>.jpg. Note: This root URL
 * can be specified for individual types if you want to server images/js/css etc from
 * different URLs (you may be setting custom headers based on paths at the nginx level)
 * @param {Object} options.types Specific type information. See Versioner constructor info
 * above for more information.
 * @param {Boolean} [options.cacheFiles=false] By default once the versioned information
 * has been processed all files are unloaded from memory.  If you set the flag to true
 * then the buffers remain in memory and you can use the versioner module to serve the
 * file contents to callers of your app.
 */
Versioner(options)

/**
 * Generates all of the versioned information.  Must be called before calling
 * any other methods on the object
 * @param {Function(Object=)} callback (error) called once all the files have been processed
 */
build(callback)

/**
 * Writes the versioned files to disk, you can use this in a build step
 * to pre version your assets and then serve from a static location. NOTE:
 * you must make sure you set the cacheFiles option in the Versioner constructor
 * to true if you want to use this function, otherwise it will throw an error
 *
 * @param {String} outputDir Path where files should be written to
 * @param {Function(Object=)} callback Will be called once all of the versioned
 * files have been written to disk
 */
save(outputDir, callback)

/**
 * Given the path of an image, returns the version URL
 * @param {String} path e.g. dir1/foo.jpg
 * @return {String} The versioned URL of the resource
 */
imageUrl(path)

/**
 * Given the path of a javascript file, returns the versioned URL
 * @param {String} path e.g. dir1/foo.js
 * @return {String} The versioned URL of the resource
 */
jsUrl(path)

/**
 * Given the path of a css file, returns the versioned URL
 * @param {String} path e.g. dir1/foo.css
 * @return {String} The versioned URL of the resource
 */
cssUrl(path)
```

## Development
```shell
git clone https://github.com/markdaws/versioner.git
cd versioner
npm install
npm test
```
