module.exports = function(grunt) {

	require('load-grunt-tasks')(grunt);

	var constants = {
		src_host: 'dev.bradball.net',
		src_path: 'app',
		dist_path: 'www',

	};

	var bowerConf = grunt.file.readJSON('.bowerrc');

	if (bowerConf.directory.indexOf(constants.src_path) == 0) {
		bowerConf.relDirectory = bowerConf.directory.replace(constants.src_path + "/", "");
	} else {
		bowerConf.relDirectory = bowerConf.directory;
	}



	grunt.initConfig({

		config: constants,
		bower: bowerConf,

		// AUTO INSTALL
		// Run npm install and bower install
		// The "this" task will run them on this project
		// Add additional targets to run them on child-projects as needed.
		auto_install: {
			this: {},
			bootstrap: {
				options: {
					cwd: '<%= bower.directory %>/bootstrap'
				}
			}
		},

		// HUB
		// Run grunt files in child projects as needed. 
		// Create a new target for each child project.
		hub: {
            bootstrap: {
                src: ['<%= bower.directory %>/bootstrap/Gruntfile.js'],
                tasks: ['dist']
            }
        },

		// CLEAN
		// Clean out (delete all files and folders) some folder before doing builds
		clean: {
			all: '<%= config.src_path %>/_/css',
			dev: { /* Nothing to do */ },
			dist: ['<%= config.dist_path %>/**/*', '.tmp']
		},

		// COPY
		// Copy some files and/or folders from the app to the dist folders. 
		// Useful for files that are not otherwise processed by other tasks (like images, fonts, etc).
		copy: {
			dev: {
				//Nothing to do.
			},
			dist: {
				files: [
					{	
						expand: true,
						cwd: '<%= config.src_path %>',
						dest: '<%= config.dist_path %>',
						src: [
							'**/*{.html,.php,.inc}', 
							'!<%= bower.relDirectory %>/**/*',
							'_/img/**/*{.jpg,.gif,.png,.svg}',
						]
					} 
				]
			},
			bootstrap: {
				files: [
					{
						expand: true,
						src: '<%= config.src_path %>/_/sass/_lib/_bootstrap.scss',
						dest: '<%= bower.directory %>/bootstrap/scss',
						flatten: true,
						rename: function(dest,src) {
							return dest + src.replace('_bootstrap', '/_custom');
						}
					}
				]
			}
		},

		// SASS
		// Compile Sass stylesheets to css
		sass: {
			options: {
				outputStyle: 'expanded',
				includePaths: ['<%= config.src_path %>/_/sass', '<%= config.src_path %>/_/sass/_lib', '<%= bower.directory %>/bootstrap/scss'],
				sourceMap: false //we'll let postcss handle sourcemaps
			},
			all: {
				files: [{
					expand: true,
					cwd: '<%= config.src_path %>/_/sass',
					src: ['**/*.scss'],
					ext: '.css',
					dest: '<%= config.src_path %>/_/css'
				}]
			}
		},

		// POSTCSS
		// Perform additional processing on CSS after sass has run,
		// like autoprefixer, etc.
		postcss: {
			options: {
				map: {
					inline: false,
					annotation: '<%= config.src_path %>/_/css/_maps'
				},
				processors: [
					require('autoprefixer')({browsers: 'last 2 versions'})
				]
			},
			all: {
				files: [{
					expand: true,
					cwd: '<%= config.src_path %>/_/css',
					src: ['**/*.css'],
					ext: '.css',
					dest: '<%= config.src_path %>/_/css'
				}]
			}
		},

		// USEMIN PREPARE
		// Parse html/php files and look for <!-- build --> blocks. 
		// Process each block, creating grunt config targets for concatinating and minifying
		// stylesheets and scripts. (Note this task only parses the files 
		// and creates grunt configs. You still need to call the grunt tasks (concat, uglify, etc),
		// to actually accomplish those task, as well as call the usemin task to actually update
		// references in source files to the newly created .min files).
		useminPrepare: {
			html: '<%= config.src_path %>/**/*{.html,.php,.inc}',
			options: {
				dest: '<%= config.dist_path %>',
				flow: {
					steps: {
						// Here you define your flow for your custom block - only concat
						jslib: ['concat'],
						// Note that you NEED to redefine flow for default blocks...
						// These below is default flow.
						js: ['concat', 'uglifyjs'],
						css: ['concat', 'cssmin']
					},
					// also you MUST define 'post' field to something not null
					post: {
						//Setup the cssmin task to strip comments
						css: [{
				        	name: 'cssmin',
				        	createConfig: function (context, block) {
				            	var generated = context.options.generated;
				            	generated.options = {
				            		keepSpecialComments: 0
				            	};
				          	}
				        }]
					}
				}				
			}
		},

		// USEMIN
		// After Usemin prepare has created grunt task configs, and the corresponding grunt
		// tasks have been run, this task can be run to actually update references to css/js
		// files in <!-- build --> blocks, replacing them with a single reference to the new
		// .min file.
		usemin: {
			options: {
				dirs: ['<%= config.dist_path %>'],
				blockReplacements: {
					jslib: function(block) {
						return '<script src="' + block.dest + '"></script>';
					}
				}
			},
			html: ['<%= config.dist_path %>/**/*{.html,.php,.inc}'],
			css: ['<%= config.dist_path %>/_/css/**/*.css']
		}, 

		// BROWSER SYNC
		// Configure browser sync to auto reload when stuff changes. 
		// Note you still need watch tasks to do compilation (of sass and such).
		browserSync: {
			bsFiles: {
				src: [
					'<%= config.src_path %>/_/css/**/*.css',
					'<%= config.src_path %>/_/js/**/*.js',
					'<%= config.src_path %>/_/img/**/*{.jpg,.gif,.png,.svg}',
					'<%= config.src_path %>/**/*{.html,.php,.inc}',
					'!<%= bower.directory %>/**/*', //exclude everything in bower_components
					'<%= bower.directory %>/**/*{.js,.css}', //but DO include js & css files in bower_components
				]
			},
			options: {
				watchTask: true,
				proxy: '<%= config.src_host %>',
				xip: false,
				port: 8080,
				ghostMode: true
			}
		},

		watch: {
			options: {
				dateFormat: function(ms) {
					grunt.log.writeln('Finished running tasks triggered by watch:');
					if (ms < 100) {
						grunt.log.writeln('tasks ran in ' + ms + 'ms');
					} else {
						grunt.log.writeln('tasks ran in ' + (ms / 1000) + 's');
					}

					var finishDate = new Date();

					var hour = finishDate.getHours();
					if (hour == 0) {
						hour = 12;
					} else if (hour > 12) {
						hour = hour % 12;
					}
					var strDate = hour + ":" + finishDate.getMinutes() + "." + finishDate.getSeconds();
					grunt.log.writeln('Finished at: ' + strDate);
				}
			},
			sass: {
				files: ['<%= config.src_path %>/_/sass/**/*.scss','!<%= config.src_path %>/_/sass/_lib/_bootstrap.scss'],
				tasks: ['sass', 'postcss'],
				options: {
					spawn: true,
					interrupt: true
				}
			},
			bootstrap: {
				files: ['<%= config.src_path %>/_/sass/_lib/_bootstrap.scss'],
				tasks: ['copy:bootstrap', 'hub:bootstrap'],
				options: {
					spawn: true,
					interrupt: true
				}				
			}
		}

	});



	grunt.registerTask('default', ['dev:sync']);

	grunt.registerTask('update', [
		'auto_install',
		'copy:bootstrap',
		'hub:bootstrap'
	]);

	grunt.registerTask('dev', function(opt) {

		var tasks =	[
			'copy:bootstrap',
			'hub:bootstrap',
			'clean:all', 
			'clean:dev', 
			'sass',
			'postcss'
		];

		if (opt == "sync") {
			tasks.push('browserSync');
		}
		tasks.push('watch');

		grunt.task.run(tasks);

	});

	grunt.registerTask('dist', [
		'update',
		'clean:all',
		'clean:dist', 
		'sass',
		'postcss',
		'copy:dist',
		'useminPrepare', 
		'concat:generated', 
		'cssmin:generated', 
		'uglify:generated', 
		'usemin'
	]);

};