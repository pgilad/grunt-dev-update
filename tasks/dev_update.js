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
        devUpdate.options = this.options({
            //just report
            updateType: 'report',
            //don't report ok packages by default
            reportUpdated: false,
            semver: true,
            //what packages to check
            packages: {
                //only devDependencies by default
                devDependencies: true,
                dependencies: false
            },
            //by deafult - use matchdep default findup to locate package.json
            packageJson: null
        });

        grunt.verbose.writelns('Processing target: ' + this.target);

        //validate updateType option
        var updateType = devUpdate.options.updateType;
        if (!_.contains(possibleUpdateTypes, updateType)) {
            grunt.fail.warn('updateType ' + String(updateType).cyan + ' not supported.');
            //if force
            devUpdate.options.updateType = 'report';
        }

        if (updateType === 'force') {
            //warn user for using force option
            grunt.log.writelns('Running with update type of ' + 'force'.red);
        }

        var _pkgjson = devUpdate.options.packageJson;
        //use packageJson option as string, but file doesn't exist.
        if (typeof _pkgjson === 'string') {
            //path supplied is relative to process.cwd()
            _pkgjson = path.resolve(process.cwd(), _pkgjson);

            if (!grunt.file.exists(_pkgjson)) {
                grunt.fail.warn('Cannot locate package.json in supplied path ' + _pkgjson);
                //if force
                devUpdate.options.packageJson = null;
            } else {
                //update option to reflect change
                devUpdate.options.packageJson = _pkgjson;
            }
        }
        //run task
        devUpdate.runTask(this.async());
    });
};
