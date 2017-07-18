var say = require('say');
var five = require('johnny-five');
EventEmitter = require("events").EventEmitter;
const { NFC } = require('nfc-pcsc');

var Board = class Board extends EventEmitter {
  constructor() {
    super();
    this.status = 'start';
    this.board = new five.Board();
    this.nfc = new NFC();

    this.board.on("ready", function() {
      this.lcd = new five.LCD({
        pins: [7, 6, 5, 4, 3, 2],
        rows: 2,
        cols: 16,
        lines: 2
      });
      this.piezo = new five.Piezo(8);
      this.ledV = new five.Led(9);
      this.ledJ = new five.Led('A0');
      this.ledR = new five.Led('A1');
      this.leftBtn = new five.Button(10);
      this.rightBtn = new five.Button(11);
      this.questionBtn = new five.Button(12);
      this.timeBtn = new five.Button(13);

      this.microphoneSensor = new five.Sensor({
        pin: "A2",
        threshold: 50,
      });

      this.luminositySensor = new five.Sensor({
        pin: "A3",
        threshold: 50,
      });

      this.temperatureSensor = new five.Multi({
        controller: "DHT11_I2C_NANO_BACKPACK"
      });

      this.questionBtn.on("down", function() {
        if (this.status !== 'alarm') {
          this.emit('trigger');
          this.status = 'question';
          this.emit('question');
        }
      }.bind(this));

      this.timeBtn.on("down", function() {
        if (this.status !== 'info' && this.status !== 'alarm') {
          this.emit('trigger');
          this.status = 'info';
        }
        this.emit('info');
      }.bind(this));

      this.scroll = require('lcd-scrolling');
      this.scroll.setup({
        lcd: this.lcd,
        char_length: 16,
        row: 2,
        firstCharPauseDuration: 2000,
        lastCharPauseDuration: 1000,
        scrollingDuration: 800,
        full: true
      });

      this.leftBtn.on("down", function() {
        console.log('choice left');
        this.emit("choice-left");
      }.bind(this));

      this.rightBtn.on("down", function() {
        console.log('choice right');
        this.emit("choice-right");
      }.bind(this));

      this.microphoneSensor.on("change", function() {
        this.emit('alarm-noise');
      }.bind(this))

      this.luminositySensor.on("change", function() {
        this.emit('alarm-luminosity');
      }.bind(this))

      this.status = 'info';
      this.board.wait(1000, function() {this.emit('info'); }.bind(this));
    }.bind(this));

    this.nfc.on('reader', function(reader) {

      console.log(`${reader.reader.name}  device attached`);

      // needed for reading tags emulated with Android HCE
      // custom AID, change according to your Android for tag emulation
      // see https://developer.android.com/guide/topics/connectivity/nfc/hce.html
      reader.aid = 'F222222222';

      reader.on('card', function(card) {
        // [always] String type: TAG_ISO_14443_3 (standard nfc tags like Mifare) or TAG_ISO_14443_4 (Android HCE and others)
        // [always] String standard: same as type
        // [only TAG_ISO_14443_3] String uid: tag uid
        // [only TAG_ISO_14443_4] Buffer data: raw data from select APDU response
        console.log(`${reader.reader.name}  card detected`, card);
        var userToken = card.data.toString('utf8');
        console.log('Buffer converted: ', userToken);
        this.emit('card-reader', userToken);
      }.bind(this));

      reader.on('card.off', function(card) {
        console.log(`${reader.reader.name}  card removed`, card);
      }.bind(this));

      reader.on('error', function(card) {
        console.log(`${reader.reader.name}  an error occurred`, err);
      }.bind(this));

      reader.on('end', function(card) {
        console.log(`${reader.reader.name}  device removed`);
      }.bind(this));
    }.bind(this));

    this.nfc.on('error', function(err) {
      console.log('an error occurred', err);
    }.bind(this));

    this.on('uncaughtException', (err) => {
      console.error('whoops! there was an error');
    });
    this.on('error', (err) => {
      console.error('whoops! there was an error');
    });
  }
}

module.exports = Board
