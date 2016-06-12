# Seadragon

## 2014-07-26

-   Convert `README` to Markdown.
-   Add `Makefile`:
    -   `make build`: Build all files.
    -   `make lint`: Lint files using [JSHint].
-   Add `package.json` for distribution through [npm].
-   Improve linting.
-   Use standard `requestAnimationFrame` if available.
-   Add example for a [zoomable image][example-zoomable-image].
-   Drop `-raw` suffix for unminified files.
-   Switch from [ajaxmin] to [UglifyJS] for JavaScript minification.


[ajaxmin]: http://ajaxmin.codeplex.com/
[example-zoomable-image]: ./examples/zoomable-image.html
[jshint]: http://www.jshint.com/
[npm]: https://www.npmjs.org/
[uglifyjs]: https://github.com/mishoo/UglifyJS
