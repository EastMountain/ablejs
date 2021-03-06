/**
 * A grunt task that for project patch.
 */

module.exports = function(grunt) {
    'use strict';

    // node libs.
    var fs = require('fs');
    var path = require('path');

    // external libs.
    var mkdirp = require('mkdirp');

    // internal libs.
    var log = require('../utils/log');
    var file = require('../utils/file');
    var profileUtil = require('../common/profile');
    var dependency = require('../common/dependency');

    // task for patch.
    grunt.registerTask('patch', 'task for project patch', function() {

        // Force task into async mode and grab a handle to the "done" function.
        var done = this.async();
        var options = this.options();
        var patchdir = this.args[0];

        if (!file.isDir(patchdir)) {
            log.error(patchdir + ' must be a directory!');
            return done();
        }

        var changedFiles = {};

        var ROOTDIR_IMG = options.root.img,
            ROOTDIR_CSS = options.root.css,
            ROOTDIR_JS = options.root.js,
            ROOTDIR_JSP = options.root.jsp;

        var TARGET_IMG_CWD = grunt.config('optiimg.files.cwd'),
            TARGET_CSS_CWD = grunt.config('opticss.files.cwd'),
            TARGET_JS_CWD = grunt.config('optijs.files.cwd'),
            TARGET_JSP_CWD = grunt.config('optijsp.files.cwd');

        changedFiles[ROOTDIR_IMG] = [];
        changedFiles[ROOTDIR_CSS] = [];
        changedFiles[ROOTDIR_JS] = [];
        changedFiles[ROOTDIR_JSP] = [];

        /**
         * @param  {String} rootdir    "the target root dir."
         * @param  {String} patchDirId "if patch file directory like 'images.market.common', patchDirId will be 'market/common'"
         * @param  {String} patchFile  "the real patch file path in the os."
         */
        function copyPatchFileToSourceDir(rootdir, patchDirId, patchFile) {
            var targetBaseDir = '';
            var targetPatchDirPath;
            var destFile;

            switch (rootdir) {
                case ROOTDIR_IMG:
                    targetBaseDir = TARGET_IMG_CWD;
                    break;
                case ROOTDIR_CSS:
                    targetBaseDir = TARGET_CSS_CWD;
                    break;
                case ROOTDIR_JS:
                    targetBaseDir = TARGET_JS_CWD;
                    break;
                case ROOTDIR_JSP:
                    targetBaseDir = TARGET_JSP_CWD;
                    break;
            }

            if (targetBaseDir) {
                targetPatchDirPath = path.join(targetBaseDir, patchDirId);
                mkdirp.sync(targetPatchDirPath);

                destFile = path.join(targetPatchDirPath, path.basename(patchFile));
                file.copy(patchFile, destFile);
            }
        }

        function getDependsRootdir(identifier) {
            var extname = path.extname(identifier).replace(/^\./, '');
            var rootdir;

            switch (extname) {
                case 'gif':
                case 'png':
                case 'jpg':
                case 'jpeg':
                    rootdir = ROOTDIR_IMG;
                    break;
                case 'css':
                    rootdir = ROOTDIR_CSS;
                    break;
                case 'js':
                    rootdir = ROOTDIR_JS;
                    break;
                case 'jsp':
                    rootdir = ROOTDIR_JSP;
                    break;
            }

            return rootdir;
        }

        function processDependons() {
            // process order: images --> css --> js
            // there's no files depends on jsp.
            [ROOTDIR_IMG, ROOTDIR_CSS, ROOTDIR_JS].forEach(function(key) {
                changedFiles[key].forEach(function(ele, index, array) {
                    var dependons = dependency.backtrace(ele);

                    for (var i = dependons.length - 1; i >= 0; i--) {
                        changedFiles[getDependsRootdir(dependons[i])].push(dependons[i]);
                    }
                });
            });
        }

        // for concat task.
        function getConcatTaskConfig() {
            var cssBaseDir = grunt.config('opticss.files.cwd');
            var jsBaseDir = grunt.config('optijs.files.cwd');
            var cssObj = profileUtil.getConcatFiles('css', cssBaseDir);
            var jsObj = profileUtil.getConcatFiles('js', jsBaseDir);

            var toConcatCSS = {};
            var toConcatJS = {};

            function findToConcatFiles(basedir, rootdir, toConcat, obj) {
                changedFiles[rootdir].forEach(function(element, index, array) {
                    for (var i in obj) {
                        if (toConcat[i] === undefined && obj[i].indexOf(path.join(basedir, element)) > -1) {
                            toConcat[i] = obj[i];
                            break;
                        }
                    }
                });
            }

            findToConcatFiles(cssBaseDir, ROOTDIR_CSS, toConcatCSS, cssObj);
            findToConcatFiles(jsBaseDir, ROOTDIR_JS, toConcatJS, jsObj);

            return {
                css: toConcatCSS,
                js: toConcatJS
            };
        }

        fs.readdir(patchdir, function(err, files) {
            if (err) {
                log.error(err.message);
            }

            var runTasksList = ['clean'];
            var jsBaseDir = grunt.config('optijs.files.cwd');

            files.forEach(function(ele, index, array) {
                var filePath = path.join(patchdir, ele);
                var rootDir;
                var relpath;

                if (file.isDir(filePath)) {
                    relpath = ele.split('.').slice(1).join('/');
                    rootDir = ele.split('.')[0];

                    if (Object.keys(changedFiles).indexOf(rootDir) > -1) {
                        changedFiles[rootDir] = changedFiles[rootDir].concat(fs.readdirSync(filePath).map(function(element) {
                            copyPatchFileToSourceDir(rootDir, relpath, path.join(filePath, element));

                            return path.join(relpath, element);
                        }));
                    }
                }
            });

            processDependons();

            var concatConfig = getConcatTaskConfig();
            var cssCount = Object.keys(concatConfig.css).length;
            var jsCount = Object.keys(concatConfig.js).length;

            if (cssCount > 0 || jsCount > 0) {
                grunt.config('concat.css.files', cssCount > 0 ? concatConfig.css : []);
                grunt.config('concat.js.files', jsCount > 0 ? concatConfig.js : []);

                runTasksList.push('concat');
            }

            for (var i in changedFiles) {
                if (changedFiles[i].length > 0) {
                    switch (i) {
                        case ROOTDIR_IMG:
                            grunt.config('optiimg.files.src', changedFiles[ROOTDIR_IMG]);
                            runTasksList.push('optiimg');
                            break;
                        case ROOTDIR_CSS:
                            grunt.config('opticss.files.src', changedFiles[ROOTDIR_CSS]);
                            runTasksList.push('opticss');
                            break;
                        case ROOTDIR_JS:
                            grunt.config('optijs.files.src', changedFiles[ROOTDIR_JS]);

                            if (options.jshint === true) {
                                grunt.config('jshint.project.src', changedFiles[ROOTDIR_JS].concat([]).map(function(ele) {
                                    return path.join(jsBaseDir, ele);
                                }));

                                runTasksList.push('jshint:project');
                            }

                            runTasksList.push('optijs');
                            break;
                        case ROOTDIR_JSP:
                            grunt.config('optijsp.files.src', changedFiles[ROOTDIR_JSP]);
                            runTasksList.push('optijsp');
                            break;
                    }
                }
            }

            runTasksList.push('shell');
            runTasksList.push('chrono');

            grunt.task.run(runTasksList);

            done();
        });

    });
};