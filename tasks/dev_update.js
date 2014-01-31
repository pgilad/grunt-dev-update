/*
 * grunt-dev-update
 *
 *
 * Copyright (c) 2013 Gilad Peleg
 * Licensed under the MIT license.
 */

var _ = require('lodash');

'use strict';

module.exports = function(grunt) {

	var devUpdate = require('./lib/dev_update')(grunt);

	grunt.registerMultiTask('devUpdate', 'See your outdated devDependencies and update them', function() {

		//set default options
		devUpdate.options = this.options({
			updateType: 'report',
			reportUpdated: false,
			packageType: 'default',
			saveType: '--save'
		});

		var possibleUpdateTypes = ['report', 'force', 'prompt'];
		grunt.verbose.writeflags(devUpdate.options, 'Options');
		grunt.verbose.writelns('Using target: ' + this.target);

		//validate updateType option
		if (!_.contains(possibleUpdateTypes, devUpdate.options.updateType)) {
			grunt.fail.warn('updateType ' + String(devUpdate.options.updateType).cyan + ' not supported.');
			//if force
			devUpdate.options.updateType = 'report';
		}

		//run task
		devUpdate.runTask(this.async());
	});
};