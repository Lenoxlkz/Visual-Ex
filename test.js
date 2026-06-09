
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.XMLSerializer = dom.window.XMLSerializer;
global.DOMParser = dom.window.DOMParser;
global.XMLHttpRequest = require('xhr2');
const ePub = require('epubjs').default;

const epub = ePub('https://s3.amazonaws.com/moby-dick/moby-dick.epub');
epub.loaded.navigation.then(nav => {
    console.log(JSON.stringify(nav.toc, null, 2));
}).catch(console.error);
