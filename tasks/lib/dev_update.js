/*
 * grunt-dev-update
 *
 * Copyright (c) 2014 Gilad Peleg
 * Licensed under the MIT license.
 */

var async = require('async'),
    inquirer = require('inquirer'),
    _ = require('lodash'),
    findup = require('findup-sync'),
    ProgressBar = require('progress');

module.exports = function (grunt) {

    var exports = {
        options: {},
        devDeps: [],
        prodDeps: [],
        results: {}
    };

    //default spawn options
    exports.spawnOptions = {
        cmd: 'npm',
        grunt: false,
        opts: {}
    };

    exports.stats = {
        outdated: 0,
        upToDate: 0
    };

    /**
     * Get the dev dependencies packages to update from package.json
     */
    exports.getPackages = function (depArr) {
        var matchDep = require('matchdep');

        //how is package.json located
        if (exports.options.packageJson) {
            grunt.verbose.writelns('Using custom option for package.json: ' + exports.options.packageJson);
        } else {
            exports.options.packageJson = findup('package.json', {cwd:process.cwd()});
            grunt.verbose.writelns('Using matchdep\'s default findup to locate nearest package.json');
        }

        _.each(depArr, function (dep) {
            if (!dep.shouldCheck) {
                dep.deps = [];
                return;
            }

            try {
                dep.deps = matchDep[dep.matchdepFunc]('*', exports.options.packageJson);
            } catch (e) {
                //couldn't get packages... critical error
                grunt.verbose.writelns('Error ', e);
                grunt.fail.warn('Could not read from package.json', exports.options.packageJson);
                //if force
                dep.deps = [];
            }
            grunt.log.writeln('Found ' + dep.deps.length + ' ' + dep.type.blue + ' to check for latest version');
        });
    };

    /**
     * Get the spawn arguments for the action
     * @param {String} dependency
     * @param {String} phase
     * @param {String} saveType should be either --save or --save-dev
     */
    exports.getSpawnArguments = function (dependency, phase, saveType) {
        switch (phase) {
            //arguments to spawn to get local package version
        case 'local':
            return ['list', dependency, '--json', '--depth=0'];
            //arguments to spawn to get remote package version
        case 'remote':
            return ['view', dependency, 'version'];
            //arguments to spawn to update the package version
        case 'update':
            //this will force the version to install to override locks in package.json
            return ['install', dependency + '@' + exports.results[dependency].remoteVersion, saveType];
            //no action detected
        default:
            return [];
        }
    };

    /**
     * @param {String[]} packages
     * @param {Function} done callback function
     */
    exports.getLocalPackageVersion = function (packages, done) {
        /** Fetching data phase **/

        var bar = new ProgressBar('Getting local packages versions [:bar] :percent :etas', {
            total: packages.length
        });

        //loop through each pacakge
        async.each(packages, function (dep, callback) {
            //make current task arguments

            bar.tick();

            //get local spawn args
            exports.spawnOptions.args = exports.getSpawnArguments(dep, 'local');
            exports.results[dep] = {};
            grunt.util.spawn(exports.spawnOptions, function (error, result) {
                if (error) {
                    grunt.verbose.writelns(error);
                    exports.results[dep].isError = true;
                    grunt.log.writelns('Error in getting local package version of ' + dep);
                    return callback();
                }

                var localVersion;
                //insert dep into taskObject as a key with localVersion
                try {
                    localVersion = JSON.parse(result).dependencies[dep].version;
                } catch (e) {
                    grunt.verbose.writelns(e);
                    exports.results[dep].isError = true;
                    grunt.log.writelns('Error in JSON.parse of the local package info of ' + dep);
                    return callback();
                }

                exports.results[dep] = {
                    localVersion: localVersion
                };

                //success
                grunt.verbose.writelns('Got local version for package %s -> %s', dep, exports.results[dep].localVersion);
                callback();
            });
        }, done);
    };

    /**
     * @param {String[]} packages
     * @param {Function} done callback function
     */
    exports.getRemotePackageVersion = function (packages, done) {

        var bar = new ProgressBar('Getting remote packages versions [:bar] :percent :etas', {
            total: packages.length
        });

        /** Fetching data phase **/
        async.each(packages, function (dep, callback) {

            bar.tick();
            //make current task arguments
            exports.spawnOptions.args = exports.getSpawnArguments(dep, 'remote');

            grunt.util.spawn(exports.spawnOptions, function (error, result) {
                if (error) {
                    grunt.verbose.writelns(error);
                    exports.results[dep].isError = true;
                    grunt.log.writelns('Error in getting remote package version of ' + dep);
                    return callback();
                }
                grunt.verbose.writelns('Got remote version for package %s -> %s', dep, result.stdout);
                exports.results[dep].remoteVersion = result.stdout;

                //version is the same
                if (result.stdout === exports.results[dep].localVersion) {
                    ++exports.stats.upToDate;
                    exports.results[dep].atLatest = true;
                }
                //version is outdated
                else {
                    ++exports.stats.outdated;
                }

                callback();
            });
        }, done);
    };

    /**
     * Process a package according to option updateType
     * @param {String[]} packages
     * @param {String} saveType
     * @param {Function} done callback function
     */
    exports.processByUpdateType = function (packages, saveType, done) {
        /** Update phase **/
        async.eachSeries(packages, function (dep, callback) {
            var currentDep = exports.results[dep];

            //package is updated
            if (currentDep.atLatest || currentDep.isError) {
                var logMethod = exports.options.reportUpdated ? grunt.log.oklns : grunt.verbose.oklns;
                logMethod('Package %s is at latest version %s', dep, currentDep.localVersion);
                return callback();
            }

            //log about out of date package
            grunt.log.subhead('package %s is outdated.\nLocal version: %s, Latest version %s',
                dep, exports.results[dep].localVersion, exports.results[dep].remoteVersion);

            //only report outdated, do nothing
            if (exports.options.updateType === 'report') {
                return callback();
            }

            //prompt user if package should be updated
            if (exports.options.updateType === 'prompt') {
                //prompt to update
                var msg = 'update using [npm ' + exports.getSpawnArguments(dep, 'update', saveType).join(' ') + ']';
                inquirer.prompt({
                    name: 'confirm',
                    message: msg,
                    default: false,
                    type: 'confirm'
                }, function (result) {
                    if (result.confirm) {
                        return exports.updatePackage(dep, saveType, callback);
                    }
                    callback();
                });

                return;
            }

            //force package update
            if (exports.options.updateType === 'force') {
                //update without asking user
                exports.updatePackage(dep, saveType, callback);
                return;
            }

            //bad option?
            return callback();
        }, done);
    };

    /**
     * Update a package using npm install %package% %saveType%
     * @param {String} dep
     * @param {String} saveType
     * @param {Function} done callback function
     */
    exports.updatePackage = function (dep, saveType, done) {
        //assign args
        exports.spawnOptions.args = exports.getSpawnArguments(dep, 'update', saveType);
        exports.spawnOptions.opts = {
            stdio: 'inherit'
        };

        grunt.util.spawn(exports.spawnOptions, function (error) {
            if (error) {
                grunt.verbose.writelns(error);
                grunt.log.writelns('Error while updating package ' + dep);
                return done();
            }

            grunt.log.oklns('Successfully updated package ' + dep);
            return done();
        });
    };

    exports.runTask = function (done) {
        var devDeps, prodDeps;

        devDeps = {
            type: 'devDependencies',
            shouldCheck: exports.options.packages.devDependencies,
            matchdepFunc: 'filterDev',
            saveType: '--save-dev'
        };

        prodDeps = {
            type: 'dependencies',
            shouldCheck: exports.options.packages.dependencies,
            matchdepFunc: 'filter',
            saveType: '--save'
        };

        //get the production and/or dev dependencies using matchdep
        exports.getPackages([devDeps, prodDeps]);

        //go through each package type
        async.eachSeries([devDeps, prodDeps], function (pkgObj, callback) {
            //user hasn't enabled this package check
            if (!pkgObj.shouldCheck) {
                return callback();
            }

            //there are no packages to check
            if (!pkgObj.deps.length) {
                grunt.log.oklns('Found 0 %s packages', pkgObj.type);
                return callback();
            }

            grunt.log.subhead('Going through ' + pkgObj.type.blue + ' packages');

            //if we got here - assume we should check it, and there are packages to check
            async.series([

                function (innerCb) {
                    //get local packages version
                    exports.getLocalPackageVersion(pkgObj.deps, innerCb);
                },
                function (innerCb) {
                    exports.getRemotePackageVersion(pkgObj.deps, innerCb);
                },
                function (innerCb) {
                    exports.processByUpdateType(pkgObj.deps, pkgObj.saveType, innerCb);
                }
            ], function (err) {
                if (err) {
                    grunt.fail.fatal('Task failed due to ', err);
                }

                grunt.log.oklns('Found ' + pkgObj.deps.length + ' ' + pkgObj.type.blue + '. ' +
                    exports.stats.upToDate + ' up-to-date. ' + (exports.stats.outdated + ' outdated').cyan);

                //TODO keep results seperately
                //reset results before next round
                exports.results = {};

                //reset stats
                exports.stats = {
                    outdated: 0,
                    upToDate: 0
                };

                return callback();
            });
        }, done);
    };

    return exports;
};
