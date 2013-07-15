var _path = require('path'),
    _fs = require('fs');

exports.registerHelpers = function (app, hbs) {

var blocks = {};

hbs.registerHelper('extend', function(name, context) {
    var block = blocks[name];
    if (!block) {
        block = blocks[name] = [];
    }

    block.push(context.fn(this)); // for older versions of handlebars, use block.push(context(this));
});

hbs.registerHelper('block', function(name) {
    var val = (blocks[name] || []).join('\n');

    // clear the block
    blocks[name] = [];
    return val;
});

hbs.registerHelper('template', function(name) {
    var p = _path.join(app.get('views'), name+'.hbs');

    var html = '<script id="template:'+name+'" type="text/x-handlebars-template">\n';

    html += _fs.readFileSync(p);

    html += '</script>';

    return new hbs.SafeString(html);
});

};