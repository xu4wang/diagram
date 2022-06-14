'use strict';

var jsyaml     = require('js-yaml');
var base64     = require('./base64');
var store      = require('./state');

const default_name = '#default_diagram';
const frontpage = 'index';

var notes_name = default_name;

let config_file = 'diagram.system.configuration';

//eslint-disable-next-line
let default_b64 = 'eyJpbmRleCI6Ii0tLVxuc3R5bGU6IHt9XG5ub2RlczpcbiAgLSBuMVxuICAtIG4yXG4gIC0gbjNcbiAgLSBuOFxuICAtIG4yNTBcbiAgLSBuMjUxXG4gIC0gbjI1M1xuZWRnZXM6IFtdXG4tLS1cblxuVGhpcyBpcyBhbiBlbXB0eSBub3Rlcy4iLCJubyBleHBsb3JlciI6Ii0tLVxubmFtZTogbm8gZXhwbG9yZXJcbm5vdGU6IGNvbmZpZ1xuc3R5bGU6XG4gIGxlZnQ6IDE1NHB4XG4gIHRvcDogMTEycHhcbm5vZGVzOiBbXVxuZWRnZXM6IFtdXG5jb21tYW5kczpcbiAgLSBuYW1lOiB0aGVtZVxuICAgIGFyZ3Y6XG4gICAgICBleHBsb3JlcjpcbiAgICAgICAgd2lkdGg6IDAlXG4tLS1cblxuXG5qampqampcblxuZWVlZGRkXG5cbiIsImRpYWdyYW0uc3lzdGVtLmNvbmZpZ3VyYXRpb24iOiItLS1cbnN0eWxlOiB7fVxubm9kZXM6IFtdXG5lZGdlczogW11cbmJ1dHRvbnM6XG4gIC0gbm8gZXhwbG9yZXJcbiAgLSBub3JtYWxcbiAgLSBub3RlIHRha2luZ1xuICAtIG5vIGV4cGxvcmVyXG4gIC0gbm9ybWFsXG4gIC0gY2FudmFzIG9ubHlcbiAgLSBub3JtYWxcbi0tLVxuXG5Db25maWd1cmF0aW9uIERhdGFcbiIsIm5vdGUgdGFraW5nIjoiLS0tXG5uYW1lOiBub3RlIHRha2luZ1xubm90ZTogY29uZmlnXG5zdHlsZToge31cbm5vZGVzOiBbXVxuZWRnZXM6IFtdXG5jb21tYW5kczpcbiAgLSBuYW1lOiB0aGVtZVxuICAgIGFyZ3Y6XG4gICAgICBleHBsb3JlcjpcbiAgICAgICAgd2lkdGg6IDAlXG4gICAgICBlZGl0b3I6XG4gICAgICAgIHdpZHRoOiA1MHZ3XG4tLS0iLCJub3JtYWwiOiItLS1cbm5vdGU6IGNvbmZpZ1xuZm9sbG93OlxuICAtIHRvZG9cbnN0eWxlOiB7fVxubm9kZXM6IFtdXG5lZGdlczogW11cbmNvbW1hbmRzOlxuICAtIG5hbWU6IHRoZW1lXG4gICAgYXJndjpcbiAgICAgIGV4cGxvcmVyOlxuICAgICAgICB3aWR0aDogMjB2d1xuICAgICAgZWRpdG9yOlxuICAgICAgICB3aWR0aDogNDB2d1xuLS0tXG5cbmtra2trIiwiIjoiLS0tXG5zdHlsZToge31cbm5vZGVzOiBbXVxuZWRnZXM6IFtdXG4tLS0ifQ==';


store.init({
  active: null,   //name of current active node
  impacted: null,  //the node being impacted
  documents: {}
});

function parse(text, options, loadSafe) {
  let contentKeyName = options && typeof options === 'string'
    ? options
    : options && options.contentKeyName
      ? options.contentKeyName
      : '__content';

  //eslint-disable-next-line
  let passThroughOptions = options && typeof options === 'object' ? options : undefined;

  let re = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/,
      results = re.exec(text),
      conf = {},
      yamlOrJson;

  if ((yamlOrJson = results[2])) {
    if (yamlOrJson.charAt(0) === '{') {
      conf = JSON.parse(yamlOrJson);
    } else if (loadSafe) {
      conf = jsyaml.safeLoad(yamlOrJson, passThroughOptions);
    } else {
      conf = jsyaml.load(yamlOrJson, passThroughOptions);
    }
  }

  conf[contentKeyName] = results[3] || '';

  return conf;
}

function loadFront(content, options) {
  return parse(content, options, false);
}

/*---------------------- A Wrapper of the model ------------------------*/

function get_documents() {
  //return a list of objects { name, type, content }
  return store.get_store().documents;
}

function _update_document(impacted, docs, name, content) {
  //TODO need to check 'follow' attributes, prevent loop inherit
  var new_file_created = false;
  var h;

  try {
    h = loadFront(content);
  } catch (error) {
    h = {};
    h.__content = content;
  }

  if (!docs[name]) {
    //notify listener that a file was created
    new_file_created = true;
  }

  docs[name] = {
    body: h.__content,
    content: content
  };

  if (!h.style) {
    h['style'] = {};
  }
  if (!h.nodes) {
    h['nodes'] = [];
  }
  if (!h.edges) {
    h['edges'] = [];
  }

  delete h.__content;
  docs[name].error = false;
  docs[name].json = h;   //...json.nodes = ['n1','n2',...]

  if (new_file_created) {
    store.emit('DOCUMENT-CREATE',  { impacted: name });
  }
  impacted = name;
  return { impacted: name, documents: docs };
}

function get_document_content(id) {
  var diagram_documents = store.get_store().documents;
  if (diagram_documents[id]) {
    var ret = '';
    if (Object.keys(diagram_documents[id].json).length !== 0) {
      ret = '---\n' + jsyaml.dump(diagram_documents[id].json) + '---';
    }
    return ret + diagram_documents[id].body;
  }
  return '';
}

function build_permlink() {
  //generate b64 data
  var obj = {};
  var documents = store.get_store().documents;
  for (const el in documents) {
    if (documents.hasOwnProperty(el)) {
      obj[el] = get_document_content(el);
    }
  }
  var obj_str = JSON.stringify(obj);
  return base64.encode(obj_str);
}


function update_storage() {
  window.localStorage.setItem(notes_name, build_permlink());
}

//  store.emit('ACTIVE-DOCUMENT', () => ({ active : name }));
function update_document(name, content) {
  name = String(name);
  store.emit('DOCUMENT-UPDATE', ({ impacted, documents }) => (_update_document(impacted, documents, name, content)));
  update_storage();
}

function get_subnode_names(id) {
  var diagram_documents = store.get_store().documents;
  if (diagram_documents[id]) {
    if (diagram_documents[id].json.nodes) {
      return diagram_documents[id].json.nodes;
    }
  }
  return [];
}


function get_document_body(id) {
  var diagram_documents = store.get_store().documents;

  if (diagram_documents[id]) {
    return diagram_documents[id].body;
  }
  return '';
}

function set_active_document(name) {
  store.emit('ACTIVE-DOCUMENT', () => ({ active : name }));
  //check if it's a notes package???
  if (localStorage.getItem(name) !== null) {
    //open the note pacakge named target_doc
    // eslint-disable-next-line no-use-before-define
    reset(name);
  }
}

function get_active_document() {
  return store.get_store().active;
}

function get_impacted_document() {
  return store.get_store().impacted;
}

function get_document_obj(id) {
  var documents = store.get_store().documents;
  if (!documents[id]) {
    update_document(id, '');
  }
  return documents[id].json;
}

function update_attr(id, key, value) {
  //update JSON object first,
  //update yaml accordingly
  var obj = get_document_obj(id)['style'];
  obj[key] = value;
  update_storage();
}

function set_common_attr(id, key, value) {
  var obj = get_document_obj(id);
  obj[key] = value;
  update_storage();
}

function get_attr(id, key) {
  //read node attr, if not available return the default attr value
  var obj = get_document_obj(id)['style'];
  var parent = get_document_obj(id)['follow'];

  var r = obj[key];
  if (r) return r;

  if (parent) {
    for (let f of parent) {
      let r = get_attr(f, key);
      if (r) return r;
    }
  }
  return r;
}

function get_attrs(id) {
  var obj = get_document_obj(id)['style'];
  var parent = get_document_obj(id)['follow'];

  if (parent) {
    for (let f of parent) {
      let r = get_attrs(f);
      obj = Object.assign({}, r, obj);
    }
  }
  return obj;
}

function get_edges(doc) {
  var documents = store.get_store().documents;

  if (documents[doc].json.edges) {
    return documents[doc].json.edges;
  }
  return [];
}

function get_common_attr(name, key) {
  var docs = store.get_store().documents;
  if (docs[name]) {
    return docs[name].json[key];
  }
  return '';
}

function get_all_names() {
  var docs = store.get_store().documents;
  var ret = new Set();
  for (let d in docs) {
    if (docs.hasOwnProperty(d)) {
      ret.add(d);
      /* subnode will not be added automatically.
      for (let s of get_subnode_names(d)) {
        ret.add(s);
      }
      */
    }
  }
  var ret2 = {};
  for (let k of ret) {
    ret2[k] = get_common_attr(k, 'note') || '';
  }
  return ret2;
}


function get_config(key) {
  return get_common_attr(config_file, key);
}

function set_config(key, value) {
  set_common_attr(config_file, key, value);
  store.emit('DOCUMENT-UPDATE', () => ({}));
  update_storage();
}

function rename_document(src, target) {
  store.emit('DOCUMENT-RENAME', (s) => {
    if (localStorage.getItem(src) !== null) {
      let v = localStorage.getItem(src);
      if (target.charAt(0) !== '#') {
        target = '#' + target;
      }
      localStorage.setItem(target, v);
      if (src !== default_name) {
        localStorage.removeItem(src); //always remove
      }
      //dialog.alert('Notes Pacakge ' + name + ' also renamed!');
    }
    s.documents[target] = s.documents[src];
    delete s.documents[src];
    update_storage();
    return s;
  });
}

function delete_document(name) {
  store.emit('DOCUMENT-DELETE', (s) => {
    delete s.documents[name];
    if (name !== default_name) {
      localStorage.removeItem(name); //always remove
    }
    update_storage();
    return s;
  });
}

function document_available(name) {
  var docs = store.get_store().documents;
  return name in docs;
}


function allocation_name() {
  let current = new Date();
  let cDate = current.getFullYear() + '_' + (current.getMonth() + 1) + '_' + current.getDate();
  let cTime = current.getHours() + '_' + current.getMinutes() + '_' + current.getSeconds();
  let dateTime = '#' + cDate + '_' + cTime;
  return dateTime;
}

function init_from_permlink(b64) {
  try {
    var obj_str = base64.decode(b64);
    var obj = JSON.parse(obj_str);
    if (obj) {
      for (let n in obj) {
        if (obj.hasOwnProperty(n)) {
          update_document(n, obj[n]);
        }
      }
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
  return true;
}

function format(hard) {
  if (hard) {
    store.reset_listener();
  }
  store.emit('FORMAT', { documents: {} });
}

//name is the new name after reset
/*

1. ('', false) : open default notes
2. ('name',false) : open name, if not available, init it using default b64 data.
3. ('name', 'b64 data') : assign b64 data to name in localStorage, and open name.
4. ('', 'b64 data') : allocate a name and assign b64 data, open it.

*/
function reset(name, b64) {
  let notes_data = '';
  store.emit('RESET', {});
  format();

  name = name || '';

  if (name === '') {
    if (b64) {
      //case #4
      notes_name = allocation_name();
      notes_data = b64;
    } else {
      //case #1
      notes_name = default_name;  //use default name;
      notes_data = window.localStorage.getItem(notes_name);
    }
  } else {
    //name is not blank, #2 or #3
    notes_name = name;
    if (b64) {
      notes_data = b64;
    } else {
      notes_data = window.localStorage.getItem(name);
    }
  }
  //make sure name starts with #
  if (notes_name.charAt(0) !== '#') {
    notes_name = '#' + notes_name;
  }

  //init and make sure notes_data is valid
  if (!init_from_permlink(notes_data)) {
    notes_data = default_b64;
    init_from_permlink(notes_data);
  }

  window.localStorage.setItem(notes_name, notes_data);
  if (notes_name === default_name) {
    //add all notes to the default note
    for (let k of Object.keys(window.localStorage)) {
      if (k !== default_name) {
        update_document(k, 'Click to Open Notes');
      }
    }
  }
  set_active_document(frontpage);
  store.emit('OPEN-NOTES', {});
}

function get_notes_name() {
  return notes_name;
}


exports.reset = reset;
//exports.init_from_permlink = init_from_permlink;
exports.build_permlink = build_permlink;

exports.get_active_document = get_active_document;
exports.set_active_document = set_active_document;
exports.get_impacted_document = get_impacted_document;

exports.get_documents = get_documents;
exports.update_document = update_document;   //new doc & modify doc
exports.get_document_content = get_document_content;
exports.get_document_body = get_document_body;
exports.rename_document = rename_document;
exports.delete_document = delete_document;
exports.document_available = document_available;

exports.get_subnode_names = get_subnode_names;
exports.get_edges = get_edges;

exports.get_attr = get_attr;
exports.update_attr = update_attr;
exports.get_attrs = get_attrs;
exports.get_common_attr = get_common_attr;

exports.get_all_names = get_all_names;
exports.on = store.on;
exports.reset_listener = store.reset_listener;
exports.set_config = set_config;
exports.get_config = get_config;

exports.get_notes_name = get_notes_name;

exports.format = format;

/* support EVENTS
'ACTIVE-DOCUMENT'
'DOCUMENT-UPDATE'
"DOCUMENT-DELETE"
"DOCUMENT-RENAME"
"DOCUMENT-CREATE"
‘RESET’
‘OPEN-NOTES’
*****************/