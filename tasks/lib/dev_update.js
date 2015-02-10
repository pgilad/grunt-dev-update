/*
 * grunt-dev-update
 *
 * Copyright (c) 2014 Gilad Peleg
 * Licensed under the MIT license.
 */

var asyncEach = require('async-each-series');
var semver = require('semver');
var _ = require('lodash');
var findup = require('findup-sync');
var npa = require('npm-package-arg');

//default spawn options
var spawnOptions = {
    cmd: 'npm',
    grunt: false,
    opts: {}
};

var shouldOnlyReport = function (reportOnlyPkgs, pkgName) {
    return reportOnlyPkgs.length && _.contains(reportOnlyPkgs, pkgName);
};

/**
 * Get the spawn arguments for the action
 * @param {String} phase
 * @param {String} dependency
 * @param {String} saveType should be either --save or --save-dev
 */
var getSpawnArguments = function (phase, dependency, saveType) {
    switch (phase) {
    case 'outdated':
        return ['outdated', '--json', '--depth=0'];
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

var devDeps = {
    type: 'devDependencies',
    installType: '--save-dev'
};

var prodDeps = {
    type: 'dependencies',
    installType: '--save'
};

module.exports = function (grunt) {
    var exports = {
        options: {},
    };

    var getPkgJsonPath = function () {
        //how is package.json located
        if (exports.options.packageJson) {
            grunt.verbose.writelns('Using custom option for package.json: ' + exports.options.packageJson);
            return exports.options.packageJson;
        } else {
            return findup('package.json', {
                cwd: process.cwd()
            });
        }
    };

    var getPackageJson = function (from) {
        var pkg;
        try {
            //load package json
            pkg = require(from);
        } catch (e) {
            //couldn't get packages... critical error
            grunt.verbose.writelns('Error ', e);
            grunt.fail.fatal('Could not read from package.json', from);
        }
        return pkg;
    };

    /**
     * Get the dev dependencies packages to update from package.json
     */
    var getPackageNames = function (packages) {
        var pkg = getPackageJson(getPkgJsonPath());
        var mappedPkgs = [];
        _.each(packages, function (dep) {
            //get packages by type from package.json
            dep.deps = pkg[dep.type];
            grunt.log.writeln('Found ' + _.keys(dep.deps).length + ' ' + dep.type.blue + ' to check for latest version');
            _.each(dep.deps, function (item, key) {
                var parsed = npa(key + '@' + item);
                grunt.verbose.writelns('Parsed package:', key, parsed);
                if (!_.contains(['version', 'tag', 'range'], parsed.type)) {
                    grunt.verbose.writelns(key.red + ' - doesn\'t seem local to npm. Skipping...');
                    return null;
                }
                mappedPkgs.push({
                    name: key,
                    installType: dep.installType,
                    type: dep.type
                });
            });
        });
        return mappedPkgs;
    };

    var getOutdatedPkgs = function (packages, done) {
        var pkgNames = _.pluck(packages, 'name');
        spawnOptions.args = getSpawnArguments('outdated').concat(pkgNames);
        spawnOptions.opts = {};
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

    var processByUpdateType = function (pkg, specs, done) {
        /** Update phase **/
        grunt.log.subhead('Package name\t:', pkg.name);
        grunt.log.writelns('Package type\t:', pkg.type);
        grunt.log.writelns('Current version\t:', specs.current && specs.current.green || '<not installed>');
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
            exports.options.semver ? 'update' : 'install',
            pkg.name,
            pkg.installType
        );

        //force package update
        if (updateType === 'force') {
            //update without asking user
            return updatePackage(spawnArgs, done);
        }
        //assume updateType === 'prompt'
        var msg = 'update using [npm ' + spawnArgs.join(' ') + ']';
        return require('inquirer').prompt({
            name: 'confirm',
            message: msg,
            default: false,
            type: 'confirm'
        }, function (result) {
            if (!result.confirm) {
                return done;
            }
            //user accepted update
            updatePackage(spawnArgs, done);
        });
    };

    var updatePackage = function (spawnArgs, done) {
        //assign args
        spawnOptions.args = spawnArgs;
        spawnOptions.opts = {
            stdio: 'inherit'
        };
        grunt.util.spawn(spawnOptions, function (error) {
            if (error) {
                grunt.verbose.writelns(error);
                grunt.log.writelns('Error while running ' + spawnArgs);
            }
            return done();
        });
    };

    exports.runTask = function (options, done) {
        exports.options = options;

        //get only the kind of packages user wants
        var packageTypes = _.filter([devDeps, prodDeps], function (pkgType) {
            return options.packages[pkgType.type];
        });

        if (!packageTypes || !packageTypes.length) {
            return done();
        }

        //get the package names
        var packages = getPackageNames(packageTypes);
        //no packages to check
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
                if (!semver.valid(specs.wanted) || !semver.valid(specs.latest)) {
                    grunt.verbose.writelns('Package ' + pkgName.blue + ' isn\'t from NPM, currently not handling those. Skipping...');
                    return cb();
                }
                processByUpdateType(pkg, specs, cb);
            }, done);
        });
    };

    return exports;
};
