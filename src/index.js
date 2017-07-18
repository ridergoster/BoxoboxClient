var Board = require('./arduino');
var settings = require('../settings');
var request = require('request');
var rp = require('request-promise');
var arduino = new Board();

var valueSensor = 0;
var timeInterval, alarmInterval = null;
var question, choice = null;
var alarmActif = [];
var alarmTrigger = false;
var alarmObj = {};

var alarmSound = function() {
  arduino.piezo.play({
    tempo: 150, // Beats per minute, default 150
    song: [ // An array of notes that comprise the tune
      [ "b5", 3 ], // null indicates "no tone" for the beats indicated
      [ "c6", 3 ], // null indicates "no tone" for the beats indicated
    ]
  });
}

var showTime = function() {
  var date = new Date();
  var time = 'time: ' + date.toTimeString().substr(0,5);
  arduino.piezo.frequency(587, 100);
  arduino.scroll.line(0, time);
};

var showSensor = function() {
  var value =  'no data';
  switch (valueSensor = valueSensor % 3) {
    case 1:
      value = 'hum: ' + arduino.temperatureSensor.hygrometer.relativeHumidity + '%';
      break;
    case 2:
      value = 'light: ' + arduino.luminositySensor.value + ' raw';
      break;
    default:
      value = 'temp: '+ arduino.temperatureSensor.thermometer.celsius + ' celcius';
  }
  valueSensor++;
  arduino.scroll.line(1, value);
}

var responseToQuestion = function() {
  console.log('arduino controller read data', token);
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
  })
  .catch(function (err) {
    arduino.scroll.clear();
    arduino.scroll.line(0, 'an error occur...');
  });
};

var stopAlarm = function() {
  return true;
};

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
    arduino.scroll.line(0, 'question: ' + question.question);
    arduino.scroll.line(1, 'L: ' + question.answer_left + ' R: ' + question.answer_right);
  })
  .catch(function (err) {
    console.log('err API', err);
  });
});

arduino.on('info', function() {
  arduino.piezo.frequency(587, 100);
  showSensor();
  if (!timeInterval) {
    showTime();
    timeInterval = setInterval((showTime), 60000);
  }
});

arduino.on('trigger', function() {
  arduino.scroll.clear();
  clearInterval(timeInterval);
  choice = null;
  question = null;
  timeInterval = null;
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

arduino.on('card-reader', function(token) {
  if (choice != null && question != null && arduino.status === 'question') {
    responseToQuestion();
  }
  else if (alarmTrigger == true) {
    stopAlarm();
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
    arduino.scroll.lines(0, "ALARM  NOISE ACTIVATED !");
    arduino.scroll.lines(1, "PLEASE STOP ME...")
    this.ledV.on();
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
    arduino.scroll.lines(0, "ALARM  NOISE ACTIVATED !");
    arduino.scroll.lines(1, "PLEASE STOP ME...")
    this.ledR.on();
  }
});
