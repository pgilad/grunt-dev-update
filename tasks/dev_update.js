/*
 * grunt-dev-update
 *
 * Copyright (c) 2014 Gilad Peleg
 * Licensed under the MIT license.
 */

var _ = require('lodash');
var path = require('path');

module.exports = function (grunt) {

    var devUpdate = require('./lib/dev_update')(grunt);
    var possibleUpdateTypes = ['report', 'force', 'prompt', 'fail'];

    grunt.registerMultiTask('devUpdate', 'See your outdated devDependencies and update them', function () {

        //set default options
        var options = this.options({
            updateType: 'report', //just report outdated packages
            reportUpdated: false, //don't report up-to-date packages
            semver: true, //stay within semver when updating
            packages: {
                devDependencies: true, //only check for devDependencies
                dependencies: false
            },
            packageJson: null, //use matchdep default findup to locate package.json
            reportOnlyPkgs: [] //use updateType action on all packages
        });

        grunt.verbose.writelns('Processing target: ' + this.target);

        //validate updateType option
        var updateType = options.updateType;
        if (!_.contains(possibleUpdateTypes, updateType)) {
            grunt.warn('updateType ' + String(updateType).cyan + ' not supported.');
            //if force
            options.updateType = 'report';
        }

        if (updateType === 'force') {
            //warn user for using force option
            grunt.log.writelns('Running with update type of ' + 'force'.red);
        }

        if (!Array.isArray(options.reportOnlyPkgs)) {
            grunt.warn('ignoredPackages must be an array.', 3);
            //if force
            options.reportOnlyPkgs = [];
        }

        var _pkgjson = options.packageJson;
        //use packageJson option as string, but file doesn't exist.
        if (typeof _pkgjson === 'string') {
            //path supplied is relative to process.cwd()
            _pkgjson = path.resolve(process.cwd(), _pkgjson);

            if (!grunt.file.exists(_pkgjson)) {
                grunt.warn('Cannot locate package.json in supplied path ' + _pkgjson);
                //if force
                options.packageJson = null;
            } else {
                //update option to reflect change
                options.packageJson = _pkgjson;
            }
        }
        //run task
        devUpdate.runTask(options, this.async());
    });
};
