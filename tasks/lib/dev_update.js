/*
 * grunt-dev-update
 *
 * Copyright (c) 2014 Gilad Peleg
 * Licensed under the MIT license.
 */

var asyncEach = require('async-each-series');
var inquirer = require('inquirer');
var _ = require('lodash');
var findup = require('findup-sync');

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

    var getPackageJson = function () {
        //how is package.json located
        if (exports.options.packageJson) {
            grunt.verbose.writelns('Using custom option for package.json: ' + exports.options.packageJson);
        } else {
            exports.options.packageJson = findup('package.json', {
                cwd: process.cwd()
            });
        }
    };

    /**
     * Get the dev dependencies packages to update from package.json
     */
    var getPackageNames = function (packages) {
        getPackageJson();
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
                grunt.fatal('Task failed due to ' + error);
                return done(error);
            }
            if (!result || !result.stdout) {
                return done();
            }
            var jsonResults;
            try {
                jsonResults = JSON.parse(result.stdout);
            } catch (e) {
                grunt.fatal('Task failed with JSON.parse due to ' + e);
            }
            return done(null, jsonResults);
        });
    };

    var shouldOnlyReport = function (reportOnlyPkgs, pkgName) {
        return reportOnlyPkgs.length && _.contains(reportOnlyPkgs, pkgName);
    };

    var processByUpdateType = function (pkg, specs, done) {
        /** Update phase **/
        grunt.log.subhead('Package name\t:', pkg.name);
        grunt.log.writelns('Package type\t:', pkg.type);
        grunt.log.writelns('Current version\t:', specs.current.green);
        grunt.log.writelns('Wanted version\t:', specs.wanted);
        grunt.log.writelns('Latest version\t:', specs.latest.red);

        var updateType = exports.options.updateType;
        if (exports.options.semver && specs.current === specs.wanted) {
            grunt.log.ok('Package is up to date');
            return done();
        }
        if (updateType === 'fail') {
            grunt.warn('Found an outdated package: ' + String(pkg.name).underline + '.', 3);
        }
        if (updateType === 'report') {
            return done();
        }
        if (shouldOnlyReport(exports.options.reportOnlyPkgs, pkg.name)) {
            return done();
        }
        var spawnArgs = getSpawnArguments(
            pkg.name,
            exports.options.semver ? 'update' : 'install',
            pkg.installType
        );

        //force package update
        if (updateType === 'force') {
            //update without asking user
            return exports.updatePackage(spawnArgs, done);
        }
        //assume updateType === 'prompt'
        var msg = 'update using [npm ' + spawnArgs.join(' ') + ']';
        return inquirer.prompt({
            name: 'confirm',
            message: msg,
            default: false,
            type: 'confirm'
        }, function (result) {
            if (!result.confirm) {
                return done;
            }
            //user accepted update
            exports.updatePackage(spawnArgs, done);
        });
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
            if (!result) {
                grunt.log.oklns('All packages are up to date');
                return done();
            }
            asyncEach(_.keys(result), function (pkgName, cb) {
                var pkg = _.findWhere(packages, {
                    name: pkgName
                });
                var specs = result[pkgName];
                processByUpdateType(pkg, specs, cb);
            }, done);
        });
    };

    return exports;
};

