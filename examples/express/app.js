var express = require('express'),
    http = require('http'),
    path = require('path'),
    Versioner = require('../../index.js');

var app = express();
var port = 5678;

// Create a new instance of a Versioner. The options specify where
// assets should be loaded from and what urls they should be
// served from
var versioner = new Versioner({
    // Logs output, you can also pass your own
    // custom logger to the log object
    log: true,

    // Make sure once we have versioned the files we keep them
    // loaded into memory so we can serve them via http requests
    cacheFiles: true, 

    // Root where assets will be served from
    urlRoot: 'http://localhost:' + port + '/assets',

    // Specifies what types of assets should be loaded, you can
    // add your own custom assets into the types hash.
    types: {
        image: {
            //NOTE: Paths must be absolute
            //TODO: Change these to be root
            root: __dirname + '/public/images',

            // Can also specify a list of explicit files, NOTE: These
            // have to be explicit paths, same for js and style
            //files: [
                //TODO: remove
                //{ root: '/Users/mark/stuff', path: 'bar/baz.jpg' },
                //{ buffer: null, path: 'clipboard.js' }
            //]
            //files: ['/foo/bar.jpg', { path: '/foo/baz.jpg', data: null }]
        },
        javascript: {
            root: __dirname + '/public/javascripts',
            //files: [
                // clipboard.js,
                // widgets.js
            //]
        },
        style: {
            // NOTE: paths must be absolute
            root: __dirname + '/public/stylesheets',

            // Can give an explicit list of files
            // TODO:
            //files: [],

            // Indicates the files are less files, if not present
            // the files are assumed to be css
            compiler: 'less'
        }
    }
});

app.configure(function(){
    app.set('port', port);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);

    // Add express middleware that will check each incoming request
    // and see if it is a versioned asset. If it is then this piece
    // of middleware will serve the file, otherwise the next piece
    // of middleware will be called.
    app.use(Versioner.Express(versioner));
  
    // Might be other assets we haven't versioned, serve those as normal
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req, res){  
    res.render('index', { 
        title: 'Versioner Example',

        // By passing the versioner to the ejs template we can use it
        // to generate URLs in the ejs template to the versioned assets
        versioner: versioner
    });
});

// This loads all of the versioned assets and processes them, only
// want to start listening to requests once the assets have been
// versioned.
versioner.build(function(error) {
    if(error) {
        console.error('Failed to load versioned assets');
        process.exit(1);
    }

    var port = app.get('port');
    http.createServer(app).listen(port, function(){
        console.log("Express server listening on port " + port);
    });

    // TODO: Put this in another example
    /*
    versioner.save(__dirname, function(error) {
        console.log('WRITTEN VERSION FILES: ' + JSON.stringify(error));
    });
    */
});
