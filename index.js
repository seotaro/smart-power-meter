'use strict';

require('dotenv').config();

const BP35A1 = require('./BP35A1');
const echonet = require('./echonet');

const SerialPort = require('serialport')
const { Readline } = SerialPort.parsers;

const port = new SerialPort(process.env.SERIAL_PORT, { autoOpen: true, baudRate: 115200, }, function (err) {
    if (err) {
        return console.log('Error: ', err.message)
    }
})

const bp35a1 = new BP35A1(port);

const parser = port.pipe(new Readline({ delimiter: '\r\n', encoding: 'binary' }));
parser.on('data', data => {
    bp35a1.dispatch(data);
});

// エコーバックの抑止から通信シーケンススタート。
bp35a1.send(`SKSREG`, 'SFE 0');

// PANA に接続後、繰り返し瞬時電力計測値を取得する。
const read = async () => {
    if (bp35a1.isConnected) {
        // スマート電力量メータに瞬時電力計測値を要求する
        const frame = echonet.Frame.PRESET['瞬時電力計測値'];
        bp35a1.sendEchonet(frame);
    }
};
setInterval(() => { read() }, process.env.INTERVAL);


