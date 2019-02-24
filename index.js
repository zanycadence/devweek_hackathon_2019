const rp = require('request-promise');
const request = require('request');
const fs = require('fs');

const express = require('express')
const app = express()
const port = 3001

const BOUNDARY = '---------------RANDOMSTRINGBOUNDARY------------';


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

  return new Promise(function (resolve, reject) {
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
      .then(() => {
        console.log("liveview ready");
        resolve();
      })
      .catch((err) => {
        console.log("err stopping stream: " + err);
        reject();
      })

  })

}

var stop_liveview = () => {

  return new Promise(function (resolve, reject) {
    var options = {
      method: 'DELETE',
      uri: liveview_get_img_stream_addr,
      json: true
    }

    rp(options)
      .then(() => {
        console.log("liveview stopped");
        resolve();
      })
      .catch((err) => {
        console.log(err);
        reject();
      })

  })
}

// function streamToPromise(stream) {
//   return new Promise(function (resolve, reject) {
//     // resolve with location of saved file
//     stream.on("end", resolve);
//     stream.on("error", reject);
//   })
// }


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
          fs.writeFile('./frames/frame.jpg', img_string, 'hex', (err) => {
            console.log(err)
            img_string = '';
          })
        } else {
          img_string += stringified;
        }
        frame++;
      })
    })
}

// var delay = (delay_length) => {
//   return new Promise(function (resolve, reject) {
//     setTimeout(resolve, 100);
//   })
// }

var connect_camera = () => {
  return new Promise(function (resolve, reject) {
    rp(camera_base_addr)
      .then(() => {
        console.log("started camera connection")
        resolve();
      })
      .catch((err) => {
        console.log("error starting camera connection...");
        reject(err)
      });
  })
}


app.get('/start_camera', (req, res) => {
  connect_camera()
    .then(() => {
      res.send({
        status: "success"
      })
    })
    .catch((err) => {
      res.send({
        status: "err"
      })
    })
});

app.get('/start_liveview', (req, res) => {
  start_liveview()
    .then(() => {
      res.send({
        status: "success"
      });
    })
    .catch((err) => {
      res.send({
        status: "err"
      })
    });
});

app.get('/stop_liveview', (req, res) => {
  stop_liveview()
    .then(() => {
      res.send({
        status: "success"
      })
    })
    .catch(() => {
      res.send({
        status: "err"
      })
    })
});

app.get('/live.jpg', (req, res) => {
  res.set({
    'content-type': `multipart/x-mixed-replace;boundary="${BOUNDARY}"`,
    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
    'Connection': 'keep-alive',
  });

  res.on('close', () => {
    res.end()
  });

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
          var img_buffer = Buffer.from(img_string, 'hex');
          img_string = '';
          console.log("FRAME END");
          res.write(`--${BOUNDARY}\r\n`);
          res.write('content-type: image/jpeg\r\n');
          res.write(`content-length: ${img_buffer.length}\r\n`);
          res.write('\r\n');
          res.write(img_buffer, 'binary');
          res.write('\r\n');

          // fs.writeFile('./frames/frame.jpg', img_string, 'hex', (err) => {
          //   console.log(err)
          //   img_string = '';
          // })
        } else {
          img_string += stringified;
        }
      })
    })


});


app.listen(port, () => {
  console.log('express app running on port ' + port)
});