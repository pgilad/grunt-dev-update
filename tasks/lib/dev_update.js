/*
 * grunt-dev-update
 *
 * Copyright (c) 2014 Gilad Peleg
 * Licensed under the MIT license.
 */

var each = require('async-each-series'),
    inquirer = require('inquirer'),
    _ = require('lodash'),
    findup = require('findup-sync');

module.exports = function (grunt) {

    var exports = {
        options: {},
    };

    //default spawn options
    var spawnOptions = {
        cmd: 'npm',
        grunt: false,
        opts: {}
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
                    installType: dep.installType,
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
        case 'update':
            return ['update', dependency];
        case 'install':
            //this will force the version to install to override locks in package.json
            return ['install', dependency + '@latest', saveType];
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

    var processByUpdateType = function (pkg, specs, done) {
        /** Update phase **/
        grunt.log.subhead('Package name\t: %s', pkg.name);
        grunt.log.writelns('Package type\t: %s', pkg.type);
        grunt.log.writelns('Current version\t: %s', specs.current.green);
        grunt.log.writelns('Wanted version\t: %s', specs.wanted);
        grunt.log.writelns('Latest version\t: %s', specs.latest.red);

        //only report outdated, do nothing
        if (exports.options.updateType === 'report') {
            return done();
        }
        var updateType = exports.options.semver ? 'update' : 'install';
        var spawnArgs = getSpawnArguments(pkg.name, updateType, pkg.installType);

        //prompt user if package should be updated
        if (exports.options.updateType === 'prompt') {
            //prompt to update
            var msg = 'update using [npm ' + spawnArgs.join(' ') + ']';
            return inquirer.prompt({
                name: 'confirm',
                message: msg,
                default: false,
                type: 'confirm'
            }, function (result) {
                if (result.confirm) {
                    //user accepted update
                    return exports.updatePackage(spawnArgs, done);
                } else {
                    return done();
                }
            });
        }
        //force package update
        if (exports.options.updateType === 'force') {
            //update without asking user
            return exports.updatePackage(spawnArgs, done);
        }

        //shouldn't get here but just in case
        return done();
    };

    exports.updatePackage = function (spawnArgs, done) {
        //assign args
        spawnOptions.args = spawnArgs;
        spawnOptions.opts = {
            stdio: 'inherit'
        };
        grunt.util.spawn(spawnOptions, function (error) {
            if (error) {
                grunt.verbose.writelns(error);
                grunt.log.writelns('Error while running ' + spawnArgs);
                return done();
            }
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
            each(outdated, function (pkgName, cb) {
                var pkg = _.findWhere(packages, {
                    name: pkgName
                });
                var specs = result[pkgName];
                return processByUpdateType(pkg, specs, cb);
            }, done);
        });
    };

    return exports;
};
