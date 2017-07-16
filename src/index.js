var Board = require('./arduino');
var settings = require('../settings');
var request = require('request');
var rp = require('request-promise');
var arduino = new Board();

var valueSensor = 0;
var timeInterval = null;
var question, choise = null;

var showTime = function() {
  var date = new Date();
  var time = 'time: ' + date.getHours() + ':' + date.getMinutes();
  arduino.scroll.line(0, time);
};

var showSensor = function() {
  var value =  'no data';
  switch (valueSensor = valueSensor % 3) {
    case 1:
      value = 'hum: ' + arduino.temperatureSensor.hygrometer.relativeHumidity + '%';
      break;
    case 2:
      value = 'light: ' + arduino.luminositySensor.raw + ' raw';
      break;
    default:
      value = 'temp: '+ arduino.temperatureSensor.thermometer.celsius + ' celcius';
  }
  valueSensor++;
  arduino.scroll.line(1, value);
}

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
    choise = 'LEFT';
  }
});


arduino.on('choice-right', function() {
  if (arduino.status === 'question' && question !== null) {
    arduino.piezo.frequency(587, 100);
    arduino.scroll.line(1, 'choice \"' + question.answer_right + '\" ?');
    choise = 'RIGHT';
  }
});
