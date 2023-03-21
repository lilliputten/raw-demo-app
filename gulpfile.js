var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');

function bundleMediasoup() {
  // set up the browserify instance on a task basis
  var b = browserify({ entries: './src/lib/mediasoup-bundle-entry.js', debug: true });
  return b.bundle()
  .pipe(source('mediasoup.js'))
  .pipe(buffer())
  .pipe(sourcemaps.init({ loadMaps: true }))
    // Add transformation tasks to the pipeline here.
    .pipe(uglify({ compress: { drop_debugger: false } }))
    .on('error', gutil.log)
  .pipe(sourcemaps.write('./'))
  .pipe(gulp.dest('./mediasoup-bundle/'));
}

gulp.task('bundleMediasoup', bundleMediasoup);
