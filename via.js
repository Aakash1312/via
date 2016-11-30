/*
  VGG Image Annotator (via)
  www.robots.ox.ac.uk/~vgg/software/via/
  
  Copyright (c) 2016, Abhishek Dutta.
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
  Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGE.
*/

var VIA_VERSION = '0.1';
var VIA_NAME = 'VGG Face Annotator';
var VIA_SHORT_NAME = 'VFA';
var VIA_REGION_SHAPE = { RECT:'rect'};

var VIA_SPECIAL_CHAR_SUBS = {',':'[comma]',
			     ':':'[colon]',
			     ';':'[scolon]',
			     '=':'[equal]'};
var VIA_REGION_EDGE_TOL = 5;
var VIA_REGION_MIN_DIM = 5;
var VIA_CANVAS_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 2.0, 3.0, 4.0];
var VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX = 3;
var VIA_FACE_LABEL_ATTR_NAME = 'face_label';
var VIA_FACE_LABEL_MAX_SIZE_KB = 512;

var VIA_THEME_REGION_BOUNDARY_WIDTH = 4;
var VIA_THEME_BOUNDARY_LINE_COLOR = "#1a1a1a";
var VIA_THEME_BOUNDARY_FILL_COLOR = "#aaeeff";
var VIA_THEME_SEL_REGION_FILL_COLOR = "#808080";
var VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR = "#000000";
var VIA_THEME_SEL_REGION_OPACITY = 0.5;
var VIA_THEME_MESSAGE_TIMEOUT_MS = 3000;
var VIA_THEME_ATTRIBUTE_IMG_WIDTH = 64;
var VIA_THEME_ATTRIBUTE_VALUE_FONT = '10pt Sans';
var VIA_IMPORT_CSV_COMMENT_CHAR = '#';
var VIA_IMPORT_CSV_KEYVAL_SEP_CHAR = ';';
var VIA_EXPORT_CSV_ARRAY_SEP_CHAR = ':';
var VIA_CSV_SEP_CHAR = ',';

var _via_images = {};                // everything related to an image
var _via_images_count = 0;
var _via_canvas_regions = [];   // image regions spec. in canvas space
var _via_canvas_scale = 1.0;  // current scale of canvas image

var _via_image_id_list = [];         // array of image id (in original order)
var _via_image_id = '';              // id={filename+length} of current image
var _via_image_index = -1;           // index 

var _via_current_image_filename;
var _via_current_image;

// image canvas
var _via_canvas = document.getElementById("image_canvas");
var _via_ctx = _via_canvas.getContext("2d");
var _via_canvas_width, _via_canvas_height;

// canvas zoom
var _via_canvas_zoom_level_index = VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX; // 1.0
var _via_canvas_scale_without_zoom = 1.0;

// state of the application
var _via_is_user_drawing_region = false;
var _via_current_image_loaded = false;
var _via_is_window_resized = false;
var _via_is_user_resizing_region = false;
var _via_is_user_moving_region = false;
var _via_is_region_selected = false;
var _via_is_all_region_selected = false;
var _via_is_loaded_img_list_visible = false;
var _via_is_attributes_input_panel_visible = false;
var _via_is_canvas_zoomed = false;
var _via_is_loading_current_image = false;

// region
var _via_current_shape = VIA_REGION_SHAPE.RECT;
var _via_user_sel_region_id = -1;
var _via_click_x0 = 0; var _via_click_y0 = 0;
var _via_click_x1 = 0; var _via_click_y1 = 0;
var _via_region_edge = [-1, -1];
var _via_region_click_x, _via_region_click_y;
var _via_copied_image_regions = [];
var _via_copied_canvas_regions = [];

// message
var _via_message_clear_timer;

// attributes
var _via_region_attributes = new Set();
var _via_face_label_list = [];
var _via_face_label_img_list = [];

// persistence to local storage
var _via_is_local_storage_available = false;
var _via_is_save_ongoing = false;

// image list
var _via_reload_img_table = true;
var _via_loaded_img_fn_list = [];
var _via_loaded_img_region_attr_miss_count = [];
var _via_loaded_img_table_html = [];


// UI html elements
var invisible_file_input = document.getElementById("invisible_file_input");

var image_panel = document.getElementById("image_panel");
var navbar_panel = document.getElementById("navbar");
var info_panel = document.getElementById("info_panel");

var loaded_img_list_panel = document.getElementById('loaded_img_list_panel');
var attributes_input_panel = document.getElementById('attributes_input_panel');
var face_label_panel = document.getElementById('face_label_panel');

var BBOX_LINE_WIDTH = 4;
var BBOX_BOUNDARY_FILL_COLOR_ANNOTATED = "#f2f2f2";
var BBOX_BOUNDARY_FILL_COLOR_NEW = "#aaeeff";
var BBOX_BOUNDARY_LINE_COLOR = "#1a1a1a";
var BBOX_SELECTED_FILL_COLOR = "#ffffff";
var BBOX_SELECTED_OPACITY = 0.3;

function ImageAttributes(fileref, filename, size) {
    this.filename = filename;
    this.size = size;
    this.fileref = fileref;
    this.file_attributes = new Map(); // image attributes
    this.base64_img_data = '';       // image data stored as base 64
    this.regions = [];
}

function ImageRegion() {
    this.is_user_selected = false;
    this.shape_attributes = new Map();  // region shape attributes
    this.region_attributes = new Map(); // region attributes
}

function clone_image_region(r0) {
    var r1 = new ImageRegion();
    r1.is_user_selected = r0.is_user_selected;

    // copy shape attributes
    for ( var key of r0.shape_attributes.keys() ) {
        var value = r0.shape_attributes.get(key);
        r1.shape_attributes.set(key, value);
    }
    
    // copy region attributes
    for ( var key of r0.region_attributes.keys() ) {
        var value = r0.region_attributes.get(key);
        r1.region_attributes.set(key, value);
    }
    return r1;
}

function _via_get_image_id(filename, size) {
    return filename + size;
}

function main() {
    console.log(VIA_NAME);
    show_message(VIA_NAME + ' (' + VIA_SHORT_NAME + ') version ' + VIA_VERSION + '. Ready !',
                 2*VIA_THEME_MESSAGE_TIMEOUT_MS);
    show_home_panel();
    //start_demo_session(); // defined in via_demo.js
    
    _via_is_local_storage_available = check_local_storage();
    //_via_is_local_storage_available = false;
    if (_via_is_local_storage_available) {
        if (is_via_data_in_localStorage()) {
            show_localStorage_recovery_options();
        }
    }

    _via_region_attributes.add(VIA_FACE_LABEL_ATTR_NAME);
}

//
// Handlers for top navigation bar
//
function show_home_panel() {
    clear_image_display_area();
    if (_via_current_image_loaded) {
        _via_canvas.style.display = "block";    
    } else {
        document.getElementById('start_info_panel').style.display = "block";
    }
}

function load_images(type) {
    // source: https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
    if (invisible_file_input) {
	invisible_file_input.accept='.jpg,.jpeg,.png,.bmp';
	switch(type) {
	case 'image':
	    invisible_file_input.onchange = upload_local_images;
            invisible_file_input.click();
	    break;
	case 'face_label':
	    invisible_file_input.onchange = upload_local_face_labels;
            invisible_file_input.click();
	    break;
	}       
    }
}

function download_all_region_data(type) {
    var all_region_data = package_region_data(type);
    var all_region_data_blob = new Blob(all_region_data, {type: 'text/'+type+';charset=utf-8'});

    if ( all_region_data_blob.size > (2*1024*1024) &&
         type == 'csv' ) {
        show_message('CSV file size is ' + (all_region_data_blob.size/(1024*1024)) + ' MB. We advise you to instead download as JSON');
    } else {
        save_data_to_local_file(all_region_data_blob, 'via_region_data.'+type);
    }
}

function upload_region_data_file() {
    if (invisible_file_input) {
        invisible_file_input.accept='.csv,.json';
        invisible_file_input.onchange = import_region_data_from_file;
        invisible_file_input.click();
    }

}
function save_attributes() {
    if ( _via_region_attributes.size > 0 ) {
        var attr_csvdata = [];
        for (var attribute of _via_region_attributes) {
            attr_csvdata.push(attribute);
        }
        var attr_blob = new Blob([attr_csvdata.join(',')], {type: 'text/csv;charset=utf-8'});
        save_data_to_local_file(attr_blob, 'via_attributes_data.csv');
    } else {
        show_message("Attributes not defined yet!");
    }
}
function import_attributes() {
    if (_via_current_image_loaded) {
        if (invisible_file_input) {
            invisible_file_input.accept='.csv,.json';
            invisible_file_input.onchange = import_region_attributes_from_file;
            invisible_file_input.click();
        }
    } else {
        show_message("Please load some images first");
    }
}
function show_settings_panel() {
    show_message("Not implemented yet!");
}
function show_about_panel() {
    clear_image_display_area();
    document.getElementById('about_panel').style.display = "block";
}
function show_getting_started_panel() {
    clear_image_display_area();
    document.getElementById('getting_started_panel').style.display = "block";
}

//
// Local file uploaders
//
function upload_local_images(event) {
    var user_selected_images = event.target.files;
    var original_image_count = _via_images_count;

    // clear browser cache if user chooses to load new images
    if (original_image_count == 0) {
        localStorage.clear();
    }

    var discarded_file_count = 0;
    for ( var i=0; i<user_selected_images.length; ++i) {
        if (user_selected_images[i].type.includes('image/')) {
            var filename = user_selected_images[i].name;
            var size = user_selected_images[i].size;
            var img_id = _via_get_image_id(filename, size);

            if ( _via_images.hasOwnProperty(img_id) ) {
                if (_via_images[img_id].fileref) {
                    show_message('Image ' + filename + ' already loaded. Skipping!');
                } else {
                    _via_images[img_id].fileref = user_selected_images[i];
                    show_message('Regions already exist for file ' + filename + ' !');              
                }
            } else {
                _via_images[img_id] = new ImageAttributes(user_selected_images[i], filename, size);
                _via_image_id_list.push(img_id);
                _via_images_count += 1;
                _via_reload_img_table = true;
            }
        } else {
            discarded_file_count += 1;
        }
    }

    if ( _via_images ) {
        var status_msg = 'Loaded ' + (_via_images_count - original_image_count) + ' images.';
        if (discarded_file_count) {
            status_msg += ' ( Discarded ' + discarded_file_count + ' non-image files! )';
        }
        show_message( status_msg, VIA_THEME_MESSAGE_TIMEOUT_MS);
        
        if (_via_image_index == -1) {
            show_image(0);
        } else {
            show_image( original_image_count );
        }
    } else {
        show_message("Please upload some image files!", VIA_THEME_MESSAGE_TIMEOUT_MS);
    }
}

function upload_local_face_labels(event) {
    var selected_files = event.target.files;
    for (var i=0; i<selected_files.length; ++i) {
	var file = selected_files[i];
	if (file.type.includes('image/') &&
	   file.size < 1024*VIA_FACE_LABEL_MAX_SIZE_KB) {
            load_local_image(file);
	} else {
	    show_message('Discarded face label images  > ' + VIA_FACE_LABEL_MAX_SIZE_KB + 'KB', VIA_THEME_MESSAGE_TIMEOUT_MS);
	}
    }
}

//
// Data Importer
//

function import_region_attributes_from_file(event) {
    var selected_files = event.target.files;
    for (var i=0; i<selected_files.length; ++i) {
        var file = selected_files[i];
        switch(file.type) {
        case 'text/csv':
            load_text_file(file, import_region_attributes_from_csv);
            break;
        }
    }
}

function import_region_attributes_from_csv(data) {
    data = data.replace(/\n/g, ''); // discard newline \n
    var csvdata = data.split(',');
    var attributes_import_count = 0;
    for (var i=0; i<csvdata.length; ++i) {
        if ( !_via_region_attributes.has(csvdata[i]) ) {
            _via_region_attributes.add(csvdata[i]);
            attributes_import_count += 1;
        }
    }

    _via_reload_img_table = true;
    show_region_attributes_info();
    show_message('Imported ' + attributes_import_count + ' attributes from CSV file');
    save_current_data_to_browser_cache();
}

function import_region_data_from_file(event) {
    var selected_files = event.target.files;
    for (var file of selected_files) {
        switch(file.type) {
        case 'text/plain':
        case 'text/csv':
            load_text_file(file, import_region_data_from_csv);
            break;
        case 'text/json':
        case 'application/json':
            load_text_file(file, import_region_data_from_json);
            break;
        }
    }
}
function import_region_data_from_csv(data) {
    var csvdata = data.split('\n');
    var region_import_count = 0;
    var file_attr_count = 0;
    var image_count = 0;
    for (var i=0; i<csvdata.length; ++i) {
        if (csvdata[i].charAt(0) == VIA_IMPORT_CSV_COMMENT_CHAR) {
            // ignore header
            // #filename,file_size,face_count,face_id,x,y,width,height,face_label
            continue;
        } else {
            var d = csvdata[i].split(',');
	    if (d.length != 9) {
		// ignore row
		continue;
	    }
            
            var filename = d[0];
            var size = d[1];
            var image_id = _via_get_image_id(filename, size);
            if ( _via_images.hasOwnProperty(image_id) ) {
                image_count += 1;
                
                var regioni = new ImageRegion();
		regioni.shape_attributes.set('x', d[4]);
		regioni.shape_attributes.set('y', d[5]);
		regioni.shape_attributes.set('width', d[6]);
		regioni.shape_attributes.set('height', d[7]);

		var rattr = d[8].replace(/"/g, '');
		regioni.region_attributes.set(VIA_FACE_LABEL_ATTR_NAME, rattr);
             
                _via_images[image_id].regions.push(regioni);
                region_import_count += 1;
	    }
        }
    }
    show_message('Imported [' + region_import_count + '] regions and [' + file_attr_count + '] file attributes for ' + image_count + ' images from CSV file', VIA_THEME_MESSAGE_TIMEOUT_MS);

    _via_reload_img_table = true;
    show_image(_via_image_index);
    save_current_data_to_browser_cache();
}

function import_region_data_from_json(data) {
    var d = JSON.parse(data);

    var image_count = 0;
    var region_import_count = 0;
    var file_attr_count = 0;
    var skipped_file_attr_count = 0;
    for (image_id in d) {
        if ( _via_images.hasOwnProperty(image_id) ) {
            image_count += 1;
            
            // copy regions
            var regions = d[image_id].regions;
            for (var i in regions) {
                var regioni = new ImageRegion();
                for (var key in regions[i].shape_attributes) {
                    regioni.shape_attributes.set(key, regions[i].shape_attributes[key]);
                }
                for (var key in regions[i].region_attributes) {
                    regioni.region_attributes.set(key, regions[i].region_attributes[key]);

                    if (!_via_region_attributes.has(key)) {
                        _via_region_attributes.add(key);
                    }
                }

                // add regions only if they are present
                if (regioni.shape_attributes.size > 0 ||
                    regioni.region_attributes.size > 0 ) {
                    _via_images[image_id].regions.push(regioni);
                    region_import_count += 1;
                }
            }
        }
    }

    show_message('Imported [' + region_import_count + '] regions and [' + file_attr_count + '] file attributes for ' + image_count + ' images from JSON file', VIA_THEME_MESSAGE_TIMEOUT_MS);
    
    _via_reload_img_table = true;
    show_image(_via_image_index);
}

// key1=val1;key2=val2;...
function keyval_str_to_map(keyval_str) {
    var keyval_map = new Map();
    var d = keyval_str.split(VIA_IMPORT_CSV_KEYVAL_SEP_CHAR);    
    for (var i=0; i<d.length; ++i) {
        var keyval = d[i].split('=');
        if ( keyval.length == 2 ) {
            keyval_map.set(keyval[0], keyval[1]);
        } else {
            show_message('Skipping malformed values in the imported file');
        }
    }
    return keyval_map;
}

function load_text_file(text_file, callback_function) {
    if (!text_file) {
        return;
    } else {
        text_reader = new FileReader();
        text_reader.addEventListener( "progress", function(e) {
            show_message("Loading data from text file : " + text_file.name + " ... ");
        }, false);

        text_reader.addEventListener( "error", function() {
            show_message("Error loading data from text file :  " + text_file.name + " !");
            callback_function('');
        }, false);
        
        text_reader.addEventListener( "load", function() {
            callback_function(text_reader.result);
        }, false);
        text_reader.readAsText(text_file);
    }
}

function load_local_image(file, callback_function) {
    var filename = file.name.split('.');
    var filename = filename[0]; // remove extension
    var fileparts = filename.split('_');
    var file_id = parseInt(fileparts[0]);
    fileparts.splice(0, 1); // remove file id
    var img_reader = new FileReader();

    img_reader.addEventListener( "load", function() {
	_via_face_label_list[file_id] = fileparts.join(' ');
	_via_face_label_img_list[file_id] = img_reader.result;
	update_attributes_input_panel();
    });
    img_reader.readAsDataURL( file );
}

//
// Data Exporter
//
function package_region_data(return_type) {
    if( return_type == "csv" ) {
        var csvdata = [];
        var csvheader = '#filename,file_size,face_count,face_id,x,y,width,height,' + VIA_FACE_LABEL_ATTR_NAME;
        csvdata.push(csvheader);

        for ( var image_id in _via_images ) {
            var prefix_str = _via_images[image_id].filename;
            prefix_str += "," + _via_images[image_id].size;

            var regions = _via_images[image_id].regions;

            if (regions.length !=0) {
                for (var i=0; i<regions.length; ++i) {
                    var region_shape_attr_str = regions.length + ',' + i + ',';
		    region_shape_attr_str += regions[i].shape_attributes.get('x') + ',';
		    region_shape_attr_str += regions[i].shape_attributes.get('y') + ',';
		    region_shape_attr_str += regions[i].shape_attributes.get('width') + ',';
		    region_shape_attr_str += regions[i].shape_attributes.get('height');

                    var region_attr_str = '"' + regions[i].region_attributes.get(VIA_FACE_LABEL_ATTR_NAME) + '"';
                    
                    csvdata.push('\n' + prefix_str + ',' + region_shape_attr_str + ',' + region_attr_str);
                }
            }
        }
        return csvdata;
    } else {
        // JSON.stringify() does not work with Map()
        // hence, we cast everything as objects
        var _via_images_as_obj = {};
        for (image_id in _via_images) {
            var image_data = {};
            image_data.size = _via_images[image_id].size;
            image_data.filename = _via_images[image_id].filename;
            
            // copy all region shape_attributes
            image_data.regions = {};
            for (var i=0; i<_via_images[image_id].regions.length; ++i) {
                image_data.regions[i] = {};
                image_data.regions[i].shape_attributes = {};
                image_data.regions[i].region_attributes = {};
                // copy region shape_attributes
                for ( var key of _via_images[image_id].regions[i].shape_attributes.keys()) {
                    var value = _via_images[image_id].regions[i].shape_attributes.get(key);
                    image_data.regions[i].shape_attributes[key] = value;
                }
                // copy region_attributes
                for ( var key of _via_images[image_id].regions[i].region_attributes.keys()) {
                    var value = _via_images[image_id].regions[i].region_attributes.get(key);
                    image_data.regions[i].region_attributes[key] = value;
                }
            }           
            _via_images_as_obj[image_id] = image_data;
        }
        return [JSON.stringify(_via_images_as_obj)];
    }    
}

function attr_map_to_str(attr) {
    var attr_map_str = [];
    for( var key of attr.keys() ) {
        var value = attr.get(key);
        if ( Array.isArray(value) ) {
            var value_str='[' + value[0];
            for (var i=1; i<value.length; ++i) {
                value_str += VIA_EXPORT_CSV_ARRAY_SEP_CHAR + value[i];
            }
            value_str += ']';
            attr_map_str.push(key + '=' + value_str);
        } else {
	    value = remove_special_chars(value);
            attr_map_str.push(key + '=' + value);
        }
    }
    var str_val = '"' + attr_map_str.join(VIA_IMPORT_CSV_KEYVAL_SEP_CHAR) + '"';
    return str_val;
}

function remove_special_chars(str) {
    str1 = str;
    for (var key in VIA_SPECIAL_CHAR_SUBS) {
	str1 = str1.replace(key, VIA_SPECIAL_CHAR_SUBS[key]);
    }
    return str1;
}

function substitute_special_chars(str) {
    str1 = str;
    for (var key in VIA_SPECIAL_CHAR_SUBS) {
	var value = VIA_SPECIAL_CHAR_SUBS[key];
	str1 = str1.replace(value, key);
    }
    return str1;
}

function save_data_to_local_file(data, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(data);
    a.target = '_blank';
    a.download = filename;

    // simulate a mouse click event
    var event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    
    a.dispatchEvent(event);
}

//
// Setup Elements in User Interface
//
function show_image(image_index) {
    if (_via_is_loading_current_image) {
	return;
    }
    
    var img_id = _via_image_id_list[image_index]
    if (_via_images.hasOwnProperty(img_id)) {
        var img_filename = _via_images[img_id].filename;
        var img_reader = new FileReader();
	_via_is_loading_current_image = true;

	img_reader.addEventListener( "loadstart", function(e) {
	    document.getElementById("info_current_filename").innerHTML = "Loading image ...";
	}, false);
	
        img_reader.addEventListener( "progress", function(e) {
            //show_message("Loading image " + img_filename + " ... ", 1000);
        }, false);

        img_reader.addEventListener( "error", function() {
            show_message("Error loading image " + img_filename + " !");
        }, false);
        
        img_reader.addEventListener( "load", function() {
            _via_current_image = new Image();
            _via_current_image.addEventListener( "load", function() {
                _via_image_id = img_id;
                _via_image_index = image_index;
                _via_current_image_filename = img_filename;
                _via_current_image_loaded = true;
		_via_is_loading_current_image = false;
                
                // retrive image panel dim. to stretch _via_canvas to fit panel
                //main_content_width = 0.9*image_panel.offsetWidth;
                canvas_panel_width = document.documentElement.clientWidth - 320;
                canvas_panel_height = document.documentElement.clientHeight - 2.2*navbar_panel.offsetHeight;
                
                _via_canvas_width = _via_current_image.naturalWidth;
                _via_canvas_height = _via_current_image.naturalHeight;

                var scale_width, scale_height;
                if ( _via_canvas_width > canvas_panel_width ) {
                    // resize image to match the panel width
                    var scale_width = canvas_panel_width / _via_current_image.naturalWidth;
                    _via_canvas_width = canvas_panel_width;
                    _via_canvas_height = _via_current_image.naturalHeight * scale_width;
                }
                // resize image if its height is larger than the image panel
                if ( _via_canvas_height > canvas_panel_height ) {
                    var scale_height = canvas_panel_height / _via_canvas_height;
                    _via_canvas_height = canvas_panel_height;
                    _via_canvas_width = _via_canvas_width * scale_height;
                }

                _via_canvas_width = Math.round(_via_canvas_width);
                _via_canvas_height = Math.round(_via_canvas_height);
                _via_canvas_scale = _via_current_image.naturalWidth / _via_canvas_width;
                _via_canvas_scale_without_zoom = _via_canvas_scale;
                
                // set the canvas size to match that of the image
                _via_canvas.height = _via_canvas_height;
                _via_canvas.width = _via_canvas_width;
                //console.log("Canvas = " + _via_canvas.width + "," + _via_canvas.height);
                
                _via_click_x0 = 0; _via_click_y0 = 0;
                _via_click_x1 = 0; _via_click_y1 = 0;
                _via_is_user_drawing_region = false;
                _via_is_window_resized = false;
                _via_is_user_resizing_region = false;
                _via_is_user_moving_region = false;
                _via_is_user_drawing_polygon = false;
                _via_is_region_selected = false;
                _via_user_sel_region_id = -1;
                
                clear_image_display_area();
                _via_canvas.style.display = "inline";

                // refresh the image list
                _via_reload_img_table = true;
                if (_via_is_loaded_img_list_visible) {
                    show_img_list();
                }

                // refresh the attributes panel
                update_attributes_input_panel();

                _via_load_canvas_regions(); // image to canvas space transform
                _via_redraw_canvas();
                _via_canvas.focus();

                // update the info panel
                show_filename_info();
                show_region_attributes_info();
                show_region_shape_info();
                
                //show_message("Loaded image " + img_filename + " ... ", 5000);
            });
            _via_current_image.src = img_reader.result;
        }, false);
        
        if (_via_images[img_id].base64_img_data == '') {
            // load image from file
            img_reader.readAsDataURL( _via_images[img_id].fileref );
        } else {
            // load image from bae64 data
            img_reader.readAsText( new Blob([_via_images[img_id].base64_img_data]) );
        }
    }
}

// transform regions in image space to canvas space
function _via_load_canvas_regions() {
    // load all existing annotations into _via_canvas_regions
    var regions = _via_images[_via_image_id].regions;
    _via_canvas_regions  = [];
    for ( var i=0; i<regions.length; ++i) {
        var regioni = new ImageRegion();
        for ( var key of regions[i].shape_attributes.keys() ) {
            var value = regions[i].shape_attributes.get(key);
            regioni.shape_attributes.set(key, value);
        }
        _via_canvas_regions.push(regioni);

        var x = regions[i].shape_attributes.get('x') / _via_canvas_scale;
        var y = regions[i].shape_attributes.get('y') / _via_canvas_scale;
        var width = regions[i].shape_attributes.get('width') / _via_canvas_scale;
        var height = regions[i].shape_attributes.get('height') / _via_canvas_scale;
        
        _via_canvas_regions[i].shape_attributes.set('x', Math.round(x));
        _via_canvas_regions[i].shape_attributes.set('y', Math.round(y));
        _via_canvas_regions[i].shape_attributes.set('width', Math.round(width));
        _via_canvas_regions[i].shape_attributes.set('height', Math.round(height));
    }
}

function clear_image_display_area() {
    _via_canvas.style.display = "none";
    document.getElementById('about_panel').style.display = 'none';
    document.getElementById('start_info_panel').style.display = 'none';
    document.getElementById('getting_started_panel').style.display = 'none';
}

function delete_selected_regions() {
    var del_region_count = 0;
    if (_via_is_all_region_selected) {
        del_region_count = _via_canvas_regions.length;  
        _via_canvas_regions.splice(0);
        _via_images[_via_image_id].regions.splice(0);
    } else {
        var sorted_sel_reg_id = [];
        for (var i=0; i<_via_canvas_regions.length; ++i) {
            if (_via_canvas_regions[i].is_user_selected) {
                sorted_sel_reg_id.push(i);
            }
        }       
        sorted_sel_reg_id.sort( function(a,b) {
            return (b-a);
        });
        for (var i=0; i<sorted_sel_reg_id.length; ++i) {
            _via_canvas_regions.splice( sorted_sel_reg_id[i], 1);
            _via_images[_via_image_id].regions.splice( sorted_sel_reg_id[i], 1);
            del_region_count += 1;
        }
    }

    _via_is_all_region_selected = false;
    _via_is_region_selected = false;
    _via_user_sel_region_id = -1;
    
    _via_redraw_canvas();
    _via_canvas.focus();
    show_region_shape_info();

    show_message('Deleted ' + del_region_count + ' selected regions');

    save_current_data_to_browser_cache();
}

//
// UI Control Elements (buttons, etc)
//

// updates currently selected region shape
function select_region_shape(sel_shape_name) {
    for (var shape_name in VIA_REGION_SHAPE) {
        var ui_element = document.getElementById('region_shape_' + VIA_REGION_SHAPE[shape_name]);
        ui_element.classList.remove('region_shape_selected');
    }

    _via_current_shape = sel_shape_name;
    var ui_element = document.getElementById('region_shape_' + _via_current_shape);
    ui_element.classList.add('region_shape_selected');

    if ( _via_current_shape != VIA_REGION_SHAPE.POLYGON ) {
        _via_is_user_drawing_polygon = false;
        _via_current_polygon_region_id = -1;
        show_message('Press single click and drag mouse to draw ' + _via_current_shape + ' region', VIA_THEME_MESSAGE_TIMEOUT_MS);
    } else {
        show_message('Press single click to define polygon vertices. Note: in Polygon drawing mode, single click cannot be used to un-select regions');
    }
}

// enter annotation mode on double click
_via_canvas.addEventListener('dblclick', function(e) {
    show_message('Double clicks are not used in this application', VIA_THEME_MESSAGE_TIMEOUT_MS);
}, false);

// user clicks on the canvas
_via_canvas.addEventListener('mousedown', function(e) {
    _via_click_x0 = e.offsetX; _via_click_y0 = e.offsetY;
    _via_region_edge = is_on_region_corner(_via_click_x0, _via_click_y0);
    var region_id = is_inside_region(_via_click_x0, _via_click_y0);
    
    if ( _via_is_region_selected ) {
        // check if user clicked on the region boundary
        if ( _via_region_edge[1] > 0 ) {
            if ( !_via_is_user_resizing_region ) {
                // resize region
                if ( _via_region_edge[0] != _via_user_sel_region_id ) {
                    _via_user_sel_region_id = _via_region_edge[0];
                }
                _via_is_user_resizing_region = true;
            }
        } else {
            // check if user clicked inside a region
            if ( region_id == _via_user_sel_region_id ) {
                if( !_via_is_user_moving_region ) {     
                    _via_is_user_moving_region = true;
                    _via_region_click_x = _via_click_x0;
                    _via_region_click_y = _via_click_y0;
                }
            } else {
                if ( region_id == -1 ) {
                    // mousedown on outside any region
                    _via_is_user_drawing_region = true;
                    // unselect all regions
                    _via_is_region_selected = false;
                    _via_user_sel_region_id = -1;
                    toggle_all_regions_selection(false);
                }
            }
        }
    } else {
        if ( region_id == -1 ) {
            // mouse was clicked outside a region
            if (_via_current_shape != VIA_REGION_SHAPE.POLYGON) {
                // this is a bounding box drawing event
                _via_is_user_drawing_region = true;
            }
        }
    }
    e.preventDefault();
}, false);

// implements the following functionalities:
//  - new region drawing (including polygon)
//  - moving/resizing/select/unselect existing region
_via_canvas.addEventListener('mouseup', function(e) {
    _via_click_x1 = e.offsetX; _via_click_y1 = e.offsetY;

    var click_dx = Math.abs(_via_click_x1 - _via_click_x0);
    var click_dy = Math.abs(_via_click_y1 - _via_click_y0);

    // indicates that user has finished moving a region
    if ( _via_is_user_moving_region ) {
        _via_is_user_moving_region = false;
        _via_canvas.style.cursor = "default";

        var move_x = Math.round(_via_click_x1 - _via_region_click_x);
        var move_y = Math.round(_via_click_y1 - _via_region_click_y);

        // @todo: update the region data
        var image_attr = _via_images[_via_image_id].regions[_via_user_sel_region_id].shape_attributes;
        var canvas_attr = _via_canvas_regions[_via_user_sel_region_id].shape_attributes;
        
        var xnew = image_attr.get('x') + Math.round(move_x * _via_canvas_scale);
        var ynew = image_attr.get('y') + Math.round(move_y * _via_canvas_scale);
        image_attr.set('x', xnew);
        image_attr.set('y', ynew);

        var canvas_xnew = canvas_attr.get('x') + move_x;
        var canvas_ynew = canvas_attr.get('y') + move_y;
        canvas_attr.set('x', canvas_xnew);
        canvas_attr.set('y', canvas_ynew);
        
        _via_redraw_canvas();
        _via_canvas.focus();
        save_current_data_to_browser_cache();
        return;
    }

    // indicates that user has finished resizing a region
    if ( _via_is_user_resizing_region ) {
        // _via_click(x0,y0) to _via_click(x1,y1)
        _via_is_user_resizing_region = false;
        _via_canvas.style.cursor = "default";
        
        // update the region
        var region_id = _via_region_edge[0];
        var image_attr = _via_images[_via_image_id].regions[region_id].shape_attributes;
        var canvas_attr = _via_canvas_regions[region_id].shape_attributes;
        
        var x0 = canvas_attr.get('x');
        var y0 = canvas_attr.get('y');
        var x1 = x0 + canvas_attr.get('width');
        var y1 = y0 + canvas_attr.get('height');

        switch(_via_region_edge[1]) {
        case 1: // top-left
            x0 = _via_current_x;
            y0 = _via_current_y;
            break;
        case 3: // bottom-right
            x1 = _via_current_x;
            y1 = _via_current_y;
            break;
        case 2: // top-right
            x1 = _via_current_x;
            y0 = _via_current_y;
            break;
        case 4: // bottom-left
            x0 = _via_current_x;
            y1 = _via_current_y;
            break;
        }
        var w = Math.abs(x1-x0);
        var h = Math.abs(y1-y0);
        image_attr.set('x', Math.round(x0 * _via_canvas_scale));
        image_attr.set('y', Math.round(y0 * _via_canvas_scale));
        image_attr.set('width', Math.round(w * _via_canvas_scale));
        image_attr.set('height', Math.round(h * _via_canvas_scale));

        canvas_attr.set('x', x0);
        canvas_attr.set('y', y0);
        canvas_attr.set('width', w);
        canvas_attr.set('height', h);

        _via_redraw_canvas();
        _via_canvas.focus();
        save_current_data_to_browser_cache();
        return;
    }
    
    // denotes a single click (= mouse down + mouse up)
    if ( click_dx < 5 ||
         click_dy < 5 ) {
        var region_id = is_inside_region(_via_click_x0, _via_click_y0);
        if ( region_id >= 0 ) {
            // first click selects region
            _via_user_sel_region_id = region_id;
            _via_is_region_selected = true;
            _via_is_user_moving_region = false;
            
            // de-select all other regions if the user has not pressed Shift
            if ( !e.shiftKey ) {
                toggle_all_regions_selection(false);
            }
            _via_canvas_regions[region_id].is_user_selected = true;

            show_message('Region selected. Click and drag to move or resize the region', VIA_THEME_MESSAGE_TIMEOUT_MS);
            show_region_attributes_info();
            show_region_shape_info();
        } else {
            if ( _via_is_user_drawing_region ) {
                // clear all region selection
                _via_is_user_drawing_region = false;
                toggle_all_regions_selection(false);
                
                show_region_attributes_info();
                show_region_shape_info();
            }
        }
        _via_redraw_canvas();
        _via_canvas.focus();
	update_attributes_input_panel();
        return;
    }

    // indicates that user has finished drawing a new region
    if (_via_is_user_drawing_region) {
        
        _via_is_user_drawing_region = false;
        
        var region_x0, region_y0, region_x1, region_y1;
        // ensure that (x0,y0) is top-left and (x1,y1) is bottom-right
        if ( _via_click_x0 < _via_click_x1 ) {
            region_x0 = _via_click_x0;
            region_x1 = _via_click_x1;
        } else {
            region_x0 = _via_click_x1;
            region_x1 = _via_click_x0;
        }

        if ( _via_click_y0 < _via_click_y1 ) {
            region_y0 = _via_click_y0;
            region_y1 = _via_click_y1;
        } else {
            region_y0 = _via_click_y1;
            region_y1 = _via_click_y0;
        }

        var original_img_region = new ImageRegion();
        var canvas_img_region = new ImageRegion();
        var region_dx = Math.abs(region_x1 - region_x0);
        var region_dy = Math.abs(region_y1 - region_y0);

        // newly drawn region is automatically selected
        toggle_all_regions_selection(false);
        canvas_img_region.is_user_selected = true;
        _via_is_region_selected = true;
        _via_user_sel_region_id = _via_canvas_regions.length; // new region's id
        
        if ( region_dx > VIA_REGION_MIN_DIM ||
             region_dy > VIA_REGION_MIN_DIM ) { // avoid regions with 0 dim
                original_img_region.shape_attributes.set('name', 'rect');
            original_img_region.shape_attributes.set('x', Math.round(region_x0 * _via_canvas_scale));
            original_img_region.shape_attributes.set('y', Math.round(region_y0 * _via_canvas_scale));
            original_img_region.shape_attributes.set('width', Math.round(region_dx * _via_canvas_scale));
            original_img_region.shape_attributes.set('height', Math.round(region_dy * _via_canvas_scale));

            canvas_img_region.shape_attributes.set('name', 'rect');
            canvas_img_region.shape_attributes.set('x', Math.round(region_x0));
            canvas_img_region.shape_attributes.set('y', Math.round(region_y0));
            canvas_img_region.shape_attributes.set('width', Math.round(region_dx));
            canvas_img_region.shape_attributes.set('height', Math.round(region_dy));

            _via_images[_via_image_id].regions.push(original_img_region);
            _via_canvas_regions.push(canvas_img_region);
        } else {
            show_message('Skipped adding a ' + _via_current_shape + ' of nearly 0 dimension', VIA_THEME_MESSAGE_TIMEOUT_MS);
        }
        update_attributes_input_panel();
	_via_reload_img_table = true;
	show_img_list();

        _via_redraw_canvas();
        _via_canvas.focus();
        show_region_attributes_info();
        show_region_shape_info();

        save_current_data_to_browser_cache();
        return;
    }    
});

function toggle_all_regions_selection(is_selected) {
    for (var i=0; i<_via_canvas_regions.length; ++i) {
        _via_canvas_regions[i].is_user_selected = is_selected;
    }
    _via_is_all_region_selected = is_selected;
}

function select_only_region(region_id) {
    toggle_all_regions_selection(false);
    _via_canvas_regions[region_id].is_user_selected = true;
    _via_user_sel_region_id = region_id;
    _via_is_region_selected = true;
}

_via_canvas.addEventListener("mouseover", function(e) {
    // change the mouse cursor icon
    _via_redraw_canvas();
    _via_canvas.focus();
});

_via_canvas.addEventListener('mousemove', function(e) {
    if ( !_via_current_image_loaded ) {
        return;
    }
    
    _via_current_x = e.offsetX; _via_current_y = e.offsetY;

    if ( _via_is_region_selected ) {
        if ( !_via_is_user_resizing_region ) {
            // check if user moved mouse cursor to region boundary
            // which indicates an intention to resize the reigon
            
            _via_region_edge = is_on_region_corner(_via_current_x, _via_current_y);

            if ( _via_region_edge[0] == _via_user_sel_region_id ) {
                switch(_via_region_edge[1]) {
                    // rect
                case 1: // top-left corner of rect
                case 3: // bottom-right corner of rect
                    _via_canvas.style.cursor = "nwse-resize";
                    break;
                case 2: // top-right corner of rect
                case 4: // bottom-left corner of rect
                    _via_canvas.style.cursor = "nesw-resize";
                    break;
		}
            } else {
                var region_id = is_inside_region(_via_current_x, _via_current_y);
                if ( region_id == _via_user_sel_region_id ) {
                    _via_canvas.style.cursor = "move";
                } else {
                    _via_canvas.style.cursor = "default";
                }
            }
        }
    }
    
    if(_via_is_user_drawing_region) {
        // draw rectangle as the user drags the mouse cousor
        _via_redraw_canvas(); // clear old intermediate rectangle

        var region_x0, region_y0;

        if ( _via_click_x0 < _via_current_x ) {
            if ( _via_click_y0 < _via_current_y ) {
                region_x0 = _via_click_x0;
                region_y0 = _via_click_y0;
            } else {
                region_x0 = _via_click_x0;
                region_y0 = _via_current_y;
            }
        } else {
            if ( _via_click_y0 < _via_current_y ) {
                region_x0 = _via_current_x;
                region_y0 = _via_click_y0;
            } else {
                region_x0 = _via_current_x;
                region_y0 = _via_current_y;
            }
        }
        var dx = Math.round(Math.abs(_via_current_x - _via_click_x0));
        var dy = Math.round(Math.abs(_via_current_y - _via_click_y0));

        _via_draw_rect_region(region_x0,
                              region_y0,
                              dx,
                              dy);
        _via_canvas.focus();
    }
    
    if ( _via_is_user_resizing_region ) {
        // user has clicked mouse on bounding box edge and is now moving it
        _via_redraw_canvas(); // clear old intermediate rectangle

        var region_id = _via_region_edge[0];
        var attr = _via_canvas_regions[region_id].shape_attributes;
        var x0 = _via_canvas_regions[region_id].shape_attributes.get('x');
        var y0 = _via_canvas_regions[region_id].shape_attributes.get('y');
        var x1 = x0 + _via_canvas_regions[region_id].shape_attributes.get('width');
        var y1 = y0 + _via_canvas_regions[region_id].shape_attributes.get('height');

        switch(_via_region_edge[1]) {
        case 1: // top-left
            x0 = _via_current_x;
            y0 = _via_current_y;
            break;
        case 3: // bottom-right
            x1 = _via_current_x;
            y1 = _via_current_y;
            break;
        case 2: // top-right
            x1 = _via_current_x;
            y0 = _via_current_y;
            break;
        case 4: // bottom-left
            x0 = _via_current_x;
            y1 = _via_current_y;
            break;
        }
        _via_draw_rect_region(x0,
                              y0,
                              Math.abs(x1-x0),
                              Math.abs(y1-y0),
                              true);
        _via_canvas.focus();
    }

    if ( _via_is_user_moving_region ) {
        _via_redraw_canvas();
        
        var move_x = (_via_current_x - _via_region_click_x);
        var move_y = (_via_current_y - _via_region_click_y);
        var attr = _via_canvas_regions[_via_user_sel_region_id].shape_attributes;

        _via_draw_rect_region(attr.get('x') + move_x,
                              attr.get('y') + move_y,
                              attr.get('width'),
                              attr.get('height'),
                              true);
        _via_canvas.focus();    
    }

    if ( _via_is_user_drawing_polygon ) {
        _via_redraw_canvas();
        var attr = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes;
        var all_points_x = attr.get('all_points_x');
        var all_points_y = attr.get('all_points_y');
        var npts = all_points_x.length;

        var line_x = [all_points_x.slice(npts-1), _via_current_x];
        var line_y = [all_points_y.slice(npts-1), _via_current_y];
        _via_draw_polygon_region(line_x, line_y, false);
    }
});

function toggle_img_list() {
    if (_via_is_loaded_img_list_visible) {
        loaded_img_list_panel.style.width = "0";
        _via_is_loaded_img_list_visible = false;
        return;
    } else {
	_via_is_loaded_img_list_visible = true;
        show_img_list();
    }

}

// @todo: implement hierarchial clustering to better visualize file list
function show_img_list() {
    if (_via_images_count == 0) {
	show_message("Please load some images first!", VIA_THEME_MESSAGE_TIMEOUT_MS);
	return;
    }

    if(_via_is_loaded_img_list_visible) {
	if ( _via_reload_img_table ) {
	    _via_loaded_img_fn_list = [];
	    _via_loaded_img_region_attr_miss_count = [];
	    
	    for (var i=0; i<_via_images_count; ++i) {
		img_id = _via_image_id_list[i];
		_via_loaded_img_fn_list[i] = _via_images[img_id].filename;
		_via_loaded_img_region_attr_miss_count[i] = count_missing_region_attr(img_id);
	    }
	    
	    _via_loaded_img_table_html = [];
	    //_via_loaded_img_table_html.push('<span style="display: block; border-bottom: 1px solid #5599ff;">Image List</span>');
	    _via_loaded_img_table_html.push('<span id="panel_close_button" onclick="toggle_img_list()">&times</span>');
	    _via_loaded_img_table_html.push('<h3>Image List</h3>');
	    _via_loaded_img_table_html.push('<ul>');
	    for (var i=0; i<_via_images_count; ++i) {
		var fni = '';
		if (i == _via_image_index) {
		    // highlight the current entry
		    fni += '<li style="cursor: default;"><b>[' + (i+1) + '] ' + _via_loaded_img_fn_list[i] + '</b>';
		} else {
		    fni += '<li onclick="jump_to_image(' + (i) + ')">[' + (i+1) + '] ' + _via_loaded_img_fn_list[i];
		}

		if (_via_loaded_img_region_attr_miss_count[i]) {
		    fni += ' (' + '<span style="color: red;">' + _via_loaded_img_region_attr_miss_count[i] + '</span>' + ')'
		}
		
		fni += '</li>';
		_via_loaded_img_table_html.push(fni);
	    }
	    _via_loaded_img_table_html.push('</ul>');
	    _via_reload_img_table = false;
	}

	loaded_img_list_panel.innerHTML = _via_loaded_img_table_html.join('');
	loaded_img_list_panel.style.width = "300px";
    }
}

function jump_to_image(image_index) {
    if ( image_index >=0 &&
	 image_index < _via_images_count) {
	show_image(image_index);
    }
}

function count_missing_region_attr(img_id) {
    var miss_region_attr_count = 0;
    for( var i=0; i<_via_images[img_id].regions.length; ++i) {
	var rattr = _via_images[img_id].regions[i].region_attributes;
	if (rattr.get(VIA_FACE_LABEL_ATTR_NAME) == 'undefined' ||
	    rattr.get(VIA_FACE_LABEL_ATTR_NAME) == '' ||
	    !rattr.has(VIA_FACE_LABEL_ATTR_NAME)) {
	    miss_region_attr_count += 1;
	}
    }
    return miss_region_attr_count;
}

//
// Canvas update routines
//

function _via_redraw_canvas() {
    if (_via_current_image_loaded) {
	_via_ctx.clearRect(0, 0, _via_canvas.width, _via_canvas.height);
	_via_ctx.drawImage(_via_current_image, 0, 0, _via_canvas.width, _via_canvas.height);

	if ( _via_canvas_regions.length > 0 ) {
	    draw_all_regions();
	    draw_all_region_id();
	}
    }
}

function draw_all_regions() {
    for (var i=0; i < _via_canvas_regions.length; ++i) {
	var attr = _via_canvas_regions[i].shape_attributes;
	var is_selected = _via_canvas_regions[i].is_user_selected;
	
	_via_draw_rect_region(attr.get('x'),
			      attr.get('y'),
			      attr.get('width'),
			      attr.get('height'),
			      is_selected);
    }
}

function _via_draw_rect_region(x, y, w, h, is_selected) {
    if (is_selected) {
	_via_draw_rect(x, y, w, h);
	
	_via_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
	_via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
	_via_ctx.stroke();

	_via_ctx.fillStyle = VIA_THEME_SEL_REGION_FILL_COLOR;
	_via_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
	_via_ctx.fill();
	_via_ctx.globalAlpha = 1.0;
    } else {
	// draw a fill line
	_via_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
	_via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
	_via_draw_rect(x, y, w, h);
	_via_ctx.stroke();

	if ( w > VIA_THEME_REGION_BOUNDARY_WIDTH &&
	     h > VIA_THEME_REGION_BOUNDARY_WIDTH ) {
	    // draw a boundary line on both sides of the fill line
	    _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
	    _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
	    _via_draw_rect(x - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
			   y - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
			   w + VIA_THEME_REGION_BOUNDARY_WIDTH,
			   h + VIA_THEME_REGION_BOUNDARY_WIDTH);
	    _via_ctx.stroke();

	    _via_draw_rect(x + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
			   y + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
			   w - VIA_THEME_REGION_BOUNDARY_WIDTH,
			   h - VIA_THEME_REGION_BOUNDARY_WIDTH);
	    _via_ctx.stroke();
	}
    }
}

function _via_draw_rect(x, y, w, h) {
    _via_ctx.beginPath();
    _via_ctx.moveTo(x  , y);
    _via_ctx.lineTo(x+w, y);
    _via_ctx.lineTo(x+w, y+h);
    _via_ctx.lineTo(x  , y+h);
    _via_ctx.closePath();
}

function draw_all_region_id() { 
    _via_ctx.shadowColor = "transparent";
    for (var i=0; i < _via_images[_via_image_id].regions.length; ++i) {
	var rattr = _via_images[_via_image_id].regions[i].region_attributes;
	var annotation_str = '?';
	if (rattr.has(VIA_FACE_LABEL_ATTR_NAME)) {
	    annotation_str = rattr.get(VIA_FACE_LABEL_ATTR_NAME);
	}

	var bbox = get_canvas_region_bounding_box(i);

	var x = bbox[0];
	var y = bbox[1];
	var w = Math.abs(bbox[2] - bbox[0]);
	var h = Math.abs(bbox[3] - bbox[1]);
	_via_ctx.font = '8pt Sans';

	var bgnd_rect_height = 1.8 * _via_ctx.measureText('M').width;
	var bgnd_rect_width = _via_ctx.measureText(annotation_str).width;

	if ( bgnd_rect_width > w ) {
	    var max_str_len = Math.round(annotation_str.length * (w/bgnd_rect_width)) - 2;
	    annotation_str = annotation_str.substring(0, max_str_len) + '.';
	    bgnd_rect_width = w;
	} else {
	    bgnd_rect_width = bgnd_rect_width + 0.6*bgnd_rect_height;
	}

	// first, draw a background rectangle first
	_via_ctx.fillStyle = 'black';
	_via_ctx.globalAlpha=0.8;
	_via_ctx.fillRect(x,
			  y - bgnd_rect_height,
			  bgnd_rect_width,
			  bgnd_rect_height);
	
	// then, draw text over this background rectangle
	_via_ctx.globalAlpha=1.0;
	_via_ctx.fillStyle = 'yellow';
	_via_ctx.fillText(annotation_str,
			  x+bgnd_rect_height/4,
			  y - bgnd_rect_height/3);

    }
}

function get_canvas_region_bounding_box(region_id) {
    var bbox = new Array(4);
    var d = _via_canvas_regions[region_id].shape_attributes;
    bbox[0] = d.get('x');
    bbox[1] = d.get('y');
    bbox[2] = d.get('x') + d.get('width');
    bbox[3] = d.get('y') + d.get('height');;
    return bbox;
}

//
// Region collision routines
//
function is_inside_region(px, py) {
    for (var i=0; i < _via_canvas_regions.length; ++i) {
	var attr = _via_canvas_regions[i].shape_attributes;
	var result = false;
	
	result = is_inside_rect(attr.get('x'),
				attr.get('y'),
				attr.get('width'),
				attr.get('height'),
				px, py);

	if (result) {
	    return i;
	}
    }    
    return -1;
}

function is_on_region_corner(px, py) {
    var _via_region_edge = [-1, -1]; // region_id, corner_id [top-left=1,top-right=2,bottom-right=3,bottom-left=4]
    
    for (var i=0; i < _via_canvas_regions.length; ++i) {
	var attr = _via_canvas_regions[i].shape_attributes;
	var result = false;
	_via_region_edge[0] = i;
	
	result = is_on_rect_edge(attr.get('x'),
				 attr.get('y'),
				 attr.get('width'),
				 attr.get('height'),
				 px, py);

	if (result > 0) {
	    _via_region_edge[1] = result;
	    return _via_region_edge;
	}
    }
    _via_region_edge[0] = -1;
    return _via_region_edge;
}

function is_on_rect_edge(x, y, w, h, px, py) {
    var dx0 = Math.abs(x - px);
    var dy0 = Math.abs(y - py);
    var dx1 = Math.abs(x + w - px);
    var dy1 = Math.abs(y + h - py);

    //[top-left=1,top-right=2,bottom-right=3,bottom-left=4]
    if ( dx0 < VIA_REGION_EDGE_TOL &&
	 dy0 < VIA_REGION_EDGE_TOL ) {
	return 1;
    }
    if ( dx1 < VIA_REGION_EDGE_TOL &&
	 dy0 < VIA_REGION_EDGE_TOL ) {
	return 2;
    }
    if ( dx1 < VIA_REGION_EDGE_TOL &&
	 dy1 < VIA_REGION_EDGE_TOL ) {
	return 3;
    }

    if ( dx0 < VIA_REGION_EDGE_TOL &&
	 dy1 < VIA_REGION_EDGE_TOL ) {
	return 4;
    }
    return 0;
}

function is_inside_rect(x, y, w, h, px, py) {
    if ( px > x &&
         px < (x+w) &&
         py > y &&
         py < (y+h) ) {
        return true;
    } else {
        return false;
    }
}

function update_ui_components() {
    if ( !_via_is_window_resized && _via_current_image_loaded ) {
	show_message("Resizing window ...", VIA_THEME_MESSAGE_TIMEOUT_MS);
	_via_is_window_resized = true;
	show_image(_via_image_index);

	reset_zoom_level();
    }
}


window.addEventListener("keydown", function(e) {
    // user commands
    if ( e.ctrlKey ) {
	if ( e.key == 's' ) { // Ctrl + s
	    download_all_region_data('csv');
	    e.preventDefault();
	    return;
	}

	if ( e.key == 'i' ) { // Ctrl + i
	    upload_region_data_file();
	    e.preventDefault();
	    return;
	}

	if ( e.key == 'o' ) { // Ctrl + o
	    load_images('image');
	    e.preventDefault();
	    return;
	}

	if ( e.key == 'a' ) { // Ctrl + a
	    toggle_all_regions_selection(true);
	    _via_is_all_region_selected = true;
	    _via_is_region_selected = false;
	    _via_redraw_canvas();
	    update_attributes_input_panel();

	    e.preventDefault();
	    return;
	}

	if ( e.key == 'c' ) { // Ctrl + c
	    _via_copied_image_regions.splice(0);
	    _via_copied_canvas_regions.splice(0);
	    for (var i=0; i<_via_images[_via_image_id].regions.length; ++i) {
		var img_region = _via_images[_via_image_id].regions[i];
		var canvas_region = _via_canvas_regions[i];
		if (canvas_region.is_user_selected) {
		    _via_copied_image_regions.push( clone_image_region(img_region) );
		    _via_copied_canvas_regions.push( clone_image_region(canvas_region) );
		}
	    }
	    show_message('Copied ' + _via_copied_image_regions.length + ' selected regions. Press Ctrl + v to paste', VIA_THEME_MESSAGE_TIMEOUT_MS);
	    e.preventDefault();
	    return;
	}

	if ( e.key == 'v' ) { // Ctrl + v
	    for (var i=0; i<_via_copied_image_regions.length; ++i) {
		_via_images[_via_image_id].regions.push( _via_copied_image_regions[i] );
		_via_canvas_regions.push( _via_copied_canvas_regions[i] );
	    }
	    show_message('Pasted ' + _via_copied_image_regions.length + ' regions', VIA_THEME_MESSAGE_TIMEOUT_MS);
	    e.preventDefault();
	    _via_redraw_canvas();
	    return;
	}

	if ( e.key == 'f' ) { // f
	    load_images('face_label');
	    e.preventDefault();
	    return;
	}


    }

    if ( (e.altKey || e.metaKey) ) {
	if( e.key == 'd' ) { // Alt + d
	    delete_selected_regions();
	    update_attributes_input_panel();
	    _via_reload_img_table = true;	
	    show_img_list();
	    _via_redraw_canvas();
	    _via_canvas.focus();
	    e.preventDefault();
	    return;
	}
    }
    
    // zoom in/out functionality
    if (e.key == '+') {
	// zoom in
	if (_via_canvas_zoom_level_index == (VIA_CANVAS_ZOOM_LEVELS.length-1)) {
	    show_message('Further zoom-in not possible', VIA_THEME_MESSAGE_TIMEOUT_MS);
	} else {
	    _via_canvas_zoom_level_index += 1;
	    
	    _via_is_canvas_zoomed = true;
	    var zoom_scale = VIA_CANVAS_ZOOM_LEVELS[_via_canvas_zoom_level_index];
	    _via_ctx.scale(zoom_scale, zoom_scale);
	    
	    _via_canvas.height = _via_canvas_height * zoom_scale;
	    _via_canvas.width = _via_canvas_width * zoom_scale;
	    _via_canvas_scale = _via_canvas_scale_without_zoom / zoom_scale;

	    _via_load_canvas_regions(); // image to canvas space transform
	    _via_redraw_canvas();
	    _via_canvas.focus();
	    show_message('Zoomed in to level ' + zoom_scale, VIA_THEME_MESSAGE_TIMEOUT_MS);
	}
	return;         
    }

    if (e.key == '-') {
	// zoom out
	if (_via_canvas_zoom_level_index == 0) {
	    show_message('Further zoom-out not possible', VIA_THEME_MESSAGE_TIMEOUT_MS);
	} else {
	    _via_canvas_zoom_level_index -= 1;
	    
	    _via_is_canvas_zoomed = true;
	    var zoom_scale = VIA_CANVAS_ZOOM_LEVELS[_via_canvas_zoom_level_index];
	    _via_ctx.scale(zoom_scale, zoom_scale);
	    
	    _via_canvas.height = _via_canvas_height * zoom_scale;
	    _via_canvas.width = _via_canvas_width * zoom_scale;
	    _via_canvas_scale = _via_canvas_scale_without_zoom / zoom_scale;

	    _via_load_canvas_regions(); // image to canvas space transform
	    _via_redraw_canvas();
	    _via_canvas.focus();
	    show_message('Zoomed out to level ' + zoom_scale, VIA_THEME_MESSAGE_TIMEOUT_MS);
	}
	return;
    }
    if ( e.key == '0' ) { // 0
	// reset the zoom level
	reset_zoom_level();
	show_message('Zoom reset', VIA_THEME_MESSAGE_TIMEOUT_MS);
	return;
    }

    if ( e.which == 112 ) { // F1
	show_getting_started_panel();
	e.preventDefault();
	return;
    }
    
    if (e.which == 78 || e.which == 39) { // n or right arrow
	move_to_next_image();
	e.preventDefault();
	return;
    }
    if (e.which == 80 || e.which == 37) { // n or right arrow
	move_to_prev_image();
	e.preventDefault();
	return;
    }

    if (e.key == 'a') { // a
	toggle_attributes_input_panel();
	return;
    }
    
    if ( e.key == 'l' ) { // l
	toggle_img_list();
	e.preventDefault();
	return;
    }

    if ( e.which == 27 ) { // Esc
	if ( _via_is_user_resizing_region ) {
	    // cancel region resizing action
	    _via_is_user_resizing_region = false;
	}
	
	if ( _via_is_region_selected ) {
	    // clear all region selections
	    _via_is_region_selected = false;
	    _via_canvas_regions[_via_user_sel_region_id].is_user_selected = false;
	    _via_user_sel_region_id = -1;
	}

	if (_via_is_all_region_selected) {
	    toggle_all_regions_selection(false);
	}

	if ( _via_is_user_drawing_polygon ) {
	    _via_is_user_drawing_polygon = false;
	    _via_canvas_regions.splice(_via_current_polygon_region_id, 1);
	}

	if ( _via_is_user_drawing_region ) {
	    _via_is_user_drawing_region = false;
	}

	if ( _via_is_user_resizing_region ) {
	    _via_is_user_resizing_region = false
	}

	if ( _via_is_user_moving_region ) {
	    _via_is_user_moving_region = false
	}
	
	e.preventDefault();
	_via_redraw_canvas();
	_via_canvas.focus();
	return;
    }

    if ( e.which == 121 ) { // F10 key used for debugging
	print_current_state_vars();
	print_current_image_data();
	e.preventDefault();
	return;
    }
    if (e.which == 113) { // F2 for about
	show_about_panel();
	e.preventDefault();
	return;
    }
    
});

function move_to_prev_image() {
    if (_via_images_count > 0) {
	_via_is_region_selected = false;
	_via_user_sel_region_id = -1;
	_via_is_user_resizing_region = false;
	_via_is_user_moving_region = false;
	_via_is_all_region_selected = false;
	_via_is_canvas_zoomed = false;
	_via_canvas.style.cursor = "default";
	
	if ( _via_image_index == 0 ) {   
	    show_image(_via_images_count - 1);
	} else {
	    show_image(_via_image_index - 1);
	}
    }    
}

function move_to_next_image() {
    if (_via_images_count > 0) {
	_via_is_region_selected = false;
	_via_user_sel_region_id = -1;
	_via_is_user_resizing_region = false;
	_via_is_user_moving_region = false;
	_via_is_all_region_selected = false;
	_via_is_canvas_zoomed = false;
	_via_canvas.style.cursor = "default";
	
	if ( _via_image_index == (_via_images_count-1) ) {   
	    show_image(0);
	} else {
	    show_image(_via_image_index + 1);
	}
    }
}

function reset_zoom_level() {
    _via_is_canvas_zoomed = false;
    _via_canvas_zoom_level_index = VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX
    var zoom_scale = VIA_CANVAS_ZOOM_LEVELS[_via_canvas_zoom_level_index];
    _via_ctx.scale(zoom_scale, zoom_scale);
    
    _via_canvas.height = _via_canvas_height;
    _via_canvas.width = _via_canvas_width;
    _via_canvas_scale = _via_canvas_scale_without_zoom;
    
    _via_load_canvas_regions(); // image to canvas space transform
    _via_redraw_canvas();
    _via_canvas.focus();
}

//
// Update of user interface elements
// Communication from javascript to UI
//
function show_message(msg, timeout_ms) {
    if ( _via_message_clear_timer ) {
	clearTimeout(_via_message_clear_timer); // stop any previous timeouts
    }
    
    document.getElementById('message_panel').innerHTML = msg;

    if ( timeout_ms != undefined ) {
	_via_message_clear_timer = setTimeout( function() {
	    document.getElementById('message_panel').innerHTML = ' ';
	}, timeout_ms);
    }
    return;    
}

function toggle_message_panel() {
    switch(message_panel.style.display) {
    default:
    case 'block':
	message_panel.style.display = 'none';
	break;
	
    case 'none':
	message_panel.style.display = 'block';
	break;
    }
}

function show_all_info() {
    show_filename_info();
    show_region_info();
    show_annotation_info();
}

function show_region_attributes_info() {
    if ( _via_user_sel_region_id != -1 ) {
	var region_set_attr_count = _via_images[_via_image_id].regions[_via_user_sel_region_id].region_attributes.size;
	var region_attr_count = _via_region_attributes.size;

	var missing_attr_count = region_attr_count - region_set_attr_count;
	if (missing_attr_count) {
	    document.getElementById("info_attribute").innerHTML = region_set_attr_count + ' ( ' + (region_attr_count - region_set_attr_count) + ' remaining )';
	} else {
	    document.getElementById("info_attribute").innerHTML = region_set_attr_count;
	}
    } else {
	document.getElementById("info_attribute").innerHTML = "";
    }
}

function show_region_shape_info() {
    if ( _via_current_image_loaded ) {
	document.getElementById("info_region").innerHTML = _via_images[_via_image_id].regions.length;
    } else {
	document.getElementById("info_region").innerHTML = "";
    }
}

function show_filename_info() {
    if ( _via_current_image_loaded ) {
	document.getElementById("info_current_filename").innerHTML = _via_current_image_filename;
	document.getElementById("info_current_fileid").innerHTML = "(" + (_via_image_index+1) + " of " + _via_images_count + ")";
    } else {
	document.getElementById("info_current_filename").innerHTML = "";
	document.getElementById("info_current_fileid").innerHTML = "";
    }
}

//
// Persistence of annotation data in localStorage
//

function check_local_storage() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
    try {
	var x = '__storage_test__';
	localStorage.setItem(x, x);
	localStorage.removeItem(x);
	return true;
    }
    catch(e) {
	return false;
    }
}

function save_current_data_to_browser_cache() {
    setTimeout(function() {
	if ( _via_is_local_storage_available &&
	     ! _via_is_save_ongoing) {
	    try {
		_via_is_save_ongoing = true;
		localStorage.setItem('_via_timestamp', Date.now());
		localStorage.setItem('_via_images', package_region_data('json'));

		// save attributes
		var attr = [];
		for (var attribute of _via_region_attributes) {
		    attr.push(attribute);
		}
		localStorage.setItem('_via_region_attributes', JSON.stringify(attr));
		_via_is_save_ongoing = false;
	    } catch(err) {
		_via_is_save_ongoing = false;
		_via_is_local_storage_available = false;
		show_message('Failed to save data to browser cache. Please download the annotation data.');
		alert('Failed to save data to browser cache. Please download the annotation data.');
		console.log('Failed to save data to browser cache');
		console.log(err.message);
	    }
	}
    }, 1000);
}

function is_via_data_in_localStorage() {
    if (localStorage.getItem('_via_timestamp')) {
	return true;
    } else {
	return false;
    }
}

function clear_localStorage() {
    document.getElementById('localStorage_recovery_msg').innerHTML = '';
    localStorage.clear();
    show_home_panel();
}

function show_localStorage_recovery_options() {
    var hstr = [];
    var date_of_saved_data = new Date( parseInt(localStorage.getItem('_via_timestamp')) );
    
    hstr.push('<div style="margin-top: 4em; padding: 1em; border: 1px solid #cccccc;">');
    hstr.push('<h3 style="border-bottom: 1px solid #5599FF">Data Recovery from Browser Cache</h3>');
    hstr.push('<ul><li>Data saved on : ' + date_of_saved_data);
    hstr.push('<br/><span class="action_text_link" onclick="download_localStorage_data(\'csv\')" title="Recover annotation data">[Save as CSV]</span>');
    hstr.push(' | ');
    hstr.push('<span class="action_text_link" onclick="download_localStorage_data(\'json\')" title="Recover annotation data">[Save as JSON]</span>');
    hstr.push(' | ');
    hstr.push('<span class="action_text_link" onclick="clear_localStorage()" title="Discard annotation data">[Discard Data]</span>');
    hstr.push('</li></ul>');
    
    hstr.push('<p><b>If you continue, the cached data will be discarded!</b></p></div>');
    document.getElementById('localStorage_recovery_msg').innerHTML = hstr.join('');
}

function download_localStorage_data(type) {
    switch(type) {
    case 'csv':
	var d = JSON.parse( localStorage.getItem('_via_images') );

	var csvdata = [];
	var csvheader = "#filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes";
	csvdata.push(csvheader);

	for (var image_id in d) {
	    // copy file attributes
	    var file_attr_map = new Map();
	    for (var key in d[image_id].file_attributes) {
		file_attr_map.set(key, d[image_id].file_attributes[key]);
	    }

	    var prefix_str = d[image_id].filename;
	    prefix_str += "," + d[image_id].size;
	    prefix_str += "," + attr_map_to_str( file_attr_map );

	    // copy regions
	    var regions = d[image_id].regions;
	    var region_count = 0;
	    for (var i in regions) {
		region_count += 1;
	    }
	    
	    for (var i in regions) {
		var region_shape_attr_str = region_count + ',' + i + ',';
		
		var regioni = new ImageRegion();
		for (var key in regions[i].shape_attributes) {
		    regioni.shape_attributes.set(key, regions[i].shape_attributes[key]);
		}
		for (var key in regions[i].region_attributes) {
		    regioni.region_attributes.set(key, regions[i].region_attributes[key]);
		}
		region_shape_attr_str += attr_map_to_str( regioni.shape_attributes );
		var region_attr_str = attr_map_to_str( regioni.region_attributes );
		console.log('\n' + prefix_str + ',' + region_shape_attr_str + ',' + region_attr_str);
		csvdata.push('\n' + prefix_str + ',' + region_shape_attr_str + ',' + region_attr_str);
	    }
	}

	var localStorage_data_blob = new Blob( csvdata,
					       {type: 'text/csv;charset=utf-8'});

	save_data_to_local_file(localStorage_data_blob, 'via_region_data.csv');

	break;
    case 'json':
	var localStorage_data_blob = new Blob( [localStorage.getItem('_via_images')],
					       {type: 'text/json;charset=utf-8'});

	save_data_to_local_file(localStorage_data_blob, 'via_region_data.json');
	break;
    }
    
}

//
// Handlers for attributes input panel (spreadsheet like user input panel)
//

function toggle_attributes_input_panel() {
    if (_via_is_attributes_input_panel_visible) {
	attributes_input_panel.style.display = 'none';
	_via_is_attributes_input_panel_visible = false;
    } else {
	_via_is_attributes_input_panel_visible = true;
	update_attributes_input_panel();        
	attributes_input_panel.style.display = 'block';
    }
}

function update_attributes_input_panel() {
    if (_via_face_label_list.length == 0) {
	var msg = '<div style="margin: auto; text-align: center; width: 40%;padding: 2em 0;">Import a list of representative face images using [<a href="" onclick="">Face Labels &rarr; Import from Images</a>]. Representative images correspond to facial image of individuals that you wish to locate and  annotate in several images.</div>';
	face_label_panel.innerHTML = msg;
	return;
    }
    
    if (_via_is_attributes_input_panel_visible) {
	var face_label_html = [];
	var selregion_id = -1;
	if ( _via_current_image_loaded &&
	     _via_is_region_selected) {
	    var selregion = _via_images[_via_image_id].regions[_via_user_sel_region_id].region_attributes;
	    if (selregion.has(VIA_FACE_LABEL_ATTR_NAME)) {
		var selregion_label = selregion.get(VIA_FACE_LABEL_ATTR_NAME);
		selregion_id = _via_face_label_list.indexOf(selregion_label);
	    }
	}    
	
	for (var i=0; i<_via_face_label_list.length; ++i) {
	    if ( typeof(_via_face_label_list[i]) !== 'undefined') {
		if ( selregion_id == i) {
		    face_label_html.push('<div class="active_face_label selected">');
		} else {
		    if (_via_is_region_selected) {
			face_label_html.push('<div class="active_face_label">');
		    } else {
			face_label_html.push('<div class="face_label">');
		    }
		}
		face_label_html.push('<img title="' + _via_face_label_list[i] + '"');
		face_label_html.push(' src="' + _via_face_label_img_list[i] + '"');
		face_label_html.push(' height="160px"');
		if (_via_is_region_selected) {
		    face_label_html.push(' onclick="set_face_label(\'' + _via_face_label_list[i] + '\')"');
		}
		face_label_html.push(' alt="' + _via_face_label_list[i] + '" />');
		//face_label_html.push('<br/>' + _via_face_label_list[i].split(' ').join('<br/>'));
		face_label_html.push('<br/>' + _via_face_label_list[i]);
		face_label_html.push('</div>');
	    }
	}
	face_label_panel.innerHTML = face_label_html.join('');
    }
}

function set_face_label(value) {
    if (_via_is_region_selected) {
	var selregion = _via_images[_via_image_id].regions[_via_user_sel_region_id];
	selregion.region_attributes.set(VIA_FACE_LABEL_ATTR_NAME, value);

	// find out if any other region attribute is missing
	for (var i=0; i<_via_canvas_regions.length; ++i) {
	    var r = _via_images[_via_image_id].regions[i];
	    if (r.region_attributes.get(VIA_FACE_LABEL_ATTR_NAME) == 'undefined' ||
		typeof(r.region_attributes.get(VIA_FACE_LABEL_ATTR_NAME)) == 'undefined') {
		_via_canvas_regions[_via_user_sel_region_id].is_user_selected = false;
		_via_user_sel_region_id = i;
		_via_canvas_regions[i].is_user_selected = true;
		break;
	    }
	}
		
	update_attributes_input_panel();
	_via_reload_img_table = true;	
	show_img_list();
	_via_redraw_canvas();
	_via_canvas.focus();
    }
}

//
// used for debugging
//
function print_current_state_vars() {
    //console.log(localStorage);
    console.log('\n_via_is_user_drawing_region'+_via_is_user_drawing_region+
                '\n_via_current_image_loaded'+_via_current_image_loaded+
                '\n_via_is_window_resized'+_via_is_window_resized+
                '\n_via_is_user_resizing_region'+_via_is_user_resizing_region+
                '\n_via_is_user_moving_region'+_via_is_user_moving_region+
                '\n_via_is_user_drawing_polygon'+_via_is_user_drawing_polygon+
                '\n_via_is_region_selected'+_via_is_region_selected);
}

function print_current_image_data() {
    console.log(_via_images);
    for ( var image_id in _via_images) {
        var fn = _via_images[image_id].filename;
        var logstr = [];
        logstr.push("[" + fn + "] : ");

        var img_regions = _via_images[image_id].regions;
        for ( var i=0; i<img_regions.length; ++i) {
            var attr = img_regions[i].shape_attributes;
            var img_region_str = '\n\t_via_images[i].regions.shape_attributes = [';
            for ( var key of attr.keys() ) {
                img_region_str += key + ':' + attr.get(key) + ';';
            }
            logstr.push(img_region_str + ']');

            var attr = img_regions[i].region_attributes;
            var img_region_str = '\n\t_via_images[i].regions.region_attributes = [';
            for ( var key of attr.keys() ) {
                img_region_str += key + ':' + attr.get(key) + ';';
            }
            logstr.push(img_region_str + ']');
        }

        if ( _via_image_id == image_id ) {
            for ( var i=0; i<_via_canvas_regions.length; ++i) {
                var canvas_region_str = '\n\t_via_canvas_regions = [';
                for ( var key of _via_canvas_regions[i].shape_attributes.keys() ) {
                    var value = _via_canvas_regions[i].shape_attributes.get(key);
                    canvas_region_str += key + ':' + value + ';';
                }
                logstr.push(canvas_region_str + ']');
            }
        }
        console.log(logstr.join(''));
    }
}
