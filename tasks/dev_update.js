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
        grunt.verbose.writeflags(options, 'Options');

        var endTask = this.async();

        //get dev dependencies
        var tasks = require('matchdep').filterDev('*');

        //object to contain outdated packages
        var tasksObject = {};

        //default spawn options
        var defaultSpawnOptions = {
            cmd  : 'npm',
            grunt: false,
            opts : {}
        };

        // Iterate over all specified file groups.
        this.files.forEach(function(f) {
            // Do something to some files...

            // Print a success message.
            grunt.log.writeln('File "' + f.dest + '" created.');
        });

        grunt.log.oklns('Found %s tasks to check latest version', tasks.length);

        //get local tasks versions
        async.each(
            tasks,
            function (task, callback) {
                //make current task arguments
                var opt = _.clone(defaultSpawnOptions);
                opt.args = ['list', task, '--json', '--depth=1'];

                grunt.util.spawn(opt, function (error, result, code) {
                    if (error) {
                        var errObj = {task: task, command: opt.cmd + ' ' + opt.args.join(' ')};
                        callback();
                        return;
                    }
                    tasksObject[task] = {
                        localVersion: JSON.parse(result).dependencies[task].version
                    };

                    var nextOpt = _.clone(defaultSpawnOptions);
                    nextOpt.args = ['view', task, 'version'];

                    grunt.util.spawn(nextOpt, function (error, result, code) {
                        if (error) {
                            callback({task: task, error: error, code: code});
                            return;
                        }

                        if (result.stdout !== tasksObject[task].localVersion) {
                        }
                        else {
                            //task is updated
                            //delete tasksObject[task];
                        }
                        tasksObject[task].remoteVersion = result.stdout;

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
