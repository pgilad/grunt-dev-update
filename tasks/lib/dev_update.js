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

module.exports = function(grunt) {

	var exports = {
		options: {},
		deps: [],
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
	exports.getPackages = function(packageType) {
		//TODO add package.json route to options
		var packagePath = path.join(process.cwd(), 'package.json'),
			matchDep = require('matchdep'),
			filterPackages = function() {};
		grunt.verbose.writelns('Using path for package.json: ' + packagePath);
		switch (packageType) {
			case "dev":
				filterPackages = matchDep.filterDev;
				break;
			case "default":
			default:
				filterPackages = matchDep.filter;
				break;
		}
		exports.deps = filterPackages('*', require(packagePath));
		grunt.log.writeln('Found %s %sDependencies to check for latest version', exports.deps.length, packageType);
	};

	exports.getSpawnArguments = function(dep, phase) {
		switch (phase) {
			case 'local':
				return ['list', dep, '--json', '--depth=1'];
				break;

			case 'remote':
				return ['view', dep, 'version'];
				break;

			case 'update':
				grunt.verbose.writelns(exports.options.saveType);
				return ['install', dep + '@' + exports.results[dep].remoteVersion, exports.options.saveType];
				break;
		}
		return [];
	};

	/**
	 * @param {String[]} packages
	 * @param {Function} done callback function
	 */
	exports.getLocalPackageVersion = function(packages, done) {
		/** Fetching data phase **/

		var bar = new ProgressBar('Getting local packages versions [:bar] :percent :etas', {
			total: packages.length
		});

		async.each(packages,
			function(dep, callback) {
				//make current task arguments

				bar.tick();

				exports.spawnOptions.args = exports.getSpawnArguments(dep, 'local');
				exports.results[dep] = {};
				grunt.util.spawn(exports.spawnOptions, function(error, result, code) {
					if (error) {
						grunt.verbose.writelns(error);
						exports.results[dep].isError = true;
						grunt.log.writelns('Error in getting local package version of ' + dep);
						callback();
						return;
					}

					var localVersion;
					//insert dep into taskObject as a key with localVersion
					try {
						localVersion = JSON.parse(result).dependencies[dep].version;
					}
					catch (e) {
						grunt.verbose.writelns(e);
						exports.results[dep].isError = true;
						grunt.log.writelns('Error in JSON.parse of the local package info of ' + dep);
						callback();
						return;
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
	exports.getRemotePackageVersion = function(packages, done) {

		var bar = new ProgressBar('Getting remote packages versions [:bar] :percent :etas', {
			total: packages.length
		});

		/** Fetching data phase **/
		async.each(packages,
			function(dep, callback) {

				bar.tick();
				//make current task arguments
				exports.spawnOptions.args = exports.getSpawnArguments(dep, 'remote');

				grunt.util.spawn(exports.spawnOptions, function(error, result, code) {
					if (error) {
						grunt.verbose.writelns(error);
						exports.results[dep].isError = true;
						grunt.log.writelns('Error in getting remote package version of ' + dep);
						callback();
						return;
					}
					grunt.verbose.writelns('Got remote version for package %s -> %s', dep, result.stdout);
					exports.results[dep].remoteVersion = result.stdout;

					//version is the same
					if (result.stdout === exports.results[dep].localVersion) {
						++exports.stats.upToDate;
						var logMethod = exports.options.reportUpdated ? grunt.log.oklns : grunt.verbose.oklns;
						logMethod('Package %s is at latest version %s', dep, result.stdout);
						exports.results[dep].atLatest = true;
					}
					//version is outdated
					else {
						grunt.log.subhead('package %s is outdated.\nLocal version: %s, Latest version %s',
							dep, exports.results[dep].localVersion, exports.results[dep].remoteVersion);
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
	exports.processByUpdateType = function(packages, done) {
		/** Update phase **/
		async.eachSeries(packages, function(dep, callback) {
			var currentDep = exports.results[dep];

			if (currentDep.atLatest || currentDep.isError) {
				callback();
				return;
			}

			if (exports.options.updateType === 'report') {
				callback();
			}
			else if (exports.options.updateType === 'prompt') {
				var msg = 'update using [npm install ' + dep + '@' + exports.results[dep].remoteVersion + ' ' + exports.options.saveType + ']';
				inquirer.prompt({
					name: 'confirm',
					message: msg,
					type: "confirm"
				}, function(result) {
					if (result.confirm) {
						exports.updatePackage(dep, callback);
						return;
					}
					callback();
				});
			}
			else if (exports.options.updateType === 'force') {
				exports.updatePackage(dep, callback);
			}
		}, done);
	};

	/**
	 * Update a package using npm install %package% %saveType%
	 * @param {String} dep
	 * @param {Function} done callback function
	 */
	exports.updatePackage = function(dep, done) {
		exports.spawnOptions.args = exports.getSpawnArguments(dep, 'update');
		exports.spawnOptions.opts = {
			stdio: 'inherit'
		};
		grunt.util.spawn(exports.spawnOptions, function(error, result, code) {
			if (error) {
				grunt.verbose.writelns(error);
				grunt.log.writelns('Error while updating package ' + dep);
				done();
				return;
			}

			grunt.log.oklns('Successfully updated package ' + dep);
			done();
		});
	};

	exports.runTask = function(done) {
		async.series([

			function(callback) {
				//get the dev dependencies using matchdep
				exports.getPackages(exports.options.packageType);
				//get local packages version
				exports.getLocalPackageVersion(exports.deps, callback);
			},

			function(callback) {
				exports.getRemotePackageVersion(exports.deps, callback);
			},

			function(callback) {
				exports.processByUpdateType(exports.deps, callback);
			}

		], function(err) {
			if (err) {
				grunt.log.error('Task failed due to error', err);
			}

			grunt.log.oklns('Found %s dependencies. %s up-to-date, %s outdated', exports.deps.length, exports.stats.upToDate, exports.stats.outdated);
			done();
		});
	};

	return exports;
};