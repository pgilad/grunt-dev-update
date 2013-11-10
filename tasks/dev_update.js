/*
 * grunt-dev-update
 * 
 *
 * Copyright (c) 2013 Gilad Peleg
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {

    grunt.registerMultiTask('devUpdate', 'See your outdated devDependencies and update them', function () {

        var async = require('async'),
            _ = require('lodash'),
            inquirer = require("inquirer"),

        //object to contain outdated packages
            resultsObj = {},
        //get dev dependencies
            devDeps = require('matchdep').filterDev('*'),
        //default spawn options
            spawnOptions = {
                cmd  : 'npm',
                grunt: false,
                opts : {}
            },
            options = this.options() || {},
            stats = {
                outdated: 0,
                upToDate: 0
            },
            updateOptions = ['report', 'force', 'prompt'];

        //defaults
        _.defaults(options, {updateType: 'report', reportUpdated: false});

        //validate updateType option
        if (!_.contains(updateOptions, options.updateType)) {
            grunt.fail.warn('Invalid value for option updateType:', options.updateType);
            options.updateType = 'report'; //default
        }

        grunt.verbose.writeflags(options, 'Running task with options');
        grunt.verbose.writelns("Using target " + this.target);

        //setup async
        var endTask = this.async();

        grunt.log.writeln('Found %s devDependencies to check for latest version', devDeps.length);

        var updatePackage = function (dep, done) {
            spawnOptions.args = ['install', dep, '--save-dev'];
            grunt.util.spawn(spawnOptions, function (error, result, code) {
                if (error) {
                    var errObj = {task: dep, command: spawnOptions.cmd + ' ' + spawnOptions.args.join(' ')};
                    done(error);
                    return;
                }

                grunt.log.oklns('Successfully updated package %s', dep);
                done();
            });
        };

        /** Fetching data phase **/
        async.each(
            devDeps,
            function (devDep, callback) {
                //make current task arguments
                spawnOptions.args = ['list', devDep, '--json', '--depth=1'];

                grunt.util.spawn(spawnOptions, function (error, result, code) {
                    //todo
                    if (error) {
                        grunt.log.writelns('Skipping package %s after encountered error', devDep);
                        var errObj = {task: devDep, command: spawnOptions.cmd + ' ' + spawnOptions.args.join(' ')};
                        callback();
                        return;
                    }

                    //insert devDep into taskObject as a key with localVersion
                    resultsObj[devDep] = {
                        localVersion: JSON.parse(result).dependencies[devDep].version
                    };

                    grunt.verbose.writelns('Got local version for package %s -> %s', devDep, resultsObj[devDep].localVersion);
                    spawnOptions.args = ['view', devDep, 'version'];

                    grunt.util.spawn(spawnOptions, function (error, result, code) {
                        //TODO
                        if (error) {
                            grunt.log.writelns('Skipping package %s after encountered error', devDep);
                            resultsObj[devDep].isError = true;
                            //{task: devDep, error: error, code: code}
                            callback();
                            return;
                        }

                        //version is the same
                        if (result.stdout === resultsObj[devDep].localVersion) {
                            ++stats.upToDate;
                            var logMethod = options.reportUpdated ? grunt.log.oklns : grunt.verbose.oklns;
                            logMethod('Package %s is at latest version %s', devDep, result.stdout);
                            resultsObj[devDep].atLatest = true;
                        }
                        else {
                            ++stats.outdated;
                        }
                        resultsObj[devDep].remoteVersion = result.stdout;

                        grunt.verbose.writelns('Got remote version for package %s -> %s', devDep, result.stdout);
                        callback();
                    });
                });
            },
            function done(err) {
                if (err) {
                    grunt.log.error('Got error in the way', err);
                    return;
                }

                /** Update phase **/
                grunt.log.oklns('Found %s devDependencies. %s up-to-date, %s outdated', devDeps.length, stats.upToDate, stats.outdated);

                async.eachSeries(_.keys(resultsObj), function (depKey, callback) {
                    var dep = resultsObj[depKey];
                    if (dep.atLatest || dep.isError) {
                        callback();
                        return;
                    }

                    grunt.log.subhead('package %s is outdated.\nLocal version: %s, Latest version %s',
                        depKey, dep.localVersion, dep.remoteVersion);

                    if (options.updateType === 'report') {
                        callback();
                    }
                    else if (options.updateType === 'prompt') {
                        var msg = 'update using [npm install ' + depKey + ' --save-dev]';
                        inquirer.prompt({ name: 'confirm', message: msg, type: "confirm" }, function (result) {
                            if (result.confirm) {
                                updatePackage(depKey, callback);
                                return;
                            }
                            callback();
                        });
                    }
                    else if (options.updateType === 'force') {
                        updatePackage(depKey, callback);
                    }
                }, endTask);
            }
        );
    });
};
