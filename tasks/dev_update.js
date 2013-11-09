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

        var async = require('async');
        var _ = require('lodash');

        var options = this.options();
        grunt.verbose.writeflags(options, 'Running task with options');
        grunt.verbose.writelns("Using target " + this.target);

        //setup async
        var endTask = this.async();

        //get dev dependencies
        var devDeps = require('matchdep').filterDev('*');

        //object to contain outdated packages
        var tasksObject = {};

        //default spawn options
        var spawnOptions = {
            cmd  : 'npm',
            grunt: false,
            opts : {}
        };

        grunt.log.oklns('Found %s tasks to check latest version', devDeps.length);

        //get local tasks versions
        async.each(
            devDeps,
            function (devDep, callback) {
                //make current task arguments
                spawnOptions.args = ['list', devDep, '--json', '--depth=1'];

                grunt.util.spawn(spawnOptions, function (error, result, code) {
                    //todo
                    if (error) {
                        var errObj = {task: devDep, command: opt.cmd + ' ' + opt.args.join(' ')};
                        callback();
                        return;
                    }

                    tasksObject[devDep] = {
                        localVersion: JSON.parse(result).dependencies[devDep].version
                    };

                    grunt.verbose.writelns('Got local version for package %s -> %s', devDep, tasksObject[devDep].localVersion);
                    spawnOptions.args = ['view', devDep, 'version'];

                    grunt.util.spawn(spawnOptions, function (error, result, code) {
                        //TODO
                        if (error) {
                            callback({task: devDep, error: error, code: code});
                            return;
                        }

                        //version is the same
                        if (result.stdout === tasksObject[devDep].localVersion) {
                            var logMethod = options.reportUpdated ? grunt.log.oklns : grunt.verbose.oklns;
                            logMethod('Package %s is at latest version %s', devDep, result.stdout);

                        }
                        else {
                            //task is updated
                            //delete tasksObject[task];
                        }
                        tasksObject[devDep].remoteVersion = result.stdout;

                        callback();
                    });
                });
            },
            function done(err) {
                if (err) {
                    grunt.log.error('Got error in the way', err);
                    return;
                }
                console.log('final:', tasksObject);
                endTask();
            }
        );
    });
};
