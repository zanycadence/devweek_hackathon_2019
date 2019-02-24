const rp = require('request-promise');
const request = require('request');
const fs = require('fs');
const SerialPort = require('serialport')
const port = new SerialPort('/dev/something', {
  baudRate: 9600
})

const express = require('express')
const app = express()
const port = 3001

app.use(express.json())

const BOUNDARY = '---------------RANDOMSTRINGBOUNDARY------------';


//ccapi data
const camera_base_addr = "http://172.20.10.4:8080/ccapi";
const liveview_start_addr = camera_base_addr + "/ver100/shooting/liveview";
const liveview_get_one_addr = liveview_start_addr + "/flip";
const liveview_get_img_stream_addr = liveview_start_addr + "/scrolldetail";
const shooting_shutter_addr = camera_base_addr + "/ver100/shooting/control/shutterbutton/manual";
const zoom_addr = camera_base_addr + "/ver100/shooting/control/zoom";
const sd_card_addr = camera_base_addr + "/ver100/contents/sd/100CANON";

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
var press_shutter_button = () => {
  return new Promise(function (resolve, reject) {
    var options = {
      method: 'POST',
      uri: shooting_shutter_addr,
      body: {
        action: "full_press",
        af: true
      },
      json: true
    };

    rp(options)
      .then(() => {
        console.log("shutter pressed!");
        resolve();
      })
      .catch((err) => {
        console.log("shutter press error!: ", err);
        reject();
      })
  })
}

var delay = (length) => {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, length)
  })
}

var list_contents = () => {
  return new Promise(function (resolve, reject) {
    rp(sd_card_addr)
      .then((result) => {
        var res = JSON.parse(result);
        var filenames = [];
        var ret_obj = {};
        for (var i = 0; i < res.url.length; i++) {
          filenames.push(res.url[i].split("/").pop())
        }
        ret_obj.filenames = filenames;
        console.log("successfully listed sdcard contents");
        resolve(ret_obj);
      })
      .catch((err) => {
        console.log("error reading sdcard contents: ", err);
        reject();
      })
  })
}

var get_image = (filename) => {
  return new Promise(function (resolve, reject) {
    console.log("hitting: " + sd_card_addr + "/" + filename);
    request(sd_card_addr + "/" + filename).on('response', (response) => {
      var img_data = '';
      response.setEncoding('binary');
      response.on('data', function (chunk) {
        img_data += chunk;
      });

      response.on('end', function () {
        console.log("data ended!")
        resolve(img_data);
      });

    })
  })

}

var get_zoom_level = () => {
  return new Promise(function (resolve, reject) {
    rp(zoom_addr)
      .then((result) => {
        var res = JSON.parse(result);
        console.log("zoom level: " + res.value);
        resolve(res.value);
      })
      .catch((err) => {
        console.log("get zoom error: ", err);
        reject();
      })
  })
}

var set_zoom_level = (level) => {
  return new Promise(function (resolve, reject) {
    var options = {
      method: "POST",
      uri: zoom_addr,
      body: {
        value: level
      },
      json: true
    }
    rp(options)
      .then((result) => {
        var res = JSON.parse(result);
        console.log("zoom level: " + res.value);
        resolve(res.value);
      })
      .catch((err) => {
        console.log("get zoom error: ", err);
        reject();
      })
  })
}

var release_shutter_button = () => {
  return new Promise(function (resolve, reject) {
    var options = {
      method: 'POST',
      uri: shooting_shutter_addr,
      body: {
        action: "release",
        af: true
      },
      json: true
    };

    rp(options)
      .then(() => {
        console.log("shutter released!");
        resolve();
      })
      .catch((err) => {
        console.log("shutter press error!");
        reject();
      })
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

app.get("/robot/f", (req, res) => {
  port.write("f\n");
  res.send({
    status: "success"
  })
});
app.get("/robot/b", (req, res) => {
  port.write("b\n");
  res.send({
    status: "success"
  })
});
app.get("/robot/fl", (req, res) => {
  port.write("fl\n");
  res.send({
    status: "success"
  })
});
app.get("/robot/fr", (req, res) => {
  port.write("fr\n");
  res.send({
    status: "success"
  })
});
app.get("/robot/bl", (req, res) => {
  port.write("fl\n");
  res.send({
    status: "success"
  })
});
app.get("/robot/br", (req, res) => {
  port.write("fr\n");
  res.send({
    status: "success"
  })
});



app.get("/", (req, res) => {
  res.send("welcome to photbot");
})

app.get("/sdcard", (req, res) => {
  list_contents()
    .then((urls) => {
      res.send(urls);
    })
    .catch((err) => {

      console.log(err);
      res.send({
        error: err
      });
    })
})

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

app.get('/zoom', (req, res) => {
  get_zoom_level()
    .then((val) => {
      res.send({
        zoom: val
      })
    })
    .catch((err) => {
      res.send({
        err: 'get zoom err'
      })
    })
})

app.post('/zoom', (req, res) => {
  console.log(req.body.zoom);

  set_zoom_level(req.body.zoom)
    .then((val) => {
      res.send({
        zoom: val
      })
    })
    .catch((err) => {
      res.send({
        error: "zoom set error"
      })
    })
})

app.get('/snap', (req, res) => {
  press_shutter_button()
    .then(release_shutter_button)
    .then(() => {
      res.send({
        status: "success"
      })
    })
    .catch((err) => {
      res.send({
        status: err
      })
    })
});

app.get("/sdcard/fetch", (req, res) => {
  var img_name = req.query.img;

  if (img_name) {
    get_image(img_name)
      .then((image) => {
        var data = Buffer.from(image, 'binary')
        console.log("now to send the image...");
        res.setHeader('content-type', 'image/jpeg');
        res.setHeader('content-length', data.length)
        res.end(data);
      })
  } else {
    res.send({
      error: "invalid name"
    });
  }
})

app.get('/snap_return', (req, res) => {
  press_shutter_button()
    .then(release_shutter_button)
    .then((res) => {
      return new Promise(function (resolve, reject) {
        delay(500)
          .then(resolve)
          .catch(reject)
      })
    })
    .then(list_contents)
    .then((filenames) => {
      return new Promise(function (resolve, reject) {
        get_image(filenames.filenames.pop())
          .then((image) => {
            resolve(image);
          })
      })
    })
    .then((image) => {
      var data = Buffer.from(image, 'binary')
      console.log("now to send the image...");
      res.setHeader('content-type', 'image/jpeg');
      res.setHeader('content-length', data.length)
      res.end(data);
    })
    .catch((err) => {
      console.log("err capturing and sending image: ", err);
      res.send({
        error: err
      });
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

  start_liveview()
    .then(() => {
      res.set({
        'content-type': `multipart/x-mixed-replace;boundary="${BOUNDARY}"`,
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Connection': 'keep-alive',
      });
      res.on('close', () => {
        res.send({
          stream: "done!"
        })
        res.end();
      });
      var loop = () => {
        request(liveview_get_one_addr).on('response', (response) => {
          var img_data = '';
          response.setEncoding('binary');
          response.on('data', function (chunk) {
            img_data += chunk
          });

          response.on('end', function () {
            var chunk_buffer = Buffer.from(img_data, 'binary');
            var stringified = chunk_buffer.toString('hex');
            var img_buffer = Buffer.from(stringified, 'hex')

            res.write(`--${BOUNDARY}\r\n`);
            res.write('content-type: image/jpeg\r\n');
            res.write(`content-length: ${img_buffer.length}\r\n`);
            res.write('\r\n');
            res.write(img_buffer, 'binary');
            res.write('\r\n');
          })
        })
      }
      setInterval(loop, 300);
    })

});

app.get('/actual_live.jpg', (req, res) => {
  res.set({
    'content-type': `multipart/x-mixed-replace;boundary="${BOUNDARY}"`,
    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
    'Connection': 'keep-alive',
  });

  res.on('close', () => {
    res.end();
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
          if (img_string != '') {
            var img_buffer = Buffer.from(img_string, 'hex');
            img_string = '';
            console.log("FRAME END");
            res.write(`--${BOUNDARY}\r\n`);
            res.write('content-type: image/jpeg\r\n');
            res.write(`content-length: ${img_buffer.length}\r\n`);
            res.write('\r\n');
            res.write(img_buffer, 'binary');
            res.write('\r\n');
          }

        } else {
          img_string += stringified;
        }
      })
    })


});


app.listen(port, () => {
  console.log('express app running on port ' + port)
});