/*
 * grunt-dev-update
 *
 *
 * Copyright (c) 2013 Gilad Peleg
 * Licensed under the MIT license.
 */

var async = require('async'),
    _ = require('lodash'),
    inquirer = require("inquirer"),
    path = require('path'),
    ProgressBar = require('progress');

module.exports = function (grunt) {

    var exports = {
        options: {},
        devDeps: [],
        results: {}
    };

    //default spawn options
    exports.spawnOptions = {
        cmd  : 'npm',
        grunt: false,
        opts : {}
    };

    exports.stats = {
        outdated: 0,
        upToDate: 0
    };

    /**
     * Get the dev dependencies packages to update from package.json
     */
    exports.getDevPackages = function () {
        //TODO add package.json route to options
        var packagePath = path.join(process.cwd(), 'package.json');
        grunt.verbose.writelns('Using path for package.json: ' + packagePath);
        exports.devDeps = require('matchdep').filterDev('*', packagePath);
        grunt.log.writeln('Found %s devDependencies to check for latest version', exports.devDeps.length);
    };

    exports.getSpawnArguments = function (devDep, phase) {
        switch (phase) {
            case 'local':
                return ['list', devDep, '--json', '--depth=1'];
                break;

            case  'remote':
                return ['view', devDep, 'version'];
                break;

            case 'update':
                return ['install', devDep, '--save-dev'];
                break;
        }
        return [];
    };

    /**
     * @param {String[]} packages
     * @param {Function} done callback function
     */
    exports.getLocalPackageVersion = function (packages, done) {
        /** Fetching data phase **/

        var bar = new ProgressBar('Getting local packages versions [:bar] :percent :etas', { total: packages.length });

        async.each(packages,
            function (devDep, callback) {
                //make current task arguments

                bar.tick();

                exports.spawnOptions.args = exports.getSpawnArguments(devDep, 'local');
                exports.results[devDep] = {};

                grunt.util.spawn(exports.spawnOptions, function (error, result, code) {
                    if (error) {
                        grunt.verbose.writelns(error);
                        exports.results[devDep].isError = true;
                        grunt.log.writelns('Error in getting local package version of ' + devDep);
                        callback();
                        return;
                    }

                    var localVersion;
                    //insert devDep into taskObject as a key with localVersion
                    try {
                        localVersion = JSON.parse(result).dependencies[devDep].version;
                    }
                    catch (e) {
                        grunt.verbose.writelns(e);
                        exports.results[devDep].isError = true;
                        grunt.log.writelns('Error in JSON.parse of the local package info of ' + devDep);
                        callback();
                        return;
                    }

                    exports.results[devDep] = {
                        localVersion: localVersion
                    };

                    //success
                    grunt.verbose.writelns('Got local version for package %s -> %s', devDep, exports.results[devDep].localVersion);
                    callback();
                });
            }, done);
    };

    /**
     * @param {String[]} packages
     * @param {Function} done callback function
     */
    exports.getRemotePackageVersion = function (packages, done) {

        var bar = new ProgressBar('Getting remote packages versions [:bar] :percent :etas', { total: packages.length });

        /** Fetching data phase **/
        async.each(packages,
            function (devDep, callback) {

                bar.tick();
                //make current task arguments
                exports.spawnOptions.args = exports.getSpawnArguments(devDep, 'remote');

                grunt.util.spawn(exports.spawnOptions, function (error, result, code) {
                    if (error) {
                        grunt.verbose.writelns(error);
                        exports.results[devDep].isError = true;
                        grunt.log.writelns('Error in getting remote package version of ' + devDep);
                        callback();
                        return;
                    }
                    grunt.verbose.writelns('Got remote version for package %s -> %s', devDep, result.stdout);
                    exports.results[devDep].remoteVersion = result.stdout;

                    //version is the same
                    if (result.stdout === exports.results[devDep].localVersion) {
                        ++exports.stats.upToDate;
                        var logMethod = exports.options.reportUpdated ? grunt.log.oklns : grunt.verbose.oklns;
                        logMethod('Package %s is at latest version %s', devDep, result.stdout);
                        exports.results[devDep].atLatest = true;
                    }
                    //version is outdated
                    else {
                        grunt.log.subhead('package %s is outdated.\nLocal version: %s, Latest version %s',
                            devDep, exports.results[devDep].localVersion, exports.results[devDep].remoteVersion);
                        ++exports.stats.outdated;
                    }

                    callback();

                });
            }, done);
    };

    /**
     * Process a package according to option updateType
     * @param {String[]} packages
     * @param {Function} done callback function
     */
    exports.processByUpdateType = function (packages, done) {
        /** Update phase **/
        async.eachSeries(packages, function (devDep, callback) {
            var currentDep = exports.results[devDep];

            if (currentDep.atLatest || currentDep.isError) {
                callback();
                return;
            }

            if (exports.options.updateType === 'report') {
                callback();
            }
            else if (exports.options.updateType === 'prompt') {
                var msg = 'update using [npm install ' + devDep + ' --save-dev]';
                inquirer.prompt({ name: 'confirm', message: msg, type: "confirm" }, function (result) {
                    if (result.confirm) {
                        exports.updatePackage(devDep, callback);
                        return;
                    }
                    callback();
                });
            }
            else if (exports.options.updateType === 'force') {
                exports.updatePackage(devDep, callback);
            }
        }, done);
    };

    /**
     * Update a package using npm install %package% --save-dev
     * @param {String} devDep
     * @param {Function} done callback function
     */
    exports.updatePackage = function (devDep, done) {
        exports.spawnOptions.args = exports.getSpawnArguments(devDep, 'update');
        exports.spawnOptions.opts = {stdio: 'inherit'};
        grunt.util.spawn(exports.spawnOptions, function (error, result, code) {
            if (error) {
                grunt.verbose.writelns(error);
                grunt.log.writelns('Error while updating package ' + devDep);
                done();
                return;
            }

            grunt.log.oklns('Successfully updated package ' + devDep);
            done();
        });
    };

    exports.runTask = function (done) {
        async.series([
            function (callback) {
                //get the dev dependencies using matchdep
                exports.getDevPackages();
                //get local packages version
                exports.getLocalPackageVersion(exports.devDeps, callback);
            },

            function (callback) {
                exports.getRemotePackageVersion(exports.devDeps, callback);
            },

            function (callback) {
                exports.processByUpdateType(exports.devDeps, callback);
            }

        ], function (err) {
            if (err) {
                grunt.log.error('Task failed due to error', err);
            }

            grunt.log.oklns('Found %s devDependencies. %s up-to-date, %s outdated', exports.devDeps.length, exports.stats.upToDate, exports.stats.outdated);
            done();
        });
    };

    return exports;
};