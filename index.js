const rp = require('request-promise');
const request = require('request');
const fs = require('fs');


var stream = require('stream');
var util = require('util');

function EchoStream() { // step 2
  stream.Writable.call(this);
};
util.inherits(EchoStream, stream.Writable); // step 1
EchoStream.prototype._write = function (chunk, encoding, done) { // step 3
  console.log(chunk.toString());
  done();
}


//ccapi data
const camera_base_addr = "http://192.168.1.2:8080/ccapi";
const liveview_start_addr = camera_base_addr + "/ver100/shooting/liveview";
const liveview_get_one_addr = liveview_start_addr + "/flip";
const liveview_get_img_stream_addr = liveview_start_addr + "/scrolldetail"



var start_liveview = () => {
  var options = {
    method: 'POST',
    uri: liveview_start_addr,
    body: {
      "liveviewsize": "small",
      "cameradisplay": "on"
    },
    json: true
  }

  rp(options)
    .then((response) => {
      console.log(response);
    })
    .catch((err) => {
      console.log(err);
    })
}

function streamToPromise(stream) {
  return new Promise(function (resolve, reject) {
    // resolve with location of saved file
    stream.on("end", resolve);
    stream.on("error", reject);
  })
}


var get_one_liveview_img = () => {
  var img_data = '';

  request(liveview_get_one_addr).on('response', (response) => {
    response.setEncoding('binary');
    response.on('data', function (chunk) {
      img_data += chunk;
      console.log(chunk);
    })

    response.on('end', function () {
      fs.writeFile('./video/g.jpg', img_data, 'binary', function (err) {
        if (err) {
          console.log(err)
        }
      })
    })


  })
}



var get_liveview_scroll = () => {
  var frame = 0;
  var img_string = '';
  request(liveview_get_img_stream_addr)
    .on('response', (response) => {
      response.setEncoding('binary');
      var frame = 0;
      console.log(response.headers);
      test_buffer = Buffer.from('FF00', 'hex')
      response.on('data', function (chunk) {
        var chunk_buffer = Buffer.from(chunk, 'binary');
        var stringified = chunk_buffer.toString('hex');
        var string_starter = stringified.slice(0, 4);

        if (string_starter == 'ff00' && img_string == '') {
          img_string += stringified.slice(15, stringified.length);
          console.log("FRAME START")
        } else if (stringified == 'ffff') {
          console.log("FRAME END");
          fs.writeFile('./frames/frame_' + frame + '.jpg', img_string, 'hex', (err) => {
            console.log(err)
            img_string = '';
          })
        } else {
          img_string += stringified;
        }


        console.log(stringified.slice(0, 14));
        console.log(stringified.slice((stringified.length - 4), stringified.length));
        frame++;
      })
    })
}

var delay = (delay_length) => {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, 100);
  })
}

var connect_camera = () => {
  rp(camera_base_addr)
    .then((response) => {
      // console.log(response);

      start_liveview();
      //get_one_liveview_img();
      //   .then(delay)
      //   .then(connect_camera);
      //setInterval(get_one_liveview_img, 1000);

      get_liveview_scroll();
    })
}


connect_camera();
//start_liveview();