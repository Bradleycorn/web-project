module.exports = function(grunt) {

	require('load-grunt-tasks')(grunt);

	var bowerConf = grunt.file.readJSON('.bowerrc');

	grunt.initConfig({

		bower: bowerConf,

		// AUTO INSTALL
		// Run npm install and bower install
		// The "this" task will run them on this project
		// Add additional targets to run them on child-projects as needed.
		auto_install: {
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
	});

	grunt.registerTask('default', 			['all'] );
	grunt.registerTask('update', 			['auto_install'] );
	grunt.registerTask('build', 			['hub:bootstrap'] );
	grunt.registerTask('all', 				['update', 'build'] );
};