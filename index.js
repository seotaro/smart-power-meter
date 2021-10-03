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

bp35a1.on('echonet', (frame) => {
    if (echonet.EchonetObject.equals(frame.SEOJ, echonet.EchonetObject.PRESET['ノードプロファイル']) && (frame.ESV === 0x73)) {
        // 送信元が プロファイルクラスグループ x ノードプロファイル x 一般ノード で プロパティ値通知

        frame.properties.forEach(property => {
            switch (property.EPC) {
                case 0xD5:
                    {
                        let isSmartPowerMeter = false;

                        const desc = echonet.Frame.parseProperty(frame.SEOJ, property);
                        let EOJs = '';
                        for (let i = 0; i < desc.value.length; i++) {
                            const instance = desc.value[i];
                            if (echonet.EchonetObject.equals(instance, echonet.EchonetObject.PRESET['スマート電力量メータ'])) {
                                isSmartPowerMeter = true;
                            }

                            if (EOJs.length) {
                                EOJs += ', ';
                            }
                            EOJs += `[${instance.toString()}]`;
                        }

                        console.log(`${desc.type} ${EOJs}`);

                        if (!isSmartPowerMeter) {
                            console.error('PAN にスマート電力量メータが存在しない');
                        }
                    }

                    break;
            }
        })

    } else if (echonet.EchonetObject.equals(frame.SEOJ, echonet.EchonetObject.PRESET['スマート電力量メータ'])) {
        // 送信元が 住宅・設備関連機器クラスグループ x 低圧スマート電力量メータ

        frame.properties.forEach(property => {
            switch (property.EPC) {
                case 0xE7:
                    {
                        const desc = echonet.Frame.parseProperty(frame.SEOJ, property);
                        console.log(`${desc.type} ${desc.value} [${desc.unit}]`);
                    }
                    break;

                case 0xEA:
                case 0xEB:
                    {
                        const desc = echonet.Frame.parseProperty(frame.SEOJ, property);
                        console.log(`${desc.type} ${desc.datetime.toISOString()} ${desc.value} [${desc.unit}]`);
                    }
                    break;
            }
        })

    } else {
        console.error(`unknown ECHONET frame`);
        console.log(frameData.toString("hex"));
        console.log(frame.toString());
    }

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


