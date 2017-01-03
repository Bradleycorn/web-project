const SRC_PATH = "app";
const SRC_HOST = "dev.bradball.net";
const BOWER_PATH = SRC_PATH + "/_/bower_components";
const DIST_PATH = "www";
const ERROR_LEVELS = ['verbose', 'info', 'warning', 'debug', 'error'];


const gulp = require('gulp');
const browserSync = require('browser-sync');
const del = require('del');
const pngquant = require('imagemin-pngquant');
const lintReporter = require('jshint-stylish');
const args = require('yargs').argv;
const $ = require('gulp-load-plugins')({pattern: ['gulp-*', 'gulp.*', '!gulp-grunt*']});
const map = require('map-stream');
const beep = require('beepbeep');
const grunt = require('gulp-grunt')(gulp, {
	prefix: 'bootstrap-',
	verbose: false,
	deps: {
		all: ['update-packages', 'dist-bootstrap'],
		update: ['update-packages', 'dist-bootstrap'],
		build: 'dev-bootstrap'
	}
});

const NODE_VER = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

if (NODE_VER <= 0.1) {
	console.log("NODE 0.10 detected .. Enabling Promise polyfill");
	require('es6-promise').polyfill();
}

/**
 * Build Modes
 *
 * Build Modes are used to set options for various tasks that are run.
 * For example, we might want to output expanded css files during development, and compressed css for production
 */
const BUILD_MODE_DEV = "dev";
const BUILD_MODE_DIST = "dist";

/**
 * The buildMode variable is used to set the current build mode (see above section on Build Modes).
 * See the enable-dist task for more information.
 *
 * default: BUILD_MODE_DEV
 */
var buildMode = BUILD_MODE_DEV;

/**
 * The proxyServer is our instance of Browser Sync, which is responsible for reloading browser windows
 * when files change. It is initialized in the browser-sync task
 */
var proxyServer = null;

/**
 * The logLevel variable sets the level at which logging to the console occurs. 
 * For instance, if the errorLevel is set to 'error', then anything marked 'error', 'warning', or 'info'
 * will be logged, and antying marked 'verbose' or 'debug' will NOT be logged.
 *
 * The logLevel is set based on the --logLevel command line option, and defaults to 'error'
 */
var logLevel = args.logLevel || 'error';

/**
 *  ROOT TASKS (Called from the command line)
 *
 *	The set of tasks below define the base tasks that we call from the command line.
 *	These tasks aggregate the other tasks defined below to form various build chains.
 *
 *	Included Tasks:
 * 
 *  - watch (default)
 *	- build
 *
 */


// set the default task to the 'watch' task. The default task is run when you run gulp with no other arguments.
gulp.task('default', ['watch']);


/**
 * WATCH
 *
 * The watch task is responsible for watching for file changes and performing basic builds in response. 
 * This includes compiling sass to css, and handling any browser refreshes that might be needed.
 *
 * Note that this task, while used for development, is dependent on sass-dev. This is on purpose. 
 * The first time that sass is run, we need to be sure that the clean task is run first (ie. there needs to be
 * a dependancy on clean the first time). The sass-dev task provides this. Subsequently, when watch detects
 * file changes, it will call the sass-watch task (which has no dependencies), to avoid cleaning out all compiled stylesheets.
 */
gulp.task('watch', ['clean-dev',  'browser-sync', 'bootstrap-build', 'sass-dev', 'lint-js'], function() {
	buildMode = BUILD_MODE_DEV;
	gulp.watch([SRC_PATH + "/_/sass/**/*.scss", "!"+SRC_PATH+"/_/sass/_lib/_bootstrap.scss"], ['sass-watch']);
	gulp.watch(SRC_PATH+"/_/sass/_lib/_bootstrap.scss",['bootstrap-build']);
	gulp.watch(BOWER_PATH+"/bootstrap/dist/css/bootstrap.css").on('change', function(event) {
		if (event.type=='added' || event.type=='changed') {
			proxyServer.reload();
		}
	});
	gulp.watch(SRC_PATH + "/**/*.+(html|php|inc)").on('change', proxyServer.reload);
	gulp.watch(SRC_PATH + "/_/js/**/*.js", ['lint-js']).on('change', proxyServer.reload);
});


/**
 * BUILD
 *
 * The build task is responsible for doing a complete build of the site for a push to the LIVE site.
 * This includes copying all necessary files to the dist folder, compiling sass, compressing images, 
 * minifying and concatinating scripts, etc.
 * Running this task will result in a complete production ready copy of the site in the project's dist/ folder.
 *
 */
gulp.task('build', ['enable-dist', 'clean-dist', 'copy-files', 'compress-images', 'sass-dist', 'minify', 'replace']);




/* ========= END ROOT TASKS ========= */


/** 
 * ENABLE-DIST
 *
 * Used by the build task, this task toggles the buildMode variable to the "dist" build mode.
 *
 */
gulp.task('enable-dist', function() {
	buildMode = BUILD_MODE_DIST;
});



gulp.task('update-packages', function() {
	var stream = gulp.src(['../package.json', './bower.json'])
		.pipe($.install());

	return stream;
});


/**
 * BROWSER-SYNC
 *
 * The browser-sync task is responsible for setting up and starting the browser-sync service, 
 * which will be run in proxy mode to connect to our main development web site.
 */
gulp.task('browser-sync', ['bootstrap-build'], function() {
	proxyServer = browserSync.create();
	proxyServer.init({
		proxy: SRC_HOST,
		xip: false,
		port: 8080,
		ghostMode: true
	});
});

/**
 * CLEAN
 *
 * The clean task is responsible for cleaning out (deleting) generated files before doing a build
 * This may include the css folder for development or the dist folder for a production build.
 */
gulp.task('clean-dist', ['update-packages'], cleanProject);
gulp.task('clean-dev', cleanProject);

function cleanProject() {
	var path = [];
	console.log("Cleaning project..." + buildMode);

	path.push(SRC_PATH + "/_/css");
	if (buildMode == BUILD_MODE_DIST) {
		path.push(DIST_PATH + "/**/*");
	}
	return del.sync(path);
}

/** SASS-DEV and SASS-DIST
 *
 * We define 2 tasks for compiling sass stylesheets. Both end up calling the same function, sass().
 * Two different tasks are defined, as a production build has a different set of dependencies than
 * a development build.
 * 
 * sass()
 * The sass() function is responsible for compiling all sass stylesheets into output css. 
 * depending on the build mode, it will use different compression and sourcemap settings. 
 *
 * sass-dist
 * The sass-dist task will ensure that clean-dist (which itself is dependent on update-packages) 
 * is called before the sass() compilation.
 *
 * sass-dev
 * The sass-dev task will ensure that clean-dev (which does a clean with no dependencies) is finished
 * before running the sass() function. This is useful when starting up gulp watch the first time, 
 * to ensure the site is cleaned and then built before starting to do development.
 *
 * sass-watch
 * sass-watch has no dependencies, so it will call sass() right away. Useful when watching
 * for changes to .scss files.
 */
gulp.task('sass-dist', ['clean-dist'], sass);
gulp.task('sass-dev', ['clean-dev'], sass)
gulp.task('sass-watch', sass);

function sass() {
	var opts = {};
	var outputPath = SRC_PATH + "/_/css";
	var createSourceMaps;

	console.log("Compiling Sass...");

	switch (buildMode) {
		case BUILD_MODE_DIST:
			opts.outputStyle = 'compressed';
			createSourceMaps = false;
			break;
		default:
			opts.outputStyle = 'expanded';
			createSourceMaps = true;
	}

	opts.includePaths = [SRC_PATH + '/_/sass/_lib/', BOWER_PATH + '/bootstrap/scss/'];
	
	var stream = gulp.src(SRC_PATH + "/_/sass/**/*.scss")
		.pipe($.if(createSourceMaps, $.sourcemaps.init()))
		.pipe($.sass(opts).on('error', function(error) {
			handleError(this, 'error', false, error.messageOriginal, error.relativePath, error.line, error.column, error.plugin);
		}))
		.pipe($.autoprefixer())
		.pipe($.if(createSourceMaps, $.sourcemaps.write('./sourcemaps')))
		.pipe(gulp.dest(outputPath));

	if (proxyServer != null) {
		stream.pipe(proxyServer.stream({match: "**/*.css"}));
	}

	return stream;
}


/**
 *	MINIFY
 *
 * The minify task is responsible for minification and concatination of resource files (css, js, etc).
 * It looks for <!--build --> comments in source php/html files and performs the appropriate concatination, minification, and renaming.
 * The task is setup to concatinate all <!--build--> blocks, but only minify (and uglify) our js files (leaving 3rd party libaries untouched).
 * 
 * Note: this task will not uglify any js files in the /_/lib/ folder. If you have js (or other) files that you do not want minified/uglified
 * (for example, a 3rd party library that is already minified), make sure it is in a subfolder of /_/lib. These files will still be concatinated,
 * but they will NOT be minified/uglified.
 */
gulp.task('minify', ['clean-dist', 'bootstrap-all', 'sass-dist'], function() {
	console.log("Minifying resources ...");
	
	const SRC_FILES = [
		SRC_PATH + '/**/*.+(html|php|inc)',
		'!' + BOWER_PATH + '/**/*.*',
		'!' + SRC_PATH + '/_/templates/**/*.*'
	];

	const FILTER = $.filter(["**/*.js", "!**/_/lib/**/*.js"], {restore: true});


	var stream = gulp.src(SRC_FILES)
		.pipe($.useref())
		.pipe(FILTER)
		.pipe($.uglify())
		.pipe(FILTER.restore)
		.pipe(gulp.dest(DIST_PATH));

	return stream;
});

gulp.task('replace', ['clean-dist', 'minify'], function() {
	console.log("Replacing text in files ...");

	const SRC_FILES = [
      DIST_PATH + '/**/*.+(html|php|inc)'
	];
});


/**
 * LINT-JS
 *
 * The lint-js task is responsible for running the jshint linter on our javascript
 *
 * This task will only lint files in the /_/js folder, and will lint all .js files
 * in that folder. As a result, if you use 3rd party librarys (which will often fail linting),
 * or if you have a javascript file that for whatever reason should not be linted (though I
 * can't imagine what a good reason would be), they should go elsewhere (like /_/lib/)
 */
gulp.task('lint-js', function() {
	console.log("Linting javascript ...");

	const SRC_FILES = [
		SRC_PATH + "/_/js/**/*.js",
		SRC_PATH + "/**/*.+(html|php|inc)",
		"!" + BOWER_PATH + "/**/*.*"
	];

	gulp.src(SRC_FILES)
		.pipe($.jshint.extract('auto'))
		.pipe($.jshint())
		.pipe($.jshint.reporter(lintReporter, {beep: true, verbose: true}))
		.pipe($.if((buildMode === BUILD_MODE_DIST), $.jshint.reporter('fail')));
});


/**
 *  COMPRESS IMAGES
 *
 *  Responsible for copying all images from SRC_PATH to DIST_PATH
 *  Along the way, it will do the following:
 *  1. Compress some images (jpgs, pngs, gifs, svgs). Note other images will still be copied
 *  2. Get the appropriate set of favicons based on command line arguements
 *		(pass in --staging or --dev for the red staging icon, 
 *		 or --local for the blue local icon. defaults to using the live icon)
 *
 *  Note that this task will handle all favicon files,
 *	including those that aren't images (like browserconfig.xml, etc)
 */
gulp.task('compress-images', ['clean-dist'], function() {

	//Set options for image compresssion
	const opts = {
		progresssive: true,
		use: [pngquant()]
	};

	//Initially, get all images, including favicons, but not those in bower packages
	var src_files = [
		SRC_PATH+"/**/*.+(jpg|jpeg|png|gif|webp|bmp)",
		SRC_PATH+"/_/img/icons/favicon/**/*.*",
		"!"+BOWER_PATH+"/**/*.*"
	];

	//Now, filter the favicon files to include only those we need
	//based on the cli args. This is accomplished by removing those we don't need.
	if (args.staging || args.dev) {
		src_files.push("!"+SRC_PATH+"/_/img/icons/favicon/live/**/*.*");
		src_files.push("!"+SRC_PATH+"/_/img/icons/favicon/*.*");
	} else if (args.local) {
		src_files.push("!"+SRC_PATH+"/_/img/icons/favicon/live/**/*.*");
		src_files.push("!"+SRC_PATH+"/_/img/icons/favicon/staging/**/*.*");
	} else {
		src_files.push("!"+SRC_PATH+"/_/img/icons/favicon/staging/**/*.*");
		src_files.push("!"+SRC_PATH+"/_/img/icons/favicon/*.*");
	}

	//Setup a couple filters that we'll use to only perform opertations on certain sets of files.
	//one to get only images for compresssion
	//another to get only favicon files
	var filterCompressedImages = $.filter("**/*.+(jpg|jpeg|png|gif)", {restore: true});
	var filterFavicons = $.filter(SRC_PATH+"/_/img/icons/favicon/**/*.*", {restore: true});


	//We're ready to process the files now, in order:
	// 1. Get all the files
	// 2. Filter only images for compression
	// 3. Compress those images
	// 4. Filter only favicon files
	// 5. Update the favicon output paths
	// 6. output all files to the dist folder
	gulp.src(src_files)
		.pipe(filterCompressedImages)
		.pipe($.imagemin(opts))
		.pipe(filterCompressedImages.restore)
		.pipe(filterFavicons)
		.pipe($.rename({dirname: "_/img/icons/favicon"}))
		.pipe(filterFavicons.restore)
		.pipe(gulp.dest(DIST_PATH));
});


/** 
 *
 * COPY-FILES
 * The copy-files task is reponsible for copying any files that need to wind up in the dist folder but aren't handled by any other processing.
 */
gulp.task('copy-files', ['clean-dist'], function() {
	gulp.src(SRC_PATH+"/_/res/pdf/**/*.*", {base: SRC_PATH})
	.pipe(gulp.dest(DIST_PATH));
});

gulp.task('dist-bootstrap', ['update-packages'], prepBootstrap);
gulp.task('dev-bootstrap', prepBootstrap)

function prepBootstrap() {
	var stream = gulp.src(SRC_PATH+"/_/sass/_lib/_bootstrap.scss")
	.pipe($.rename(BOWER_PATH+"/bootstrap/scss/_custom.scss"))
	.pipe(gulp.dest('./'));

	return stream;
};


/** ======== HELPER FUNCTIONS ========= */


/**
 * HANDLE ERROR
 * 	
 * This function is responsible for handling and logging errors. 
 */
function handleError(context, level, isFatal, message, file, line, column, plugin) {
	isFatal = (buildMode == BUILD_MODE_DIST) || isFatal || false;

	if (isFatal || showError(level)) {
		beep();

		var output = "";

		output = $.util.colors.white.bgRed(" ", level.toUpperCase(), " ");
		if (plugin) {
			output += $.util.colors.white.bgRed("in plugin: " + plugin + " ");
		}
		$.util.log(output);

		if (file) {
			$.util.log($.util.colors.yellow("File: "), "\t", $.util.colors.underline(file));
		}

		if (line) {
			$.util.log($.util.colors.yellow("Line: "), "\t", $.util.colors.magenta(line));
		}

		if (column) {
			$.util.log($.util.colors.yellow("Column: "), "\t", $.util.colors.magenta(column));
		}

		if (message) {
			$.util.log($.util.colors.yellow("Message: "), message, "\n");
		}
	}

	if (isFatal) {
		process.exit(1);
	} else {
		context.emit('end');
	}
}


/**
 * SHOW ERROR
 *
 * Determines whether or not an error of the given level should be displayed.
 *
 * @param level {string} - the level of the error
 *
 * @return {boolean} - true if the error should be displayed.
 *
 */ 
function showError(level) {
	if (isNaN(level)) {
		level = ERROR_LEVELS.indexOf(level);
	}

	return (level >= ERROR_LEVELS.indexOf(logLevel));

}