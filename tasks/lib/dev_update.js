/*
 * grunt-dev-update
 *
 * Copyright (c) 2014 Gilad Peleg
 * Licensed under the MIT license.
 */

var async = require('async'),
    inquirer = require('inquirer'),
    _ = require('lodash'),
    findup = require('findup-sync');

module.exports = function (grunt) {

    var exports = {
        options: {},
        devDeps: [],
        prodDeps: [],
        results: {}
    };

    //default spawn options
    var spawnOptions = {
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
    var getPackageNames = function (packages) {
        //how is package.json located
        if (exports.options.packageJson) {
            grunt.verbose.writelns('Using custom option for package.json: ' + exports.options.packageJson);
        } else {
            exports.options.packageJson = findup('package.json', {
                cwd: process.cwd()
            });
        }

        try {
            //load package json
            var pkg = require(exports.options.packageJson);
        } catch (e) {
            //couldn't get packages... critical error
            grunt.verbose.writelns('Error ', e);
            grunt.fail.fatal('Could not read from package.json', exports.options.packageJson);
        }

        var _packages = _.map(packages, function (dep) {
            dep.deps = pkg[dep.type];
            grunt.log.writeln('Found ' + _.keys(dep.deps).length + ' ' + dep.type.blue + ' to check for latest version');
            return _.map(dep.deps, function (item, key) {
                return {
                    name: key,
                    type: dep.type
                };
            });
        });

        return _.flatten(_packages);
    };

    /**
     * Get the spawn arguments for the action
     * @param {String} dependency
     * @param {String} phase
     * @param {String} saveType should be either --save or --save-dev
     */
    var getSpawnArguments = function (dependency, phase, saveType) {
        switch (phase) {
        case 'outdated':
            return ['outdated', '--json', '--depth=0'];
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

    var getOutdatedPkgs = function (packages, done) {
        var pkgNames = _.pluck(packages, 'name');
        spawnOptions.args = getSpawnArguments(null, 'outdated').concat(pkgNames);
        grunt.util.spawn(spawnOptions, function (error, result) {
            if (error) {
                grunt.verbose.writelns(error);
                grunt.fail.fatal('Task failed due to ', error);
                return done(error);
            }
            var jsonResults;
            try {
                jsonResults = JSON.parse(result.stdout);
            } catch (e) {
                grunt.fail.fatal('Task failed with JSON.parse due to ', e);
            }
            return done(null, jsonResults);
        });
    };

    /**
     * Process a package according to option updateType
     * @param {String[]} packages
     * @param {String} saveType
     * @param {Function} done callback function
     */
    var processByUpdateType = function (packageInfo, packages, done) {
        /** Update phase **/
        //log about out of date package
        //
        //
        console.log('Filename: dev_update.js', 'Line: 126', 'package, options:',  packageInfo, packages);
        return done();
        grunt.log.subhead('package %s is outdated.\nLocal version: %s, Latest version %s',
            dep, exports.results[dep].localVersion, exports.results[dep].remoteVersion);

        //only report outdated, do nothing
        if (exports.options.updateType === 'report') {
            return callback();
        }

        //prompt user if package should be updated
        if (exports.options.updateType === 'prompt') {
            //prompt to update
            var msg = 'update using [npm ' + getSpawnArguments(dep, 'update', saveType).join(' ') + ']';
            inquirer.prompt({
                name: 'confirm',
                message: msg,
                default: false,
                type: 'confirm'
            }, function (result) {
                if (result.confirm) {
                    return exports.updatePackage(dep, saveType, done);
                }
                return callback();
            });
            return;
        }
        //force package update
        if (exports.options.updateType === 'force') {
            //update without asking user
            return exports.updatePackage(dep, saveType, done);
        }
    };

    /**
     * Update a package using npm install %package% %saveType%
     * @param {String} dep
     * @param {String} saveType
     * @param {Function} done callback function
     */
    exports.updatePackage = function (dep, saveType, done) {
        //assign args
        spawnOptions.args = getSpawnArguments(dep, 'update', saveType);
        spawnOptions.opts = {
            stdio: 'inherit'
        };
        grunt.util.spawn(spawnOptions, function (error) {
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
            installType: '--save-dev'
        };
        prodDeps = {
            type: 'dependencies',
            shouldCheck: exports.options.packages.dependencies,
            installType: '--save'
        };

        //get only the kind of packages user wants
        var packageTypes = _.filter([devDeps, prodDeps], 'shouldCheck');
        if (!packageTypes || !packageTypes.length) {
            return done();
        }

        //get the package names
        var packages = getPackageNames(packageTypes);
        //no pacakges to check
        if (!packages || !packages.length) {
            return done();
        }

        getOutdatedPkgs(packages, function (err, result) {
            var outdated = _.keys(result);
            async.each(outdated, function (item, cb) {
                return processByUpdateType(result[item], packages, cb);
            }, done);
        });
    };

    return exports;
};
