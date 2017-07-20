var Board = require('./arduino');
var settings = require('../settings');
var socket = require('socket.io-client')(settings.api.url);
var _ = require('lodash');
var request = require('request');
var rp = require('request-promise');
var arduino = new Board();

var valueSensor = 0;
var timeInterval, alarmInterval, temperatureInterval, luminosityInterval, humidityInterval = null;
var question, choice = null;
var alarmActif = [];
var alarmTrigger = false;
var alarmObj = {};

function responseToQuestion(token) {
  var options = {
      method: 'POST',
      uri: settings.api.url + settings.api.route.answer.post,
      body: {
        question: question._id,
        answer: choice
      },
      headers: {
          'User-Agent': 'Request-Promise',
          'Authorization': token
      },
      json: true
  };
  rp(options)
  .then(function (value) {
    arduino.scroll.clear();
    arduino.scroll.line(0, value.user.username + ' answer save !');
    socket.emit('question-answer', {'username': value.user.username, 'question': value.question.question});
  })
  .catch(function (err) {
    arduino.scroll.clear();
    arduino.scroll.line(0, 'an error occur...');
  });
};

function stopAlarm(token) {
  clearInterval(alarmInterval);
  alarmTrigger = false;
  arduino.status = "nothing";
  _.pull(alarmActif, alarmObj.sensor);
  alarmObj.endDate = new Date();
  var postAlarm = {
      method: 'POST',
      uri: settings.api.url + settings.api.route.alarm.post,
      body: alarmObj,
      headers: {
          'User-Agent': 'Request-Promise',
          'Authorization': token
      },
      json: true
  };
  rp(postAlarm)
  .then(function (value) {
    alarmObj = {};
    arduino.scroll.clear();
    arduino.scroll.line(0, value.user.username + ' stop the alarm !');
    socket.emit('alarm-stop', {'username': value.user.username, 'sensor': value.sensor });
  })
  .catch(function (err) {
    alarmObj = {};
    arduino.scroll.clear();
    arduino.scroll.line(0, 'an error occur...');
  });
};

var sendTemperature = function() {
  var postTemperature = {
      method: 'POST',
      uri: settings.api.url + settings.api.route.temperature.post,
      body: {
        value: arduino.temperatureSensor.celsius
      },
      headers: {
          'User-Agent': 'Request-Promise',
          'Authorization': settings.auth.token
      },
      json: true
  };
  rp(postTemperature)
  .then(function (value) {
    console.log('[POST-TEMPERATURE]: OK', value.value);
  })
  .catch(function (err) {
    console.log('[POST-TEMPERATURE]: FAIL', err);
  });
};

var sendLuminosity = function() {
  var postLuminosity = {
      method: 'POST',
      uri: settings.api.url + settings.api.route.luminosity.post,
      body: {
        value: arduino.luminositySensor.value
      },
      headers: {
          'User-Agent': 'Request-Promise',
          'Authorization': settings.auth.token
      },
      json: true
  };
  rp(postLuminosity)
  .then(function (value) {
    console.log('[POST-LUMINOSITY]: OK', value.value);
  })
  .catch(function (err) {
    console.log('[POST-LUMINOSITY]: FAIL', err);
  });
};

var sendHumidity = function() {
  var postHumidity = {
      method: 'POST',
      uri: settings.api.url + settings.api.route.humidity.post,
      body: {
        value: arduino.HumiditySensor.relativeHumidity
      },
      headers: {
          'User-Agent': 'Request-Promise',
          'Authorization': settings.auth.token
      },
      json: true
  };
  rp(postHumidity)
  .then(function (value) {
    console.log('[POST-HUMIDITY]: OK', value.value);
  })
  .catch(function (err) {
    console.log('[POST-HUMIDITY]: FAIL', err);
  });
};

var alarmSound = function() {
  arduino.piezo.play({
    tempo: 150,
    song: [
      [ "b5", 3 ],
      [ "c6", 3 ],
    ]
  });
};

var showTime = function() {
  var date = new Date();
  var time = date.toTimeString().substr(0,5);
  console.log('[SHOW-TIME] OK', time);
  arduino.piezo.frequency(587, 100);
  arduino.scroll.line(0, time);
};

var showSensor = function() {
  var value =  'no data';
  switch (valueSensor = valueSensor % 3) {
    case 1:
      value = 'HUMIDITY: ' + arduino.HumiditySensor.relativeHumidity + '%';
      break;
    case 2:
      value = 'LIGHT: ' + arduino.luminositySensor.value;
      break;
    default:
      value = 'TEMPERATURE: '+ arduino.temperatureSensor.C + 'c';
  }
  valueSensor++;
  arduino.scroll.line(1, value);
}

arduino.on('start', function() {
  clearInterval(temperatureInterval);
  clearInterval(luminosityInterval);
  clearInterval(humidityInterval);
  humidityInterval = null;
  luminosityInterval = null;
  temperatureInterval = null;
  temperatureInterval = setInterval(sendTemperature, 60000);
  luminosityInterval = setInterval(sendLuminosity, 60000);
  humidityInterval = setInterval(sendHumidity, 60000);
  arduino.emit('info');
});

arduino.on('info', function() {
  arduino.piezo.frequency(587, 100);
  showSensor();
  if (!timeInterval) {
    showTime();
    timeInterval = setInterval((showTime), 60000);
  }
});

arduino.on('question', function() {
  arduino.piezo.frequency(587, 100);
  var options = {
      uri: settings.api.url + settings.api.route.question.random,
      headers: {
          'User-Agent': 'Request-Promise',
          'Authorization': settings.auth.token
      },
      json: true
  };
  rp(options)
  .then(function (value) {
    question = value;
    arduino.scroll.line(0,question.question);
    arduino.scroll.line(1, 'LEFT OR RIGHT');
  })
  .catch(function (err) {
    console.log('err API', err);
    arduino.scroll.line(0, 'an error occur...');
  });
});

arduino.on('choice-left', function() {
  if (arduino.status === 'question' && question !== null) {
    arduino.piezo.frequency(587, 100);
    arduino.scroll.line(1, 'choice \"' + question.answer_left + '\" ?');
    choice = 'LEFT';
  }
});

arduino.on('choice-right', function() {
  if (arduino.status === 'question' && question !== null) {
    arduino.piezo.frequency(587, 100);
    arduino.scroll.line(1, 'choice \"' + question.answer_right + '\" ?');
    choice = 'RIGHT';
  }
});

arduino.on('alarm-noise', function() {
  if(alarmActif.includes('NOISE') && !alarmTrigger) {
    alarmTrigger = true;
    arduino.status = 'alarm';
    alarmObj.sensor = 'NOISE';
    alarmObj.startDate = new Date();
    alarmSound();
    alarmInterval = setInterval(alarmSound, 5000);
    arduino.scroll.clear();
    arduino.scroll.line(0, "ALARM  NOISE ACTIVATED !");
    arduino.scroll.line(1, "PLEASE STOP ME...")
    this.ledV.on();
    socket.emit('alarm-noise-trigger');
  }
});

arduino.on('alarm-luminosity', function() {
  if(alarmActif.includes('LUMINOSITY') && !alarmTrigger) {
    alarmTrigger = true;
    arduino.status = 'alarm';
    alarmObj.sensor = 'LUMINOSITY';
    alarmObj.startDate = new Date();
    alarmSound();
    alarmInterval = setInterval(alarmSound, 5000);
    arduino.scroll.clear();
    arduino.scroll.line(0, "ALARM  LUMINOSITY ACTIVATED !");
    arduino.scroll.line(1, "PLEASE STOP ME...")
    this.ledR.on();
    socket.emit('alarm-luminosity-trigger');
  }
});

arduino.on('card-reader', function(token) {
  if (choice != null && question != null && arduino.status === 'question') {
    responseToQuestion(token);
  }
  else if (alarmTrigger == true && arduino.status === 'alarm') {
    stopAlarm(token);
  }
});

arduino.on('reset', function() {
  arduino.scroll.clear();
  clearInterval(timeInterval);
  choice = null;
  question = null;
  timeInterval = null;
});

socket.on('connect', function(){
  console.log('connected to socket !');
  socket.emit('arduino');
});

socket.on('activate-alarm-luminosity', function () {
  if (!alarmActif.includes('LUMINOSITY')) {
    alarmActif.push('LUMINOSITY');
    arduino.piezo.frequency(587, 100);
    arduino.scroll.line(1, 'LUMINOSITY ALARM ON');
  }
  socket.emit('alarm-luminosity-activate');
});

socket.on('activate-alarm-noise', function () {
  if (!alarmActif.includes('NOISE')) {
    alarmActif.push('NOISE');
    arduino.piezo.frequency(587, 100);
    arduino.scroll.line(1, 'NOISE ALARM ON');
  }
  socket.emit('alarm-noise-activate');
});

socket.on('desactivate-alarm-luminosity', function () {
  if (alarmActif.includes('LUMINOSITY')) {
    _.pull(alarmActif, 'LUMINOSITY');
    arduino.piezo.frequency(587, 100);
    arduino.scroll.line(1, 'LUMINOSITY ALARM OFF');
  }
  socket.emit('alarm-luminosity-desactivate');
});

socket.on('desactivate-alarm-noise', function () {
  if (alarmActif.includes('NOISE')) {
    _.pull(alarmActif, 'NOISE');
    arduino.piezo.frequency(587, 100);
    arduino.scroll.line(1, 'NOISE ALARM OFF');
  }
  socket.emit('alarm-noise-desactivate');
});

socket.on('question-create', function() {
  if (arduino.status !== 'alarm') {
    arduino.piezo.frequency(587, 100);
    var options = {
        uri: settings.api.url + settings.api.route.question.last,
        headers: {
            'User-Agent': 'Request-Promise',
            'Authorization': settings.auth.token
        },
        json: true
    };
    rp(options)
    .then(function (value) {
      arduino.status = 'question';
      question = value;
      arduino.scroll.line(0, question.question);
      arduino.scroll.line(1, 'LEFT OR RIGHT');
    })
    .catch(function (err) {
      console.log('err API', err);
      arduino.scroll.line(0, 'an error occur online...');
    });
  }
});

socket.on('set-interval-humidity', function(data) {
  if (data && data.interval) {
    var interval = parseInt(data.interval) * 1000;
    clearInterval(humidityInterval);
    if (interval >= 1000) {
      humidityInterval = setInterval(sendHumidity, interval);
      console.log("[INTERVAL-HUMIDITY] CHANGE", interval);
    } else {
      console.log("[INTERVAL-HUMIDITY] OFF");
    }
  }
});

socket.on('set-interval-luminosity', function(data) {
  if (data && data.interval) {
    var interval = parseInt(data.interval) * 1000;
    clearInterval(luminosityInterval);
    if (interval >= 1000) {
      luminosityInterval = setInterval(sendLuminosity, interval);
      console.log("[INTERVAL-LUMINOSITY] CHANGE", interval);
    } else {
      console.log("[INTERVAL-LUMINOSITY] OFF");
    }
  }
});

socket.on('set-interval-temperature', function(data) {
  if (data && data.interval) {
    var interval = parseInt(data.interval) * 1000;
    clearInterval(temperatureInterval);
    if (interval >= 1000) {
      temperatureInterval = setInterval(sendTemperature, interval);
      console.log("[INTERVAL-TEMPERATURE] CHANGE", interval);
    } else {
      console.log("[INTERVAL-TEMPERATURE] OFF");
    }
  }
});
