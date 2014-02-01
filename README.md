# grunt-dev-update
> Automate the updating of your package.json packages with a grunt task

[![NPM Version](http://img.shields.io/npm/v/grunt-dev-update.svg)](https://npmjs.org/package/grunt-dev-update)
[![NPM](http://img.shields.io/npm/dm/grunt-dev-update.svg)](https://npmjs.org/package/grunt-dev-update)
[![Gittip](http://img.shields.io/gittip/pgilad.svg)](https://www.gittip.com/pgilad/)
[![Built with Grunt](https://cdn.gruntjs.com/builtwith.png)](http://gruntjs.com/)

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
In your project's Gruntfile, add a task config named `devUpdate` to the data object passed into `grunt.initConfig()`.

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

#### options.packages
Type: `Object`
Default value: `{devDependencies: true}`

What kind of packages should be checked. Valid options:

`dependencies` - Specify true to check **production dependencies**.
`devDependencies` - Specify true to check **development dependencies**. This is **true** by default.

Outdated **dependencies** are installed using the `--save` option.

Outdated **devDependencies** are installed using the `--save-dev` option.

### Usage Examples

#### Default Options
These is a usage with all the options, specifying the defaults:

```js
grunt.initConfig({
    devUpdate: {
        main: {
            options: {
                //just report
                updateType: 'report',
                //don't report ok packages by default
                reportUpdated: false,
                //what packages to check
                packages: {
                    //only devDependencies by default
                    devDependencies: true,
                    dependencies: false
                },
                //by deafult - use matchdep default findup to locate package.json
                packageJson: null
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
