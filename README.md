# grunt-dev-update [![Built with Grunt](https://cdn.gruntjs.com/builtwith.png)](http://gruntjs.com/)
> Automatically update your npm package.json devDependencies with a grunt task

[![NPM Version](http://img.shields.io/npm/v/grunt-dev-update.svg)](https://npmjs.org/package/grunt-dev-update)
[![NPM](http://img.shields.io/npm/dm/grunt-dev-update.svg)](https://npmjs.org/package/grunt-dev-update)
[![Gittip](http://img.shields.io/gittip/pgilad.svg)](https://www.gittip.com/pgilad/)

## Getting Started
This plugin requires Grunt.

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-dev-update --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-dev-update');
```

An alternative and highly recommended way to load all grunt npm tasks is installing `matchdep`:
```js
npm install matchdep --save-dev
```

And then add to your grunt file:
```js
require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
```

## The "devUpdate" task

### Overview
In your project's Gruntfile, add a section named `devUpdate` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  devUpdate: {

    your_target: {
        options: {
          // Target specific options go here
        }
    }
  }
})
```

### Options

#### options.reportUpdated
Type: `Boolean`
Default value: `false`

Whether to report an already updated package

#### options.updateType
Type: `String`
Default value: `report`

How devUpdate should handle the outdated packages. Valid options:

`report` - Just report that the package is outdated.

`prompt` - Prompt user to confirm update of every package

`force` - Automatically force the update for the outdated packages.

### Usage Examples

#### Default Options
This is a basic usage for devUpdate:

```js
grunt.initConfig({
  devUpdate: {
    main: {
        options: {
            //should task report already updated dependencies
            reportUpdated: false,
            //can be 'force'|'report'|'prompt'
            updateType   : "report"
        }
    }
  }
})
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History

## License
Copyright (c) 2014 Gilad Peleg. Licensed under the MIT license.
