/**
 * A grunt task that minify js files by using node package "uglify-js"
 * UglifyJS: https://npmjs.org/package/uglify-js
 */

module.exports = function(grunt) {
	'use strict';

	// External libs.
	var path = require('path');
	var fs = require('fs');

	// Internal libs.
	var file = require('../lib/utils/file');
	
	grunt.registerMultiTask('uglifyJS', 'Minify JS files', function() {
		var options = this.options({
			banner: '',
			footer: '',
			compress: {
				warnings: false
			},
			mangle: {},
			beautify: false,
			report: false
		});

		this.files.forEach(function(element, i, array) {
			array = element.src.filter(function(filepath) {
				if (!grunt.file.exists(filepath)) {
					grunt.log.warn('Source file "' + filepath + '" not found.');
					return false;
				} else {
					return true;
				}
			});

			var minified = array.map(function(filename) {
				return require("uglify-js").minify(fs.readFileSync(filename, 'utf8'), {
					fromString: true
				});
			}).join('');

			if (minified.length < 1) {
				grunt.log.warn('Destination not written because minified JS was empty.');
			} else {
				if (options.banner) {
					minified = options.banner + minified;
				}

				file.write(element.dest, minified, 'utf8');
				grunt.log.writeln('Compressed JS File: ' + element.dest);
			}
		});
	});

};

